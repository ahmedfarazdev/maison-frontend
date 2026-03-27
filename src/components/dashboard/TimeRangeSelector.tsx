// ============================================================
// TimeRangeSelector — Global time filter for Dashboard
// Design: "Maison Ops" — compact, institutional, scan-first
// Features: Preset quick-picks + custom date range picker
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Calendar, ChevronDown, Clock, ArrowRight,
  Sun, CalendarDays, CalendarRange, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TimeRangePreset, CustomRange } from '@/hooks/useTimeRange';

interface TimeRangeSelectorProps {
  preset: TimeRangePreset;
  displayLabel: string;
  customRange?: CustomRange;
  onPresetChange: (preset: TimeRangePreset) => void;
  onCustomRangeChange: (from: string, to: string) => void;
}

const PRESET_GROUPS = [
  {
    label: 'Quick',
    items: [
      { key: 'today' as TimeRangePreset, label: 'Today', icon: Sun, shortcut: 'T' },
      { key: 'yesterday' as TimeRangePreset, label: 'Yesterday', icon: Clock, shortcut: 'Y' },
    ],
  },
  {
    label: 'Week',
    items: [
      { key: 'this_week' as TimeRangePreset, label: 'This Week', icon: CalendarDays, shortcut: 'W' },
      { key: 'last_7_days' as TimeRangePreset, label: 'Last 7 Days', icon: CalendarDays, shortcut: '7' },
    ],
  },
  {
    label: 'Month+',
    items: [
      { key: 'this_month' as TimeRangePreset, label: 'This Month', icon: CalendarRange, shortcut: 'M' },
      { key: 'last_30_days' as TimeRangePreset, label: 'Last 30 Days', icon: CalendarRange, shortcut: '3' },
      { key: 'this_quarter' as TimeRangePreset, label: 'This Quarter', icon: Zap, shortcut: 'Q' },
    ],
  },
];

export function TimeRangeSelector({
  preset,
  displayLabel,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: TimeRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(customRange?.from || '');
  const [customTo, setCustomTo] = useState(customRange?.to || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!open) return;
      const key = e.key.toUpperCase();
      const shortcutMap: Record<string, TimeRangePreset> = {
        T: 'today',
        Y: 'yesterday',
        W: 'this_week',
        '7': 'last_7_days',
        M: 'this_month',
        '3': 'last_30_days',
        Q: 'this_quarter',
      };
      if (shortcutMap[key]) {
        e.preventDefault();
        onPresetChange(shortcutMap[key]);
        setOpen(false);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onPresetChange]);

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      onCustomRangeChange(customFrom, customTo);
      setOpen(false);
    }
  };

  const isCustom = preset === 'custom';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className={cn(
          'gap-2 transition-all min-w-[140px] justify-between font-medium',
          open && 'ring-2 ring-gold/20 border-gold/40',
          isCustom && 'border-gold/30 text-gold',
        )}
      >
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs">{displayLabel}</span>
        </span>
        <ChevronDown className={cn(
          'w-3.5 h-3.5 text-muted-foreground transition-transform',
          open && 'rotate-180',
        )} />
      </Button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 z-50 w-[320px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
          >
            {/* Preset Groups */}
            <div className="p-2 space-y-1">
              {PRESET_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 pt-1.5 pb-1">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = preset === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          onPresetChange(item.key);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all',
                          isActive
                            ? 'bg-gold/10 text-gold font-medium'
                            : 'text-foreground hover:bg-muted/60',
                        )}
                      >
                        <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-gold' : 'text-muted-foreground')} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                        )}
                        <kbd className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Custom Range */}
            <div className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Custom Range
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:ring-2 focus:ring-gold/20 focus:border-gold/40 outline-none transition-all"
                  />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-4 shrink-0" />
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-2.5 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:ring-2 focus:ring-gold/20 focus:border-gold/40 outline-none transition-all"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleApplyCustom}
                disabled={!customFrom || !customTo}
                className="w-full mt-2.5 bg-gold hover:bg-gold/90 text-gold-foreground text-xs h-8"
              >
                Apply Custom Range
              </Button>
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 bg-muted/30 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                Press shortcut key to quick-select · <kbd className="font-mono">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
