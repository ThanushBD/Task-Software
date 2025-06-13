// middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { TaskStatus, TaskPriority, CreateTaskRequest, UpdateTaskRequest } from '../types/task';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'In Review', 'Completed', 'Cancelled'];
const VALID_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getTime() > Date.now();
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

export const validateCreateTask = (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateTaskRequest = req.body;

    // Required fields validation
    if (!body.title || typeof body.title !== 'string') {
      throw new ValidationError('Title is required and must be a string', 'title');
    }
    if (body.title.trim().length === 0) {
      throw new ValidationError('Title cannot be empty', 'title');
    }
    if (body.title.length > 255) {
      throw new ValidationError('Title must be less than 255 characters', 'title');
    }

    if (!body.deadline || typeof body.deadline !== 'string') {
      throw new ValidationError('Deadline is required and must be a valid ISO date string', 'deadline');
    }
    if (!isValidDate(body.deadline)) {
      throw new ValidationError('Deadline must be a future date', 'deadline');
    }

    if (!body.assignerId || typeof body.assignerId !== 'string') {
      throw new ValidationError('Assigner ID is required', 'assignerId');
    }
    if (!body.assignerName || typeof body.assignerName !== 'string') {
      throw new ValidationError('Assigner name is required', 'assignerName');
    }

    // Optional fields validation
    if (body.description && typeof body.description !== 'string') {
      throw new ValidationError('Description must be a string', 'description');
    }

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      throw new ValidationError(`Status must be one of: ${VALID_STATUSES.join(', ')}`, 'status');
    }

    if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
      throw new ValidationError(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`, 'priority');
    }

    if (body.timerDuration && (typeof body.timerDuration !== 'number' || body.timerDuration < 0)) {
      throw new ValidationError('Timer duration must be a non-negative number', 'timerDuration');
    }

    if (body.suggestedDeadline && !isValidDate(body.suggestedDeadline)) {
      throw new ValidationError('Suggested deadline must be a future date', 'suggestedDeadline');
    }

    if (body.suggestedPriority && !VALID_PRIORITIES.includes(body.suggestedPriority)) {
      throw new ValidationError(`Suggested priority must be one of: ${VALID_PRIORITIES.join(', ')}`, 'suggestedPriority');
    }

    // Validate attachments
    if (body.attachments) {
      if (!Array.isArray(body.attachments)) {
        throw new ValidationError('Attachments must be an array', 'attachments');
      }
      
      for (let i = 0; i < body.attachments.length; i++) {
        const attachment = body.attachments[i];
        if (!attachment.fileName || typeof attachment.fileName !== 'string') {
          throw new ValidationError(`Attachment ${i + 1}: fileName is required`, 'attachments');
        }
        if (!attachment.fileType || typeof attachment.fileType !== 'string') {
          throw new ValidationError(`Attachment ${i + 1}: fileType is required`, 'attachments');
        }
        if (!ALLOWED_FILE_TYPES.includes(attachment.fileType)) {
          throw new ValidationError(`Attachment ${i + 1}: fileType not allowed`, 'attachments');
        }
        if (typeof attachment.fileSize !== 'number' || attachment.fileSize <= 0 || attachment.fileSize > MAX_FILE_SIZE) {
          throw new ValidationError(`Attachment ${i + 1}: fileSize must be between 1 and ${MAX_FILE_SIZE} bytes`, 'attachments');
        }
      }
    }

    // Validate comments
    if (body.comments) {
      if (!Array.isArray(body.comments)) {
        throw new ValidationError('Comments must be an array', 'comments');
      }
      
      for (let i = 0; i < body.comments.length; i++) {
        const comment = body.comments[i];
        if (!comment.userId || typeof comment.userId !== 'string') {
          throw new ValidationError(`Comment ${i + 1}: userId is required`, 'comments');
        }
        if (!comment.userName || typeof comment.userName !== 'string') {
          throw new ValidationError(`Comment ${i + 1}: userName is required`, 'comments');
        }
        if (!comment.content || typeof comment.content !== 'string' || comment.content.trim().length === 0) {
          throw new ValidationError(`Comment ${i + 1}: content is required and cannot be empty`, 'comments');
        }
      }
    }

    // Sanitize string fields
    req.body.title = sanitizeString(body.title);
    if (body.description) req.body.description = sanitizeString(body.description);
    req.body.assignerId = sanitizeString(body.assignerId);
    req.body.assignerName = sanitizeString(body.assignerName);
    if (body.assignedUserId) req.body.assignedUserId = sanitizeString(body.assignedUserId);
    if (body.assigneeName) req.body.assigneeName = sanitizeString(body.assigneeName);

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.message,
        field: error.field
      });
    } else {
      next(error);
    }
  }
};

export const validateUpdateTask = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id || !isValidUUID(id)) {
      throw new ValidationError('Valid task ID is required', 'id');
    }

    const body: UpdateTaskRequest = req.body;

    // Validate only provided fields
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        throw new ValidationError('Title must be a non-empty string', 'title');
      }
      if (body.title.length > 255) {
        throw new ValidationError('Title must be less than 255 characters', 'title');
      }
      req.body.title = sanitizeString(body.title);
    }

    if (body.deadline !== undefined) {
      if (!isValidDate(body.deadline)) {
        throw new ValidationError('Deadline must be a future date', 'deadline');
      }
    }

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      throw new ValidationError(`Status must be one of: ${VALID_STATUSES.join(', ')}`, 'status');
    }

    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      throw new ValidationError(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}`, 'priority');
    }

    // Similar validation for other optional fields...
    if (body.description !== undefined && typeof body.description === 'string') {
      req.body.description = sanitizeString(body.description);
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.message,
        field: error.field
      });
    } else {
      next(error);
    }
  }
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, sortBy, sortOrder } = req.query;

    if (page !== undefined) {
      const pageNum = parseInt(page as string);
      if (isNaN(pageNum) || pageNum < 1) {
        throw new ValidationError('Page must be a positive integer', 'page');
      }
      req.query.page = pageNum.toString();
    }

    if (limit !== undefined) {
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ValidationError('Limit must be between 1 and 100', 'limit');
      }
      req.query.limit = limitNum.toString();
    }

    const allowedSortFields = ['created_at', 'updated_at', 'deadline', 'priority', 'status', 'title'];
    if (sortBy !== undefined && !allowedSortFields.includes(sortBy as string)) {
      throw new ValidationError(`sortBy must be one of: ${allowedSortFields.join(', ')}`, 'sortBy');
    }

    if (sortOrder !== undefined && !['asc', 'desc'].includes(sortOrder as string)) {
      throw new ValidationError('sortOrder must be either "asc" or "desc"', 'sortOrder');
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        message: error.message,
        field: error.field
      });
    } else {
      next(error);
    }
  }
};