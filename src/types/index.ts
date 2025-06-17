export type TaskStatus = "To Do" | "In Progress" | "Completed" | "Overdue" | "Pending Approval" | "Needs Changes" | "Rejected";

export type TaskPriority = "Low" | "Medium" | "High";

export interface ConceptualFileAttachment {
  id: string; // Simple ID for key in lists
  name: string;
  type?: string; // e.g., 'image/png', 'application/pdf'
  size?: number; // in bytes
  // url?: string; // Would be populated if real files were uploaded
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSizeBytes: number;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  progressPercentage: number;
  projectId: number | null;
  recurringPattern: any | null;
  assignerId: number;
  assignedUserId: number | null;
  updatedBy: number | null;
  suggestedPriority: TaskPriority | null;
  suggestedDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  softDeletedAt: string | null;
  timerDuration: number;
  // Nested objects from joins
  assignee?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  assigner?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  attachments: TaskAttachment[];
  comments: TaskComment[];
  projectName?: string;
}

export type UserRole = "Admin" | "User";

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name?: string; // Optional: Keep if `name` is still used in some contexts, but `firstName`/`lastName` are primary
  role: UserRole;
  password?: string;
}
