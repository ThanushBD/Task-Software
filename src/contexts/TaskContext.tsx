"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { fetchTasks, createTask, updateTask, deleteTask } from '@/lib/api';
import type { Task, TaskStatus, TaskPriority } from '@/types';

// Enhanced pagination interface
interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Task filters interface
interface TaskFilters {
  page?: number;
  limit?: number;
  sortBy?: 'status' | 'priority' | 'deadline' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assigneeId?: number;
  assignerId?: number;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  overdue?: boolean;
}

// Task statistics interface
interface TaskStatistics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  completed: number;
  averageCompletionTime?: number;
}

// Cache interface for performance optimization
interface TaskCache {
  data: Task[];
  timestamp: Date;
  filters: TaskFilters;
}

// FIXED: API search parameters interface with proper types
export interface TaskSearchParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string; // API expects string, not TaskStatus | TaskStatus[]
  priority?: string;
  assigneeId?: number;
  assignerId?: number;
  signal?: AbortSignal;
  overdue?: boolean;
}

// Enhanced task context type
export interface TaskContextType {
  // Core state
  tasks: Task[];
  isLoadingTasks: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  
  // Statistics
  statistics: TaskStatistics;
  
  // CRUD operations
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskStatus: (taskId: number, newStatus: TaskStatus) => Promise<void>;
  
  // Bulk operations
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => Promise<void>;
  bulkDeleteTasks: (taskIds: string[]) => Promise<void>;
  
  // Filtering and search
  refreshTasks: (filters?: TaskFilters) => Promise<void>;
  setFilters: (filters: TaskFilters) => void;
  clearFilters: () => void;
  currentFilters: TaskFilters;
  
  // Utility methods
  getTaskById: (id: string) => Task | undefined;
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTasksByAssignee: (assigneeId: number) => Task[];
  getOverdueTasks: () => Task[];
  
  // Cache management
  clearCache: () => void;
  invalidateCache: () => void;
  
  // Error handling
  clearError: () => void;
  retryLastOperation: () => Promise<void>;
}

// FIXED: Helper function to convert TaskStatus types to API string format
export const convertTaskStatusToString = (status: TaskStatus | TaskStatus[] | undefined): string | undefined => {
  if (!status) return undefined;
  if (Array.isArray(status)) {
    return status.join(',');
  }
  return status;
};

// FIXED: Helper function to convert filters to API parameters
const convertFiltersToApiParams = (filters: TaskFilters): TaskSearchParams => {
  return {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    status: convertTaskStatusToString(filters.status), // Convert TaskStatus to string
    priority: Array.isArray(filters.priority) 
      ? filters.priority.join(',') 
      : filters.priority,
    assigneeId: filters.assigneeId,
    assignerId: filters.assignerId,
    overdue: filters.overdue,
  };
};

// Default task statistics
const defaultStatistics: TaskStatistics = {
  total: 0,
  byStatus: {
    'To Do': 0,
    'In Progress': 0,
    'Completed': 0,
    'Overdue': 0,
    'Pending Approval': 0,
    'Needs Changes': 0,
    'Rejected': 0,
  },
  byPriority: {
    'Low': 0,
    'Medium': 0,
    'High': 0,
  },
  overdue: 0,
  dueToday: 0,
  dueTomorrow: 0,
  dueThisWeek: 0,
  completed: 0,
};

