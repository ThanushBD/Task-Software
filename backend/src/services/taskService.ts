// services/taskService.ts
import pool from '../config/db';
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
    SELECT 
      t.id,
      t.title,
      t.description,
      t.status,
      t.deadline,
      t.priority,
      t.assigned_user_id as "assignedUserId",
      t.assignee_name as "assigneeName",
      t.assigner_id as "assignerId",
      t.assigner_name as "assignerName",
      t.timer_duration as "timerDuration",
      t.suggested_deadline as "suggestedDeadline",
      t.suggested_priority as "suggestedPriority",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt",
      COALESCE(
        json_agg(
          CASE WHEN ta.id IS NOT NULL THEN
            json_build_object(
              'id', ta.id,
              'fileName', ta.file_name,
              'fileType', ta.file_type,
              'fileSize', ta.file_size,
              'filePath', ta.file_path,
              'createdAt', ta.created_at
            )
          END
        ) FILTER (WHERE ta.id IS NOT NULL),
        '[]'
      ) as attachments,
      COALESCE(
        json_agg(
          CASE WHEN tc.id IS NOT NULL THEN
            json_build_object(
              'id', tc.id,
              'userId', tc.user_id,
              'userName', tc.user_name,
              'content', tc.content,
              'createdAt', tc.created_at,
              'updatedAt', tc.updated_at
            )
          END
        ) FILTER (WHERE tc.id IS NOT NULL),
        '[]'
      ) as comments
    FROM tasks t
    LEFT JOIN task_attachments ta ON t.id = ta.task_id
    LEFT JOIN task_comments tc ON t.id = tc.task_id
  `;

  static async getAllTasks(params: PaginationParams = {}): Promise<{ tasks: Task[], total: number, page: number, limit: number }> {
    const client = await pool.connect();
    
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        status,
        priority,
        assignedUserId,
        assignerId
      } = params;

      const offset = (page - 1) * limit;
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (status) {
        whereConditions.push(`t.status = $${paramIndex++}`);
        queryParams.push(status);
      }
      if (priority) {
        whereConditions.push(`t.priority = $${paramIndex++}`);
        queryParams.push(priority);
      }
      if (assignedUserId) {
        whereConditions.push(`t.assigned_user_id = $${paramIndex++}`);
        queryParams.push(assignedUserId);
      }
      if (assignerId) {
        whereConditions.push(`t.assigner_id = $${paramIndex++}`);
        queryParams.push(assignerId);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT t.id) as total
        FROM tasks t
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const tasksQuery = `
        ${this.TASK_SELECT_QUERY}
        ${whereClause}
        GROUP BY t.id
        ORDER BY t.${sortBy} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      
      queryParams.push(limit, offset);
      const tasksResult = await client.query(tasksQuery, queryParams);

      return {
        tasks: tasksResult.rows,
        total,
        page,
        limit
      };
    } catch (error) {
      throw new DatabaseError('Failed to fetch tasks', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  static async getTaskById(id: string): Promise<Task | null> {
    const client = await pool.connect();
    
    try {
      const query = `
        ${this.TASK_SELECT_QUERY}
        WHERE t.id = $1
        GROUP BY t.id
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
      const taskInsertQuery = `
        INSERT INTO tasks (
          title, description, status, deadline, priority,
          assigned_user_id, assignee_name, assigner_id, assigner_name,
          timer_duration, suggested_deadline, suggested_priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        RETURNING id
      `;

      const taskValues = [
        taskData.title,
        taskData.description || null,
        taskData.status || 'To Do',
        taskData.deadline,
        taskData.priority || 'Medium',
        taskData.assignedUserId || null,
        taskData.assigneeName || null,
        taskData.assignerId,
        taskData.assignerName,
        taskData.timerDuration || 0,
        taskData.suggestedDeadline || null,
        taskData.suggestedPriority || null
      ];

      const taskResult = await client.query(taskInsertQuery, taskValues);
      const taskId = taskResult.rows[0].id;

      // Insert attachments if any
      if (taskData.attachments && taskData.attachments.length > 0) {
        await this.insertAttachments(client, taskId, taskData.attachments);
      }

      // Insert comments if any
      if (taskData.comments && taskData.comments.length > 0) {
        await this.insertComments(client, taskId, taskData.comments);
      }

      await client.query('COMMIT');

      // Fetch and return the complete task
      const createdTask = await this.getTaskById(taskId);
      if (!createdTask) {
        throw new DatabaseError('Failed to retrieve created task');
      }

      return createdTask;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create task', error instanceof Error ? error : undefined);
    } finally {
      client.release();
    }
  }

  static async updateTask(id: string, taskData: UpdateTaskRequest): Promise<Task | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if task exists
      const existsResult = await client.query('SELECT id FROM tasks WHERE id = $1', [id]);
      if (existsResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      const fieldMappings: Record<string, string> = {
        title: 'title',
        description: 'description',
        status: 'status',
        deadline: 'deadline',
        priority: 'priority',
        assignedUserId: 'assigned_user_id',
        assigneeName: 'assignee_name',
        assignerId: 'assigner_id',
        assignerName: 'assigner_name',
        timerDuration: 'timer_duration',
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

      // Update attachments if provided
      if (taskData.attachments !== undefined) {
        await client.query('DELETE FROM task_attachments WHERE task_id = $1', [id]);
        if (taskData.attachments.length > 0) {
          await this.insertAttachments(client, id, taskData.attachments);
        }
      }

      // Update comments if provided
      if (taskData.comments !== undefined) {
        await client.query('DELETE FROM task_comments WHERE task_id = $1', [id]);
        if (taskData.comments.length > 0) {
          await this.insertComments(client, id, taskData.comments);
        }
      }

      await client.query('COMMIT');

      // Fetch and return the updated task
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
    const attachmentQuery = `
      INSERT INTO task_attachments (task_id, file_name, file_type, file_size, file_path)
      VALUES ($1, $2, $3, $4, $5)
    `;

    for (const attachment of attachments) {
      await client.query(attachmentQuery, [
        taskId,
        attachment.fileName,
        attachment.fileType,
        attachment.fileSize,
        attachment.filePath || null
      ]);
    }
  }

  private static async insertComments(client: PoolClient, taskId: string, comments: Omit<TaskComment, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const commentQuery = `
      INSERT INTO task_comments (task_id, user_id, user_name, content)
      VALUES ($1, $2, $3, $4)
    `;

    for (const comment of comments) {
      await client.query(commentQuery, [
        taskId,
        comment.userId,
        comment.userName,
        comment.content
      ]);
    }
  }

  static async getTasksByUserId(userId: string, isAssigned: boolean = true): Promise<Task[]> {
    const client = await pool.connect();
    
    try {
      const field = isAssigned ? 'assigned_user_id' : 'assigner_id';
      const query = `
        ${this.TASK_SELECT_QUERY}
        WHERE t.${field} = $1
        GROUP BY t.id
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
      const query = `
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'To Do' THEN 1 END) as todo,
          COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'In Review' THEN 1 END) as in_review,
          COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled,
          COUNT(CASE WHEN deadline < CURRENT_TIMESTAMP AND status NOT IN ('Completed', 'Cancelled') THEN 1 END) as overdue
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
}