// ============================================================
// Vault Locations — Full Location Builder
// Design: "Maison Ops" — Luxury Operations
// Zone → Shelf → Slot hierarchy with visual slot grid,
// occupancy tracking, "Add Perfume to Location" flow,
// auto-generated location codes, and Add Zone wizard
// ============================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader, StatusBadge, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockPerfumes } from '@/lib/mock-data';
import { useLocations } from '@/hooks/useLocations';
import { usePerfumeTypeahead } from '@/hooks/usePerfumeTypeahead';
import { api } from '@/lib/api-client';
import type { VaultLocation, LocationType, PerfumeSearchResult } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  MapPin, Plus, Search, ChevronDown, ChevronRight, Grid3X3,
  Package, Droplets, Box, Layers, X, Check, Edit2, Trash2,
  ArrowRight, Download, LayoutGrid, List, AlertTriangle,
  Wine, ChevronLeft, Scan, Hash, Loader2, Upload
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import GenericBulkImport, { ImportColumn } from '@/components/shared/GenericBulkImport';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ---- Constants ----
const VAULT_NAMES = ['Main', 'Decant', 'Staging'] as const;
const LOCATION_TYPES: { value: LocationType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'sealed', label: 'Sealed', icon: Box, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { value: 'decant', label: 'Decant', icon: Droplets, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { value: 'packaging', label: 'Packaging', icon: Package, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'staging', label: 'Staging', icon: Layers, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
];

const TYPE_COLORS: Record<LocationType, { bg: string; border: string; text: string; dot: string }> = {
  sealed: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  decant: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  packaging: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  staging: { bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
};

const VAULT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'vault', label: 'Vault', required: true, description: 'Main, Decant, or Staging' },
  { key: 'zone', label: 'Zone', required: true },
  { key: 'shelf', label: 'Shelf', required: true },
  { key: 'slot', label: 'Slot', required: true },
  { key: 'type', label: 'Type', required: true, description: 'sealed, decant, packaging, staging' },
  { key: 'occupied', label: 'Occupied', description: 'Yes/No' },
  { key: 'master_id', label: 'Master ID', description: 'Assigned perfume Master ID' },
  { key: 'perfume_name', label: 'Perfume Name' },
];


// ---- Helpers ----
function generateLocationCode(vault: string, zone: string, shelf: string, slot: string): string {
  const vaultPrefix = vault === 'Main' ? 'MAIN' : vault === 'Decant' ? 'DEC' : 'STG';
  return `${vaultPrefix}-${zone}-${shelf}-${String(slot).padStart(2, '0')}`;
}

interface ZoneGroup {
  vault: string;
  zone: string;
  type: LocationType;
  shelves: { shelf: string; slots: VaultLocation[] }[];
  total: number;
  occupied: number;
}

function groupByZone(locations: VaultLocation[]): ZoneGroup[] {
  const map = new Map<string, ZoneGroup>();
  for (const loc of locations) {
    const key = `${loc.vault}-${loc.zone}`;
    if (!map.has(key)) {
      map.set(key, { vault: loc.vault, zone: loc.zone, type: loc.type, shelves: [], total: 0, occupied: 0 });
    }
    const group = map.get(key)!;
    group.total++;
    if (loc.occupied) group.occupied++;
    let shelf = group.shelves.find(s => s.shelf === loc.shelf);
    if (!shelf) {
      shelf = { shelf: loc.shelf, slots: [] };
      group.shelves.push(shelf);
    }
    shelf.slots.push(loc);
  }
  for (const g of Array.from(map.values())) {
    g.shelves.sort((a: { shelf: string }, b: { shelf: string }) => Number(a.shelf) - Number(b.shelf));
    for (const s of g.shelves) {
      s.slots.sort((a: VaultLocation, b: VaultLocation) => Number(a.slot) - Number(b.slot));
    }
  }
  return Array.from(map.values()).sort((a, b) => `${a.vault}-${a.zone}`.localeCompare(`${b.vault}-${b.zone}`));
}

// ---- Perfume name lookup ----
const perfumeMap: Record<string, { name: string; brand: string }> = {};
mockPerfumes.forEach(p => { perfumeMap[p.master_id] = { name: p.name, brand: p.brand }; });

function getPerfumeName(masterId: string): string {
  const p = perfumeMap[masterId];
  return p ? `${p.brand} — ${p.name}` : masterId;
}

type SearchablePerfume = PerfumeSearchResult & {
  _name: string;
};

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scorePerfumeToken(token: string, perfume: SearchablePerfume): number {
  const idWords = normalizeSearchValue(perfume.id).split(' ').filter(Boolean);
  const masterIdWords = normalizeSearchValue(perfume.master_id).split(' ').filter(Boolean);
  const nameWords = normalizeSearchValue(perfume._name).split(' ').filter(Boolean);

  const compactToken = token.replace(/\s+/g, '');
  const idCompact = idWords.join('');
  const masterIdCompact = masterIdWords.join('');
  const nameNormalized = normalizeSearchValue(perfume._name);

  if (token.length === 1) {
    if (masterIdWords.some((word) => word.startsWith(token) && word.length > 1)) return 120;
    if (nameWords.some((word) => word.startsWith(token) && word.length > 1)) return 100;
    if (idWords.some((word) => word.startsWith(token) && word.length > 1)) return 90;
    return 0;
  }

  if (masterIdCompact === compactToken || idCompact === compactToken) return 260;
  if (masterIdWords.some((word) => word.startsWith(token))) return 200;
  if (nameWords.some((word) => word.startsWith(token))) return 180;
  if (masterIdCompact.includes(compactToken) || idCompact.includes(compactToken)) return 140;
  if (nameNormalized.includes(token)) return 110;
  return 0;
}

function filterPerfumeSearchResults<T extends SearchablePerfume>(
  perfumes: T[],
  query: string,
  limit = 20,
): T[] {
  if (!query.trim()) return perfumes.slice(0, limit);

  const tokens = normalizeSearchValue(query).split(' ').filter(Boolean);

  const scored = perfumes.map((perfume) => {
    const score = tokens.reduce((sum, token) => sum + scorePerfumeToken(token, perfume), 0);
    return { perfume, score };
  }).filter((s) => s.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.perfume).slice(0, limit);
}

// ---- Slot Cell Component ----
function SlotCell({ loc, onClick }: { loc: VaultLocation; onClick: (loc: VaultLocation) => void }) {
  const tc = TYPE_COLORS[loc.type];
  const displayName = loc.perfume_name || (loc.master_id ? getPerfumeName(loc.master_id) : 'Occupied');
  return (
    <button
      onClick={() => onClick(loc)}
      className={cn(
        'relative w-full aspect-square rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center gap-0.5 group',
        loc.occupied
          ? `${tc.border} ${tc.bg} shadow-sm hover:shadow-md hover:scale-[1.03]`
          : 'border-dashed border-border/60 hover:border-border hover:bg-muted/30 hover:scale-[1.02]',
      )}
      title={loc.occupied ? `${displayName} — ${loc.location_code}` : `Empty — ${loc.location_code}`}
    >
      {loc.occupied ? (
        <>
          <div className={cn('w-2.5 h-2.5 rounded-full', tc.dot)} />
          <span className="text-[8px] font-mono font-bold text-foreground/80 leading-none truncate max-w-full px-0.5">
            {loc.slot}
          </span>
          <span className="text-[7px] font-medium text-foreground/70 leading-tight text-center truncate max-w-full px-1">
            {displayName}
          </span>
        </>
      ) : (
        <>
          <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
          <span className="text-[8px] font-mono text-muted-foreground/50 leading-none">{loc.slot}</span>
        </>
      )}
    </button>
  );
}

// ---- Add Zone Dialog ----
function AddZoneDialog({ onAdd, onClose, existingZones, isCreating }: {
  onAdd: (locs: VaultLocation[]) => void;
  onClose: () => void;
  existingZones: ZoneGroup[];
  isCreating?: boolean;
}) {
  const [vault, setVault] = useState<string>('Main');
  const [zoneId, setZoneId] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [type, setType] = useState<LocationType>('sealed');
  const [shelfCount, setShelfCount] = useState(2);
  const [slotsPerShelf, setSlotsPerShelf] = useState(4);

  const previewCode = zoneId ? generateLocationCode(vault, zoneId, '1', '01') : '—';
  const totalSlots = shelfCount * slotsPerShelf;

  const handleSubmit = () => {
    if (!zoneId.trim()) { toast.error('Zone ID is required'); return; }
    if (existingZones.some(z => z.vault === vault && z.zone === zoneId)) {
      toast.error(`Zone ${zoneId} already exists in ${vault}`);
      return;
    }
    const newLocs: VaultLocation[] = [];
    for (let s = 1; s <= shelfCount; s++) {
      for (let sl = 1; sl <= slotsPerShelf; sl++) {
        const slotStr = String(sl).padStart(2, '0');
        const code = generateLocationCode(vault, zoneId, String(s), slotStr);
        newLocs.push({
          location_id: `loc_new_${Date.now()}_${s}_${sl}`,
          location_code: code,
          vault,
          zone: zoneId,
          shelf: String(s),
          slot: slotStr,
          position: slotStr,
          code,
          type,
          occupied: false,
        });
      }
    }
    onAdd(newLocs);
    toast.success(`Zone ${zoneId} created with ${totalSlots} slots`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold">Add Zone</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Define a new zone with shelves and slots</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Vault</label>
            <div className="flex gap-2">
              {VAULT_NAMES.map(v => (
                <button key={v} onClick={() => setVault(v)}
                  className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-all', vault === v ? 'bg-gold/10 border-gold text-gold' : 'border-border hover:bg-muted/50')}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Zone ID</label>
              <Input value={zoneId} onChange={e => setZoneId(e.target.value)} placeholder="C" className="font-mono" maxLength={32} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Zone Name (optional)</label>
              <Input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Zone C — Niche Exclusives" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Location Type</label>
            <div className="grid grid-cols-4 gap-2">
              {LOCATION_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.value} onClick={() => setType(t.value)}
                    className={cn('flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all',
                      type === t.value ? `${t.color} border-current` : 'border-border hover:bg-muted/50')}>
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Shelves</label>
              <Input type="number" min={1} max={20} value={shelfCount} onChange={e => setShelfCount(Number(e.target.value))} className="font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Slots per Shelf</label>
              <Input type="number" min={1} max={50} value={slotsPerShelf} onChange={e => setSlotsPerShelf(Number(e.target.value))} className="font-mono" />
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preview</p>
                <p className="text-sm font-mono font-bold mt-1">{previewCode}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Slots</p>
                <p className="text-sm font-mono font-bold mt-1">{totalSlots}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit}
            disabled={!zoneId.trim() || isCreating}>
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {isCreating ? 'Creating...' : 'Create Zone'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Assign Perfume Dialog (click on existing slot) ----
function AssignPerfumeDialog({ location, onAssign, onClear, onDelete, isAssigning, isClearing, isDeleting, onClose }: {
  location: VaultLocation;
  onAssign: (locId: string, masterId: string, perfumeName: string) => void;
  onClear: (locId: string) => void;
  onDelete: (locId: string) => void;
  isAssigning?: boolean;
  isClearing?: boolean;
  isDeleting?: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedPerfume, setSelectedPerfume] = useState<SearchablePerfume | null>(null);
  const [showPerfumeDropdown, setShowPerfumeDropdown] = useState(false);
  const perfumeDropdownRef = useRef<HTMLDivElement>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const {
    suggestions,
    searchResults,
    isLoadingSuggestions,
    isSearching,
    prefetchSuggestions,
  } = usePerfumeTypeahead(search, { active: showPerfumeDropdown, minChars: 3, limit: 20 });

  const searchQuery = search.trim();
  const showSearchResults = searchQuery.length >= 3;
  const basePerfumes = useMemo(() => {
    const source = showSearchResults ? searchResults : suggestions;
    return source.map((perfume) => ({
      ...perfume,
      _name: perfume.brand && perfume.name
        ? `${perfume.brand} — ${perfume.name}`
        : perfume.name || perfume.master_id,
    }));
  }, [searchResults, showSearchResults, suggestions]);
  const filtered = filterPerfumeSearchResults(basePerfumes, searchQuery, 20);
  const isLoadingResults = showSearchResults ? isSearching : isLoadingSuggestions;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!showPerfumeDropdown) return;
      if (perfumeDropdownRef.current && !perfumeDropdownRef.current.contains(e.target as Node)) {
        setShowPerfumeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPerfumeDropdown]);


  const tc = TYPE_COLORS[location.type];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold">{location.occupied ? 'Slot Details' : 'Assign Perfume'}</h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{location.location_code}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className={cn('rounded-lg p-3 border', tc.border, tc.bg)}>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Vault</p>
                <p className="text-sm font-mono font-bold">{location.vault}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Zone</p>
                <p className="text-sm font-mono font-bold">{location.zone}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Shelf</p>
                <p className="text-sm font-mono font-bold">{location.shelf}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Slot</p>
                <p className="text-sm font-mono font-bold">{location.slot}</p>
              </div>
            </div>
          </div>

          {location.occupied ? (
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Currently Occupied</p>
                <p className="text-sm font-semibold mt-1">{location.perfume_name || 'Unknown'}</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{location.master_id || '—'}</p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                disabled={isClearing}
                onClick={() => setClearDialogOpen(true)}
              >
                {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isClearing ? 'Clearing...' : 'Clear Slot'}
              </Button>
              <AlertDialog
                open={clearDialogOpen}
                onOpenChange={(open) => {
                  if (open) {
                    setClearDialogOpen(true);
                    return;
                  }

                  if (!isClearing) {
                    setClearDialogOpen(false);
                  }
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Slot Contents</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to clear this vault slot? This will disconnect the perfume from this location.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault();
                        if (isClearing) return;
                        onClear(location.id ?? location.location_id);
                      }}
                      disabled={isClearing}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isClearing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                      {isClearing ? 'Clearing...' : 'Clear Slot'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Search Perfume</label>
                <div ref={perfumeDropdownRef} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowPerfumeDropdown(true); }}
                    onFocus={() => {
                      setShowPerfumeDropdown(true);
                      prefetchSuggestions();
                    }}
                    placeholder="Search by perfume name, brand, or Master ID..."
                    className="pl-9 h-14"
                    autoFocus
                  />
                  {showPerfumeDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {isLoadingResults ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin inline-block" />
                        </div>
                      ) : (
                        <div className="space-y-1 p-1">
                          {filtered.map(perfume => (
                            <button key={perfume.id} onClick={() => { setSelectedPerfume(perfume); setSearch(''); setShowPerfumeDropdown(false); }}
                              className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted/50',
                                selectedPerfume?.id === perfume.id && 'bg-gold/10 border border-gold/30')}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{perfume._name}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground">{perfume.master_id}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                          {filtered.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-3">
                              {search.trim() ? 'No perfumes found' : 'No perfumes available'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedPerfume && (
                <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Selected Perfume</p>
                  <p className="text-sm font-bold mt-1">{selectedPerfume._name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {selectedPerfume.master_id}
                  </p>
                </div>
              )}
              {!search && !selectedPerfume && !isLoadingResults && (
                <div className="text-center py-6">
                  <Scan className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Search for a perfume in master data</p>
                </div>
              )}
            </div>
          )}
        </div>
        {!location.occupied && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {isDeleting ? 'Deleting...' : 'Delete Slot'}
            </Button>
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                if (open) {
                  setDeleteDialogOpen(true);
                  return;
                }

                if (!isDeleting) {
                  setDeleteDialogOpen(false);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Location Slot</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete this empty vault slot? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      if (isDeleting) return;
                      onDelete(location.id ?? location.location_id);
                    }}
                    disabled={isDeleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    {isDeleting ? 'Deleting...' : 'Delete Slot'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={isAssigning || isDeleting}>Cancel</Button>
              <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                disabled={!selectedPerfume || isAssigning || isDeleting}
                onClick={() => {
                  if (selectedPerfume) {
                    onAssign(location.id ?? location.location_id, selectedPerfume.master_id, selectedPerfume._name);
                  }
                }}>
                {isAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isAssigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Add Perfume to Vault Location — 2-Step Dialog ----
// Step 1: Select an existing perfume
// Step 2: Assign a vault location
type AddBottleStep = 'bottle' | 'location' | 'confirm';

function AddBottleToLocationDialog({
  locations,
  onComplete,
  onClose,
}: {
  locations: VaultLocation[];
  onComplete: (data: {
    perfume: SearchablePerfume;
    locationId: string;
    locationCode: string;
  }) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<AddBottleStep>('bottle');

  // Step 1: Perfume selection
  const [perfumeSearch, setPerfumeSearch] = useState('');
  const [selectedPerfume, setSelectedPerfume] = useState<SearchablePerfume | null>(null);
  const [showPerfumeDropdown, setShowPerfumeDropdown] = useState(false);
  const perfumeDropdownRef = useRef<HTMLDivElement>(null);
  const {
    suggestions,
    searchResults,
    isLoadingSuggestions,
    isSearching,
    prefetchSuggestions,
  } = usePerfumeTypeahead(perfumeSearch, { active: showPerfumeDropdown, minChars: 3, limit: 20 });

  // Step 2: Location selection
  const [locationFilter, setLocationFilter] = useState<LocationType>('sealed');
  const [selectedLocation, setSelectedLocation] = useState<VaultLocation | null>(null);
  const [locationOverride, setLocationOverride] = useState(false);

  const perfumeQuery = perfumeSearch.trim();
  const showSearchResults = perfumeQuery.length >= 3;
  const basePerfumes = useMemo(() => {
    const source = showSearchResults ? searchResults : suggestions;
    return source.map((perfume) => ({
      ...perfume,
      _name: perfume.brand && perfume.name
        ? `${perfume.brand} — ${perfume.name}`
        : perfume.name || perfume.master_id,
    }));
  }, [searchResults, showSearchResults, suggestions]);
  const filteredPerfumes = filterPerfumeSearchResults(basePerfumes, perfumeQuery, 20);
  const isLoadingResults = showSearchResults ? isSearching : isLoadingSuggestions;

  // Auto-select next available location
  const nextAvailableLocation = useMemo(() => {
    return locations.find(l => !l.occupied && l.type === locationFilter);
  }, [locations, locationFilter]);

  // Available empty locations
  const emptyLocations = useMemo(() => {
    return locations.filter(l => !l.occupied && l.type === locationFilter);
  }, [locations, locationFilter]);

  const handleSelectPerfume = (perfume: SearchablePerfume) => {
    setSelectedPerfume(perfume);
    setPerfumeSearch('');
    setShowPerfumeDropdown(false);
  };

  const handleGoToLocation = () => {
    if (nextAvailableLocation && !selectedLocation) {
      setSelectedLocation(nextAvailableLocation);
    }
    setStep('location');
  };

  const steps: { key: AddBottleStep; label: string; num: number }[] = [
    { key: 'bottle', label: 'Select Perfume', num: 1 },
    { key: 'location', label: 'Assign Location', num: 2 },
    { key: 'confirm', label: 'Confirm', num: 3 },
  ];
  const currentStepIdx = steps.findIndex(s => s.key === step);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!showPerfumeDropdown) return;
      if (perfumeDropdownRef.current && !perfumeDropdownRef.current.contains(e.target as Node)) {
        setShowPerfumeDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPerfumeDropdown]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl   flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold">Add Perfume to Vault Location</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Select an existing perfume and assign it to a vault slot</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className={cn('w-8 h-px', i <= currentStepIdx ? 'bg-gold' : 'bg-border')} />}
                <div className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
                  i === currentStepIdx ? 'bg-gold/15 text-gold ring-1 ring-gold/30' :
                    i < currentStepIdx ? 'bg-success/10 text-success' :
                      'bg-muted text-muted-foreground'
                )}>
                  {i < currentStepIdx ? <Check className="w-3 h-3" /> : <span>{s.num}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Select Perfume */}
          {step === 'bottle' && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">
                  Search Perfumes
                </label>
                <div ref={perfumeDropdownRef} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={perfumeSearch} onChange={e => { setPerfumeSearch(e.target.value); setShowPerfumeDropdown(true); }}
                    onFocus={() => {
                      setShowPerfumeDropdown(true);
                      prefetchSuggestions();
                    }}
                    placeholder="Search by perfume name, brand, or Master ID..."
                    className="pl-9 h-14" autoFocus />
                  {showPerfumeDropdown && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {isLoadingResults ? (
                        <div className="text-center py-6">
                          <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Loading perfumes...</p>
                        </div>
                      ) : (
                        <div className="space-y-1 p-1">
                          {filteredPerfumes.map(perfume => (
                            <button key={perfume.id} onClick={() => handleSelectPerfume(perfume)}
                              className={cn('w-full text-left px-4 py-3 rounded-lg text-sm transition-colors hover:bg-muted/50',
                                selectedPerfume?.id === perfume.id && 'bg-gold/10 border border-gold/30')}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{perfume._name}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{perfume.master_id}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                          {filteredPerfumes.length === 0 && (
                            <div className="text-center py-6">
                              <Wine className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">
                                {perfumeSearch.trim() ? 'No perfumes found.' : 'No perfumes available.'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedPerfume && (
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Selected Perfume</p>
                      <p className="text-sm font-bold mt-1">{selectedPerfume._name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{selectedPerfume.master_id}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Step 2: Assign Location */}
          {step === 'location' && (
            <div className="space-y-4">
              {/* Selected perfume summary */}
              {selectedPerfume && (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                      <Wine className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{selectedPerfume._name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{selectedPerfume.master_id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-selected location */}
              {nextAvailableLocation && !locationOverride && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-success font-semibold">Auto-Selected — Next Available</p>
                        <p className="text-lg font-mono font-bold mt-0.5">{nextAvailableLocation.location_code}</p>
                        <p className="text-xs text-muted-foreground">{nextAvailableLocation.vault} · Zone {nextAvailableLocation.zone} · Shelf {nextAvailableLocation.shelf} · Slot {nextAvailableLocation.slot}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs"
                      onClick={() => setLocationOverride(true)}>
                      Override
                    </Button>
                  </div>
                </div>
              )}

              {/* Location type filter */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Location Type</label>
                <div className="flex gap-2">
                  {LOCATION_TYPES.map(t => {
                    const Icon = t.icon;
                    const count = locations.filter(l => !l.occupied && l.type === t.value).length;
                    return (
                      <button key={t.value} onClick={() => {
                        setLocationFilter(t.value);
                        setSelectedLocation(null);
                        setLocationOverride(true);
                      }}
                        className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                          locationFilter === t.value ? `${t.color} border-current` : 'border-border hover:bg-muted/50')}>
                        <Icon className="w-3.5 h-3.5" />
                        {t.label} <span className="font-mono text-muted-foreground">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual location selection */}
              {(locationOverride || !nextAvailableLocation) && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">
                    Select Empty Slot ({emptyLocations.length} available)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2">
                    {emptyLocations.map(loc => (
                      <button key={loc.location_id}
                        onClick={() => setSelectedLocation(loc)}
                        className={cn(
                          'px-3 py-2.5 rounded-lg border text-center transition-all',
                          selectedLocation?.location_id === loc.location_id
                            ? 'bg-gold/10 border-gold text-gold ring-1 ring-gold/30'
                            : 'border-border hover:bg-muted/50'
                        )}>
                        <p className="font-bold text-xs">{loc.location_code}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">S{loc.shelf} · Sl{loc.slot}</p>
                      </button>
                    ))}
                    {emptyLocations.length === 0 && (
                      <div className="col-span-full text-center py-6">
                        <AlertTriangle className="w-6 h-6 text-warning mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">No empty {locationFilter} slots available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedPerfume && (selectedLocation || nextAvailableLocation) && (
            <div className="space-y-4">
              <div className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment Summary</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Perfume</p>
                      <p className="text-sm font-bold mt-1">{selectedPerfume._name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{selectedPerfume.master_id}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assigned Location</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-gold" />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-bold">{(selectedLocation || nextAvailableLocation)!.location_code}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(selectedLocation || nextAvailableLocation)!.vault} · Zone {(selectedLocation || nextAvailableLocation)!.zone} · Shelf {(selectedLocation || nextAvailableLocation)!.shelf} · Slot {(selectedLocation || nextAvailableLocation)!.slot}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gold/5 border border-gold/20 rounded-lg p-3 flex items-start gap-2">
                <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gold">Ready to Assign</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    This will assign the perfume to the selected vault location.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <div>
            {step !== 'bottle' && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => {
                  const prev = steps[currentStepIdx - 1];
                  if (prev) setStep(prev.key);
                }}>
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {step === 'bottle' && (
              <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                disabled={!selectedPerfume}
                onClick={handleGoToLocation}>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
            {step === 'location' && (
              <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                disabled={!selectedLocation && !nextAvailableLocation}
                onClick={() => setStep('confirm')}>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
            {step === 'confirm' && (
              <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                onClick={() => {
                  const loc = selectedLocation || nextAvailableLocation;
                  if (selectedPerfume && loc) {
                    onComplete({
                      perfume: selectedPerfume,
                      locationId: loc.id || loc.location_id,
                      locationCode: loc.location_code,
                    });
                    onClose();
                  }
                }}>
                <Check className="w-3.5 h-3.5" /> Confirm & Assign
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- CSV Export ----
function exportLocationsCsv(locations: VaultLocation[]) {
  const headers = ['Location Code', 'Vault', 'Zone', 'Shelf', 'Slot', 'Type', 'Occupied', 'Master ID', 'Perfume Name'];
  const rows = locations.map(l => [
    l.location_code, l.vault, l.zone, l.shelf, l.slot, l.type,
    l.occupied ? 'Yes' : 'No', l.master_id || '', l.perfume_name || '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `vault-locations-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Locations exported');
}

// ---- Main Page ----
export default function VaultLocationsPage() {
  const queryClient = useQueryClient();
  const { locationsQuery, createLocation, updateLocation, clearLocation, deleteLocation } = useLocations();
  const locations = locationsQuery.data || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVault, setFilterVault] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddBottle, setShowAddBottle] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<VaultLocation | null>(null);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  // Computed
  const filtered = useMemo(() => {
    return locations.filter(l => {
      if (filterVault !== 'all' && l.vault !== filterVault) return false;
      if (filterType !== 'all' && l.type !== filterType) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return l.location_code.toLowerCase().includes(q) ||
          (l.perfume_name || '').toLowerCase().includes(q) ||
          (l.master_id || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [locations, filterVault, filterType, searchTerm]);

  const zones = useMemo(() => groupByZone(filtered), [filtered]);
  const totalSlots = locations.length;
  const occupiedSlots = locations.filter(l => l.occupied).length;
  const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  // Expand all zones by default
  useMemo(() => {
    if (expandedZones.size === 0 && zones.length > 0) {
      setExpandedZones(new Set(zones.map(z => `${z.vault}-${z.zone}`)));
    }
  }, [zones.length]);

  const toggleZone = (key: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const resolveLocationMutationId = useCallback((inputId: string): string | null => {
    const byUuid = locations.find((loc) => loc.id === inputId);
    if (byUuid?.id) {
      return byUuid.id;
    }

    const byBusinessId = locations.find((loc) => loc.location_id === inputId);
    if (byBusinessId?.id) {
      return byBusinessId.id;
    }

    return null;
  }, [locations]);

  // Actions
  const handleAddZone = useCallback((newLocs: VaultLocation[]) => {
    createLocation.mutate(newLocs, {
      onSuccess: () => setShowAddZone(false)
    });
  }, [createLocation]);

  const handleAssignBottle = useCallback((locId: string, masterId: string, perfumeName: string) => {
    const resolvedId = resolveLocationMutationId(locId);
    if (!resolvedId) {
      toast.error('Unable to assign perfume: invalid location ID');
      return;
    }

    updateLocation.mutate({
      id: resolvedId,
      data: { occupied: true, master_id: masterId, perfume_name: perfumeName }
    }, {
      onSuccess: () => {
        setSelectedSlot(null);
      }
    });
  }, [updateLocation, locations, resolveLocationMutationId]);

  const handleClearSlot = useCallback((locId: string) => {
    const resolvedId = resolveLocationMutationId(locId);
    if (!resolvedId) {
      toast.error('Unable to clear slot: invalid location ID');
      return;
    }

    clearLocation.mutate(resolvedId, {
      onSuccess: () => {
        setSelectedSlot(null);
      }
    });
  }, [clearLocation, resolveLocationMutationId]);

  const handleDeleteLocation = useCallback((locId: string) => {
    const resolvedId = resolveLocationMutationId(locId);
    if (!resolvedId) {
      toast.error('Unable to delete slot: invalid location ID');
      return;
    }

    deleteLocation.mutate(resolvedId, {
      onSuccess: () => {
        setSelectedSlot(null);
      }
    });
  }, [deleteLocation, resolveLocationMutationId]);

  const handleAutoAssign = useCallback(() => {
    const nextEmpty = locations.find(l => !l.occupied && l.type === 'sealed');
    if (nextEmpty) {
      setSelectedSlot(nextEmpty);
      toast.info(`Next available slot: ${nextEmpty.location_code}`);
    } else {
      toast.warning('No empty sealed slots available');
    }
  }, [locations]);

  const handleBulkImport = async (data: any[]) => {
    await api.locations.bulkImport(data);
    queryClient.invalidateQueries({ queryKey: ['vaultLocations'] });
  };

  const handleAddBottleComplete = useCallback((data: {
    perfume: SearchablePerfume;
    locationId: string;
    locationCode: string;
  }) => {
    const resolvedId = resolveLocationMutationId(data.locationId);
    if (!resolvedId) {
      toast.error('Unable to assign perfume: invalid location ID');
      return;
    }

    updateLocation.mutate({
      id: resolvedId,
      data: {
        occupied: true,
        master_id: data.perfume.master_id,
        perfume_name: data.perfume._name,
      }
    }, {
      onSuccess: () => {
        setShowAddBottle(false);
      }
    });
  }, [updateLocation, resolveLocationMutationId]);

  // Stats per vault
  const vaultStats = useMemo(() => {
    const stats: Record<string, { total: number; occupied: number }> = {};
    for (const l of locations) {
      if (!stats[l.vault]) stats[l.vault] = { total: 0, occupied: 0 };
      stats[l.vault].total++;
      if (l.occupied) stats[l.vault].occupied++;
    }
    return stats;
  }, [locations]);

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowBulkImport(true)}>
        <Upload className="w-3.5 h-3.5" /> Import CSV
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleAutoAssign}>
        <ArrowRight className="w-3.5 h-3.5" /> Auto-Assign Next
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportLocationsCsv(locations)}>
        <Download className="w-3.5 h-3.5" /> CSV
      </Button>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAddZone(true)}>
        <Plus className="w-3.5 h-3.5" /> Add Zone
      </Button>
      <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => setShowAddBottle(true)}>
        <MapPin className="w-3.5 h-3.5" /> Assign Perfume
      </Button>
    </div>
  );

  if (locationsQuery.isLoading) {
    return (
      <div>
        <PageHeader
          title="Vault Locations"
          subtitle="Loading vault locations..."
          breadcrumbs={[{ label: 'Master Data' }, { label: 'Vault Locations' }]}
          actions={headerActions}
        />
        <div className="p-6">
          <SectionCard title="">
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Fetching vault locations...</p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  if (locationsQuery.isError) {
    const message = locationsQuery.error instanceof Error
      ? locationsQuery.error.message
      : 'Unable to load vault locations.';

    return (
      <div>
        <PageHeader
          title="Vault Locations"
          subtitle="Could not load vault locations"
          breadcrumbs={[{ label: 'Master Data' }, { label: 'Vault Locations' }]}
          actions={headerActions}
        />
        <div className="p-6">
          <SectionCard title="">
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <p className="text-sm font-medium text-foreground">Vault locations failed to load</p>
              <p className="text-xs text-muted-foreground max-w-md">{message}</p>
              <Button size="sm" variant="outline" onClick={() => locationsQuery.refetch()}>
                Retry
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Vault Locations"
        subtitle={`${totalSlots} slots across ${zones.length} zones — ${occupancyRate}% occupancy`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Vault Locations' }]}
        actions={headerActions}
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(vaultStats).map(([vault, s]) => (
            <div key={vault} className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{vault} Vault</p>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <p className="text-2xl font-mono font-bold">{s.occupied}<span className="text-sm text-muted-foreground font-normal">/{s.total}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-gold">{s.total > 0 ? Math.round((s.occupied / s.total) * 100) : 0}%</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all duration-500"
                  style={{ width: `${s.total > 0 ? (s.occupied / s.total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-2xl font-mono font-bold">{occupiedSlots}<span className="text-sm text-muted-foreground font-normal">/{totalSlots}</span></p>
              <p className="text-sm font-mono font-bold text-gold">{occupancyRate}%</p>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all duration-500"
                style={{ width: `${occupancyRate}%` }} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search location, perfume, master ID..."
              className="pl-9 scan-input" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vault:</span>
            {['all', ...VAULT_NAMES].map(v => (
              <button key={v} onClick={() => setFilterVault(v)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  filterVault === v ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {v === 'all' ? 'All' : v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type:</span>
            {[{ value: 'all', label: 'All' }, ...LOCATION_TYPES.map(t => ({ value: t.value, label: t.label }))].map(t => (
              <button key={t.value} onClick={() => setFilterType(t.value)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  filterType === t.value ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto border border-border rounded-lg p-0.5">
            <button onClick={() => setViewMode('grid')}
              className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:text-foreground')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:text-foreground')}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zone Cards */}
        {viewMode === 'grid' ? (
          <div className="space-y-4">
            {zones.map(zone => {
              const key = `${zone.vault}-${zone.zone}`;
              const isExpanded = expandedZones.has(key);
              const tc = TYPE_COLORS[zone.type];
              const occupancy = zone.total > 0 ? Math.round((zone.occupied / zone.total) * 100) : 0;

              return (
                <div key={key} className={cn('bg-card border rounded-xl overflow-hidden transition-all', tc.border)}>
                  <button onClick={() => toggleZone(key)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', tc.bg)}>
                      <MapPin className={cn('w-5 h-5', tc.text)} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">{zone.vault} — Zone {zone.zone}</h3>
                        <StatusBadge variant={zone.type === 'sealed' ? 'info' : zone.type === 'decant' ? 'gold' : zone.type === 'packaging' ? 'success' : 'muted'}>
                          {zone.type}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {zone.shelves.length} shelves · {zone.total} slots · {zone.occupied} occupied
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-mono font-bold">{occupancy}%</p>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div className={cn('h-full rounded-full transition-all', occupancy > 80 ? 'bg-destructive' : occupancy > 50 ? 'bg-warning' : 'bg-success')}
                            style={{ width: `${occupancy}%` }} />
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4">
                      {zone.shelves.map(shelf => (
                        <div key={shelf.shelf} className="bg-muted/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Grid3X3 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Shelf {shelf.shelf}</span>
                            <span className="text-[10px] text-muted-foreground">
                              ({shelf.slots.filter(s => s.occupied).length}/{shelf.slots.length} occupied)
                            </span>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                            {shelf.slots.map(slot => (
                              <SlotCell key={slot.location_id} loc={slot} onClick={setSelectedSlot} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <SectionCard title="">
            <div className="overflow-x-auto -m-4">
              <table className="w-full ops-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Code</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Vault</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Zone</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Shelf</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Slot</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Type</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                    <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Contents</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <tr key={l.location_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedSlot(l)}>
                      <td className="px-4 py-2 text-sm font-mono font-bold">{l.location_code}</td>
                      <td className="px-4 py-2 text-sm">{l.vault}</td>
                      <td className="px-4 py-2 text-sm font-mono">{l.zone}</td>
                      <td className="px-4 py-2 text-sm font-mono">{l.shelf}</td>
                      <td className="px-4 py-2 text-sm font-mono">{l.slot}</td>
                      <td className="px-4 py-2">
                        <StatusBadge variant={l.type === 'sealed' ? 'info' : l.type === 'decant' ? 'gold' : l.type === 'packaging' ? 'success' : 'muted'}>
                          {l.type}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge variant={l.occupied ? 'warning' : 'muted'}>
                          {l.occupied ? 'Occupied' : 'Empty'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2">
                        {l.occupied ? (
                          <div>
                            <p className="text-sm font-medium">{l.perfume_name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{l.master_id}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {zones.length === 0 && (
          <div className="text-center py-16">
            <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No locations match your filters</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showAddZone && (
        <AddZoneDialog onAdd={handleAddZone} onClose={() => setShowAddZone(false)} existingZones={zones} isCreating={createLocation.isPending} />
      )}
      {selectedSlot && (
        <AssignPerfumeDialog
          location={selectedSlot}
          onAssign={handleAssignBottle}
          onClear={handleClearSlot}
          onDelete={handleDeleteLocation}
          isAssigning={updateLocation.isPending}
          isClearing={clearLocation.isPending}
          isDeleting={deleteLocation.isPending}
          onClose={() => setSelectedSlot(null)}
        />
      )}
      {showAddBottle && (
        <AddBottleToLocationDialog
          locations={locations}
          onComplete={handleAddBottleComplete}
          onClose={() => setShowAddBottle(false)}
        />
      )}

      {showBulkImport && (
        <GenericBulkImport
          title="Import Vault Locations"
          subtitle="Add multiple vault locations in bulk. This will create empty or occupied slots across zones."
          columns={VAULT_IMPORT_COLUMNS}
          onImport={handleBulkImport}
          onClose={() => setShowBulkImport(false)}
          templateFilename="vault-locations-template.csv"
          templateExample={{
            vault: 'Main',
            zone: 'A',
            shelf: '1',
            slot: '01',
            type: 'sealed',
            occupied: 'No',
            master_id: '',
            perfume_name: ''
          }}
          transformRow={(raw) => {
            const vault = raw.vault || 'Main';
            const zone = raw.zone || 'A';
            const shelf = raw.shelf || '1';
            const slot = raw.slot || '01';
            const locationCode = generateLocationCode(vault, zone, shelf, slot);
            
            // Generate a more robust unique ID
            const uniqueId = typeof crypto.randomUUID === 'function' 
              ? crypto.randomUUID() 
              : `loc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            
            return {
              location_id: uniqueId,
              location_code: locationCode,
              vault,
              zone,
              shelf,
              slot,
              position: slot,
              code: locationCode,
              type: raw.type || 'sealed',
              occupied: (raw.occupied || 'No').toLowerCase() === 'yes',
              master_id: raw.master_id || null,
              perfume_name: raw.perfume_name || null
            };
          }}
        />
      )}
    </div>
  );
}
