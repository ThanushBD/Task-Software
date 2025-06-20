// 1. FIXED: use-mobile.tsx
"use client";

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useRef,
  ReactNode 
} from "react";

// Breakpoint definitions following common design system standards
export const BREAKPOINTS = {
  xs: 0,      // Extra small devices
  sm: 576,    // Small devices (landscape phones)
  md: 768,    // Medium devices (tablets)
  lg: 992,    // Large devices (desktops)
  xl: 1200,   // Extra large devices (large desktops)
  xxl: 1400,  // Extra extra large devices
} as const;

// Device type definitions
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'tv';
export type BreakpointKey = keyof typeof BREAKPOINTS;
export type Orientation = 'portrait' | 'landscape';

// Screen size categories
export interface ScreenInfo {
  width: number;
  height: number;
  deviceType: DeviceType;
  breakpoint: BreakpointKey;
  orientation: Orientation;
  aspectRatio: number;
  isRetina: boolean;
  pixelDensity: number;
  availableWidth: number;
  availableHeight: number;
}

// Touch and interaction capabilities
export interface InteractionCapabilities {
  hasTouch: boolean;
  hasHover: boolean;
  hasPointer: boolean;
  supportsPointerEvents: boolean;
  maxTouchPoints: number;
  hasKeyboard: boolean;
}

// Performance and connection information
export interface ConnectionInfo {
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'wifi' | 'wimax' | 'other' | 'unknown';
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

// Battery information (when available)
export interface BatteryInfo {
  charging?: boolean;
  chargingTime?: number;
  dischargingTime?: number;
  level?: number;
}

// Complete device context
export interface DeviceContextType {
  // Basic responsive information
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmallScreen: boolean;
  isLargeScreen: boolean;
  
  // Detailed screen information
  screenInfo: ScreenInfo;
  
  // Interaction capabilities
  interactions: InteractionCapabilities;
  
  // Network and performance
  connection: ConnectionInfo;
  
  // Battery (when supported)
  battery: BatteryInfo;
  
  // Utility methods
  isBreakpoint: (breakpoint: BreakpointKey) => boolean;
  isAboveBreakpoint: (breakpoint: BreakpointKey) => boolean;
  isBelowBreakpoint: (breakpoint: BreakpointKey) => boolean;
  isBetweenBreakpoints: (min: BreakpointKey, max: BreakpointKey) => boolean;
  
  // Advanced queries
  supportsFeature: (feature: string) => boolean;
  prefersReducedMotion: boolean;
  prefersColorScheme: 'light' | 'dark' | 'no-preference';
  prefersContrast: 'more' | 'less' | 'no-preference';
  
