"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task, TaskStatus } from "@/types";
import { ListChecks, Clock3, CalendarClock, CheckCircle2, AlertTriangle, PlusCircle, Loader2 } from "lucide-react";
import { MyTaskItem } from "./my-tasks-card";
import { UpcomingDeadlineItem } from "./upcoming-deadlines-card";
import { useState } from "react";
import { isFuture, parseISO, differenceInDays } from 'date-fns';
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext"; 
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateUserTaskForm } from "./create-user-task-form";
import { Skeleton } from "../ui/skeleton";

export function DashboardPage() {
  const { currentUser } = useAuth();
  const { tasks, isLoadingTasks } = useTasks(); 
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  if (isLoadingTasks) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-56" /> {/* Adjusted width for new button text */}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  const myTasks = tasks.filter(task => {
    const isAssignedToMe = task.assignedUserId === Number(currentUser?.id) && 
                           (task.status === 'To Do' || task.status === 'In Progress' || task.status === 'Overdue');
    // User sees tasks they created that are pending or need their attention
    const isMyCreatedTaskNeedingAction = task.assignerId === Number(currentUser?.id) &&
                            (task.status === 'Pending Approval' || task.status === 'Needs Changes' || task.status === 'Rejected');
    return isAssignedToMe || isMyCreatedTaskNeedingAction;
  }).sort((a,b) => {
    const statusOrderValue = (status: TaskStatus) => {
      switch (status) {
        case 'Overdue': return 0;
        case 'In Progress': return 1;
        case 'To Do': return 2;
        case 'Needs Changes': return 3;
        case 'Pending Approval': return 4;
        case 'Completed': return 5;
        case 'Rejected': return 6;
        default: return 7;
      }
    };
    if (statusOrderValue(a.status) !== statusOrderValue(b.status)) {
      return statusOrderValue(a.status) - statusOrderValue(b.status);
    }
    return parseISO(a.deadline || '').getTime() - parseISO(b.deadline || '').getTime();
  })
  .slice(0, 10);

  const upcomingDeadlines = tasks
    .filter(task => task.deadline && isFuture(parseISO(task.deadline)) && differenceInDays(parseISO(task.deadline), new Date()) <= 7 && task.status !== 'Completed' && task.status !== 'Rejected' && task.assignedUserId === Number(currentUser?.id))
    .sort((a, b) => parseISO(a.deadline || '').getTime() - parseISO(b.deadline || '').getTime())
    .slice(0, 5);

  // Stats cards can show system-wide or user-specific, adjusting for clarity
  const myActiveAssignedTasksCount = tasks.filter(task => task.assignedUserId === Number(currentUser?.id) && (task.status === 'To Do' || task.status === 'In Progress')).length;
  const myPendingSubmissionsCount = tasks.filter(task => task.assignerId === Number(currentUser?.id) && (task.status === 'Pending Approval' || task.status === 'Needs Changes')).length;
  const myOverdueTasksCount = tasks.filter(task => task.status === 'Overdue' && task.assignedUserId === Number(currentUser?.id)).length;


  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold font-headline text-foreground">Dashboard</h1>
        {/* This button is for ANY user to submit a task idea for approval. */}
        {currentUser?.role === 'User' && (
          <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-5 w-5" /> Submit New Task Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Submit a New Task for Manager Approval</DialogTitle>
                <DialogDescription>
                  Describe the task you want to work on. This will be sent to a manager for review and assignment. You can suggest a deadline and priority.
                </DialogDescription>
              </DialogHeader>
              {/* This form is for user submissions, not direct admin creation */}
              <CreateUserTaskForm onSubmissionSuccess={() => setIsCreateTaskOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Active Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myActiveAssignedTasksCount}</div>
            <p className="text-xs text-muted-foreground">
              Currently assigned & active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Pending Submissions</CardTitle>
            <Clock3 className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myPendingSubmissionsCount}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting manager review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myOverdueTasksCount}</div>
            <p className="text-xs text-muted-foreground">
              Tasks past their deadline
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Upcoming Deadlines</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingDeadlines.length}</div>
            <p className="text-xs text-muted-foreground">
              Assigned to me, in next 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary" /> My Task List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.length > 0 ? myTasks.map(task => (
              <MyTaskItem key={task.id} task={task} />
            )) : <p className="text-sm text-muted-foreground">{currentUser ? 'No tasks found. Submit one or wait for assignments!' : 'Log in to see your tasks.'}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><CalendarClock className="mr-2 h-5 w-5 text-accent" /> My Assigned - Upcoming Deadlines (Next 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             {upcomingDeadlines.length > 0 ? upcomingDeadlines.map(task => (
              <UpcomingDeadlineItem key={task.id} task={task} />
            )) : <p className="text-sm text-muted-foreground">No personally assigned deadlines in the next 7 days.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    