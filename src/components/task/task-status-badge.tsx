"use client";

import React, { memo } from 'react';
import type { TaskStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  CircleDot, 
  LoaderCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Hourglass, 
  MessageSquareWarning, 
  Ban,
  Clock,
  Pause,
  RotateCcw
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showAnimation?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

// Enhanced status configuration with more detailed styling and behavior
const STATUS_CONFIG: Record<TaskStatus, {
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  animationClass?: string;
  priority: number; // For sorting
}> = {
  'To Do': {
    variant: 'default',
    className: 'bg-blue-500 text-white hover:bg-blue-600 border-blue-600 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 dark:border-blue-700',
    icon: CircleDot,
    label: 'To Do',
    description: 'Task is ready to be started',
    priority: 2,
  },
  'In Progress': {
    variant: 'secondary',
    className: 'bg-amber-500 text-black hover:bg-amber-600 border-amber-600 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-500 dark:border-amber-500',
    icon: LoaderCircle,
    label: 'In Progress',
    description: 'Task is currently being worked on',
    animationClass: 'animate-spin',
    priority: 1,
  },
  'Completed': {
    variant: 'secondary',
    className: 'bg-green-500 text-white hover:bg-green-600 border-green-600 dark:bg-green-600 dark:text-white dark:hover:bg-green-700 dark:border-green-700',
    icon: CheckCircle2,
    label: 'Completed',
    description: 'Task has been successfully finished',
    priority: 5,
  },
  'Overdue': {
    variant: 'destructive',
    className: 'bg-red-500 text-white hover:bg-red-600 border-red-600 dark:bg-red-600 dark:text-white dark:hover:bg-red-700 dark:border-red-700',
    icon: AlertTriangle,
    label: 'Overdue',
    description: 'Task is past its deadline and needs immediate attention',
    animationClass: 'animate-pulse',
    priority: 0,
  },
  'Pending Approval': {
    variant: 'secondary',
    className: 'bg-sky-500 text-white hover:bg-sky-600 border-sky-600 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-700 dark:border-sky-700',
    icon: Hourglass,
    label: 'Pending Approval',
    description: 'Task is waiting for manager review and approval',
    animationClass: 'animate-pulse',
    priority: 4,
  },
  'Needs Changes': {
    variant: 'secondary',
    className: 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-700 dark:border-orange-700',
    icon: MessageSquareWarning,
    label: 'Needs Changes',
    description: 'Task requires revisions based on feedback',
    priority: 3,
  },
  'Rejected': {
    variant: 'destructive',
    className: 'bg-slate-500 text-white hover:bg-slate-600 border-slate-600 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-700 dark:border-slate-700',
    icon: Ban,
    label: 'Rejected',
    description: 'Task was not approved and has been rejected',
    priority: 6,
  },
};

// Size configurations
const SIZE_CONFIG = {
  sm: {
    badgeClass: 'text-xs px-2 py-0.5 h-5',
    iconClass: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    badgeClass: 'text-sm px-2.5 py-1 h-6',
    iconClass: 'h-3.5 w-3.5',
    gap: 'gap-1.5',
  },
  lg: {
    badgeClass: 'text-sm px-3 py-1.5 h-8',
    iconClass: 'h-4 w-4',
    gap: 'gap-2',
  },
};

export const TaskStatusBadge = memo(({
  status,
  size = 'md',
  showIcon = true,
  showAnimation = true,
  interactive = false,
  className,
  onClick,
}: TaskStatusBadgeProps) => {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];
  
  if (!config) {
    console.warn(`Unknown task status: ${status}`);
    return (
      <Badge variant="outline" className={cn("capitalize", className)}>
        {status}
      </Badge>
    );
  }

  const IconComponent = config.icon;
  const shouldAnimate = showAnimation && config.animationClass;
  
  const badgeContent = (
    <Badge
      variant={config.variant}
      className={cn(
        "capitalize flex items-center font-medium transition-all duration-200",
        sizeConfig.badgeClass,
        sizeConfig.gap,
        config.className,
        interactive && "cursor-pointer hover:scale-105 active:scale-95",
        shouldAnimate && "relative overflow-hidden",
        className
      )}
      onClick={onClick}
    >
      {/* Animated background for special states */}
      {shouldAnimate && (status === 'Overdue' || status === 'Pending Approval') && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer" />
      )}
      
      {showIcon && (
        <IconComponent 
          className={cn(
            sizeConfig.iconClass,
            shouldAnimate && config.animationClass,
            // Special handling for spinning icons
            (status === 'In Progress' || status === 'Pending Approval') && showAnimation ? 'animate-spin' : ''
          )} 
        />
      )}
      
      <span className="relative z-10">{config.label}</span>
    </Badge>
  );

  // Wrap with tooltip if not interactive (to avoid conflicts)
  if (!interactive) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {config.description}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
});

