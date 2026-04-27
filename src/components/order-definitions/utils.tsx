/**
 * Utility functions for Order Definition workflow builder
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { type LucideProps } from 'lucide-react';

/**
 * Auto-generate status code from label
 * e.g., "Processing Order" -> "processing_order"
 */
export function generateStatusCode(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 50);
}

/**
 * Known transition condition types (predefined)
 */
export const CONDITION_TYPES = [
  { value: 'payment_complete', label: 'Payment Complete' },
  { value: 'quality_check_passed', label: 'Quality Check Passed' },
  { value: 'inventory_available', label: 'Inventory Available' },
  { value: 'manual_approval', label: 'Manual Approval' },
  { value: 'customer_confirmed', label: 'Customer Confirmed' },
  { value: 'scheduled_time', label: 'Scheduled Time' },
];

/**
 * Get condition label from value, with fallback to custom text
 */
export function getConditionLabel(value: string): string {
  const predefined = CONDITION_TYPES.find((c) => c.value === value);
  return predefined?.label || value || '(no condition)';
}

/**
 * Map color token to Tailwind classes for status card background
 */
export const COLOR_TOKEN_STYLES: Record<string, string> = {
  yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
  cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  pink: 'bg-pink-500/10 border-pink-500/30 text-pink-300',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  teal: 'bg-teal-500/10 border-teal-500/30 text-teal-300',
  green: 'bg-green-500/10 border-green-500/30 text-green-300',
  orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
};

export function getColorStyle(colorToken: string | null): string {
  if (!colorToken) return 'bg-muted/30 border-muted text-foreground';
  return COLOR_TOKEN_STYLES[colorToken] || 'bg-muted/30 border-muted text-foreground';
}

/**
 * Get terminal status background style
 */
export function getTerminalStyle(colorToken: string | null): string {
  if (!colorToken) return 'bg-amber-500/20 border-amber-500/40';
  // Add terminal highlight (e.g., amber background for emphasis)
  return `${getColorStyle(colorToken)} bg-opacity-20`;
}

/**
 * Predefined set of icons for Order Definitions
 */
export const ICON_TOKENS = [
  'shopping-cart',
  'package',
  'truck',
  'credit-card',
  'user',
  'users',
  'briefcase',
  'clipboard-list',
  'check-circle',
  'clock',
  'alert-circle',
  'star',
  'file-text',
  'archive',
  'layers',
  'activity',
  'settings',
  'send',
  'box',
  'tag',
  'map-pin',
  'calendar',
  'gift',
  'shopping-bag',
  'wallet',
  'hard-drive',
];

/**
 * Helper to render an icon from its token name
 */
export function DynamicIcon({ 
  token, 
  ...props 
}: { 
  token: string | null; 
} & LucideProps) {
  const SettingsIcon = LucideIcons.Settings;
  
  if (!token) return <SettingsIcon {...props} />;

  // Convert kebab-case to PascalCase for Lucide icons
  const iconName = token
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = (LucideIcons as any)[iconName];

  if (!IconComponent) {
    return <SettingsIcon {...props} />;
  }

  return <IconComponent {...props} />;
}

