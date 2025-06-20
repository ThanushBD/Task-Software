"use client";

import React, { useState, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";
import { isFuture, parseISO, differenceInDays, isToday, isTomorrow, isPast } from 'date-fns';

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

// Components
import { CreateUserTaskForm } from "./create-user-task-form";
import { TaskBoardView } from "./task-board-view";
import { MyTaskItem } from "./my-tasks-card";
import { UpcomingDeadlineItem } from "./upcoming-deadlines-card";

// Icons
import { 
  ListChecks, 
  Clock3, 
  CalendarClock, 
  AlertTriangle, 
  PlusCircle, 
  LayoutGrid, 
  List, 
  Search,
  TrendingUp,
  CheckCircle2,
  Timer,
  Calendar,
  Filter,
  SortAsc,
  BarChart3,
  Target,
  Zap,
  Coffee,
  Brain
} from "lucide-react";

// Hook
// import { useFilteredTasks, type TaskSortOption } from "@/hooks/use-filtered-tasks";
import type { TaskPriority, Task } from "@/types";
import { cn } from "@/lib/utils";

// Move TaskSortOption type above FilterControls for clarity
type TaskSortOption = 'status' | 'priority' | 'deadline';

// Enhanced KPI card component
const KPICard = memo(({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  color = "text-foreground",
  bgColor = "bg-card"
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  color?: string;
  bgColor?: string;
}) => (
  <Card className={cn("hover:shadow-md transition-all duration-200", bgColor)}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            {trend && (
              <Badge 
                variant={trend.direction === 'up' ? 'default' : trend.direction === 'down' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'} {Math.abs(trend.value)}%
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={cn("p-2 rounded-lg", bgColor)}>
          <Icon className={cn("h-6 w-6", color)} />
        </div>
      </div>
    </CardContent>
  </Card>
));

KPICard.displayName = "KPICard";

// Enhanced task insights component
const TaskInsights = memo(({ tasks, currentUserId }: { tasks: Task[]; currentUserId: number }) => {
  const insights = useMemo(() => {
    const myTasks = tasks.filter(task => 
      Number(task.assignedUserId) === currentUserId || Number(task.assignerId) === currentUserId
    );

    const completed = myTasks.filter(t => t.status === 'Completed').length;
    const overdue = myTasks.filter(t => t.status === 'Overdue').length;
    const inProgress = myTasks.filter(t => t.status === 'In Progress').length;
    const total = myTasks.length;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const overdueRate = total > 0 ? (overdue / total) * 100 : 0;

    const urgentTasks = myTasks.filter(t => 
      t.priority === 'High' && (t.status === 'To Do' || t.status === 'In Progress')
    ).length;

    const dueTodayTasks = myTasks.filter(t => 
      t.deadline && isToday(parseISO(t.deadline)) && t.status !== 'Completed'
    ).length;

    const dueTomorrowTasks = myTasks.filter(t => 
      t.deadline && isTomorrow(parseISO(t.deadline)) && t.status !== 'Completed'
    ).length;

    return {
      total,
      completed,
      overdue,
      inProgress,
      completionRate,
      overdueRate,
      urgentTasks,
      dueTodayTasks,
      dueTomorrowTasks
    };
  }, [tasks, currentUserId]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Active Tasks"
        value={insights.inProgress}
        description="Currently in progress"
        icon={Timer}
        color="text-amber-600"
        bgColor="bg-amber-50 dark:bg-amber-900/20"
      />
      
      <KPICard
        title="Completion Rate"
        value={`${insights.completionRate.toFixed(1)}%`}
        description="Tasks completed successfully"
        icon={CheckCircle2}
        color="text-green-600"
        bgColor="bg-green-50 dark:bg-green-900/20"
        trend={{ value: 12, direction: 'up' }}
      />
      
      <KPICard
        title="Urgent Tasks"
        value={insights.urgentTasks}
        description="High priority items"
        icon={Zap}
        color="text-red-600"
        bgColor="bg-red-50 dark:bg-red-900/20"
      />
      
      <KPICard
        title="Due Soon"
        value={insights.dueTodayTasks + insights.dueTomorrowTasks}
        description="Today + tomorrow"
        icon={Calendar}
        color="text-blue-600"
        bgColor="bg-blue-50 dark:bg-blue-900/20"
      />
    </div>
  );
});

TaskInsights.displayName = "TaskInsights";

// Enhanced productivity tips component
const ProductivityTips = memo(({ tasks, currentUserId }: { tasks: Task[]; currentUserId: number }) => {
  const tips = useMemo(() => {
    const myTasks = tasks.filter(task => 
      Number(task.assignedUserId) === currentUserId && (task.status === 'To Do' || task.status === 'In Progress')
    );

    const overdueTasks = myTasks.filter(t => t.status === 'Overdue').length;
    const highPriorityTasks = myTasks.filter(t => t.priority === 'High').length;
    const dueTodayTasks = myTasks.filter(t => 
      t.deadline && isToday(parseISO(t.deadline))
    ).length;

    const tips = [];

    if (overdueTasks > 0) {
      tips.push({
        icon: AlertTriangle,
        title: "Address Overdue Tasks",
        description: `You have ${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}. Consider prioritizing these first.`,
        color: "text-red-600",
        bgColor: "bg-red-50 dark:bg-red-900/20"
      });
    }

    if (highPriorityTasks > 2) {
      tips.push({
        icon: Target,
        title: "Focus on High Priority",
        description: `${highPriorityTasks} high-priority tasks need attention. Consider tackling 2-3 per day.`,
        color: "text-orange-600",
        bgColor: "bg-orange-50 dark:bg-orange-900/20"
      });
    }

    if (dueTodayTasks > 0) {
      tips.push({
        icon: Clock3,
        title: "Today's Focus",
        description: `${dueTodayTasks} task${dueTodayTasks > 1 ? 's' : ''} due today. Great time to make progress!`,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-900/20"
      });
    }

    if (tips.length === 0) {
      tips.push({
        icon: Coffee,
        title: "Looking Good!",
        description: "Your tasks are well organized. Consider planning ahead for upcoming deadlines.",
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-900/20"
      });
    }

    return tips.slice(0, 2); // Show max 2 tips
  }, [tasks, currentUserId]);

  if (tips.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        Smart Insights
      </h3>
      <div className="space-y-2">
        {tips.map((tip, index) => (
          <Alert key={index} className={cn("border-l-4 py-3", tip.bgColor)}>
            <tip.icon className={cn("h-4 w-4", tip.color)} />
            <AlertDescription className="ml-2">
              <span className="font-medium">{tip.title}:</span> {tip.description}
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
});

ProductivityTips.displayName = "ProductivityTips";

// Enhanced filter controls
const FilterControls = memo(({ 
  searchTerm, 
  onSearchChange, 
  filterPriority, 
  onPriorityChange, 
  sortBy, 
  onSortChange,
  taskCount
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterPriority: TaskPriority | 'all';
  onPriorityChange: (value: TaskPriority | 'all') => void;
  sortBy: TaskSortOption;
  onSortChange: (value: TaskSortOption) => void;
  taskCount: number;
}) => (
  <Card className="border-dashed">
    <CardContent className="p-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          <Badge variant="outline" className="ml-2">
            {taskCount} task{taskCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              className="pl-10" 
              value={searchTerm} 
              onChange={e => onSearchChange(e.target.value)} 
            />
          </div>
          
          <Select value={filterPriority} onValueChange={onPriorityChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="High">🔴 High</SelectItem>
              <SelectItem value="Medium">🟡 Medium</SelectItem>
              <SelectItem value="Low">🟢 Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">📊 Status</SelectItem>
              <SelectItem value="priority">🎯 Priority</SelectItem>
              <SelectItem value="deadline">📅 Deadline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </CardContent>
  </Card>
));

FilterControls.displayName = "FilterControls";

export function DashboardPage() {
  const { currentUser, allUsers, loading } = useAuth();
  const { tasks, isLoadingTasks, updateTaskStatus } = useTasks();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // Ensure consistent type handling for user ID comparisons
  const currentUserId = currentUser?.id ? Number(currentUser.id) : null;

  // Add loading state check
  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex justify-center items-center h-64">
          <span className="text-muted-foreground text-lg">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div className="p-4 md:p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please log in to view your dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const myTasks = useMemo(() => {
    if (!currentUserId) return [];
    return tasks.filter((task: Task) => {
      const assignedUserId = task.assignedUserId ? Number(task.assignedUserId) : null;
      const assignerId = task.assignerId ? Number(task.assignerId) : null;
      // Show all tasks assigned to the user, regardless of status
      const isAssignedToMe = assignedUserId === currentUserId;
      // Still show tasks created by me that need action
      const isMyCreatedTaskNeedingAction = assignerId === currentUserId && 
        ['Pending Approval', 'Needs Changes', 'Rejected'].includes(task.status);
      return isAssignedToMe || isMyCreatedTaskNeedingAction;
    });
  }, [tasks, currentUserId]);

  // Add state for search/filter/sort
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [sortBy, setSortBy] = useState<TaskSortOption>('status');

  const filteredTasks = useMemo(() => {
    let result = myTasks;
    if (searchTerm) {
      result = result.filter((task: Task) =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      );
    }
    if (filterPriority !== 'all') {
      result = result.filter((task: Task) => task.priority === filterPriority);
    }
    if (sortBy === 'status') {
      result = result.slice().sort((a: Task, b: Task) => a.status.localeCompare(b.status));
    } else if (sortBy === 'priority') {
      const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
      result = result.slice().sort((a: Task, b: Task) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'deadline') {
      result = result.slice().sort((a: Task, b: Task) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    }
    return result;
  }, [myTasks, searchTerm, filterPriority, sortBy]);

  const upcomingDeadlines = useMemo(() => {
    if (!currentUserId) return [];
    
    return tasks
      .filter(task => {
        if (!task.deadline) return false;
        const assignedUserId = task.assignedUserId ? Number(task.assignedUserId) : null;
        return isFuture(parseISO(task.deadline)) && 
               differenceInDays(parseISO(task.deadline), new Date()) <= 7 && 
               !['Completed', 'Rejected'].includes(task.status) && 
               assignedUserId === currentUserId;
      })
      .sort((a, b) => parseISO(a.deadline || '').getTime() - parseISO(b.deadline || '').getTime())
      .slice(0, 5);
  }, [tasks, currentUserId]);

  const handleCreateTaskSuccess = useCallback(() => {
    setIsCreateTaskOpen(false);
  }, []);

  // Loading state
  if (isLoadingTasks) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-foreground">
            Welcome back, {currentUser?.firstName || 'User'}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your tasks today.
          </p>
        </div>
        
        {currentUser?.role === 'User' && (
          <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-5 w-5" /> 
                Submit Task Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit a New Task Idea</DialogTitle>
                <DialogDescription>
                  Describe the task you want to work on. This will be sent to a manager for review and assignment.
                </DialogDescription>
              </DialogHeader>
              <CreateUserTaskForm users={allUsers} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPI Dashboard */}
      <TaskInsights tasks={tasks} currentUserId={currentUserId} />

      {/* Two Column Layout for Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content - Tasks */}
        <div className="xl:col-span-3 space-y-6">
          {/* Filter Controls */}
          <FilterControls
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterPriority={filterPriority}
            onPriorityChange={setFilterPriority}
            sortBy={sortBy}
            onSortChange={setSortBy}
            taskCount={filteredTasks.length}
          />

          {/* View Mode Toggle */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    My Tasks
                  </CardTitle>
                  <CardDescription>
                    Tasks assigned to you and your submissions
                  </CardDescription>
                </div>
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(value: 'list' | 'board') => value && setViewMode(value)} 
                  className="bg-muted rounded-lg p-1"
                >
                  <ToggleGroupItem value="list" size="sm">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="board" size="sm">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === 'list' ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                      <MyTaskItem key={task.id} task={task} />
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <Coffee className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        No tasks match your criteria
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Try adjusting your filters or create a new task.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <TaskBoardView 
                  tasks={filteredTasks} 
                  onStatusChange={updateTaskStatus}
                  isLoading={isLoadingTasks}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Insights & Deadlines */}
        <div className="space-y-6">
          {/* Productivity Tips */}
          <Card>
            <CardContent className="p-4">
              <ProductivityTips tasks={tasks} currentUserId={currentUserId} />
            </CardContent>
          </Card>

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                Upcoming Deadlines
              </CardTitle>
              <CardDescription>
                Tasks due within the next 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length > 0 ? (
                <div className="space-y-3">
                  {upcomingDeadlines.map(task => (
                    <UpcomingDeadlineItem key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No upcoming deadlines! 🎉
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}