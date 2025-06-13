import type { Task, TaskStatus } from '@/types';
import { TaskCard } from './task-card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
}

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-[300px] max-w-[360px] bg-muted/50 p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4 text-foreground font-headline capitalize">{status} ({tasks.length})</h2>
      <ScrollArea className="h-[calc(100vh-200px)] pr-3"> {/* Adjust height as needed */}
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No tasks in this stage.</p>
        ) : (
          tasks.map(task => <TaskCard key={task.id} task={task} />)
        )}
      </ScrollArea>
    </div>
  );
}
