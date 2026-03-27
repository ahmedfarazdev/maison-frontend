// ============================================================
// useTimeRange — Global time-range state for Dashboard filtering
// Persists selection in localStorage, computes date boundaries
// ============================================================

import { useState, useCallback, useMemo } from 'react';

export type TimeRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'this_quarter'
  | 'custom';

export interface TimeRange {
  preset: TimeRangePreset;
  from: Date;
  to: Date;
  label: string;
}

export interface CustomRange {
  from: string; // ISO date string YYYY-MM-DD
  to: string;
}

const STORAGE_KEY = 'aura-vault-dashboard-time-range';

const PRESET_LABELS: Record<TimeRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  this_quarter: 'This Quarter',
  custom: 'Custom Range',
};

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function computeRange(preset: TimeRangePreset, custom?: CustomRange): { from: Date; to: Date } {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return { from: today, to: endOfDay(now) };

    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y) };
    }

    case 'this_week': {
      const dow = now.getDay();
      const monday = new Date(today);
      monday.setDate(monday.getDate() - ((dow + 6) % 7)); // Monday start
      return { from: monday, to: endOfDay(now) };
    }

    case 'last_7_days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: d, to: endOfDay(now) };
    }

    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: first, to: endOfDay(now) };
    }

    case 'last_30_days': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: d, to: endOfDay(now) };
    }

    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const first = new Date(now.getFullYear(), qMonth, 1);
      return { from: first, to: endOfDay(now) };
    }

    case 'custom': {
      if (custom) {
        return {
          from: startOfDay(new Date(custom.from)),
          to: endOfDay(new Date(custom.to)),
        };
      }
      return { from: today, to: endOfDay(now) };
    }

    default:
      return { from: today, to: endOfDay(now) };
  }
}

function loadPreset(): { preset: TimeRangePreset; custom?: CustomRange } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { preset: 'today' };
    const parsed = JSON.parse(raw);
    if (parsed.preset && PRESET_LABELS[parsed.preset as TimeRangePreset]) {
      return { preset: parsed.preset, custom: parsed.custom };
    }
    return { preset: 'today' };
  } catch {
    return { preset: 'today' };
  }
}

function savePreset(preset: TimeRangePreset, custom?: CustomRange) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, custom }));
  } catch {
    // silently fail
  }
}

export function useTimeRange() {
  const [stored] = useState(() => loadPreset());
  const [preset, setPresetState] = useState<TimeRangePreset>(stored.preset);
  const [customRange, setCustomRangeState] = useState<CustomRange | undefined>(stored.custom);

  const range = useMemo<TimeRange>(() => {
    const { from, to } = computeRange(preset, customRange);
    return { preset, from, to, label: PRESET_LABELS[preset] };
  }, [preset, customRange]);

  const setPreset = useCallback((p: TimeRangePreset) => {
    setPresetState(p);
    if (p !== 'custom') {
      savePreset(p);
    }
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    const cr = { from, to };
    setCustomRangeState(cr);
    setPresetState('custom');
    savePreset('custom', cr);
  }, []);

  // Formatted display string for the range
  const displayLabel = useMemo(() => {
    if (preset === 'custom' && customRange) {
      const fmt = (d: string) => {
        try {
          return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        } catch { return d; }
      };
      return `${fmt(customRange.from)} – ${fmt(customRange.to)}`;
    }
    return PRESET_LABELS[preset];
  }, [preset, customRange]);

  // For API calls: ISO string boundaries
  const apiParams = useMemo(() => ({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  }), [range]);

  return {
    range,
    preset,
    customRange,
    displayLabel,
    apiParams,
    setPreset,
    setCustomRange,
    presetOptions: PRESET_LABELS,
  };
}
