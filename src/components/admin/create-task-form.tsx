// src/components/admin/create-task-form.tsx

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
import { CalendarIcon, AlertCircle, Timer, UserCheck, ListPlus, Paperclip } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import type { User, TaskPriority } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";

// The component now receives the list of users as a prop.
interface CreateTaskFormProps {
  assignableUsers: User[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Creating Task..." : <><ListPlus className="mr-2 h-4 w-4" /> Create & Assign Task</>}
    </Button>
  );
}

export function CreateTaskForm({ assignableUsers }: CreateTaskFormProps) {
  const initialState: AdminCreateTaskActionState = { success: false };
  const [state, formAction] = useActionState(adminCreateTaskAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [deadline, setDeadline] = useState<Date | undefined>();
  const { currentUser } = useAuth();
  const { addTask } = useTasks();

  // This useEffect correctly handles the result from the Server Action
  useEffect(() => {
    if (state.message) {
      if (state.success && state.task) {
        toast({
          title: "Success!",
          description: state.message,
          variant: "default",
        });
        addTask(state.task);
        formRef.current?.reset();
        setDeadline(undefined);
      } else if (!state.success) {
        toast({
          title: "Error Creating Task",
          description: state.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  }, [state, toast, addTask]);

  // --- REMOVED ---
  // The incorrect useEffect that was causing the 404 error has been completely removed.
  // No more client-side fetching in this component.

  if (!currentUser || currentUser.role !== 'Admin') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You must be an administrator to create and assign tasks.</AlertDescription>
      </Alert>
    );
  }

  return (
    // This form correctly uses the Server Action
    <form action={formAction} ref={formRef} className="space-y-6">
      <div className="p-2 mb-4 text-sm rounded-md bg-muted text-muted-foreground flex items-center">
        <UserCheck className="mr-2 h-4 w-4" />
        Assigning task as: <strong className="ml-1">{currentUser.firstName} {currentUser.lastName}</strong>
      </div>

      {state.errors?._form && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.errors._form.join(", ")}</AlertDescription>
        </Alert>
      )}

      {/* Form Fields... */}
      {/* Title */}
      <div>
        <Label htmlFor="title">Task Title</Label>
        <Input id="title" name="title" placeholder="e.g., Implement quarterly report feature" required />
        {state.errors?.title && <p className="mt-1 text-sm text-destructive">{state.errors.title.join(", ")}</p>}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} placeholder="Detailed description..." required />
        {state.errors?.description && <p className="mt-1 text-sm text-destructive">{state.errors.description.join(", ")}</p>}
      </div>
      
      {/* Deadline & Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="deadline-picker">Deadline</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="deadline-picker" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} />
            </PopoverContent>
          </Popover>
          <input type="hidden" name="deadline" value={deadline ? deadline.toISOString() : ""} />
          {state.errors?.deadline && <p className="mt-1 text-sm text-destructive">{state.errors.deadline.join(", ")}</p>}
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue="Medium">
            <SelectTrigger id="priority"><SelectValue placeholder="Select priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
          {state.errors?.priority && <p className="mt-1 text-sm text-destructive">{state.errors.priority.join(", ")}</p>}
        </div>
      </div>
      
      {/* Assignee & Timer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assignedUserId">Assign To</Label>
          <Select name="assignedUserId">
            <SelectTrigger id="assignedUserId"><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {assignableUsers.length === 0 ? (
                <SelectItem value="no-users-available" disabled>No users available</SelectItem>
              ) : (
                assignableUsers.map(user => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.firstName} {user.lastName} ({user.email})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {state.errors?.assignedUserId && <p className="mt-1 text-sm text-destructive">{state.errors.assignedUserId.join(", ")}</p>}
        </div>
        <div>
          <Label htmlFor="timerDuration">Timer Duration (minutes)</Label>
          <div className="relative">
            <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="timerDuration" name="timerDuration" type="number" placeholder="e.g., 60" min="1" className="pl-10" required />
          </div>
          {state.errors?.timerDuration && <p className="mt-1 text-sm text-destructive">{state.errors.timerDuration.join(", ")}</p>}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}