
"use client";

import { CreateTaskForm } from "./create-task-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Task, User } from "@/types";
import { ListPlus, CheckSquare, Hourglass, MessageSquareWarning, Ban, UserCog, Loader2, BellRing, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext"; 
import { useActionState, useEffect, useState, useTransition } from "react";
import { rejectTaskAction, type RejectTaskActionState, checkForOverdueTasksAction, CheckOverdueTasksActionState } from "@/app/actions"; 
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { TaskStatusBadge } from "../task/task-status-badge";
import { ApproveTaskDialog } from "./approve-task-dialog";
import { RequestRevisionsDialog } from "./request-revisions-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertTitle as ShadAlertTitle, AlertDescription as ShadAlertDesc } from "@/components/ui/alert"; 

function RejectTaskButton({ taskId, rejecterId }: { taskId: string; rejecterId: string }) {
  const initialState: RejectTaskActionState = { success: false };
  const [state, formAction, isPending] = useActionState(rejectTaskAction, initialState);
  const { toast } = useToast();
  const { updateTask } = useTasks();

  useEffect(() => {
    if (!isPending && state.message) { // Check isPending before showing toast
      toast({
        title: state.success ? "Success" : "Error Rejecting Task",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      if (state.success && state.task) { 
        updateTask(state.task);
      }
    }
  }, [state, toast, updateTask, isPending]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); formAction(new FormData(e.currentTarget)); }}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="rejecterId" value={rejecterId} />
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
          <Ban className="mr-2 h-4 w-4" /> Reject
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to reject this task?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will mark the task as 'Rejected' and cannot be easily undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction type="submit" className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
            {isPending ? "Rejecting..." : "Confirm Reject"}
          </AlertDialogAction>
        </AlertDialogFooter>
         {state.errors?._form && <p className="text-xs text-destructive mt-1 w-full text-right">{state.errors._form.join(", ")}</p>}
      </AlertDialogContent>
    </form>
  );
}

function SimulateOverdueNotificationsButton() {
  const initialCheckState: CheckOverdueTasksActionState = { success: false, overdueTasksFound: 0, notificationMessages: [] };
  const [checkState, checkFormAction, isCheckingPending] = useActionState(checkForOverdueTasksAction, initialCheckState);
  const { toast } = useToast();

  useEffect(() => {
    if (checkState.message && !isCheckingPending) { 
      toast({
        title: checkState.success ? "Overdue Check Complete" : "Overdue Check Error",
        description: checkState.message,
        variant: checkState.success ? "default" : "destructive",
      });
    }
  }, [checkState, toast, isCheckingPending]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <BellRing className="mr-2 h-6 w-6 text-amber-500" />
          Overdue Task Notifications (Simulation)
        </CardTitle>
        <CardDescription>
          Manually trigger a check for overdue tasks. This will simulate sending email notifications to managers and the CEO for relevant tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={checkFormAction}>
          <Button type="submit" disabled={isCheckingPending} className="w-full sm:w-auto">
            {isCheckingPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</> : "Check & Simulate Notifications"}
          </Button>
        </form>
        {checkState.errors?._form && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <ShadAlertTitle>Error</ShadAlertTitle>
              <ShadAlertDesc>{checkState.errors._form.join(", ")}</ShadAlertDesc>
            </Alert>
          )}
        { !isCheckingPending && checkState.success && checkState.notificationMessages.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Simulated Notifications Sent:</h4>
            <ul className="list-disc list-inside text-sm space-y-1 bg-muted p-3 rounded-md">
              {checkState.notificationMessages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
         {!isCheckingPending && checkState.success && checkState.overdueTasksFound === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">No overdue tasks found to notify.</p>
        )}
      </CardContent>
    </Card>
  );
}


