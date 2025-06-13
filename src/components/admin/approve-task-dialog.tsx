
"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { approveTaskAction, type ApproveTaskActionState } from "@/app/actions";
import type { Task, User, TaskPriority } from "@/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, CheckCircle, AlertCircle, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTasks } from "@/contexts/TaskContext"; // Import useTasks

interface ApproveTaskDialogProps {
  task: Task;
  approver: User;
  assignableUsers: User[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Approving..." : <><CheckCircle className="mr-2 h-4 w-4" /> Approve & Assign Task</>}
    </Button>
  );
}

export function ApproveTaskDialog({ task, approver, assignableUsers, isOpen, onOpenChange }: ApproveTaskDialogProps) {
  const initialState: ApproveTaskActionState = { success: false, task: undefined };
  const [state, formAction] = useActionState(approveTaskAction, initialState);
  const { toast } = useToast();
  const { updateTask } = useTasks(); // Get updateTask from context

  const [deadline, setDeadline] = useState<Date | undefined>(
    task.suggestedDeadline ? parseISO(task.suggestedDeadline) : (task.deadline ? parseISO(task.deadline) : new Date())
  );
  const [priority, setPriority] = useState<TaskPriority>(task.suggestedPriority || task.priority || "Medium");
  const [timerDuration, setTimerDuration] = useState<string>(task.timerDuration > 0 ? String(task.timerDuration) : "60");
  const [assignedUserId, setAssignedUserId] = useState<string>(task.assignedUserId || "");


  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Success!" : "Error Approving Task",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      if (state.success && state.task) {
        updateTask(state.task); // Update task in context and localStorage
        onOpenChange(false); 
      }
    }
  }, [state, toast, onOpenChange, updateTask]);
  
  useEffect(() => {
    if (isOpen) {
      setDeadline(task.suggestedDeadline ? parseISO(task.suggestedDeadline) : (task.deadline ? parseISO(task.deadline) : new Date()));
      setPriority(task.suggestedPriority || task.priority || "Medium");
      setTimerDuration(task.timerDuration > 0 ? String(task.timerDuration) : "60");
      setAssignedUserId(task.assignedUserId || "");
    }
  }, [isOpen, task]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve Task: {task.title}</DialogTitle>
          <DialogDescription>
            Review the task details, assign it to an employee, and set the final parameters.
            Created by: {task.assignerName}.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4 py-4">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="approverId" value={approver.id} />

          <p className="text-sm"><strong className="font-medium">Original Description:</strong> {task.description}</p>
          {task.suggestedDeadline && <p className="text-sm text-muted-foreground">Suggested Deadline: {format(parseISO(task.suggestedDeadline), "PPP")}</p>}
          {task.suggestedPriority && <p className="text-sm text-muted-foreground">Suggested Priority: {task.suggestedPriority}</p>}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deadline-approve">Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="deadline-approve-picker"
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus required />
                </PopoverContent>
              </Popover>
              <input type="hidden" name="deadline" value={deadline ? deadline.toISOString() : ""} />
              {state.errors?.deadline && <p className="text-xs text-destructive mt-1">{state.errors.deadline.join(", ")}</p>}
            </div>
            <div>
              <Label htmlFor="priority-approve">Priority</Label>
              <Select name="priority" value={priority} onValueChange={(val) => setPriority(val as TaskPriority)} required>
                <SelectTrigger id="priority-approve"><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  {(["Low", "Medium", "High"] as TaskPriority[]).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              {state.errors?.priority && <p className="text-xs text-destructive mt-1">{state.errors.priority.join(", ")}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignedUserId-approve">Assign To</Label>
              <Select name="assignedUserId" value={assignedUserId} onValueChange={setAssignedUserId} required>
                <SelectTrigger id="assignedUserId-approve"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {assignableUsers.map(user => <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>)}
                </SelectContent>
              </Select>
              {state.errors?.assignedUserId && <p className="text-xs text-destructive mt-1">{state.errors.assignedUserId.join(", ")}</p>}
            </div>
            <div>
              <Label htmlFor="timerDuration-approve">Timer Duration (minutes)</Label>
               <div className="relative">
                <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="timerDuration-approve"
                  name="timerDuration"
                  type="number"
                  placeholder="e.g., 60"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(e.target.value)}
                  min="1"
                  className="pl-10"
                  required
                />
              </div>
              {state.errors?.timerDuration && <p className="text-xs text-destructive mt-1">{state.errors.timerDuration.join(", ")}</p>}
            </div>
          </div>

          {state.errors?._form && (
            <p className="text-sm text-destructive mt-2">{state.errors._form.join(", ")}</p>
          )}

          <DialogFooter className="pt-4">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
