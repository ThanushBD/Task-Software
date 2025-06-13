// routes/tasks.ts
import express, { Request, Response, NextFunction } from 'express';
import { TaskService, DatabaseError } from '../services/taskService';
import { validateCreateTask, validateUpdateTask, validatePagination, ValidationError } from '../middleware/validation';
import { CreateTaskRequest, UpdateTaskRequest, PaginationParams, ApiResponse } from '../types/task';

const router = express.Router();

// Error handler middleware for this router
const handleError = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, error);

  if (error instanceof ValidationError) {
    res.status(400).json({
      error: 'Validation failed',
      message: error.message,
      field: error.field
    });
  } else if (error instanceof DatabaseError) {
    res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};

// Get all tasks with pagination and filtering
router.get('/', validatePagination, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params: PaginationParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: req.query.sortBy as string || 'created_at',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      status: req.query.status as any,
      priority: req.query.priority as any,
      assignedUserId: req.query.assignedUserId as string,
      assignerId: req.query.assignerId as string
    };

    const result = await TaskService.getAllTasks(params);
    
    const response: ApiResponse = {
      data: {
        tasks: result.tasks,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          hasNext: result.page * result.limit < result.total,
          hasPrev: result.page > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get a specific task by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({
        error: 'Invalid task ID format'
      });
    }

    const task = await TaskService.getTaskById(id);
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    const response: ApiResponse = {
      data: task
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Create a new task
router.post('/', validateCreateTask, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskData: CreateTaskRequest = req.body;
    const task = await TaskService.createTask(taskData);
    
    const response: ApiResponse = {
      data: task,
      message: 'Task created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// Update a task
router.put('/:id', validateUpdateTask, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const taskData: UpdateTaskRequest = { ...req.body, id };
    
    const task = await TaskService.updateTask(id, taskData);
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    const response: ApiResponse = {
      data: task,
      message: 'Task updated successfully'
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Delete a task
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({
        error: 'Invalid task ID format'
      });
    }

    const success = await TaskService.deleteTask(id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    const response: ApiResponse = {
      message: 'Task deleted successfully'
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Apply error handler middleware
router.use(handleError);

export default router;