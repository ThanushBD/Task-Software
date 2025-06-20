"use client";

import React, { useState, useCallback, memo, useMemo } from 'react';
import type { Task, User, TaskStatus } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskStatusBadge } from '@/components/task/task-status-badge';
import { formatDistanceToNow, parseISO, format, isToday, isTomorrow, isPast } from 'date-fns';
import { 
  CalendarDays, 
  User as UserIcon, 
  TimerIcon, 
  UserSquare, 
  CircleUser, 
  MessageSquareMore, 
  Edit3, 
  Paperclip,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  MoreVertical,
  Play,
  Pause,
  Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EditTaskDialog } from './edit-task-dialog'; 
import { useAuth } from '@/contexts/auth-context';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MyTaskItemProps {
  task: Task;
}

// Priority color mapping
const PRIORITY_COLORS = {
  Low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-300' },
  Medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300' },
  High: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300' },
} as const;

// FIXED: Type-safe task status comparison
const isCompletedTask = (status: TaskStatus): boolean => {
  return status === 'Completed';
};

// Task urgency indicator based on deadline and status
const TaskUrgencyIndicator = memo(({ task }: { task: Task }) => {
  const urgency = useMemo(() => {
    if (!task.deadline || isCompletedTask(task.status) || task.status === 'Rejected') return null;
    
    const deadline = parseISO(task.deadline);
    const now = new Date();
    
    if (isPast(deadline) && !isCompletedTask(task.status)) {
      return { type: 'overdue', message: 'Overdue', color: 'text-red-600', icon: AlertTriangle };
    }
    
    if (isToday(deadline)) {
      return { type: 'today', message: 'Due today', color: 'text-orange-600', icon: Clock };
    }
    
    if (isTomorrow(deadline)) {
      return { type: 'tomorrow', message: 'Due tomorrow', color: 'text-yellow-600', icon: Calendar };
    }
    
    return null;
  }, [task.deadline, task.status]);

  if (!urgency) return null;

  return (
    <div className={cn("flex items-center gap-1 text-xs font-medium", urgency.color)}>
      <urgency.icon className="h-3 w-3" />
      <span>{urgency.message}</span>
    </div>
  );
});

TaskUrgencyIndicator.displayName = "TaskUrgencyIndicator";

// Enhanced metadata display
const TaskMetadata = memo(({ task }: { task: Task }) => (
  <div className="space-y-2 text-xs text-muted-foreground">
    {/* Deadline */}
    {task.deadline && (
      <div className="flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span>
          Due: {format(parseISO(task.deadline), "MMM dd, yyyy")} ({formatDistanceToNow(parseISO(task.deadline), { addSuffix: true })})
        </span>
      </div>
    )}

    {/* Assignee/Creator Info */}
    {task.assigneeName && !['Pending Approval', 'Needs Changes', 'Rejected'].includes(task.status) && (
      <div className="flex items-center gap-1.5">
        <UserIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Assigned to: {task.assigneeName}</span>
      </div>
    )}

    {task.assignerName && (
      <div className="flex items-center gap-1.5">
        {['Pending Approval', 'Needs Changes', 'Rejected'].includes(task.status) ? 
          <CircleUser className="h-3.5 w-3.5 shrink-0" /> : 
          <UserSquare className="h-3.5 w-3.5 shrink-0" />
        }
        <span>
          {['Pending Approval', 'Needs Changes', 'Rejected'].includes(task.status) ? 
            "Created by you" : 
            `Assigned by: ${task.assignerName}`
          }
        </span>
      </div>
    )}

    {/* Timer Duration */}
    {task.timerDuration && task.timerDuration > 0 && (
      <div className="flex items-center gap-1.5">
        <TimerIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Estimated: {task.timerDuration} min</span>
      </div>
    )}

    {/* Attachments */}
    {task.attachments && task.attachments.length > 0 && (
      <div className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5 shrink-0" />
        <span>{task.attachments.length} attachment{task.attachments.length > 1 ? 's' : ''}</span>
      </div>
    )}
  </div>
));

TaskMetadata.displayName = "TaskMetadata";

// Latest comment display for tasks needing attention
const LatestComment = memo(({ task }: { task: Task }) => {
  const latestComment = useMemo(() => 
    task.comments && task.comments.length > 0 ? task.comments[task.comments.length - 1] : null,
    [task.comments]
  );

  if (!latestComment || !['Needs Changes', 'Rejected'].includes(task.status)) return null;

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
      <MessageSquareMore className="h-4 w-4 text-orange-500" />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-medium text-orange-700 dark:text-orange-300 text-xs">
            Latest Feedback:
          </p>
          <ScrollArea className="max-h-16">
            <blockquote className="text-xs italic text-orange-600 dark:text-orange-400 border-l-2 border-orange-300 pl-2">
              "{latestComment.comment}"
            </blockquote>
          </ScrollArea>
          <div className="flex items-center gap-2 text-xs text-orange-500">
            <span>— {latestComment.userName}</span>
            <span>•</span>
            <span>{format(parseISO(latestComment.timestamp), "MMM dd 'at' h:mm a")}</span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
});

