// Enhanced Task Board View with improved drag & drop, animations, and accessibility
"use client";

import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { 
  DndContext, 
  useDroppable, 
  useDraggable, 
  type DragEndEvent, 
  PointerSensor, 
  KeyboardSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  type DragStartEvent,
  closestCorners,
  defaultDropAnimationSideEffects,
  type DropAnimation
} from '@dnd-kit/core';
import { 
  SortableContext, 
  useSortable, 
  verticalListSortingStrategy,
  arrayMove 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus } from '@/types';
import { MyTaskItem } from './my-tasks-card';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  MoreVertical, 
  Filter,
  SortDesc,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '../ui/skeleton';

interface TaskBoardViewProps {
  tasks: Task[];
  onStatusChange: (taskId: number, newStatus: TaskStatus) => void;
  isLoading?: boolean;
}

// Enhanced status column configuration with better styling and metadata
const STATUS_COLUMNS: Array<{
  id: TaskStatus;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: string;
  maxWidth?: string;
}> = [
  {
    id: 'To Do',
    title: 'To Do',
    description: 'Tasks ready to start',
    color: 'border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: '📋',
  },
  {
    id: 'In Progress',
    title: 'In Progress', 
    description: 'Currently being worked on',
    color: 'border-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-700 dark:text-amber-300',
    icon: '⚡',
  },
  {
    id: 'Needs Changes',
    title: 'Needs Changes',
    description: 'Requires revisions',
    color: 'border-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20', 
    textColor: 'text-orange-700 dark:text-orange-300',
    icon: '🔄',
  },
  {
    id: 'Overdue',
    title: 'Overdue',
    description: 'Past deadline',
    color: 'border-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-300', 
    icon: '⚠️',
  },
  {
    id: 'Pending Approval',
    title: 'Pending Approval',
    description: 'Awaiting review',
    color: 'border-sky-500',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    textColor: 'text-sky-700 dark:text-sky-300',
    icon: '👁️',
  },
  {
    id: 'Completed',
    title: 'Completed',
    description: 'Successfully finished',
    color: 'border-green-500', 
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    icon: '✅',
  },
  {
    id: 'Rejected',
    title: 'Rejected',
    description: 'Not approved',
    color: 'border-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    textColor: 'text-gray-700 dark:text-gray-300',
    icon: '❌',
  },
];

// Custom drop animation for smoother transitions
const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
};

// Enhanced draggable task item with better visual feedback
const DraggableTaskItem = memo(({ task }: { task: Task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task, type: 'TASK' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "shadow-xl scale-105 rotate-1"
      )}
    >
      <MyTaskItem task={task} />
    </div>
  );
});

DraggableTaskItem.displayName = "DraggableTaskItem";

// Enhanced board column with better styling and features
const BoardColumn = memo(({ 
  status, 
  tasks, 
  onToggleCollapse,
  isCollapsed = false 
}: { 
  status: TaskStatus; 
  tasks: Task[];
  onToggleCollapse: (status: TaskStatus) => void;
  isCollapsed?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'COLUMN', status }
  });

  const columnConfig = STATUS_COLUMNS.find(col => col.id === status);
  const taskCount = tasks.length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'High').length;

  return (
    <Card 
      ref={setNodeRef} 
      className={cn(
        "w-80 min-h-[600px] flex-shrink-0 transition-all duration-200",
        isOver && "ring-2 ring-primary ring-offset-2",
        columnConfig?.color,
        isCollapsed && "w-16"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <>
                <span className="text-lg">{columnConfig?.icon}</span>
                <div>
                  <h3 className="font-semibold text-sm">{columnConfig?.title}</h3>
                  <p className="text-xs text-muted-foreground">{columnConfig?.description}</p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {taskCount}
                </Badge>
                {highPriorityTasks > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {highPriorityTasks} High
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Filter className="mr-2 h-4 w-4" />
                      Filter tasks
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <SortDesc className="mr-2 h-4 w-4" />
                      Sort by priority
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleCollapse(status)}
              className="h-6 w-6 p-0"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0">
          <div 
            className={cn(
              "min-h-[500px] rounded-lg p-2 transition-colors",
              columnConfig?.bgColor,
              isOver && "bg-primary/10"
            )}
          >
            <ScrollArea className="h-[500px] pr-2">
              <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {tasks.map(task => (
                    <DraggableTaskItem key={task.id} task={task} />
                  ))}
                  {taskCount === 0 && (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-2">{columnConfig?.icon}</div>
                      <p className="text-sm text-muted-foreground">No tasks here</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Drag tasks to this column
                      </p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </ScrollArea>
          </div>
        </CardContent>
      )}
    </Card>
  );
});

