// ============================================================
// useDashboardLayout — Persistent KPI card layout preferences
// Stores order + visibility in localStorage per user
// V2: AuraKey-first KPI cards and sections
// ============================================================

import { useState, useCallback, useEffect, useMemo } from 'react';

export interface KPICardConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface DashboardSection {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const STORAGE_KEY = 'aura-vault-dashboard-layout-v3';
const SECTIONS_KEY = 'aura-vault-dashboard-sections-v3';

// V3: Enhanced KPI card definitions with daily metrics
const DEFAULT_KPI_CARDS: KPICardConfig[] = [
  { id: 'active_subscribers', label: 'Active Subscribers', visible: true, order: 0 },
  { id: 'subscription_cycle', label: 'Next Cycle Cutoff', visible: true, order: 1 },
  { id: 'daily_orders', label: 'Orders Today', visible: true, order: 2 },
  { id: 'new_subscribers', label: 'New Subscribers', visible: true, order: 3 },
  { id: 'daily_revenue', label: 'Daily Revenue', visible: true, order: 4 },
  { id: 'vials_required', label: 'Vials Required', visible: true, order: 5 },
  { id: 'inventory_coverage', label: 'Inventory Coverage', visible: true, order: 6 },
  { id: 'capsule_sellthrough', label: 'Capsule Sell-Through', visible: true, order: 7 },
  { id: 'vault_status', label: 'Em Vault Status', visible: true, order: 8 },
  { id: 'ops_today', label: 'Ops Today', visible: true, order: 9 },
  { id: 'revenue', label: 'Revenue (AED)', visible: true, order: 10 },
];

// V3: Enhanced section definitions with revenue analytics
const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: 'revenue_analytics', label: 'Revenue Analytics', visible: true, order: 0 },
  { id: 'pipeline', label: 'Jobs Pipeline', visible: true, order: 1 },
  { id: 'capsule_vault', label: 'Capsules & Em Vault', visible: true, order: 2 },
  { id: 'inventory_health', label: 'Inventory Health', visible: true, order: 3 },
  { id: 'po_tracker', label: 'Purchase Orders', visible: true, order: 4 },
  { id: 'alerts', label: 'Alerts', visible: true, order: 5 },
  { id: 'operator_progress', label: 'Operator Progress', visible: true, order: 6 },
];

function loadFromStorage<T extends { id: string }>(key: string, defaults: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults;
    // Merge: add any new defaults that don't exist in stored data
    const storedIds = new Set(parsed.map(item => item.id));
    const newItems = defaults.filter(d => !storedIds.has(d.id));
    if (newItems.length > 0) {
      const maxOrder = Math.max(...parsed.map((item: any) => item.order ?? 0), 0);
      return [...parsed, ...newItems.map((item, idx) => ({ ...item, order: maxOrder + 1 + idx }))];
    }
    return parsed;
  } catch {
    return defaults;
  }
}

function saveToStorage<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function useDashboardLayout() {
  const [cards, setCards] = useState<KPICardConfig[]>(() =>
    loadFromStorage(STORAGE_KEY, DEFAULT_KPI_CARDS)
  );
  const [sections, setSections] = useState<DashboardSection[]>(() =>
    loadFromStorage(SECTIONS_KEY, DEFAULT_SECTIONS)
  );
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Persist on change
  useEffect(() => { saveToStorage(STORAGE_KEY, cards); }, [cards]);
  useEffect(() => { saveToStorage(SECTIONS_KEY, sections); }, [sections]);

  // Sorted visible cards
  const visibleCards = useMemo(
    () => [...cards].filter(c => c.visible).sort((a, b) => a.order - b.order),
    [cards]
  );

  const visibleSections = useMemo(
    () => [...sections].filter(s => s.visible).sort((a, b) => a.order - b.order),
    [sections]
  );

  const toggleCardVisibility = useCallback((id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  }, []);

  const toggleSectionVisibility = useCallback((id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  }, []);

  const reorderCards = useCallback((fromIndex: number, toIndex: number) => {
    setCards(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      return sorted.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      return sorted.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setCards(DEFAULT_KPI_CARDS);
    setSections(DEFAULT_SECTIONS);
  }, []);

  const hasCustomizations = useMemo(() => {
    const cardsMatch = JSON.stringify(cards) === JSON.stringify(DEFAULT_KPI_CARDS);
    const sectionsMatch = JSON.stringify(sections) === JSON.stringify(DEFAULT_SECTIONS);
    return !cardsMatch || !sectionsMatch;
  }, [cards, sections]);

  return {
    cards,
    sections,
    visibleCards,
    visibleSections,
    isCustomizing,
    setIsCustomizing,
    toggleCardVisibility,
    toggleSectionVisibility,
    reorderCards,
    reorderSections,
    resetToDefaults,
    hasCustomizations,
  };
}
