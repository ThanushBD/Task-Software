"use client";

import React, { useActionState, useEffect, useRef, useState, useCallback, memo } from "react";
import { useFormStatus } from "react-dom";
import { requestRevisionsAction, type RequestRevisionsActionState } from "@/app/actions";
import type { Task, User } from "@/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageSquareWarning, 
  AlertCircle, 
  FileText, 
  User as UserIcon,
  Calendar,
  Target,
  Clock,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTasks } from "@/contexts/TaskContext";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface RequestRevisionsDialogProps {
  task: Task;
  reviser: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Common revision templates to help admins provide consistent feedback
const REVISION_TEMPLATES = [
  {
    category: "Clarity",
    suggestions: [
      "Please provide more specific details about the requirements",
      "The task description needs to be more detailed and actionable",
      "Consider breaking this down into smaller, more specific tasks",
    ]
  },
  {
    category: "Scope",
    suggestions: [
      "This task seems too broad - please narrow down the scope",
      "Please specify the exact deliverables expected",
      "The timeline may be unrealistic for the scope described",
    ]
  },
  {
    category: "Priority",
    suggestions: [
      "Please justify the priority level for this task",
      "Consider if this aligns with current project priorities",
      "The urgency of this task needs clarification",
    ]
  },
  {
    category: "Resources",
    suggestions: [
      "Please specify what resources or tools will be needed",
      "Consider if additional team members should be involved",
      "Clarify any dependencies or prerequisites",
    ]
  },
] as const;

const SubmitButton = memo(() => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="min-w-[140px]">
      {pending ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
          Submitting...
        </>
      ) : (
        <>
          <MessageSquareWarning className="mr-2 h-4 w-4" /> 
          Request Revisions
        </>
      )}
    </Button>
  );
});

SubmitButton.displayName = "SubmitButton";

const TaskOverview = memo(({ task }: { task: Task }) => (
  <div className="bg-muted/30 rounded-lg p-4 space-y-3 border">
    <div className="flex items-start justify-between gap-2">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Task Details
      </h4>
      <Badge variant="outline" className="text-xs">
        Submitted for Review
      </Badge>
    </div>
    
    <div className="space-y-2">
      <div>
        <h5 className="font-semibold text-base">{task.title}</h5>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {task.description}
        </p>
      </div>
      
      <Separator />
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <UserIcon className="h-3 w-3 text-muted-foreground" />
          <div>
            <span className="text-muted-foreground">Submitted by:</span>
            <p className="font-medium">{task.assigner?.firstName} {task.assigner?.lastName}</p>
          </div>
        </div>
        
        {task.suggestedDeadline && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Suggested deadline:</span>
              <p className="font-medium">{format(parseISO(task.suggestedDeadline), "MMM dd, yyyy")}</p>
            </div>
          </div>
        )}
        
        {task.suggestedPriority && (
          <div className="flex items-center gap-2">
            <Target className="h-3 w-3 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Suggested priority:</span>
              <p className="font-medium">{task.suggestedPriority}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
));

TaskOverview.displayName = "TaskOverview";

const RevisionTemplates = memo(({ onSelectTemplate }: { onSelectTemplate: (text: string) => void }) => (
  <div className="space-y-3">
    <Label className="text-sm font-medium">Quick Templates (click to use)</Label>
    <div className="space-y-3">
      {REVISION_TEMPLATES.map((category) => (
        <div key={category.category} className="space-y-2">
          <h6 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {category.category}
          </h6>
          <div className="space-y-1">
            {category.suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectTemplate(suggestion)}
                className="w-full text-left text-xs p-2 rounded border border-muted hover:bg-muted/50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
));

RevisionTemplates.displayName = "RevisionTemplates";

export const RequestRevisionsDialog = memo(({ 
  task, 
  reviser, 
  isOpen, 
  onOpenChange 
}: RequestRevisionsDialogProps) => {
  const initialState: RequestRevisionsActionState = { success: false };
  const [state, formAction] = useActionState(requestRevisionsAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { updateTask } = useTasks();
  const [comment, setComment] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  // Handle form submission result
  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Revisions Requested Successfully" : "Error Requesting Revisions",
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
      setComment("");
      setShowTemplates(false);
      formRef.current?.reset();
    }
  }, [isOpen]);

  const handleTemplateSelect = useCallback((templateText: string) => {
    setComment(prev => {
      const newText = prev ? `${prev}\n\n${templateText}` : templateText;
      return newText;
    });
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast({
        title: "Comment Required",
        description: "Please provide feedback for the revision request.",
        variant: "destructive",
      });
      return;
    }
    formAction(new FormData(e.currentTarget as HTMLFormElement));
  }, [comment, formAction, toast]);

  const handleClose = useCallback(() => {
    if (!state.success) {
      onOpenChange(false);
    }
  }, [state.success, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-orange-600" />
            Request Task Revisions
          </DialogTitle>
          <DialogDescription>
            Provide specific feedback to help the user understand what changes are needed. 
            The task will be marked as "Needs Changes" and returned to the submitter.
          </DialogDescription>
        </DialogHeader>

        <TaskOverview task={task} />

        <form onSubmit={handleSubmit} ref={formRef} className="space-y-4">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="reviserId" value={reviser.id} />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="comment" className="text-sm font-medium">
                Revision Comments *
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs"
              >
                {showTemplates ? "Hide" : "Show"} Templates
              </Button>
            </div>
            
            {showTemplates && (
              <div className="border rounded-lg p-3 bg-muted/20">
                <RevisionTemplates onSelectTemplate={handleTemplateSelect} />
              </div>
            )}

            <Textarea
              id="comment"
              name="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain what needs to be revised or improved. Be specific about requirements, scope, priorities, or any other concerns..."
              rows={6}
              required
              className={cn(
                "resize-none",
                state.errors?.comment && "border-destructive"
              )}
              maxLength={1000}
            />
            
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Be constructive and specific in your feedback</span>
              <span>{comment.length}/1000 characters</span>
            </div>
            
            {state.errors?.comment && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {state.errors.comment.join(", ")}
              </p>
            )}
          </div>

          {/* Preview of action */}
          {comment.trim() && (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <MessageSquareWarning className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                <strong>This will:</strong>
                <ul className="mt-1 text-sm space-y-1 ml-4 list-disc">
                  <li>Mark the task as "Needs Changes"</li>
                  <li>Send your feedback to {task.assignee?.firstName || task.assigner?.firstName}</li>
                  <li>Allow them to edit and resubmit the task</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {state.errors?._form && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
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
      </DialogContent>
    </Dialog>
  );
});

RequestRevisionsDialog.displayName = "RequestRevisionsDialog";