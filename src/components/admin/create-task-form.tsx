"use client";

import React, { useActionState, useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { useFormStatus } from "react-dom";
import { adminCreateTaskAction, type AdminCreateTaskActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CalendarIcon, 
  AlertCircle, 
  Timer, 
  UserCheck, 
  ListPlus, 
  Paperclip,
  Clock,
  Zap,
  User as UserIcon,
  Target,
  FileText,
  Calendar as CalendarDays,
  CheckCircle2
} from "lucide-react";
import { format, addDays, startOfDay } from 'date-fns';
import { cn } from "@/lib/utils";
import type { User, TaskPriority } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";

interface CreateTaskFormProps {
  assignableUsers: User[];
}

// Quick deadline presets
const DEADLINE_PRESETS = [
  { label: "Today", days: 0, icon: Zap, color: "bg-red-100 text-red-700 hover:bg-red-200" },
  { label: "Tomorrow", days: 1, icon: CalendarDays, color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { label: "3 Days", days: 3, icon: Clock, color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  { label: "1 Week", days: 7, icon: CalendarDays, color: "bg-green-100 text-green-700 hover:bg-green-200" },
  { label: "2 Weeks", days: 14, icon: CalendarDays, color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
] as const;

// Timer duration presets in minutes
const TIMER_PRESETS = [
  { label: "15m", value: "15", description: "Quick task" },
  { label: "30m", value: "30", description: "Short task" },
  { label: "1h", value: "60", description: "Medium task" },
  { label: "2h", value: "120", description: "Long task" },
  { label: "4h", value: "240", description: "Complex task" },
  { label: "8h", value: "480", description: "Full day" },
] as const;

// Priority configurations
const PRIORITY_CONFIG = {
  Low: { color: "bg-green-100 text-green-700 border-green-300", icon: "🟢" },
  Medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: "🟡" },
  High: { color: "bg-red-100 text-red-700 border-red-300", icon: "🔴" },
} as const;

const SubmitButton = memo(() => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto min-w-[180px]">
      {pending ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
          Creating Task...
        </>
      ) : (
        <>
          <ListPlus className="mr-2 h-4 w-4" /> 
          Create & Assign Task
        </>
      )}
    </Button>
  );
});

SubmitButton.displayName = "SubmitButton";

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

const UserPreview = memo(({ user }: { user: User }) => (
  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
    <UserCheck className="h-4 w-4 text-primary" />
    <span>Creating as: <strong>{user.firstName} {user.lastName}</strong></span>
    <Badge variant="outline" className="ml-auto text-xs">
      {user.role}
    </Badge>
  </div>
));

UserPreview.displayName = "UserPreview";

const TaskSummary = memo(({ 
  title, 
  assignee, 
  deadline, 
  priority, 
  timerDuration 
}: {
  title: string;
  assignee: User | null;
  deadline: Date | null;
  priority: TaskPriority;
  timerDuration: string;
}) => {
  if (!title || !assignee || !deadline || !timerDuration) return null;

  return (
    <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-800 dark:text-green-200">Ready to Create</AlertTitle>
      <AlertDescription className="text-green-700 dark:text-green-300 mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><strong>Assignee:</strong> {assignee.firstName} {assignee.lastName}</div>
          <div><strong>Priority:</strong> {priority}</div>
          <div><strong>Deadline:</strong> {format(deadline, "PPP")}</div>
          <div><strong>Duration:</strong> {timerDuration} minutes</div>
        </div>
      </AlertDescription>
    </Alert>
  );
});

TaskSummary.displayName = "TaskSummary";

