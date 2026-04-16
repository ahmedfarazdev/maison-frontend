// ============================================================
// Unified Procurement Report — Combined perfume + packaging COGS
// Merges all PO data for a total cost-of-goods breakdown
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown, Package, PackageOpen,
  BarChart3, Layers, ShoppingCart, Users, Droplets,
  ArrowUpDown, ArrowUp, ArrowDown, Download, Box,
  PieChart as PieChartIcon, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line,
} from 'recharts';
import { Button } from '@/components/ui/button';
import type { PackagingSKU, InventoryBottle, DecantBottle, Perfume } from '@/types';

// ---- Constants ----
const PERFUME_COLOR = '#c8a951'; // gold
const PACKAGING_COLOR = '#3b82f6'; // blue
const INVENTORY_COLOR = '#10b981'; // emerald

type TimeRange = 'all' | '6m' | '3m' | '1m';
type SupplierSortField = 'supplier' | 'type' | 'total_spent' | 'orders' | 'avg_order';

interface SupplierRow {
  supplier: string;
  type: 'perfume' | 'packaging' | 'both';
  perfumeSpend: number;
  packagingSpend: number;
  total_spent: number;
  perfumeOrders: number;
  packagingOrders: number;
  orders: number;
  avg_order: number;
}
type SortDir = 'asc' | 'desc';

