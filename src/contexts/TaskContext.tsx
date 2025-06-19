"use client";

import type { Task, TaskStatus } from '@/types';
import { fetchTasks, createTask, updateTask, deleteTask } from '@/lib/api';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';

// 1. ADD `updateTaskStatus` to the context type definition
export interface TaskContextType {
  tasks: Task[];
  isLoadingTasks: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskStatus: (taskId: number, newStatus: TaskStatus) => Promise<void>; // Added this line
  refreshTasks: (params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: string;
    priority?: string;
    assigneeId?: number;
    assignerId?: number;
  }) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<TaskContextType['pagination']>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async (params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: string;
    priority?: string;
    assigneeId?: number;
    assignerId?: number;
  }) => {
    setIsLoadingTasks(true);
    try {
      const response = await fetchTasks(params);
      setTasks(response.tasks);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to load tasks');
      console.error('Error loading tasks:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = useCallback(async (newTask: Omit<Task, 'id'>) => {
    try {
      const created = await createTask(newTask);
      setTasks(prev => [created, ...prev]);
      setError(null);
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
      throw err;
    }
  }, []);

  const updateTaskById = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      const updated = await updateTask(id, updates);
      setTasks(prev => prev.map(t => (t.id === id ? updated : t)));
      setError(null);
    } catch (err) {
      setError('Failed to update task');
      console.error('Error updating task:', err);
      throw err;
    }
  }, []);

  const deleteTaskById = useCallback(async (id: string) => {
    try {
      await deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      setError(null);
    } catch (err) {
      setError('Failed to delete task');
      console.error('Error deleting task:', err);
      throw err;
    }
  }, []);

  // 2. DEFINE the `updateTaskStatus` function, integrating with your existing API logic
  const updateTaskStatus = useCallback(async (taskId: number, newStatus: TaskStatus) => {
    // Optimistically update the UI for a responsive feel
    setTasks(prevTasks => prevTasks.map(task =>
      task.id === taskId.toString() ? { ...task, status: newStatus } : task
    ));
    
    try {
      // Call your existing API update function
      await updateTask(taskId.toString(), { status: newStatus });
       setError(null);
    } catch (err) {
        setError('Failed to update task status. Reverting change.');
        console.error('Error updating task status:', err);
        // If the API call fails, revert the optimistic update
        loadTasks(); // The simplest way to revert is to refetch the source of truth
        throw err;
    }
  }, [updateTask, loadTasks]); // `updateTask` is your API call from `lib/api`, which should be stable

  // 3. PROVIDE the new function in the context value
  const contextValue = useMemo(
    () => ({
      tasks,
      pagination,
      isLoadingTasks,
      error,
      addTask,
      updateTask: updateTaskById,
      deleteTask: deleteTaskById,
      updateTaskStatus, // Add the new function here
      refreshTasks: loadTasks,
    }),
    [tasks, pagination, isLoadingTasks, error, addTask, updateTaskById, deleteTaskById, updateTaskStatus, loadTasks]
  );

  return <TaskContext.Provider value={contextValue}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
