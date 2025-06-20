"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

// Enhanced theme configuration
type Theme = "light" | "dark" | "system";
type AccentColor = "blue" | "green" | "purple" | "orange" | "red" | "pink";
type FontSize = "sm" | "md" | "lg" | "xl";
type BorderRadius = "none" | "sm" | "md" | "lg" | "xl";

interface ThemeConfig {
  theme: Theme;
  accentColor: AccentColor;
  fontSize: FontSize;
  borderRadius: BorderRadius;
  reducedMotion: boolean;
  highContrast: boolean;
  grayScale: boolean;
}

interface ExtendedThemeContextType {
  // Theme state
  theme: Theme;
  systemTheme: Theme | undefined;
  resolvedTheme: Theme | undefined;
  
  // Theme configuration
  config: ThemeConfig;
  
  // Theme methods
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  
  // Configuration methods
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setBorderRadius: (radius: BorderRadius) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setGrayScale: (enabled: boolean) => void;
  setConfig: (config: ThemeConfig) => void; // Added setConfig
  
  // Utility methods
  resetToDefaults: () => void;
  exportConfig: () => string;
  importConfig: (config: string) => boolean;
  
  // Accessibility
  isHighContrast: boolean;
  isReducedMotion: boolean;
  isDarkMode: boolean;
  
  // Preferences
  savePreferences: () => void;
  loadPreferences: () => void;
}

const defaultConfig: ThemeConfig = {
  theme: "system",
  accentColor: "blue",
  fontSize: "md",
  borderRadius: "md",
  reducedMotion: false,
  highContrast: false,
  grayScale: false,
};

// Accent color configurations
const ACCENT_COLORS: Record<AccentColor, { primary: string; secondary: string; name: string }> = {
  blue: { primary: "hsl(221 83% 53%)", secondary: "hsl(221 83% 95%)", name: "Blue" },
  green: { primary: "hsl(142 76% 36%)", secondary: "hsl(142 76% 95%)", name: "Green" },
  purple: { primary: "hsl(262 83% 58%)", secondary: "hsl(262 83% 95%)", name: "Purple" },
  orange: { primary: "hsl(25 95% 53%)", secondary: "hsl(25 95% 95%)", name: "Orange" },
  red: { primary: "hsl(0 84% 60%)", secondary: "hsl(0 84% 95%)", name: "Red" },
  pink: { primary: "hsl(336 75% 40%)", secondary: "hsl(336 75% 95%)", name: "Pink" },
};

// Font size configurations
const FONT_SIZES: Record<FontSize, { name: string; scale: string }> = {
  sm: { name: "Small", scale: "0.875" },
  md: { name: "Medium", scale: "1" },
  lg: { name: "Large", scale: "1.125" },
  xl: { name: "Extra Large", scale: "1.25" },
};

// Border radius configurations
const BORDER_RADIUS: Record<BorderRadius, { name: string; value: string }> = {
  none: { name: "None", value: "0" },
  sm: { name: "Small", value: "0.25rem" },
  md: { name: "Medium", value: "0.5rem" },
  lg: { name: "Large", value: "0.75rem" },
  xl: { name: "Extra Large", value: "1rem" },
};

const ExtendedThemeContext = createContext<ExtendedThemeContextType | undefined>(undefined);

interface ExtendedThemeProviderProps extends Omit<ThemeProviderProps, 'children'> {
  children: ReactNode;
  enableColorScheme?: boolean;
  enablePersistence?: boolean;
  storageKey?: string;
}

