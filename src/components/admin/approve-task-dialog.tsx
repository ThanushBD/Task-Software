"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
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

interface ApproveTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  users: User[];
}

export function ApproveTaskDialog({
  isOpen,
  onClose,
  task,
  users,
}: ApproveTaskDialogProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { updateTask } = useTasks();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [deadline, setDeadline] = useState<Date | null>(() => {
    const dateStr = task.suggestedDeadline || task.deadline;
    return dateStr ? parseISO(dateStr) : null;
  });
  const [priority, setPriority] = useState<TaskPriority>(task.suggestedPriority || task.priority || "Medium");
  const [timerDuration, setTimerDuration] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("taskId", task.id);
      formData.append("approverId", String(currentUser?.id));
      formData.append("assignedUserId", selectedUserId || "");
      formData.append("priority", priority);
      if (deadline) {
        formData.append("deadline", deadline.toISOString());
      }
      formData.append("timerDuration", timerDuration);

      const result = await approveTaskAction({ success: false }, formData);

      if (result.success && result.task) {
        toast({
          title: "Success",
          description: result.message,
        });
        onClose();
        updateTask(task.id, result.task);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to approve task",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error approving task:", error);
      toast({
        title: "Error",
        description: "An error occurred while approving the task",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setDeadline(date || null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Approve Task</DialogTitle>
          <DialogDescription>
            Review and approve the task "{task.title}" created by {task.assigner?.firstName} {task.assigner?.lastName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value: TaskPriority) => setPriority(value)}
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
          </div>

          <div>
            <Label htmlFor="deadline">Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  {deadline ? format(deadline, "PPP") : "Select deadline"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline || undefined}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="timerDuration">Timer Duration (minutes)</Label>
            <Input
              type="number"
              id="timerDuration"
              value={timerDuration}
              onChange={(e) => setTimerDuration(e.target.value)}
              min="1"
              required
            />
          </div>

          <div>
            <Label htmlFor="assignee">Assign To</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Approving..." : "Approve Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
