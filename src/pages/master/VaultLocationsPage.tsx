// ============================================================
// Vault Locations — Full Location Builder
// Design: "Maison Ops" — Luxury Operations
// Zone → Shelf → Slot hierarchy with visual slot grid,
// occupancy tracking, "Add Bottle to Location" flow,
// auto-generated location codes, and Add Zone wizard
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { PageHeader, StatusBadge, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockPerfumes } from '@/lib/mock-data';
import { useLocations, updateLocations } from '@/lib/inventory-store';
import { api } from '@/lib/api-client';
import type { VaultLocation, LocationType, InventoryBottle, DecantBottle } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  MapPin, Plus, Search, ChevronDown, ChevronRight, Grid3X3,
  Package, Droplets, Box, Layers, X, Check, Edit2, Trash2,
  ArrowRight, Download, LayoutGrid, List, AlertTriangle,
  Wine, ChevronLeft, Scan, Hash,
} from 'lucide-react';

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

// ---- Slot Cell Component ----
function SlotCell({ loc, onClick }: { loc: VaultLocation; onClick: (loc: VaultLocation) => void }) {
  const tc = TYPE_COLORS[loc.type];
  return (
    <button
      onClick={() => onClick(loc)}
      className={cn(
        'relative w-full aspect-square rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center gap-0.5 group',
        loc.occupied
          ? `${tc.border} ${tc.bg} shadow-sm hover:shadow-md hover:scale-[1.03]`
          : 'border-dashed border-border/60 hover:border-border hover:bg-muted/30 hover:scale-[1.02]',
      )}
      title={loc.occupied ? `${loc.perfume_name || 'Occupied'} — ${loc.location_code}` : `Empty — ${loc.location_code}`}
    >
      {loc.occupied ? (
        <>
          <div className={cn('w-2.5 h-2.5 rounded-full', tc.dot)} />
          <span className="text-[8px] font-mono font-bold text-foreground/80 leading-none truncate max-w-full px-0.5">
            {loc.slot}
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
function AddZoneDialog({ onAdd, onClose, existingZones }: {
  onAdd: (locs: VaultLocation[]) => void;
  onClose: () => void;
  existingZones: ZoneGroup[];
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
              <Input value={zoneId} onChange={e => setZoneId(e.target.value.toUpperCase())} placeholder="C" className="font-mono" maxLength={3} />
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit}
            disabled={!zoneId.trim()}>
            <Plus className="w-3.5 h-3.5" /> Create Zone
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Assign Bottle Dialog (click on existing slot) ----
function AssignBottleDialog({ location, onAssign, onClear, onClose }: {
  location: VaultLocation;
  onAssign: (locId: string, bottleId: string, masterId: string, perfumeName: string) => void;
  onClear: (locId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [bottles, setBottles] = useState<InventoryBottle[]>([]);
  const [decantBottles, setDecantBottles] = useState<DecantBottle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBottle, setSelectedBottle] = useState<(InventoryBottle | DecantBottle) & { _type: 'sealed' | 'decant' } | null>(null);

  // Load physical bottles from DB
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sealedRes, decantRes] = await Promise.all([
          api.inventory.sealedBottles(),
          api.inventory.decantBottles(),
        ]);
        if (!cancelled) {
          setBottles(sealedRes.data);
          setDecantBottles(decantRes.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Combine all bottles for search
  const allBottles = useMemo(() => {
    const sealed = bottles.map(b => ({ ...b, _type: 'sealed' as const, _name: getPerfumeName(b.master_id), _size: b.size_ml }));
    const decant = decantBottles.map(b => ({ ...b, _type: 'decant' as const, _name: getPerfumeName(b.master_id), _size: b.size_ml }));
    return [...sealed, ...decant];
  }, [bottles, decantBottles]);

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allBottles.filter(b =>
      b.bottle_id.toLowerCase().includes(q) ||
      b.master_id.toLowerCase().includes(q) ||
      b._name.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [allBottles, search]);

  const tc = TYPE_COLORS[location.type];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold">{location.occupied ? 'Slot Details' : 'Assign Bottle'}</h3>
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
                {location.bottle_id && <p className="text-[11px] font-mono text-muted-foreground">Bottle: {location.bottle_id}</p>}
              </div>
              <Button variant="outline" className="w-full gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => { onClear(location.location_id); onClose(); }}>
                <Trash2 className="w-3.5 h-3.5" /> Clear Slot
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Search Physical Bottle</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by bottle ID, perfume name, or Master ID..." className="pl-9" autoFocus />
                </div>
              </div>
              {loading && <p className="text-xs text-muted-foreground text-center py-3">Loading bottles...</p>}
              {search && !loading && (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-1">
                  {filtered.map(b => (
                    <button key={b.bottle_id} onClick={() => { setSelectedBottle(b as any); setSearch(''); }}
                      className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted/50',
                        selectedBottle?.bottle_id === b.bottle_id && 'bg-gold/10 border border-gold/30')}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{b._name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{b.bottle_id}</p>
                        </div>
                        <StatusBadge variant={b._type === 'sealed' ? 'info' : 'gold'}>{b._type} · {b._size}ml</StatusBadge>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No bottles found</p>}
                </div>
              )}
              {selectedBottle && (
                <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Selected Bottle</p>
                  <p className="text-sm font-bold mt-1">{getPerfumeName(selectedBottle.master_id)}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {selectedBottle.bottle_id} · {selectedBottle._type} · {('size_ml' in selectedBottle ? selectedBottle.size_ml : 0)}ml
                  </p>
                </div>
              )}
              {!search && !selectedBottle && !loading && (
                <div className="text-center py-6">
                  <Scan className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Search for a physical bottle registered in Station 0</p>
                </div>
              )}
            </div>
          )}
        </div>
        {!location.occupied && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              disabled={!selectedBottle}
              onClick={() => {
                if (selectedBottle) {
                  onAssign(location.location_id, selectedBottle.bottle_id, selectedBottle.master_id, getPerfumeName(selectedBottle.master_id));
                  onClose();
                }
              }}>
              <Check className="w-3.5 h-3.5" /> Assign
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Add Bottle to Vault Location — 2-Step Dialog ----
// Step 1: Select an existing physical bottle (from Station 0 register)
// Step 2: Assign a vault location
type AddBottleStep = 'bottle' | 'location' | 'confirm';

function AddBottleToLocationDialog({
  locations,
  onComplete,
  onClose,
}: {
  locations: VaultLocation[];
  onComplete: (data: {
    bottle: InventoryBottle | DecantBottle;
    bottleType: 'sealed' | 'decant';
    locationId: string;
    locationCode: string;
  }) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<AddBottleStep>('bottle');

  // Bottle data from DB
  const [sealedBottles, setSealedBottles] = useState<InventoryBottle[]>([]);
  const [decantBottlesList, setDecantBottlesList] = useState<DecantBottle[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1: Bottle selection
  const [bottleSearch, setBottleSearch] = useState('');
  const [selectedBottle, setSelectedBottle] = useState<(InventoryBottle | DecantBottle) & { _type: 'sealed' | 'decant'; _name: string } | null>(null);

  // Step 2: Location selection
  const [locationFilter, setLocationFilter] = useState<LocationType>('sealed');
  const [selectedLocation, setSelectedLocation] = useState<VaultLocation | null>(null);
  const [locationOverride, setLocationOverride] = useState(false);

  // Load bottles from DB
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sealedRes, decantRes] = await Promise.all([
          api.inventory.sealedBottles(),
          api.inventory.decantBottles(),
        ]);
        if (!cancelled) {
          setSealedBottles(sealedRes.data);
          setDecantBottlesList(decantRes.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Combine all bottles for search
  const allBottles = useMemo(() => {
    const sealed = sealedBottles.map(b => ({
      ...b,
      _type: 'sealed' as const,
      _name: getPerfumeName(b.master_id),
    }));
    const decant = decantBottlesList.map(b => ({
      ...b,
      _type: 'decant' as const,
      _name: getPerfumeName(b.master_id),
    }));
    return [...sealed, ...decant];
  }, [sealedBottles, decantBottlesList]);

  const filteredBottles = useMemo(() => {
    if (!bottleSearch) return allBottles.slice(0, 20);
    const q = bottleSearch.toLowerCase();
    return allBottles.filter(b =>
      b.bottle_id.toLowerCase().includes(q) ||
      b.master_id.toLowerCase().includes(q) ||
      b._name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allBottles, bottleSearch]);

  // Auto-select next available location
  const nextAvailableLocation = useMemo(() => {
    return locations.find(l => !l.occupied && l.type === locationFilter);
  }, [locations, locationFilter]);

  // Available empty locations
  const emptyLocations = useMemo(() => {
    return locations.filter(l => !l.occupied && l.type === locationFilter);
  }, [locations, locationFilter]);

  // When bottle is selected, auto-set location type
  const handleSelectBottle = (b: typeof allBottles[0]) => {
    setSelectedBottle(b);
    setBottleSearch('');
    // Auto-set location type based on bottle type
    if (b._type === 'sealed') setLocationFilter('sealed');
    else setLocationFilter('decant');
  };

  const handleGoToLocation = () => {
    if (nextAvailableLocation && !selectedLocation) {
      setSelectedLocation(nextAvailableLocation);
    }
    setStep('location');
  };

  const steps: { key: AddBottleStep; label: string; num: number }[] = [
    { key: 'bottle', label: 'Select Bottle', num: 1 },
    { key: 'location', label: 'Assign Location', num: 2 },
    { key: 'confirm', label: 'Confirm', num: 3 },
  ];
  const currentStepIdx = steps.findIndex(s => s.key === step);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold">Add Bottle to Vault Location</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Select an existing bottle and assign it to a vault slot</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Bottle */}
          {step === 'bottle' && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">
                  Search Physical Bottles (registered in Station 0)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={bottleSearch} onChange={e => setBottleSearch(e.target.value)}
                    placeholder="Search by bottle ID, perfume name, or Master ID..."
                    className="pl-9 h-11" autoFocus />
                </div>
              </div>

              {selectedBottle && (
                <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Selected Bottle</p>
                      <p className="text-sm font-bold mt-1">{selectedBottle._name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{selectedBottle.bottle_id}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge variant={selectedBottle._type === 'sealed' ? 'info' : 'gold'}>
                        {selectedBottle._type}
                      </StatusBadge>
                      <p className="text-sm font-mono font-bold text-gold mt-1">{selectedBottle.size_ml}ml</p>
                    </div>
                  </div>
                  {/* Show bottle details as confirmation */}
                  {'purchase_price' in selectedBottle && (
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gold/10">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Size</p>
                        <p className="text-xs font-mono font-bold">{selectedBottle.size_ml}ml</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Purchase Price</p>
                        <p className="text-xs font-mono font-bold">AED {(selectedBottle as InventoryBottle).purchase_price}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Status</p>
                        <p className="text-xs font-mono font-bold">{(selectedBottle as InventoryBottle).status}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading bottles from inventory...</p>
                </div>
              ) : (
                <div className="space-y-1 border border-border rounded-lg p-1 max-h-64 overflow-y-auto">
                  {filteredBottles.map(b => (
                    <button key={b.bottle_id} onClick={() => handleSelectBottle(b)}
                      className={cn('w-full text-left px-4 py-3 rounded-lg text-sm transition-colors hover:bg-muted/50',
                        selectedBottle?.bottle_id === b.bottle_id && 'bg-gold/10 border border-gold/30')}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{b._name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{b.bottle_id}</p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <StatusBadge variant={b._type === 'sealed' ? 'info' : 'gold'}>{b._type}</StatusBadge>
                          <span className="text-xs font-mono text-muted-foreground">{b.size_ml}ml</span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredBottles.length === 0 && (
                    <div className="text-center py-6">
                      <Wine className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No bottles found. Register bottles in Station 0 first.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Assign Location */}
          {step === 'location' && (
            <div className="space-y-4">
              {/* Selected bottle summary */}
              {selectedBottle && (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                      <Wine className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{selectedBottle._name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{selectedBottle.bottle_id} · {selectedBottle._type} · {selectedBottle.size_ml}ml</p>
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
          {step === 'confirm' && selectedBottle && (selectedLocation || nextAvailableLocation) && (
            <div className="space-y-4">
              <div className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment Summary</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Perfume</p>
                      <p className="text-sm font-bold mt-1">{selectedBottle._name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{selectedBottle.master_id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bottle ID</p>
                      <p className="text-sm font-mono font-bold mt-1">{selectedBottle.bottle_id}</p>
                      <StatusBadge variant={selectedBottle._type === 'sealed' ? 'info' : 'gold'}>
                        {selectedBottle._type} · {selectedBottle.size_ml}ml
                      </StatusBadge>
                    </div>
                  </div>
                  {'purchase_price' in selectedBottle && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Purchase Price</p>
                        <p className="text-sm font-mono font-bold mt-1">AED {(selectedBottle as InventoryBottle).purchase_price}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                        <p className="text-sm font-bold mt-1">{(selectedBottle as InventoryBottle).status}</p>
                      </div>
                    </div>
                  )}
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
                    This will assign the existing bottle to the selected vault location and update the location code on the bottle record.
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
                disabled={!selectedBottle}
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
                  if (selectedBottle && loc) {
                    onComplete({
                      bottle: selectedBottle,
                      bottleType: selectedBottle._type,
                      locationId: loc.location_id,
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
  const headers = ['Location Code', 'Vault', 'Zone', 'Shelf', 'Slot', 'Type', 'Occupied', 'Bottle ID', 'Master ID', 'Perfume Name'];
  const rows = locations.map(l => [
    l.location_code, l.vault, l.zone, l.shelf, l.slot, l.type,
    l.occupied ? 'Yes' : 'No', l.bottle_id || '', l.master_id || '', l.perfume_name || '',
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
  const storeLocations = useLocations();
  const [locations, setLocations] = useState<VaultLocation[]>([...storeLocations]);
  const syncToStore = useCallback((locs: VaultLocation[]) => {
    setLocations(locs);
    updateLocations(locs);
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVault, setFilterVault] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddBottle, setShowAddBottle] = useState(false);
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
          (l.master_id || '').toLowerCase().includes(q) ||
          (l.bottle_id || '').toLowerCase().includes(q);
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

  // Actions
  const handleAddZone = useCallback((newLocs: VaultLocation[]) => {
    setLocations(prev => {
      const updated = [...prev, ...newLocs];
      updateLocations(updated);
      return updated;
    });
  }, []);

  const handleAssignBottle = useCallback((locId: string, bottleId: string, masterId: string, perfumeName: string) => {
    setLocations(prev => {
      const updated = prev.map(l =>
        l.location_id === locId ? { ...l, occupied: true, bottle_id: bottleId, master_id: masterId, perfume_name: perfumeName } : l
      );
      updateLocations(updated);
      return updated;
    });
    // Also update the bottle's location_code in the DB
    api.mutations.bottles.update(bottleId, { locationCode: locations.find(l => l.location_id === locId)?.location_code || '' }).catch(() => {});
    toast.success(`Bottle ${bottleId} assigned to location`);
  }, [locations]);

  const handleClearSlot = useCallback((locId: string) => {
    setLocations(prev => {
      const updated = prev.map(l =>
        l.location_id === locId ? { ...l, occupied: false, bottle_id: undefined, master_id: undefined, perfume_name: undefined } : l
      );
      updateLocations(updated);
      return updated;
    });
    toast.success('Slot cleared');
  }, []);

  const handleAutoAssign = useCallback(() => {
    const nextEmpty = locations.find(l => !l.occupied && l.type === 'sealed');
    if (nextEmpty) {
      setSelectedSlot(nextEmpty);
      toast.info(`Next available slot: ${nextEmpty.location_code}`);
    } else {
      toast.warning('No empty sealed slots available');
    }
  }, [locations]);

  const handleAddBottleComplete = useCallback((data: {
    bottle: InventoryBottle | DecantBottle;
    bottleType: 'sealed' | 'decant';
    locationId: string;
    locationCode: string;
  }) => {
    // Update local location state
    setLocations(prev => prev.map(l =>
      l.location_id === data.locationId
        ? {
            ...l,
            occupied: true,
            bottle_id: data.bottle.bottle_id,
            master_id: data.bottle.master_id,
            perfume_name: getPerfumeName(data.bottle.master_id),
          }
        : l
    ));
    // Update the bottle's location_code in the DB
    api.mutations.bottles.update(data.bottle.bottle_id, { locationCode: data.locationCode }).catch(() => {});
    toast.success(
      `Bottle ${data.bottle.bottle_id} assigned to ${data.locationCode}`,
      { description: `${getPerfumeName(data.bottle.master_id)} · ${data.bottle.size_ml}ml` }
    );
  }, []);

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

  return (
    <div>
      <PageHeader
        title="Vault Locations"
        subtitle={`${totalSlots} slots across ${zones.length} zones — ${occupancyRate}% occupancy`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Vault Locations' }]}
        actions={
          <div className="flex items-center gap-2">
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
              <MapPin className="w-3.5 h-3.5" /> Assign Bottle
            </Button>
          </div>
        }
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
              placeholder="Search location, perfume, bottle ID..."
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
                            <p className="text-[10px] font-mono text-muted-foreground">{l.bottle_id}</p>
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
        <AddZoneDialog onAdd={handleAddZone} onClose={() => setShowAddZone(false)} existingZones={zones} />
      )}
      {selectedSlot && (
        <AssignBottleDialog
          location={selectedSlot}
          onAssign={handleAssignBottle}
          onClear={handleClearSlot}
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
    </div>
  );
}
