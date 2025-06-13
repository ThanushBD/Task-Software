
import type { Task, TaskStatus, User } from '@/types';

export const TASK_STATUSES: TaskStatus[] = ["Pending Approval", "To Do", "In Progress", "Needs Changes", "Completed", "Rejected", "Overdue"];

const DEFAULT_ADMIN_ID = 'admin001';
const DEFAULT_ADMIN_NAME = 'Admin User';
export const CEO_EMAIL = 'ceo@taskzen.com'; 

export const NO_PRIORITY_SELECTED_VALUE = "__NONE__";

export const INITIAL_SEED_TASKS: Task[] = [
  { id: '1', title: 'Design Homepage UI', description: 'Create a modern and responsive design for the homepage, focusing on intuitive navigation and clear calls to action.', status: 'In Progress', deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), priority: 'High', assignedUserId: 'user001', assigneeName: 'Regular User', assignerId: DEFAULT_ADMIN_ID, assignerName: DEFAULT_ADMIN_NAME, timerDuration: 120, attachments: [], comments: [] },
  { id: '2', title: 'Develop API Endpoints for Tasks', description: 'Implement all necessary CRUD operations for tasks, ensuring secure and efficient data handling.', status: 'To Do', deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), priority: 'High', assignedUserId: 'user002', assigneeName: 'Jane Doe', assignerId: DEFAULT_ADMIN_ID, assignerName: DEFAULT_ADMIN_NAME, timerDuration: 240, attachments: [{id: 'file1', name: 'API_Spec_v1.pdf', type: 'application/pdf', size: 102400}], comments: [] },
  { id: '3', title: 'Setup PostgreSQL Database Schema', description: 'Define and create the database schema based on the application requirements, including tables for users and tasks.', status: 'Completed', deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), priority: 'Medium', assignedUserId: 'admin001', assigneeName: 'Admin User', assignerId: DEFAULT_ADMIN_ID, assignerName: DEFAULT_ADMIN_NAME, timerDuration: 180, attachments: [], comments: [] },
  { id: '4', title: 'Write User Documentation', description: 'Prepare comprehensive user guides covering all features of the application, with clear instructions and screenshots.', status: 'To Do', deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), priority: 'Low', assignedUserId: 'user001', assigneeName: 'Regular User', assignerId: DEFAULT_ADMIN_ID, assignerName: DEFAULT_ADMIN_NAME, timerDuration: 300, attachments: [], comments: [] },
  { id: '5', title: 'Team Meeting & Sprint Planning', description: 'Organize weekly sync-up meeting and plan for the next sprint, assigning tasks and setting goals.', status: 'Overdue', deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), priority: 'Medium', assignedUserId: 'user003', assigneeName: 'John Smith', assignerId: DEFAULT_ADMIN_ID, assignerName: DEFAULT_ADMIN_NAME, timerDuration: 60, attachments: [], comments: [] },
  { id: 'task-pending-1', title: 'Review Q1 Marketing Plan', description: 'Go over the proposed marketing plan for Q1 and provide feedback.', status: 'Pending Approval', deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), priority: 'Medium', assignedUserId: null, assigneeName: null, assignerId: 'user001', assignerName: 'Regular User', timerDuration: 0, attachments: [], comments: [], suggestedDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), suggestedPriority: 'Medium' },
  { id: 'task-needs-changes-1', title: 'Update User Profile Page UI', description: 'The current UI needs a refresh. Please update based on the new style guide.', status: 'Needs Changes', deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), priority: 'Medium', assignedUserId: null, assigneeName: null, assignerId: 'user002', assignerName: 'Jane Doe', timerDuration: 0, attachments: [], comments: [{ userId: DEFAULT_ADMIN_ID, userName: DEFAULT_ADMIN_NAME, comment: "Please use the new color palette and ensure all form fields are aligned.", timestamp: new Date(Date.now() - 60*60*1000).toISOString()}] , suggestedDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), suggestedPriority: 'Medium'},
];

export let MOCK_TASKS: Task[] = [...INITIAL_SEED_TASKS.map(task => ({
  ...task, 
  comments: task.comments ? [...task.comments.map(c => ({...c}))] : [],
  attachments: task.attachments ? [...task.attachments.map(a => ({...a}))] : [] 
}))];

export const INITIAL_SEED_USERS: User[] = [
  { id: DEFAULT_ADMIN_ID, email: 'admin@taskzen.com', name: DEFAULT_ADMIN_NAME, role: 'admin', password: 'password123' },
  { id: 'user001', email: 'user@taskzen.com', name: 'Regular User', role: 'user', password: 'password123' },
  { id: 'user002', email: 'jane.doe@taskzen.com', name: 'Jane Doe', role: 'user', password: 'password123' },
  { id: 'user003', email: 'john.smith@taskzen.com', name: 'John Smith', role: 'user', password: 'password123' },
];

export let MOCK_USERS: User[] = [...INITIAL_SEED_USERS.map(u => ({...u}))];

export const updateGlobalMockTasks = (newTasks: Task[]) => {
  MOCK_TASKS = [...newTasks.map(task => ({
    ...task, 
    comments: task.comments ? [...task.comments.map(c => ({...c}))] : [],
    attachments: task.attachments ? [...task.attachments.map(a => ({...a}))] : []
  }))];
};

export const updateGlobalMockUsers = (newUsers: User[]) => {
  MOCK_USERS = [...newUsers.map(u => ({...u}))];
};

export const addMockTask = (task: Task) => {
  const newTaskCopy = {
    ...task, 
    comments: task.comments ? [...task.comments.map(c => ({...c}))] : [],
    attachments: task.attachments ? [...task.attachments.map(a => ({...a}))] : []
  };
  MOCK_TASKS.unshift(newTaskCopy);
};

export const updateMockTask = (updatedTask: Task) => {
  const taskIndex = MOCK_TASKS.findIndex(task => task.id === updatedTask.id);
  if (taskIndex !== -1) {
    const updatedTaskCopy = {
      ...updatedTask, 
      comments: updatedTask.comments ? [...updatedTask.comments.map(c => ({...c}))] : [],
      attachments: updatedTask.attachments ? [...updatedTask.attachments.map(a => ({...a}))] : []
    };
    MOCK_TASKS[taskIndex] = updatedTaskCopy;
  }
};

export const TASKS_STORAGE_KEY = 'taskzen-tasks-data';
export const USERS_STORAGE_KEY = 'taskzen-users-data';
export const CURRENT_USER_STORAGE_KEY = 'taskzen-current-user-data';
