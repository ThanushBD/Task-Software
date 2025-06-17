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
import { z } from "zod";

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

// Add validation schema
const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  deadline: z.string().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return date > new Date();
  }, "Deadline must be in the future"),
  priority: z.enum(["Low", "Medium", "High"] as const),
  assignedUserId: z.string().min(1, "Please select an assignee"),
  timerDuration: z.string().min(1, "Timer duration is required").refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, "Timer duration must be a positive number"),
});

type TaskFormData = z.infer<typeof taskSchema>;

export function CreateTaskForm({ assignableUsers }: CreateTaskFormProps) {
  const initialState: AdminCreateTaskActionState = { success: false, message: undefined, errors: undefined };
  const [state, formAction] = useActionState(adminCreateTaskAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [deadline, setDeadline] = useState<Date | undefined>();
  const { currentUser } = useAuth();
  const { addTask } = useTasks();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    deadline: "",
    priority: "Medium",
    assignedUserId: "",
    timerDuration: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  useEffect(() => {
    if (state.message) {
      if (state.success && state.task) {
        toast({
          title: "Success",
          description: state.message,
        });
        addTask(state.task);
        formRef.current?.reset();
        setDeadline(undefined);
      } else if (!state.success) {
        toast({
          title: "Error",
          description: state.message || "Failed to create task",
          variant: "destructive",
        });
      }
    }
  }, [state, toast, addTask]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/auth/users', {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error",
          description: "Failed to load users. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchUsers();
  }, [toast]);

  const validateForm = (): boolean => {
    try {
      taskSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof TaskFormData, string>> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof TaskFormData;
          errors[path] = err.message;
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create task");
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        deadline: "",
        priority: "Medium",
        assignedUserId: "",
        timerDuration: "",
      });
      setFormErrors({});

      // Show success message
      toast({
        title: "Success",
        description: "Task created successfully!",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formErrors[name as keyof TaskFormData]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  if (!currentUser || currentUser.role !== 'Admin') {
    return <p className="text-destructive">Access denied. You must be an admin to create tasks.</p>;
  }

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="space-y-6">
      <div className="p-2 mb-4 text-sm rounded-md bg-muted text-muted-foreground flex items-center">
        <UserCheck className="mr-2 h-4 w-4" />
        Assigning task as: <strong className="ml-1">{currentUser.firstName} {currentUser.lastName}</strong>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="title">Task Title</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
            formErrors.title ? "border-red-300" : ""
          }`}
          disabled={isLoading}
          placeholder="e.g., Implement feature X"
          required
        />
        {formErrors.title && (
          <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
            formErrors.description ? "border-red-300" : ""
          }`}
          disabled={isLoading}
          placeholder="Detailed description of the task..."
          required
        />
        {formErrors.description && (
          <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
        )}
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
          <input
            type="hidden"
            name="deadline"
            value={formData.deadline}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              formErrors.deadline ? "border-red-300" : ""
            }`}
            disabled={isLoading}
          />
          {formErrors.deadline && (
            <p className="mt-1 text-sm text-red-600">{formErrors.deadline}</p>
          )}
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as TaskPriority }))}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
          {formErrors.priority && (
            <p className="mt-1 text-sm text-red-600">{formErrors.priority}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assignedUserId">Assign To</Label>
          <Select
            value={formData.assignedUserId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, assignedUserId: value }))}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.firstName} {user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formErrors.assignedUserId && (
            <p className="mt-1 text-sm text-red-600">{formErrors.assignedUserId}</p>
          )}
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
          {formErrors.timerDuration && <p className="text-sm text-red-600">{formErrors.timerDuration}</p>}
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

      <div className="flex justify-end pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}