export const CreateTaskForm = memo(({ assignableUsers }: CreateTaskFormProps) => {
  const initialState: AdminCreateTaskActionState = { success: false };
  const [state, formAction] = useActionState(adminCreateTaskAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>("Medium");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [timerDuration, setTimerDuration] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const { currentUser } = useAuth();
  const { addTask } = useTasks();

  // Memoized user options for better performance
  const userOptions = useMemo(() => 
    assignableUsers.map(user => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      full: user
    })), 
    [assignableUsers]
  );

  const selectedUser = useMemo(() => 
    userOptions.find(u => u.id.toString() === selectedAssignee)?.full || null,
    [userOptions, selectedAssignee]
  );

  // Handle form success/error states
  useEffect(() => {
    if (state.message) {
      if (state.success && state.task) {
        toast({
          title: "Task Created Successfully! 🎉",
          description: `Task "${state.task.title}" has been assigned to ${selectedUser?.firstName} ${selectedUser?.lastName}`,
          variant: "default",
        });
        addTask(state.task);
        
        // Reset form
        formRef.current?.reset();
        setDeadline(undefined);
        setSelectedPriority("Medium");
        setSelectedAssignee("");
        setTimerDuration("");
        setTitle("");
      } else if (!state.success) {
        toast({
          title: "Failed to Create Task",
          description: state.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [state, toast, addTask, selectedUser]);

  const handleDeadlinePreset = useCallback((days: number) => {
    const newDate = addDays(new Date(), days);
    setDeadline(newDate);
  }, []);

  const handleTimerPreset = useCallback((value: string) => {
    setTimerDuration(value);
  }, []);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setDeadline(date);
  }, []);

  // Access control
  if (!currentUser || currentUser.role !== 'Admin') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You must be an administrator to create and assign tasks directly.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Context */}
      <UserPreview user={currentUser} />

      {/* Form Errors */}
      {state.errors?._form && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Error</AlertTitle>
          <AlertDescription>{state.errors._form.join(", ")}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} ref={formRef} className="space-y-6">
        {/* Task Title */}
        <FormField
          label="Task Title"
          icon={<Target className="h-4 w-4" />}
          required
          error={state.errors?.title?.join(", ")}
          description="A clear, descriptive title for the task"
        >
          <Input 
            id="title" 
            name="title" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Implement user authentication feature" 
            required 
            className={cn(state.errors?.title && "border-destructive")}
            maxLength={100}
          />
          <div className="text-xs text-muted-foreground text-right">
            {title.length}/100 characters
          </div>
        </FormField>

        {/* Task Description */}
        <FormField
          label="Description"
          icon={<FileText className="h-4 w-4" />}
          required
          error={state.errors?.description?.join(", ")}
          description="Detailed description of what needs to be accomplished"
        >
          <Textarea 
            id="description" 
            name="description" 
            rows={4} 
            placeholder="Provide a comprehensive description of the task, including requirements, deliverables, and any specific instructions..." 
            required 
            className={cn(state.errors?.description && "border-destructive")}
            maxLength={1000}
          />
        </FormField>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Deadline Selection */}
          <FormField
            label="Deadline"
            icon={<CalendarIcon className="h-4 w-4" />}
            required
            error={state.errors?.deadline?.join(", ")}
            description="When should this task be completed?"
          >
            <div className="space-y-3">
              {/* Quick presets */}
              <div className="flex flex-wrap gap-2">
                {DEADLINE_PRESETS.map((preset) => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeadlinePreset(preset.days)}
                    className={cn("text-xs", preset.color)}
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
                      state.errors?.deadline && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Select deadline..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={handleDateSelect}
                    initialFocus
                    disabled={(date) => date < startOfDay(new Date())}
                  />
                </PopoverContent>
              </Popover>
              <input type="hidden" name="deadline" value={deadline ? deadline.toISOString() : ""} />
            </div>
          </FormField>

          {/* Priority Selection */}
          <FormField
            label="Priority"
            icon={<Target className="h-4 w-4" />}
            error={state.errors?.priority?.join(", ")}
            description="How urgent is this task?"
          >
            <Select 
              name="priority" 
              value={selectedPriority}
              onValueChange={(value: TaskPriority) => setSelectedPriority(value)}
            >
              <SelectTrigger id="priority">
                <SelectValue placeholder="Select priority..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map(priority => (
                  <SelectItem key={priority} value={priority}>
                    <div className="flex items-center gap-2">
                      <span>{PRIORITY_CONFIG[priority].icon}</span>
                      <span>{priority} Priority</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assignee Selection */}
          <FormField
            label="Assign To"
            icon={<UserIcon className="h-4 w-4" />}
            required
            error={state.errors?.assignedUserId?.join(", ")}
            description="Who will be responsible for this task?"
          >
            <Select 
              name="assignedUserId"
              value={selectedAssignee}
              onValueChange={setSelectedAssignee}
            >
              <SelectTrigger id="assignedUserId">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {userOptions.length === 0 ? (
                  <SelectItem value="no-users-available" disabled>
                    No users available
                  </SelectItem>
                ) : (
                  userOptions.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FormField>

          {/* Timer Duration */}
          <FormField
            label="Estimated Duration"
            icon={<Timer className="h-4 w-4" />}
            required
            error={state.errors?.timerDuration?.join(", ")}
            description="How long should this task take? (in minutes)"
          >
            <div className="space-y-3">
              {/* Timer presets */}
              <div className="grid grid-cols-3 gap-2">
                {TIMER_PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTimerPreset(preset.value)}
                    className="text-xs flex flex-col h-auto py-2"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-muted-foreground text-[10px]">{preset.description}</span>
                  </Button>
                ))}
              </div>

              <div className="relative">
                <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="timerDuration" 
                  name="timerDuration" 
                  type="number" 
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(e.target.value)}
                  placeholder="Enter duration..." 
                  min="1" 
                  max="2880"
                  className={cn(
                    "pl-10", 
                    state.errors?.timerDuration && "border-destructive"
                  )} 
                  required 
                />
              </div>
            </div>
          </FormField>
        </div>

        {/* Task Summary */}
        <TaskSummary
          title={title}
          assignee={selectedUser}
          deadline={deadline || null}
          priority={selectedPriority}
          timerDuration={timerDuration}
        />

        <Separator />

        {/* Submit Button */}
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
});

CreateTaskForm.displayName = "CreateTaskForm";