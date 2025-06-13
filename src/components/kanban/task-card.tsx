
import type { Task } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskStatusBadge } from '@/components/task/task-status-badge';
import { ArrowDownUp, CalendarDays, User, TimerIcon, UserSquare, CircleUser, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const { title, description, status, deadline, priority, assigneeName, assignerName, timerDuration, attachments } = task;

  const formattedDeadline = deadline ? format(parseISO(deadline), 'MMM dd, yyyy') : 'No deadline';

  return (
    <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow duration-200_">
      <CardHeader className="pb-2"> {/* Reduced padding for header */}
        <CardTitle className="text-lg font-headline">{title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground pt-1 line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-2 pb-3"> {/* Adjusted padding for content */}
        <div className="flex items-center text-xs text-muted-foreground">
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          <span>Deadline: {formattedDeadline}</span>
        </div>
        {priority && (
          <div className="flex items-center text-xs text-muted-foreground">
            <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" />
            <span>Priority: {priority}</span>
          </div>
        )}
        {assigneeName && (
          <div className="flex items-center text-xs text-muted-foreground">
            <User className="mr-1.5 h-3.5 w-3.5" />
            <span>Assigned to: {assigneeName}</span>
          </div>
        )}
        {assignerName && (
           <div className="flex items-center text-xs text-muted-foreground">
            {status === "Pending Approval" || status === "Needs Changes" || status === "Rejected" ? 
              <CircleUser className="mr-1.5 h-3.5 w-3.5" /> : 
              <UserSquare className="mr-1.5 h-3.5 w-3.5" /> 
            }
            <span>
              {status === "Pending Approval" || status === "Needs Changes" || status === "Rejected" ? "Created by: " : "Assigned by: "}
              {assignerName}
            </span>
          </div>
        )}
        {timerDuration > 0 && ( 
          <div className="flex items-center text-xs text-muted-foreground">
            <TimerIcon className="mr-1.5 h-3.5 w-3.5" />
            <span>Timer: {timerDuration} min</span>
          </div>
        )}
        {attachments && attachments.length > 0 && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            <span>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2 pb-3"> {/* Adjusted padding for footer */}
        <TaskStatusBadge status={status} />
      </CardFooter>
    </Card>
  );
}
