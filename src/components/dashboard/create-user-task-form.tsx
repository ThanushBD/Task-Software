// src/components/dashboard/create-user-task-form.tsx
"use client";

import React, { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { useFormStatus } from "react-dom";
import { createUserTaskAction } from "@/app/actions";
import type { TaskPriority, User } from '@/types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  AlertCircle, 
  Target, 
  Calendar as CalendarIcon,
  Clock,
  Zap,
  FileText,
  CheckCircle2,
  Sparkles,
  Users,
  User as UserIcon
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTasks } from "@/contexts/TaskContext";
import { useAuth } from "@/contexts/auth-context";

// Define the predefined task type properly
type PredefinedTaskType = {
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly estimatedDays: number;
};

// Predefined task templates - properly typed as an array
const predefinedTasks: readonly PredefinedTaskType[] = [
  {
    title: "Fix Login Bug",
    description: "Users are experiencing issues logging into the application. Need to investigate and resolve the authentication problem.",
    priority: "High" as TaskPriority,
    estimatedDays: 2,
  },
  {
    title: "Implement Feature Request",
    description: "Add new functionality based on user feedback and requirements. Include proper testing and documentation.",
    priority: "Medium" as TaskPriority,
    estimatedDays: 7,
  },
  {
    title: "Database Optimization",
    description: "Optimize database queries and improve performance. Analyze slow queries and implement necessary indexes.",
    priority: "Medium" as TaskPriority,
    estimatedDays: 3,
  },
  {
    title: "Security Audit",
    description: "Conduct comprehensive security review of the application. Check for vulnerabilities and implement security improvements.",
    priority: "High" as TaskPriority,
    estimatedDays: 5,
  },
  {
    title: "UI/UX Improvements",
    description: "Enhance user interface and user experience based on user feedback and usability testing results.",
    priority: "Low" as TaskPriority,
    estimatedDays: 4,
  },
] as const;

const SubmitButton = memo(() => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
          Creating Task...
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" /> 
          Create Task
        </>
      )}
    </Button>
  );
});

SubmitButton.displayName = "SubmitButton";

interface CreateUserTaskFormProps {
  users: User[];
  onTaskCreated?: () => void;
}

