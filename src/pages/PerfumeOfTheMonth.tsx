// ============================================================
// Perfume of the Month — Configure 4 POTM slots per month
// Slot 1 / Slot 2 / Slot 3 / Slot 4 with tier auto-assignment
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Sparkles, Calendar, Plus, Trash2, Save, Search,
  Star, Crown, Loader2, Wine, Check, X, Info, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Perfume } from '@/types';

const TIER_INFO = [
  { slot: 1, tier: 'Grand Master 1', icon: Crown, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', cardBorder: 'border-blue-500/40', desc: 'Gets 1 vial — this perfume if no selection made' },
  { slot: 2, tier: 'Grand Master 2', icon: Crown, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20', cardBorder: 'border-purple-500/40', desc: 'Gets 2 vials — slots 1 + 2 if no selection made' },
  { slot: 3, tier: 'Grand Master 3', icon: Crown, color: 'text-gold', bg: 'bg-gold/10 border-gold/20', cardBorder: 'border-gold/40', desc: 'Gets 3 vials — slots 1 + 2 + 3 if no selection made' },
  { slot: 4, tier: 'Grand Master 4', icon: Crown, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', cardBorder: 'border-rose-500/40', desc: 'Gets 4 vials — all slots if no selection made' },
];

function getMonthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function getNextMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

interface PotmEntry {
  month: string;
  slot: number;
  masterId: string;
  perfumeName: string;
  brand?: string;
  sizeMl: number;
  notes?: string;
}

export default function PerfumeOfTheMonth() {
  const { data: potmRes, refetch: refetchPotm } = useApiQuery(() => api.potm.list(), []);
  const { data: perfumesRes } = useApiQuery(() => api.master.perfumes(), []);

  const potmEntries = useMemo(() => (potmRes || []) as any[], [potmRes]);
  const perfumes = useMemo(() => (perfumesRes || []) as Perfume[], [perfumesRes]);

  const months = useMemo(() => getNextMonths(6), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const [activeTab, setActiveTab] = useState<'slots' | 'tiers'>('slots');

  // Local editing state for the selected month
  const [slots, setSlots] = useState<(PotmEntry | null)[]>([null, null, null]);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  // Load existing POTM entries for selected month
  useEffect(() => {
    const monthEntries = potmEntries.filter((e: any) => e.month === selectedMonth);
    const newSlots: (PotmEntry | null)[] = [null, null, null];
    for (const entry of monthEntries) {
      const idx = (entry.slot || 1) - 1;
      if (idx >= 0 && idx < 3) {
        newSlots[idx] = {
          month: entry.month,
          slot: entry.slot,
          masterId: entry.masterId || entry.master_id,
          perfumeName: entry.perfumeName || entry.perfume_name,
          brand: entry.brand,
          sizeMl: entry.sizeMl || entry.size_ml || 5,
          notes: entry.notes,
        };
      }
    }
    setSlots(newSlots);
    setEditingSlot(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, potmRes]);

  // Filtered perfumes for search
  const filteredPerfumes = useMemo(() => {
    if (!searchQuery.trim()) return perfumes.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return perfumes.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.master_id.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [perfumes, searchQuery]);

  const handleSelectPerfume = (slotIdx: number, perfume: Perfume) => {
    const newSlots = [...slots];
    newSlots[slotIdx] = {
      month: selectedMonth,
      slot: slotIdx + 1,
      masterId: perfume.master_id,
      perfumeName: perfume.name,
      brand: perfume.brand,
      sizeMl: 5,
    };
    setSlots(newSlots);
    setEditingSlot(null);
    setSearchQuery('');
  };

  const handleClearSlot = (slotIdx: number) => {
    const newSlots = [...slots];
    newSlots[slotIdx] = null;
    setSlots(newSlots);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < 3; i++) {
        const entry = slots[i];
        if (entry) {
          await api.potm.upsert({
            month: selectedMonth,
            slot: i + 1,
            masterId: entry.masterId,
            perfumeName: entry.perfumeName,
            brand: entry.brand,
            sizeMl: entry.sizeMl,
            notes: entry.notes,
          });
        } else {
          try {
            await api.potm.delete(selectedMonth, i + 1);
          } catch { /* ignore if not exists */ }
        }
      }
      toast.success(`POTM for ${getMonthLabel(selectedMonth)} saved`);
      refetchPotm();
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Check which months have entries configured
  const configuredMonths = new Set(potmEntries.map((e: any) => e.month));

  return (
    <div>
      <PageHeader
        title="Perfume of the Month"
        subtitle="Configure 3 featured perfumes per month for subscription auto-fill"
        breadcrumbs={[{ label: 'Subscriptions' }, { label: 'Perfume of the Month' }]}
        actions={
          <Button
            size="sm"
            className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Month Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {months.map(month => {
            const isSelected = month === selectedMonth;
            const isConfigured = configuredMonths.has(month);
            const isCurrent = month === months[0];
            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all whitespace-nowrap text-sm font-medium',
                  isSelected
                    ? 'bg-gold/15 border-gold/30 text-gold shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-gold/20',
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                {getMonthLabel(month)}
                {isCurrent && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/20 text-gold font-bold">Current</span>
                )}
                {isConfigured && !isSelected && (
                  <Check className="w-3 h-3 text-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Switcher: Slots / Tier Assignment */}
        <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit border border-border">
          <button
            onClick={() => setActiveTab('slots')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === 'slots'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <div className="flex items-center gap-2">
              <Wine className="w-3.5 h-3.5" />
              Slot Selection
            </div>
          </button>
          <button
            onClick={() => setActiveTab('tiers')}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === 'tiers'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5" />
              Tier Auto-Assignment
            </div>
          </button>
        </div>

        {/* ============ SLOTS TAB ============ */}
        {activeTab === 'slots' && (
          <>
            {/* Info Banner */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-600">
                  Assign a perfume to each slot. Subscribers who haven't made their own selections will receive these perfumes automatically based on their tier.
                </p>
              </div>
            </div>

            {/* Slot 1 / Slot 2 / Slot 3 Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map(idx => {
                const tier = TIER_INFO[idx];
                const entry = slots[idx];
                const isEditing = editingSlot === idx;

                return (
                  <div
                    key={tier.slot}
                    className={cn(
                      'rounded-xl border-2 overflow-hidden transition-all',
                      entry ? tier.cardBorder : 'border-dashed border-border/50',
                    )}
                  >
                    {/* Slot Header */}
                    <div className={cn('px-5 py-4', tier.bg)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', tier.bg)}>
                            <span className={cn('text-lg font-bold', tier.color)}>{tier.slot}</span>
                          </div>
                          <div>
                            <h3 className={cn('text-base font-bold', tier.color)}>Slot {tier.slot}</h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Put Perfume</p>
                          </div>
                        </div>
                        {entry && (
                          <button
                            onClick={() => handleClearSlot(idx)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Slot Content */}
                    <div className="p-5">
                      {entry ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                              <Wine className="w-6 h-6 text-gold" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{entry.perfumeName}</p>
                              <p className="text-xs text-muted-foreground">{entry.brand}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono bg-muted px-2 py-0.5 rounded text-[10px]">{entry.masterId}</span>
                            <span>·</span>
                            <span className="font-mono">{entry.sizeMl}ml vial</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs gap-1.5"
                            onClick={() => { setEditingSlot(idx); setSearchQuery(''); }}
                          >
                            <Sparkles className="w-3 h-3" /> Change Perfume
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                            <Wine className="w-7 h-7 text-muted-foreground/30" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">No perfume assigned</p>
                          <p className="text-[11px] text-muted-foreground/70 mb-4">Select a perfume for this slot</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={() => { setEditingSlot(idx); setSearchQuery(''); }}
                          >
                            <Plus className="w-3 h-3" /> Select Perfume
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Search Dropdown */}
                    {isEditing && (
                      <div className="border-t border-border p-3 bg-muted/20">
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search perfumes..."
                            className="w-full pl-8 pr-8 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-gold/50"
                            autoFocus
                          />
                          <button
                            onClick={() => { setEditingSlot(null); setSearchQuery(''); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {filteredPerfumes.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">No perfumes found</p>
                          ) : (
                            filteredPerfumes.map(p => (
                              <button
                                key={p.master_id}
                                onClick={() => handleSelectPerfume(idx, p)}
                                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors flex items-center gap-2"
                              >
                                <Wine className="w-3 h-3 text-gold shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{p.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{p.brand} · {p.master_id}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ============ TIER AUTO-ASSIGNMENT TAB ============ */}
        {activeTab === 'tiers' && (
          <>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-600">
                  When a subscription cycle locks, subscribers who haven't made their own perfume selections will automatically receive the POTM perfumes based on their tier level. This table shows what each tier receives.
                </p>
              </div>
            </div>

            {/* Tier Assignment Cards */}
            <div className="space-y-4">
              {TIER_INFO.map((tier, tierIdx) => {
                const TierIcon = tier.icon;
                const assignedSlots = slots.slice(0, tierIdx + 1);
                const hasAllSlots = assignedSlots.every(s => s !== null);

                return (
                  <div key={tier.tier} className={cn('rounded-xl border-2 overflow-hidden', tier.bg)}>
                    {/* Tier Header */}
                    <div className={cn('px-5 py-4 flex items-center justify-between')}>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', tier.bg)}>
                          <TierIcon className={cn('w-5 h-5', tier.color)} />
                        </div>
                        <div>
                          <h3 className={cn('text-base font-bold', tier.color)}>{tier.tier}</h3>
                          <p className="text-xs text-muted-foreground">
                            Receives {tierIdx + 1} {tierIdx === 0 ? 'perfume' : 'perfumes'} if no selection made
                          </p>
                        </div>
                      </div>
                      {hasAllSlots ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                          <Check className="w-3 h-3" /> Configured
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                          Missing slots
                        </span>
                      )}
                    </div>

                    {/* Assigned Perfumes */}
                    <div className="px-5 pb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {assignedSlots.map((entry, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-2">
                            {slotIdx > 0 && (
                              <span className="text-muted-foreground/40 text-xs">+</span>
                            )}
                            <div className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-background/50',
                              entry ? 'border-border' : 'border-dashed border-border/50',
                            )}>
                              <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', TIER_INFO[slotIdx].bg, TIER_INFO[slotIdx].color)}>
                                S{slotIdx + 1}
                              </span>
                              {entry ? (
                                <div className="flex items-center gap-2">
                                  <Wine className="w-3.5 h-3.5 text-gold shrink-0" />
                                  <div>
                                    <p className="text-sm font-semibold leading-tight">{entry.perfumeName}</p>
                                    <p className="text-[10px] text-muted-foreground">{entry.brand} · {entry.sizeMl}ml</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Not assigned</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Table */}
            <SectionCard title="Auto-Assignment Summary" className="overflow-hidden">
              <div className="overflow-x-auto -m-4">
                <table className="w-full ops-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Slot</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Perfume</th>
                      <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Crown className="w-3 h-3 text-blue-500" /> GM 1
                        </div>
                      </th>
                      <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Crown className="w-3 h-3 text-purple-500" /> GM 2
                        </div>
                      </th>
                      <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Crown className="w-3 h-3 text-gold" /> GM 3
                        </div>
                      </th>
                      <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Crown className="w-3 h-3 text-rose-500" /> GM 4
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3].map(slotIdx => {
                      const entry = slots[slotIdx];
                      const tier = TIER_INFO[slotIdx];
                      return (
                        <tr key={slotIdx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border', tier.bg, tier.color)}>
                              Slot {slotIdx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {entry ? (
                              <div className="flex items-center gap-2">
                                <Wine className="w-3.5 h-3.5 text-gold" />
                                <span className="text-sm font-medium">{entry.perfumeName}</span>
                                <span className="text-[10px] text-muted-foreground">({entry.brand})</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Not assigned</span>
                            )}
                          </td>
                          {/* GM1 gets Slot 1 only */}
                          <td className="px-4 py-3 text-center">
                            {slotIdx === 0 ? (
                              <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                          {/* GM2 gets Slot 1 + 2 */}
                          <td className="px-4 py-3 text-center">
                            {slotIdx <= 1 ? (
                              <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                          {/* GM3 gets Slot 1 + 2 + 3 */}
                          <td className="px-4 py-3 text-center">
                            {slotIdx <= 2 ? (
                              <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </td>
                          {/* GM4 gets all 4 */}
                          <td className="px-4 py-3 text-center">
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}

        {/* Overview: All Configured Months */}
        <SectionCard title="POTM Overview — All Months" className="overflow-hidden">
          {potmEntries.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No POTM configured yet"
              description="Select a month above and assign perfumes to each slot to get started."
            />
          ) : (
            <div className="overflow-x-auto -m-4">
              <table className="w-full ops-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Month</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Slot</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Perfume</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Brand</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Size</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Tier Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {potmEntries.map((entry: any, i: number) => {
                    const slot = entry.slot || entry.slot_number || 1;
                    const tierInfo = TIER_INFO[slot - 1] || TIER_INFO[0];
                    const TierIcon = tierInfo.icon;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium">{getMonthLabel(entry.month)}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border', tierInfo.bg, tierInfo.color)}>
                            <TierIcon className="w-3 h-3" />
                            Slot {slot}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium">{entry.perfumeName || entry.perfume_name}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">{entry.brand || '—'}</td>
                        <td className="px-4 py-2.5 text-sm font-mono">{entry.sizeMl || entry.size_ml || 5}ml</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {slot === 1 && 'All tiers (GM 1–4)'}
                          {slot === 2 && 'GM 2, 3, 4'}
                          {slot === 3 && 'GM 3, 4'}
                          {slot === 4 && 'GM 4 only'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
