// src/components/dashboard/task-board-view.tsx
import { DndContext, useDroppable, useDraggable, type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus } from '@/types';
import { MyTaskItem } from './my-tasks-card';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

interface TaskBoardViewProps {
  tasks: Task[];
  onStatusChange: (taskId: number, newStatus: TaskStatus) => void;
}

const STATUS_COLUMNS: TaskStatus[] = ['To Do', 'In Progress', 'Needs Changes', 'Overdue', 'Pending Approval'];

export function TaskBoardView({ tasks, onStatusChange }: TaskBoardViewProps) {
  // ENHANCEMENT: Use sensors for better dnd handling (e.g., keyboard support)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && over.data.current?.type === "COLUMN" && active.data.current?.task) {
        const taskId = active.id as number;
        const newStatus = over.id as TaskStatus;
        const originalStatus = active.data.current.task.status;

        if (originalStatus !== newStatus) {
            onStatusChange(taskId, newStatus);
        }
    }
  };

  const tasksByStatus = STATUS_COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter(task => task.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
                {STATUS_COLUMNS.map(status => (
                    <BoardColumn key={status} status={status} tasks={tasksByStatus[status]} />
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    </DndContext>
  );
}

function BoardColumn({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
    const { setNodeRef, isOver } = useDroppable({ 
      id: status,
      data: { type: 'COLUMN' }
    });

    return (
        <div ref={setNodeRef} className={`w-72 min-h-[500px] flex-shrink-0 rounded-lg p-2 transition-colors ${isOver ? 'bg-muted' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-between p-2 mb-2"><h3 className="font-semibold text-md">{status}</h3><span className="text-sm font-bold text-muted-foreground">{tasks.length}</span></div>
            <ScrollArea className="h-[450px] pr-2">
                 <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                        {tasks.map(task => (<SortableTask key={task.id} task={task} />))}
                        {tasks.length === 0 && <div className="text-center text-sm text-muted-foreground pt-10">Drop tasks here</div>}
                    </div>
                </SortableContext>
            </ScrollArea>
        </div>
    );
}

// FIX: Renamed to SortableTask and using useSortable hook instead of useDraggable
function SortableTask({ task }: { task: Task }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        data: { task }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <MyTaskItem task={task} />
        </div>
    );
}