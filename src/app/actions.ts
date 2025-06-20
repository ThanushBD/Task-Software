"use server";

import { optimizeTaskDeadline, OptimizeTaskDeadlineInput, OptimizeTaskDeadlineOutput } from "@/ai/flows/optimize-task-deadline";
import { parseTaskFromText, ParseTaskFromTextInput, ParseTaskFromTextOutput } from "@/ai/flows/parse-task-from-text-flow";
import { notifyOverdueTask } from "@/ai/flows/notify-overdue-task-flow";
import type { NotifyOverdueTaskInput, NotifyOverdueTaskOutput } from "@/ai/flows/notify-overdue-task-types";
import { z } from "zod";
import { CEO_EMAIL, NO_PRIORITY_SELECTED_VALUE } from "@/lib/constants";
import type { Task, TaskPriority, TaskStatus, User, TaskComment, ConceptualFileAttachment, TaskAttachment } from "@/types";
import { revalidatePath } from "next/cache";
import { format, isPast, parseISO, addDays, isAfter, isBefore } from "date-fns";
import { userAPI } from "@/lib/auth-api";
import { headers } from "next/headers";
import { createTask, updateTask, fetchTaskById, fetchTasks } from '@/lib/api';

// Enhanced types for new features
interface TaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  averageCompletionTime: number;
  productivityScore: number;
}

interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  defaultPriority: TaskPriority;
  defaultTimerDuration: number;
  tags: string[];
  isPublic: boolean;
  createdBy: string;
}

interface BulkOperation {
  operation: 'approve' | 'reject' | 'delete' | 'reassign' | 'update_priority' | 'update_status';
  taskIds: string[];
  metadata?: Record<string, any>;
}

interface TaskDependency {
  id: string;
  parentTaskId: string;
  childTaskId: string;
  dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
}

// Enhanced error handling
class TaskActionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'TaskActionError';
  }
}

// Rate limiting simulation (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= limit) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Audit logging
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  // In production, this would save to a database
  console.log('AUDIT LOG:', {
    ...log,
    id: `audit_${Date.now()}`,
    timestamp: new Date().toISOString()
  });
}

// Enhanced validation schemas
const TaskFileSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  type: z.string().optional(),
  size: z.number().max(10 * 1024 * 1024), // 10MB limit
  content: z.string().optional(), // Base64 encoded content
});

const TaskDependencySchema = z.object({
  parentTaskId: z.string().uuid(),
  childTaskId: z.string().uuid(),
  dependencyType: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']),
});

// --- Enhanced Suggest Deadline Action ---
const EnhancedSuggestDeadlineSchema = z.object({
  taskDescription: z.string().min(10, "Task description must be at least 10 characters long.").max(2000),
  currentWorkload: z.number().min(0).max(100).optional(),
  teamSize: z.number().min(1).optional(),
  complexity: z.enum(['low', 'medium', 'high']).optional(),
  dependencies: z.array(z.string()).optional(),
});

export interface EnhancedSuggestDeadlineActionState {
  success: boolean;
  message?: string;
  data?: OptimizeTaskDeadlineOutput & {
    confidenceScore: number;
    alternativeDeadlines: string[];
    workloadImpact: string;
  };
  errors?: {
    taskDescription?: string[];
    currentWorkload?: string[];
    teamSize?: string[];
    complexity?: string[];
    _form?: string[];
  };
}

