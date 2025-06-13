
"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { Zap, LogIn, UserPlus, LogOut, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";


export function Header() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login'); // Redirect to login after logout
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="mr-4 flex items-center cursor-pointer">
          <Zap className="h-6 w-6 mr-2 text-primary" />
          <span className="font-bold text-xl font-headline">TaskZen</span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : currentUser ? (
            <>
              <span className="text-sm text-foreground hidden sm:inline">
                <UserCircle className="inline h-4 w-4 mr-1 relative -top-px" />
                {currentUser.name || currentUser.email} ({currentUser.role})
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-1.5 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" passHref>
                <Button variant="outline" size="sm">
                  <LogIn className="mr-1.5 h-4 w-4" />
                  Login
                </Button>
              </Link>
              <Link href="/signup" passHref>
                <Button size="sm">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Sign Up
                </Button>
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
