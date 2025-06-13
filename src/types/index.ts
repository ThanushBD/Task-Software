
export type TaskStatus = "To Do" | "In Progress" | "Completed" | "Overdue" | "Pending Approval" | "Needs Changes" | "Rejected";

export type TaskPriority = "Low" | "Medium" | "High";

export interface ConceptualFileAttachment {
  id: string; // Simple ID for key in lists
  name: string;
  type?: string; // e.g., 'image/png', 'application/pdf'
  size?: number; // in bytes
  // url?: string; // Would be populated if real files were uploaded
}

export interface TaskComment {
  userId: string;
  userName: string;
  comment: string;
  timestamp: string; // ISO Date string
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  deadline: string; 
  priority: TaskPriority;
  assignedUserId: string | null; 
  assigneeName: string | null; 
  assignerId: string; 
  assignerName: string; 
  timerDuration: number; 
  attachments: ConceptualFileAttachment[]; // Changed to be non-optional, initialized as []
  comments?: TaskComment[]; 
  suggestedDeadline?: string | null;
  suggestedPriority?: TaskPriority | null;
}

export type UserRole = "admin" | "user";

export interface User {
  id:string;
  email: string;
  name?: string;
  role: UserRole;
  password?: string;
}
