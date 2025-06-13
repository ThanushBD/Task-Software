
"use client";

import { useActionState, useEffect, useRef } from "react";
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
import { MessageSquareWarning, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTasks } from "@/contexts/TaskContext"; // Import useTasks

interface RequestRevisionsDialogProps {
  task: Task;
  reviser: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Submitting..." : <><MessageSquareWarning className="mr-2 h-4 w-4" /> Request Revisions</>}
    </Button>
  );
}

export function RequestRevisionsDialog({ task, reviser, isOpen, onOpenChange }: RequestRevisionsDialogProps) {
  const initialState: RequestRevisionsActionState = { success: false };
  const [state, formAction] = useActionState(requestRevisionsAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { updateTask } = useTasks(); // Get updateTask from context

  useEffect(() => {
    if (state.message) {
      toast({
        title: state.success ? "Success!" : "Error Requesting Revisions",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      if (state.success && state.task) { // Assuming action returns the updated task
        updateTask(state.task); // Update task in context and localStorage
        formRef.current?.reset();
        onOpenChange(false); 
      }
    }
  }, [state, toast, onOpenChange, updateTask]);
  
  useEffect(() => {
    if (isOpen) {
      formRef.current?.reset();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Revisions for: {task.title}</DialogTitle>
          <DialogDescription>
            Provide comments for the user ({task.assignerName}) on what needs to be changed. The task status will be set to "Needs Changes".
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} ref={formRef} className="space-y-4 py-4">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="reviserId" value={reviser.id} />

          <div>
            <Label htmlFor="comment">Revision Comments</Label>
            <Textarea
              id="comment"
              name="comment"
              placeholder="Explain what needs to be revised..."
              rows={5}
              required
            />
            {state.errors?.comment && <p className="text-xs text-destructive mt-1">{state.errors.comment.join(", ")}</p>}
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
