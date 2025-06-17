// types/task.ts
export type TaskStatus = 'Pending Approval' | 'To Do' | 'In Progress' | 'In Review' | 'Needs Changes' | 'Completed' | 'Rejected' | 'Archived';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskAttachment {
  id: string;
  taskId: string;
  userId: number;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSizeBytes: number | null;
  checksum: string | null;
  createdAt: Date;
  softDeletedAt: Date | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: number;
  content: string;
  mentions: number | null;
  createdAt: Date;
  updatedAt: Date;
  softDeletedAt: Date | null;
  userName: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: Date | null;
  progressPercentage: number;
  projectId: number | null;
  recurringPattern: any | null;
  assignerId: number;
  assignedUserId: number | null;
  updatedBy: number | null;
  suggestedPriority: TaskPriority | null;
  suggestedDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  softDeletedAt: Date | null;
  // Computed fields from joins
  assigneeName?: string;
  assignerName?: string;
  projectName?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  progressPercentage?: number;
  projectId?: number;
  recurringPattern?: string;
  assignerId: string;
  assignedUserId?: string;
  suggestedPriority?: TaskPriority;
  suggestedDeadline?: string;
  timerDuration?: number;
  attachments?: Omit<TaskAttachment, 'id' | 'createdAt'>[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: Date;
  progressPercentage?: number;
  projectId?: number;
  recurringPattern?: any;
  assignedUserId?: number;
  suggestedPriority?: TaskPriority;
  suggestedDeadline?: Date;
  attachments?: Omit<TaskAttachment, 'id' | 'createdAt'>[];
  comments?: Omit<TaskComment, 'id' | 'createdAt' | 'updatedAt'>[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: number;
  projectId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  assignedUserId?: number;
  assignerId?: number;
}