export function AdminPage() {
  const { currentUser, allUsers } = useAuth();
  const { tasks, isLoadingTasks } = useTasks(); 
  
  const assignableUsers = allUsers.filter(user => user.role === 'user');

  const [selectedTaskForApproval, setSelectedTaskForApproval] = useState<Task | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);

  const [selectedTaskForRevisions, setSelectedTaskForRevisions] = useState<Task | null>(null);
  const [isRevisionsDialogOpen, setIsRevisionsDialogOpen] = useState(false);


  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ShadAlertTitle>Access Denied</ShadAlertTitle>
          <ShadAlertDesc>You must be an administrator to view this page.</ShadAlertDesc>
        </Alert>
      </div>
    );
  }

  if (isLoadingTasks) {
    return (
       <div className="p-4 md:p-6 space-y-8">
        <div className="flex items-center gap-3"> <Skeleton className="h-8 w-8 rounded-full" /> <Skeleton className="h-9 w-48" /> </div>
        <Skeleton className="h-96 w-full rounded-lg" /> {/* For Create Task Form */}
        <Skeleton className="h-64 w-full rounded-lg" /> {/* For Pending Approval Tasks */}
        <Skeleton className="h-48 w-full rounded-lg" /> {/* For Simulate Notifications Card */}
      </div>
    );
  }
  
  const pendingApprovalTasks = tasks.filter(task => task.status === 'Pending Approval');


  const openApproveDialog = (task: Task) => {
    setSelectedTaskForApproval(task);
    setIsApproveDialogOpen(true);
  };

  const openRevisionsDialog = (task: Task) => {
    setSelectedTaskForRevisions(task);
    setIsRevisionsDialogOpen(true);
  };


  return (
    <div className="p-4 md:p-6 space-y-8">
      <h1 className="text-3xl font-bold font-headline text-foreground flex items-center"><UserCog className="mr-3 h-8 w-8 text-primary"/>Admin Panel</h1>
      
      {/* This Card is for Admin's direct task creation and assignment */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListPlus className="mr-2 h-6 w-6 text-primary" />
            Admin: Create & Assign Task Directly
          </CardTitle>
          <CardDescription>
            As an admin, directly create a new task and assign it to an employee. This task will be marked 'To Do' immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTaskForm assignableUsers={assignableUsers} />
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Hourglass className="mr-2 h-6 w-6 text-sky-500" />
            Review User Task Submissions ({pendingApprovalTasks.length})
          </CardTitle>
          <CardDescription>
            Review tasks submitted by users. Approve (and assign), request revisions, or reject them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApprovalTasks.length === 0 ? (
            <p className="text-muted-foreground">No tasks are currently pending your approval.</p>
          ) : (
            <ul className="space-y-4">
              {pendingApprovalTasks.map(task => (
                <li key={task.id} className="p-4 border rounded-md bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-1">{task.description}</p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Submitted by: {task.assignerName}</p>
                        {task.suggestedDeadline && <p>Suggested Deadline: {format(parseISO(task.suggestedDeadline), "PPP")}</p>}
                        {task.suggestedPriority && <p>Suggested Priority: {task.suggestedPriority}</p>}
                    </div>
                     <div className="mt-2">
                        <TaskStatusBadge status={task.status} />
                     </div>
                  </div>
                  <AlertDialog> 
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3 sm:mt-0 self-start sm:self-center shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openApproveDialog(task)}>
                            <CheckSquare className="mr-2 h-4 w-4" /> Approve & Assign
                        </Button>
                        <Button size="sm" variant="outline" className="text-orange-600 hover:bg-orange-500/10 border-orange-500/50 hover:border-orange-500" onClick={() => openRevisionsDialog(task)}>
                            <MessageSquareWarning className="mr-2 h-4 w-4" /> Request Revisions
                        </Button>
                        {currentUser && <RejectTaskButton taskId={task.id} rejecterId={currentUser.id} />}
                    </div>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SimulateOverdueNotificationsButton />

      {selectedTaskForApproval && currentUser && (
        <ApproveTaskDialog
          task={selectedTaskForApproval}
          approver={currentUser}
          assignableUsers={assignableUsers}
          isOpen={isApproveDialogOpen}
          onOpenChange={setIsApproveDialogOpen}
        />
      )}

      {selectedTaskForRevisions && currentUser && (
        <RequestRevisionsDialog
          task={selectedTaskForRevisions}
          reviser={currentUser}
          isOpen={isRevisionsDialogOpen}
          onOpenChange={setIsRevisionsDialogOpen}
        />
      )}
    </div>
  );
}

    