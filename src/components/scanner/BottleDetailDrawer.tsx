// ============================================================
// Bottle Detail Drawer — Shows full bottle info after scan,
// with quick-edit actions, QR label, location, and ledger trail.
// Design: "Maison Ops" — slide-in sheet, gold accents
// ============================================================

import { useState, useMemo } from 'react';
import {
  X, MapPin, Package, Droplets, Tag, Clock, Truck, Edit2,
  CheckCircle2, AlertTriangle, QrCode, Printer, ArrowRight,
  ChevronRight, Beaker, ShieldCheck, Ban, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  getSealedBottles, getBottleLedger, getLocations, getSuppliers,
  useSealedBottles, useBottleLedger, useLocations,
} from '@/lib/inventory-store';
import { mockPerfumes } from '@/lib/mock-data';
import type { InventoryBottle, BottleLedgerEvent, Perfume } from '@/types';

interface BottleDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  bottleId: string | null;
  scannedCode: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  available: { label: 'Available', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  reserved: { label: 'Reserved', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  allocated: { label: 'Allocated', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: ArrowRight },
  sold: { label: 'Sold', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: Tag },
  in_decanting: { label: 'In Decanting', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', icon: Beaker },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  sealed: { label: 'Sealed', color: 'text-emerald-400 bg-emerald-500/10' },
  open: { label: 'Open', color: 'text-amber-400 bg-amber-500/10' },
  tester: { label: 'Tester', color: 'text-blue-400 bg-blue-500/10' },
};

export default function BottleDetailDrawer({ open, onClose, bottleId, scannedCode }: BottleDetailDrawerProps) {
  const allBottles = useSealedBottles();
  const allLedger = useBottleLedger();
  const allLocations = useLocations();
  const [showQR, setShowQR] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);

  // Resolve bottle from various scan formats
  const bottle = useMemo<InventoryBottle | null>(() => {
    if (!bottleId && !scannedCode) return null;

    // Direct bottle ID match
    if (bottleId) {
      const found = allBottles.find(b => b.bottle_id === bottleId);
      if (found) return found;
    }

    if (!scannedCode) return null;
    const code = scannedCode.trim();

    // Try direct bottle_id match
    const directMatch = allBottles.find(b => b.bottle_id === code);
    if (directMatch) return directMatch;

    // Try barcode match (EM-BTL-xxx-xxx format)
    const barcodeMatch = allBottles.find(b => b.barcode === code);
    if (barcodeMatch) return barcodeMatch;

    // Try QR data match (JSON payload)
    try {
      const parsed = JSON.parse(code);
      if (parsed.id) {
        const qrMatch = allBottles.find(b => b.bottle_id === parsed.id);
        if (qrMatch) return qrMatch;
      }
    } catch {
      // Not JSON — try partial match
    }

    // Try partial match (contains bottle ID)
    const partialMatch = allBottles.find(b =>
      code.includes(b.bottle_id) || (b.barcode && code.includes(b.barcode))
    );
    if (partialMatch) return partialMatch;

    return null;
  }, [bottleId, scannedCode, allBottles]);

  // Get perfume info
  const perfume = useMemo<Perfume | null>(() => {
    if (!bottle) return null;
    return mockPerfumes.find(p => p.master_id === bottle.master_id) || null;
  }, [bottle]);

  // Get supplier info
  const supplier = useMemo(() => {
    if (!bottle) return null;
    const suppliers = getSuppliers();
    return suppliers.find(s => s.supplier_id === bottle.supplier_id) || null;
  }, [bottle]);

  // Get location info
  const location = useMemo(() => {
    if (!bottle) return null;
    return allLocations.find(l => l.code === bottle.location_code) || null;
  }, [bottle, allLocations]);

  // Get ledger events for this bottle
  const ledgerEvents = useMemo<BottleLedgerEvent[]>(() => {
    if (!bottle) return [];
    return allLedger.filter(e => e.bottle_id === bottle.bottle_id);
  }, [bottle, allLedger]);

  const handleStatusChange = (newStatus: string) => {
    toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`, {
      description: `Bottle ${bottle?.bottle_id}`,
    });
    setEditingStatus(false);
  };

  const handlePrintLabel = () => {
    toast.success('Label sent to printer', {
      description: `QR label for ${bottle?.bottle_id}`,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 w-full max-w-lg bg-card border-l border-border shadow-2xl h-full overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {bottle ? bottle.bottle_id : 'Bottle Not Found'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {bottle ? `Scanned: ${scannedCode || bottleId}` : 'No matching bottle in inventory'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!bottle ? (
          /* Not found state */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Bottle Not Found</h3>
            <p className="text-sm text-muted-foreground mb-1">
              No bottle matches the scanned code:
            </p>
            <code className="text-xs font-mono bg-muted px-3 py-1.5 rounded-md text-foreground mb-6 max-w-full truncate block">
              {scannedCode || bottleId}
            </code>
            <div className="space-y-2 w-full max-w-xs">
              <button
                onClick={onClose}
                className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Scan Again
              </button>
              <p className="text-xs text-muted-foreground">
                Make sure the bottle has been registered in the inventory system.
              </p>
            </div>
          </div>
        ) : (
          /* Bottle found — full detail */
          <div className="p-5 space-y-5">
            {/* Perfume Info Card */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Perfume</p>
                  <h3 className="text-lg font-semibold text-foreground leading-tight">
                    {perfume ? `${perfume.brand} ${perfume.name}` : bottle.master_id}
                  </h3>
                  {perfume && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {perfume.concentration} · {perfume.gender_target} · {perfume.main_family_id}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Bottle Type Badge */}
                  <span className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full',
                    TYPE_CONFIG[bottle.bottle_type]?.color || 'text-muted-foreground bg-muted',
                  )}>
                    {TYPE_CONFIG[bottle.bottle_type]?.label || bottle.bottle_type}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = STATUS_CONFIG[bottle.status] || STATUS_CONFIG.available;
                  const Icon = cfg.icon;
                  return (
                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border', cfg.color)}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  );
                })()}
                <button
                  onClick={() => setEditingStatus(!editingStatus)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>

              {/* Quick status change */}
              {editingStatus && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(key)}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md border transition-colors',
                        bottle.status === key
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                          : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted',
                      )}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 border border-border rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Size</p>
                <p className="text-lg font-bold text-foreground">{bottle.size_ml}<span className="text-xs font-normal text-muted-foreground ml-0.5">ml</span></p>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  {bottle.bottle_type !== 'sealed' ? 'Remaining' : 'Volume'}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {bottle.current_ml ?? bottle.size_ml}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">ml</span>
                </p>
                {bottle.bottle_type !== 'sealed' && bottle.current_ml != null && (
                  <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (bottle.current_ml / bottle.size_ml) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Purchase Price</p>
                <p className="text-lg font-bold text-foreground">
                  <span className="text-xs font-normal text-muted-foreground">AED </span>
                  {bottle.purchase_price}
                </p>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Purchase Date</p>
                <p className="text-sm font-semibold text-foreground">{bottle.purchase_date}</p>
              </div>
            </div>

            {/* Location */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vault Location</p>
                </div>
                <button
                  onClick={() => setEditingLocation(!editingLocation)}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <p className="text-base font-mono font-semibold text-foreground">{bottle.location_code}</p>
              {location && (
                <p className="text-xs text-muted-foreground mt-1">
                  Zone {location.zone} · Shelf {location.shelf} · Slot {location.slot} · {location.type}
                </p>
              )}
              {editingLocation && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-2">Relocate to:</p>
                  <div className="flex gap-2">
                    <select className="flex-1 h-8 text-xs bg-background border border-border rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
                      {allLocations
                        .filter(l => !l.occupied || l.bottle_id === bottle.bottle_id)
                        .slice(0, 20)
                        .map(l => (
                          <option key={l.location_id} value={l.code}>
                            {l.code} — Zone {l.zone} Shelf {l.shelf} Slot {l.slot}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={() => {
                        toast.success('Location updated');
                        setEditingLocation(false);
                      }}
                      className="px-3 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
                    >
                      Move
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Supplier */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supplier</p>
              </div>
              <p className="text-sm font-semibold text-foreground">{supplier?.name || bottle.supplier_id}</p>
              {supplier && (
                <p className="text-xs text-muted-foreground mt-1">
                  {supplier.type} · {supplier.country} · {supplier.contact_name}
                </p>
              )}
            </div>

            {/* IDs & Codes */}
            <div className="bg-muted/30 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">IDs & Codes</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="px-2.5 py-1 text-xs bg-muted border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    {showQR ? 'Hide QR' : 'Show QR'}
                  </button>
                  <button
                    onClick={handlePrintLabel}
                    className="px-2.5 py-1 text-xs bg-muted border border-border rounded-md hover:bg-accent transition-colors flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bottle ID</span>
                  <span className="font-mono text-foreground">{bottle.bottle_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Master ID</span>
                  <span className="font-mono text-foreground">{bottle.master_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Barcode</span>
                  <span className="font-mono text-foreground">{bottle.barcode || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manufacturer ID</span>
                  <span className="font-mono text-foreground">{bottle.manufacturer_id}</span>
                </div>
              </div>

              {/* QR Code */}
              {showQR && (
                <div className="mt-4 flex justify-center">
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG
                      value={bottle.qr_data || JSON.stringify({ id: bottle.bottle_id, master: bottle.master_id })}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                    <p className="text-center text-[10px] text-gray-600 font-mono mt-2">{bottle.bottle_id}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {bottle.bottle_type === 'sealed' && bottle.status === 'available' && (
                  <button
                    onClick={() => toast.info('Sell Bottle flow — coming soon')}
                    className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    Sell Bottle
                  </button>
                )}
                {(bottle.bottle_type === 'open' || bottle.bottle_type === 'tester') && bottle.status === 'available' && (
                  <button
                    onClick={() => toast.info('Start Decant flow — coming soon')}
                    className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
                  >
                    <Beaker className="w-3.5 h-3.5" />
                    Start Decant
                  </button>
                )}
                <button
                  onClick={() => toast.info('Transfer flow — coming soon')}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Transfer
                </button>
                <button
                  onClick={() => toast.info('Flag for QC — coming soon')}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  QC Flag
                </button>
              </div>
            </div>

            {/* Ledger Trail */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audit Trail</p>
                </div>
                <span className="text-xs text-muted-foreground">{ledgerEvents.length} events</span>
              </div>

              {ledgerEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No ledger events found for this bottle.</p>
              ) : (
                <div className="space-y-0">
                  {ledgerEvents.slice(0, 10).map((event, idx) => (
                    <div key={event.event_id} className="flex gap-3 pb-3 last:pb-0">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-1.5 shrink-0',
                          event.type === 'INTAKE' ? 'bg-emerald-500' :
                          event.type === 'DECANTED_OUT' ? 'bg-cyan-500' :
                          event.type === 'ADJUSTMENT' ? 'bg-amber-500' :
                          event.type === 'RETURNED' ? 'bg-blue-500' :
                          'bg-muted-foreground',
                        )} />
                        {idx < Math.min(ledgerEvents.length, 10) - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {event.type}
                          </span>
                          {event.qty_ml && (
                            <span className="text-[10px] text-muted-foreground">{event.qty_ml}ml</span>
                          )}
                        </div>
                        <p className="text-xs text-foreground mt-0.5 line-clamp-2">{event.reason}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Created timestamp */}
            <div className="pt-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                Created {new Date(bottle.created_at).toLocaleString()} · {bottle.bottle_id}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
