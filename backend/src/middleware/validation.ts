// middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { CreateTaskRequest, UpdateTaskRequest, TaskStatus, TaskPriority } from '../types/task';
import { ValidationError } from '../utils/errors';

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Remove invalid status and priority values
const VALID_TASK_STATUSES = ['Pending Approval', 'To Do', 'In Progress', 'In Review', 'Needs Changes', 'Completed', 'Rejected', 'Archived'];
const VALID_TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export const validateCreateTask = (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskData: CreateTaskRequest = req.body;

    // Validate required fields
    if (!taskData.title || typeof taskData.title !== 'string' || taskData.title.trim().length === 0) {
      throw new ValidationError('Title is required and must be a non-empty string', 'title');
    }

    if (!taskData.assignerId || typeof taskData.assignerId !== 'number') {
      throw new ValidationError('Assigner ID is required and must be a number', 'assignerId');
    }

    // Validate optional fields
    if (taskData.description !== undefined && typeof taskData.description !== 'string') {
      throw new ValidationError('Description must be a string', 'description');
    }

    if (taskData.status !== undefined && !VALID_TASK_STATUSES.includes(taskData.status)) {
      throw new ValidationError('Invalid status value', 'status');
    }

    if (taskData.priority !== undefined && !VALID_TASK_PRIORITIES.includes(taskData.priority)) {
      throw new ValidationError('Invalid priority value', 'priority');
    }

    if (taskData.deadline !== undefined) {
      const date = new Date(taskData.deadline);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Deadline must be a valid date', 'deadline');
      }
      // Convert to Date object for consistency
      taskData.deadline = date;
    }

    if (taskData.progressPercentage !== undefined && (typeof taskData.progressPercentage !== 'number' || taskData.progressPercentage < 0 || taskData.progressPercentage > 100)) {
      throw new ValidationError('Progress percentage must be a number between 0 and 100', 'progressPercentage');
    }

    if (taskData.projectId !== undefined && taskData.projectId !== null && typeof taskData.projectId !== 'number') {
      throw new ValidationError('Project ID must be a number or null', 'projectId');
    }

    if (taskData.assignedUserId !== undefined && typeof taskData.assignedUserId !== 'number') {
      throw new ValidationError('Assigned user ID must be a number', 'assignedUserId');
    }

    if (taskData.suggestedPriority !== undefined && taskData.suggestedPriority !== null && !VALID_TASK_PRIORITIES.includes(taskData.suggestedPriority)) {
      throw new ValidationError('Invalid suggested priority value', 'suggestedPriority');
    }

    if (taskData.suggestedDeadline !== undefined) {
      const date = new Date(taskData.suggestedDeadline);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Suggested deadline must be a valid date', 'suggestedDeadline');
      }
      // Convert to Date object for consistency
      taskData.suggestedDeadline = date;
    }

    // Validate attachments if present
    if (taskData.attachments) {
      if (!Array.isArray(taskData.attachments)) {
        throw new ValidationError('Attachments must be an array', 'attachments');
      }

      for (let i = 0; i < taskData.attachments.length; i++) {
        const attachment = taskData.attachments[i];
        
        if (!attachment.fileName || typeof attachment.fileName !== 'string') {
          throw new ValidationError(`Attachment ${i + 1}: fileName is required and must be a string`, 'attachments');
        }

        if (!attachment.fileUrl || typeof attachment.fileUrl !== 'string') {
          throw new ValidationError(`Attachment ${i + 1}: fileUrl is required and must be a string`, 'attachments');
        }

        if (attachment.fileType && !ALLOWED_FILE_TYPES.includes(attachment.fileType)) {
          throw new ValidationError(`Attachment ${i + 1}: fileType not allowed`, 'attachments');
        }

        if (typeof attachment.fileSizeBytes !== 'number' || attachment.fileSizeBytes <= 0 || attachment.fileSizeBytes > MAX_FILE_SIZE) {
          throw new ValidationError(`Attachment ${i + 1}: fileSizeBytes must be between 1 and ${MAX_FILE_SIZE} bytes`, 'attachments');
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const validateUpdateTask = (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskData: UpdateTaskRequest = req.body;

    // Validate optional fields
    if (taskData.title !== undefined && (typeof taskData.title !== 'string' || taskData.title.trim().length === 0)) {
      throw new ValidationError('Title must be a non-empty string', 'title');
    }

    if (taskData.description !== undefined && typeof taskData.description !== 'string') {
      throw new ValidationError('Description must be a string', 'description');
    }

    if (taskData.status !== undefined && !VALID_TASK_STATUSES.includes(taskData.status)) {
      throw new ValidationError('Invalid status value', 'status');
    }

    if (taskData.priority !== undefined && !VALID_TASK_PRIORITIES.includes(taskData.priority)) {
      throw new ValidationError('Invalid priority value', 'priority');
    }

    if (taskData.deadline !== undefined) {
      const date = new Date(taskData.deadline);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Deadline must be a valid date', 'deadline');
      }
      // Convert to Date object for consistency
      taskData.deadline = date;
    }

    if (taskData.progressPercentage !== undefined && (typeof taskData.progressPercentage !== 'number' || taskData.progressPercentage < 0 || taskData.progressPercentage > 100)) {
      throw new ValidationError('Progress percentage must be a number between 0 and 100', 'progressPercentage');
    }

    if (taskData.projectId !== undefined && taskData.projectId !== null && typeof taskData.projectId !== 'number') {
      throw new ValidationError('Project ID must be a number or null', 'projectId');
    }

    if (taskData.assignedUserId !== undefined && typeof taskData.assignedUserId !== 'number') {
      throw new ValidationError('Assigned user ID must be a number', 'assignedUserId');
    }

    if (taskData.suggestedPriority !== undefined && taskData.suggestedPriority !== null && !VALID_TASK_PRIORITIES.includes(taskData.suggestedPriority)) {
      throw new ValidationError('Invalid suggested priority value', 'suggestedPriority');
    }

    if (taskData.suggestedDeadline !== undefined) {
      const date = new Date(taskData.suggestedDeadline);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Suggested deadline must be a valid date', 'suggestedDeadline');
      }
      // Convert to Date object for consistency
      taskData.suggestedDeadline = date;
    }

    // Validate attachments if present
    if (taskData.attachments) {
      if (!Array.isArray(taskData.attachments)) {
        throw new ValidationError('Attachments must be an array', 'attachments');
      }

      for (let i = 0; i < taskData.attachments.length; i++) {
        const attachment = taskData.attachments[i];
        
        if (!attachment.fileName || typeof attachment.fileName !== 'string') {
          throw new ValidationError(`Attachment ${i + 1}: fileName is required and must be a string`, 'attachments');
        }

        if (!attachment.fileUrl || typeof attachment.fileUrl !== 'string') {
          throw new ValidationError(`Attachment ${i + 1}: fileUrl is required and must be a string`, 'attachments');
        }

        if (attachment.fileType && !ALLOWED_FILE_TYPES.includes(attachment.fileType)) {
          throw new ValidationError(`Attachment ${i + 1}: fileType not allowed`, 'attachments');
        }

        if (typeof attachment.fileSizeBytes !== 'number' || attachment.fileSizeBytes <= 0 || attachment.fileSizeBytes > MAX_FILE_SIZE) {
          throw new ValidationError(`Attachment ${i + 1}: fileSizeBytes must be between 1 and ${MAX_FILE_SIZE} bytes`, 'attachments');
        }
      }
    }

    // Validate comments if present
    if (taskData.comments) {
      if (!Array.isArray(taskData.comments)) {
        throw new ValidationError('Comments must be an array', 'comments');
      }

      for (let i = 0; i < taskData.comments.length; i++) {
        const comment = taskData.comments[i];
        
        if (!comment.content || typeof comment.content !== 'string') {
          throw new ValidationError(`Comment ${i + 1}: content is required and must be a string`, 'comments');
        }

        if (!comment.userId || typeof comment.userId !== 'number') {
          throw new ValidationError(`Comment ${i + 1}: userId is required and must be a number`, 'comments');
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, status, priority, assigneeId, projectId, sortBy, sortOrder } = req.query;

    if (page !== undefined && (isNaN(Number(page)) || Number(page) < 1)) {
      throw new ValidationError('Page must be a positive number', 'page');
    }

    if (limit !== undefined && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
      throw new ValidationError('Limit must be a number between 1 and 100', 'limit');
    }

    if (status !== undefined && !VALID_TASK_STATUSES.includes(status as string)) {
      throw new ValidationError('Invalid status value', 'status');
    }

    if (priority !== undefined && !VALID_TASK_PRIORITIES.includes(priority as string)) {
      throw new ValidationError('Invalid priority value', 'priority');
    }

    if (assigneeId !== undefined && isNaN(Number(assigneeId))) {
      throw new ValidationError('Assignee ID must be a number', 'assigneeId');
    }

    if (projectId !== undefined && isNaN(Number(projectId))) {
      throw new ValidationError('Project ID must be a number', 'projectId');
    }

    if (sortBy !== undefined && typeof sortBy !== 'string') {
      throw new ValidationError('Sort by must be a string', 'sortBy');
    }

    if (sortOrder !== undefined && !['asc', 'desc'].includes(sortOrder as string)) {
      throw new ValidationError('Sort order must be either "asc" or "desc"', 'sortOrder');
    }

    next();
  } catch (error) {
    next(error);
  }
};