  // Event handlers
  onBreakpointChange?: (breakpoint: BreakpointKey) => void;
  onOrientationChange?: (orientation: Orientation) => void;
  onConnectionChange?: (connection: ConnectionInfo) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Utility functions
const getDeviceType = (width: number, hasTouch: boolean): DeviceType => {
  if (width >= BREAKPOINTS.xl) {
    return hasTouch ? 'tablet' : 'desktop';
  } else if (width >= BREAKPOINTS.lg) {
    return hasTouch ? 'tablet' : 'desktop';
  } else if (width >= BREAKPOINTS.md) {
    return 'tablet';
  } else {
    return 'mobile';
  }
};

const getCurrentBreakpoint = (width: number): BreakpointKey => {
  if (width >= BREAKPOINTS.xxl) return 'xxl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

const getOrientation = (width: number, height: number): Orientation => {
  return width > height ? 'landscape' : 'portrait';
};

// Feature detection utilities
const detectFeatures = () => {
  if (typeof window === 'undefined') {
    return {
      hasTouch: false,
      hasHover: false,
      hasPointer: false,
      supportsPointerEvents: false,
      maxTouchPoints: 0,
      hasKeyboard: true,
    };
  }

  return {
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasHover: window.matchMedia('(hover: hover)').matches,
    hasPointer: window.matchMedia('(pointer: fine)').matches,
    supportsPointerEvents: 'PointerEvent' in window,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasKeyboard: !window.matchMedia('(pointer: coarse)').matches,
  };
};

// Network information detection
const getConnectionInfo = (): ConnectionInfo => {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return {};
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (!connection) return {};

  return {
    type: connection.type,
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
};

// Battery information detection
const getBatteryInfo = async (): Promise<BatteryInfo> => {
  if (typeof navigator === 'undefined' || !('getBattery' in navigator)) {
    return {};
  }

  try {
    const battery = await (navigator as any).getBattery();
    return {
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
      level: battery.level,
    };
  } catch {
    return {};
  }
};

// Media query detection for preferences
const getMediaPreferences = () => {
  if (typeof window === 'undefined') {
    return {
      prefersReducedMotion: false,
      prefersColorScheme: 'no-preference' as const,
      prefersContrast: 'no-preference' as const,
    };
  }

  return {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' as const
      : window.matchMedia('(prefers-color-scheme: light)').matches 
        ? 'light' as const 
        : 'no-preference' as const,
    prefersContrast: window.matchMedia('(prefers-contrast: more)').matches 
      ? 'more' as const
      : window.matchMedia('(prefers-contrast: less)').matches 
        ? 'less' as const 
        : 'no-preference' as const,
  };
};

interface DeviceProviderProps {
  children: ReactNode;
  debounceMs?: number;
  enableNetworkInfo?: boolean;
  enableBatteryInfo?: boolean;
}

export function DeviceProvider({ 
  children, 
  debounceMs = 100,
  enableNetworkInfo = true,
  enableBatteryInfo = false 
}: DeviceProviderProps) {
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        deviceType: 'desktop',
        breakpoint: 'lg',
        orientation: 'landscape',
        aspectRatio: 4/3,
        isRetina: false,
        pixelDensity: 1,
        availableWidth: 1024,
        availableHeight: 768,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const interactions = detectFeatures();

    return {
      width,
      height,
      deviceType: getDeviceType(width, interactions.hasTouch),
      breakpoint: getCurrentBreakpoint(width),
      orientation: getOrientation(width, height),
      aspectRatio: width / height,
      isRetina: window.devicePixelRatio > 1,
      pixelDensity: window.devicePixelRatio,
      availableWidth: screen.availWidth || width,
      availableHeight: screen.availHeight || height,
    };
  });

  const [interactions, setInteractions] = useState<InteractionCapabilities>(detectFeatures);
  const [connection, setConnection] = useState<ConnectionInfo>(getConnectionInfo);
  const [battery, setBattery] = useState<BatteryInfo>({});
  const [mediaPreferences, setMediaPreferences] = useState(getMediaPreferences);

  const debounceRef = useRef<NodeJS.Timeout>();
  const previousBreakpointRef = useRef<BreakpointKey>(screenInfo.breakpoint);
  const previousOrientationRef = useRef<Orientation>(screenInfo.orientation);

  // Event handlers for callbacks
  const onBreakpointChangeRef = useRef<((breakpoint: BreakpointKey) => void) | undefined>();
  const onOrientationChangeRef = useRef<((orientation: Orientation) => void) | undefined>();
  const onConnectionChangeRef = useRef<((connection: ConnectionInfo) => void) | undefined>();

  // Update screen information
  const updateScreenInfo = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const newBreakpoint = getCurrentBreakpoint(width);
    const newOrientation = getOrientation(width, height);

    setScreenInfo(prev => ({
      ...prev,
      width,
      height,
      deviceType: getDeviceType(width, interactions.hasTouch),
      breakpoint: newBreakpoint,
      orientation: newOrientation,
      aspectRatio: width / height,
      isRetina: window.devicePixelRatio > 1,
      pixelDensity: window.devicePixelRatio,
      availableWidth: screen.availWidth || width,
      availableHeight: screen.availHeight || height,
    }));

    // Trigger callbacks if values changed
    if (newBreakpoint !== previousBreakpointRef.current) {
      onBreakpointChangeRef.current?.(newBreakpoint);
      previousBreakpointRef.current = newBreakpoint;
    }

    if (newOrientation !== previousOrientationRef.current) {
      onOrientationChangeRef.current?.(newOrientation);
      previousOrientationRef.current = newOrientation;
    }
  }, [interactions.hasTouch]);

