// ============================================================
// Inventory Cost Report — Financial tracking for COGS
// Shows total cost of goods across sealed vault, decanting pool,
// and per-perfume breakdown with sortable columns.
// ============================================================

import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, Package, Droplets, ArrowUpDown,
  ArrowUp, ArrowDown, Download, BarChart3, PieChart,
  Box, AlertTriangle, FileText, PackageOpen, Layers,
} from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { InventoryBottle, DecantBottle, Perfume, PackagingSKU } from '@/types';

type CostScope = 'all' | 'perfumes' | 'packaging';

// ---- Types ----
interface PerfumeCostRow {
  master_id: string;
  perfume_name: string;
  brand: string;
  sealed_bottles: number;
  sealed_cost: number;
  sealed_ml: number;
  decant_bottles: number;
  decant_remaining_ml: number;
  decant_total_ml: number;
  decant_cost: number;
  total_cost: number;
  total_ml: number;
  cost_per_ml: number;
  utilization: number; // % of decant ml remaining vs original
}

type SortField = 'perfume_name' | 'brand' | 'total_cost' | 'sealed_cost' | 'decant_cost' | 'total_ml' | 'cost_per_ml' | 'utilization';
type SortDir = 'asc' | 'desc';

// ---- Helpers ----
function fmtAED(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtML(n: number): string {
  return `${n.toLocaleString('en-AE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ml`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ---- Component ----
export default function InventoryCostReport() {
  const [view, setView] = useState<'summary' | 'detail'>('summary');
  const [sortField, setSortField] = useState<SortField>('total_cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scope, setScope] = useState<CostScope>('all');

  // Fetch data
  const { data: sealedRes, isLoading: loadingSealed } = useApiQuery(
    () => api.inventory.sealedBottles(), []
  );
  const { data: decantRes, isLoading: loadingDecant } = useApiQuery(
    () => api.inventory.decantBottles(), []
  );
  const { data: perfumeRes, isLoading: loadingPerfumes } = useApiQuery(
    () => api.master.perfumes(), []
  );
  const { data: pkgSkuRes, isLoading: loadingPkgSkus } = useApiQuery(
    () => api.inventory.packaging(), []
  );

  const isLoading = loadingSealed || loadingDecant || loadingPerfumes || loadingPkgSkus;

  const sealed: InventoryBottle[] = sealedRes ?? [];
  const decant: DecantBottle[] = decantRes ?? [];
  const perfumes: Perfume[] = perfumeRes ?? [];
  const pkgSkus: PackagingSKU[] = Array.isArray(pkgSkuRes) ? pkgSkuRes : (pkgSkuRes as any)?.data ?? [];

  // Packaging inventory value
  const packagingValue = useMemo(() => {
    return pkgSkus.reduce((sum, sku) => sum + (sku.qty_on_hand * sku.unit_cost), 0);
  }, [pkgSkus]);
  const packagingSkuCount = pkgSkus.length;
  const packagingTotalUnits = useMemo(() => pkgSkus.reduce((s, sku) => s + sku.qty_on_hand, 0), [pkgSkus]);

  // Build perfume lookup
  const perfumeMap = useMemo(() => {
    const m = new Map<string, Perfume>();
    perfumes.forEach(p => m.set(p.master_id, p));
    return m;
  }, [perfumes]);

  // ---- Aggregate per-perfume cost rows ----
  const perfumeCostRows = useMemo<PerfumeCostRow[]>(() => {
    const map = new Map<string, PerfumeCostRow>();

    const getRow = (masterId: string): PerfumeCostRow => {
      if (!map.has(masterId)) {
        const p = perfumeMap.get(masterId);
        map.set(masterId, {
          master_id: masterId,
          perfume_name: p?.name ?? masterId,
          brand: p?.brand ?? '—',
          sealed_bottles: 0,
          sealed_cost: 0,
          sealed_ml: 0,
          decant_bottles: 0,
          decant_remaining_ml: 0,
          decant_total_ml: 0,
          decant_cost: 0,
          total_cost: 0,
          total_ml: 0,
          cost_per_ml: 0,
          utilization: 0,
        });
      }
      return map.get(masterId)!;
    };

    // Sealed bottles
    sealed.forEach(b => {
      const row = getRow(b.master_id);
      const price = b.purchase_price ?? 0;
      row.sealed_bottles += 1;
      row.sealed_cost += price;
      row.sealed_ml += b.size_ml;
    });

    // Decant bottles — cost is derived from perfume wholesale price per ml * remaining ml
    decant.forEach(b => {
      const row = getRow(b.master_id);
      const p = perfumeMap.get(b.master_id);
      // Use wholesale price per ml if available, else retail / reference size
      let costPerMl = 0;
      if (p) {
        if (p.wholesale_price && p.reference_size_ml) {
          costPerMl = p.wholesale_price / p.reference_size_ml;
        } else if (p.price_per_ml) {
          costPerMl = p.price_per_ml;
        }
      }
      const remainingCost = costPerMl * b.current_ml;
      row.decant_bottles += 1;
      row.decant_remaining_ml += b.current_ml;
      row.decant_total_ml += b.size_ml;
      row.decant_cost += remainingCost;
    });

    // Compute totals
    map.forEach(row => {
      row.total_cost = row.sealed_cost + row.decant_cost;
      row.total_ml = row.sealed_ml + row.decant_remaining_ml;
      row.cost_per_ml = row.total_ml > 0 ? row.total_cost / row.total_ml : 0;
      row.utilization = row.decant_total_ml > 0 ? row.decant_remaining_ml / row.decant_total_ml : 1;
    });

    return Array.from(map.values());
  }, [sealed, decant, perfumeMap]);

  // ---- Summary stats ----
  const summary = useMemo(() => {
    const totalSealedCost = perfumeCostRows.reduce((s, r) => s + r.sealed_cost, 0);
    const totalDecantCost = perfumeCostRows.reduce((s, r) => s + r.decant_cost, 0);
    const totalCost = totalSealedCost + totalDecantCost;
    const totalSealedBottles = sealed.length;
    const totalDecantBottles = decant.length;
    const totalSealedMl = perfumeCostRows.reduce((s, r) => s + r.sealed_ml, 0);
    const totalDecantRemainingMl = perfumeCostRows.reduce((s, r) => s + r.decant_remaining_ml, 0);
    const totalDecantOriginalMl = perfumeCostRows.reduce((s, r) => s + r.decant_total_ml, 0);
    const avgCostPerMl = (totalSealedMl + totalDecantRemainingMl) > 0
      ? totalCost / (totalSealedMl + totalDecantRemainingMl)
      : 0;
    const decantUtilization = totalDecantOriginalMl > 0
      ? totalDecantRemainingMl / totalDecantOriginalMl
      : 1;
    const uniquePerfumes = perfumeCostRows.length;
    const topPerfume = [...perfumeCostRows].sort((a, b) => b.total_cost - a.total_cost)[0];

    return {
      totalCost, totalSealedCost, totalDecantCost,
      totalSealedBottles, totalDecantBottles,
      totalSealedMl, totalDecantRemainingMl, totalDecantOriginalMl,
      avgCostPerMl, decantUtilization, uniquePerfumes, topPerfume,
    };
  }, [perfumeCostRows, sealed, decant]);

  // ---- Sort ----
  const sortedRows = useMemo(() => {
    const rows = [...perfumeCostRows];
    rows.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [perfumeCostRows, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-gold" />
      : <ArrowDown className="w-3.5 h-3.5 text-gold" />;
  };

  // ---- CSV Export ----
  const handleExport = useCallback(() => {
    const headers = [
      'Master ID', 'Perfume', 'Brand',
      'Sealed Bottles', 'Sealed Cost (AED)', 'Sealed ML',
      'Decant Bottles', 'Decant Remaining ML', 'Decant Original ML', 'Decant Cost (AED)',
      'Total Cost (AED)', 'Total ML', 'Cost/ML (AED)', 'Utilization %',
    ];
    const csvRows = [headers.join(',')];
    sortedRows.forEach(r => {
      csvRows.push([
        r.master_id,
        `"${r.perfume_name}"`,
        `"${r.brand}"`,
        r.sealed_bottles,
        r.sealed_cost.toFixed(2),
        r.sealed_ml.toFixed(1),
        r.decant_bottles,
        r.decant_remaining_ml.toFixed(1),
        r.decant_total_ml.toFixed(1),
        r.decant_cost.toFixed(2),
        r.total_cost.toFixed(2),
        r.total_ml.toFixed(1),
        r.cost_per_ml.toFixed(2),
        (r.utilization * 100).toFixed(1),
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-cost-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedRows]);

  // ---- Donut chart data for cost split ----
  const costSplit = useMemo(() => {
    const total = summary.totalCost || 1;
    return {
      sealedPct: summary.totalSealedCost / total,
      decantPct: summary.totalDecantCost / total,
    };
  }, [summary]);

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-muted/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-muted/20 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (perfumeCostRows.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title="Inventory Cost Report" subtitle="Financial tracking for cost of goods" />
        <EmptyState
          icon={FileText}
          title="No inventory data"
          description="Add bottles through Stock Register to see cost calculations here."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inventory Cost Report"
        subtitle="Financial tracking — cost of goods across all inventory pools"
        actions={
          <div className="flex items-center gap-3">
            <Tabs value={scope} onValueChange={(v) => setScope(v as CostScope)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> All
                </TabsTrigger>
                <TabsTrigger value="perfumes" className="text-xs gap-1.5">
                  <Droplets className="w-3.5 h-3.5" /> Perfumes
                </TabsTrigger>
                <TabsTrigger value="packaging" className="text-xs gap-1.5">
                  <PackageOpen className="w-3.5 h-3.5" /> Packaging
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {scope !== 'packaging' && (
              <Tabs value={view} onValueChange={(v) => setView(v as 'summary' | 'detail')}>
                <TabsList className="h-9">
                  <TabsTrigger value="summary" className="text-xs gap-1.5">
                    <PieChart className="w-3.5 h-3.5" /> Summary
                  </TabsTrigger>
                  <TabsTrigger value="detail" className="text-xs gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" /> Detail
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* ---- KPI Cards ---- */}
      {scope === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            icon={DollarSign}
            label="Total Inventory Value"
            value={fmtAED(summary.totalCost + packagingValue)}
            sub={`${summary.uniquePerfumes} perfumes · ${packagingSkuCount} packaging SKUs`}
            accent="gold"
          />
          <KPICard
            icon={Box}
            label="Sealed Vault COGS"
            value={fmtAED(summary.totalSealedCost)}
            sub={`${summary.totalSealedBottles} bottles · ${fmtML(summary.totalSealedMl)}`}
            accent="blue"
          />
          <KPICard
            icon={Droplets}
            label="Decanting Pool COGS"
            value={fmtAED(summary.totalDecantCost)}
            sub={`${summary.totalDecantBottles} bottles · ${fmtML(summary.totalDecantRemainingMl)} remaining`}
            accent="emerald"
          />
          <KPICard
            icon={PackageOpen}
            label="Packaging Value"
            value={fmtAED(packagingValue)}
            sub={`${packagingSkuCount} SKUs · ${packagingTotalUnits.toLocaleString()} units`}
            accent="amber"
          />
          <KPICard
            icon={TrendingUp}
            label="Avg Cost / ML"
            value={fmtAED(summary.avgCostPerMl)}
            sub={`Decant utilization: ${pct(summary.decantUtilization)}`}
            accent="gold"
          />
        </div>
      )}
      {scope === 'perfumes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={DollarSign}
            label="Perfume Inventory Value"
            value={fmtAED(summary.totalCost)}
            sub={`${summary.uniquePerfumes} perfumes`}
            accent="gold"
          />
          <KPICard
            icon={Box}
            label="Sealed Vault COGS"
            value={fmtAED(summary.totalSealedCost)}
            sub={`${summary.totalSealedBottles} bottles · ${fmtML(summary.totalSealedMl)}`}
            accent="blue"
          />
          <KPICard
            icon={Droplets}
            label="Decanting Pool COGS"
            value={fmtAED(summary.totalDecantCost)}
            sub={`${summary.totalDecantBottles} bottles · ${fmtML(summary.totalDecantRemainingMl)} remaining`}
            accent="emerald"
          />
          <KPICard
            icon={TrendingUp}
            label="Avg Cost / ML"
            value={fmtAED(summary.avgCostPerMl)}
            sub={`Decant utilization: ${pct(summary.decantUtilization)}`}
            accent="amber"
          />
        </div>
      )}
      {scope === 'packaging' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={PackageOpen}
            label="Packaging Inventory Value"
            value={fmtAED(packagingValue)}
            sub={`${packagingSkuCount} SKUs`}
            accent="gold"
          />
          <KPICard
            icon={Package}
            label="Total Units on Hand"
            value={packagingTotalUnits.toLocaleString()}
            sub={`Across ${packagingSkuCount} SKUs`}
            accent="blue"
          />
          <KPICard
            icon={AlertTriangle}
            label="Low Stock SKUs"
            value={String(pkgSkus.filter(s => s.qty_on_hand <= s.min_stock_level).length)}
            sub="Below reorder threshold"
            accent="amber"
          />
          <KPICard
            icon={TrendingUp}
            label="Avg Unit Cost"
            value={fmtAED(packagingTotalUnits > 0 ? packagingValue / packagingTotalUnits : 0)}
            sub="Across all packaging"
            accent="emerald"
          />
        </div>
      )}

      {/* ---- Packaging Scope: Category Breakdown ---- */}
      {scope === 'packaging' && (
        <SectionCard title="Packaging Cost by Category" subtitle="Value breakdown by packaging type">
          <div className="space-y-3">
            {(() => {
              const catMap = new Map<string, { value: number; units: number; skus: number }>();
              pkgSkus.forEach(sku => {
                const cat = sku.category || 'Other';
                const existing = catMap.get(cat) || { value: 0, units: 0, skus: 0 };
                existing.value += sku.qty_on_hand * sku.unit_cost;
                existing.units += sku.qty_on_hand;
                existing.skus += 1;
                catMap.set(cat, existing);
              });
              const sorted = Array.from(catMap.entries()).sort((a, b) => b[1].value - a[1].value);
              const maxVal = sorted[0]?.[1].value || 1;
              return sorted.map(([cat, data]) => (
                <div key={cat} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{cat}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{data.skus} SKUs · {data.units.toLocaleString()} units</span>
                      <span className="text-sm font-semibold tabular-nums">{fmtAED(data.value)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div className="h-full bg-gold/70 rounded-full transition-all" style={{ width: `${(data.value / maxVal) * 100}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </SectionCard>
      )}

      {/* ---- Packaging Scope: SKU Table ---- */}
      {scope === 'packaging' && (
        <SectionCard title="Packaging SKU Inventory" subtitle={`${pkgSkus.length} SKUs`}>
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">SKU</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">On Hand</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Unit Cost</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Total Value</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...pkgSkus].sort((a, b) => (b.qty_on_hand * b.unit_cost) - (a.qty_on_hand * a.unit_cost)).map(sku => {
                  const val = sku.qty_on_hand * sku.unit_cost;
                  const isLow = sku.qty_on_hand <= sku.min_stock_level;
                  return (
                    <tr key={sku.sku_id} className={cn('border-b border-muted/30 hover:bg-muted/10 transition-colors', isLow && 'bg-red-50/50 dark:bg-red-950/10')}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sku.sku_id}</td>
                      <td className="px-4 py-3 font-medium">{sku.name}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{sku.category}</Badge></td>
                      <td className="px-4 py-3 text-right tabular-nums">{sku.qty_on_hand.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtAED(sku.unit_cost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtAED(val)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={isLow ? 'destructive' : 'outline'} className="text-xs">
                          {isLow ? 'Low Stock' : 'OK'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 bg-muted/10 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{packagingTotalUnits.toLocaleString()}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right tabular-nums text-gold">{fmtAED(packagingValue)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ---- Summary View (Perfumes scope) ---- */}
      {scope !== 'packaging' && view === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cost Distribution */}
          <SectionCard title="Cost Distribution" subtitle="Sealed vs Decanting pool" className="lg:col-span-1">
            <div className="flex flex-col items-center py-4">
              <div className="relative w-44 h-44 mb-6">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor"
                    className="text-muted/20" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9155" fill="none"
                    className="text-blue-500" strokeWidth="3"
                    strokeDasharray={`${costSplit.sealedPct * 100} ${100 - costSplit.sealedPct * 100}`}
                    strokeDashoffset="0" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="15.9155" fill="none"
                    className="text-emerald-500" strokeWidth="3"
                    strokeDasharray={`${costSplit.decantPct * 100} ${100 - costSplit.decantPct * 100}`}
                    strokeDashoffset={`${-(costSplit.sealedPct * 100)}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{fmtAED(summary.totalCost)}</span>
                  <span className="text-xs text-muted-foreground">Total COGS</span>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div>
                    <div className="text-xs text-muted-foreground">Sealed</div>
                    <div className="text-sm font-semibold">{pct(costSplit.sealedPct)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-xs text-muted-foreground">Decanting</div>
                    <div className="text-sm font-semibold">{pct(costSplit.decantPct)}</div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Top Perfumes by Cost */}
          <SectionCard title="Top Perfumes by Cost" subtitle="Highest value inventory items" className="lg:col-span-2">
            <div className="space-y-3">
              {[...perfumeCostRows]
                .sort((a, b) => b.total_cost - a.total_cost)
                .slice(0, 8)
                .map((row, i) => {
                  const maxCost = perfumeCostRows.reduce((m, r) => Math.max(m, r.total_cost), 0) || 1;
                  const barWidth = (row.total_cost / maxCost) * 100;
                  return (
                    <div key={row.master_id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}</span>
                          <span className="text-sm font-medium truncate">{row.perfume_name}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">· {row.brand}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums ml-2 shrink-0">{fmtAED(row.total_cost)}</span>
                      </div>
                      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted/30">
                        {row.sealed_cost > 0 && (
                          <div
                            className="h-full bg-blue-500 rounded-l-full transition-all"
                            style={{ width: `${(row.sealed_cost / row.total_cost) * barWidth}%` }}
                          />
                        )}
                        {row.decant_cost > 0 && (
                          <div
                            className="h-full bg-emerald-500 rounded-r-full transition-all"
                            style={{ width: `${(row.decant_cost / row.total_cost) * barWidth}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ---- Decant Utilization Overview (Summary) ---- */}
      {scope !== 'packaging' && view === 'summary' && (
        <SectionCard title="Decanting Pool Utilization" subtitle="Remaining liquid as % of original volume per perfume">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...perfumeCostRows]
              .filter(r => r.decant_bottles > 0)
              .sort((a, b) => a.utilization - b.utilization)
              .map(row => (
                <div key={row.master_id} className="border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium truncate pr-2">{row.perfume_name}</span>
                    <Badge variant={row.utilization < 0.2 ? 'destructive' : row.utilization < 0.5 ? 'secondary' : 'outline'}
                      className="text-xs shrink-0">
                      {pct(row.utilization)}
                    </Badge>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mb-2">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        row.utilization < 0.2 ? 'bg-red-500' :
                        row.utilization < 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${row.utilization * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmtML(row.decant_remaining_ml)} left</span>
                    <span>{row.decant_bottles} bottle{row.decant_bottles !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
          </div>
          {perfumeCostRows.filter(r => r.decant_bottles > 0).length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No decanting bottles in inventory yet.
            </div>
          )}
        </SectionCard>
      )}

      {/* ---- Detail Table (Perfumes scope) ---- */}
      {scope !== 'packaging' && view === 'detail' && (
        <SectionCard title="Per-Perfume Cost Breakdown" subtitle={`${sortedRows.length} perfumes in inventory`}>
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <SortHeader field="perfume_name" label="Perfume" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                  <SortHeader field="brand" label="Brand" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Sealed</th>
                  <SortHeader field="sealed_cost" label="Sealed COGS" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Decant</th>
                  <SortHeader field="decant_cost" label="Decant COGS" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortHeader field="total_cost" label="Total COGS" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                  <SortHeader field="total_ml" label="Total ML" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-right hidden lg:table-cell" />
                  <SortHeader field="cost_per_ml" label="Cost/ML" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-right hidden lg:table-cell" />
                  <SortHeader field="utilization" label="Util %" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="text-right hidden xl:table-cell" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr key={row.master_id} className="border-b border-muted/30 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.perfume_name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{row.brand}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{row.brand}</td>
                    <td className="px-4 py-3 text-center">
                      {row.sealed_bottles > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {row.sealed_bottles} × {row.sealed_ml > 0 ? Math.round(row.sealed_ml / row.sealed_bottles) : 0}ml
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {row.sealed_cost > 0 ? fmtAED(row.sealed_cost) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.decant_bottles > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {row.decant_bottles} btl · {fmtML(row.decant_remaining_ml)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {row.decant_cost > 0 ? fmtAED(row.decant_cost) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">
                      {fmtAED(row.total_cost)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                      {fmtML(row.total_ml)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                      {row.cost_per_ml > 0 ? fmtAED(row.cost_per_ml) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right hidden xl:table-cell">
                      {row.decant_bottles > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                row.utilization < 0.2 ? 'bg-red-500' :
                                row.utilization < 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                              )}
                              style={{ width: `${row.utilization * 100}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">{pct(row.utilization)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/20 bg-muted/10 font-semibold">
                  <td className="px-4 py-3">Totals</td>
                  <td className="px-4 py-3 hidden md:table-cell">{summary.uniquePerfumes} perfumes</td>
                  <td className="px-4 py-3 text-center">{summary.totalSealedBottles} btl</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtAED(summary.totalSealedCost)}</td>
                  <td className="px-4 py-3 text-center">{summary.totalDecantBottles} btl</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtAED(summary.totalDecantCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gold">{fmtAED(summary.totalCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                    {fmtML(summary.totalSealedMl + summary.totalDecantRemainingMl)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                    {fmtAED(summary.avgCostPerMl)}
                  </td>
                  <td className="px-4 py-3 text-right hidden xl:table-cell">
                    {pct(summary.decantUtilization)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ---- Alerts for cost anomalies ---- */}
      {scope !== 'packaging' && perfumeCostRows.some(r => r.decant_bottles > 0 && r.utilization < 0.15) && (
        <SectionCard title="Cost Alerts" subtitle="Items requiring attention">
          <div className="space-y-2">
            {perfumeCostRows
              .filter(r => r.decant_bottles > 0 && r.utilization < 0.15)
              .sort((a, b) => a.utilization - b.utilization)
              .map(row => (
                <div key={row.master_id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{row.perfume_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      Only {fmtML(row.decant_remaining_ml)} remaining ({pct(row.utilization)}) — COGS at risk: {fmtAED(row.decant_cost)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ---- Sub-components ----

function KPICard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: 'gold' | 'blue' | 'emerald' | 'amber';
}) {
  const colors = {
    gold: 'bg-gold/10 text-gold',
    blue: 'bg-blue-500/10 text-blue-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
  };
  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors[accent])}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground mb-0.5">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function SortHeader({ field, label, sortField, sortDir, onSort, className }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <th
      className={cn('px-4 py-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors', className)}
      onClick={() => onSort(field)}
    >
      <div className={cn('flex items-center gap-1', className?.includes('text-right') ? 'justify-end' : '')}>
        {label}
        {isActive
          ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-gold" /> : <ArrowDown className="w-3.5 h-3.5 text-gold" />)
          : <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />
        }
      </div>
    </th>
  );
}
