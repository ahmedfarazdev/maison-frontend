// ============================================================
// RTS Ledger — Lifecycle tracking for internally produced RTS products
// Tracks: date, batch, product, quantity, status, who did it,
// logged in inventory, taken from inventory, sold
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import {
  Search, ArrowUpDown, BookOpen, Filter, Package,
  ArrowDown, ArrowUp, ShoppingCart, Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RTSAction = 'produced' | 'logged_inventory' | 'taken_from_inventory' | 'sold' | 'returned' | 'written_off';

interface RTSLedgerEntry {
  id: string;
  date: string;
  batch_id: string;
  product_name: string;
  product_sku: string;
  qty: number;
  action: RTSAction;
  performed_by: string;
  notes: string;
  running_balance: number;
}

const ACTION_CONFIG: Record<RTSAction, { label: string; variant: 'success' | 'gold' | 'info' | 'default' | 'destructive'; direction: 'in' | 'out' | 'neutral' }> = {
  produced: { label: 'Produced', variant: 'success', direction: 'in' },
  logged_inventory: { label: 'Logged to Inventory', variant: 'info', direction: 'in' },
  taken_from_inventory: { label: 'Taken from Inventory', variant: 'gold', direction: 'out' },
  sold: { label: 'Sold', variant: 'success', direction: 'out' },
  returned: { label: 'Returned', variant: 'default', direction: 'in' },
  written_off: { label: 'Written Off', variant: 'destructive', direction: 'out' },
};

export default function RTSLedger() {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterAction, setFilterAction] = useState<RTSAction | 'all'>('all');

  const ledgerEntries: RTSLedgerEntry[] = useMemo(() => [
    {
      id: 'rtsl-001', date: '2026-03-10T14:30:00', batch_id: 'PJ-001',
      product_name: 'Aura Discovery Set — Woody', product_sku: 'EM/AK/SUB-001',
      qty: 25, action: 'produced', performed_by: 'Fatima A.',
      notes: 'Production batch completed — QC passed', running_balance: 25,
    },
    {
      id: 'rtsl-002', date: '2026-03-10T15:00:00', batch_id: 'PJ-001',
      product_name: 'Aura Discovery Set — Woody', product_sku: 'EM/AK/SUB-001',
      qty: 25, action: 'logged_inventory', performed_by: 'Sara M.',
      notes: 'Logged to RTS inventory shelf B-3', running_balance: 25,
    },
    {
      id: 'rtsl-003', date: '2026-03-11T09:15:00', batch_id: 'PJ-001',
      product_name: 'Aura Discovery Set — Woody', product_sku: 'EM/AK/SUB-001',
      qty: 10, action: 'taken_from_inventory', performed_by: 'Nadia H.',
      notes: 'Allocated for Cycle 4 fulfillment — 10 subscription orders', running_balance: 15,
    },
    {
      id: 'rtsl-004', date: '2026-03-11T16:00:00', batch_id: 'PJ-001',
      product_name: 'Aura Discovery Set — Woody', product_sku: 'EM/AK/SUB-001',
      qty: 10, action: 'sold', performed_by: 'System',
      notes: 'Cycle 4 orders shipped — 10 units dispatched', running_balance: 15,
    },
    {
      id: 'rtsl-005', date: '2026-03-09T11:00:00', batch_id: 'PJ-002',
      product_name: 'Monthly Refill — Floral Bouquet', product_sku: 'EM/AK/REF-003',
      qty: 40, action: 'produced', performed_by: 'Fatima A.',
      notes: 'Production batch completed — QC passed', running_balance: 40,
    },
    {
      id: 'rtsl-006', date: '2026-03-09T11:30:00', batch_id: 'PJ-002',
      product_name: 'Monthly Refill — Floral Bouquet', product_sku: 'EM/AK/REF-003',
      qty: 40, action: 'logged_inventory', performed_by: 'Sara M.',
      notes: 'Logged to RTS inventory shelf C-1', running_balance: 40,
    },
    {
      id: 'rtsl-007', date: '2026-03-10T08:00:00', batch_id: 'PJ-002',
      product_name: 'Monthly Refill — Floral Bouquet', product_sku: 'EM/AK/REF-003',
      qty: 20, action: 'taken_from_inventory', performed_by: 'Nadia H.',
      notes: 'Allocated for one-time orders batch #OT-2026-03-10', running_balance: 20,
    },
    {
      id: 'rtsl-008', date: '2026-03-10T17:00:00', batch_id: 'PJ-002',
      product_name: 'Monthly Refill — Floral Bouquet', product_sku: 'EM/AK/REF-003',
      qty: 20, action: 'sold', performed_by: 'System',
      notes: 'One-time orders shipped — 20 units dispatched', running_balance: 20,
    },
    {
      id: 'rtsl-009', date: '2026-03-12T10:00:00', batch_id: 'PJ-002',
      product_name: 'Monthly Refill — Floral Bouquet', product_sku: 'EM/AK/REF-003',
      qty: 1, action: 'returned', performed_by: 'Khalid R.',
      notes: 'Customer return — damaged packaging, product intact', running_balance: 21,
    },
    {
      id: 'rtsl-010', date: '2026-03-08T14:00:00', batch_id: 'PJ-003',
      product_name: 'Capsule: Oud Royale Collection', product_sku: 'EM/CAP/THM-001',
      qty: 15, action: 'produced', performed_by: 'Fatima A.',
      notes: 'Limited capsule production — QC passed', running_balance: 15,
    },
    {
      id: 'rtsl-011', date: '2026-03-08T14:30:00', batch_id: 'PJ-003',
      product_name: 'Capsule: Oud Royale Collection', product_sku: 'EM/CAP/THM-001',
      qty: 15, action: 'logged_inventory', performed_by: 'Sara M.',
      notes: 'Logged to premium shelf A-1', running_balance: 15,
    },
    {
      id: 'rtsl-012', date: '2026-03-12T09:00:00', batch_id: 'PJ-003',
      product_name: 'Capsule: Oud Royale Collection', product_sku: 'EM/CAP/THM-001',
      qty: 1, action: 'written_off', performed_by: 'Sara M.',
      notes: 'QC re-check failed — vial seal compromised', running_balance: 14,
    },
  ], []);

  const filteredEntries = useMemo(() => {
    let result = ledgerEntries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.product_name.toLowerCase().includes(q) ||
        e.batch_id.toLowerCase().includes(q) ||
        e.product_sku.toLowerCase().includes(q) ||
        e.performed_by.toLowerCase().includes(q)
      );
    }
    if (filterAction !== 'all') {
      result = result.filter(e => e.action === filterAction);
    }
    result = [...result].sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });
    return result;
  }, [ledgerEntries, search, sortOrder, filterAction]);

  // Summary KPIs
  const summary = useMemo(() => {
    let totalProduced = 0, totalLogged = 0, totalTaken = 0, totalSold = 0, totalReturned = 0, totalWrittenOff = 0;
    for (const e of ledgerEntries) {
      switch (e.action) {
        case 'produced': totalProduced += e.qty; break;
        case 'logged_inventory': totalLogged += e.qty; break;
        case 'taken_from_inventory': totalTaken += e.qty; break;
        case 'sold': totalSold += e.qty; break;
        case 'returned': totalReturned += e.qty; break;
        case 'written_off': totalWrittenOff += e.qty; break;
      }
    }
    return { totalProduced, totalLogged, totalTaken, totalSold, totalReturned, totalWrittenOff, netBalance: totalProduced + totalReturned - totalSold - totalWrittenOff };
  }, [ledgerEntries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RTS Ledger"
        subtitle="Full lifecycle audit trail for internally produced ready-to-ship products"
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-card border border-border/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Produced</p>
          <div className="flex items-center gap-1.5 mt-1">
            <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-lg font-mono font-bold text-emerald-500">{summary.totalProduced}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Logged</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Warehouse className="w-3.5 h-3.5 text-info" />
            <p className="text-lg font-mono font-bold text-info">{summary.totalLogged}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Taken</p>
          <div className="flex items-center gap-1.5 mt-1">
            <ArrowUp className="w-3.5 h-3.5 text-gold" />
            <p className="text-lg font-mono font-bold text-gold">{summary.totalTaken}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sold</p>
          <div className="flex items-center gap-1.5 mt-1">
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-lg font-mono font-bold text-emerald-500">{summary.totalSold}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Returned</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-lg font-mono font-bold">{summary.totalReturned}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Written Off</p>
          <div className="flex items-center gap-1.5 mt-1">
            <ArrowUp className="w-3.5 h-3.5 text-red-500" />
            <p className="text-lg font-mono font-bold text-red-500">{summary.totalWrittenOff}</p>
          </div>
        </div>
        <div className="bg-card border border-gold/30 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Net Balance</p>
          <p className="text-lg font-mono font-bold text-gold mt-1">{summary.netBalance}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, batch, SKU, or person..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value as RTSAction | 'all')}
            className="h-9 px-3 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <option value="all">All Actions</option>
            <option value="produced">Produced</option>
            <option value="logged_inventory">Logged to Inventory</option>
            <option value="taken_from_inventory">Taken from Inventory</option>
            <option value="sold">Sold</option>
            <option value="returned">Returned</option>
            <option value="written_off">Written Off</option>
          </select>
        </div>
        <button
          onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" /> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Ledger Table */}
      <SectionCard title="RTS Product Ledger" subtitle={`${filteredEntries.length} ledger entries`}>
        <div className="overflow-x-auto -m-4">
          <table className="w-full ops-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date / Time</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Batch</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Product</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Qty</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Action</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Performed By</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Notes</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(e => {
                const config = ACTION_CONFIG[e.action];
                return (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      <span className="ml-1 text-muted-foreground/60">
                        {new Date(e.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{e.batch_id}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{e.product_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{e.product_sku}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono text-right">
                      <span className={cn(
                        'font-bold',
                        config.direction === 'in' ? 'text-emerald-500' : config.direction === 'out' ? 'text-red-500' : ''
                      )}>
                        {config.direction === 'in' ? '+' : '-'}{e.qty}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge variant={config.variant}>
                        {config.label}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-sm">{e.performed_by}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[250px] truncate" title={e.notes}>{e.notes}</td>
                    <td className="px-4 py-2.5 text-sm font-mono font-bold text-right">{e.running_balance}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredEntries.length === 0 && (
          <div className="text-center py-10">
            <BookOpen className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No ledger entries found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">RTS product lifecycle events will appear here</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
