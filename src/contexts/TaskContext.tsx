"use client";

import type { Task } from '@/types';
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

interface TaskContextType {
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
      const created = await createTask(newTask); // This is where the API call is made
      setTasks(prev => [created, ...prev]);
      setError(null);
    } catch (err) {
      setError('Failed to create task'); // Sets an error message in the context
      console.error('Error creating task:', err);
      throw err; // Re-throws the error for the calling component
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

  const contextValue = useMemo(
    () => ({
      tasks,
      pagination,
      isLoadingTasks,
      error,
      addTask,
      updateTask: updateTaskById,
      deleteTask: deleteTaskById,
      refreshTasks: loadTasks,
    }),
    [tasks, pagination, isLoadingTasks, error, addTask, updateTaskById, deleteTaskById, loadTasks]
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
