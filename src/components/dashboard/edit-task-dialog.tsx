// src/components/dashboard/edit-task-dialog.tsx
"use client";

import React, { 
  useActionState, 
  useEffect, 
  useRef, 
  useState, 
  useCallback, 
  memo,
  useMemo 
} from "react";
import { useFormStatus } from "react-dom";
import { resubmitTaskAction, type ResubmitTaskActionState } from "@/app/actions";
import type { Task, User, TaskComment } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  AlertCircle, 
  MessageSquare, 
  History, 
  Edit3,
  FileText,
  User as UserIcon,
  Clock,
  RefreshCw,
  CheckCircle2,
  Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTasks } from "@/contexts/TaskContext";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface EditTaskDialogProps {
  task: Task;
  currentUser: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SubmitButton = memo(() => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-w-[160px]">
      {pending ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
          Resubmitting...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" /> 
          Resubmit for Approval
        </>
      )}
    </Button>
  );
});

SubmitButton.displayName = "SubmitButton";

// Helper functions for comment handling
const getCommentText = (comment: TaskComment): string => {
  return comment.content || comment.comment || '';
};

const getCommentUser = (comment: TaskComment): string => {
  if (comment.user) {
    return `${comment.user.firstName} ${comment.user.lastName}`;
  }
  return comment.userName || 'Unknown User';
};

const getCommentTimestamp = (comment: TaskComment): string => {
  return comment.createdAt || comment.timestamp || '';
};

// Helper function for assignee rendering
const renderAssignee = (assignee: string | { id: string; firstName: string; lastName: string } | undefined): string => {
  if (typeof assignee === 'string') {
    return assignee;
  }
  if (assignee && typeof assignee === 'object') {
    return `${assignee.firstName} ${assignee.lastName}`;
  }
  return 'Unknown';
};

