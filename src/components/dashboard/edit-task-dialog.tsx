
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { resubmitTaskAction, type ResubmitTaskActionState } from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTasks } from "@/contexts/TaskContext"; // Import useTasks

interface EditTaskDialogProps {
  task: Task;
  currentUser: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Resubmitting..." : <><Send className="mr-2 h-4 w-4" /> Resubmit for Approval</>}
    </Button>
  );
}

export function EditTaskDialog({ task, currentUser, isOpen, onOpenChange }: EditTaskDialogProps) {
  const initialState: ResubmitTaskActionState = { success: false, task: undefined };
  const [state, formAction] = useActionState(resubmitTaskAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { updateTask } = useTasks(); // Get updateTask from context

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Success!" : "Error Resubmitting Task",
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
      setTitle(task.title);
      setDescription(task.description);
      // Don't reset formRef here as it clears action state too early
    }
  }, [isOpen, task]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit & Resubmit Task: {task.title}</DialogTitle>
          <DialogDescription>
            Modify the task details below and resubmit for manager approval.
          </DialogDescription>
        </DialogHeader>
        {task.comments && task.comments.length > 0 && (
            <div className="my-4 p-3 bg-muted/50 rounded-md border border-muted">
                <h4 className="font-semibold text-sm mb-1">Manager Comments:</h4>
                {task.comments.slice(-1).map(comment => ( 
                    <blockquote key={comment.timestamp} className="text-sm text-muted-foreground italic border-l-2 pl-2">
                        "{comment.comment}" - <span className="text-xs not-italic">{comment.userName}</span>
                    </blockquote>
                ))}
            </div>
        )}
        <form action={formAction} ref={formRef} className="space-y-4 py-1">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="userId" value={currentUser.id} />

          <div>
            <Label htmlFor="title-edit">Task Title</Label>
            <Input
              id="title-edit"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {state.errors?.title && <p className="text-xs text-destructive mt-1">{state.errors.title.join(", ")}</p>}
          </div>

          <div>
            <Label htmlFor="description-edit">Description</Label>
            <Textarea
              id="description-edit"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
            />
            {state.errors?.description && <p className="text-xs text-destructive mt-1">{state.errors.description.join(", ")}</p>}
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
