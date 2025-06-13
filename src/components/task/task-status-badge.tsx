
import type { TaskStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CircleDot, LoaderCircle, CheckCircle2, AlertTriangle, Hourglass, MessageSquareWarning, Ban } from 'lucide-react';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let className = "";
  let IconComponent = CircleDot;

  switch (status) {
    case 'To Do':
      variant = 'default'; // Uses primary color
      IconComponent = CircleDot;
      className = 'bg-primary/80 text-primary-foreground border-primary';
      break;
    case 'In Progress':
      variant = 'secondary';
      className = 'bg-amber-500 text-black hover:bg-amber-600 border-amber-600 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-500 dark:border-amber-500';
      IconComponent = LoaderCircle; // Add animate-spin in usage if desired
      break;
    case 'Completed':
      variant = 'secondary';
      className = 'bg-green-500 text-white hover:bg-green-600 border-green-600 dark:bg-green-600 dark:text-white dark:hover:bg-green-700 dark:border-green-700';
      IconComponent = CheckCircle2;
      break;
    case 'Overdue':
      variant = 'destructive';
      IconComponent = AlertTriangle;
      className = 'bg-destructive/80 text-destructive-foreground border-destructive';
      break;
    case 'Pending Approval':
      variant = 'secondary';
      IconComponent = Hourglass;
      className = 'bg-sky-500 text-white hover:bg-sky-600 border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-700 dark:border-sky-700';
      break;
    case 'Needs Changes':
      variant = 'secondary';
      IconComponent = MessageSquareWarning;
      className = 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-700 dark:border-orange-700';
      break;
    case 'Rejected':
      variant = 'destructive';
      IconComponent = Ban;
      className = 'bg-slate-500 text-white hover:bg-slate-600 border-slate-600 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-700 dark:border-slate-700';
      break;
  }

  return (
    <Badge variant={variant} className={cn("capitalize flex items-center gap-1.5", className)}>
      <IconComponent className={cn("h-3.5 w-3.5", status === 'In Progress' || status === 'Pending Approval' ? 'animate-spin' : '')} />
      {status}
    </Badge>
  );
}

