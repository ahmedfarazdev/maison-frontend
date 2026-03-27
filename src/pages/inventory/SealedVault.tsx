// ============================================================
// Perfume Inventory — Bottle Inventory & Vial Inventory
// Design: "Maison Ops" — Luxury Operations
// Shows all inventory bottles with type filters, QR labels,
// status management, and volume tracking for open/tester bottles
// Now powered by DB-backed API (not mock inventory-store)
// Includes toggle between Bottle Inventory and Vial Inventory
// Vial Inventory includes Scan Return feature
// ============================================================

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { mockPerfumes } from '@/lib/mock-data';
import { BottleQRBadge } from '@/components/inventory/BottleQRLabel';
import type { InventoryBottle, BottleType, BottleStatus } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Package, Search, Download, Lock, Unlock, FlaskConical,
  MapPin, DollarSign, Droplets, ShieldCheck, ScanBarcode, Trash2, ArrowRightLeft, Loader2,
  RotateCcw, AlertTriangle, CheckCircle2, XCircle, Clock, FileText, User, Zap,
  ChevronRight, CornerDownLeft, History, Printer, Copy, Check, X,
} from 'lucide-react';
import BarcodeScannerDialog from '@/components/scanner/BarcodeScannerDialog';
import BottleDetailDrawer from '@/components/scanner/BottleDetailDrawer';
import DeleteConfirmDialog from '@/components/shared/DeleteConfirmDialog';