// Cache timeout (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  // Core state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<TaskFilters>({});
  
  // Cache and performance optimization
  const cacheRef = useRef<TaskCache | null>(null);
  const lastOperationRef = useRef<(() => Promise<void>) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate statistics from current tasks
  const statistics = useMemo(() => {
    const stats: TaskStatistics = {
      total: tasks.length,
      byStatus: { ...defaultStatistics.byStatus },
      byPriority: { ...defaultStatistics.byPriority },
      overdue: 0,
      dueToday: 0,
      dueTomorrow: 0,
      dueThisWeek: 0,
      completed: 0,
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    tasks.forEach(task => {
      // Count by status
      if (task.status) {
        stats.byStatus[task.status]++;
      }
      
      // Count by priority
      if (task.priority) {
        stats.byPriority[task.priority]++;
      }
      
      // Count completed tasks
      if (task.status === 'Completed') {
        stats.completed++;
      }
      
      // Count deadline-based statistics
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        
        if (task.status === 'Overdue' || (deadline < now && task.status !== 'Completed')) {
          stats.overdue++;
        }
        
        if (deadline >= today && deadline < tomorrow) {
          stats.dueToday++;
        }
        
        if (deadline >= tomorrow && deadline < nextWeek) {
          stats.dueTomorrow++;
        }
        
        if (deadline >= today && deadline < nextWeek) {
          stats.dueThisWeek++;
        }
      }
    });

    return stats;
  }, [tasks]);

  // Check if cache is valid
  const isCacheValid = useCallback((filters: TaskFilters): boolean => {
    if (!cacheRef.current) return false;
    
    const cacheAge = Date.now() - cacheRef.current.timestamp.getTime();
    if (cacheAge > CACHE_TIMEOUT) return false;
    
    // Check if filters match
    return JSON.stringify(cacheRef.current.filters) === JSON.stringify(filters);
  }, []);

  // Load tasks with caching and filtering
  const loadTasks = useCallback(async (filters: TaskFilters = {}): Promise<void> => {
    // Check cache first
    if (isCacheValid(filters)) {
      setTasks(cacheRef.current!.data);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsLoadingTasks(true);
    setError(null);
    
    try {
      // FIXED: Convert filters to API parameters
      const apiParams: TaskSearchParams = {
        ...convertFiltersToApiParams(filters),
        signal: abortControllerRef.current.signal,
      };
      
      const response = await fetchTasks(apiParams);
      
      setTasks(response.tasks);
      setPagination(response.pagination);
      setCurrentFilters(filters);
      
      // Update cache
      cacheRef.current = {
        data: response.tasks,
        timestamp: new Date(),
        filters: { ...filters },
      };
      
      setError(null);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errorMessage = err.message || 'Failed to load tasks';
        setError(errorMessage);
        console.error('Error loading tasks:', err);
      }
    } finally {
      setIsLoadingTasks(false);
      abortControllerRef.current = null;
    }
  }, [isCacheValid]);

  // Initial load
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // CRUD Operations
  const addTask = useCallback(async (newTask: Omit<Task, 'id'>): Promise<void> => {
    const operation = async () => {
      try {
        setError(null);
        const created = await createTask(newTask);
        setTasks(prev => [created, ...prev]);
        cacheRef.current = null; // Invalidate cache
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create task';
        setError(errorMessage);
        console.error('Error creating task:', err);
        throw new Error(errorMessage);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  const updateTaskById = useCallback(async (id: string, updates: Partial<Task>): Promise<void> => {
    const operation = async () => {
      try {
        setError(null);
        const updated = await updateTask(id, updates);
        setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
        cacheRef.current = null; // Invalidate cache
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update task';
        setError(errorMessage);
        console.error('Error updating task:', err);
        throw new Error(errorMessage);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  const deleteTaskById = useCallback(async (id: string): Promise<void> => {
    const operation = async () => {
      try {
        setError(null);
        await deleteTask(id);
        setTasks(prev => prev.filter(t => t.id !== id));
        cacheRef.current = null; // Invalidate cache
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to delete task';
        setError(errorMessage);
        console.error('Error deleting task:', err);
        throw new Error(errorMessage);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  // Enhanced status update with optimistic updates
  const updateTaskStatus = useCallback(async (taskId: number, newStatus: TaskStatus): Promise<void> => {
    const taskIdString = taskId.toString();
    const originalTask = tasks.find(t => t.id === taskIdString);
    
    if (!originalTask) {
      throw new Error('Task not found');
    }

    // Optimistic update
    setTasks(prevTasks => 
      prevTasks.map(task =>
        task.id === taskIdString ? { ...task, status: newStatus } : task
      )
    );
    
    const operation = async () => {
      try {
        setError(null);
        await updateTask(taskIdString, { status: newStatus });
        cacheRef.current = null; // Invalidate cache
      } catch (err: any) {
        // Revert optimistic update on error
        setTasks(prevTasks => 
          prevTasks.map(task =>
            task.id === taskIdString ? originalTask : task
          )
        );
        
        const errorMessage = err.message || 'Failed to update task status';
        setError(errorMessage);
        console.error('Error updating task status:', err);
        throw new Error(errorMessage);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, [tasks]);

  // Bulk operations
  const bulkUpdateTasks = useCallback(async (taskIds: string[], updates: Partial<Task>): Promise<void> => {
    const operation = async () => {
      try {
        setError(null);
        const updatePromises = taskIds.map(id => updateTask(id, updates));
        const updatedTasks = await Promise.all(updatePromises);
        
        setTasks(prev => 
          prev.map(task => {
            const updated = updatedTasks.find(u => u.id === task.id);
            return updated || task;
          })
        );
        
        cacheRef.current = null; // Invalidate cache
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update tasks';
        setError(errorMessage);
        console.error('Error bulk updating tasks:', err);
        throw new Error(errorMessage);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  const bulkDeleteTasks = useCallback(async (taskIds: string[]): Promise<void> => {
    const operation = async () => {
      try {
        setError(null);
        const deletePromises = taskIds.map(id => deleteTask(id));
        await Promise.all(deletePromises);
        
        setTasks(prev => prev.filter(task => !taskIds.includes(task.id)));
        cacheRef.current = null; // Invalidate cache
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to delete tasks';
        setError(errorMessage);
        console.error('Error bulk deleting tasks:', err);
        throw new Error(errorMessage);
      }
    };
    
    lastOperationRef.current = operation;
    await operation();
  }, []);

  // Utility methods
  const getTaskById = useCallback((id: string): Task | undefined => {
    return tasks.find(task => task.id === id);
  }, [tasks]);

  const getTasksByStatus = useCallback((status: TaskStatus): Task[] => {
    return tasks.filter(task => task.status === status);
  }, [tasks]);

  const getTasksByAssignee = useCallback((assigneeId: number): Task[] => {
    return tasks.filter(task => task.assignedUserId === assigneeId.toString());
  }, [tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    const now = new Date();
    return tasks.filter(task => {
      if (!task.deadline || task.status === 'Completed') return false;
      return new Date(task.deadline) < now;
    });
  }, [tasks]);

  // Filter management
  const setFilters = useCallback((filters: TaskFilters): void => {
    setCurrentFilters(filters);
    loadTasks(filters);
  }, [loadTasks]);

  const clearFilters = useCallback((): void => {
    const emptyFilters = {};
    setCurrentFilters(emptyFilters);
    loadTasks(emptyFilters);
  }, [loadTasks]);

  // Cache management
  const clearCache = useCallback((): void => {
    cacheRef.current = null;
  }, []);

  const invalidateCache = useCallback((): void => {
    cacheRef.current = null;
    loadTasks(currentFilters);
  }, [loadTasks, currentFilters]);

  // Error handling
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const retryLastOperation = useCallback(async (): Promise<void> => {
    if (lastOperationRef.current) {
      await lastOperationRef.current();
    } else {
      await loadTasks(currentFilters);
    }
  }, [loadTasks, currentFilters]);

  // Refresh tasks
  const refreshTasks = useCallback(async (filters?: TaskFilters): Promise<void> => {
    const filtersToUse = filters || currentFilters;
    cacheRef.current = null; // Force cache invalidation
    await loadTasks(filtersToUse);
  }, [loadTasks, currentFilters]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoized context value
  const contextValue = useMemo(() => ({
    tasks,
    pagination,
    isLoadingTasks,
    error,
    statistics,
    currentFilters,
    
    // CRUD operations
    addTask,
    updateTask: updateTaskById,
    deleteTask: deleteTaskById,
    updateTaskStatus,
    
    // Bulk operations
    bulkUpdateTasks,
    bulkDeleteTasks,
    
    // Filtering and search
    refreshTasks,
    setFilters,
    clearFilters,
    
    // Utility methods
    getTaskById,
    getTasksByStatus,
    getTasksByAssignee,
    getOverdueTasks,
    
    // Cache management
    clearCache,
    invalidateCache,
    
    // Error handling
    clearError,
    retryLastOperation,
  }), [
    tasks,
    pagination,
    isLoadingTasks,
    error,
    statistics,
    currentFilters,
    addTask,
    updateTaskById,
    deleteTaskById,
    updateTaskStatus,
    bulkUpdateTasks,
    bulkDeleteTasks,
    refreshTasks,
    setFilters,
    clearFilters,
    getTaskById,
    getTasksByStatus,
    getTasksByAssignee,
    getOverdueTasks,
    clearCache,
    invalidateCache,
    clearError,
    retryLastOperation,
  ]);

  return <TaskContext.Provider value={contextValue}>{children}</TaskContext.Provider>;
}

// Enhanced hook with error handling
export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}

// Convenience hooks for specific use cases
export function useTasksByStatus(status: TaskStatus) {
  const { getTasksByStatus } = useTasks();
  return useMemo(() => getTasksByStatus(status), [getTasksByStatus, status]);
}

export function useTasksByAssignee(assigneeId: number) {
  const { getTasksByAssignee } = useTasks();
  return useMemo(() => getTasksByAssignee(assigneeId), [getTasksByAssignee, assigneeId]);
}

export function useTaskStatistics() {
  const { statistics } = useTasks();
  return statistics;
}

export function useTasksError() {
  const { error, clearError, retryLastOperation } = useTasks();
  return { error, clearError, retryLastOperation };
}