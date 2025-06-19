"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";
import { isFuture, parseISO, differenceInDays } from 'date-fns';

// UI Components
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CreateUserTaskForm } from "./create-user-task-form";
import { TaskBoardView } from "./task-board-view";
import { MyTaskItem } from "./my-tasks-card";

// Icons
import { ListChecks, Clock3, CalendarClock, AlertTriangle, PlusCircle, LayoutGrid, List, Search } from "lucide-react";

// Hook
import { useFilteredTasks, type TaskSortOption } from "@/hooks/use-filtered-tasks";
import type { TaskPriority, Task } from "@/types";

export function DashboardPage() {
  const { currentUser } = useAuth();
  const { tasks, isLoadingTasks, updateTaskStatus } = useTasks();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // FIX: Ensure consistent type handling for user ID comparisons
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null;

  const myTasks = tasks.filter((task: Task) => {
    if (!currentUserId) return false;
    
    // Ensure task.assignedUserId and task.assignerId are numbers for comparison
    const assignedUserId = task.assignedUserId ? Number(task.assignedUserId) : null;
    const assignerId = task.assignerId ? Number(task.assignerId) : null;
    
    const isAssignedToMe = assignedUserId === currentUserId && (task.status === 'To Do' || task.status === 'In Progress' || task.status === 'Overdue');
    const isMyCreatedTaskNeedingAction = assignerId === currentUserId && (task.status === 'Pending Approval' || task.status === 'Needs Changes' || task.status === 'Rejected');
    return isAssignedToMe || isMyCreatedTaskNeedingAction;
  });

  const {
    filteredTasks,
    setSearchTerm,
    setFilterPriority,
    setSortBy,
    searchTerm,
    filterPriority,
    sortBy
  } = useFilteredTasks({ initialTasks: myTasks });

  const upcomingDeadlines = tasks
    .filter(task => {
      if (!task.deadline || !currentUserId) return false;
      const assignedUserId = task.assignedUserId ? Number(task.assignedUserId) : null;
      return isFuture(parseISO(task.deadline)) && 
             differenceInDays(parseISO(task.deadline), new Date()) <= 7 && 
             task.status !== 'Completed' && 
             task.status !== 'Rejected' && 
             assignedUserId === currentUserId;
    })
    .sort((a, b) => parseISO(a.deadline || '').getTime() - parseISO(b.deadline || '').getTime())
    .slice(0, 5);

  const myActiveAssignedTasksCount = tasks.filter(task => {
    const assignedUserId = task.assignedUserId ? Number(task.assignedUserId) : null;
    return assignedUserId === currentUserId && (task.status === 'To Do' || task.status === 'In Progress');
  }).length;

  const myPendingSubmissionsCount = tasks.filter(task => {
    const assignerId = task.assignerId ? Number(task.assignerId) : null;
    return assignerId === currentUserId && (task.status === 'Pending Approval' || task.status === 'Needs Changes');
  }).length;

  const myOverdueTasksCount = tasks.filter(task => {
    const assignedUserId = task.assignedUserId ? Number(task.assignedUserId) : null;
    return task.status === 'Overdue' && assignedUserId === currentUserId;
  }).length;

  if (isLoadingTasks) {
    return <div className="p-4 md:p-6 space-y-6">...</div>; // Skeleton remains the same
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold font-headline text-foreground">Dashboard</h1>
        {currentUser?.role === 'User' && (
          <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-5 w-5" /> 
                Submit New Task Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Submit a New Task for Manager Approval</DialogTitle>
                <DialogDescription>
                  Describe the task you want to work on. This will be sent to a manager for review and assignment.
                </DialogDescription>
              </DialogHeader>
              <CreateUserTaskForm onSubmissionSuccess={() => setIsCreateTaskOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">...</div> {/* KPI Cards remain the same */}

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search tasks..." 
                  className="pl-10" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <Select value={filterPriority} onValueChange={(value: TaskPriority | 'all') => setFilterPriority(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value: TaskSortOption) => setSortBy(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="deadline">Deadline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(value: 'list' | 'board') => value && setViewMode(value)} 
              aria-label="View mode"
            >
              <ToggleGroupItem value="list" aria-label="List view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="board" aria-label="Board view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>
      
      <div>
        {viewMode === 'list' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTasks.length > 0 ? (
              filteredTasks.map(task => (
                <MyTaskItem key={task.id} task={task} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground col-span-full">
                No tasks match your criteria.
              </p>
            )}
          </div>
        ) : (
          <TaskBoardView tasks={filteredTasks} onStatusChange={updateTaskStatus} />
        )}
      </div>
    </div>
  );
}