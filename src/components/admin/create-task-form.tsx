"use client";

import { useActionState } from "react";
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
import { CalendarIcon, AlertCircle, Timer, UserCheck, Paperclip, ListPlus } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import type { User, TaskPriority } from "@/types";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";

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
        // TODO: Clear conceptual attachments list if we implement local state for them
      } else if (!state.success) {
        toast({
          title: "Error Creating Task",
          description: state.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  }, [state, toast, addTask]);

  if (!currentUser || currentUser.role !== 'Admin') {
    return <p className="text-destructive">Access denied. You must be an admin to create tasks.</p>;
  }

  return (
    <form action={formAction} ref={formRef} className="space-y-6">
      <div className="p-2 mb-4 text-sm rounded-md bg-muted text-muted-foreground flex items-center">
        <UserCheck className="mr-2 h-4 w-4" />
        Assigning task as: <strong className="ml-1">{currentUser.firstName} {currentUser.lastName}</strong>
      </div>

      <div>
        <Label htmlFor="title">Task Title</Label>
        <Input id="title" name="title" placeholder="e.g., Implement feature X" required />
        {state.errors?.title && <p className="text-sm text-destructive mt-1">{state.errors.title.join(", ")}</p>}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="Detailed description of the task..." rows={4} required />
        {state.errors?.description && <p className="text-sm text-destructive mt-1">{state.errors.description.join(", ")}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="deadline-picker">Deadline</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="deadline-picker"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !deadline && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={deadline}
                onSelect={setDeadline}
                initialFocus
                required
              />
            </PopoverContent>
          </Popover>
          <input type="hidden" name="deadline" value={deadline ? deadline.toISOString() : ""} />
          {state.errors?.deadline && <p className="text-sm text-destructive mt-1">{state.errors.deadline.join(", ")}</p>}
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue="Medium" required>
            <SelectTrigger id="priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {(["Low", "Medium", "High"] as TaskPriority[]).map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.priority && <p className="text-sm text-destructive mt-1">{state.errors.priority.join(", ")}</p>}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assignedUserId">Assign To</Label>
          <Select name="assignedUserId" required>
            <SelectTrigger id="assignedUserId">
              <SelectValue placeholder="Select employee to assign" />
            </SelectTrigger>
            <SelectContent>
              {assignableUsers.length === 0 && <SelectItem value="no_users_available" disabled>No assignable users</SelectItem>}
              {assignableUsers.map(user => (
                <SelectItem key={user.id} value={user.email}>
                  {user.firstName} {user.lastName} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.assignedUserId && <p className="text-sm text-destructive mt-1">{state.errors.assignedUserId.join(", ")}</p>}
        </div>
        <div>
          <Label htmlFor="timerDuration">Timer Duration (minutes)</Label>
          <div className="relative">
            <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="timerDuration" 
              name="timerDuration" 
              type="number" 
              placeholder="e.g., 60" 
              min="1"
              className="pl-10" 
              required
            />
          </div>
          {state.errors?.timerDuration && <p className="text-sm text-destructive mt-1\">{state.errors.timerDuration.join(", ")}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="attachments-admin">File Attachments (Conceptual)</Label>
        <div className="flex items-center gap-2 mt-1 p-3 border border-dashed rounded-md text-muted-foreground">
            <Paperclip className="h-5 w-5" />
            <span>Drag & drop files here, or click to browse. (Feature not implemented for actual upload)</span>
        </div>
        <Input id="attachments-admin" name="attachments" type="file" className="sr-only" disabled multiple/>
        <p className="text-xs text-muted-foreground mt-1">Actual file uploading is not implemented in this prototype. This section is for UI demonstration.</p>
      </div>
      
      {state.errors?._form && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.errors._form.join(", ")}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}