export const CreateUserTaskForm = memo(({ users, onTaskCreated }: CreateUserTaskFormProps) => {
  interface CreateUserTaskActionState {
    success: boolean;
    task?: any; // Replace 'any' with the actual task type if available
    message?: string;
    errors?: Record<string, string[]>;
  }

  const initialState: CreateUserTaskActionState = { success: false, task: undefined };
  const [state, formAction] = React.useActionState(createUserTaskAction, initialState);
  const { toast } = useToast();
  const { addTask } = useTasks();
  const { currentUser } = useAuth();

  // Form state
  const [selectedPredefined, setSelectedPredefined] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [timerDuration, setTimerDuration] = useState<number>(0);

  // Handle predefined task selection - fix the type issue here
  const handlePredefinedSelection = useCallback((taskTitle: string) => {
    if (!taskTitle) {
      setSelectedPredefined("");
      return;
    }
    
    // Find the selected task by title - this fixes the type error
    const selectedTask = predefinedTasks.find(task => task.title === taskTitle);
    
    if (selectedTask) {
      setSelectedPredefined(taskTitle);
      setTitle(selectedTask.title);
      setDescription(selectedTask.description);
      setPriority(selectedTask.priority);
      
      // Set estimated deadline based on estimated days
      const estimatedDeadline = new Date();
      estimatedDeadline.setDate(estimatedDeadline.getDate() + selectedTask.estimatedDays);
      setDeadline(estimatedDeadline);
      
      // Set estimated timer duration (assume 8 hours per day)
      setTimerDuration(selectedTask.estimatedDays * 8 * 60); // minutes
    }
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setSelectedPredefined("");
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setAssigneeId("");
    setDeadline(undefined);
    setTimerDuration(0);
  }, []);

  // Handle form submission result
  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Task Created Successfully! 🎉" : "Task Creation Failed",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      
      if (state.success && state.task) {
        addTask(state.task);
        resetForm();
        onTaskCreated?.();
      }
    }
  }, [state, toast, addTask, resetForm, onTaskCreated]);

  // Available users for assignment
  const availableUsers = useMemo(() => 
    users.filter(user => user.id !== currentUser?.id),
    [users, currentUser?.id]
  );

  const isFormValid = useMemo(() => 
    title.trim().length > 0 && 
    description.trim().length > 0 && 
    assigneeId.length > 0,
    [title, description, assigneeId]
  );

  const priorityColors = {
    Low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    Medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    High: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-primary" />
          Create New Task
        </CardTitle>
        <CardDescription>
          Create and assign tasks to team members with detailed specifications
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Templates */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" />
            Quick Templates
          </Label>
          <Select value={selectedPredefined} onValueChange={handlePredefinedSelection}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a template to get started quickly..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Custom Task</SelectItem>
              {predefinedTasks.map((task) => (
                <SelectItem key={task.title} value={task.title}>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        priorityColors[task.priority].bg,
                        priorityColors[task.priority].text
                      )}
                    >
                      {task.priority}
                    </Badge>
                    <span>{task.title}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Main Form */}
        <form action={formAction} className="space-y-6">
          {/* Hidden Fields */}
          <input type="hidden" name="assignerId" value={currentUser?.id || ""} />

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Task Title *
            </Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a clear, descriptive task title..."
              required
              className={cn(state.errors?.title && "border-destructive")}
              maxLength={100}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Be specific and actionable</span>
              <span>{title.length}/100</span>
            </div>
            {state.errors?.title && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {state.errors.title.join(", ")}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description *
            </Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed requirements, acceptance criteria, and any relevant context..."
              rows={5}
              required
              className={cn("resize-none", state.errors?.description && "border-destructive")}
              maxLength={1000}
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Include requirements, context, and acceptance criteria</span>
              <span>{description.length}/1000</span>
            </div>
            {state.errors?.description && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {state.errors.description.join(", ")}
              </p>
            )}
          </div>

          {/* Priority & Assignee Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Priority *
              </Label>
              <Select name="priority" value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                <SelectTrigger className={cn(state.errors?.priority && "border-destructive")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Low", "Medium", "High"] as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          p === "Low" && "bg-green-500",
                          p === "Medium" && "bg-yellow-500",
                          p === "High" && "bg-red-500"
                        )} />
                        {p} Priority
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.priority && (
                <p className="text-sm text-destructive">{state.errors.priority.join(", ")}</p>
              )}
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assign To *
              </Label>
              <Select name="assignedUserId" value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className={cn(state.errors?.assignedUserId && "border-destructive")}>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        {user.firstName} {user.lastName}
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.assignedUserId && (
                <p className="text-sm text-destructive">{state.errors.assignedUserId.join(", ")}</p>
              )}
            </div>
          </div>

          {/* Deadline & Timer Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deadline */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Deadline
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Set deadline (optional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <input 
                type="hidden" 
                name="deadline" 
                value={deadline ? deadline.toISOString() : ""} 
              />
            </div>

            {/* Timer Duration */}
            <div className="space-y-2">
              <Label htmlFor="timerDuration" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Estimated Time (minutes)
              </Label>
              <Input
                id="timerDuration"
                name="timerDuration"
                type="number"
                min="0"
                step="15"
                value={timerDuration}
                onChange={(e) => setTimerDuration(Number(e.target.value))}
                placeholder="e.g., 120 for 2 hours"
              />
              {timerDuration > 0 && (
                <p className="text-xs text-muted-foreground">
                  Estimated: {Math.floor(timerDuration / 60)}h {timerDuration % 60}m
                </p>
              )}
            </div>
          </div>

          {/* Form Validation Alert */}
          {!isFormValid && (title || description || assigneeId) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Required Fields Missing</AlertTitle>
              <AlertDescription>
                Please fill in all required fields: title, description, and assignee.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Errors */}
          {state.errors?._form && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Task Creation Failed</AlertTitle>
              <AlertDescription>{state.errors._form.join(", ")}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <SubmitButton />
          </div>
        </form>

        {/* Task Preview */}
        {(title || description) && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Task Preview
              </Label>
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  {title && (
                    <div>
                      <h4 className="font-semibold text-sm">{title}</h4>
                    </div>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Badge 
                      variant="outline" 
                      className={cn(priorityColors[priority].bg, priorityColors[priority].text)}
                    >
                      {priority}
                    </Badge>
                    {deadline && (
                      <span className="text-muted-foreground">
                        Due: {format(deadline, "MMM dd, yyyy")}
                      </span>
                    )}
                    {timerDuration > 0 && (
                      <span className="text-muted-foreground">
                        Est: {Math.floor(timerDuration / 60)}h {timerDuration % 60}m
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

CreateUserTaskForm.displayName = "CreateUserTaskForm";