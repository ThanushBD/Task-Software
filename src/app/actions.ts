"use server";

import { optimizeTaskDeadline, OptimizeTaskDeadlineInput, OptimizeTaskDeadlineOutput } from "@/ai/flows/optimize-task-deadline";
import { parseTaskFromText, ParseTaskFromTextInput, ParseTaskFromTextOutput } from "@/ai/flows/parse-task-from-text-flow";
import { notifyOverdueTask } from "@/ai/flows/notify-overdue-task-flow";
import type { NotifyOverdueTaskInput, NotifyOverdueTaskOutput } from "@/ai/flows/notify-overdue-task-types";
import { z } from "zod";
import { addMockTask, MOCK_USERS, MOCK_TASKS, updateMockTask, CEO_EMAIL, NO_PRIORITY_SELECTED_VALUE } from "@/lib/constants";
import type { Task, TaskPriority, TaskStatus, User, TaskComment, ConceptualFileAttachment } from "@/types";
import { revalidatePath } from "next/cache";
import { format, isPast, parseISO } from "date-fns";


// --- Suggest Deadline Action ---
const SuggestDeadlineSchema = z.object({
  taskDescription: z.string().min(10, "Task description must be at least 10 characters long."),
});

export interface SuggestDeadlineActionState {
  success: boolean;
  message?: string;
  data?: OptimizeTaskDeadlineOutput;
  errors?: {
    taskDescription?: string[];
    _form?: string[];
  };
}

export async function suggestDeadlineAction(
  prevState: SuggestDeadlineActionState,
  formData: FormData
): Promise<SuggestDeadlineActionState> {
  const validatedFields = SuggestDeadlineSchema.safeParse({
    taskDescription: formData.get("taskDescription"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed. Please check the task description.",
    };
  }

  const input: OptimizeTaskDeadlineInput = {
    taskDescription: validatedFields.data.taskDescription,
  };

  try {
    const result = await optimizeTaskDeadline(input);
    return {
      success: true,
      data: result,
      message: "Deadline suggested successfully.",
    };
  } catch (error) {
    console.error("Error optimizing task deadline:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: `AI suggestion failed: ${errorMessage}`,
      errors: { _form: [errorMessage] },
    };
  }
}


// --- Parse Task From Text Action ---
const ParseTaskFromTextSchema = z.object({
  naturalLanguageInput: z.string().min(5, "Please provide a more detailed task description."),
});

export interface ParseTaskFromTextActionState {
  success: boolean;
  message?: string;
  data?: ParseTaskFromTextOutput;
  errors?: {
    naturalLanguageInput?: string[];
    _form?: string[];
  };
}

export async function parseTaskFromTextAction(
  prevState: ParseTaskFromTextActionState,
  formData: FormData
): Promise<ParseTaskFromTextActionState> {
  const validatedFields = ParseTaskFromTextSchema.safeParse({
    naturalLanguageInput: formData.get("naturalLanguageInput"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed. Please check your input.",
    };
  }

  const input: ParseTaskFromTextInput = {
    naturalLanguageInput: validatedFields.data.naturalLanguageInput,
  };

  try {
    const result = await parseTaskFromText(input);
    return {
      success: true,
      data: result,
      message: "Task details parsed successfully.",
    };
  } catch (error) {
    console.error("Error parsing task from text:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: `AI parsing failed: ${errorMessage}`,
      errors: { _form: [errorMessage] },
    };
  }
}


// --- Create Task Action (for Admin) ---
const AdminCreateTaskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
  deadline: z.string({ required_error: "Deadline is required." }).min(1, "Deadline is required."),
  priority: z.enum(["Low", "Medium", "High"] as [TaskPriority, ...TaskPriority[]]),
  assignedUserId: z.string({ required_error: "Assignee is required." }).min(1,"An employee must be assigned."),
  timerDuration: z.string({ required_error: "Timer duration is required." })
    .min(1, "Timer duration is required.")
    .refine(val => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, { message: "Timer duration must be a positive number." }),
  assignerId: z.string({ required_error: "Assigner ID is missing." }),
  assignerName: z.string({ required_error: "Assigner name is missing." }),
  // attachments field is conceptual and not processed by the action
});

