"use client";

import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useRef, 
  useEffect,
  ReactNode 
} from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  X, 
  Loader2,
  Bell,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";

// Enhanced toast types and interfaces
export type ToastVariant = 
  | "default" 
  | "destructive" 
  | "success" 
  | "warning" 
  | "info"
  | "loading"
  | "custom";

export type ToastPosition = 
  | "top-left" 
  | "top-center" 
  | "top-right"
  | "bottom-left" 
  | "bottom-center" 
  | "bottom-right"
  | "center";

export type ToastSize = "sm" | "md" | "lg";
export type ToastAnimation = "slide" | "fade" | "bounce" | "scale";

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export interface ToastProps {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  size?: ToastSize;
  duration?: number;
  dismissible?: boolean;
  persistent?: boolean;
  actions?: ToastAction[];
  icon?: ReactNode;
  position?: ToastPosition;
  animation?: ToastAnimation;
  className?: string;
  onDismiss?: () => void;
  onAction?: (actionIndex: number) => void;
  
  // Advanced features
  progress?: boolean;
  sound?: boolean;
  priority?: "low" | "normal" | "high" | "urgent";
  category?: string;
  metadata?: Record<string, any>;
}

export interface ToastState {
  toasts: ToastProps[];
  maxToasts: number;
  defaultDuration: number;
  defaultPosition: ToastPosition;
  defaultAnimation: ToastAnimation;
  enableSounds: boolean;
  enableAnimations: boolean;
  groupByCategory: boolean;
}

export interface ToastContextType extends ToastState {
  // Core methods
  toast: (props: Omit<ToastProps, 'id'>) => string;
  dismiss: (toastId?: string) => void;
  dismissAll: () => void;
  
  // Convenience methods
  success: (message: string, options?: Partial<ToastProps>) => string;
  error: (message: string, options?: Partial<ToastProps>) => string;
  warning: (message: string, options?: Partial<ToastProps>) => string;
  info: (message: string, options?: Partial<ToastProps>) => string;
  loading: (message: string, options?: Partial<ToastProps>) => string;
  
  // Advanced methods
  update: (toastId: string, props: Partial<ToastProps>) => void;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string | Omit<ToastProps, 'id'>;
      success: string | ((data: T) => string | Omit<ToastProps, 'id'>);
      error: string | ((error: any) => string | Omit<ToastProps, 'id'>);
    }
  ) => Promise<T>;
  
  // Configuration
  setConfig: (config: Partial<ToastState>) => void;
  getToastsByCategory: (category: string) => ToastProps[];
  getToastsByPriority: (priority: ToastProps['priority']) => ToastProps[];
  
  // Statistics
  getStats: () => {
    total: number;
    byVariant: Record<ToastVariant, number>;
    byPriority: Record<string, number>;
  };
}

// Default configuration
const defaultState: ToastState = {
  toasts: [],
  maxToasts: 5,
  defaultDuration: 5000,
  defaultPosition: "top-right",
  defaultAnimation: "slide",
  enableSounds: false,
  enableAnimations: true,
  groupByCategory: false,
};

// Toast variant configurations
const TOAST_VARIANTS = {
  default: {
    icon: Bell,
    className: "bg-background border-border text-foreground",
    iconColor: "text-foreground",
  },
  success: {
    icon: CheckCircle2,
    className: "bg-green-50 border-green-200 text-green-900 dark:bg-green-900/10 dark:border-green-900/20 dark:text-green-100",
    iconColor: "text-green-600 dark:text-green-400",
  },
  destructive: {
    icon: AlertCircle,
    className: "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/10 dark:border-red-900/20 dark:text-red-100",
    iconColor: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/10 dark:border-yellow-900/20 dark:text-yellow-100",
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  info: {
    icon: Info,
    className: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/10 dark:border-blue-900/20 dark:text-blue-100",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  loading: {
    icon: Loader2,
    className: "bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-900/10 dark:border-slate-900/20 dark:text-slate-100",
    iconColor: "text-slate-600 dark:text-slate-400 animate-spin",
  },
  custom: {
    icon: Star,
    className: "bg-background border-border text-foreground",
    iconColor: "text-foreground",
  },
};

// Position classes
const POSITION_CLASSES: Record<ToastPosition, string> = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 transform -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 transform -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
  "center": "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
};

