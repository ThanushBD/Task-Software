// routes/tasks.ts
import express, { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/taskService';
import { validateCreateTask, validateUpdateTask, validatePagination } from '../middleware/validation';
import { ValidationError } from '../utils/errors';
import { CreateTaskRequest, UpdateTaskRequest, PaginationParams, ApiResponse, Task, TaskStatus, TaskPriority } from '../types/task';

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
  } else {
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
};

// Get all tasks with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    // TEMP: Use a minimal query to diagnose DB timeout
    const result = await require('../config/db').pool.query('SELECT id, title FROM tasks LIMIT 5');
    res.json({ success: true, data: { tasks: result.rows, pagination: {} } });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
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

    const response: ApiResponse<Task> = {
      success: true,
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
    
    const response: ApiResponse<Task> = {
      success: true,
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
    const taskData: UpdateTaskRequest = req.body;
    
    const task = await TaskService.updateTask(id, taskData);
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found'
      });
    }

    const response: ApiResponse<Task> = {
      success: true,
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

    const response: ApiResponse<void> = {
      success: true,
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