export function ThemeProvider({ 
  children, 
  enableColorScheme = true,
  enablePersistence = true,
  storageKey = "taskzen-theme-config",
  ...props 
}: ExtendedThemeProviderProps) {
  const [config, setConfig] = useState<ThemeConfig>(defaultConfig);
  const [mounted, setMounted] = useState(false);

  // Initialize theme configuration
  useEffect(() => {
    setMounted(true);
    if (enablePersistence) {
      loadPreferences();
    }
    
    // Check for system preferences
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    
    setConfig((prev: any) => ({
      ...prev,
      reducedMotion: mediaQuery.matches,
      highContrast: contrastQuery.matches,
    }));

    // Listen for system preference changes
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setConfig((prev: any) => ({ ...prev, reducedMotion: e.matches }));
    };
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setConfig((prev: any) => ({ ...prev, highContrast: e.matches }));
    };

    mediaQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, [enablePersistence]);

  // Apply CSS custom properties when configuration changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    
    // Apply accent color
    const accentConfig = ACCENT_COLORS[config.accentColor];
    root.style.setProperty('--primary', accentConfig.primary);
    root.style.setProperty('--primary-foreground', 'hsl(0 0% 98%)');
    
    // Apply font size
    const fontConfig = FONT_SIZES[config.fontSize];
    root.style.setProperty('--font-size-scale', fontConfig.scale);
    
    // Apply border radius
    const radiusConfig = BORDER_RADIUS[config.borderRadius];
    root.style.setProperty('--radius', radiusConfig.value);
    
    // Apply accessibility settings
    if (config.reducedMotion) {
      root.style.setProperty('--animation-duration', '0ms');
      root.style.setProperty('--transition-duration', '0ms');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }
    
    // Apply contrast settings
    if (config.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Apply grayscale filter
    if (config.grayScale) {
      root.classList.add('grayscale');
    } else {
      root.classList.remove('grayscale');
    }

    // Save preferences
    if (enablePersistence) {
      savePreferences();
    }
  }, [config, mounted, enablePersistence]);

  // Theme methods
  const setTheme = useCallback((theme: Theme) => {
    setConfig((prev: ThemeConfig) => ({ ...prev, theme }));
  }, []);

  const toggleTheme = useCallback(() => {
    setConfig((prev: ThemeConfig) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light'
    }));
  }, []);

  // Configuration methods
  const setAccentColor = useCallback((color: AccentColor) => {
    setConfig((prev: ThemeConfig) => ({ ...prev, accentColor: color }));
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setConfig((prev: ThemeConfig) => ({ ...prev, fontSize: size }));
  }, []);

  const setBorderRadius = useCallback((radius: BorderRadius) => {
    setConfig((prev: ThemeConfig) => ({ ...prev, borderRadius: radius }));
  }, []);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setConfig((prev: ThemeConfig): ThemeConfig => ({ ...prev, reducedMotion: enabled }));
  }, []);

  const setHighContrast = useCallback((enabled: boolean) => {
    setConfig((prev: any) => ({ ...prev, highContrast: enabled }));
  }, []);

  const setGrayScale = useCallback((enabled: boolean) => {
    setConfig((prev: ThemeConfig): ThemeConfig => ({ ...prev, grayScale: enabled }));
  }, []);

  // Utility methods
  const resetToDefaults = useCallback(() => {
    setConfig(defaultConfig);
  }, []);

  const exportConfig = useCallback(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfig = useCallback((configString: string): boolean => {
    try {
      const importedConfig = JSON.parse(configString);
      // Validate the configuration
      if (typeof importedConfig === 'object' && importedConfig !== null) {
        setConfig({ ...defaultConfig, ...importedConfig });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Preferences persistence
  const savePreferences = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(config));
      } catch (error) {
        console.warn('Failed to save theme preferences:', error);
      }
    }
  }, [config, storageKey]);

  const loadPreferences = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedConfig = JSON.parse(saved);
          setConfig({ ...defaultConfig, ...savedConfig });
        }
      } catch (error) {
        console.warn('Failed to load theme preferences:', error);
      }
    }
  }, [storageKey]);

  // Computed properties
  const isDarkMode = config.theme === 'dark' || 
    (config.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  
  const contextValue: ExtendedThemeContextType = {
    theme: config.theme,
    systemTheme: undefined, // This would be provided by next-themes
    resolvedTheme: undefined, // This would be provided by next-themes
    config,
    
    // Theme methods
    setTheme,
    toggleTheme,
    
    // Configuration methods
    setAccentColor,
    setFontSize,
    setBorderRadius,
    setReducedMotion,
    setHighContrast,
    setGrayScale,
    setConfig, // Added setConfig to contextValue
    
    // Utility methods
    resetToDefaults,
    exportConfig,
    importConfig,
    
    // Accessibility
    isHighContrast: config.highContrast,
    isReducedMotion: config.reducedMotion,
    isDarkMode,
    
    // Preferences
    savePreferences,
    loadPreferences,
  };

  return (
    <NextThemesProvider {...props}>
      <ExtendedThemeContext.Provider value={contextValue}>
        {children}
        {/* CSS variables and global styles */}
        <style jsx global>{`
          :root {
            --animation-duration: var(--animation-duration);
            --transition-duration: var(--transition-duration);
          }
          
          .high-contrast {
            --border: hsl(0 0% 0%);
            --border-width: 2px;
          }
          
          .grayscale {
            filter: grayscale(100%);
          }
          
          .grayscale img,
          .grayscale svg {
            filter: grayscale(0%);
          }
          
          * {
            animation-duration: var(--animation-duration) !important;
            transition-duration: var(--transition-duration) !important;
          }
          
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>
      </ExtendedThemeContext.Provider>
    </NextThemesProvider>
  );
} // Added missing closing brace

// Enhanced hook for accessing theme context
export function useExtendedTheme() {
  const context = useContext(ExtendedThemeContext);
  if (context === undefined) {
    throw new Error('useExtendedTheme must be used within a ThemeProvider');
  }
  return context;
}

// Convenience hooks
export function useAccentColor() {
  const { config, setAccentColor } = useExtendedTheme();
  return {
    accentColor: config.accentColor,
    setAccentColor,
    accentColors: ACCENT_COLORS,
  };
}

export function useAccessibilitySettings() {
  const { 
    config, 
    setReducedMotion, 
    setHighContrast, 
    setGrayScale,
    isHighContrast,
    isReducedMotion 
  } = useExtendedTheme();
  
  return {
    reducedMotion: config.reducedMotion,
    highContrast: config.highContrast,
    grayScale: config.grayScale,
    setReducedMotion,
    setHighContrast,
    setGrayScale,
    isHighContrast,
    isReducedMotion,
  };
}

export function useThemePresets() {
  const { setConfig } = useExtendedTheme();
  
  const presets = {
    default: defaultConfig,
    accessible: {
      ...defaultConfig,
      fontSize: 'lg' as FontSize,
      borderRadius: 'lg' as BorderRadius,
      highContrast: true,
    },
    minimal: {
      ...defaultConfig,
      borderRadius: 'none' as BorderRadius,
      accentColor: 'blue' as AccentColor,
    },
    vibrant: {
      ...defaultConfig,
      accentColor: 'purple' as AccentColor,
      borderRadius: 'xl' as BorderRadius,
    },
  };
  
  const applyPreset = useCallback((presetName: keyof typeof presets) => {
    setConfig(presets[presetName]);
  }, [setConfig]);
  
  return { presets, applyPreset };
}

// Export configurations for external use
export { ACCENT_COLORS, FONT_SIZES, BORDER_RADIUS };
export type { Theme, AccentColor, FontSize, BorderRadius, ThemeConfig };