"use client";

import React, { memo, useState, useCallback, useMemo } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { useTasks } from "@/contexts/TaskContext";
import { 
  Zap, 
  LogIn, 
  UserPlus, 
  LogOut, 
  UserCircle, 
  Settings,
  Bell,
  Menu,
  ChevronDown,
  Shield,
  Users,
  BarChart3,
  Sparkles,
  HelpCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Navigation items based on user role
const getNavigationItems = (userRole: string | undefined) => {
  const commonItems = [
    { href: "/", label: "Dashboard", icon: BarChart3 },
  ];

  if (userRole === 'Admin') {
    return [
      ...commonItems,
      { href: "/admin", label: "Admin Panel", icon: Shield },
      { href: "/ai-optimizer", label: "AI Assistant", icon: Sparkles },
    ];
  }

  if (userRole === 'User') {
    return [
      ...commonItems,
      { href: "/ai-optimizer", label: "AI Assistant", icon: Sparkles },
    ];
  }

  return commonItems;
};

// User avatar component with fallback initials
const UserAvatar = memo(({ user, size = "sm" }: { 
  user: { firstName?: string; lastName?: string; email: string; name?: string }, 
  size?: "sm" | "md" | "lg" 
}) => {
  const initials = useMemo(() => {
    const firstName = user.firstName || user.name?.split(' ')[0] || '';
    const lastName = user.lastName || user.name?.split(' ')[1] || '';
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    
    return user.email.slice(0, 2).toUpperCase();
  }, [user]);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10", 
    lg: "h-12 w-12"
  };

  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${initials}`} />
      <AvatarFallback className="text-xs font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
});

UserAvatar.displayName = "UserAvatar";

// Notification indicator
const NotificationBell = memo(() => {
  const { tasks } = useTasks();
  const { currentUser } = useAuth();
  
  const notificationCount = useMemo(() => {
    if (!currentUser) return 0;
    
    const userId = Number(currentUser.id);
    const urgentTasks = tasks.filter(task => {
      const isAssignedToMe = Number(task.assignedUserId) === userId;
      const isOverdue = task.status === 'Overdue';
      const needsAttention = task.status === 'Needs Changes' && Number(task.assignerId) === userId;
      
      return (isAssignedToMe && isOverdue) || needsAttention;
    });
    
    return urgentTasks.length;
  }, [tasks, currentUser]);

  return (
    <Button variant="ghost" size="sm" className="relative">
      <Bell className="h-4 w-4" />
      {notificationCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
        >
          {notificationCount > 9 ? '9+' : notificationCount}
        </Badge>
      )}
    </Button>
  );
});

NotificationBell.displayName = "NotificationBell";

// Mobile navigation menu
const MobileNav = memo(({ navigationItems, currentUser, onLogout }: {
  navigationItems: Array<{ href: string; label: string; icon: any }>;
  currentUser: any;
  onLogout: () => void;
}) => {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            TaskZen
          </SheetTitle>
          <SheetDescription>
            Task management made simple
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {/* User Info */}
          {currentUser && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <UserAvatar user={currentUser} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {currentUser.firstName || currentUser.name || currentUser.email}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {currentUser.role}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          
          {/* Navigation */}
          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          
          {/* Actions */}
          {currentUser && (
            <>
              <div className="border-t pt-4 mt-4 space-y-1">
                <Button variant="ghost" className="w-full justify-start text-sm">
                  <Settings className="mr-3 h-4 w-4" />
                  Settings
                </Button>
                <Button variant="ghost" className="w-full justify-start text-sm">
                  <HelpCircle className="mr-3 h-4 w-4" />
                  Help & Support
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm text-destructive hover:text-destructive"
                  onClick={onLogout}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});

MobileNav.displayName = "MobileNav";

// User menu dropdown
const UserMenu = memo(({ user, onLogout }: { user: any; onLogout: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="flex items-center gap-2 px-2 h-9">
        <UserAvatar user={user} size="sm" />
        <div className="hidden lg:flex flex-col items-start">
          <span className="text-sm font-medium">
            {user.firstName || user.name || user.email}
          </span>
          <span className="text-xs text-muted-foreground">
            {user.role}
          </span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuLabel>
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium">
            {user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.name || user.email
            }
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer">
        <UserCircle className="mr-2 h-4 w-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem className="cursor-pointer">
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </DropdownMenuItem>
      {user.role === 'Admin' && (
        <DropdownMenuItem className="cursor-pointer">
          <Users className="mr-2 h-4 w-4" />
          Manage Users
        </DropdownMenuItem>
      )}
      <DropdownMenuItem className="cursor-pointer">
        <HelpCircle className="mr-2 h-4 w-4" />
        Help & Support
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem 
        className="cursor-pointer text-destructive focus:text-destructive"
        onClick={onLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));

UserMenu.displayName = "UserMenu";

// Desktop navigation
const DesktopNav = memo(({ navigationItems }: { 
  navigationItems: Array<{ href: string; label: string; icon: any }> 
}) => {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1">
      {navigationItems.map((item) => (
        <Link key={item.href} href={item.href}>
          <Button
            variant={pathname === item.href ? "default" : "ghost"}
            size="sm"
            className="flex items-center gap-2"
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden lg:inline">{item.label}</span>
          </Button>
        </Link>
      ))}
    </nav>
  );
});

DesktopNav.displayName = "DesktopNav";

export const Header = memo(() => {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems = useMemo(() => 
    getNavigationItems(currentUser?.role), 
    [currentUser?.role]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, router]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo and Mobile Nav */}
        <div className="flex items-center gap-4">
          {currentUser && (
            <MobileNav 
              navigationItems={navigationItems}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          )}
          
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <Zap className="h-6 w-6 text-primary" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            <span className="font-bold text-xl font-headline hidden sm:inline">TaskZen</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        {currentUser && (
          <DesktopNav navigationItems={navigationItems} />
        )}

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            </div>
          ) : currentUser ? (
            <>
              <NotificationBell />
              <ThemeToggle />
              <UserMenu user={currentUser} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <Link href="/login" passHref>
                <Button variant="ghost" size="sm">
                  <LogIn className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
              <Link href="/signup" passHref>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Sign Up</span>
                </Button>
              </Link>
              <ThemeToggle />
            </>
          )}
        </div>
      </div>
    </header>
  );
});

Header.displayName = "Header";