// ---- Helpers ----
function fmtAED(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAEDShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(1)}K`;
  return `AED ${n.toFixed(0)}`;
}

function pctStr(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

// ---- Component ----
export default function UnifiedProcurementReport() {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [supplierSort, setSupplierSort] = useState<SupplierSortField>('total_spent');
  const [supplierDir, setSupplierDir] = useState<SortDir>('desc');

  // ---- Fetch all data sources ----
  // Perfume POs (already include items)
  const { data: perfumePOsRaw, isLoading: loadingPerfumePOs } = useApiQuery(
    () => api.purchaseOrders.list(), []
  );
  // Packaging POs (include items)
  const { data: pkgPOsRaw, isLoading: loadingPkgPOs } = useApiQuery<any[]>(
    () => api.mutations.packagingPOs.list(), []
  );
  // Packaging SKUs (for inventory value)
  const { data: skusRes, isLoading: loadingSKUs } = useApiQuery(
    () => api.master.packagingSKUs(), []
  );
  // Sealed bottles (for perfume inventory COGS)
  const { data: sealedRes, isLoading: loadingSealed } = useApiQuery(
    () => api.inventory.sealedBottles(), []
  );
  // Decant bottles (for perfume inventory COGS)
  const { data: decantRes, isLoading: loadingDecant } = useApiQuery(
    () => api.inventory.decantBottles(), []
  );
  // Perfumes (for cost-per-ml lookup)
  const { data: perfumeRes, isLoading: loadingPerfumes } = useApiQuery(
    () => api.master.perfumes(), []
  );

  const isLoading = loadingPerfumePOs || loadingPkgPOs || loadingSKUs || loadingSealed || loadingDecant || loadingPerfumes;

  // ---- Normalize data ----
  const perfumePOs = useMemo(() => {
    const raw = (perfumePOsRaw as any)?.data ?? perfumePOsRaw ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [perfumePOsRaw]);

  const packagingPOs = useMemo(() => {
    if (!pkgPOsRaw || !Array.isArray(pkgPOsRaw)) return [];
    return pkgPOsRaw;
  }, [pkgPOsRaw]);

  const pkgSkus: PackagingSKU[] = useMemo(() => {
    return (skusRes as any)?.data || [];
  }, [skusRes]);

  const sealed: InventoryBottle[] = useMemo(() => (sealedRes as any)?.data ?? [], [sealedRes]);
  const decant: DecantBottle[] = useMemo(() => (decantRes as any)?.data ?? [], [decantRes]);
  const perfumes: Perfume[] = useMemo(() => (perfumeRes as any)?.data ?? [], [perfumeRes]);

  // Perfume lookup for cost-per-ml
  const perfumeMap = useMemo(() => {
    const m = new Map<string, Perfume>();
    perfumes.forEach(p => m.set(p.master_id, p));
    return m;
  }, [perfumes]);

  // ---- Time filter ----
  function filterByTime<T extends Record<string, any>>(items: T[]): T[] {
    if (timeRange === 'all') return items;
    const now = new Date();
    const months = timeRange === '6m' ? 6 : timeRange === '3m' ? 3 : 1;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return items.filter(item => {
      const d = new Date(item.confirmedAt || item.createdAt);
      return d >= cutoff;
    });
  }

  const filteredPerfumePOs = useMemo(() => filterByTime(perfumePOs), [perfumePOs, timeRange]);
  const filteredPkgPOs = useMemo(() => filterByTime(packagingPOs), [packagingPOs, timeRange]);

  const confirmedPerfumePOs = useMemo(() => filteredPerfumePOs.filter((po: any) => po.status === 'confirmed'), [filteredPerfumePOs]);
  const confirmedPkgPOs = useMemo(() => filteredPkgPOs.filter((po: any) => po.status === 'confirmed'), [filteredPkgPOs]);

  // ---- Spend calculations ----
  const perfumeSpend = useMemo(() =>
    confirmedPerfumePOs.reduce((s: number, po: any) => s + Number(po.totalAmount || 0), 0),
    [confirmedPerfumePOs]
  );

  const packagingSpend = useMemo(() =>
    confirmedPkgPOs.reduce((s: number, po: any) => s + Number(po.totalAmount || 0), 0),
    [confirmedPkgPOs]
  );

  const totalSpend = perfumeSpend + packagingSpend;
  const totalConfirmedOrders = confirmedPerfumePOs.length + confirmedPkgPOs.length;
  const activePerfumePOs = filteredPerfumePOs.filter((po: any) =>
    ['pending_quote', 'quote_approved', 'pending_delivery', 'delivered'].includes(po.status)
  ).length;
  const activePkgPOs = filteredPkgPOs.filter((po: any) =>
    ['pending_quote', 'quote_approved', 'pending_delivery', 'delivered'].includes(po.status)
  ).length;
  const totalActivePOs = activePerfumePOs + activePkgPOs;

  // ---- Inventory COGS ----
  // Perfume inventory value (sealed + decant remaining)
  const perfumeInventoryValue = useMemo(() => {
    let sealedCost = 0;
    sealed.forEach(b => { sealedCost += b.purchase_price ?? 0; });

    let decantCost = 0;
    decant.forEach(b => {
      const p = perfumeMap.get(b.master_id);
      let costPerMl = 0;
      if (p) {
        if (p.wholesale_price && p.reference_size_ml) {
          costPerMl = p.wholesale_price / p.reference_size_ml;
        } else if (p.price_per_ml) {
          costPerMl = p.price_per_ml;
        }
      }
      decantCost += costPerMl * b.current_ml;
    });

    return sealedCost + decantCost;
  }, [sealed, decant, perfumeMap]);

  // Packaging inventory value
  const packagingInventoryValue = useMemo(() => {
    return pkgSkus.reduce((sum, s) => sum + (s.qty_on_hand * s.unit_cost), 0);
  }, [pkgSkus]);

  const totalInventoryValue = perfumeInventoryValue + packagingInventoryValue;

  // ---- Previous period comparison ----
  const prevPeriodData = useMemo(() => {
    if (timeRange === 'all') return null;
    const now = new Date();
    const months = timeRange === '6m' ? 6 : timeRange === '3m' ? 3 : 1;
    const periodStart = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    const prevStart = new Date(now.getFullYear(), now.getMonth() - months * 2, now.getDate());

    const prevPerfume = perfumePOs.filter((po: any) => {
      if (po.status !== 'confirmed') return false;
      const d = new Date(po.confirmedAt || po.createdAt);
      return d >= prevStart && d < periodStart;
    }).reduce((s: number, po: any) => s + Number(po.totalAmount || 0), 0);

    const prevPkg = packagingPOs.filter((po: any) => {
      if (po.status !== 'confirmed') return false;
      const d = new Date(po.confirmedAt || po.createdAt);
      return d >= prevStart && d < periodStart;
    }).reduce((s: number, po: any) => s + Number(po.totalAmount || 0), 0);

    return { perfume: prevPerfume, packaging: prevPkg, total: prevPerfume + prevPkg };
  }, [perfumePOs, packagingPOs, timeRange]);

  const totalTrend = prevPeriodData && prevPeriodData.total > 0
    ? ((totalSpend - prevPeriodData.total) / prevPeriodData.total * 100)
    : null;

  // ---- Donut chart: Perfume vs Packaging ----
  const splitData = useMemo(() => [
    { name: 'Perfume', value: perfumeSpend, color: PERFUME_COLOR },
    { name: 'Packaging', value: packagingSpend, color: PACKAGING_COLOR },
  ].filter(d => d.value > 0), [perfumeSpend, packagingSpend]);

  // ---- Inventory COGS donut ----
  const inventoryDonut = useMemo(() => [
    { name: 'Perfume Inventory', value: perfumeInventoryValue, color: PERFUME_COLOR },
    { name: 'Packaging Inventory', value: packagingInventoryValue, color: PACKAGING_COLOR },
  ].filter(d => d.value > 0), [perfumeInventoryValue, packagingInventoryValue]);

  // ---- Monthly combined trend ----
  const monthlyTrend = useMemo(() => {
    const monthMap: Record<string, { month: string; perfume: number; packaging: number; total: number }> = {};

    const processPos = (pos: any[], type: 'perfume' | 'packaging') => {
      pos.forEach((po: any) => {
        const d = new Date(po.confirmedAt || po.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthMap[key]) monthMap[key] = { month: label, perfume: 0, packaging: 0, total: 0 };
        const amt = Number(po.totalAmount || 0);
        monthMap[key][type] += amt;
        monthMap[key].total += amt;
      });
    };

    processPos(confirmedPerfumePOs, 'perfume');
    processPos(confirmedPkgPOs, 'packaging');

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [confirmedPerfumePOs, confirmedPkgPOs]);

  // ---- Cumulative spend ----
  const cumulativeTrend = useMemo(() => {
    let cumPerfume = 0;
    let cumPackaging = 0;
    return monthlyTrend.map(m => {
      cumPerfume += m.perfume;
      cumPackaging += m.packaging;
      return {
        month: m.month,
        perfume: cumPerfume,
        packaging: cumPackaging,
        total: cumPerfume + cumPackaging,
      };
    });
  }, [monthlyTrend]);

  // ---- Supplier breakdown (combined) ----
  const supplierData = useMemo(() => {
    const map: Record<string, {
      supplier: string; type: 'perfume' | 'packaging' | 'both';
      perfumeSpend: number; packagingSpend: number; total_spent: number;
      perfumeOrders: number; packagingOrders: number; orders: number;
    }> = {};

    confirmedPerfumePOs.forEach((po: any) => {
      const name = po.supplierName || 'Unknown';
      if (!map[name]) map[name] = { supplier: name, type: 'perfume', perfumeSpend: 0, packagingSpend: 0, total_spent: 0, perfumeOrders: 0, packagingOrders: 0, orders: 0 };
      map[name].perfumeSpend += Number(po.totalAmount || 0);
      map[name].total_spent += Number(po.totalAmount || 0);
      map[name].perfumeOrders += 1;
      map[name].orders += 1;
    });

    confirmedPkgPOs.forEach((po: any) => {
      const name = po.supplierName || 'Unknown';
      if (!map[name]) map[name] = { supplier: name, type: 'packaging', perfumeSpend: 0, packagingSpend: 0, total_spent: 0, perfumeOrders: 0, packagingOrders: 0, orders: 0 };
      map[name].packagingSpend += Number(po.totalAmount || 0);
      map[name].total_spent += Number(po.totalAmount || 0);
      map[name].packagingOrders += 1;
      map[name].orders += 1;
    });

    // Determine type
    Object.values(map).forEach(s => {
      if (s.perfumeSpend > 0 && s.packagingSpend > 0) s.type = 'both';
      else if (s.packagingSpend > 0) s.type = 'packaging';
      else s.type = 'perfume';
    });

    return Object.values(map).map(s => ({
      ...s,
      avg_order: s.orders > 0 ? s.total_spent / s.orders : 0,
    })) as SupplierRow[];
  }, [confirmedPerfumePOs, confirmedPkgPOs]);

  // Sort suppliers
  const sortedSuppliers = useMemo(() => {
    return [...supplierData].sort((a, b) => {
      const aVal = (a as Record<string, any>)[supplierSort];
      const bVal = (b as Record<string, any>)[supplierSort];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return supplierDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return supplierDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [supplierData, supplierSort, supplierDir]);

  const toggleSort = (field: SupplierSortField) => {
    if (supplierSort === field) setSupplierDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSupplierSort(field); setSupplierDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SupplierSortField }) => {
    if (supplierSort !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return supplierDir === 'asc' ? <ArrowUp className="w-3 h-3 text-gold" /> : <ArrowDown className="w-3 h-3 text-gold" />;
  };

  // ---- CSV Export ----
  const handleExportCSV = () => {
    const lines: string[] = [];
    lines.push('Unified Procurement Report');
    lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
    lines.push(`Time Range: ${timeRange === 'all' ? 'All Time' : timeRange}`);
    lines.push('');
    lines.push('Summary');
    lines.push(`Total Procurement Spend,${totalSpend.toFixed(2)}`);
    lines.push(`Perfume Spend,${perfumeSpend.toFixed(2)}`);
    lines.push(`Packaging Spend,${packagingSpend.toFixed(2)}`);
    lines.push(`Perfume Inventory Value,${perfumeInventoryValue.toFixed(2)}`);
    lines.push(`Packaging Inventory Value,${packagingInventoryValue.toFixed(2)}`);
    lines.push(`Total Inventory Value,${totalInventoryValue.toFixed(2)}`);
    lines.push('');
    lines.push('Supplier,Type,Perfume Spend,Packaging Spend,Total Spend,Perfume Orders,Packaging Orders,Total Orders,Avg Order');
    sortedSuppliers.forEach(s => {
      const avg = s.orders > 0 ? (s.total_spent / s.orders).toFixed(2) : '0';
      lines.push(`"${s.supplier}",${s.type},${s.perfumeSpend.toFixed(2)},${s.packagingSpend.toFixed(2)},${s.total_spent.toFixed(2)},${s.perfumeOrders},${s.packagingOrders},${s.orders},${avg}`);
    });
    lines.push('');
    lines.push('Month,Perfume Spend,Packaging Spend,Total');
    monthlyTrend.forEach(m => {
      lines.push(`${m.month},${m.perfume.toFixed(2)},${m.packaging.toFixed(2)},${m.total.toFixed(2)}`);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `unified-procurement-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ---- Recharts tooltips ----
  const BarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-bold">{fmtAED(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="font-mono text-gold font-bold">{fmtAED(d.value)}</p>
      </div>
    );
  };

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div>
        <PageHeader title="Unified Procurement Report" subtitle="Loading..." breadcrumbs={[{ label: 'Reports' }, { label: 'Procurement' }]} />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Unified Procurement Report"
        subtitle={`${totalConfirmedOrders} confirmed orders · ${fmtAEDShort(totalSpend)} total spend · ${fmtAEDShort(totalInventoryValue)} inventory`}
        breadcrumbs={[{ label: 'Reports' }, { label: 'Procurement' }]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              {([['all', 'All Time'], ['6m', '6 Months'], ['3m', '3 Months'], ['1m', '1 Month']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setTimeRange(val)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    timeRange === val ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* ---- KPI Strip ---- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Spend', value: fmtAED(totalSpend), icon: DollarSign, color: 'border-l-gold', trend: totalTrend },
            { label: 'Perfume Spend', value: fmtAED(perfumeSpend), icon: Droplets, color: 'border-l-amber-500', sub: pctStr(perfumeSpend, totalSpend) },
            { label: 'Packaging Spend', value: fmtAED(packagingSpend), icon: PackageOpen, color: 'border-l-blue-500', sub: pctStr(packagingSpend, totalSpend) },
            { label: 'Confirmed Orders', value: totalConfirmedOrders.toString(), icon: ShoppingCart, color: 'border-l-emerald-500', sub: `${confirmedPerfumePOs.length} perfume · ${confirmedPkgPOs.length} packaging` },
            { label: 'Active POs', value: totalActivePOs.toString(), icon: Activity, color: 'border-l-purple-500', sub: `${activePerfumePOs} perfume · ${activePkgPOs} packaging` },
            { label: 'Inventory COGS', value: fmtAED(totalInventoryValue), icon: Package, color: 'border-l-teal-500', sub: `Perfume ${fmtAEDShort(perfumeInventoryValue)} · Pkg ${fmtAEDShort(packagingInventoryValue)}` },
          ].map((kpi) => (
            <div key={kpi.label} className={cn('bg-card border border-border rounded-xl p-4 border-l-4', kpi.color)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{kpi.label}</span>
                <kpi.icon className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <p className="text-lg font-bold font-mono">{kpi.value}</p>
              {kpi.trend !== undefined && kpi.trend !== null && (
                <div className={cn('flex items-center gap-1 mt-1 text-[10px] font-medium',
                  kpi.trend >= 0 ? 'text-destructive' : 'text-emerald-600')}>
                  {kpi.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(kpi.trend).toFixed(1)}% vs prev period
                </div>
              )}
              {kpi.sub && (
                <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* ---- Side-by-side comparison cards ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Perfume Summary */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-500/5">
              <Droplets className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold">Perfume Procurement</h3>
                <p className="text-[10px] text-muted-foreground">Fragrance bottles and raw materials</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Spend</p>
                  <p className="text-xl font-bold font-mono" style={{ color: PERFUME_COLOR }}>{fmtAED(perfumeSpend)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inventory Value</p>
                  <p className="text-xl font-bold font-mono">{fmtAED(perfumeInventoryValue)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{confirmedPerfumePOs.length}</p>
                  <p className="text-[10px] text-muted-foreground">Confirmed</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{activePerfumePOs}</p>
                  <p className="text-[10px] text-muted-foreground">Active</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{sealed.length + decant.length}</p>
                  <p className="text-[10px] text-muted-foreground">Bottles</p>
                </div>
              </div>
              {/* Spend share bar */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Share of total spend</span>
                  <span className="font-mono font-bold">{pctStr(perfumeSpend, totalSpend)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: totalSpend > 0 ? `${(perfumeSpend / totalSpend) * 100}%` : '0%',
                    backgroundColor: PERFUME_COLOR,
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* Packaging Summary */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-blue-500/5">
              <PackageOpen className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-bold">Packaging Procurement</h3>
                <p className="text-[10px] text-muted-foreground">Atomizers, bottles, labels, boxes</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Spend</p>
                  <p className="text-xl font-bold font-mono" style={{ color: PACKAGING_COLOR }}>{fmtAED(packagingSpend)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inventory Value</p>
                  <p className="text-xl font-bold font-mono">{fmtAED(packagingInventoryValue)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{confirmedPkgPOs.length}</p>
                  <p className="text-[10px] text-muted-foreground">Confirmed</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{activePkgPOs}</p>
                  <p className="text-[10px] text-muted-foreground">Active</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{pkgSkus.length}</p>
                  <p className="text-[10px] text-muted-foreground">SKUs</p>
                </div>
              </div>
              {/* Spend share bar */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Share of total spend</span>
                  <span className="font-mono font-bold">{pctStr(packagingSpend, totalSpend)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: totalSpend > 0 ? `${(packagingSpend / totalSpend) * 100}%` : '0%',
                    backgroundColor: PACKAGING_COLOR,
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Charts Row: Spend Split + Inventory Split ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Procurement Spend Split */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <PieChartIcon className="w-4.5 h-4.5 text-gold" />
              <div>
                <h3 className="text-sm font-bold">Procurement Spend Split</h3>
                <p className="text-[10px] text-muted-foreground">Perfume vs packaging from confirmed POs</p>
              </div>
            </div>
            <div className="p-4">
              {splitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={splitData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {splitData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                    <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                  No confirmed POs yet
                </div>
              )}
            </div>
          </div>

          {/* Inventory COGS Split */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <Package className="w-4.5 h-4.5 text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold">Inventory COGS Split</h3>
                <p className="text-[10px] text-muted-foreground">Current on-hand value by type</p>
              </div>
            </div>
            <div className="p-4">
              {inventoryDonut.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={inventoryDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {inventoryDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                    <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
                  No inventory data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---- Monthly Stacked Bar Chart ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <BarChart3 className="w-4.5 h-4.5 text-gold" />
            <div>
              <h3 className="text-sm font-bold">Monthly Procurement Spend</h3>
              <p className="text-[10px] text-muted-foreground">Stacked perfume + packaging spend by month</p>
            </div>
          </div>
          <div className="p-4">
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyTrend} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => fmtAEDShort(v)} />
                  <Tooltip content={<BarTooltip />} />
                  <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  <Bar dataKey="perfume" name="Perfume" stackId="a" fill={PERFUME_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="packaging" name="Packaging" stackId="a" fill={PACKAGING_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                No monthly data available — confirm POs to see trends
              </div>
            )}
          </div>
        </div>

        {/* ---- Cumulative Spend Trend ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <TrendingUp className="w-4.5 h-4.5 text-emerald-500" />
            <div>
              <h3 className="text-sm font-bold">Cumulative Spend Trend</h3>
              <p className="text-[10px] text-muted-foreground">Running total of all procurement spend</p>
            </div>
          </div>
          <div className="p-4">
            {cumulativeTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cumulativeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => fmtAEDShort(v)} />
                  <Tooltip content={<BarTooltip />} />
                  <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  <Area type="monotone" dataKey="perfume" name="Perfume" stackId="1" stroke={PERFUME_COLOR} fill={PERFUME_COLOR} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="packaging" name="Packaging" stackId="1" stroke={PACKAGING_COLOR} fill={PACKAGING_COLOR} fillOpacity={0.3} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                No data available — confirm POs to see cumulative trend
              </div>
            )}
          </div>
        </div>

        {/* ---- Top Suppliers Table ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <Users className="w-4.5 h-4.5 text-gold" />
            <div>
              <h3 className="text-sm font-bold">Top Suppliers</h3>
              <p className="text-[10px] text-muted-foreground">Combined spend across perfume and packaging from confirmed POs</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            {sortedSuppliers.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    {[
                      { field: 'supplier' as const, label: 'SUPPLIER' },
                      { field: 'type' as const, label: 'TYPE' },
                      { field: 'total_spent' as const, label: 'TOTAL SPEND' },
                      { field: 'orders' as const, label: 'ORDERS' },
                      { field: 'avg_order' as const, label: 'AVG ORDER' },
                    ].map(col => (
                      <th key={col.field} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground"
                        onClick={() => toggleSort(col.field)}>
                        <div className="flex items-center gap-1">
                          {col.label} <SortIcon field={col.field} />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">BREAKDOWN</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">SHARE</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSuppliers.map((s, i) => {
                    const avg_order = s.orders > 0 ? s.total_spent / s.orders : 0;
                    const share = totalSpend > 0 ? (s.total_spent / totalSpend) * 100 : 0;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium">{s.supplier}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full',
                            s.type === 'perfume' ? 'bg-amber-500/10 text-amber-600' :
                            s.type === 'packaging' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-purple-500/10 text-purple-500'
                          )}>
                            {s.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">{fmtAED(s.total_spent)}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono">{s.orders}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({s.perfumeOrders}P / {s.packagingOrders}K)
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{fmtAED(avg_order)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 items-center">
                            {s.perfumeSpend > 0 && (
                              <div className="h-2 rounded-full" style={{
                                width: `${Math.max(4, (s.perfumeSpend / s.total_spent) * 80)}px`,
                                backgroundColor: PERFUME_COLOR,
                              }} />
                            )}
                            {s.packagingSpend > 0 && (
                              <div className="h-2 rounded-full" style={{
                                width: `${Math.max(4, (s.packagingSpend / s.total_spent) * 80)}px`,
                                backgroundColor: PACKAGING_COLOR,
                              }} />
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {s.perfumeSpend > 0 && <span style={{ color: PERFUME_COLOR }}>P: {fmtAEDShort(s.perfumeSpend)}</span>}
                            {s.perfumeSpend > 0 && s.packagingSpend > 0 && <span className="mx-1">·</span>}
                            {s.packagingSpend > 0 && <span style={{ color: PACKAGING_COLOR }}>K: {fmtAEDShort(s.packagingSpend)}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gold rounded-full" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-gold">{share.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                No supplier data available — confirm POs to see breakdown
              </div>
            )}
          </div>
        </div>

        {/* ---- COGS Summary Table ---- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
            <Layers className="w-4.5 h-4.5 text-gold" />
            <div>
              <h3 className="text-sm font-bold">COGS Summary</h3>
              <p className="text-[10px] text-muted-foreground">Total cost of goods — procurement spend + current inventory value</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CATEGORY</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">PROCUREMENT SPEND</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">INVENTORY VALUE</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">COMBINED COGS</th>
                  <th className="px-4 py-3 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">% OF TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const perfumeCombined = perfumeSpend + perfumeInventoryValue;
                  const packagingCombined = packagingSpend + packagingInventoryValue;
                  const grandTotal = perfumeCombined + packagingCombined;
                  return (
                    <>
                      <tr className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PERFUME_COLOR }} />
                            <span className="font-medium">Perfume</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmtAED(perfumeSpend)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtAED(perfumeInventoryValue)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{fmtAED(perfumeCombined)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gold font-bold">{pctStr(perfumeCombined, grandTotal)}</td>
                      </tr>
                      <tr className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PACKAGING_COLOR }} />
                            <span className="font-medium">Packaging</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmtAED(packagingSpend)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtAED(packagingInventoryValue)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{fmtAED(packagingCombined)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gold font-bold">{pctStr(packagingCombined, grandTotal)}</td>
                      </tr>
                      <tr className="bg-muted/30 font-bold">
                        <td className="px-4 py-3">
                          <span className="font-bold">Total COGS</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmtAED(totalSpend)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmtAED(totalInventoryValue)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gold text-lg">{fmtAED(grandTotal)}</td>
                        <td className="px-4 py-3 text-right font-mono text-gold">100%</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