export interface AdminCreateTaskActionState {
  success: boolean;
  message?: string;
  task?: Task;
  errors?: {
    title?: string[];
    description?: string[];
    deadline?: string[];
    priority?: string[];
    assignedUserId?: string[];
    timerDuration?: string[];
    assignerId?: string[];
    assignerName?: string[];
    _form?: string[];
  };
}

export async function adminCreateTaskAction(
  prevState: AdminCreateTaskActionState,
  formData: FormData
): Promise<AdminCreateTaskActionState> {

  const validatedFields = AdminCreateTaskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    deadline: formData.get("deadline"),
    priority: formData.get("priority"),
    assignedUserId: formData.get("assignedUserId"),
    timerDuration: formData.get("timerDuration"),
    assignerId: formData.get("assignerId"),
    assignerName: formData.get("assignerName"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed. Please check all required task details.",
    };
  }
  
  const { title, description, deadline, priority, assignedUserId, timerDuration, assignerId, assignerName } = validatedFields.data;

  const assignerUser = MOCK_USERS.find(user => user.id === assignerId);
  if (!assignerUser || assignerUser.role !== 'admin') {
    return {
      success: false,
      message: "Unauthorized: Only administrators can create tasks.",
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const assignee = MOCK_USERS.find(user => user.id === assignedUserId);
   if (!assignee) { 
    return {
      success: false,
      message: "Assigned user not found.",
      errors: { assignedUserId: ["Invalid user selected for assignment."] },
    };
  }

  const newTask: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    description,
    status: "To Do" as TaskStatus,
    deadline: new Date(deadline).toISOString(),
    priority: priority as TaskPriority,
    assignedUserId: assignedUserId,
    assigneeName: assignee.name || "Unknown",
    assignerId: assignerId,
    assignerName: assignerName,
    timerDuration: Number(timerDuration),
    attachments: [], // Conceptual attachments added on client, not processed here
    comments: [],
  };

  try {
    addMockTask(newTask); 
    revalidatePath("/"); 
    revalidatePath("/admin"); 

    return {
      success: true,
      task: newTask,
      message: `Task "${newTask.title}" created by ${newTask.assignerName}, assigned to ${newTask.assigneeName}. Deadline: ${format(new Date(newTask.deadline), "PPP")}. Timer: ${newTask.timerDuration} min.`,
    };
  } catch (error) {
    console.error("Error creating task:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while creating the task.";
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Create Task Action (for User) ---
const VALID_TASK_PRIORITIES_FOR_SUGGESTION: TaskPriority[] = ["Low", "Medium", "High"];
const UserCreateTaskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
  creatorId: z.string({ required_error: "Creator ID is missing." }),
  creatorName: z.string({ required_error: "Creator name is missing." }),
  suggestedDeadline: z.string().optional().nullable(),
  suggestedPriority: z.enum([NO_PRIORITY_SELECTED_VALUE, ...VALID_TASK_PRIORITIES_FOR_SUGGESTION]).optional().nullable(),
  // attachments field is conceptual and not processed by the action
});

export interface UserCreateTaskActionState {
  success: boolean;
  message?: string;
  task?: Task;
  errors?: {
    title?: string[];
    description?: string[];
    creatorId?: string[];
    creatorName?: string[];
    suggestedDeadline?: string[];
    suggestedPriority?: string[];
    _form?: string[];
  };
}

export async function createUserTaskAction(
  prevState: UserCreateTaskActionState,
  formData: FormData
): Promise<UserCreateTaskActionState> {
  const validatedFields = UserCreateTaskFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    creatorId: formData.get("creatorId"),
    creatorName: formData.get("creatorName"),
    suggestedDeadline: formData.get("suggestedDeadline") || null,
    suggestedPriority: formData.get("suggestedPriority") || null,
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed. Please check task details.",
    };
  }

  const { title, description, creatorId, creatorName, suggestedDeadline, suggestedPriority: rawSuggestedPriority } = validatedFields.data;

  const creatorUser = MOCK_USERS.find(user => user.id === creatorId);
  if (!creatorUser) {
    return {
      success: false,
      message: "Unauthorized: Creator user not found.",
      errors: { _form: ["Invalid user attempting to create task."] },
    };
  }
  
  let finalTaskPriority: TaskPriority = "Medium"; 
  let finalSuggestedPriorityAttribute: TaskPriority | null = null;

  if (rawSuggestedPriority && rawSuggestedPriority !== NO_PRIORITY_SELECTED_VALUE) {
    finalTaskPriority = rawSuggestedPriority as TaskPriority;
    finalSuggestedPriorityAttribute = rawSuggestedPriority as TaskPriority;
  }

  const newTask: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    title,
    description,
    status: "Pending Approval" as TaskStatus,
    deadline: suggestedDeadline ? new Date(suggestedDeadline).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), 
    priority: finalTaskPriority, 
    assignedUserId: null, 
    assigneeName: null,
    assignerId: creatorId, 
    assignerName: creatorName,
    timerDuration: 0,
    attachments: [], // Conceptual attachments added on client, not processed here
    comments: [],
    suggestedDeadline: suggestedDeadline ? new Date(suggestedDeadline).toISOString() : null,
    suggestedPriority: finalSuggestedPriorityAttribute,
  };

  try {
    addMockTask(newTask);
    revalidatePath("/");
    revalidatePath("/admin"); 

    return {
      success: true,
      task: newTask,
      message: `Task "${newTask.title}" submitted for approval by ${newTask.assignerName}.`,
    };
  } catch (error) {
    console.error("Error creating user task:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Approve Task Action (for Admin/Manager) ---
const ApproveTaskSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  approverId: z.string().min(1, "Approver ID is required."),
  assignedUserId: z.string({ required_error: "Please assign a user."}).min(1, "Please assign a user."),
  priority: z.enum(["Low", "Medium", "High"] as [TaskPriority, ...TaskPriority[]]),
  deadline: z.string({ required_error: "Deadline is required."}).min(1, "Deadline is required."),
  timerDuration: z.string({ required_error: "Timer duration is required."})
    .min(1, "Timer duration must be at least 1.")
    .refine(val => Number(val) > 0, { message: "Timer duration must be positive."}),
});

