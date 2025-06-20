// types/task.ts
export type TaskStatus = 'To Do' | 'In Progress' | 'Completed' | 'Overdue' | 'Pending Approval' | 'Needs Changes' | 'Rejected';
export type TaskPriority = 'Low' | 'Medium' | 'High';

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
  timestamp: string; 
  userIdString: string; // For compatibility with frontend
  userFirstName: string;
  userLastName: string;
  userAvatarUrl: string | null;
  userFullName: string;
  userInitials: string;
  userEmail: string;
  userRole: string;
  userDepartment: string | null;
  userPosition: string | null;
  userTimezone: string | null;
  userPhone: string | null;
  userLinkedIn: string | null;
  userGitHub: string | null;
  userTwitter: string | null;
  userWebsite: string | null;
  userBio: string | null;
  userLocation: string | null;
  userPronouns: string | null;
  userSkills: string[] | null;
  userInterests: string[] | null;
  comment: string;
  
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  progressPercentage: number;
  projectId: string | null;
  recurringPattern: any | null;
  assignerId: string;
  assignedUserId: string | null;
  updatedBy: string | null;
  suggestedPriority: TaskPriority | null;
  suggestedDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  softDeletedAt: string | null;
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