TaskStatusBadge.displayName = "TaskStatusBadge";

// Utility component for status transitions
export const TaskStatusTransition = memo(({ 
  fromStatus, 
  toStatus,
  className 
}: {
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  className?: string;
}) => (
  <div className={cn("flex items-center gap-2", className)}>
    <TaskStatusBadge status={fromStatus} size="sm" />
    <RotateCcw className="h-3 w-3 text-muted-foreground" />
    <TaskStatusBadge status={toStatus} size="sm" />
  </div>
));

TaskStatusTransition.displayName = "TaskStatusTransition";

// Component for displaying multiple statuses (e.g., in filters)
export const TaskStatusGroup = memo(({ 
  statuses, 
  counts,
  onStatusClick,
  className 
}: {
  statuses: TaskStatus[];
  counts?: Record<TaskStatus, number>;
  onStatusClick?: (status: TaskStatus) => void;
  className?: string;
}) => {
  // Sort statuses by priority
  const sortedStatuses = [...statuses].sort((a, b) => 
    STATUS_CONFIG[a].priority - STATUS_CONFIG[b].priority
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {sortedStatuses.map(status => (
        <div key={status} className="flex items-center gap-1">
          <TaskStatusBadge 
            status={status} 
            size="sm"
            interactive={!!onStatusClick}
            onClick={() => onStatusClick?.(status)}
          />
          {counts && counts[status] !== undefined && (
            <span className="text-xs text-muted-foreground ml-1">
              {counts[status]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

TaskStatusGroup.displayName = "TaskStatusGroup";

// Status progress indicator
export const TaskStatusProgress = memo(({ 
  status,
  showPercentage = true,
  className 
}: {
  status: TaskStatus;
  showPercentage?: boolean;
  className?: string;
}) => {
  const progressValues: Record<TaskStatus, number> = {
    'To Do': 0,
    'In Progress': 50,
    'Needs Changes': 25,
    'Pending Approval': 75,
    'Completed': 100,
    'Overdue': 40,
    'Rejected': 0,
  };

  const progress = progressValues[status];
  const config = STATUS_CONFIG[status];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center">
        <TaskStatusBadge status={status} size="sm" />
        {showPercentage && (
          <span className="text-xs text-muted-foreground">
            {progress}%
          </span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className={cn(
            "h-2 rounded-full transition-all duration-500",
            config.className.includes('bg-') 
              ? config.className.split(' ').find(c => c.startsWith('bg-'))?.replace('bg-', 'bg-') 
              : 'bg-primary'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});

TaskStatusProgress.displayName = "TaskStatusProgress";

// Export status configuration for use in other components
export { STATUS_CONFIG };

// Utility function to get next possible statuses for a given status
export const getNextPossibleStatuses = (currentStatus: TaskStatus): TaskStatus[] => {
  const transitions: Record<TaskStatus, TaskStatus[]> = {
    'To Do': ['In Progress', 'Overdue'],
    'In Progress': ['Completed', 'Needs Changes', 'Overdue', 'To Do'],
    'Needs Changes': ['To Do', 'In Progress', 'Pending Approval'],
    'Overdue': ['In Progress', 'Completed'],
    'Pending Approval': ['To Do', 'Needs Changes', 'Rejected'],
    'Completed': ['Needs Changes'], // In case of reopening
    'Rejected': ['Pending Approval'], // In case of resubmission
  };

  return transitions[currentStatus] || [];
};

// Utility function to check if a status transition is valid
export const isValidStatusTransition = (from: TaskStatus, to: TaskStatus): boolean => {
  return getNextPossibleStatuses(from).includes(to);
};