import type { Task } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskStatusBadge } from '@/components/task/task-status-badge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpcomingDeadlineItemProps {
  task: Task;
}

export function UpcomingDeadlineItem({ task }: UpcomingDeadlineItemProps) {
  if (!task.deadline) return null;

  const deadlineDate = parseISO(task.deadline);
  const daysRemaining = differenceInDays(deadlineDate, new Date());
  const isUrgent = daysRemaining <= 3;

  return (
    <Card className={cn("hover:shadow-md transition-shadow duration-150", isUrgent && "border-destructive/50")}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-md font-semibold">{task.title}</CardTitle>
          {isUrgent && <AlertTriangle className="h-5 w-5 text-destructive" />}
        </div>
         <CardDescription className="text-xs text-muted-foreground pt-1">
          Due: {format(deadlineDate, 'MMMM dd, yyyy')} ({daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-3 flex justify-between items-center">
        <TaskStatusBadge status={task.status} />
        {task.priority && (
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            task.priority === "High" && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
            task.priority === "Medium" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
            task.priority === "Low" && "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
          )}>
            {task.priority} Priority
          </span>
        )}
      </CardContent>
    </Card>
  );
}
