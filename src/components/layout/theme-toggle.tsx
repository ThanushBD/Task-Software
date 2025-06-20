"use client";

import React, { memo, useState, useCallback } from "react";
import { Moon, Sun, Monitor, Palette, Settings, Accessibility, Download, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useExtendedTheme, useAccentColor, useAccessibilitySettings, type AccentColor } from "./theme-provider";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "simple" | "full" | "icon-only";
  showLabel?: boolean;
  className?: string;
}

// Simple theme toggle (just light/dark/system)
const SimpleThemeToggle = memo(({ showLabel = false, className }: { showLabel?: boolean; className?: string }) => {
  const { theme, setTheme } = useTheme();
  const { isDarkMode } = useExtendedTheme();

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={className}>
          <CurrentIcon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((themeOption) => {
          const Icon = themeOption.icon;
          return (
            <DropdownMenuItem
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              {themeOption.label}
              {theme === themeOption.value && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  Active
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

SimpleThemeToggle.displayName = "SimpleThemeToggle";

// Accent color selector component
const AccentColorSelector = memo(() => {
  const { accentColor, setAccentColor, accentColors } = useAccentColor();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette className="mr-2 h-4 w-4" />
        Accent Color
        <div 
          className="ml-auto w-3 h-3 rounded-full border border-border"
          style={{ backgroundColor: accentColors[accentColor].primary }}
        />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={accentColor} onValueChange={(value) => setAccentColor(value as AccentColor)}>
          {Object.entries(accentColors).map(([key, config]) => (
            <DropdownMenuRadioItem key={key} value={key} className="cursor-pointer">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: config.primary }}
                />
                {config.name}
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
});

AccentColorSelector.displayName = "AccentColorSelector";

// Accessibility settings component
const AccessibilitySettings = memo(() => {
  const {
    reducedMotion,
    highContrast,
    grayScale,
    setReducedMotion,
    setHighContrast,
    setGrayScale,
  } = useAccessibilitySettings();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Accessibility className="mr-2 h-4 w-4" />
        Accessibility
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuCheckboxItem
          checked={reducedMotion}
          onCheckedChange={setReducedMotion}
        >
          Reduce Motion
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={highContrast}
          onCheckedChange={setHighContrast}
        >
          High Contrast
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={grayScale}
          onCheckedChange={setGrayScale}
        >
          Grayscale Mode
        </DropdownMenuCheckboxItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
});

AccessibilitySettings.displayName = "AccessibilitySettings";

// Advanced theme customization dialog
const AdvancedThemeDialog = memo(() => {
  const { config, setFontSize, setBorderRadius, exportConfig, importConfig, resetToDefaults } = useExtendedTheme();
  const { toast } = useToast();
  const [importText, setImportText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = useCallback(() => {
    const configString = exportConfig();
    navigator.clipboard.writeText(configString).then(() => {
      toast({
        title: "Configuration Exported",
        description: "Theme configuration copied to clipboard",
      });
    }).catch(() => {
      // Fallback for older browsers
      const blob = new Blob([configString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'taskzen-theme-config.json';
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Configuration Exported",
        description: "Theme configuration downloaded as file",
      });
    });
  }, [exportConfig, toast]);

  const handleImport = useCallback(() => {
    if (importConfig(importText)) {
      toast({
        title: "Configuration Imported",
        description: "Theme configuration successfully applied",
      });
      setImportText("");
      setIsOpen(false);
    } else {
      toast({
        title: "Import Failed",
        description: "Invalid configuration format",
        variant: "destructive",
      });
    }
  }, [importConfig, importText, toast]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    toast({
      title: "Settings Reset",
      description: "Theme configuration reset to defaults",
    });
  }, [resetToDefaults, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Settings className="mr-2 h-4 w-4" />
          Advanced Settings
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Advanced Theme Settings</DialogTitle>
          <DialogDescription>
            Customize detailed appearance settings and manage configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Font Size */}
          <div className="space-y-3">
            <Label>Font Size</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "sm", label: "SM" },
                { value: "md", label: "MD" },
                { value: "lg", label: "LG" },
                { value: "xl", label: "XL" },
              ].map((size) => (
                <Button
                  key={size.value}
                  variant={config.fontSize === size.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFontSize(size.value as any)}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Border Radius */}
          <div className="space-y-3">
            <Label>Border Radius</Label>
            <div className="grid grid-cols-5 gap-1">
              {[
                { value: "none", label: "None" },
                { value: "sm", label: "SM" },
                { value: "md", label: "MD" },
                { value: "lg", label: "LG" },
                { value: "xl", label: "XL" },
              ].map((radius) => (
                <Button
                  key={radius.value}
                  variant={config.borderRadius === radius.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBorderRadius(radius.value as any)}
                  className="text-xs"
                >
                  {radius.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Configuration Management */}
          <div className="space-y-3">
            <Label>Configuration</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="flex-1">
                <Download className="mr-2 h-3 w-3" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} className="flex-1">
                Reset
              </Button>
            </div>
            
            <div className="space-y-2">
              <Textarea
                placeholder="Paste configuration JSON here to import..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={3}
                className="text-xs"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleImport}
                disabled={!importText.trim()}
                className="w-full"
              >
                <Upload className="mr-2 h-3 w-3" />
                Import Configuration
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

AdvancedThemeDialog.displayName = "AdvancedThemeDialog";

// Full-featured theme toggle with all options
const FullThemeToggle = memo(({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();
  const { config } = useExtendedTheme();

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={className}>
          <CurrentIcon className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Theme Selection */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Color Scheme
        </DropdownMenuLabel>
        {themes.map((themeOption) => {
          const Icon = themeOption.icon;
          return (
            <DropdownMenuItem
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              {themeOption.label}
              {theme === themeOption.value && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  Active
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        
        {/* Accent Color */}
        <AccentColorSelector />
        
        {/* Accessibility */}
        <AccessibilitySettings />
        
        <DropdownMenuSeparator />
        
        {/* Advanced Settings */}
        <AdvancedThemeDialog />
        
        {/* Current Configuration Info */}
        <DropdownMenuSeparator />
        <div className="px-2 py-1">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Font:</span>
              <span className="capitalize">{config.fontSize}</span>
            </div>
            <div className="flex justify-between">
              <span>Radius:</span>
              <span className="capitalize">{config.borderRadius}</span>
            </div>
            <div className="flex justify-between">
              <span>Accent:</span>
              <span className="capitalize">{config.accentColor}</span>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

FullThemeToggle.displayName = "FullThemeToggle";

// Main theme toggle component with variant support
export const ThemeToggle = memo(({ 
  variant = "simple", 
  showLabel = false, 
  className 
}: ThemeToggleProps) => {
  switch (variant) {
    case "icon-only":
      return <SimpleThemeToggle showLabel={false} className={className} />;
    case "full":
      return <FullThemeToggle className={className} />;
    case "simple":
    default:
      return <SimpleThemeToggle showLabel={showLabel} className={className} />;
  }
});

ThemeToggle.displayName = "ThemeToggle";

// Theme preview component for settings pages
export const ThemePreview = memo(({ 
  accentColor, 
  fontSize, 
  borderRadius 
}: {
  accentColor?: AccentColor;
  fontSize?: string;
  borderRadius?: string;
}) => {
  const { accentColors } = useAccentColor();
  const currentAccent = accentColor ? accentColors[accentColor] : accentColors.blue;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Preview</CardTitle>
        <CardDescription className="text-xs">
          How your theme will look
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div 
          className="h-8 rounded flex items-center px-3 text-xs font-medium text-white"
          style={{ 
            backgroundColor: currentAccent.primary,
            borderRadius: borderRadius || '0.5rem'
          }}
        >
          Primary Button
        </div>
        <div 
          className="h-8 rounded border border-border flex items-center px-3 text-xs"
          style={{ borderRadius: borderRadius || '0.5rem' }}
        >
          Secondary Button
        </div>
        <div 
          className="p-3 bg-muted rounded text-xs"
          style={{ 
            borderRadius: borderRadius || '0.5rem',
            fontSize: fontSize ? `${fontSize}rem` : '0.75rem'
          }}
        >
          This is sample text showing the current font size and border radius settings.
        </div>
      </CardContent>
    </Card>
  );
});

ThemePreview.displayName = "ThemePreview";