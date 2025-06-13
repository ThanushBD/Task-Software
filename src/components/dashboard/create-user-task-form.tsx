
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createUserTaskAction, type UserCreateTaskActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Send, CalendarIcon, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext"; 

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types";
import { NO_PRIORITY_SELECTED_VALUE } from '@/lib/constants';


function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Submitting Task..." : <><Send className="mr-2 h-4 w-4" /> Submit for Manager Approval</>}
    </Button>
  );
}

export function CreateUserTaskForm({ onSubmissionSuccess }: { onSubmissionSuccess?: () => void }) {
  const initialState: UserCreateTaskActionState = { success: false };
  const [state, formAction] = useActionState(createUserTaskAction, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { currentUser } = useAuth();
  const { addTask } = useTasks(); 
  const [suggestedDeadline, setSuggestedDeadline] = useState<Date | undefined>();
  const [selectedSuggestedPriority, setSelectedSuggestedPriority] = useState<string>(NO_PRIORITY_SELECTED_VALUE);


  useEffect(() => {
    if (state.message) {
      if (state.success && state.task) {
        toast({
          title: "Task Submitted for Approval!",
          description: state.message,
          variant: "default",
        });
        addTask(state.task); 
        formRef.current?.reset();
        setSuggestedDeadline(undefined);
        setSelectedSuggestedPriority(NO_PRIORITY_SELECTED_VALUE); 
        if (onSubmissionSuccess) onSubmissionSuccess();
      } else if (!state.success) {
        toast({
          title: "Error Submitting Task",
          description: state.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      }
    }
  }, [state, toast, addTask, onSubmissionSuccess]);

  if (!currentUser) {
    return <p className="text-destructive p-4">Please log in to submit a task.</p>;
  }

  return (
    <form action={formAction} ref={formRef} className="space-y-4 pt-2">
        <input type="hidden" name="creatorId" value={currentUser.id} />
        <input type="hidden" name="creatorName" value={currentUser.name || currentUser.email} />

        <div>
            <Label htmlFor="title-user-submit">Task Title</Label>
            <Input id="title-user-submit" name="title" placeholder="e.g., Draft blog post about new feature" required />
            {state.errors?.title && <p className="text-xs text-destructive mt-1">{state.errors.title.join(", ")}</p>}
        </div>

        <div>
            <Label htmlFor="description-user-submit">Description</Label>
            <Textarea id="description-user-submit" name="description" placeholder="Provide a detailed description of the task..." rows={3} required />
            {state.errors?.description && <p className="text-xs text-destructive mt-1">{state.errors.description.join(", ")}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="suggestedDeadline-user-submit">Suggested Deadline (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="suggestedDeadline-user-submit-picker"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !suggestedDeadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {suggestedDeadline ? format(suggestedDeadline, "PPP") : 
                  <span className="text-muted-foreground">No date suggested</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={suggestedDeadline}
                  onSelect={setSuggestedDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <input type="hidden" name="suggestedDeadline" value={suggestedDeadline ? suggestedDeadline.toISOString() : ""} />
            {state.errors?.suggestedDeadline && <p className="text-xs text-destructive mt-1">{state.errors.suggestedDeadline.join(", ")}</p>}
          </div>

          <div>
            <Label htmlFor="suggestedPriority-user-submit">Suggested Priority (Optional)</Label>
            <Select name="suggestedPriority" value={selectedSuggestedPriority} onValueChange={setSelectedSuggestedPriority}>
              <SelectTrigger id="suggestedPriority-user-submit">
                <SelectValue placeholder="No suggestion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PRIORITY_SELECTED_VALUE}>None (No Suggestion)</SelectItem> 
                {(["Low", "Medium", "High"] as TaskPriority[]).map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.suggestedPriority && <p className="text-xs text-destructive mt-1">{state.errors.suggestedPriority.join(", ")}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="attachments-user">File Attachments (Conceptual)</Label>
          <div className="flex items-center gap-2 mt-1 p-3 border border-dashed rounded-md text-muted-foreground">
              <Paperclip className="h-5 w-5" />
              <span>Suggest files to attach. (Feature not implemented for actual upload)</span>
          </div>
          <Input id="attachments-user" name="attachments" type="file" className="sr-only" disabled multiple/>
          <p className="text-xs text-muted-foreground mt-1">Actual file uploading is not part of this submission process.</p>
        </div>
        
        {state.errors?._form && (
            <Alert variant="destructive" className="mt-2">
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