const TaskHistory = memo(({ task }: { task: Task }) => {
  const history = useMemo(() => {
    const events = [];
    
    // Add task creation
    events.push({
      type: 'created',
      timestamp: task.createdAt || new Date().toISOString(),
      user: task.assignee ? renderAssignee(task.assignee) : 'Unknown',
      description: 'Task was created and submitted for approval'
    });

    // Add comments as history events
    if (task.comments && task.comments.length > 0) {
      task.comments.forEach(comment => {
        events.push({
          type: 'comment',
          timestamp: getCommentTimestamp(comment),
          user: getCommentUser(comment),
          description: getCommentText(comment)
        });
      });
    }

    // Add status changes based on current status
    if (task.status === 'Needs Changes') {
      events.push({
        type: 'revision_requested',
        timestamp: new Date().toISOString(), // This would come from the actual timestamp
        user: 'Manager',
        description: 'Revisions were requested'
      });
    }

    return events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [task]);

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Task History</h4>
        </div>
        
        <ScrollArea className="h-32">
          <div className="space-y-3">
            {history.map((event, index) => (
              <div key={index} className="flex gap-3 text-xs">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    event.type === 'created' && "bg-blue-500",
                    event.type === 'comment' && "bg-orange-500",
                    event.type === 'revision_requested' && "bg-red-500"
                  )} />
                  {index < history.length - 1 && (
                    <div className="w-px h-4 bg-muted-foreground/30 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{event.user}</span>
                    <span className="text-muted-foreground">
                      {format(parseISO(event.timestamp), "MMM dd, HH:mm")}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

TaskHistory.displayName = "TaskHistory";

const ManagerFeedback = memo(({ task }: { task: Task }) => {
  if (!task.comments || task.comments.length === 0) return null;

  const latestComment = task.comments[task.comments.length - 1];

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
      <MessageSquare className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-700 dark:text-orange-300">
        Manager Feedback
      </AlertTitle>
      <AlertDescription className="text-orange-600 dark:text-orange-400 mt-2">
        <div className="space-y-2">
          <blockquote className="border-l-2 border-orange-300 pl-3 italic">
            "{getCommentText(latestComment)}"
          </blockquote>
          <div className="flex items-center gap-2 text-xs text-orange-500">
            <UserIcon className="h-3 w-3" />
            <span>{getCommentUser(latestComment)}</span>
            <Clock className="h-3 w-3 ml-2" />
            <span>{format(parseISO(getCommentTimestamp(latestComment)), "PPP 'at' p")}</span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
});

ManagerFeedback.displayName = "ManagerFeedback";

const TaskPreview = memo(({ task }: { task: Task }) => (
  <Card className="bg-muted/30">
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-medium text-sm">Current Task Details</h4>
        <Badge variant="outline" className="ml-auto text-xs">
          {task.status}
        </Badge>
      </div>
      
      <div className="space-y-3">
        <div>
          <h5 className="font-semibold text-sm mb-1">{task.title}</h5>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {task.description || 'No description provided'}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-xs">
          {task.suggestedDeadline && (
            <div>
              <span className="text-muted-foreground">Original Deadline:</span>
              <p className="font-medium">
                {format(parseISO(task.suggestedDeadline), "PPP")}
              </p>
            </div>
          )}
          {task.suggestedPriority && (
            <div>
              <span className="text-muted-foreground">Priority:</span>
              <p className="font-medium">{task.suggestedPriority}</p>
            </div>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
));

TaskPreview.displayName = "TaskPreview";

const FormField = memo(({ 
  label, 
  icon, 
  required = false, 
  error, 
  children, 
  description 
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  description?: string;
}) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-2 text-sm font-medium">
      {icon}
      {label}
      {required && <span className="text-destructive">*</span>}
    </Label>
    {description && (
      <p className="text-xs text-muted-foreground">{description}</p>
    )}
    {children}
    {error && (
      <p className="text-sm text-destructive flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
));

FormField.displayName = "FormField";

export const EditTaskDialog = memo(({ 
  task, 
  currentUser, 
  isOpen, 
  onOpenChange 
}: EditTaskDialogProps) => {
  const initialState: ResubmitTaskActionState = { success: false, task: undefined };
  const [state, formAction] = useActionState(resubmitTaskAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { updateTask } = useTasks();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const titleChanged = title !== task.title;
    const descriptionChanged = description !== (task.description || '');
    setHasChanges(titleChanged || descriptionChanged);
  }, [title, description, task.title, task.description]);

  // Handle form submission result
  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Task Resubmitted Successfully! 🎉" : "Resubmission Failed",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      if (state.success && state.task) {
        updateTask(state.task.id, state.task);
        onOpenChange(false);
      }
    }
  }, [state, toast, onOpenChange, updateTask]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle(task.title);
      setDescription(task.description || '');
      setHasChanges(false);
    }
  }, [isOpen, task]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!hasChanges) {
      toast({
        title: "No Changes Made",
        description: "Please make some changes before resubmitting.",
        variant: "destructive",
      });
      return;
    }

    // Use currentTarget instead of target for proper typing
    formAction(new FormData(e.currentTarget));
  }, [hasChanges, formAction, toast]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmClose) return;
    }
    onOpenChange(false);
  }, [hasChanges, onOpenChange]);

  const resetChanges = useCallback(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setHasChanges(false);
  }, [task.title, task.description]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Edit & Resubmit Task
          </DialogTitle>
          <DialogDescription>
            Make the necessary changes based on manager feedback and resubmit for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Manager Feedback */}
          <ManagerFeedback task={task} />

          {/* Task Preview and History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TaskPreview task={task} />
            <TaskHistory task={task} />
          </div>

          <Separator />

          {/* Edit Form */}
          <form onSubmit={handleSubmit} ref={formRef} className="space-y-4">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="userId" value={currentUser.id} />

            {/* Title Field */}
            <FormField
              label="Task Title"
              icon={<Target className="h-4 w-4" />}
              required
              error={state.errors?.title?.join(", ")}
              description="Clear and descriptive title for your task"
            >
              <Input
                id="title-edit"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={cn(state.errors?.title && "border-destructive")}
                maxLength={100}
              />
              <div className="text-xs text-muted-foreground text-right">
                {title.length}/100 characters
              </div>
            </FormField>

            {/* Description Field */}
            <FormField
              label="Task Description"
              icon={<FileText className="h-4 w-4" />}
              required
              error={state.errors?.description?.join(", ")}
              description="Detailed description addressing the manager's feedback"
            >
              <Textarea
                id="description-edit"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                required
                className={cn("resize-none", state.errors?.description && "border-destructive")}
                maxLength={1000}
              />
              <div className="text-xs text-muted-foreground text-right">
                {description.length}/1000 characters
              </div>
            </FormField>

            {/* Changes Indicator */}
            {hasChanges && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  <div className="flex items-center justify-between">
                    <span>You have unsaved changes</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetChanges}
                      className="text-blue-600 hover:text-blue-700 h-auto p-1"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Form Errors */}
            {state.errors?._form && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Submission Error</AlertTitle>
                <AlertDescription>{state.errors._form.join(", ")}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 pt-4">
              <DialogClose asChild>
                <Button variant="outline" disabled={state.success}>
                  Cancel
                </Button>
              </DialogClose>
              <SubmitButton />
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
});

EditTaskDialog.displayName = "EditTaskDialog";