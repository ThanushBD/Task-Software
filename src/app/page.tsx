"use client"; // Required to use useAuth hook

import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanPage } from "@/components/kanban/kanban-page";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AiOptimizerPage } from "@/components/ai/ai-optimizer-page";
import { AdminPage } from "@/components/admin/admin-page"; // New Admin Page
import { LayoutDashboard, Columns, Brain, UserCog } from "lucide-react"; // Added UserCog
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

export default function Home() {
  const { currentUser } = useAuth(); // Get current user

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Tabs defaultValue="dashboard" className="w-full p-2 sm:p-4">
          <div className="flex justify-center mb-4 sm:mb-6">
            <TabsList className={`grid w-full max-w-lg ${currentUser?.role === 'Admin' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="kanban" className="flex items-center gap-2">
                <Columns className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="ai-optimizer" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Optimizer
              </TabsTrigger>
              {currentUser?.role === 'Admin' && (
                <TabsTrigger value="admin" className="flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  Admin
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          <TabsContent value="dashboard">
            <DashboardPage />
          </TabsContent>
          <TabsContent value="kanban">
            <KanbanPage />
          </TabsContent>
          <TabsContent value="ai-optimizer">
            <AiOptimizerPage />
          </TabsContent>
          {currentUser?.role === 'Admin' && (
            <TabsContent value="admin">
              <AdminPage />
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Toaster /> {/* Global toaster for notifications */}
    </div>
  );
}