export interface ApproveTaskActionState {
  success: boolean;
  message?: string;
  task?: Task; 
  errors?: {
    taskId?: string[];
    approverId?: string[];
    assignedUserId?: string[];
    priority?: string[];
    deadline?: string[];
    timerDuration?: string[];
    _form?: string[];
  };
}

export async function approveTaskAction(
  prevState: ApproveTaskActionState,
  formData: FormData
): Promise<ApproveTaskActionState> {
  const validatedFields = ApproveTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    approverId: formData.get("approverId"),
    assignedUserId: formData.get("assignedUserId"),
    priority: formData.get("priority"),
    deadline: formData.get("deadline"),
    timerDuration: formData.get("timerDuration"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed.",
    };
  }

  const { taskId, approverId, assignedUserId, priority, deadline, timerDuration } = validatedFields.data;

  const approver = MOCK_USERS.find(user => user.id === approverId);
  if (!approver || approver.role !== 'admin') {
    return {
      success: false,
      message: "Unauthorized: Only administrators can approve tasks.",
      task: undefined,
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const assignee = MOCK_USERS.find(user => user.id === assignedUserId);
  if (!assignee) {
    return {
      success: false,
      message: "Assignee not found.",
      task: undefined,
      errors: { assignedUserId: ["Invalid user selected for assignment."] },
    };
  }

  const taskIndex = MOCK_TASKS.findIndex(task => task.id === taskId);
  if (taskIndex === -1) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }

  const taskToApprove = MOCK_TASKS[taskIndex];
  if (taskToApprove.status !== "Pending Approval") {
    return {
      success: false,
      message: "Task is not pending approval.",
      task: undefined,
      errors: { _form: [`This task has status "${taskToApprove.status}" and cannot be approved directly.`] },
    };
  }

  const approvedTask: Task = {
    ...taskToApprove,
    status: "To Do" as TaskStatus,
    assignedUserId: assignee.id, 
    assigneeName: assignee.name || assignee.email,
    priority: priority as TaskPriority,
    deadline: new Date(deadline).toISOString(),
    timerDuration: Number(timerDuration),
    suggestedDeadline: null, 
    suggestedPriority: null,
    // attachments are not modified by this action
  };

  try {
    updateMockTask(approvedTask);
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: approvedTask,
      message: `Task "${approvedTask.title}" has been approved by ${approver.name || approver.email}, assigned to ${assignee.name || assignee.email}, and set to 'To Do'.`,
    };
  } catch (error) {
    console.error("Error approving task:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      task: undefined,
      errors: { _form: [errorMessage] },
    };
  }
}


