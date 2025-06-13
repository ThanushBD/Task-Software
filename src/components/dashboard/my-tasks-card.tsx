
"use client";

import type { Task, User } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskStatusBadge } from '@/components/task/task-status-badge';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { CalendarDays, User as UserIcon, TimerIcon, UserSquare, CircleUser, MessageSquareMore, Edit3, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { EditTaskDialog } from './edit-task-dialog'; 
import { useAuth } from '@/contexts/auth-context';
import { ScrollArea } from '../ui/scroll-area';

interface MyTaskItemProps {
  task: Task;
}

export function MyTaskItem({ task }: MyTaskItemProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { currentUser } = useAuth();

  const canEdit = task.status === "Needs Changes" && currentUser?.id === task.assignerId;
  const latestComment = task.comments && task.comments.length > 0 ? task.comments[task.comments.length - 1] : null;

  return (
    <>
      <Card className="hover:shadow-md transition-shadow duration-150">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-md font-semibold">{task.title}</CardTitle>
            <TaskStatusBadge status={task.status} />
          </div>
          <CardDescription className="text-xs text-muted-foreground pt-1 line-clamp-2">{task.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-3 space-y-1.5">
          {task.deadline && (
            <div className="text-xs text-muted-foreground flex items-center">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span>Due: {format(parseISO(task.deadline), "PPP")} ({formatDistanceToNow(parseISO(task.deadline), { addSuffix: true })})</span>
            </div>
          )}
          {task.assigneeName && task.status !== "Pending Approval" && task.status !== "Needs Changes" && task.status !== "Rejected" && (
             <div className="text-xs text-muted-foreground flex items-center">
              <UserIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              Assigned to: {task.assigneeName}
            </div>
          )}
          {task.assignerName && (
             <div className="text-xs text-muted-foreground flex items-center">
              {task.status === "Pending Approval" || task.status === "Needs Changes" || task.status === "Rejected" ? 
                <CircleUser className="mr-1.5 h-3.5 w-3.5 shrink-0" /> : 
                <UserSquare className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              }
              <span>
                { (task.status === "Pending Approval" || task.status === "Needs Changes" || task.status === "Rejected") ? "You created" : "Assigned by: "}
                { (task.status === "Pending Approval" || task.status === "Needs Changes" || task.status === "Rejected") ? "" : task.assignerName }
              </span>
            </div>
          )}
          {task.timerDuration > 0 && (
            <div className="text-xs text-muted-foreground flex items-center">
              <TimerIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span>Timer: {task.timerDuration} min</span>
            </div>
          )}
           {task.attachments && task.attachments.length > 0 && (
            <div className="text-xs text-muted-foreground flex items-center">
              <Paperclip className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span>{task.attachments.length} attachment{task.attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {latestComment && (task.status === "Needs Changes" || task.status === "Rejected") && ( // Show for rejected too if comments exist
            <div className="mt-2 p-2 bg-muted/50 rounded-md border border-muted text-xs">
              <p className="font-medium text-foreground flex items-center"><MessageSquareMore className="h-3.5 w-3.5 mr-1.5 shrink-0 text-orange-500"/>Latest Comment:</p>
              <ScrollArea className="h-12">
                <p className="italic text-muted-foreground">"{latestComment.comment}" - <span className="text-xs not-italic">{latestComment.userName}</span></p>
              </ScrollArea>
            </div>
          )}
        </CardContent>
        {canEdit && (
          <CardFooter className="pt-0 pb-3">
            <Button size="sm" variant="outline" onClick={() => setIsEditDialogOpen(true)} className="w-full">
              <Edit3 className="mr-2 h-4 w-4" /> Edit & Resubmit Task
            </Button>
          </CardFooter>
        )}
      </Card>
      {currentUser && canEdit && (
        <EditTaskDialog
          task={task}
          currentUser={currentUser}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}
    </>
  );
}