LatestComment.displayName = "LatestComment";

// Task actions menu
const TaskActionsMenu = memo(({ task }: { task: Task }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem className="cursor-pointer">
        <ExternalLink className="mr-2 h-4 w-4" />
        View Details
      </DropdownMenuItem>
      {task.status === 'In Progress' && (
        <>
          <DropdownMenuItem className="cursor-pointer">
            <Pause className="mr-2 h-4 w-4" />
            Pause Task
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      {task.status === 'To Do' && (
        <>
          <DropdownMenuItem className="cursor-pointer">
            <Play className="mr-2 h-4 w-4" />
            Start Task
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuItem className="cursor-pointer text-muted-foreground">
        <Archive className="mr-2 h-4 w-4" />
        Archive
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));

TaskActionsMenu.displayName = "TaskActionsMenu";

// Progress indicator for tasks
const TaskProgressIndicator = memo(({ task }: { task: Task }) => {
  const progress = useMemo(() => {
    switch (task.status) {
      case 'Completed': return 100;
      case 'In Progress': return 60;
      case 'To Do': return 20;
      case 'Overdue': return 40;
      case 'Pending Approval': return 10;
      case 'Needs Changes': return 30;
      case 'Rejected': return 0;
      default: return 0;
    }
  }, [task.status]);

  const progressColor = useMemo(() => {
    if (isCompletedTask(task.status)) return 'bg-green-500';
    if (task.status === 'Overdue' || task.status === 'Rejected') return 'bg-red-500';
    if (task.status === 'In Progress') return 'bg-blue-500';
    return 'bg-gray-400';
  }, [task.status]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">{progress}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div 
          className={cn("h-1.5 rounded-full transition-all duration-300", progressColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});

TaskProgressIndicator.displayName = "TaskProgressIndicator";

export const MyTaskItem = memo(({ task }: MyTaskItemProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { currentUser } = useAuth();

  const canEdit = useMemo(() => 
    task.status === "Needs Changes" && currentUser?.id === task.assignerId,
    [task.status, task.assignerId, currentUser?.id]
  );

  const handleEditClick = useCallback(() => {
    setIsEditDialogOpen(true);
  }, []);

  const cardVariant = useMemo(() => {
    if (task.status === 'Overdue') return 'border-red-200 shadow-red-100 dark:shadow-red-900/20';
    if (isCompletedTask(task.status)) return 'border-green-200 shadow-green-100 dark:shadow-green-900/20';
    if (task.status === 'In Progress') return 'border-blue-200 shadow-blue-100 dark:shadow-blue-900/20';
    if (task.status === 'Needs Changes') return 'border-orange-200 shadow-orange-100 dark:shadow-orange-900/20';
    return '';
  }, [task.status]);

  return (
    <>
      <Card className={cn(
        "hover:shadow-md transition-all duration-200 group relative overflow-hidden",
        cardVariant
      )}>
        {/* Priority indicator stripe */}
        {task.priority && (
          <div 
            className={cn(
              "absolute top-0 left-0 w-1 h-full",
              PRIORITY_COLORS[task.priority]?.bg.replace('bg-', 'bg-').replace('-100', '-500')
            )} 
          />
        )}

        <CardHeader className="pb-3 pl-5">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-sm font-semibold line-clamp-1">
                  {task.title}
                </CardTitle>
                <TaskUrgencyIndicator task={task} />
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <TaskStatusBadge status={task.status} />
                {task.priority && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            PRIORITY_COLORS[task.priority]?.bg,
                            PRIORITY_COLORS[task.priority]?.text,
                            PRIORITY_COLORS[task.priority]?.border
                          )}
                        >
                          <Target className="h-3 w-3 mr-1" />
                          {task.priority}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{task.priority} Priority Task</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            
            <TaskActionsMenu task={task} />
          </div>
          
          <CardDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pl-0">
            {task.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-3 space-y-3 pl-5">
          <TaskMetadata task={task} />
          
          <TaskProgressIndicator task={task} />
          
          {/* Latest Comment */}
          <LatestComment task={task} />
        </CardContent>

        {canEdit && (
          <>
            <Separator />
            <CardFooter className="pt-3 pb-3 pl-5">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleEditClick} 
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
              >
                <Edit3 className="mr-2 h-4 w-4" /> 
                Edit & Resubmit
              </Button>
            </CardFooter>
          </>
        )}
      </Card>

      {/* Edit Dialog */}
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
});

MyTaskItem.displayName = "MyTaskItem";