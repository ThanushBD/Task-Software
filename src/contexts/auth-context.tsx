"use client";

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { userAPI } from '@/lib/auth-api';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  signup: (name: string, email: string, role: UserRole, password?: string) => Promise<boolean>;
  allUsers: User[];
  refreshUsers: () => Promise<void>;
  verifyEmail: (code: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state on mount
  useEffect(() => {
    async function initializeAuth() {
      try {
        setLoading(true);
        
        // Check if user has an active session
        const sessionUser = await userAPI.verifySession();
        if (sessionUser) {
          setCurrentUser(sessionUser);
          // Only load users if we have a valid session
          await refreshUsers();
        }
        
      } catch (error) {
        console.log('Failed to initialize auth (normal if not logged in):', error);
        // Don't set error state here, just log it
      } finally {
        setLoading(false);
      }
    }
    
    initializeAuth();
  }, []);

  const refreshUsers = async (): Promise<void> => {
    try {
      const users = await userAPI.getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Failed to refresh users:', error);
      // Keep existing users if refresh fails
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('Attempting login with:', { email });
      const { user, token } = await userAPI.loginUser(email, password);
      console.log('Login response:', { user, token });
      
      setCurrentUser(user);
      
      // Refresh users list after successful login
      await refreshUsers();
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      setCurrentUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await userAPI.logoutUser();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    }
    
    setCurrentUser(null);
    setAllUsers([]);
    router.push('/login');
  };

  const signup = async (name: string, email: string, role: UserRole, password?: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { user, token } = await userAPI.registerUser(name, email, role, password);
      
      setCurrentUser(user);
      
      // Refresh users list to include the new user
      await refreshUsers();
      
      return true;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (code: string): Promise<boolean> => {
    try {
      const response = await userAPI.verifyEmailCode(code);
      return response.success;
    } catch (error) {
      console.error('Email verification failed:', error);
      return false;
    }
  };
  
  const resendVerificationEmail = async (): Promise<void> => {
    try {
      await userAPI.resendVerificationEmail();
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    loading,
    login,
    logout,
    signup,
    allUsers,
    refreshUsers,
    verifyEmail, 
    resendVerificationEmail, 
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}