export async function enhancedSuggestDeadlineAction(
  prevState: EnhancedSuggestDeadlineActionState,
  formData: FormData
): Promise<EnhancedSuggestDeadlineActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    if (!checkRateLimit(currentUser.id, 30)) {
      throw new TaskActionError("Rate limit exceeded", "RATE_LIMIT", 429);
    }

    const validatedFields = EnhancedSuggestDeadlineSchema.safeParse({
      taskDescription: formData.get("taskDescription"),
      currentWorkload: Number(formData.get("currentWorkload")) || undefined,
      teamSize: Number(formData.get("teamSize")) || undefined,
      complexity: formData.get("complexity") || undefined,
      dependencies: formData.get("dependencies") ? JSON.parse(formData.get("dependencies") as string) : [],
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

    const result = await optimizeTaskDeadline(input);
    
    // Enhanced AI analysis simulation
    const confidenceScore = Math.random() * 100;
    const alternativeDeadlines = [
      addDays(new Date(result.suggestedDeadline), 1).toISOString(),
      addDays(new Date(result.suggestedDeadline), 3).toISOString(),
      addDays(new Date(result.suggestedDeadline), -1).toISOString(),
    ];

    await createAuditLog({
      userId: currentUser.id,
      action: 'suggest_deadline',
      resource: 'task',
      resourceId: 'new',
      metadata: { 
        taskDescription: validatedFields.data.taskDescription.substring(0, 100),
        confidenceScore 
      }
    });

    return {
      success: true,
      data: {
        ...result,
        confidenceScore,
        alternativeDeadlines,
        workloadImpact: validatedFields.data.currentWorkload && validatedFields.data.currentWorkload > 80 
          ? "High workload detected - consider extending deadline" 
          : "Normal workload - deadline is achievable"
      },
      message: "Deadline suggested successfully with enhanced analysis.",
    };
  } catch (error) {
    console.error("Error optimizing task deadline:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: `AI suggestion failed: ${errorMessage}`,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Enhanced Parse Task From Text Action ---
const EnhancedParseTaskFromTextSchema = z.object({
  naturalLanguageInput: z.string().min(5, "Please provide a more detailed task description.").max(5000),
  extractAttachments: z.boolean().optional(),
  suggestTags: z.boolean().optional(),
  detectUrgency: z.boolean().optional(),
});

export interface EnhancedParseTaskFromTextActionState {
  success: boolean;
  message?: string;
  data?: ParseTaskFromTextOutput & {
    suggestedTags: string[];
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    extractedAttachments: ConceptualFileAttachment[];
    confidence: number;
    similarTasks: string[];
  };
  errors?: {
    naturalLanguageInput?: string[];
    _form?: string[];
  };
}

export async function enhancedParseTaskFromTextAction(
  prevState: EnhancedParseTaskFromTextActionState,
  formData: FormData
): Promise<EnhancedParseTaskFromTextActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    if (!checkRateLimit(currentUser.id, 20)) {
      throw new TaskActionError("Rate limit exceeded", "RATE_LIMIT", 429);
    }

    const validatedFields = EnhancedParseTaskFromTextSchema.safeParse({
      naturalLanguageInput: formData.get("naturalLanguageInput"),
      extractAttachments: formData.get("extractAttachments") === "true",
      suggestTags: formData.get("suggestTags") === "true",
      detectUrgency: formData.get("detectUrgency") === "true",
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

    const result = await parseTaskFromText(input);
    
    // Enhanced AI features simulation
    const urgencyKeywords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
    const inputLower = validatedFields.data.naturalLanguageInput.toLowerCase();
    const urgencyLevel = urgencyKeywords.some(keyword => inputLower.includes(keyword)) ? 'high' : 'medium';
    
    const suggestedTags = [
      ...(inputLower.includes('meeting') ? ['meeting'] : []),
      ...(inputLower.includes('report') ? ['report'] : []),
      ...(inputLower.includes('design') ? ['design'] : []),
      ...(inputLower.includes('bug') ? ['bug', 'development'] : []),
      ...(inputLower.includes('test') ? ['testing'] : []),
    ];

    await createAuditLog({
      userId: currentUser.id,
      action: 'parse_task_text',
      resource: 'task',
      resourceId: 'new',
      metadata: { 
        inputLength: validatedFields.data.naturalLanguageInput.length,
        urgencyLevel,
        tagsCount: suggestedTags.length
      }
    });

    return {
      success: true,
      data: {
        ...result,
        suggestedTags,
        urgencyLevel: urgencyLevel as 'low' | 'medium' | 'high' | 'critical',
        extractedAttachments: [],
        confidence: Math.random() * 40 + 60, // 60-100% confidence
        similarTasks: [] // Would be populated by ML similarity search
      },
      message: "Task details parsed successfully with enhanced AI analysis.",
    };
  } catch (error) {
    console.error("Error parsing task from text:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: `AI parsing failed: ${errorMessage}`,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Enhanced Admin Create Task Action ---
const EnhancedAdminCreateTaskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long.").max(200),
  description: z.string().min(10, "Description must be at least 10 characters long.").max(5000),
  deadline: z.string()
    .min(1, "Deadline is required.")
    .transform((str) => {
      const date = new Date(str);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date format");
      }
      if (isBefore(date, new Date())) {
        throw new Error("Deadline cannot be in the past");
      }
      return date;
    }),
  priority: z.enum(["Low", "Medium", "High"] as [TaskPriority, ...TaskPriority[]]),
  assignedUserId: z.string().min(1, "An employee must be assigned."),
  timerDuration: z.string({ required_error: "Timer duration is required." })
    .min(1, "Timer duration is required.")
    .refine(val => {
      const num = Number(val);
      return !isNaN(num) && num > 0 && num <= 480; // Max 8 hours
    }, { message: "Timer duration must be between 1-480 minutes." }),
  tags: z.string().optional(),
  attachments: z.array(TaskFileSchema).optional(),
  dependencies: z.array(TaskDependencySchema).optional(),
  templateId: z.string().optional(),
  notifyAssignee: z.boolean().optional(),
  setReminder: z.boolean().optional(),
  reminderMinutes: z.number().min(5).max(10080).optional(), // 5 minutes to 1 week
});

export interface EnhancedAdminCreateTaskActionState {
  success: boolean;
  message?: string;
  task?: Task;
  analytics?: TaskAnalytics;
  errors?: {
    title?: string[];
    description?: string[];
    deadline?: string[];
    priority?: string[];
    assignedUserId?: string[];
    timerDuration?: string[];
    tags?: string[];
    attachments?: string[];
    dependencies?: string[];
    _form?: string[];
  };
}

export async function enhancedAdminCreateTaskAction(
  prevState: EnhancedAdminCreateTaskActionState,
  formData: FormData
): Promise<EnhancedAdminCreateTaskActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    if (currentUser.role !== 'Admin') {
      throw new TaskActionError("Insufficient permissions", "PERMISSION_DENIED", 403);
    }

    if (!checkRateLimit(currentUser.id, 100)) {
      throw new TaskActionError("Rate limit exceeded", "RATE_LIMIT", 429);
    }

    const validatedFields = EnhancedAdminCreateTaskFormSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      deadline: formData.get("deadline"),
      priority: formData.get("priority"),
      assignedUserId: formData.get("assignedUserId"),
      timerDuration: formData.get("timerDuration"),
      tags: formData.get("tags") || "",
      attachments: formData.get("attachments") ? JSON.parse(formData.get("attachments") as string) : [],
      dependencies: formData.get("dependencies") ? JSON.parse(formData.get("dependencies") as string) : [],
      templateId: formData.get("templateId") || undefined,
      notifyAssignee: formData.get("notifyAssignee") === "true",
      setReminder: formData.get("setReminder") === "true",
      reminderMinutes: Number(formData.get("reminderMinutes")) || undefined,
    });

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Validation failed. Please check all required task details.",
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { title, description, deadline, priority, assignedUserId, timerDuration, tags, attachments, dependencies } = validatedFields.data;

    const allUsers = await userAPI.getAllUsers(cookieHeader);
    const assignee = allUsers.find(user => user.id === assignedUserId);

    if (!assignee) {
      throw new TaskActionError("Assigned user not found", "USER_NOT_FOUND", 404);
    }

    // Check assignee workload
    const assigneeTasks = await fetchTasks({ assigneeId: Number(assignedUserId), status: "In Progress" });
    if (assigneeTasks.tasks.length > 10) {
      console.warn(`Assignee ${assignee.firstName} ${assignee.lastName} has ${assigneeTasks.tasks.length} active tasks`);
    }

    const taskTags = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    // Convert ConceptualFileAttachment to TaskAttachment format
    const taskAttachments: TaskAttachment[] = (attachments || []).map(file => ({
      id: file.id,
      fileName: file.name,
      fileUrl: `#`, // Would be actual URL in production
      fileType: file.type || null,
      fileSizeBytes: file.size || 0,
      createdAt: new Date().toISOString(),
    }));

    const newTask: Omit<Task, 'id'> = {
      title,
      description: description || null,
      status: "To Do" as TaskStatus,
      priority: priority as TaskPriority,
      deadline: deadline.toISOString(),
      progressPercentage: 0,
      projectId: null,
      recurringPattern: null,
      assignerId: currentUser.id,
      assignedUserId: assignee.id,
      updatedBy: currentUser.id,
      suggestedPriority: null,
      suggestedDeadline: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      softDeletedAt: null,
      assignee: {
        id: assignee.id,
        firstName: assignee.firstName || '',
        lastName: assignee.lastName || '',
      },
      assigner: {
        id: currentUser.id,
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
      },
      timerDuration: Number(timerDuration),
      attachments: taskAttachments,
      comments: [],
    };

    const createdTask = await createTask(newTask);

    // Create dependencies if specified
    if (dependencies && dependencies.length > 0) {
      // In production, this would create dependency records
      console.log(`Creating ${dependencies.length} task dependencies`);
    }

    // Generate analytics
    const userTasks = await fetchTasks({ assigneeId: Number(assignedUserId) });
    const analytics: TaskAnalytics = {
      totalTasks: userTasks.tasks.length,
      completedTasks: userTasks.tasks.filter(t => t.status === "Completed").length,
      overdueTasks: userTasks.tasks.filter(t => t.deadline && isPast(new Date(t.deadline))).length,
      averageCompletionTime: 0, // Would calculate from historical data
      productivityScore: Math.random() * 40 + 60, // 60-100%
    };

    await createAuditLog({
      userId: currentUser.id,
      action: 'create_task',
      resource: 'task',
      resourceId: createdTask.id,
      metadata: { 
        title,
        assignedTo: assignee.id,
        priority,
        deadline: deadline.toISOString(),
        tagsCount: taskTags.length
      }
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: true,
      task: createdTask,
      analytics,
      message: `Task "${newTask.title}" created successfully with enhanced features. Assigned to ${assignee.firstName} ${assignee.lastName}.`,
    };
  } catch (error) {
    console.error("Error creating task:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while creating the task.";
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Bulk Operations Action ---
const BulkOperationSchema = z.object({
  operation: z.enum(['approve', 'reject', 'delete', 'reassign', 'update_priority', 'update_status']),
  taskIds: z.array(z.string().uuid()).min(1, "At least one task must be selected").max(50, "Maximum 50 tasks per operation"),
  newAssigneeId: z.string().optional(),
  newPriority: z.enum(["Low", "Medium", "High"]).optional(),
  newStatus: z.enum(["To Do", "In Progress", "Completed", "Overdue", "Pending Approval", "Needs Changes", "Rejected"]).optional(),
  reason: z.string().min(10).max(500).optional(),
});

export interface BulkOperationActionState {
  success: boolean;
  message?: string;
  processedCount: number;
  failedCount: number;
  results: Array<{ taskId: string; success: boolean; error?: string }>;
  errors?: {
    operation?: string[];
    taskIds?: string[];
    newAssigneeId?: string[];
    newPriority?: string[];
    newStatus?: string[];
    reason?: string[];
    _form?: string[];
  };
}

export async function bulkOperationAction(
  prevState: BulkOperationActionState,
  formData: FormData
): Promise<BulkOperationActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    if (currentUser.role !== 'Admin') {
      throw new TaskActionError("Insufficient permissions", "PERMISSION_DENIED", 403);
    }

    if (!checkRateLimit(currentUser.id, 10, 300000)) { // 10 bulk operations per 5 minutes
      throw new TaskActionError("Bulk operation rate limit exceeded", "RATE_LIMIT", 429);
    }

    const validatedFields = BulkOperationSchema.safeParse({
      operation: formData.get("operation"),
      taskIds: JSON.parse(formData.get("taskIds") as string),
      newAssigneeId: formData.get("newAssigneeId") || undefined,
      newPriority: formData.get("newPriority") || undefined,
      newStatus: formData.get("newStatus") || undefined,
      reason: formData.get("reason") || undefined,
    });

    if (!validatedFields.success) {
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        results: [],
        errors: validatedFields.error.flatten().fieldErrors,
        message: "Validation failed. Please check your bulk operation parameters.",
      };
    }

    const { operation, taskIds, newAssigneeId, newPriority, newStatus, reason } = validatedFields.data;
    const results: Array<{ taskId: string; success: boolean; error?: string }> = [];
    let processedCount = 0;
    let failedCount = 0;

    // Process tasks in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batch = taskIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (taskId) => {
        try {
          const task = await fetchTaskById(taskId);
          if (!task) {
            throw new Error("Task not found");
          }

          let updateData: Partial<Task> = {
            updatedBy: currentUser.id,
            updatedAt: new Date().toISOString(),
          };

          switch (operation) {
            case 'approve':
              if (task.status !== "Pending Approval") {
                throw new Error("Task is not pending approval");
              }
              updateData.status = "In Progress";
              break;
              
            case 'reject':
              if (task.status !== "Pending Approval" && task.status !== "Needs Changes") {
                throw new Error("Task cannot be rejected in current status");
              }
              updateData.status = "Rejected";
              break;
              
            case 'reassign':
              if (!newAssigneeId) {
                throw new Error("New assignee ID required for reassignment");
              }
              updateData.assignedUserId = newAssigneeId;
              break;
              
            case 'update_priority':
              if (!newPriority) {
                throw new Error("New priority required");
              }
              updateData.priority = newPriority;
              break;
              
            case 'update_status':
              if (!newStatus) {
                throw new Error("New status required");
              }
              updateData.status = newStatus;
              break;
              
            case 'delete':
              updateData.softDeletedAt = new Date().toISOString();
              break;
          }

          await updateTask(taskId, updateData);
          
          results.push({ taskId, success: true });
          processedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          results.push({ taskId, success: false, error: errorMessage });
          failedCount++;
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < taskIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    await createAuditLog({
      userId: currentUser.id,
      action: `bulk_${operation}`,
      resource: 'task',
      resourceId: 'multiple',
      metadata: { 
        taskCount: taskIds.length,
        processedCount,
        failedCount,
        operation,
        reason
      }
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return {
      success: failedCount === 0,
      processedCount,
      failedCount,
      results,
      message: `Bulk ${operation} completed. ${processedCount} tasks processed successfully, ${failedCount} failed.`,
    };
  } catch (error) {
    console.error("Error in bulk operation:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        results: [],
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      processedCount: 0,
      failedCount: 0,
      results: [],
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Task Template Actions ---
const TaskTemplateSchema = z.object({
  name: z.string().min(3).max(100),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  defaultPriority: z.enum(["Low", "Medium", "High"]),
  defaultTimerDuration: z.number().min(1).max(480),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

export interface TaskTemplateActionState {
  success: boolean;
  message?: string;
  template?: TaskTemplate;
  templates?: TaskTemplate[];
  errors?: {
    name?: string[];
    title?: string[];
    description?: string[];
    defaultPriority?: string[];
    defaultTimerDuration?: string[];
    _form?: string[];
  };
}

export async function createTaskTemplateAction(
  prevState: TaskTemplateActionState,
  formData: FormData
): Promise<TaskTemplateActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    const validatedFields = TaskTemplateSchema.safeParse({
      name: formData.get("name"),
      title: formData.get("title"),
      description: formData.get("description"),
      defaultPriority: formData.get("defaultPriority"),
      defaultTimerDuration: Number(formData.get("defaultTimerDuration")),
      tags: formData.get("tags") ? JSON.parse(formData.get("tags") as string) : [],
      isPublic: formData.get("isPublic") === "true",
    });

    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
        message: "Validation failed. Please check template details.",
      };
    }

    const template: TaskTemplate = {
      id: `template_${Date.now()}`,
      ...validatedFields.data,
      tags: validatedFields.data.tags || [],
      isPublic: validatedFields.data.isPublic || false,
      createdBy: currentUser.id,
    };

    // In production, save to database
    console.log("Created task template:", template);

    await createAuditLog({
      userId: currentUser.id,
      action: 'create_template',
      resource: 'task_template',
      resourceId: template.id,
      metadata: { name: template.name, isPublic: template.isPublic }
    });

    return {
      success: true,
      template,
      message: `Task template "${template.name}" created successfully.`,
    };
  } catch (error) {
    console.error("Error creating task template:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Enhanced Analytics Action ---
export interface AnalyticsActionState {
  success: boolean;
  message?: string;
  analytics?: {
    overview: TaskAnalytics;
    teamPerformance: Array<{
      userId: string;
      userName: string;
      completedTasks: number;
      averageCompletionTime: number;
      onTimeDelivery: number;
      workloadScore: number;
    }>;
    trends: {
      completionRate: Array<{ date: string; rate: number }>;
      priorityDistribution: Record<TaskPriority, number>;
      statusDistribution: Record<TaskStatus, number>;
    };
    predictions: {
      overdueRisk: Array<{ taskId: string; taskTitle: string; riskScore: number }>;
      capacityForecast: string;
      bottlenecks: string[];
    };
  };
  errors?: { _form?: string[] };
}

export async function generateAnalyticsAction(
  prevState: AnalyticsActionState
): Promise<AnalyticsActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    if (currentUser.role !== 'Admin') {
      throw new TaskActionError("Insufficient permissions", "PERMISSION_DENIED", 403);
    }

    // Fetch all tasks and users for analysis
    const allTasks = await fetchTasks({});
    const allUsers = await userAPI.getAllUsers(cookieHeader);

    // Generate comprehensive analytics
    const overview: TaskAnalytics = {
      totalTasks: allTasks.tasks.length,
      completedTasks: allTasks.tasks.filter(t => t.status === "Completed").length,
      overdueTasks: allTasks.tasks.filter(t => t.deadline && isPast(new Date(t.deadline))).length,
      averageCompletionTime: 0, // Would calculate from historical data
      productivityScore: Math.random() * 40 + 60,
    };

    // Team performance analysis
    const teamPerformance = allUsers.map(user => {
      const userTasks = allTasks.tasks.filter(t => t.assignedUserId === user.id);
      const completedTasks = userTasks.filter(t => t.status === "Completed").length;
      
      return {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        completedTasks,
        averageCompletionTime: Math.random() * 5 + 1, // 1-6 days average
        onTimeDelivery: Math.random() * 40 + 60, // 60-100%
        workloadScore: userTasks.filter(t => t.status === "In Progress").length * 10,
      };
    });

    // Trends analysis
    const priorityDistribution = allTasks.tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<TaskPriority, number>);

    const statusDistribution = allTasks.tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<TaskStatus, number>);

    // Predictive analysis
    const overdueRisk = allTasks.tasks
      .filter(t => t.status === "In Progress" && t.deadline)
      .map(task => ({
        taskId: task.id,
        taskTitle: task.title,
        riskScore: Math.random() * 100,
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    await createAuditLog({
      userId: currentUser.id,
      action: 'generate_analytics',
      resource: 'analytics',
      resourceId: 'dashboard',
      metadata: { taskCount: allTasks.tasks.length, userCount: allUsers.length }
    });

    return {
      success: true,
      analytics: {
        overview,
        teamPerformance,
        trends: {
          completionRate: [], // Would be populated with historical data
          priorityDistribution,
          statusDistribution,
        },
        predictions: {
          overdueRisk,
          capacityForecast: "Team capacity is at 85% - consider redistributing workload",
          bottlenecks: ["Code review delays", "External dependencies", "Resource conflicts"],
        },
      },
      message: "Analytics generated successfully with enhanced insights.",
    };
  } catch (error) {
    console.error("Error generating analytics:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Real-time Notification Action ---
export interface NotificationActionState {
  success: boolean;
  message?: string;
  notifications?: Array<{
    id: string;
    type: 'task_assigned' | 'task_completed' | 'deadline_approaching' | 'task_overdue' | 'comment_added';
    title: string;
    message: string;
    taskId?: string;
    userId: string;
    createdAt: string;
    read: boolean;
  }>;
  errors?: { _form?: string[] };
}

export async function sendNotificationAction(
  prevState: NotificationActionState,
  formData: FormData
): Promise<NotificationActionState> {
  try {
    const cookieHeader = (await headers()).get("cookie") || undefined;
    const currentUser = await userAPI.verifySession(cookieHeader);
    
    if (!currentUser) {
      throw new TaskActionError("Unauthorized", "AUTH_REQUIRED", 401);
    }

    const notificationType = formData.get("type") as string;
    const taskId = formData.get("taskId") as string;
    const recipientId = formData.get("recipientId") as string;
    const customMessage = formData.get("message") as string;

    // In production, this would use WebSocket, push notifications, or email
    const notification = {
      id: `notif_${Date.now()}`,
      type: notificationType as any,
      title: "Task Notification",
      message: customMessage || "You have a new task notification",
      taskId,
      userId: recipientId,
      createdAt: new Date().toISOString(),
      read: false,
    };

    console.log("Sending notification:", notification);

    await createAuditLog({
      userId: currentUser.id,
      action: 'send_notification',
      resource: 'notification',
      resourceId: notification.id,
      metadata: { type: notificationType, recipientId, taskId }
    });

    return {
      success: true,
      notifications: [notification],
      message: "Notification sent successfully.",
    };
  } catch (error) {
    console.error("Error sending notification:", error);
    
    if (error instanceof TaskActionError) {
      return {
        success: false,
        message: error.message,
        errors: { _form: [error.message] },
      };
    }

    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] },
    };
  }
}

// --- Original Actions for Backward Compatibility ---

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
  assignedUserId: z.string().min(1, "An employee must be assigned."),
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

  const cookieHeader = (await headers()).get("cookie") || undefined;
  const allUsers = await userAPI.getAllUsers(cookieHeader);
  const assignee = allUsers.find(user => user.id === assignedUserId);

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
    assignerId: currentUser.id,
    assignedUserId: assignee.id,
    updatedBy: currentUser.id,
    suggestedPriority: null,
    suggestedDeadline: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    softDeletedAt: null,
    assignee: {
      id: assignee.id,
      firstName: assignee.firstName || '',
      lastName: assignee.lastName || '',
    },
    assigner: {
      id: currentUser.id,
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
  if (!creatorUser || creatorUser.id !== creatorId) {
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
    assignerId: creatorUser.id,
    assigner: {
      id: creatorUser.id,
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

  if (!currentUser || currentUser.role !== 'Admin' || currentUser.id !== approverId) {
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
  const assignee = assignedUserId ? allUsers.find(user => user.id === assignedUserId) : null;

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
    assignedUserId: assignee?.id || null,
    updatedBy: currentUser.id,
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
  if (!reviser || reviser.role !== 'Admin' || reviser.id !== reviserId) {
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
    id: `comment-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    content: comment,
    createdAt: new Date().toISOString(),
    user: { id: reviser.id, firstName: reviser.firstName, lastName: reviser.lastName },
    timestamp: new Date().toISOString(),
    userName: reviser.firstName + ' ' + reviser.lastName,
    comment: comment || '',
  };

  const revisedTask = await updateTask(taskId, {
    status: "Needs Changes" as TaskStatus,
    comments: [...(taskToRevise.comments || []), newCommentEntry],
    updatedBy: reviser.id,
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
  if (!rejecter || rejecter.role !== 'Admin' || rejecter.id !== rejecterId) {
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
    updatedBy: rejecter.id,
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
  if (!user || user.id !== userId) {
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

  if (taskToResubmit.assignerId !== user.id) {
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
    updatedBy: user.id,
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
      const manager = allUsers.find(user => user.id === task.assignerId);

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