const TYPE_CONFIG: Record<BottleType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  sealed: { label: 'Sealed', icon: Lock, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
  open: { label: 'Open', icon: Unlock, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  tester: { label: 'Tester', icon: FlaskConical, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
};

const STATUS_CONFIG: Record<BottleStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'muted' | 'gold' | 'destructive' }> = {
  available: { label: 'Available', variant: 'success' },
  reserved: { label: 'Reserved', variant: 'warning' },
  allocated: { label: 'Allocated', variant: 'info' },
  sold: { label: 'Sold', variant: 'muted' },
  in_decanting: { label: 'In Decanting', variant: 'gold' },
};

function exportBottlesCsv(bottles: InventoryBottle[]) {
  const headers = ['Bottle ID', 'Master ID', 'Type', 'Size (ml)', 'Current (ml)', 'Status', 'Location', 'Supplier', 'Purchase Price', 'Purchase Date', 'Barcode'];
  const rows = bottles.map(b => [
    b.bottle_id, b.master_id, b.bottle_type, String(b.size_ml),
    b.current_ml !== undefined ? String(b.current_ml) : String(b.size_ml),
    b.status, b.location_code, b.supplier_id, String(b.purchase_price),
    b.purchase_date, b.barcode || '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bottle-inventory-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Inventory exported');
}

type InventoryView = 'bottles' | 'vials';

export default function SealedVault() {
  const [inventoryView, setInventoryView] = useState<InventoryView>('bottles');
  const [bottles, setBottles] = useState<InventoryBottle[]>([]);
  const [suppliers, setSuppliers] = useState<{ supplier_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [bottlesRes, suppliersRes] = await Promise.all([
        api.inventory.sealedBottles(),
        api.master.suppliers(),
      ]);
      setBottles(bottlesRes.data);
      setSuppliers(suppliersRes.data.map((s: any) => ({ supplier_id: s.supplier_id, name: s.name })));
    } catch (err) {
      console.error('Failed to load inventory data', err);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'id' | 'size' | 'price'>('date');
  const [showScanner, setShowScanner] = useState(false);
  const [showBottleDetail, setShowBottleDetail] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryBottle | null>(null);
  const [convertTarget, setConvertTarget] = useState<InventoryBottle | null>(null);

  const handleScanResult = useCallback((code: string) => {
    setScannedCode(code);
    setShowScanner(false);
    let bottleId: string | null = null;
    try { const parsed = JSON.parse(code); if (parsed.id) bottleId = parsed.id; } catch { if (code.startsWith('BTL-')) bottleId = code; }
    setSelectedBottleId(bottleId);
    setShowBottleDetail(true);
  }, []);

  const handleBottleClick = useCallback((bottleId: string) => {
    setScannedCode(bottleId);
    setSelectedBottleId(bottleId);
    setShowBottleDetail(true);
  }, []);

  // Resolve perfume names
  const perfumeMap = useMemo(() => {
    const map: Record<string, { name: string; brand: string }> = {};
    mockPerfumes.forEach(p => { map[p.master_id] = { name: p.name, brand: p.brand }; });
    return map;
  }, []);

  const supplierMap = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach(s => { map[s.supplier_id] = s.name; });
    return map;
  }, [suppliers]);

  const filtered = useMemo(() => {
    let result = bottles.filter((b: InventoryBottle) => {
      if (filterType !== 'all' && b.bottle_type !== filterType) return false;
      if (filterStatus !== 'all' && b.status !== filterStatus) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const perfume = perfumeMap[b.master_id];
        return b.bottle_id.toLowerCase().includes(q) ||
          b.master_id.toLowerCase().includes(q) ||
          (perfume?.name || '').toLowerCase().includes(q) ||
          (perfume?.brand || '').toLowerCase().includes(q) ||
          b.location_code.toLowerCase().includes(q) ||
          (b.barcode || '').toLowerCase().includes(q);
      }
      return true;
    });
    result.sort((a: InventoryBottle, b: InventoryBottle) => {
      if (sortBy === 'date') return b.created_at.localeCompare(a.created_at);
      if (sortBy === 'id') return a.bottle_id.localeCompare(b.bottle_id);
      if (sortBy === 'size') return b.size_ml - a.size_ml;
      return b.purchase_price - a.purchase_price;
    });
    return result;
  }, [bottles, filterType, filterStatus, searchTerm, sortBy, perfumeMap]);

  // Stats
  const sealedCount = bottles.filter((b: InventoryBottle) => b.bottle_type === 'sealed').length;
  const openCount = bottles.filter((b: InventoryBottle) => b.bottle_type === 'open').length;
  const testerCount = bottles.filter((b: InventoryBottle) => b.bottle_type === 'tester').length;
  const totalValue = bottles.reduce((s: number, b: InventoryBottle) => s + b.purchase_price, 0);
  const availableCount = bottles.filter((b: InventoryBottle) => b.status === 'available').length;
  const totalVolumeMl = bottles.reduce((s: number, b: InventoryBottle) => s + (b.current_ml ?? b.size_ml), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Perfume Inventory"
        subtitle={inventoryView === 'bottles'
          ? `${bottles.length} bottles · ${sealedCount} sealed · ${openCount} open · ${testerCount} tester · AED ${totalValue.toLocaleString()} total value`
          : 'Vial inventory with serial codes, QR/barcode generation, and decant tracking'
        }
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Perfume Inventory' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowScanner(true)}>
              <ScanBarcode className="w-3.5 h-3.5" /> Scan
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportBottlesCsv(filtered)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
          <button
            onClick={() => setInventoryView('bottles')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-all',
              inventoryView === 'bottles'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Package className="w-4 h-4 inline mr-1.5" />
            Bottle Inventory
          </button>
          <button
            onClick={() => setInventoryView('vials')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition-all',
              inventoryView === 'vials'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Droplets className="w-4 h-4 inline mr-1.5" />
            Vial Inventory
          </button>
        </div>

        {inventoryView === 'vials' ? (
          <VialInventory />
        ) : (
        <>
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-emerald-500">
            <div className="flex items-center gap-1.5 mb-1">
              <Lock className="w-3 h-3 text-emerald-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Sealed</p>
            </div>
            <p className="text-xl font-mono font-bold">{sealedCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-blue-500">
            <div className="flex items-center gap-1.5 mb-1">
              <Unlock className="w-3 h-3 text-blue-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Open</p>
            </div>
            <p className="text-xl font-mono font-bold">{openCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-amber-500">
            <div className="flex items-center gap-1.5 mb-1">
              <FlaskConical className="w-3 h-3 text-amber-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Tester</p>
            </div>
            <p className="text-xl font-mono font-bold">{testerCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-cyan-500">
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3 h-3 text-cyan-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Available</p>
            </div>
            <p className="text-xl font-mono font-bold">{availableCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-gold">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-gold" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total Value</p>
            </div>
            <p className="text-xl font-mono font-bold">AED {totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-purple-500">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3 h-3 text-purple-500" />
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total Volume</p>
            </div>
            <p className="text-xl font-mono font-bold">{totalVolumeMl.toLocaleString()}ml</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by bottle ID, perfume, brand, barcode..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'sealed', label: 'Sealed' },
              { value: 'open', label: 'Open' },
              { value: 'tester', label: 'Tester' },
            ].map(t => (
              <button key={t.value} onClick={() => setFilterType(t.value)}
                className={cn('px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                  filterType === t.value ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status:</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-background border border-input rounded-md px-2 py-1.5 text-xs">
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="allocated">Allocated</option>
              <option value="in_decanting">In Decanting</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="ml-auto bg-background border border-input rounded-md px-3 py-1.5 text-xs">
            <option value="date">Sort: Newest</option>
            <option value="id">Sort: Bottle ID</option>
            <option value="size">Sort: Size</option>
            <option value="price">Sort: Price</option>
          </select>
        </div>

        {/* Inventory Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/10 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Bottle</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Perfume</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Type</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Size</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Volume</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Status</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Location</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Supplier</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Price</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">QR</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b: InventoryBottle) => {
                  const perfume = perfumeMap[b.master_id];
                  const typeCfg = TYPE_CONFIG[b.bottle_type] || TYPE_CONFIG.sealed;
                  const statusCfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.available;
                  const TypeIcon = typeCfg.icon;
                  const currentMl = b.current_ml ?? b.size_ml;
                  const fillPct = b.size_ml > 0 ? (currentMl / b.size_ml) * 100 : 100;

                  return (
                    <tr key={b.bottle_id} className="border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => handleBottleClick(b.bottle_id)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono font-bold">{b.bottle_id}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">{b.master_id}</p>
                      </td>
                      <td className="px-3 py-3">
                        {perfume ? (
                          <div>
                            <p className="text-sm font-medium">{perfume.name}</p>
                            <p className="text-[10px] text-muted-foreground">{perfume.brand}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{b.master_id}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border', typeCfg.bgColor)}>
                          <TypeIcon className={cn('w-3 h-3', typeCfg.color)} />
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-sm font-mono">{b.size_ml}ml</td>
                      <td className="px-3 py-3 text-center">
                        {b.bottle_type !== 'sealed' ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-mono font-bold">{currentMl}ml</span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all',
                                fillPct > 50 ? 'bg-emerald-500' : fillPct > 25 ? 'bg-amber-500' : 'bg-red-500'
                              )} style={{ width: `${fillPct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm font-mono text-muted-foreground">Full</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge variant={statusCfg.variant}>{statusCfg.label}</StatusBadge>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                          {b.location_code || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-muted-foreground">{supplierMap[b.supplier_id] || b.supplier_id || '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-mono font-bold text-gold">
                        {b.purchase_price.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <BottleQRBadge bottle={b} size={24} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {b.bottle_type === 'sealed' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConvertTarget(b); }}
                              className="p-1 rounded hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors"
                              title="Convert to decanting (open bottle)"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete bottle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-16">
                      <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No bottles match your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{filtered.length} of {bottles.length} bottles</span>
            <span className="text-xs text-muted-foreground">
              {filtered.filter((b: InventoryBottle) => b.bottle_type === 'sealed').length} sealed ·{' '}
              {filtered.filter((b: InventoryBottle) => b.bottle_type === 'open').length} open ·{' '}
              {filtered.filter((b: InventoryBottle) => b.bottle_type === 'tester').length} tester
            </span>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Scanner Dialog */}
      <BarcodeScannerDialog
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScanResult}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Bottle"
        description={deleteTarget ? `Are you sure you want to delete bottle "${deleteTarget.bottle_id}" (${perfumeMap[deleteTarget.master_id]?.name || deleteTarget.master_id})? This action cannot be undone.` : ''}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await api.mutations.bottles.delete(deleteTarget.bottle_id);
            toast.success(`Deleted bottle ${deleteTarget.bottle_id}`);
            loadData();
          } catch (err: any) {
            toast.error(`Failed to delete: ${err.message}`);
            throw err;
          }
        }}
      />

      {/* Convert Sealed to Decanting Confirmation */}
      {convertTarget && (
        <DeleteConfirmDialog
          open={!!convertTarget}
          onOpenChange={(open) => { if (!open) setConvertTarget(null); }}
          title="Convert to Decanting"
          description={`Open sealed bottle "${convertTarget.bottle_id}" (${perfumeMap[convertTarget.master_id]?.name || convertTarget.master_id}, ${convertTarget.size_ml}ml) and move it to the decanting pool? This will change the bottle type from sealed to open.`}
          onConfirm={async () => {
            if (!convertTarget) return;
            try {
              await api.mutations.bottles.update(convertTarget.bottle_id, {
                bottleType: 'open',
                status: 'in_decanting',
                currentMl: convertTarget.size_ml,
              });
              // Log ledger event
              await api.mutations.ledger.createBottleEvent({
                eventId: `EVT-${Date.now()}`,
                bottleId: convertTarget.bottle_id,
                type: 'opened_for_decanting',
                qtyMl: String(convertTarget.size_ml),
                reason: 'Sealed bottle opened and moved to decanting pool',
              });
              toast.success(`Bottle ${convertTarget.bottle_id} opened and moved to decanting pool (${convertTarget.size_ml}ml)`);
              loadData();
            } catch (err: any) {
              toast.error(`Failed to convert: ${err.message}`);
              throw err;
            }
          }}
        />
      )}

      {/* Bottle Detail Drawer */}
      <BottleDetailDrawer
        open={showBottleDetail}
        onClose={() => { setShowBottleDetail(false); setScannedCode(null); setSelectedBottleId(null); }}
        bottleId={selectedBottleId}
        scannedCode={scannedCode}
      />
    </div>
  );
}

// ============================================================
// VIAL BARCODE BADGE — Clickable barcode with popup label
// ============================================================
function VialBarcodeBadge({ vial }: { vial: Vial }) {
  const [showLabel, setShowLabel] = useState(false);
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowLabel(true); }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors border border-border/50 group cursor-pointer"
        title="View barcode label"
      >
        <ScanBarcode className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">{vial.barcode}</span>
      </button>
      {showLabel && <VialLabelDialog vial={vial} onClose={() => setShowLabel(false)} />}
    </>
  );
}

// ---- Barcode visual (Code128-style rendered as SVG bars) ----
function VialBarcodeVisual({ value, width = 200, height = 40 }: { value: string; width?: number; height?: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const barWidth = width / (value.length * 11 + 35);
  for (let i = 0; i < 6; i++) {
    bars.push({ x: x, w: barWidth * (i % 2 === 0 ? 1 : 1) });
    x += barWidth * (i % 2 === 0 ? 1 : 1.5);
  }
  for (let c = 0; c < value.length; c++) {
    const code = value.charCodeAt(c);
    for (let b = 0; b < 8; b++) {
      const bit = (code >> (7 - b)) & 1;
      if (bit) bars.push({ x, w: barWidth });
      x += barWidth * 1.2;
    }
    x += barWidth * 0.5;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-foreground">
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={0} width={bar.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}

// ---- Vial Label Dialog (print-ready popup) ----
function VialLabelDialog({ vial, onClose }: { vial: Vial; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopySerial = () => {
    navigator.clipboard.writeText(vial.serial_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Serial code copied');
  };

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(vial.barcode);
    toast.success('Barcode copied');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Pop-up blocked'); return; }
    const labelHtml = `
      <!DOCTYPE html>
      <html><head>
        <title>Vial Label — ${vial.serial_code}</title>
        <style>
          @page { size: 50mm 30mm; margin: 1mm; }
          body { font-family: 'Courier New', monospace; margin: 0; padding: 2mm; display: flex; flex-direction: column; align-items: center; }
          .label { border: 1px solid #333; padding: 2mm; width: 46mm; }
          .header { text-align: center; font-size: 6pt; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 1mm; margin-bottom: 1mm; letter-spacing: 0.5px; }
          .serial { text-align: center; font-size: 8pt; font-weight: bold; margin: 1mm 0; letter-spacing: 0.5px; }
          .perfume { text-align: center; font-size: 6pt; margin: 0.5mm 0; }
          .field { font-size: 6pt; margin: 0.5mm 0; display: flex; justify-content: space-between; }
          .field-label { font-weight: bold; }
          .barcode-text { text-align: center; font-size: 7pt; letter-spacing: 1.5px; margin-top: 1mm; }
          .size-badge { display: inline-block; padding: 0.3mm 1.5mm; border: 1px solid #333; font-size: 6pt; font-weight: bold; }
        </style>
      </head><body onload="window.print()">
        <div class="label">
          <div class="header">MAISON EM — AURA KEY</div>
          <div class="serial">${vial.serial_code}</div>
          <div class="perfume">${vial.perfume_name}</div>
          <div class="field"><span class="field-label">Size:</span><span class="size-badge">${vial.size_ml}ml</span></div>
          <div class="field"><span class="field-label">Batch:</span><span>${vial.batch_id}</span></div>
          <div class="field"><span class="field-label">Date:</span><span>${vial.decant_date}</span></div>
          <div class="barcode-text">${vial.barcode}</div>
        </div>
      </body></html>
    `;
    printWindow.document.write(labelHtml);
    printWindow.document.close();
  };

  const handlePrintBarcode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Pop-up blocked'); return; }
    // Compact barcode-only strip sized for sticking on small vials
    // Uses CSS barcode rendering (lines) for a scannable visual
    const barcodeDigits = vial.barcode.split('');
    const barsHtml = barcodeDigits.map((d: string, i: number) => {
      const w = parseInt(d) % 2 === 0 ? '0.4mm' : '0.7mm';
      const bg = i % 2 === 0 ? '#000' : '#fff';
      return `<span style="display:inline-block;width:${w};height:8mm;background:${bg}"></span>`;
    }).join('');
    const barcodeHtml = `
      <!DOCTYPE html>
      <html><head>
        <title>Barcode — ${vial.barcode}</title>
        <style>
          @page { size: 30mm 15mm; margin: 0.5mm; }
          body { font-family: 'Courier New', monospace; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
          .strip { text-align: center; padding: 1mm; }
          .bars { display: flex; align-items: center; justify-content: center; margin-bottom: 0.5mm; }
          .code { font-size: 7pt; letter-spacing: 1.2px; font-weight: bold; }
        </style>
      </head><body onload="window.print()">
        <div class="strip">
          <div class="bars">${barsHtml}</div>
          <div class="code">${vial.barcode}</div>
        </div>
      </body></html>
    `;
    printWindow.document.write(barcodeHtml);
    printWindow.document.close();
  };

  const statusColors: Record<string, string> = {
    filled: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    sealed: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
    labeled: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800',
    allocated: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
    shipped: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    returned: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ScanBarcode className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">Vial Label</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Label Preview */}
        <div className="p-5">
          <div className="bg-white dark:bg-zinc-900 border-2 border-dashed border-border rounded-xl p-5 space-y-4">
            {/* Header */}
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Maison EM — Aura Key</p>
            </div>

            {/* Serial Code */}
            <div className="text-center">
              <button onClick={handleCopySerial} className="inline-flex items-center gap-1.5 group">
                <span className="text-lg font-mono font-bold tracking-wide">{vial.serial_code}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />}
              </button>
            </div>

            {/* Perfume Name */}
            <div className="text-center">
              <p className="text-sm font-medium">{vial.perfume_name}</p>
              <p className="text-[10px] font-mono text-muted-foreground">{vial.master_id}</p>
            </div>

            {/* Details */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</span>
                <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded border', statusColors[vial.status] || statusColors.filled)}>
                  {vial.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Size</span>
                <span className="text-xs font-mono font-bold">{vial.size_ml}ml</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Batch</span>
                <span className="text-xs font-mono font-bold">{vial.batch_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Decant Date</span>
                <span className="text-xs font-mono font-bold">{vial.decant_date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Source</span>
                <span className="text-xs font-mono font-bold">{vial.source_bottle_id}</span>
              </div>
            </div>

            {/* Barcode */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex justify-center">
                <VialBarcodeVisual value={vial.barcode} width={240} height={35} />
              </div>
              <p className="text-center text-[10px] font-mono tracking-[0.15em] text-muted-foreground mt-1">{vial.barcode}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" /> Print Label
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handlePrintBarcode}>
              <ScanBarcode className="w-3.5 h-3.5" /> Print Barcode
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleCopySerial}>
              <Copy className="w-3.5 h-3.5" /> Copy Serial
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleCopyBarcode}>
              <Copy className="w-3.5 h-3.5" /> Copy Barcode
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VIAL INVENTORY — Serial codes, QR/barcode, decant tracking
// with Scan Return feature
// ============================================================
interface Vial {
  vial_id: string;
  serial_code: string;
  barcode: string;
  perfume_name: string;
  master_id: string;
  size_ml: number;
  fill_level_ml: number;
  source_bottle_id: string;
  decant_date: string;
  batch_id: string;
  status: 'filled' | 'sealed' | 'labeled' | 'allocated' | 'shipped' | 'returned';
  destination: string;
  qc_passed: boolean;
  operator: string;
  return_reason?: ReturnReason;
  return_condition?: ReturnCondition;
  return_notes?: string;
  return_date?: string;
  return_operator?: string;
}

type ReturnReason = 'customer_return' | 'qc_fail' | 'damaged' | 'expired' | 'recall' | 'other';
type ReturnCondition = 'good' | 'damaged' | 'leaked' | 'contaminated' | 'empty';

const RETURN_REASON_CONFIG: Record<ReturnReason, { label: string; icon: React.ElementType; color: string }> = {
  customer_return: { label: 'Customer Return', icon: RotateCcw, color: 'text-blue-500' },
  qc_fail: { label: 'QC Failure', icon: XCircle, color: 'text-red-500' },
  damaged: { label: 'Damaged', icon: AlertTriangle, color: 'text-amber-500' },
  expired: { label: 'Expired', icon: Clock, color: 'text-orange-500' },
  recall: { label: 'Product Recall', icon: AlertTriangle, color: 'text-red-600' },
  other: { label: 'Other', icon: FileText, color: 'text-muted-foreground' },
};

const RETURN_CONDITION_CONFIG: Record<ReturnCondition, { label: string; color: string; bgColor: string }> = {
  good: { label: 'Good (Re-sellable)', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  damaged: { label: 'Damaged', color: 'text-red-600', bgColor: 'bg-red-500/10 border-red-500/20' },
  leaked: { label: 'Leaked', color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/20' },
  contaminated: { label: 'Contaminated', color: 'text-purple-600', bgColor: 'bg-purple-500/10 border-purple-500/20' },
  empty: { label: 'Empty', color: 'text-muted-foreground', bgColor: 'bg-muted border-border' },
};

interface VialReturnLog {
  id: string;
  vial_id: string;
  serial_code: string;
  perfume_name: string;
  reason: ReturnReason;
  condition: ReturnCondition;
  notes: string;
  operator: string;
  timestamp: string;
  previous_status: Vial['status'];
}

const VIAL_STATUS_CONFIG: Record<Vial['status'], { label: string; variant: 'success' | 'warning' | 'info' | 'muted' | 'gold' | 'destructive' | 'default' }> = {
  filled: { label: 'Filled', variant: 'info' },
  sealed: { label: 'Sealed', variant: 'gold' },
  labeled: { label: 'Labeled', variant: 'warning' },
  allocated: { label: 'Allocated', variant: 'default' },
  shipped: { label: 'Shipped', variant: 'success' },
  returned: { label: 'Returned', variant: 'destructive' },
};

type ScanReturnStep = 'scan' | 'details' | 'confirm' | 'success';

function VialInventory() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [sortBy, setSortBy] = useState<'date' | 'serial' | 'perfume'>('date');

  // Scan Return state
  const [showScanReturn, setShowScanReturn] = useState(false);
  const [scanReturnStep, setScanReturnStep] = useState<ScanReturnStep>('scan');
  const [scanInput, setScanInput] = useState('');
  const [scannedVial, setScannedVial] = useState<Vial | null>(null);
  const [returnReason, setReturnReason] = useState<ReturnReason>('customer_return');
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnOperator, setReturnOperator] = useState('Karim M.');
  const [scanError, setScanError] = useState<string | null>(null);
  const [returnLogs, setReturnLogs] = useState<VialReturnLog[]>([]);
  const [showReturnHistory, setShowReturnHistory] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const [vials, setVials] = useState<Vial[]>(() => [
    {
      vial_id: 'VL-0001', serial_code: 'EM-VL-2026-0001', barcode: '7501234560001',
      perfume_name: 'Baccarat Rouge 540', master_id: 'MFK-BR540',
      size_ml: 8, fill_level_ml: 8, source_bottle_id: 'BTL-0042',
      decant_date: '2026-02-28', batch_id: 'PJ-001', status: 'shipped',
      destination: 'SUB-AK-001', qc_passed: true, operator: 'Omar K.',
    },
    {
      vial_id: 'VL-0002', serial_code: 'EM-VL-2026-0002', barcode: '7501234560002',
      perfume_name: 'Oud Wood', master_id: 'TF-OW',
      size_ml: 8, fill_level_ml: 8, source_bottle_id: 'BTL-0018',
      decant_date: '2026-02-28', batch_id: 'PJ-001', status: 'sealed',
      destination: 'SUB-AK-002', qc_passed: true, operator: 'Omar K.',
    },
    {
      vial_id: 'VL-0003', serial_code: 'EM-VL-2026-0003', barcode: '7501234560003',
      perfume_name: 'Aventus', master_id: 'CR-AVT',
      size_ml: 8, fill_level_ml: 7.8, source_bottle_id: 'BTL-0055',
      decant_date: '2026-02-27', batch_id: 'PJ-002', status: 'labeled',
      destination: 'SUB-AK-003', qc_passed: true, operator: 'Fatima A.',
    },
    {
      vial_id: 'VL-0004', serial_code: 'EM-VL-2026-0004', barcode: '7501234560004',
      perfume_name: 'Santal 33', master_id: 'LL-S33',
      size_ml: 8, fill_level_ml: 8, source_bottle_id: 'BTL-0033',
      decant_date: '2026-02-27', batch_id: 'PJ-002', status: 'filled',
      destination: '', qc_passed: false, operator: 'Fatima A.',
    },
    {
      vial_id: 'VL-0005', serial_code: 'EM-VL-2026-0005', barcode: '7501234560005',
      perfume_name: 'Tobacco Vanille', master_id: 'TF-TV',
      size_ml: 8, fill_level_ml: 8, source_bottle_id: 'BTL-0071',
      decant_date: '2026-02-26', batch_id: 'PJ-003', status: 'allocated',
      destination: 'CAP-THM-001', qc_passed: true, operator: 'Omar K.',
    },
    {
      vial_id: 'VL-0006', serial_code: 'EM-VL-2026-0006', barcode: '7501234560006',
      perfume_name: 'Rose 31', master_id: 'LL-R31',
      size_ml: 8, fill_level_ml: 8, source_bottle_id: 'BTL-0029',
      decant_date: '2026-02-26', batch_id: 'PJ-003', status: 'shipped',
      destination: 'GFT-HER-001', qc_passed: true, operator: 'Fatima A.',
    },
    {
      vial_id: 'VL-0007', serial_code: 'EM-VL-2026-0007', barcode: '7501234560007',
      perfume_name: 'Noir de Noir', master_id: 'TF-NDN',
      size_ml: 8, fill_level_ml: 0, source_bottle_id: 'BTL-0088',
      decant_date: '2026-02-25', batch_id: 'PJ-004', status: 'returned',
      destination: 'RET-001', qc_passed: false, operator: 'Omar K.',
      return_reason: 'qc_fail', return_condition: 'leaked', return_notes: 'Seal integrity compromised during QC',
      return_date: '2026-02-25', return_operator: 'Omar K.',
    },
    {
      vial_id: 'VL-0008', serial_code: 'EM-VL-2026-0008', barcode: '7501234560008',
      perfume_name: 'Baccarat Rouge 540', master_id: 'MFK-BR540',
      size_ml: 8, fill_level_ml: 8, source_bottle_id: 'BTL-0042',
      decant_date: '2026-02-25', batch_id: 'PJ-004', status: 'sealed',
      destination: 'SUB-AK-010', qc_passed: true, operator: 'Fatima A.',
    },
  ]);


  const filtered = useMemo(() => {
    let result = [...vials];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.vial_id.toLowerCase().includes(q) ||
        v.serial_code.toLowerCase().includes(q) ||
        v.perfume_name.toLowerCase().includes(q) ||
        v.barcode.includes(q) ||
        v.source_bottle_id.toLowerCase().includes(q) ||
        v.batch_id.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') result = result.filter(v => v.status === filterStatus);

    result.sort((a, b) => {
      if (sortBy === 'date') return b.decant_date.localeCompare(a.decant_date);
      if (sortBy === 'serial') return a.serial_code.localeCompare(b.serial_code);
      return a.perfume_name.localeCompare(b.perfume_name);
    });
    return result;
  }, [vials, search, filterStatus, sortBy]);

  // Stats
  const totalVials = vials.length;
  const filledCount = vials.filter(v => v.status === 'filled').length;
  const sealedCount = vials.filter(v => v.status === 'sealed').length;
  const shippedCount = vials.filter(v => v.status === 'shipped').length;
  const returnedCount = vials.filter(v => v.status === 'returned').length;
  const qcPassRate = vials.length > 0 ? (vials.filter(v => v.qc_passed).length / vials.length * 100) : 0;
  const totalVolume = vials.reduce((s, v) => s + v.fill_level_ml, 0);

  // ---- Scan Return Logic ----
  const openScanReturn = useCallback(() => {
    setShowScanReturn(true);
    setScanReturnStep('scan');
    setScanInput('');
    setScannedVial(null);
    setReturnReason('customer_return');
    setReturnCondition('good');
    setReturnNotes('');
    setScanError(null);
    setTimeout(() => scanInputRef.current?.focus(), 200);
  }, []);

  const closeScanReturn = useCallback(() => {
    setShowScanReturn(false);
    setScanReturnStep('scan');
    setScanInput('');
    setScannedVial(null);
    setScanError(null);
    setReturnNotes('');
  }, []);

  const handleScanLookup = useCallback(() => {
    const input = scanInput.trim();
    if (!input) {
      setScanError('Please scan or enter a vial serial code or barcode');
      return;
    }
    const found = vials.find(v =>
      v.serial_code.toLowerCase() === input.toLowerCase() ||
      v.barcode === input ||
      v.vial_id.toLowerCase() === input.toLowerCase()
    );
    if (!found) {
      setScanError(`No vial found matching "${input}". Check the code and try again.`);
      return;
    }
    if (found.status === 'returned') {
      setScanError(`Vial ${found.serial_code} is already marked as returned.`);
      return;
    }
    setScanError(null);
    setScannedVial(found);
    setScanReturnStep('details');
  }, [scanInput, vials]);

  const handleScanKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanLookup();
    }
  }, [handleScanLookup]);

  const handleConfirmReturn = useCallback(() => {
    if (!scannedVial) return;
    setScanReturnStep('confirm');
  }, [scannedVial]);

  const handleExecuteReturn = useCallback(() => {
    if (!scannedVial) return;
    const now = new Date().toISOString();
    const previousStatus = scannedVial.status;

    // Update the vial status
    setVials(prev => prev.map(v =>
      v.vial_id === scannedVial.vial_id
        ? {
            ...v,
            status: 'returned' as const,
            return_reason: returnReason,
            return_condition: returnCondition,
            return_notes: returnNotes,
            return_date: now.split('T')[0],
            return_operator: returnOperator,
            destination: `RET-${Date.now().toString(36).toUpperCase().slice(-4)}`,
          }
        : v
    ));

    // Add to return log
    const logEntry: VialReturnLog = {
      id: `RET-LOG-${Date.now()}`,
      vial_id: scannedVial.vial_id,
      serial_code: scannedVial.serial_code,
      perfume_name: scannedVial.perfume_name,
      reason: returnReason,
      condition: returnCondition,
      notes: returnNotes,
      operator: returnOperator,
      timestamp: now,
      previous_status: previousStatus,
    };
    setReturnLogs(prev => [logEntry, ...prev]);

    setScanReturnStep('success');
    toast.success(`Vial ${scannedVial.serial_code} returned successfully`, {
      description: `${RETURN_REASON_CONFIG[returnReason].label} · ${RETURN_CONDITION_CONFIG[returnCondition].label}`,
    });
  }, [scannedVial, returnReason, returnCondition, returnNotes, returnOperator]);

  const handleScanAnother = useCallback(() => {
    setScanReturnStep('scan');
    setScanInput('');
    setScannedVial(null);
    setScanError(null);
    setReturnNotes('');
    setReturnReason('customer_return');
    setReturnCondition('good');
    setTimeout(() => scanInputRef.current?.focus(), 200);
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-gold">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total Vials</p>
          <p className="text-xl font-mono font-bold">{totalVials}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-blue-500">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Filled</p>
          <p className="text-xl font-mono font-bold">{filledCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-amber-500">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Sealed</p>
          <p className="text-xl font-mono font-bold">{sealedCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-emerald-500">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Shipped</p>
          <p className="text-xl font-mono font-bold">{shippedCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-red-500">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Returned</p>
          <p className="text-xl font-mono font-bold">{returnedCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 border-l-[3px] border-l-cyan-500">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">QC Pass Rate</p>
          <p className="text-xl font-mono font-bold">{qcPassRate.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">{totalVolume.toFixed(1)}ml total</p>
        </div>
      </div>

      {/* Filters + Scan Return Button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by vial ID, serial, perfume, barcode, batch..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="all">All Status</option>
          {Object.entries(VIAL_STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="date">Sort: Date</option>
          <option value="serial">Sort: Serial</option>
          <option value="perfume">Sort: Perfume</option>
        </select>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-700"
            onClick={openScanReturn}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Scan Return
          </Button>
          {returnLogs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setShowReturnHistory(true)}
            >
              <History className="w-3.5 h-3.5" /> Return Log ({returnLogs.length})
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
            const headers = ['Vial ID', 'Serial Code', 'Barcode', 'Perfume', 'Size (ml)', 'Fill (ml)', 'Source Bottle', 'Decant Date', 'Batch', 'Status', 'Destination', 'QC', 'Decanted By', 'Return Reason', 'Return Condition', 'Return Notes', 'Return Date'];
            const rows = filtered.map(v => [
              v.vial_id, v.serial_code, v.barcode, v.perfume_name,
              String(v.size_ml), String(v.fill_level_ml), v.source_bottle_id,
              v.decant_date, v.batch_id, v.status, v.destination,
              v.qc_passed ? 'PASS' : 'FAIL', v.operator,
              v.return_reason || '', v.return_condition || '', v.return_notes || '', v.return_date || '',
            ]);
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `vial-inventory-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
            toast.success('Vial inventory exported');
          }}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Vial Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Vial / Serial</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Barcode</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Perfume</th>

                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Fill</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Source</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Batch</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">QC</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Dest.</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Decanted By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.vial_id} className={cn(
                  'border-b border-border/50 hover:bg-muted/20 transition-colors',
                  v.status === 'returned' && 'bg-red-500/5'
                )}>
                  <td className="px-4 py-2.5">
                    <div>
                      <span className="text-xs font-mono font-bold">{v.vial_id}</span>
                      <p className="text-[10px] font-mono text-muted-foreground">{v.serial_code}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <VialBarcodeBadge vial={v} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{v.perfume_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{v.master_id}</p>
                    </div>
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', v.fill_level_ml / v.size_ml >= 0.9 ? 'bg-emerald-500' : v.fill_level_ml / v.size_ml >= 0.5 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${(v.fill_level_ml / v.size_ml) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{v.fill_level_ml}/{v.size_ml}ml</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground">{v.source_bottle_id}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{v.batch_id}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                    {new Date(v.decant_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <StatusBadge variant={VIAL_STATUS_CONFIG[v.status].variant}>
                        {VIAL_STATUS_CONFIG[v.status].label}
                      </StatusBadge>
                      {v.status === 'returned' && v.return_reason && (
                        <span className="text-[9px] text-red-500/80">
                          {RETURN_REASON_CONFIG[v.return_reason]?.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {v.qc_passed
                      ? <span className="text-xs text-emerald-500 font-bold">PASS</span>
                      : <span className="text-xs text-red-500 font-bold">FAIL</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground">{v.destination || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10">
            <Droplets className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No vials found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Decanted vials will appear here with serial codes and tracking</p>
          </div>
        )}
        <div className="px-5 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} of {vials.length} vials</span>
          <span className="text-xs text-muted-foreground">
            {returnLogs.length > 0 && `${returnLogs.length} returns logged this session`}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SCAN RETURN DIALOG — Multi-step return flow                  */}
      {/* ============================================================ */}
      <Dialog open={showScanReturn} onOpenChange={(open) => { if (!open) closeScanReturn(); }}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          {/* Dialog Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-b from-red-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <DialogTitle className="text-base">Scan Return</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {scanReturnStep === 'scan' && 'Scan or enter vial barcode / serial code to initiate return'}
                  {scanReturnStep === 'details' && 'Provide return reason and condition assessment'}
                  {scanReturnStep === 'confirm' && 'Review and confirm the return'}
                  {scanReturnStep === 'success' && 'Return processed successfully'}
                </DialogDescription>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mt-4">
              {(['scan', 'details', 'confirm', 'success'] as ScanReturnStep[]).map((step, i) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                    scanReturnStep === step
                      ? 'bg-red-500 text-white'
                      : (['scan', 'details', 'confirm', 'success'].indexOf(scanReturnStep) > i)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  )}>
                    {(['scan', 'details', 'confirm', 'success'].indexOf(scanReturnStep) > i) ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 3 && (
                    <div className={cn(
                      'flex-1 h-0.5 rounded-full',
                      (['scan', 'details', 'confirm', 'success'].indexOf(scanReturnStep) > i) ? 'bg-emerald-500' : 'bg-muted'
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="px-6 py-5">
            {/* STEP 1: Scan */}
            {scanReturnStep === 'scan' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Scan the vial barcode with your 2D scanner, or manually enter the serial code (EM-VL-2026-XXXX) or barcode number.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Vial Serial Code / Barcode
                  </label>
                  <div className="relative">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={scanInput}
                      onChange={e => { setScanInput(e.target.value); setScanError(null); }}
                      onKeyDown={handleScanKeyDown}
                      placeholder="Scan or type: EM-VL-2026-0001 or 7501234560001"
                      className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 font-mono"
                      autoFocus
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <CornerDownLeft className="w-3 h-3" /> Enter
                    </div>
                  </div>
                </div>

                {scanError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{scanError}</p>
                  </div>
                )}

                <Button
                  onClick={handleScanLookup}
                  className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
                  disabled={!scanInput.trim()}
                >
                  <Search className="w-4 h-4" /> Look Up Vial
                </Button>
              </div>
            )}

            {/* STEP 2: Details */}
            {scanReturnStep === 'details' && scannedVial && (
              <div className="space-y-4">
                {/* Vial Info Card */}
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold">{scannedVial.perfume_name}</h4>
                      <p className="text-[11px] font-mono text-muted-foreground">{scannedVial.serial_code}</p>
                    </div>
                    <StatusBadge variant={VIAL_STATUS_CONFIG[scannedVial.status].variant}>
                      {VIAL_STATUS_CONFIG[scannedVial.status].label}
                    </StatusBadge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Fill Level</span>
                      <span className="font-mono font-medium">{scannedVial.fill_level_ml}/{scannedVial.size_ml}ml</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Source</span>
                      <span className="font-mono">{scannedVial.source_bottle_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Batch</span>
                      <span className="font-mono">{scannedVial.batch_id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Decant Date</span>
                      <span className="font-mono">{scannedVial.decant_date}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">QC</span>
                      {scannedVial.qc_passed
                        ? <span className="text-emerald-500 font-bold">PASS</span>
                        : <span className="text-red-500 font-bold">FAIL</span>
                      }
                    </div>
                  </div>
                </div>

                {/* Return Reason */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Return Reason</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(RETURN_REASON_CONFIG) as [ReturnReason, typeof RETURN_REASON_CONFIG[ReturnReason]][]).map(([key, cfg]) => {
                      const ReasonIcon = cfg.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => setReturnReason(key)}
                          className={cn(
                            'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-xs',
                            returnReason === key
                              ? 'border-red-500/40 bg-red-500/10 ring-1 ring-red-500/20'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <ReasonIcon className={cn('w-4 h-4 shrink-0', cfg.color)} />
                          <span className="font-medium">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Condition Assessment */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Condition Assessment</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(Object.entries(RETURN_CONDITION_CONFIG) as [ReturnCondition, typeof RETURN_CONDITION_CONFIG[ReturnCondition]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setReturnCondition(key)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-xs',
                          returnCondition === key
                            ? `${cfg.bgColor} ring-1 ring-current/20`
                            : 'border-border hover:bg-muted/50'
                        )}
                      >
                        <div className={cn(
                          'w-3 h-3 rounded-full border-2',
                          returnCondition === key ? 'border-current bg-current' : 'border-muted-foreground/30'
                        )} />
                        <span className={cn('font-medium', returnCondition === key && cfg.color)}>{cfg.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Operator */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    <User className="w-3 h-3 inline mr-1" /> Decanted By
                  </label>
                  <input
                    type="text"
                    value={returnOperator}
                    onChange={e => setReturnOperator(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    <FileText className="w-3 h-3 inline mr-1" /> Notes (optional)
                  </label>
                  <Textarea
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    placeholder="Additional details about the return..."
                    className="text-sm min-h-[60px] resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setScanReturnStep('scan')}
                    className="flex-1 gap-1.5"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleConfirmReturn}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5"
                  >
                    Review Return <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Confirm */}
            {scanReturnStep === 'confirm' && scannedVial && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border-2 border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Confirm Vial Return</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    This will change the vial status to <strong>Returned</strong> and log the return event. This action is recorded in the return history.
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Vial</span>
                      <span className="font-mono font-bold">{scannedVial.serial_code}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Perfume</span>
                      <span className="font-medium">{scannedVial.perfume_name}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Previous Status</span>
                      <StatusBadge variant={VIAL_STATUS_CONFIG[scannedVial.status].variant}>
                        {VIAL_STATUS_CONFIG[scannedVial.status].label}
                      </StatusBadge>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">New Status</span>
                      <StatusBadge variant="destructive">Returned</StatusBadge>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Reason</span>
                      <span className="font-medium">{RETURN_REASON_CONFIG[returnReason].label}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Condition</span>
                      <span className={cn('font-medium', RETURN_CONDITION_CONFIG[returnCondition].color)}>
                        {RETURN_CONDITION_CONFIG[returnCondition].label}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Decanted By</span>
                      <span className="font-medium">{returnOperator}</span>
                    </div>
                    {returnNotes && (
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Notes</span>
                        <span className="font-medium text-right max-w-[200px]">{returnNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setScanReturnStep('details')}
                    className="flex-1 gap-1.5"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleExecuteReturn}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Confirm Return
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Success */}
            {scanReturnStep === 'success' && scannedVial && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-lg font-bold">Return Processed</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vial <span className="font-mono font-bold">{scannedVial.serial_code}</span> has been marked as returned.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1.5 text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Perfume</span>
                    <span className="font-medium">{scannedVial.perfume_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="font-medium">{RETURN_REASON_CONFIG[returnReason].label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Condition</span>
                    <span className={cn('font-medium', RETURN_CONDITION_CONFIG[returnCondition].color)}>
                      {RETURN_CONDITION_CONFIG[returnCondition].label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timestamp</span>
                    <span className="font-mono">{new Date().toLocaleString('en-GB')}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={closeScanReturn}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handleScanAnother}
                    className="flex-1 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                  >
                    <ScanBarcode className="w-4 h-4" /> Scan Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* RETURN HISTORY DIALOG                                        */}
      {/* ============================================================ */}
      <Dialog open={showReturnHistory} onOpenChange={setShowReturnHistory}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <History className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle className="text-base">Return History</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {returnLogs.length} returns logged this session
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {returnLogs.length === 0 ? (
              <div className="text-center py-10">
                <RotateCcw className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No returns logged yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {returnLogs.map(log => {
                  const reasonCfg = RETURN_REASON_CONFIG[log.reason];
                  const conditionCfg = RETURN_CONDITION_CONFIG[log.condition];
                  const ReasonIcon = reasonCfg.icon;
                  return (
                    <div key={log.id} className="px-6 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 mt-0.5')}>
                            <ReasonIcon className={cn('w-4 h-4', reasonCfg.color)} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{log.perfume_name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{log.serial_code}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-medium">{reasonCfg.label}</span>
                              <span className="text-[10px] text-muted-foreground">·</span>
                              <span className={cn('text-[10px] font-medium', conditionCfg.color)}>{conditionCfg.label}</span>
                            </div>
                            {log.notes && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 italic">{log.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{log.operator}</p>
                          <StatusBadge variant={VIAL_STATUS_CONFIG[log.previous_status].variant} className="mt-1">
                            was: {VIAL_STATUS_CONFIG[log.previous_status].label}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t border-border bg-muted/10">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowReturnHistory(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
