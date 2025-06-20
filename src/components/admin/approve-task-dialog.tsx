"use client";

import React, { useState, useCallback, useMemo, useEffect, memo } from "react";
import { format, parseISO, addDays, addWeeks, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";
import { approveTaskAction } from "@/app/actions";
import type { Task, TaskPriority, User } from "@/types";
import { 
  CalendarIcon, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User as UserIcon,
  Zap,
  Calendar as CalendarDays,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface ApproveTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  assignableUsers: User[];
  approver: User;
}

// Quick preset options for common deadlines
const DEADLINE_PRESETS = [
  { label: "Today", value: 0, icon: Zap },
  { label: "Tomorrow", value: 1, icon: CalendarDays },
  { label: "3 Days", value: 3, icon: Clock },
  { label: "1 Week", value: 7, icon: CalendarDays },
  { label: "2 Weeks", value: 14, icon: CalendarDays },
] as const;

// Timer duration presets in minutes
const TIMER_PRESETS = [
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "1 hour", value: "60" },
  { label: "2 hours", value: "120" },
  { label: "4 hours", value: "240" },
  { label: "1 day", value: "480" },
] as const;

const TaskPreview = memo(({ task }: { task: Task }) => (
  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
    <div className="flex items-start justify-between gap-2">
      <h4 className="font-medium text-sm">Task Preview</h4>
      <Badge variant="outline" className="text-xs">
        Submitted by {task.assigner?.firstName} {task.assigner?.lastName}
      </Badge>
    </div>
    
    <div>
      <h5 className="font-semibold">{task.title}</h5>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
        {task.description}
      </p>
    </div>
    
    {(task.suggestedDeadline || task.suggestedPriority) && (
      <>
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-xs">
          {task.suggestedDeadline && (
            <div>
              <span className="text-muted-foreground">Suggested Deadline:</span>
              <p className="font-medium">
                {format(parseISO(task.suggestedDeadline), "PPP")}
              </p>
            </div>
          )}
          {task.suggestedPriority && (
            <div>
              <span className="text-muted-foreground">Suggested Priority:</span>
              <p className="font-medium">{task.suggestedPriority}</p>
            </div>
          )}
        </div>
      </>
    )}
  </div>
));

TaskPreview.displayName = "TaskPreview";

