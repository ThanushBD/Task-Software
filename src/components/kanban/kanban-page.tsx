
"use client";

import { TASK_STATUSES } from '@/lib/constants';
import type { Task } from '@/types';
import { KanbanColumn } from './kanban-column';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTasks } from '@/contexts/TaskContext'; // Import useTasks
import { Skeleton } from '../ui/skeleton';

export function KanbanPage() {
  const { tasks, isLoadingTasks } = useTasks(); // Get tasks from context
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoadingTasks) {
     return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[calc(100vh-200px)] w-[300px] rounded-lg" />)}
        </div>
      </div>
    );
  }

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold font-headline text-foreground">Kanban Board</h1>
        <div className="relative w-full sm:w-auto sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter tasks by title/description..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {TASK_STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={filteredTasks.filter(task => task.status === status)}
          />
        ))}
      </div>
    </div>
  );
}