  // Debounced resize handler
  const handleResize = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(updateScreenInfo, debounceMs);
  }, [updateScreenInfo, debounceMs]);

  // Network change handler
  const handleConnectionChange = useCallback(() => {
    if (!enableNetworkInfo) return;
    
    const newConnection = getConnectionInfo();
    setConnection(newConnection);
    onConnectionChangeRef.current?.(newConnection);
  }, [enableNetworkInfo]);

  // Media preference change handlers
  const handleMediaPreferenceChange = useCallback(() => {
    setMediaPreferences(getMediaPreferences());
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Window resize
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Media preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    motionQuery.addEventListener('change', handleMediaPreferenceChange);
    colorSchemeQuery.addEventListener('change', handleMediaPreferenceChange);
    contrastQuery.addEventListener('change', handleMediaPreferenceChange);

    // Network change
    if (enableNetworkInfo && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', handleConnectionChange);
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      
      motionQuery.removeEventListener('change', handleMediaPreferenceChange);
      colorSchemeQuery.removeEventListener('change', handleMediaPreferenceChange);
      contrastQuery.removeEventListener('change', handleMediaPreferenceChange);

      if (enableNetworkInfo && 'connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          connection.removeEventListener('change', handleConnectionChange);
        }
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [handleResize, handleConnectionChange, handleMediaPreferenceChange, enableNetworkInfo]);

  // Load battery information
  useEffect(() => {
    if (enableBatteryInfo) {
      getBatteryInfo().then(setBattery);
    }
  }, [enableBatteryInfo]);

  // Utility methods
  const isBreakpoint = useCallback((breakpoint: BreakpointKey) => {
    return screenInfo.breakpoint === breakpoint;
  }, [screenInfo.breakpoint]);

  const isAboveBreakpoint = useCallback((breakpoint: BreakpointKey) => {
    return screenInfo.width >= BREAKPOINTS[breakpoint];
  }, [screenInfo.width]);

  const isBelowBreakpoint = useCallback((breakpoint: BreakpointKey) => {
    return screenInfo.width < BREAKPOINTS[breakpoint];
  }, [screenInfo.width]);

  const isBetweenBreakpoints = useCallback((min: BreakpointKey, max: BreakpointKey) => {
    return screenInfo.width >= BREAKPOINTS[min] && screenInfo.width < BREAKPOINTS[max];
  }, [screenInfo.width]);

  const supportsFeature = useCallback((feature: string) => {
    if (typeof window === 'undefined') return false;
    
    switch (feature) {
      case 'touch':
        return interactions.hasTouch;
      case 'hover':
        return interactions.hasHover;
      case 'pointer':
        return interactions.hasPointer;
      case 'retina':
        return screenInfo.isRetina;
      case 'webp':
        return 'WebP' in window;
      case 'intersection-observer':
        return 'IntersectionObserver' in window;
      case 'resize-observer':
        return 'ResizeObserver' in window;
      case 'service-worker':
        return 'serviceWorker' in navigator;
      default:
        return false;
    }
  }, [interactions, screenInfo.isRetina]);

  // Computed values
  const isMobile = screenInfo.deviceType === 'mobile';
  const isTablet = screenInfo.deviceType === 'tablet';
  const isDesktop = screenInfo.deviceType === 'desktop';
  const isSmallScreen = isBelowBreakpoint('md');
  const isLargeScreen = isAboveBreakpoint('lg');

  const contextValue: DeviceContextType = {
    // Basic responsive information
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    isLargeScreen,
    
    // Detailed information
    screenInfo,
    interactions,
    connection,
    battery,
    
    // Utility methods
    isBreakpoint,
    isAboveBreakpoint,
    isBelowBreakpoint,
    isBetweenBreakpoints,
    supportsFeature,
    
    // Media preferences
    ...mediaPreferences,
    
    // Event handlers (can be set by consumers)
    onBreakpointChange: onBreakpointChangeRef.current,
    onOrientationChange: onOrientationChangeRef.current,
    onConnectionChange: onConnectionChangeRef.current,
  };

  return (
    <DeviceContext.Provider value={contextValue}>
      {children}
    </DeviceContext.Provider>
  );
}

// Enhanced useDevice hook
export function useDevice() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}

// Legacy useIsMobile hook for backward compatibility
export function useIsMobile() {
  const { isMobile } = useDevice();
  return isMobile;
}

// Specialized hooks for common use cases
export function useBreakpoint() {
  const { screenInfo, isBreakpoint, isAboveBreakpoint, isBelowBreakpoint } = useDevice();
  return {
    current: screenInfo.breakpoint,
    is: isBreakpoint,
    isAbove: isAboveBreakpoint,
    isBelow: isBelowBreakpoint,
    width: screenInfo.width,
    height: screenInfo.height,
  };
}

export function useOrientation() {
  const { screenInfo } = useDevice();
  return {
    orientation: screenInfo.orientation,
    isPortrait: screenInfo.orientation === 'portrait',
    isLandscape: screenInfo.orientation === 'landscape',
    aspectRatio: screenInfo.aspectRatio,
  };
}

export function useInteractions() {
  const { interactions } = useDevice();
  return interactions;
}

export function useConnection() {
  const { connection } = useDevice();
  return connection;
}

export function useMediaPreferences() {
  const { prefersReducedMotion, prefersColorScheme, prefersContrast } = useDevice();
  return {
    prefersReducedMotion,
    prefersColorScheme,
    prefersContrast,
    prefersLightMode: prefersColorScheme === 'light',
    prefersDarkMode: prefersColorScheme === 'dark',
    prefersHighContrast: prefersContrast === 'more',
  };
}