"use client";

import React, { memo, useMemo } from 'react';
import type { Task } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskStatusBadge } from '@/components/task/task-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  format, 
  parseISO, 
  differenceInDays, 
  differenceInHours, 
  isToday, 
  isTomorrow, 
  isYesterday,
  isPast
} from 'date-fns';
import { 
  AlertTriangle, 
  CalendarClock, 
  Clock, 
  Timer, 
  Target, 
  ExternalLink,
  Zap,
  Coffee,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UpcomingDeadlineItemProps {
  task: Task;
  showActions?: boolean;
  compact?: boolean;
}

// Deadline urgency calculator
const calculateUrgency = (deadline: Date) => {
  const now = new Date();
  const daysRemaining = differenceInDays(deadline, now);
  const hoursRemaining = differenceInHours(deadline, now);

  if (isPast(deadline)) {
    return {
      level: 'overdue' as const,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-300',
      icon: AlertTriangle,
      label: isYesterday(deadline) ? 'Yesterday' : `${Math.abs(daysRemaining)} days overdue`,
      priority: 4
    };
  }

  if (isToday(deadline)) {
    return {
      level: 'today' as const,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-300',
      icon: Zap,
      label: hoursRemaining <= 2 ? `${hoursRemaining}h remaining` : 'Due today',
      priority: 3
    };
  }

  if (isTomorrow(deadline)) {
    return {
      level: 'tomorrow' as const,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-300',
      icon: Clock,
      label: 'Due tomorrow',
      priority: 2
    };
  }

  if (daysRemaining <= 7) {
    return {
      level: 'week' as const,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-300',
      icon: Calendar,
      label: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`,
      priority: 1
    };
  }

  return {
    level: 'normal' as const,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/20',
    borderColor: 'border-muted',
    icon: CalendarClock,
    label: `${daysRemaining} days left`,
    priority: 0
  };
};

// Progress calculation based on time elapsed
const calculateTimeProgress = (task: Task) => {
  if (!task.deadline || !task.createdAt) return 0;
  
  const created = parseISO(task.createdAt);
  const deadline = parseISO(task.deadline);
  const now = new Date();
  
  const totalTime = differenceInHours(deadline, created);
  const elapsedTime = differenceInHours(now, created);
  
  if (totalTime <= 0) return 100;
  
  const progress = Math.min((elapsedTime / totalTime) * 100, 100);
  return Math.max(progress, 0);
};

// Enhanced deadline item component
export const UpcomingDeadlineItem = memo(({ 
  task, 
  showActions = true, 
  compact = false 
}: UpcomingDeadlineItemProps) => {
  const deadlineInfo = useMemo(() => {
    if (!task.deadline) return null;
    
    const deadline = parseISO(task.deadline);
    const urgency = calculateUrgency(deadline);
    const timeProgress = calculateTimeProgress(task);
    
    return {
      deadline,
      urgency,
      timeProgress,
      formattedDate: format(deadline, "EEE, MMM dd 'at' h:mm a"),
      shortDate: format(deadline, "MMM dd"),
    };
  }, [task.deadline, task.createdAt]);

  if (!deadlineInfo) return null;

  const { deadline, urgency, timeProgress, formattedDate, shortDate } = deadlineInfo;

  if (compact) {
    return (
      <div className={cn(
        "flex items-center justify-between p-3 rounded-lg border-l-4 transition-colors",
        urgency.bgColor,
        urgency.borderColor
      )}>
        <div className="flex items-center gap-3">
          <urgency.icon className={cn("h-4 w-4", urgency.color)} />
          <div>
            <p className="font-medium text-sm line-clamp-1">{task.title}</p>
            <p className={cn("text-xs", urgency.color)}>{urgency.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TaskStatusBadge status={task.status} />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "hover:shadow-md transition-all duration-200 relative overflow-hidden",
      urgency.level === 'overdue' && "ring-1 ring-red-200",
      urgency.level === 'today' && "ring-1 ring-orange-200"
    )}>
      {/* Urgency indicator stripe */}
      <div 
        className={cn(
          "absolute top-0 left-0 w-1 h-full",
          urgency.color.replace('text-', 'bg-').replace('-600', '-500')
        )} 
      />

      <CardHeader className="pb-3 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <urgency.icon className={cn("h-4 w-4", urgency.color)} />
              <span className={cn("text-sm font-medium", urgency.color)}>
                {urgency.label}
              </span>
            </div>
            
            <CardTitle className="text-base font-semibold line-clamp-1 mb-1">
              {task.title}
            </CardTitle>
            
            <CardDescription className="text-xs text-muted-foreground">
              {formattedDate}
            </CardDescription>
          </div>
          
          {urgency.level === 'overdue' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    OVERDUE
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This task is past its deadline</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4 space-y-3 pl-5">
        {/* Task metadata */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <TaskStatusBadge status={task.status} />
            
            {task.priority && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  task.priority === "High" && "border-red-300 text-red-700 bg-red-50",
                  task.priority === "Medium" && "border-yellow-300 text-yellow-700 bg-yellow-50",
                  task.priority === "Low" && "border-green-300 text-green-700 bg-green-50"
                )}
              >
                <Target className="h-3 w-3 mr-1" />
                {task.priority}
              </Badge>
            )}
          </div>
          
          {task.timerDuration && task.timerDuration > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>{task.timerDuration}m</span>
            </div>
          )}
        </div>

        {/* Time progress indicator */}
        {timeProgress > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Time elapsed</span>
              <span className={cn(
                "font-medium",
                timeProgress > 90 ? urgency.color : "text-muted-foreground"
              )}>
                {Math.round(timeProgress)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  timeProgress > 90 ? urgency.color.replace('text-', 'bg-') : "bg-primary"
                )}
                style={{ width: `${Math.min(timeProgress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Urgency-specific alerts */}
        {urgency.level === 'overdue' && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 py-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700 dark:text-red-300 text-xs">
              This task is overdue and needs immediate attention
            </AlertDescription>
          </Alert>
        )}

        {urgency.level === 'today' && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 py-2">
            <Zap className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700 dark:text-orange-300 text-xs">
              Due today - prioritize this task
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Task
            </Button>
            
            {urgency.level === 'overdue' && (
              <Button variant="destructive" size="sm" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Address Now
              </Button>
            )}
            
            {urgency.level === 'today' && (
              <Button variant="default" size="sm" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

UpcomingDeadlineItem.displayName = "UpcomingDeadlineItem";

// Enhanced upcoming deadlines list component
export const UpcomingDeadlinesList = memo(({ 
  tasks, 
  maxItems = 5,
  showEmpty = true 
}: {
  tasks: Task[];
  maxItems?: number;
  showEmpty?: boolean;
}) => {
  const sortedTasks = useMemo(() => {
    return tasks
      .filter(task => task.deadline)
      .map(task => ({
        ...task,
        urgency: calculateUrgency(parseISO(task.deadline!))
      }))
      .sort((a, b) => {
        // Sort by urgency priority (higher priority first), then by deadline
        if (a.urgency.priority !== b.urgency.priority) {
          return b.urgency.priority - a.urgency.priority;
        }
        return parseISO(a.deadline!).getTime() - parseISO(b.deadline!).getTime();
      })
      .slice(0, maxItems);
  }, [tasks, maxItems]);

  if (sortedTasks.length === 0 && !showEmpty) {
    return null;
  }

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <Coffee className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-sm font-medium text-muted-foreground mb-1">
          No upcoming deadlines
        </h3>
        <p className="text-xs text-muted-foreground">
          You're all caught up! 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedTasks.map(task => (
        <UpcomingDeadlineItem key={task.id} task={task} />
      ))}
      
      {tasks.length > maxItems && (
        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            View {tasks.length - maxItems} more deadline{tasks.length - maxItems !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
});

UpcomingDeadlinesList.displayName = "UpcomingDeadlinesList";