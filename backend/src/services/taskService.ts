// services/taskService.ts
import { pool } from '../config/db';
import { PoolClient } from 'pg';
import { Task, TaskAttachment, TaskComment, CreateTaskRequest, UpdateTaskRequest, PaginationParams } from '../types/task';

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class TaskService {
  private static readonly TASK_SELECT_QUERY = `
    WITH task_attachments AS (
      SELECT 
        task_id,
        json_agg(
          jsonb_build_object(
            'id', id,
            'fileName', file_name,
            'fileUrl', file_url,
            'fileType', file_type,
            'fileSizeBytes', file_size_bytes,
            'createdAt', created_at
          )
        ) as attachments
      FROM task_attachments
      WHERE soft_deleted_at IS NULL
      GROUP BY task_id
    ),
    task_comments AS (
      SELECT 
        task_id,
        json_agg(
          jsonb_build_object(
            'id', tc.id,
            'content', tc.content,
            'createdAt', tc.created_at,
            'user', jsonb_build_object(
              'id', u.id,
              'firstName', u.first_name,
              'lastName', u.last_name
            )
          )
        ) as comments
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.soft_deleted_at IS NULL
      GROUP BY task_id
    )
    SELECT 
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.deadline,
      t.progress_percentage as "progressPercentage",
      t.project_id as "projectId",
      t.recurring_pattern as "recurringPattern",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt",
      t.completed_at as "completedAt",
      jsonb_build_object(
        'id', u_assignee.id,
        'firstName', u_assignee.first_name,
        'lastName', u_assignee.last_name
      ) as assignee,
      jsonb_build_object(
        'id', u_assigner.id,
        'firstName', u_assigner.first_name,
        'lastName', u_assigner.last_name
      ) as assigner,
      COALESCE(ta.attachments, '[]'::json) as attachments,
      COALESCE(tc.comments, '[]'::json) as comments
    FROM tasks t
    LEFT JOIN users u_assignee ON t.assigned_user_id = u_assignee.id
    LEFT JOIN users u_assigner ON t.assigner_id = u_assigner.id
    LEFT JOIN task_attachments ta ON t.id = ta.task_id
    LEFT JOIN task_comments tc ON t.id = tc.task_id
    WHERE t.soft_deleted_at IS NULL
  `;

  static async getAllTasks(params: PaginationParams): Promise<{ 
    tasks: Task[]; 
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc', ...filters } = params;
      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Add filter conditions
      if (filters.status) {
        conditions.push(`t.status = $${paramIndex++}`);
        queryParams.push(filters.status);
      }
      if (filters.priority) {
        conditions.push(`t.priority = $${paramIndex++}`);
        queryParams.push(filters.priority);
      }
      if (filters.assigneeId) {
        conditions.push(`t.assigned_user_id = $${paramIndex++}`);
        queryParams.push(filters.assigneeId);
      }
      if (filters.assignerId) {
        conditions.push(`t.assigner_id = $${paramIndex++}`);
        queryParams.push(filters.assignerId);
      }

      const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM tasks t
        WHERE t.soft_deleted_at IS NULL
        ${whereClause}
      `;
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const tasksQuery = `
        ${TaskService.TASK_SELECT_QUERY}
        ${whereClause}
        ORDER BY t.${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      queryParams.push(limit, offset);

      const result = await pool.query(tasksQuery, queryParams);
      return {
        tasks: result.rows,
        total,
        page,
        limit
      };
    } catch (error) {
      console.error('Error in getAllTasks:', error);
      throw new Error('Failed to fetch tasks');
    }
  }

  static async getTaskById(id: string): Promise<Task | null> {
    const client = await pool.connect();
    
    try {
      const query = `
        ${TaskService.TASK_SELECT_QUERY}
        AND t.id = $1
      `;
      
      const result = await client.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new DatabaseError('Failed to fetch task', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  static async createTask(taskData: CreateTaskRequest): Promise<Task> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert task
      const taskResult = await client.query(
        `INSERT INTO tasks (
          title, description, status, priority, deadline,
          progress_percentage, project_id, recurring_pattern,
          assigner_id, assigned_user_id, suggested_priority,
          suggested_deadline
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          taskData.title,
          taskData.description || null,
          taskData.status || 'Pending Approval',
          taskData.priority || 'Medium',
          taskData.deadline || null,
          taskData.progressPercentage || 0,
          taskData.projectId || null,
          taskData.recurringPattern || null,
          taskData.assignerId,
          taskData.assignedUserId || null,
          taskData.suggestedPriority || null,
          taskData.suggestedDeadline || null
        ]
      );

      const task = taskResult.rows[0];

      // Insert attachments if any
      if (taskData.attachments && taskData.attachments.length > 0) {
        const attachmentValues = taskData.attachments.map(attachment => 
          `($1, $2, $3, $4, $5, $6, $7)`
        ).join(',');
        
        const attachmentParams = taskData.attachments.flatMap(attachment => [
          task.id,
          taskData.assignerId, // Using assigner as the user who uploaded
          attachment.fileName,
          attachment.fileUrl,
          attachment.fileType || null,
          attachment.fileSizeBytes,
          attachment.checksum
        ]);

        await client.query(
          `INSERT INTO task_attachments (
            task_id, user_id, file_name, file_url, file_type, file_size_bytes, checksum
          ) VALUES ${attachmentValues}`,
          attachmentParams
        );
      }

      await client.query('COMMIT');

      // Fetch the complete task with joins
      const completeTaskResult = await client.query(
        `SELECT 
          t.*,
          u1.first_name as assignee_first_name,
          u1.last_name as assignee_last_name,
          u2.first_name as assigner_first_name,
          u2.last_name as assigner_last_name,
          p.name as project_name
        FROM tasks t
        LEFT JOIN users u1 ON t.assigned_user_id = u1.id
        LEFT JOIN users u2 ON t.assigner_id = u2.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.id = $1`,
        [task.id]
      );

      return this.mapTaskFromDb(completeTaskResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateTask(id: string, taskData: UpdateTaskRequest): Promise<Task | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const existsResult = await client.query('SELECT id FROM tasks WHERE id = $1', [id]);
      if (existsResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;
      
      /**
       * FIXED: Removed mappings for non-existent columns (`assigneeName`, `assignerName`, `timerDuration`).
       */
      const fieldMappings: Record<string, string> = {
        title: 'title',
        description: 'description',
        status: 'status',
        deadline: 'deadline',
        priority: 'priority',
        assignedUserId: 'assigned_user_id',
        assignerId: 'assigner_id',
        suggestedDeadline: 'suggested_deadline',
        suggestedPriority: 'suggested_priority'
      };

      Object.entries(taskData).forEach(([key, value]) => {
        if (key in fieldMappings && value !== undefined) {
          updateFields.push(`${fieldMappings[key]} = $${paramIndex++}`);
          updateValues.push(value);
        }
      });

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        const updateQuery = `
          UPDATE tasks SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `;
        updateValues.push(id);
        await client.query(updateQuery, updateValues);
      }

      if (taskData.attachments) {
        // Delete existing attachments
        await client.query('DELETE FROM task_attachments WHERE task_id = $1', [id]);
        
        // Insert new attachments
        for (const attachment of taskData.attachments) {
          const result = await client.query(
            'INSERT INTO task_attachments (task_id, user_id, file_name, file_url, file_type, file_size_bytes, checksum) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [
              id,
              attachment.userId,
              attachment.fileName,
              attachment.fileUrl,
              attachment.fileType,
              attachment.fileSizeBytes,
              attachment.checksum
            ]
          );
        }
      }

      if (taskData.comments) {
        // Delete existing comments
        await client.query('DELETE FROM task_comments WHERE task_id = $1', [id]);
        
        // Insert new comments
        for (const comment of taskData.comments) {
          await client.query(
            'INSERT INTO task_comments (task_id, user_id, content, mentions) VALUES ($1, $2, $3, $4)',
            [id, comment.userId, comment.content, comment.mentions]
          );
        }
      }

      await client.query('COMMIT');

      return await this.getTaskById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to update task', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  static async deleteTask(id: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const result = await client.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
      return result.rows.length > 0;
    } catch (error) {
      throw new DatabaseError('Failed to delete task', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  private static async insertAttachments(client: PoolClient, taskId: string, attachments: Omit<TaskAttachment, 'id' | 'createdAt'>[]): Promise<void> {
    /**
     * FIXED: Corrected column names to match the schema (`file_url`, `file_size_bytes`).
     */
    const attachmentQuery = `
      INSERT INTO task_attachments (task_id, user_id, file_name, file_url, file_type, file_size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const attachment of attachments) {
      await client.query(attachmentQuery, [
        taskId,
        attachment.userId,
        attachment.fileName,
        attachment.fileUrl,
        attachment.fileType,
        attachment.fileSizeBytes
      ]);
    }
  }

  private static async insertComments(client: PoolClient, taskId: string, comments: Omit<TaskComment, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    /**
     * FIXED: Removed `user_name` from the INSERT as it's not a real column.
     * The name is derived via a JOIN in the SELECT query.
     */
    const commentQuery = `
      INSERT INTO task_comments (task_id, user_id, content)
      VALUES ($1, $2, $3)
    `;

    for (const comment of comments) {
      await client.query(commentQuery, [
        taskId,
        comment.userId,
        comment.content
      ]);
    }
  }

  static async getTasksByUserId(userId: string, isAssigned: boolean = true): Promise<Task[]> {
    const client = await pool.connect();
    
    try {
      const field = isAssigned ? 'assigned_user_id' : 'assigner_id';
      const query = `
        ${TaskService.TASK_SELECT_QUERY}
        WHERE t.${field} = $1
        GROUP BY t.id, assignee.first_name, assignee.last_name, assigner.first_name, assigner.last_name
        ORDER BY t.created_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw new DatabaseError('Failed to fetch user tasks', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  static async getTaskStatistics(): Promise<Record<string, number>> {
    const client = await pool.connect();
    
    try {
      /**
       * FIXED: The query now reflects the actual status values in the schema.
       * Removed 'Cancelled' which does not exist and updated the `overdue` check.
       */
      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo,
          COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'In Review' THEN 1 END) as in_review,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'Archived' THEN 1 END) as archived,
          COUNT(CASE WHEN deadline < CURRENT_TIMESTAMP AND status NOT IN ('Completed', 'Rejected', 'Archived') THEN 1 END) as overdue
        FROM tasks
      `;
      
      const result = await client.query(query);
      return result.rows[0];
    } catch (error) {
      throw new DatabaseError('Failed to fetch task statistics', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  private static mapTaskFromDb(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      deadline: row.deadline,
      progressPercentage: row.progress_percentage,
      projectId: row.project_id,
      recurringPattern: row.recurring_pattern,
      assignerId: row.assigner_id,
      assignedUserId: row.assigned_user_id,
      updatedBy: row.updated_by,
      suggestedPriority: row.suggested_priority,
      suggestedDeadline: row.suggested_deadline,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      softDeletedAt: row.soft_deleted_at,
      assigneeName: row.assignee_first_name && row.assignee_last_name 
        ? `${row.assignee_first_name} ${row.assignee_last_name}`
        : undefined,
      assignerName: row.assigner_first_name && row.assigner_last_name
        ? `${row.assigner_first_name} ${row.assigner_last_name}`
        : undefined,
      projectName: row.project_name
    };
  }
}