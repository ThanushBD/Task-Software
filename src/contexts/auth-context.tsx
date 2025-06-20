"use client";

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useRef,
  useMemo
} from 'react';
import { useRouter } from 'next/navigation';
import { userAPI } from '@/lib/auth-api';
import type { User, UserRole } from '@/types';

// Enhanced auth state interface
interface AuthState {
  currentUser: User | null;
  allUsers: User[];
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  lastActivity: Date | null;
  sessionExpiry: Date | null;
  shouldPromptLogin: boolean;
}

// Auth context interface with enhanced functionality
interface AuthContextType extends AuthState {
  // Authentication methods
  login: (email: string, password?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, role: UserRole, password?: string) => Promise<AuthResult>;
  
  // User management
  refreshUsers: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  
  // Email verification
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<void>;
  
  // Session management
  refreshSession: () => Promise<boolean>;
  extendSession: () => void;
  
  // Utility methods
  clearError: () => void;
  hasRole: (role: UserRole) => boolean;
  canAccess: (requiredRole: UserRole) => boolean;
}

// Auth result type
interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// Session timeout constants
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING = 5 * 60 * 1000;  // 5 minutes before timeout
const ACTIVITY_THROTTLE = 10 * 1000;    // Throttle activity updates to 10 seconds

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // State management
  const [authState, setAuthState] = useState<AuthState>({
    currentUser: null,
    allUsers: [],
    loading: true,
    isAuthenticated: false,
    error: null,
    lastActivity: null,
    sessionExpiry: null,
    shouldPromptLogin: false,
  });

  const router = useRouter();
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout>();
  const activityTimeoutRef = useRef<NodeJS.Timeout>();

  // Update user activity
  const updateActivity = useCallback(() => {
    if (authState.isAuthenticated) {
      const now = new Date();
      setAuthState(prev => ({
        ...prev,
        lastActivity: now,
        sessionExpiry: new Date(now.getTime() + SESSION_TIMEOUT),
      }));
    }
  }, [authState.isAuthenticated]);

  // Throttled activity update
  const throttledUpdateActivity = useCallback(() => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    activityTimeoutRef.current = setTimeout(updateActivity, ACTIVITY_THROTTLE);
  }, [updateActivity]);

  // Initialize auth state on mount
  useEffect(() => {
    console.log('[AuthProvider] authState:', authState);
  }, [authState]);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        setAuthState(prev => ({ ...prev, loading: true, error: null }));
        // Check if user has an active session
        const sessionUser = await userAPI.verifySession();
        console.log('[AuthProvider] verifySession result:', sessionUser);
        if (mounted && sessionUser) {
          const now = new Date();
          setAuthState(prev => ({
            ...prev,
            currentUser: sessionUser,
            isAuthenticated: true,
            lastActivity: now,
            sessionExpiry: new Date(now.getTime() + SESSION_TIMEOUT),
          }));
          // Load all users if we have a valid session
          await refreshUsers();
        }
      } catch (error) {
        console.log('[AuthProvider] Failed to initialize auth:', error);
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            currentUser: null,
            isAuthenticated: false,
            error: null, // Don't set error for initialization failures
          }));
        }
      } finally {
        if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false }));
        }
      }
    }
    initializeAuth();
    return () => { mounted = false; };
  }, []);

  // Session management
  useEffect(() => {
    if (authState.isAuthenticated && authState.sessionExpiry) {
      // Set up session check interval
      sessionCheckIntervalRef.current = setInterval(() => {
        const now = new Date();
        
        if (authState.sessionExpiry && now > authState.sessionExpiry) {
          // Session expired
          handleSessionExpiry();
        } else if (
          authState.sessionExpiry && 
          authState.sessionExpiry.getTime() - now.getTime() < SESSION_WARNING
        ) {
          // Session warning
          handleSessionWarning();
        }
      }, 60000); // Check every minute

      // Set up activity listeners
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, throttledUpdateActivity, true);
      });

      return () => {
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
        }
        events.forEach(event => {
          document.removeEventListener(event, throttledUpdateActivity, true);
        });
      };
    }
  }, [authState.isAuthenticated, authState.sessionExpiry, throttledUpdateActivity]);

  // Session expiry handler
  const handleSessionExpiry = useCallback(async () => {
    setAuthState(prev => ({
      ...prev,
      currentUser: null,
      allUsers: [],
      isAuthenticated: false,
      error: 'Your session has expired. Please sign in again.',
    }));
    
    try {
      await userAPI.logoutUser();
    } catch (error) {
      console.error('Logout on session expiry failed:', error);
    }
    
    router.push('/login?reason=expired');
  }, [router]);

  // Session warning handler
  const handleSessionWarning = useCallback(() => {
    // Could trigger a toast notification here
    console.log('Session will expire soon');
  }, []);

  // Refresh users list
  const refreshUsers = useCallback(async (): Promise<void> => {
    try {
      const users = await userAPI.getAllUsers();
      setAuthState(prev => ({ ...prev, allUsers: users, error: null }));
    } catch (error) {
      console.error('Failed to refresh users:', error);
      setAuthState(prev => ({ 
        ...prev, 
        error: 'Failed to load users' 
      }));
    }
  }, []);

  // Login method
  const login = useCallback(async (email: string, password?: string): Promise<AuthResult> => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await userAPI.loginUser(email, password);
      console.log('[AuthProvider] login result:', result);
      if (result.token) {
        localStorage.setItem('token', result.token);
        console.debug('[auth-context] Token set after login:', result.token);
      }
      console.debug('[auth-context] Calling refreshUsers after login');
      await refreshUsers();
      setAuthState(prev => ({
        ...prev,
        currentUser: result.user || null,
        isAuthenticated: true,
        loading: false,
        error: null,
      }));
      return { success: true, user: result.user };
    } catch (error: any) {
      console.error('Login failed:', error);
      setAuthState(prev => ({
        ...prev,
        currentUser: null,
        isAuthenticated: false,
        loading: false,
        error: error.message || 'Login failed',
      }));
      return { success: false, error: error.message || 'Login failed' };
    }
  }, [refreshUsers]);

  // Logout method
  const logout = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      await userAPI.logoutUser();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      setAuthState({
        currentUser: null,
        allUsers: [],
        loading: false,
        isAuthenticated: false,
        error: null,
        lastActivity: null,
        sessionExpiry: null,
        shouldPromptLogin: false,
      });
      
      // Clear intervals
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      router.push('/login');
    }
  }, [router]);

  // Signup method
  const signup = useCallback(async (name: string, email: string, role: UserRole, password?: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const result = await userAPI.registerUser(name, email, role, password);
      console.log('[AuthProvider] signup result:', result);
      if (result.success) {
        // Ensure token is set before calling refreshUsers
        if (result.token) {
          localStorage.setItem('token', result.token);
          console.debug('[auth-context] Token set after signup:', result.token);
        }
        console.debug('[auth-context] Calling refreshUsers after signup');
        await refreshUsers();
        setAuthState(prev => ({
          ...prev,
          currentUser: result.user || null,
          isAuthenticated: true,
          loading: false,
          error: null,
          shouldPromptLogin: false
        }));
        return { success: true, user: result.user };
      } else {
        // Handle specific error for already registered email
        if (result.error && result.error.toLowerCase().includes('already registered')) {
          setAuthState(prev => ({ ...prev, loading: false, error: 'Email is already registered. Please log in instead.', shouldPromptLogin: true }));
        } else {
          setAuthState(prev => ({ ...prev, loading: false, error: result.error || 'Signup failed', shouldPromptLogin: false }));
        }
        return { success: false, error: result.error || 'Signup failed' };
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, loading: false, error: error.message || 'Signup failed', shouldPromptLogin: false }));
      return { success: false, error: error.message || 'Signup failed' };
    }
  }, [refreshUsers]);

  // Update profile method
  const updateProfile = useCallback(async (updates: Partial<User>): Promise<boolean> => {
    try {
      if (!authState.currentUser) return false;
      
      const updatedUser = await userAPI.updateProfile(authState.currentUser.id, updates);
      setAuthState(prev => ({
        ...prev,
        currentUser: updatedUser,
        error: null,
      }));
      
      return true;
    } catch (error: any) {
      console.error('Profile update failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Profile update failed',
      }));
      return false;
    }
  }, [authState.currentUser]);

  // Email verification
  const verifyEmail = useCallback(async (email: string, code: string): Promise<boolean> => {
    try {
      const response = await userAPI.verifyEmailCode(email, code);
      if (response.success && authState.currentUser) {
        setAuthState(prev => ({
          ...prev,
          currentUser: { ...prev.currentUser!, emailVerified: true },
          error: null,
        }));
      }
      return response.success;
    } catch (error: any) {
      console.error('Email verification failed:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Email verification failed',
      }));
      return false;
    }
  }, [authState.currentUser]);

  const resendVerificationEmail = useCallback(async (email: string): Promise<void> => {
    try {
      await userAPI.sendVerificationEmail(email);
      setAuthState(prev => ({ ...prev, error: null }));
    } catch (error: any) {
      console.error('Failed to resend verification email:', error);
      setAuthState(prev => ({
        ...prev,
        error: error.message || 'Failed to resend verification email',
      }));
      throw error;
    }
  }, []);

  // Session refresh
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const sessionUser = await userAPI.verifySession();
      if (sessionUser) {
        const now = new Date();
        setAuthState(prev => ({
          ...prev,
          currentUser: sessionUser,
          isAuthenticated: true,
          lastActivity: now,
          sessionExpiry: new Date(now.getTime() + SESSION_TIMEOUT),
          error: null,
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }, []);

  // Extend session
  const extendSession = useCallback(() => {
    if (authState.isAuthenticated) {
      const now = new Date();
      setAuthState(prev => ({
        ...prev,
        lastActivity: now,
        sessionExpiry: new Date(now.getTime() + SESSION_TIMEOUT),
      }));
    }
  }, [authState.isAuthenticated]);

  // Utility methods
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  const hasRole = useCallback((role: UserRole): boolean => {
    return authState.currentUser?.role === role;
  }, [authState.currentUser?.role]);

  const canAccess = useCallback((requiredRole: UserRole): boolean => {
    if (!authState.currentUser) return false;
    
    const userRole = authState.currentUser.role;
    
    // Role hierarchy: Admin > User
    const roleHierarchy: Record<UserRole, number> = {
      'Admin': 2,
      'User': 1,
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }, [authState.currentUser]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ...authState,
    login,
    logout,
    signup,
    refreshUsers,
    updateProfile,
    verifyEmail,
    resendVerificationEmail,
    refreshSession,
    extendSession,
    clearError,
    hasRole,
    canAccess,
  }), [
    authState,
    login,
    logout,
    signup,
    refreshUsers,
    updateProfile,
    verifyEmail,
    resendVerificationEmail,
    refreshSession,
    extendSession,
    clearError,
    hasRole,
    canAccess,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Enhanced useAuth hook with error handling
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Convenience hooks
export function useCurrentUser() {
  const { currentUser } = useAuth();
  return currentUser;
}

export function useIsAuthenticated() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export function useHasRole(role: UserRole) {
  const { hasRole } = useAuth();
  return hasRole(role);
}

export function useCanAccess(requiredRole: UserRole) {
  const { canAccess } = useAuth();
  return canAccess(requiredRole);
}