// Animation classes
const ANIMATION_CLASSES: Record<ToastAnimation, { enter: string; enterActive: string; exit: string; }> = {
  slide: {
    enter: "translate-x-full opacity-0",
    enterActive: "translate-x-0 opacity-100 transition-all duration-300",
    exit: "translate-x-full opacity-0 transition-all duration-300",
  },
  fade: {
    enter: "opacity-0",
    enterActive: "opacity-100 transition-opacity duration-300",
    exit: "opacity-0 transition-opacity duration-300",
  },
  bounce: {
    enter: "scale-50 opacity-0",
    enterActive: "scale-100 opacity-100 transition-all duration-300 ease-out",
    exit: "scale-75 opacity-0 transition-all duration-200",
  },
  scale: {
    enter: "scale-95 opacity-0",
    enterActive: "scale-100 opacity-100 transition-all duration-200",
    exit: "scale-95 opacity-0 transition-all duration-150",
  },
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>(defaultState);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Play notification sound
  const playSound = useCallback((variant: ToastVariant) => {
    if (!state.enableSounds || typeof window === 'undefined') return;
    
    // Create different sounds for different variants
    const frequency = {
      success: 800,
      destructive: 400,
      warning: 600,
      info: 500,
      loading: 450,
      default: 550,
      custom: 600,
    }[variant];

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }, [state.enableSounds]);

  // Auto-dismiss logic
  const scheduleAutoDismiss = useCallback((toastId: string, duration: number) => {
    if (duration <= 0) return;
    
    const timeoutId = setTimeout(() => {
      setState(prev => ({
        ...prev,
        toasts: prev.toasts.filter(t => t.id !== toastId)
      }));
      timeoutRefs.current.delete(toastId);
    }, duration);
    
    timeoutRefs.current.set(toastId, timeoutId);
  }, []);

  // Core toast method
  const toast = useCallback((props: Omit<ToastProps, 'id'>): string => {
    const id = `toast-${++toastCounter}`;
    const duration = props.duration ?? state.defaultDuration;
    const position = props.position ?? state.defaultPosition;
    const animation = props.animation ?? state.defaultAnimation;
    
    const newToast: ToastProps = {
      id,
      variant: "default",
      size: "md",
      dismissible: true,
      persistent: false,
      progress: false,
      sound: true,
      priority: "normal",
      ...props,
      position,
      animation,
      duration,
    };

    setState(prev => {
      let newToasts = [...prev.toasts];
      
      // Remove oldest toast if we exceed max
      if (newToasts.length >= prev.maxToasts) {
        const oldestToast = newToasts[0];
        const timeoutId = timeoutRefs.current.get(oldestToast.id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutRefs.current.delete(oldestToast.id);
        }
        newToasts = newToasts.slice(1);
      }
      
      // Add new toast
      newToasts.push(newToast);
      
      return {
        ...prev,
        toasts: newToasts,
      };
    });

    // Play sound
    if (newToast.sound && newToast.variant) {
      playSound(newToast.variant);
    }

    // Schedule auto-dismiss for non-persistent toasts
    if (!newToast.persistent && duration > 0) {
      scheduleAutoDismiss(id, duration);
    }

    return id;
  }, [state.defaultDuration, state.defaultPosition, state.defaultAnimation, state.maxToasts, playSound, scheduleAutoDismiss]);

  // Dismiss methods
  const dismiss = useCallback((toastId?: string) => {
    if (toastId) {
      const timeoutId = timeoutRefs.current.get(toastId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutRefs.current.delete(toastId);
      }
      
      setState(prev => ({
        ...prev,
        toasts: prev.toasts.filter(t => t.id !== toastId)
      }));
    } else {
      // Dismiss the most recent toast
      setState(prev => {
        if (prev.toasts.length > 0) {
          const latestToast = prev.toasts[prev.toasts.length - 1];
          const timeoutId = timeoutRefs.current.get(latestToast.id);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutRefs.current.delete(latestToast.id);
          }
          return {
            ...prev,
            toasts: prev.toasts.slice(0, -1)
          };
        }
        return prev;
      });
    }
  }, []);

  const dismissAll = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    
    setState(prev => ({
      ...prev,
      toasts: []
    }));
  }, []);

  // Convenience methods
  const success = useCallback((message: string, options?: Partial<ToastProps>) => {
    return toast({
      title: message,
      variant: "success",
      ...options,
    });
  }, [toast]);

  const error = useCallback((message: string, options?: Partial<ToastProps>) => {
    return toast({
      title: message,
      variant: "destructive",
      ...options,
    });
  }, [toast]);

  const warning = useCallback((message: string, options?: Partial<ToastProps>) => {
    return toast({
      title: message,
      variant: "warning",
      ...options,
    });
  }, [toast]);

  const info = useCallback((message: string, options?: Partial<ToastProps>) => {
    return toast({
      title: message,
      variant: "info",
      ...options,
    });
  }, [toast]);

  const loading = useCallback((message: string, options?: Partial<ToastProps>) => {
    return toast({
      title: message,
      variant: "loading",
      persistent: true,
      dismissible: false,
      ...options,
    });
  }, [toast]);

  // Update method
  const update = useCallback((toastId: string, props: Partial<ToastProps>) => {
    setState(prev => ({
      ...prev,
      toasts: prev.toasts.map(t => 
        t.id === toastId ? { ...t, ...props } : t
      )
    }));
  }, []);

  // Promise method for async operations
  const promise = useCallback(async <T,>(
    promise: Promise<T>,
    options: {
      loading: string | Omit<ToastProps, 'id'>;
      success: string | ((data: T) => string | Omit<ToastProps, 'id'>);
      error: string | ((error: any) => string | Omit<ToastProps, 'id'>);
    }
  ): Promise<T> => {
    const loadingToastId = loading(
      typeof options.loading === 'string' 
        ? options.loading 
        : options.loading.title as string || 'Loading...',
      typeof options.loading === 'object' ? options.loading : {}
    );

    try {
      const data = await promise;
      
      // Dismiss loading toast
      dismiss(loadingToastId);
      
      // Show success toast
      const successConfig = typeof options.success === 'function' 
        ? options.success(data) 
        : options.success;
      
      if (typeof successConfig === 'string') {
        success(successConfig);
      } else {
        toast({ variant: 'success', ...successConfig });
      }
      
      return data;
    } catch (err) {
      // Dismiss loading toast
      dismiss(loadingToastId);
      
      // Show error toast
      const errorConfig = typeof options.error === 'function' 
        ? options.error(err) 
        : options.error;
      
      if (typeof errorConfig === 'string') {
        error(errorConfig);
      } else {
        toast({ variant: 'destructive', ...errorConfig });
      }
      
      throw err;
    }
  }, [toast, loading, success, error, dismiss]);

  // Configuration
  const setConfig = useCallback((config: Partial<ToastState>) => {
    setState(prev => ({ ...prev, ...config }));
  }, []);

  // Query methods
  const getToastsByCategory = useCallback((category: string) => {
    return state.toasts.filter(t => t.category === category);
  }, [state.toasts]);

  const getToastsByPriority = useCallback((priority: ToastProps['priority']) => {
    return state.toasts.filter(t => t.priority === priority);
  }, [state.toasts]);

  // Statistics
  const getStats = useCallback(() => {
    const stats = {
      total: state.toasts.length,
      byVariant: {} as Record<ToastVariant, number>,
      byPriority: {} as Record<string, number>,
    };

    state.toasts.forEach(toast => {
      const variant = toast.variant || 'default';
      const priority = toast.priority || 'normal';
      
      stats.byVariant[variant] = (stats.byVariant[variant] || 0) + 1;
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
    });

    return stats;
  }, [state.toasts]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  const contextValue: ToastContextType = {
    ...state,
    toast,
    dismiss,
    dismissAll,
    success,
    error,
    warning,
    info,
    loading,
    update,
    promise,
    setConfig,
    getToastsByCategory,
    getToastsByPriority,
    getStats,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// Toast container component that renders all toasts
function ToastContainer() {
  const context = useContext(ToastContext);
  if (!context) return null;

  const { toasts, defaultPosition, groupByCategory } = context;

  // Group toasts by position
  const toastsByPosition = toasts.reduce((acc, toast) => {
    const position = toast.position || defaultPosition;
    if (!acc[position]) acc[position] = [];
    acc[position].push(toast);
    return acc;
  }, {} as Record<ToastPosition, ToastProps[]>);

  return (
    <>
      {Object.entries(toastsByPosition).map(([position, positionToasts]) => (
        <div
          key={position}
          className={cn(
            "fixed z-50 flex flex-col gap-2 max-w-sm w-full",
            POSITION_CLASSES[position as ToastPosition]
          )}
        >
          {groupByCategory ? (
            // Group by category if enabled
            Object.entries(
              positionToasts.reduce((acc, toast) => {
                const category = toast.category || 'default';
                if (!acc[category]) acc[category] = [];
                acc[category].push(toast);
                return acc;
              }, {} as Record<string, ToastProps[]>)
            ).map(([category, categoryToasts]) => (
              <div key={category} className="space-y-2">
                {category !== 'default' && (
                  <div className="text-xs font-medium text-muted-foreground px-2">
                    {category}
                  </div>
                )}
                {categoryToasts.map(toast => (
                  <ToastComponent key={toast.id} {...toast} />
                ))}
              </div>
            ))
          ) : (
            positionToasts.map(toast => (
              <ToastComponent key={toast.id} {...toast} />
            ))
          )}
        </div>
      ))}
    </>
  );
}

// Individual toast component
function ToastComponent(toast: ToastProps) {
  const context = useContext(ToastContext);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Enter animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    if (toast.dismissible === false) return;
    
    setIsExiting(true);
    setTimeout(() => {
      context?.dismiss(toast.id);
      toast.onDismiss?.();
    }, 300); // Match exit animation duration
  }, [toast.dismissible, toast.id, toast.onDismiss, context]);

  const variant = toast.variant || 'default';
  const variantConfig = TOAST_VARIANTS[variant];
  const IconComponent = toast.icon ? () => <>{toast.icon}</> : variantConfig.icon;
  
  const animation = toast.animation || (context?.defaultAnimation ?? 'slide');
  const animationConfig = ANIMATION_CLASSES[animation];

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4 shadow-lg w-full",
        variantConfig.className,
        {
          [animationConfig.enter]: !isVisible,
          [animationConfig.enterActive]: isVisible && !isExiting,
          [animationConfig.exit]: isExiting,
        },
        toast.className
      )}
      role="alert"
      aria-live={toast.priority === 'urgent' ? 'assertive' : 'polite'}
    >
      {/* Progress bar */}
      {toast.progress && !toast.persistent && (
          <div className="absolute bottom-0 left-0 h-1 bg-current opacity-30 rounded-b-lg"
               style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }} />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn("flex-shrink-0 mt-0.5", variantConfig.iconColor)}>
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="font-semibold text-sm">
              {toast.title}
            </div>
          )}
          {toast.description && (
            <div className={cn("text-sm opacity-90", toast.title ? "mt-1" : "")}> 
              {toast.description}
            </div>
          )}

          {/* Actions */}
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex gap-2 mt-3 -mb-1">
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    toast.onAction?.(index);
                  }}
                  disabled={action.disabled}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
                    action.variant === 'destructive'
                      ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed ring-red-500"
                      : "bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ring-primary"
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible !== false && (
          <button
            onClick={handleDismiss}
            className="absolute top-1 right-1 p-1 rounded-full flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// Enhanced useToast hook
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Export additional types and configurations
export { TOAST_VARIANTS, POSITION_CLASSES, ANIMATION_CLASSES };
