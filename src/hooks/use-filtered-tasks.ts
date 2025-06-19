// src/hooks/use-filtered-tasks.ts
import { useMemo, useState } from 'react';
import type { Task, TaskPriority, TaskStatus } from '@/types';
import { parseISO } from 'date-fns';

interface UseFilteredTasksProps {
  initialTasks: Task[];
}

export type TaskSortOption = 'priority' | 'deadline' | 'status';

export function useFilteredTasks({ initialTasks }: UseFilteredTasksProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<TaskSortOption>('status');

  const filteredTasks = useMemo(() => {
    let tasks = [...initialTasks];

    if (searchTerm) {
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        // FIX: Handle potentially null description
        (task.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterPriority !== 'all') {
      tasks = tasks.filter(task => task.priority === filterPriority);
    }

    const statusOrderValue = (status: TaskStatus): number => {
      const order: Record<TaskStatus, number> = {
        'Overdue': 0, 'In Progress': 1, 'To Do': 2, 'Needs Changes': 3,
        'Pending Approval': 4, 'Completed': 5, 'Rejected': 6
      };
      return order[status] ?? 7;
    };

    const priorityOrderValue = (priority?: TaskPriority): number => {
        const order: Record<TaskPriority, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
        return priority ? order[priority] : 3;
    }

    tasks.sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                return priorityOrderValue(a.priority) - priorityOrderValue(b.priority);
            case 'deadline':
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime();
            case 'status':
            default:
                 if (statusOrderValue(a.status) !== statusOrderValue(b.status)) {
                    return statusOrderValue(a.status) - statusOrderValue(b.status);
                 }
                 if (!a.deadline) return 1;
                 if (!b.deadline) return -1;
                 return parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime();
        }
    });

    return tasks;
  }, [initialTasks, searchTerm, filterPriority, sortBy]);

  return {
    setSearchTerm,
    setFilterPriority,
    setSortBy,
    searchTerm,
    filterPriority,
    sortBy,
    filteredTasks,
  };
}