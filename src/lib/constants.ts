import type { TaskStatus } from '@/types';

export const TASK_STATUSES: TaskStatus[] = ["Pending Approval", "To Do", "In Progress", "Needs Changes", "Completed", "Rejected", "Overdue"];

export const CEO_EMAIL = 'thanushdinesh04@gmail.com'; 
export const NO_PRIORITY_SELECTED_VALUE = "__NONE__";

export const TASKS_STORAGE_KEY = 'taskzen-tasks-data';
export const USERS_STORAGE_KEY = 'taskzen-users-data';
export const CURRENT_USER_STORAGE_KEY = 'taskzen-current-user-data';
