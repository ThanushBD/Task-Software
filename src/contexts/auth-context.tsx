"use client";

import type { User, UserRole } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  signup: (name: string, email: string, role: UserRole, password?: string) => Promise<boolean>;
  allUsers: User[];
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API Base URL - adjust this to match your server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// API functions for user management
const userAPI = {
  // Get all users
  async getAllUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Login user
  async loginUser(email: string, password?: string): Promise<{ user: User; token?: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Register new user
  async registerUser(name: string, email: string, role: UserRole, password?: string): Promise<{ user: User; token?: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ name, email, role, password }),
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Logout user
  async logoutUser(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Logout failed: ${response.statusText}`);
    }
  },

  // Verify current session
  async verifySession(): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.user;
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  }
};

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
        }
        
        // Load all users for dropdowns/selection
        await refreshUsers();
        
      } catch (error) {
        console.error('Failed to initialize auth:', error);
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
      const { user, token } = await userAPI.loginUser(email, password);
      
      setCurrentUser(user);
      
      // If using JWT tokens, store in httpOnly cookie (handled by server)
      // or handle token storage as needed for your auth strategy
      
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

  const value = {
    currentUser,
    loading,
    login,
    logout,
    signup,
    allUsers,
    refreshUsers,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
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