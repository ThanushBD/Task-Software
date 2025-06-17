"use server";

import { optimizeTaskDeadline, OptimizeTaskDeadlineInput, OptimizeTaskDeadlineOutput } from "@/ai/flows/optimize-task-deadline";
import { parseTaskFromText, ParseTaskFromTextInput, ParseTaskFromTextOutput } from "@/ai/flows/parse-task-from-text-flow";
import { notifyOverdueTask } from "@/ai/flows/notify-overdue-task-flow";
import type { NotifyOverdueTaskInput, NotifyOverdueTaskOutput } from "@/ai/flows/notify-overdue-task-types";
import { z } from "zod";
import { CEO_EMAIL, NO_PRIORITY_SELECTED_VALUE } from "@/lib/constants";
import type { Task, TaskPriority, TaskStatus, User, TaskComment, ConceptualFileAttachment } from "@/types";
import { revalidatePath } from "next/cache";
import { format, isPast, parseISO } from "date-fns";
import { userAPI } from "@/lib/auth-api";
import { headers } from "next/headers";
import { createTask, updateTask, fetchTaskById, fetchTasks } from '@/lib/api';


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
  deadline: z.string()
    .min(1, "Deadline is required.")
    .transform((str) => {
      const date = new Date(str);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date format");
      }
      return date;
    }),
  priority: z.enum(["Low", "Medium", "High"] as [TaskPriority, ...TaskPriority[]]),
  assignedUserId: z.coerce.number({
    required_error: "Assignee is required.",
    invalid_type_error: "An employee must be assigned."
  }).min(1, "An employee must be assigned."),
  timerDuration: z.string({ required_error: "Timer duration is required." })
    .min(1, "Timer duration is required.")
    .refine(val => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, { message: "Timer duration must be a positive number." }),
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
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: "Validation failed. Please check all required task details.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { title, description, deadline, priority, assignedUserId, timerDuration } = validatedFields.data;

  const assignedUserIdNumber = Number(assignedUserId);
  if (isNaN(assignedUserIdNumber)) {
    return {
      success: false,
      message: "Invalid assigned user ID provided.",
      errors: { assignedUserId: ["Assigned user ID must be a number."] },
    };
  }

  console.log("adminCreateTaskAction: assignedUserId from form data:", assignedUserId);
  console.log("adminCreateTaskAction: Assigned user ID for lookup:", assignedUserIdNumber);

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const allUsers = await userAPI.getAllUsers(cookieHeader);
  const assignee = allUsers.find(user => Number(user.id) === assignedUserIdNumber);
  console.log("adminCreateTaskAction: found assignee:", assignee);

  if (!assignee) {
    return {
      success: false,
      message: "Assigned user not found.",
      errors: { assignedUserId: ["The selected user does not exist."] },
    };
  }

  const currentUser = await userAPI.verifySession(cookieHeader);
  if (!currentUser) {
    return {
      success: false,
      message: "Current user not found.",
      errors: { _form: ["You must be logged in to create a task."] },
    };
  }

  const newTask: Omit<Task, 'id'> = {
    title,
    description: description || null,
    status: "To Do" as TaskStatus,
    priority: priority as TaskPriority,
    deadline: deadline.toISOString(),
    progressPercentage: 0,
    projectId: null,
    recurringPattern: null,
    assignerId: Number(currentUser.id),
    assignedUserId: Number(assignee.id),
    updatedBy: Number(currentUser.id),
    suggestedPriority: null,
    suggestedDeadline: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    softDeletedAt: null,
    assignee: {
      id: Number(assignee.id),
      firstName: assignee.firstName || '',
      lastName: assignee.lastName || '',
    },
    assigner: {
      id: Number(currentUser.id),
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
    },
    timerDuration: Number(timerDuration),
    attachments: [],
    comments: [],
  };

  try {
    const createdTask = await createTask(newTask);
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: createdTask,
      message: `Task "${newTask.title}" created by ${currentUser.firstName} ${currentUser.lastName}, assigned to ${assignee.firstName} ${assignee.lastName}. Deadline: ${newTask.deadline ? format(newTask.deadline, "PPP") : 'N/A'}. Timer: ${newTask.timerDuration} min.`,
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

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const creatorUser = await userAPI.verifySession(cookieHeader);
  if (!creatorUser || String(creatorUser.id) !== creatorId) {
    return {
      success: false,
      message: "Unauthorized: Invalid user attempting to create task.",
      errors: { _form: ["Invalid user attempting to create task."] },
    };
  }
  
  let finalTaskPriority: TaskPriority = "Medium"; 
  let finalSuggestedPriorityAttribute: TaskPriority | null = null;

  if (rawSuggestedPriority && rawSuggestedPriority !== NO_PRIORITY_SELECTED_VALUE) {
    finalTaskPriority = rawSuggestedPriority as TaskPriority;
    finalSuggestedPriorityAttribute = rawSuggestedPriority as TaskPriority;
  }

  const newTask: Omit<Task, 'id'> = {
    title,
    description: description || null,
    status: "Pending Approval" as TaskStatus,
    deadline: suggestedDeadline ? new Date(suggestedDeadline).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    priority: finalTaskPriority,
    progressPercentage: 0,
    projectId: null,
    recurringPattern: null,
    assignedUserId: null, 
    updatedBy: null,
    assignee: undefined,
    assignerId: Number(creatorUser.id),
    assigner: {
      id: Number(creatorUser.id),
      firstName: creatorUser.name?.split(' ')[0] || '',
      lastName: creatorUser.name?.split(' ').slice(1).join(' ') || '',
    },
    timerDuration: 0,
    attachments: [],
    comments: [],
    suggestedDeadline: suggestedDeadline ? new Date(suggestedDeadline).toISOString() : null,
    suggestedPriority: finalSuggestedPriorityAttribute,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    softDeletedAt: null,
  };

  try {
    const createdTask = await createTask(newTask);
    revalidatePath("/");
    revalidatePath("/admin"); 

    return {
      success: true,
      task: createdTask,
      message: `Task "${newTask.title}" submitted for approval by ${creatorUser.name || creatorUser.email}.`,
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
const ApproveTaskFormSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  approverId: z.string().min(1, "Approver ID is required."),
  assignedUserId: z.string().optional().nullable(),
  priority: z.enum(["Low", "Medium", "High", NO_PRIORITY_SELECTED_VALUE] as const),
  deadline: z.coerce.date().nullable(),
  timerDuration: z.coerce.number()
    .refine(val => !isNaN(val) && val > 0, { message: "Timer duration must be a positive number." })
    .nullable(),
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

// Add a utility function for API error handling
function handleApiError(error: unknown): { message: string; details?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: error.stack
    };
  }
  return {
    message: 'An unexpected error occurred',
    details: String(error)
  };
}

export async function approveTaskAction(
  prevState: ApproveTaskActionState,
  formData: FormData
): Promise<ApproveTaskActionState> {
  const validatedFields = ApproveTaskFormSchema.safeParse({
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
      message: "Validation failed. Please check all required task details.",
    };
  }

  const { taskId, approverId, assignedUserId, priority, deadline, timerDuration } = validatedFields.data;

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const currentUser = await userAPI.verifySession(cookieHeader);

  if (!currentUser || currentUser.role !== 'Admin') {
    return {
      success: false,
      message: "Unauthorized: Only administrators can approve tasks.",
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const taskToUpdate = await fetchTaskById(taskId);
  if (!taskToUpdate) {
    return {
      success: false,
      message: "Task not found.",
      errors: { taskId: ["Invalid task selected for approval."] },
    };
  }

  const allUsers = await userAPI.getAllUsers(cookieHeader);
  const assignee = assignedUserId ? allUsers.find(user => String(user.id) === assignedUserId) : null;

  if (assignedUserId && !assignee) {
    return {
      success: false,
      message: "Assigned user not found.",
      errors: { assignedUserId: ["Invalid user selected for assignment."] },
    };
  }

  const updatedTask = await updateTask(taskId, {
    status: "In Progress" as TaskStatus,
    priority: priority as TaskPriority,
    deadline: deadline ? new Date(deadline).toISOString() : null,
    assignedUserId: assignee?.id ? Number(assignee.id) : null,
    updatedBy: Number(currentUser.id),
    updatedAt: new Date().toISOString(),
    timerDuration: Number(timerDuration),
  });

  try {
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: updatedTask,
      message: `Task "${updatedTask.title}" has been approved and assigned to ${assignee?.firstName} ${assignee?.lastName}.`,
    };
  } catch (error) {
    const { message, details } = handleApiError(error);
    console.error("Error approving task:", details);
    return {
      success: false,
      message,
      errors: { _form: [message] },
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

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const reviser = await userAPI.verifySession(cookieHeader);
  if (!reviser || reviser.role !== 'Admin' || String(reviser.id) !== reviserId) {
    return {
      success: false,
      message: "Unauthorized: Only administrators can request revisions.",
      task: undefined,
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const taskToRevise = await fetchTaskById(taskId);
  if (!taskToRevise) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }

  if (taskToRevise.status !== "Pending Approval") {
    return {
      success: false,
      message: "Task is not pending approval for revisions.",
      task: undefined,
      errors: { _form: [`This task has status "${taskToRevise.status}".`] },
    };
  }

  const newCommentEntry: TaskComment = {
    id: `comment-${Date.now()}`,
    content: comment,
    createdAt: new Date().toISOString(),
    user: {
      id: Number(reviser.id),
      firstName: reviser.firstName || '',
      lastName: reviser.lastName || '',
    },
  };

  const revisedTask = await updateTask(taskId, {
    status: "Needs Changes" as TaskStatus,
    comments: [...(taskToRevise.comments || []), newCommentEntry],
    updatedBy: Number(reviser.id),
    updatedAt: new Date().toISOString(),
  });

  try {
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: revisedTask,
      message: `Revisions requested for task "${revisedTask.title}".`,
    };
  } catch (error) {
    const { message, details } = handleApiError(error);
    console.error("Error requesting revisions:", details);
    return {
      success: false,
      message,
      errors: { _form: [message] },
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

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const rejecter = await userAPI.verifySession(cookieHeader);
  if (!rejecter || rejecter.role !== 'Admin' || String(rejecter.id) !== rejecterId) {
    return {
      success: false,
      message: "Unauthorized: Only administrators can reject tasks.",
      task: undefined,
      errors: { _form: ["You do not have permission to perform this action."] },
    };
  }

  const taskToReject = await fetchTaskById(taskId);
  if (!taskToReject) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }
  
  if (taskToReject.status !== "Pending Approval" && taskToReject.status !== "Needs Changes") {
     return {
      success: false,
      message: "Task cannot be rejected at its current status.",
      task: undefined,
      errors: { _form: [`This task has status "${taskToReject.status}".`] },
    };
  }

  const rejectedTask = await updateTask(taskId, {
    status: "Rejected" as TaskStatus,
    updatedBy: Number(rejecter.id),
    updatedAt: new Date().toISOString(),
  });

  try {
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: rejectedTask,
      message: `Task "${rejectedTask.title}" has been rejected.`,
    };
  } catch (error) {
    const { message, details } = handleApiError(error);
    console.error("Error rejecting task:", details);
    return {
      success: false,
      message,
      errors: { _form: [message] },
    };
  }
}


// --- Resubmit Task Action (for User) ---
const ResubmitTaskSchema = z.object({
  taskId: z.string().min(1, "Task ID is required."),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  userId: z.string().min(1, "User ID is required."),
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

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const user = await userAPI.verifySession(cookieHeader);
  if (!user || String(user.id) !== userId) {
    return {
      success: false,
      message: "User not found.",
      task: undefined,
      errors: { _form: ["Invalid user attempting to resubmit."] },
    };
  }

  const taskToResubmit = await fetchTaskById(taskId);
  if (!taskToResubmit) {
    return {
      success: false,
      message: "Task not found.",
      task: undefined,
      errors: { _form: ["The specified task does not exist."] },
    };
  }

  if (taskToResubmit.assignerId !== Number(user.id)) {
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

  const resubmittedTask = await updateTask(taskId, {
    title,
    description: description || null,
    status: "Pending Approval" as TaskStatus,
    updatedBy: Number(user.id),
    updatedAt: new Date().toISOString(),
  });

  try {
    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: resubmittedTask,
      message: `Task "${resubmittedTask.title}" has been resubmitted for approval.`,
    };
  } catch (error) {
    const { message, details } = handleApiError(error);
    console.error("Error resubmitting task:", details);
    return {
      success: false,
      message,
      errors: { _form: [message] },
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
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const allUsers = await userAPI.getAllUsers(cookieHeader);

    const allTasks = await fetchTasks({ status: "In Progress" });
    const overdueTasks = allTasks.tasks.filter(
      (task) => task.deadline && isPast(new Date(task.deadline))
    );

    const notificationMessages: string[] = [];
    let overdueTasksFound = 0;

    for (const task of overdueTasks) {
      const manager = allUsers.find(user => String(user.id) === String(task.assignerId));

      if (!manager || !manager.email) {
        notificationMessages.push(`Could not find manager email for task "${task.title}" (Assigner ID: ${task.assignerId}). Skipped notification.`);
        continue;
      }

      const overdueTaskInfo: NotifyOverdueTaskInput = {
        taskId: task.id,
        taskTitle: task.title,
        deadline: task.deadline!,
        managerEmail: manager.email,
        ceoEmail: CEO_EMAIL,
      };

      try {
        const result: NotifyOverdueTaskOutput = await notifyOverdueTask(overdueTaskInfo);
        notificationMessages.push(`Notification sent for overdue task "${task.title}": ${result.simulationMessage}`);
        overdueTasksFound++;
      } catch (error) {
        console.error(`Error notifying for overdue task "${task.title}":`, error);
        notificationMessages.push(`Failed to send notification for overdue task "${task.title}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      success: true,
      message: overdueTasksFound > 0 ? `Found and notified about ${overdueTasksFound} overdue tasks.` : "No overdue tasks found.",
      overdueTasksFound,
      notificationMessages,
    };
  } catch (error) {
    console.error("Error checking for overdue tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while checking for overdue tasks.";
    return {
      success: false,
      message: errorMessage,
      overdueTasksFound: 0,
      notificationMessages: [],
      errors: { _form: [errorMessage] },
    };
  }
}
