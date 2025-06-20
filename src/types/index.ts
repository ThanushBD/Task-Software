export type TaskStatus = 
  | 'To Do' 
  | 'In Progress' 
  | 'Completed'  
  | 'Overdue' 
  | 'Pending Approval' 
  | 'Needs Changes' 
  | 'Rejected';
export type TaskPriority = "Low" | "Medium" | "High";

export interface ConceptualFileAttachment {
  id: string;
  name: string;
  type?: string;
  size?: number;
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
  timestamp: string; 
  createdAt: string;
  userName: string; 
  comment: string; 
  user: {
    id: string;
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
  timerDuration: number;
  assigneeName?: string; 
  assignerName?: string; 
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  assigner?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  attachments: TaskAttachment[];
  comments: TaskComment[];
  projectName?: string;
}

export type UserRole = "Admin" | "User";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string;
  role: UserRole;
  password?: string;
}

// Search configuration interface
export interface SearchConfig {
  searchInTitle: boolean;
  searchInDescription: boolean;
  searchInComments: boolean;
}

// Theme context type
export interface ExtendedThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  config: any;
  setConfig: (config: any) => void;
}