// --- Request Revisions Action (for Admin/Manager) ---
const RequestRevisionsSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  reviserId: z.string().min(1, "Reviser ID is required."),
  comment: z.string().min(10, "Comment must be at least 10 characters long."),
});

export interface RequestRevisionsActionState {
  success: boolean;
  message?: string;
  task?: Task; 
  errors?: {
    taskId?: string[];
    reviserId?: string[];
    comment?: string[];
    _form?: string[];
  };
}

export async function requestRevisionsAction(
  prevState: RequestRevisionsActionState,
  formData: FormData
): Promise<RequestRevisionsActionState> {
  const validatedFields = RequestRevisionsSchema.safeParse({
    taskId: formData.get("taskId"),
    reviserId: formData.get("reviserId"),
    comment: formData.get("comment"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed.",
    };
  }

  const { taskId, reviserId, comment } = validatedFields.data;

  const reviser = MOCK_USERS.find(user => user.id === reviserId);
  if (!reviser || reviser.role !== 'admin') {
    return {
      success: false,
      message: "Unauthorized: Only administrators can request revisions.",
      task: undefined,
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const taskIndex = MOCK_TASKS.findIndex(task => task.id === taskId);
  if (taskIndex === -1) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }

  const taskToRevise = MOCK_TASKS[taskIndex];
  if (taskToRevise.status !== "Pending Approval") {
    return {
      success: false,
      message: "Task is not pending approval for revisions.",
      task: undefined,
      errors: { _form: [`This task has status "${taskToRevise.status}".`] },
    };
  }

  const newCommentEntry: TaskComment = {
    userId: reviser.id,
    userName: reviser.name || reviser.email,
    comment: comment,
    timestamp: new Date().toISOString(),
  };

  const revisedTask: Task = {
    ...taskToRevise,
    status: "Needs Changes" as TaskStatus,
    comments: [...(taskToRevise.comments || []), newCommentEntry],
    // attachments are not modified by this action
  };

  try {
    updateMockTask(revisedTask);
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: revisedTask,
      message: `Revisions requested for task "${revisedTask.title}". Status set to 'Needs Changes'.`,
    };
  } catch (error) {
    console.error("Error requesting revisions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      task: undefined,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Reject Task Action (for Admin/Manager) ---
const RejectTaskSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  rejecterId: z.string().min(1, "Rejecter ID is required."),
});

export interface RejectTaskActionState {
  success: boolean;
  message?: string;
  task?: Task; 
  errors?: {
    taskId?: string[];
    rejecterId?: string[];
    _form?: string[];
  };
}

export async function rejectTaskAction(
  prevState: RejectTaskActionState,
  formData: FormData
): Promise<RejectTaskActionState> {
  const validatedFields = RejectTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    rejecterId: formData.get("rejecterId"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed.",
    };
  }

  const { taskId, rejecterId } = validatedFields.data;

  const rejecter = MOCK_USERS.find(user => user.id === rejecterId);
  if (!rejecter || rejecter.role !== 'admin') {
    return {
      success: false,
      message: "Unauthorized: Only administrators can reject tasks.",
      task: undefined,
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const taskIndex = MOCK_TASKS.findIndex(task => task.id === taskId);
  if (taskIndex === -1) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }
  
  const taskToReject = MOCK_TASKS[taskIndex];
  if (taskToReject.status !== "Pending Approval" && taskToReject.status !== "Needs Changes") {
     return {
      success: false,
      message: "Task cannot be rejected at its current status.",
      task: undefined,
      errors: { _form: [`This task has status "${taskToReject.status}".`] },
    };
  }

  const rejectedTask: Task = {
    ...taskToReject,
    status: "Rejected" as TaskStatus,
    // attachments are not modified by this action
  };

  try {
    updateMockTask(rejectedTask);
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: rejectedTask,
      message: `Task "${rejectedTask.title}" has been rejected.`,
    };
  } catch (error) {
    console.error("Error rejecting task:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      task: undefined,
      errors: { _form: [errorMessage] },
    };
  }
}


// --- Resubmit Task Action (for User) ---
const ResubmitTaskSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  userId: z.string().min(1, "User ID is required."),
  // attachments field is conceptual and not processed by the action
});