export const ApproveTaskDialog = memo(({
  isOpen,
  onOpenChange,
  task,
  assignableUsers,
  approver,
}: ApproveTaskDialogProps) => {
  const { toast } = useToast();
  const { updateTask } = useTasks();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [deadline, setDeadline] = useState<Date | null>(() => {
    const dateStr = task.suggestedDeadline || task.deadline;
    return dateStr ? parseISO(dateStr) : null;
  });
  const [priority, setPriority] = useState<TaskPriority>(
    task.suggestedPriority || task.priority || "Medium"
  );
  const [timerDuration, setTimerDuration] = useState<string>("");
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Memoized assignable users for better performance
  const userOptions = useMemo(() => 
    assignableUsers.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
    })), 
    [assignableUsers]
  );

  // Validation
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!selectedUserId) {
      errors.assignee = "Please select an assignee";
    }
    
    if (!deadline) {
      errors.deadline = "Please set a deadline";
    } else if (deadline < startOfDay(new Date())) {
      errors.deadline = "Deadline cannot be in the past";
    }
    
    if (!timerDuration || parseInt(timerDuration) < 1) {
      errors.timer = "Please set a valid timer duration";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedUserId, deadline, timerDuration]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("taskId", task.id);
      formData.append("approverId", String(approver.id));
      formData.append("assignedUserId", selectedUserId);
      formData.append("priority", priority);
      if (deadline) {
        formData.append("deadline", deadline.toISOString());
      }
      formData.append("timerDuration", timerDuration);
      if (approvalNotes.trim()) {
        formData.append("approvalNotes", approvalNotes.trim());
      }

      const result = await approveTaskAction({ success: false }, formData);

      if (result.success && result.task) {
        toast({
          title: "Task Approved Successfully! 🎉",
          description: `Task has been assigned to ${userOptions.find(u => u.id.toString() === selectedUserId)?.name}`,
        });
        onOpenChange(false);
        updateTask(task.id, result.task);
      } else {
        toast({
          title: "Approval Failed",
          description: result.message || "Failed to approve task. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error approving task:", error);
      toast({
        title: "System Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    validateForm, task.id, approver.id, selectedUserId, priority, 
    deadline, timerDuration, approvalNotes, userOptions, toast, 
    onOpenChange, updateTask
  ]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setDeadline(date || null);
    setValidationErrors(prev => ({ ...prev, deadline: "" }));
  }, []);

  const handlePresetDeadline = useCallback((days: number) => {
    const newDate = addDays(new Date(), days);
    setDeadline(newDate);
    setValidationErrors(prev => ({ ...prev, deadline: "" }));
  }, []);

  const handleTimerPreset = useCallback((value: string) => {
    setTimerDuration(value);
    setValidationErrors(prev => ({ ...prev, timer: "" }));
  }, []);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      onOpenChange(false);
    }
  }, [isLoading, onOpenChange]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId("");
      setDeadline(task.suggestedDeadline ? parseISO(task.suggestedDeadline) : null);
      setPriority(task.suggestedPriority || "Medium");
      setTimerDuration("");
      setApprovalNotes("");
      setValidationErrors({});
    }
  }, [isOpen, task.suggestedDeadline, task.suggestedPriority]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Approve & Assign Task
          </DialogTitle>
          <DialogDescription>
            Review the task details and configure assignment settings. 
            The task will be immediately available to the assigned user.
          </DialogDescription>
        </DialogHeader>

        <TaskPreview task={task} />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Assignee Selection */}
          <div className="space-y-2">
            <Label htmlFor="assignee" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Assign To *
            </Label>
            <Select
              value={selectedUserId}
              onValueChange={(value) => {
                setSelectedUserId(value);
                setValidationErrors(prev => ({ ...prev, assignee: "" }));
              }}
            >
              <SelectTrigger className={cn(validationErrors.assignee && "border-destructive")}>
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {userOptions.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.assignee && (
              <p className="text-sm text-destructive">{validationErrors.assignee}</p>
            )}
          </div>

          {/* Priority Selection */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value: TaskPriority) => setPriority(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Low Priority
                  </div>
                </SelectItem>
                <SelectItem value="Medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Medium Priority
                  </div>
                </SelectItem>
                <SelectItem value="High">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    High Priority
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Deadline Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Deadline *
            </Label>
            
            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              {DEADLINE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetDeadline(preset.value)}
                  className="text-xs"
                >
                  <preset.icon className="h-3 w-3 mr-1" />
                  {preset.label}
                </Button>
              ))}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deadline && "text-muted-foreground",
                    validationErrors.deadline && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, "PPP") : "Select deadline..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline || undefined}
                  onSelect={handleDateSelect}
                  initialFocus
                  disabled={(date) => date < startOfDay(new Date())}
                />
              </PopoverContent>
            </Popover>
            {validationErrors.deadline && (
              <p className="text-sm text-destructive">{validationErrors.deadline}</p>
            )}
          </div>

          {/* Timer Duration */}
          <div className="space-y-3">
            <Label htmlFor="timerDuration" className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Estimated Duration (minutes) *
            </Label>
            
            {/* Timer presets */}
            <div className="flex flex-wrap gap-2">
              {TIMER_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTimerPreset(preset.value)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <Input
              type="number"
              id="timerDuration"
              value={timerDuration}
              onChange={(e) => {
                setTimerDuration(e.target.value);
                setValidationErrors(prev => ({ ...prev, timer: "" }));
              }}
              min="1"
              max="2880" // 48 hours max
              placeholder="Enter duration in minutes..."
              className={cn(validationErrors.timer && "border-destructive")}
            />
            {validationErrors.timer && (
              <p className="text-sm text-destructive">{validationErrors.timer}</p>
            )}
          </div>

          {/* Optional approval notes */}
          <div className="space-y-2">
            <Label htmlFor="approvalNotes">Approval Notes (Optional)</Label>
            <Textarea
              id="approvalNotes"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any additional instructions or context for the assignee..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {approvalNotes.length}/500 characters
            </p>
          </div>

          {/* Summary */}
          {selectedUserId && deadline && timerDuration && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Ready to approve:</strong> Task will be assigned to{" "}
                <strong>{userOptions.find(u => u.id.toString() === selectedUserId)?.name}</strong>{" "}
                with a <strong>{priority.toLowerCase()}</strong> priority, due{" "}
                <strong>{format(deadline, "PPP")}</strong>, estimated duration{" "}
                <strong>{timerDuration} minutes</strong>.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || Object.keys(validationErrors).length > 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve & Assign Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

ApproveTaskDialog.displayName = "ApproveTaskDialog";