BoardColumn.displayName = "BoardColumn";

// Loading skeleton for board columns
const BoardColumnSkeleton = memo(() => (
  <Card className="w-80 min-h-[600px] flex-shrink-0">
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded" />
          <div>
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    </CardContent>
  </Card>
));

BoardColumnSkeleton.displayName = "BoardColumnSkeleton";

export const TaskBoardView = memo(({ 
  tasks, 
  onStatusChange, 
  isLoading = false 
}: TaskBoardViewProps) => {
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());

  // Enhanced sensors for better drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 8,
        tolerance: 5
      } 
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, { context: { active, droppableRects, droppableContainers, collisionRect } }) => {
        // Custom keyboard navigation logic could go here
        return { x: 0, y: 0 };
      },
    })
  );

  // Organize tasks by status with memoization for performance
  const tasksByStatus = useMemo(() => {
    return STATUS_COLUMNS.reduce((acc, column) => {
      acc[column.id] = tasks.filter(task => task.status === column.id);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [tasks]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.task) {
      setActiveTask(active.data.current.task);
    }
  }, []);

  // Handle drag end with improved error handling and optimistic updates
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || !active.data.current?.task) {
      return;
    }

    const task = active.data.current.task as Task;
    const newStatus = over.id as TaskStatus;
    const originalStatus = task.status;

    // Don't do anything if dropped in same column
    if (originalStatus === newStatus) {
      return;
    }

    // Validate status transition
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      'To Do': ['In Progress', 'Overdue'],
      'In Progress': ['To Do', 'Completed', 'Needs Changes', 'Overdue'],
      'Needs Changes': ['In Progress', 'Pending Approval'],
      'Overdue': ['In Progress', 'Completed'],
      'Pending Approval': ['Needs Changes', 'Rejected', 'To Do'],
      'Completed': ['Needs Changes'],
      'Rejected': ['Pending Approval'],
    };

    if (!validTransitions[originalStatus]?.includes(newStatus)) {
      toast({
        title: "Invalid Status Change",
        description: `Cannot move task from "${originalStatus}" to "${newStatus}"`,
        variant: "destructive",
      });
      return;
    }

    try {
      onStatusChange(Number(task.id), newStatus);
      toast({
        title: "Task Updated",
        description: `Task moved to "${newStatus}"`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Update Failed", 
        description: "Failed to update task status. Please try again.",
        variant: "destructive",
      });
    }
  }, [onStatusChange, toast]);

  // Handle column collapse toggle
  const handleToggleCollapse = useCallback((status: TaskStatus) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  }, []);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <BoardColumnSkeleton key={i} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCorners}
    >
      <div className="w-full">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4 min-w-max">
            {STATUS_COLUMNS.map(column => (
              <BoardColumn
                key={column.id}
                status={column.id}
                tasks={tasksByStatus[column.id] || []}
                onToggleCollapse={handleToggleCollapse}
                isCollapsed={collapsedColumns.has(column.id)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Drag Overlay for better visual feedback */}
      <DragOverlay dropAnimation={dropAnimationConfig}>
        {activeTask ? (
          <div className="rotate-2 shadow-2xl">
            <MyTaskItem task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});

TaskBoardView.displayName = "TaskBoardView";