export interface ResubmitTaskActionState {
  success: boolean;
  message?: string;
  task?: Task; 
  errors?: {
    taskId?: string[];
    title?: string[];
    description?: string[];
    userId?: string[];
    _form?: string[];
  };
}

export async function resubmitTaskAction(
  prevState: ResubmitTaskActionState,
  formData: FormData
): Promise<ResubmitTaskActionState> {
  const validatedFields = ResubmitTaskSchema.safeParse({
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description"),
    userId: formData.get("userId"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation failed.",
    };
  }

  const { taskId, title, description, userId } = validatedFields.data;

  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) {
    return {
      success: false,
      message: "User not found.",
      task: undefined,
      errors: { _form: ["Invalid user attempting to resubmit."] },
    };
  }
  
  const taskIndex = MOCK_TASKS.findIndex(task => task.id === taskId);
  if (taskIndex === -1) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }

  const taskToResubmit = MOCK_TASKS[taskIndex];

  if (taskToResubmit.assignerId !== userId) { 
     return {
      success: false,
      message: "Unauthorized: You can only resubmit tasks you created.",
      task: undefined,
      errors: { _form: ["Permission denied."] },
    };
  }

  if (taskToResubmit.status !== "Needs Changes") {
    return {
      success: false,
      message: "Task can only be resubmitted if it 'Needs Changes'.",
      task: undefined,
      errors: { _form: [`Current status: ${taskToResubmit.status}`] },
    };
  }

  const resubmittedTask: Task = {
    ...taskToResubmit,
    title,
    description,
    status: "Pending Approval" as TaskStatus,
    // attachments are not modified by this action (user would re-attach conceptually on client)
  };

  try {
    updateMockTask(resubmittedTask);
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: resubmittedTask,
      message: `Task "${resubmittedTask.title}" has been resubmitted for approval.`,
    };
  } catch (error) {
    console.error("Error resubmitting task:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      task: undefined,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Check Overdue Tasks and Simulate Notification Action ---
export interface CheckOverdueTasksActionState {
  success: boolean;
  message?: string;
  overdueTasksFound: number;
  notificationMessages: string[];
  errors?: { _form?: string[] };
}

export async function checkForOverdueTasksAction(
  prevState: CheckOverdueTasksActionState
): Promise<CheckOverdueTasksActionState> {
  const overdueTasksProcessed: string[] = [];
  let tasksFound = 0;

  try {
    const now = new Date();
    const overdueTasks = MOCK_TASKS.filter(task => 
      task.deadline && isPast(parseISO(task.deadline)) && 
      task.status !== "Completed" && task.status !== "Rejected"
    );

    tasksFound = overdueTasks.length;

    if (tasksFound === 0) {
      return {
        success: true,
        message: "No overdue tasks found.",
        overdueTasksFound: 0,
        notificationMessages: [],
      };
    }

    for (const task of overdueTasks) {
      const manager = MOCK_USERS.find(user => user.id === task.assignerId); 
      if (!manager || !manager.email) {
        overdueTasksProcessed.push(`Could not find manager email for task "${task.title}" (Assigner ID: ${task.assignerId}). Skipped notification.`);
        continue;
      }

      const input: NotifyOverdueTaskInput = {
        taskId: task.id,
        taskTitle: task.title,
        managerEmail: manager.email,
        ceoEmail: CEO_EMAIL,
        deadline: task.deadline,
      };
      
      const notificationResult = await notifyOverdueTask(input);
      overdueTasksProcessed.push(notificationResult.simulationMessage);
    }
    
    return {
      success: true,
      message: `${tasksFound} overdue task(s) processed. See details below.`,
      overdueTasksFound: tasksFound,
      notificationMessages: overdueTasksProcessed,
    };

  } catch (error) {
    console.error("Error checking for overdue tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: `Error processing overdue tasks: ${errorMessage}`,
      overdueTasksFound: tasksFound,
      notificationMessages: overdueTasksProcessed, 
      errors: { _form: [errorMessage] },
    };
  }
}
