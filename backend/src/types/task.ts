// types/task.ts
export type TaskStatus = 'To Do' | 'In Progress' | 'In Review' | 'Completed' | 'Cancelled';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface TaskAttachment {
  id?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath?: string;
  createdAt?: Date;
}

export interface TaskComment {
  id?: string;
  userId: string;
  userName: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Task {
  id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  deadline: Date;
  priority: TaskPriority;
  assignedUserId?: string;
  assigneeName?: string;
  assignerId: string;
  assignerName: string;
  timerDuration?: number;
  suggestedDeadline?: Date;
  suggestedPriority?: TaskPriority;
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  deadline: string; // ISO string
  priority?: TaskPriority;
  assignedUserId?: string;
  assigneeName?: string;
  assignerId: string;
  assignerName: string;
  timerDuration?: number;
  suggestedDeadline?: string; // ISO string
  suggestedPriority?: TaskPriority;
  attachments?: Omit<TaskAttachment, 'id' | 'createdAt'>[];
  comments?: Omit<TaskComment, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  id: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedUserId?: string;
  assignerId?: string;
}