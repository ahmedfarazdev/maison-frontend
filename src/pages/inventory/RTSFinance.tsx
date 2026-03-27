// ============================================================
// RTS Finance — Production cost tracking for ready-to-ship products
// Moved from Ledger.tsx to its own page under Inventory → RTS
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import {
  Search, ArrowUpDown, Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RTSFinanceEntry {
  id: string;
  date: string;
  batch_id: string;
  product_name: string;
  product_sku: string;
  category: string;
  qty: number;
  material_cost: number;
  labor_cost: number;
  packaging_cost: number;
  total_cost: number;
  unit_cost: number;
  retail_price: number;
  margin_pct: number;
  status: 'completed' | 'in_production' | 'queued';
}

export default function RTSFinance() {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const rtsFinanceEntries: RTSFinanceEntry[] = useMemo(() => [
    {
      id: 'rtsf-001', date: '2026-02-28', batch_id: 'PJ-001',
      product_name: 'Aura Discovery Set — Woody', product_sku: 'EM/AK/SUB-001',
      category: '1st Time Subscription', qty: 25,
      material_cost: 1875, labor_cost: 375, packaging_cost: 250, total_cost: 2500,
      unit_cost: 100, retail_price: 249, margin_pct: 59.8, status: 'completed',
    },
    {
      id: 'rtsf-002', date: '2026-02-27', batch_id: 'PJ-002',
      product_name: 'Monthly Refill — Floral Bouquet', product_sku: 'EM/AK/REF-003',
      category: 'Monthly Subscription', qty: 40,
      material_cost: 2400, labor_cost: 600, packaging_cost: 400, total_cost: 3400,
      unit_cost: 85, retail_price: 179, margin_pct: 52.5, status: 'completed',
    },
    {
      id: 'rtsf-003', date: '2026-02-26', batch_id: 'PJ-003',
      product_name: 'Capsule: Oud Royale Collection', product_sku: 'EM/CAP/THM-001',
      category: 'Capsule: Themed Set', qty: 15,
      material_cost: 2250, labor_cost: 450, packaging_cost: 375, total_cost: 3075,
      unit_cost: 205, retail_price: 499, margin_pct: 58.9, status: 'completed',
    },
    {
      id: 'rtsf-004', date: '2026-02-25', batch_id: 'PJ-004',
      product_name: 'Gift Set For Her — Rose Edition', product_sku: 'EM/GFT/HER-001',
      category: 'Gift Set For Her', qty: 20,
      material_cost: 3000, labor_cost: 500, packaging_cost: 600, total_cost: 4100,
      unit_cost: 205, retail_price: 399, margin_pct: 48.6, status: 'in_production',
    },
    {
      id: 'rtsf-005', date: '2026-02-24', batch_id: 'PJ-005',
      product_name: 'Whisperer Vials — Amber Night', product_sku: 'EM/WSP/SET-001',
      category: 'Whisperer Vials Set', qty: 30,
      material_cost: 1800, labor_cost: 450, packaging_cost: 300, total_cost: 2550,
      unit_cost: 85, retail_price: 199, margin_pct: 57.3, status: 'queued',
    },
  ], []);

  const filteredEntries = useMemo(() => {
    let result = rtsFinanceEntries;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.product_name.toLowerCase().includes(q) ||
        e.batch_id.toLowerCase().includes(q) ||
        e.product_sku.toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'oldest') result = [...result].reverse();
    return result;
  }, [rtsFinanceEntries, search, sortOrder]);

  const totals = useMemo(() => {
    const t = { totalCost: 0, totalRevenue: 0, totalUnits: 0, avgMargin: 0 };
    for (const e of rtsFinanceEntries) {
      t.totalCost += e.total_cost;
      t.totalRevenue += e.retail_price * e.qty;
      t.totalUnits += e.qty;
    }
    t.avgMargin = t.totalRevenue > 0 ? ((t.totalRevenue - t.totalCost) / t.totalRevenue) * 100 : 0;
    return t;
  }, [rtsFinanceEntries]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RTS Finance"
        subtitle="Production cost tracking for ready-to-ship products — material, labor, packaging costs and margin analysis"
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Production Cost</p>
          <p className="text-xl font-mono font-bold text-gold mt-1">AED {totals.totalCost.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Projected Revenue</p>
          <p className="text-xl font-mono font-bold text-emerald-500 mt-1">AED {totals.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Units</p>
          <p className="text-xl font-mono font-bold mt-1">{totals.totalUnits}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Avg. Margin</p>
          <p className="text-xl font-mono font-bold text-info mt-1">{totals.avgMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, batch, or SKU..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <button
          onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" /> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* RTS Finance Table */}
      <SectionCard title="RTS Production Finance" subtitle={`${filteredEntries.length} production batches tracked`}>
        <div className="overflow-x-auto -m-4">
          <table className="w-full ops-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Date</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Batch</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Product</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Qty</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Material</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Labor</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Packaging</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Total Cost</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Unit Cost</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Retail</th>
                <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Margin</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(e => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">
                    {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{e.batch_id}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{e.product_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{e.product_sku} · {e.category}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">{e.qty}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">AED {e.material_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">AED {e.labor_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">AED {e.packaging_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-sm font-mono font-bold text-gold text-right">AED {e.total_cost.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">AED {e.unit_cost}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">AED {e.retail_price}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right">
                    <span className={cn(
                      'font-bold',
                      e.margin_pct >= 50 ? 'text-emerald-500' : e.margin_pct >= 30 ? 'text-amber-500' : 'text-red-500'
                    )}>
                      {e.margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={
                      e.status === 'completed' ? 'success' :
                      e.status === 'in_production' ? 'gold' : 'default'
                    }>
                      {e.status === 'completed' ? 'COMPLETED' : e.status === 'in_production' ? 'IN PRODUCTION' : 'QUEUED'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEntries.length === 0 && (
          <div className="text-center py-10">
            <Box className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No RTS finance entries yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Production batch costs will appear here</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
