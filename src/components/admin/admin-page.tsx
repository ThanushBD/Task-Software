"use client";

import React, { memo, useCallback, useMemo, useState, useEffect, useTransition } from "react";
import { CreateTaskForm } from "./create-task-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Task, User } from "@/types";
import { 
  ListPlus, 
  CheckSquare, 
  Hourglass, 
  MessageSquareWarning, 
  Ban, 
  UserCog, 
  Loader2, 
  BellRing, 
  AlertCircle,
  Users,
  Clock,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext"; 
import { useActionState } from "react";
import { 
  rejectTaskAction, 
  type RejectTaskActionState, 
  checkForOverdueTasksAction, 
  CheckOverdueTasksActionState 
} from "@/app/actions"; 
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Enhanced RejectTaskButton with better UX
const RejectTaskButton = memo(({ taskId, rejecterId }: { taskId: string; rejecterId: string }) => {
  const initialState: RejectTaskActionState = { success: false };
  const [state, formAction, isPending] = useActionState(rejectTaskAction, initialState);
  const { toast } = useToast();
  const { updateTask } = useTasks();

  useEffect(() => {
    if (!isPending && state.message) {
      toast({
        title: state.success ? "Task Rejected Successfully" : "Error Rejecting Task",
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
      if (state.success && state.task) { 
        updateTask(state.task.id, state.task);
      }
    }
  }, [state, toast, updateTask, isPending]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    formAction(new FormData(e.currentTarget as HTMLFormElement));
  }, [formAction]);

  return (
    <AlertDialog>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="rejecterId" value={rejecterId} />
        <AlertDialogTrigger asChild>
          <Button 
            type="button" 
            size="sm" 
            variant="ghost" 
            className="text-destructive hover:bg-destructive/10 transition-colors"
            disabled={isPending}
          >
            <Ban className="mr-2 h-4 w-4" /> 
            {isPending ? "Rejecting..." : "Reject"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Task Rejection</AlertDialogTitle>
            <AlertDialogDescription>
              This action will mark the task as 'Rejected' and notify the user. This action cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              type="submit" 
              className="bg-destructive hover:bg-destructive/90" 
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Confirm Rejection"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
          {state.errors?._form && (
            <div className="mt-2 p-2 bg-destructive/10 rounded border">
              <p className="text-xs text-destructive">{state.errors._form.join(", ")}</p>
            </div>
          )}
        </AlertDialogContent>
      </form>
    </AlertDialog>
  );
});

RejectTaskButton.displayName = "RejectTaskButton";

// Enhanced notification simulation with better feedback
const SimulateOverdueNotificationsButton = memo(() => {
  const initialCheckState: CheckOverdueTasksActionState = { 
    success: false, 
    overdueTasksFound: 0, 
    notificationMessages: [] 
  };
  const [checkState, checkFormAction, isCheckingPending] = useActionState(
    checkForOverdueTasksAction, 
    initialCheckState
  );
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (checkState.message && !isCheckingPending) { 
      toast({
        title: checkState.success ? "Overdue Check Complete" : "Overdue Check Failed",
        description: checkState.message,
        variant: checkState.success ? "default" : "destructive",
      });
    }
  }, [checkState, toast, isCheckingPending]);

  const handleSubmit = useCallback(() => {
    startTransition(() => {
      checkFormAction();
    });
  }, [checkFormAction]);

  return (
    <Card className="shadow-lg border-amber-200 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-6 w-6 text-amber-500" />
          Overdue Task Notifications
          <Badge variant="secondary" className="ml-auto">Simulation</Badge>
        </CardTitle>
        <CardDescription>
          Manually trigger a check for overdue tasks. This simulates sending email notifications 
          to managers and the CEO for relevant tasks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleSubmit}
          disabled={isCheckingPending || isPending} 
          className="w-full sm:w-auto"
          variant="outline"
        >
          {(isCheckingPending || isPending) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking for overdue tasks...
            </>
          ) : (
            <>
              <BellRing className="mr-2 h-4 w-4" />
              Check & Simulate Notifications
            </>
          )}
        </Button>

        {checkState.errors?._form && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <ShadAlertTitle>Error</ShadAlertTitle>
            <ShadAlertDesc>{checkState.errors._form.join(", ")}</ShadAlertDesc>
          </Alert>
        )}

        {!isCheckingPending && checkState.success && checkState.notificationMessages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-700 dark:text-green-300">
                Simulated Notifications Sent
              </h4>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <ul className="space-y-2 text-sm">
                {checkState.notificationMessages.map((msg, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-green-700 dark:text-green-300">{msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!isCheckingPending && checkState.success && checkState.overdueTasksFound === 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No overdue tasks found. All tasks are on track! 🎉
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

SimulateOverdueNotificationsButton.displayName = "SimulateOverdueNotificationsButton";

// Enhanced admin statistics component
const AdminStatistics = memo(({ tasks, allUsers }: { tasks: Task[]; allUsers: User[] }) => {
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const pendingApproval = tasks.filter(t => t.status === 'Pending Approval').length;
    const overdueTasks = tasks.filter(t => t.status === 'Overdue').length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const activeUsers = allUsers.filter(u => u.role === 'User').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      totalTasks,
      pendingApproval,
      overdueTasks,
      completedTasks,
      activeUsers,
      completionRate
    };
  }, [tasks, allUsers]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{stats.totalTasks}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-bold">{stats.pendingApproval}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold">{stats.overdueTasks}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</p>
              <Progress value={stats.completionRate} className="mt-1 h-1" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

AdminStatistics.displayName = "AdminStatistics";

// Enhanced task item for pending approval list
const PendingTaskItem = memo(({ 
  task, 
  currentUser, 
  onApprove, 
  onRequestRevisions 
}: {
  task: Task;
  currentUser: User;
  onApprove: (task: Task) => void;
  onRequestRevisions: (task: Task) => void;
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg leading-tight">{task.title}</h3>
              <TaskStatusBadge status={task.status} />
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-3">{task.description}</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>By: {task.assigner?.firstName} {task.assigner?.lastName}</span>
              </div>
              
              {task.suggestedDeadline && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Deadline: {format(parseISO(task.suggestedDeadline), "PPP")}</span>
                </div>
              )}
              
              {task.suggestedPriority && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Priority: {task.suggestedPriority}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 self-start">
            <Button 
              size="sm" 
              variant="default" 
              onClick={() => onApprove(task)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckSquare className="mr-2 h-4 w-4" /> 
              Approve & Assign
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onRequestRevisions(task)}
              className="text-orange-600 hover:bg-orange-500/10 border-orange-500/50 hover:border-orange-500"
            >
              <MessageSquareWarning className="mr-2 h-4 w-4" /> 
              Request Changes
            </Button>
            
            <RejectTaskButton 
              taskId={task.id} 
              rejecterId={currentUser.id.toString()} 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

PendingTaskItem.displayName = "PendingTaskItem";

export function AdminPage() {
  const { currentUser, allUsers } = useAuth();
  const { tasks, isLoadingTasks } = useTasks(); 
  const [selectedTaskForApproval, setSelectedTaskForApproval] = useState<Task | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [selectedTaskForRevisions, setSelectedTaskForRevisions] = useState<Task | null>(null);
  const [isRevisionsDialogOpen, setIsRevisionsDialogOpen] = useState(false);
  
  const assignableUsers = useMemo(() => 
    allUsers.filter(user => user.role === 'User'), 
    [allUsers]
  );

  const pendingApprovalTasks = useMemo(() => 
    tasks.filter(task => task.status === 'Pending Approval'), 
    [tasks]
  );

  const openApproveDialog = useCallback((task: Task) => {
    setSelectedTaskForApproval(task);
    setIsApproveDialogOpen(true);
  }, []);

  const openRevisionsDialog = useCallback((task: Task) => {
    setSelectedTaskForRevisions(task);
    setIsRevisionsDialogOpen(true);
  }, []);

  const handleApproveDialogClose = useCallback(() => {
    setIsApproveDialogOpen(false);
    setSelectedTaskForApproval(null);
  }, []);

  const handleRevisionsDialogClose = useCallback(() => {
    setIsRevisionsDialogOpen(false);
    setSelectedTaskForRevisions(null);
  }, []);

  // Access control
  if (!currentUser || currentUser.role !== 'Admin') {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ShadAlertTitle>Access Denied</ShadAlertTitle>
          <ShadAlertDesc>
            You must be an administrator to view this page. Please contact your system administrator.
          </ShadAlertDesc>
        </Alert>
      </div>
    );
  }

  // Loading state with enhanced skeletons
  if (isLoadingTasks) {
    return (
      <div className="p-4 md:p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-9 w-48" />
        </div>
        
        {/* Statistics skeletons */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-headline text-foreground flex items-center gap-3">
          <UserCog className="h-8 w-8 text-primary" />
          Admin Control Panel
        </h1>
        <Badge variant="outline" className="text-sm">
          {assignableUsers.length} Active Users
        </Badge>
      </div>
      
      {/* Statistics */}
      <AdminStatistics tasks={tasks} allUsers={allUsers} />
      
      {/* Direct Task Creation */}
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListPlus className="h-6 w-6 text-primary" />
            Create & Assign Task Directly
          </CardTitle>
          <CardDescription>
            As an admin, directly create a new task and assign it to an employee. 
            This task will be marked as 'To Do' and immediately available to the assignee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTaskForm assignableUsers={assignableUsers} />
        </CardContent>
      </Card>

      {/* Pending Approval Tasks */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="h-6 w-6 text-sky-500" />
              Review Task Submissions
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {pendingApprovalTasks.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Review tasks submitted by users. You can approve and assign them, request revisions, or reject them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingApprovalTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                All Caught Up!
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No tasks are currently pending your approval. New submissions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovalTasks.map(task => (
                <PendingTaskItem
                  key={task.id}
                  task={task}
                  currentUser={currentUser}
                  onApprove={openApproveDialog}
                  onRequestRevisions={openRevisionsDialog}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue Notifications */}
      <SimulateOverdueNotificationsButton />

      {/* Dialogs */}
      {selectedTaskForApproval && (
        <ApproveTaskDialog
          task={selectedTaskForApproval}
          approver={currentUser}
          assignableUsers={assignableUsers}
          isOpen={isApproveDialogOpen}
          onOpenChange={handleApproveDialogClose}
        />
      )}

      {selectedTaskForRevisions && (
        <RequestRevisionsDialog
          task={selectedTaskForRevisions}
          reviser={currentUser}
          isOpen={isRevisionsDialogOpen}
          onOpenChange={handleRevisionsDialogClose}
        />
      )}
    </div>
  );
}