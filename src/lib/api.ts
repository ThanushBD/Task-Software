// CORRECTED: Full corrected code for api.ts
import { Task, User } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  tasks: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(error)}`);
  }
  const data: ApiResponse<T> = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error occurred');
  }
  return data.data;
}

export async function fetchTasks(params?: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  priority?: string;
  assigneeId?: number;
  assignerId?: number;
}): Promise<PaginatedResponse<Task>> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });
  }

  const response = await fetch(`${API_BASE_URL}/tasks?${queryParams.toString()}`, {
    credentials: 'include',
  });

  return handleResponse<PaginatedResponse<Task>>(response);
}

export async function fetchTaskById(id: string): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
  return handleResponse<Task>(response);
}

export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  // CORRECTED: Added robust date validation to prevent crashes from empty strings
  const taskToSend = {
    ...task,
    deadline: task.deadline && new Date(task.deadline).getTime() ? new Date(task.deadline).toISOString() : null,
    suggestedDeadline: task.suggestedDeadline && new Date(task.suggestedDeadline).getTime() ? new Date(task.suggestedDeadline).toISOString() : null,
    createdAt: task.createdAt && new Date(task.createdAt).getTime() ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: task.updatedAt && new Date(task.updatedAt).getTime() ? new Date(task.updatedAt).toISOString() : new Date().toISOString(),
    completedAt: task.completedAt && new Date(task.completedAt).getTime() ? new Date(task.completedAt).toISOString() : null,
    softDeletedAt: task.softDeletedAt && new Date(task.softDeletedAt).getTime() ? new Date(task.softDeletedAt).toISOString() : null,
  };

  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(taskToSend),
  });

  return handleResponse<Task>(response);
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  return handleResponse<Task>(response);
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  await handleResponse<void>(response);
}