// ============================================================
// BOM Pricing & Margin Report
// Compares BOM cost vs selling price with multiplier analysis
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, KPICard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, Package, Layers,
  Search, Download, ArrowUpDown, AlertTriangle, CheckCircle2,
  Droplets, RotateCcw, Box, Sparkles, Settings2, BarChart2,
  Percent, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { endProducts, bomTemplates, bomComponents, shippingBOMs } from '@/lib/bom-data';
import type { EndProduct, EndProductCategory, BOMTemplate } from '@/types';
import { categoryConfig } from '@/lib/product-categories';

interface ProductMarginRow {
  product: EndProduct;
  bom: BOMTemplate | null;
  shippingBom: BOMTemplate | null;
  fixedCost: number;
  variableCost: number;
  shippingCost: number;
  bom_cost: number;
  selling_price: number;
  grossMargin: number;
  margin_percent: number;
  multiplier: number;
  status: 'healthy' | 'warning' | 'critical' | 'no_price' | 'no_bom';
}

type SortField = 'name' | 'bom_cost' | 'selling_price' | 'margin_percent' | 'multiplier';
type SortDir = 'asc' | 'desc';

export default function BOMPricingReport() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('margin_percent');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Build margin analysis data
  const rows: ProductMarginRow[] = useMemo(() => {
    return endProducts.map(product => {
      const bom = product.bom_id
        ? bomTemplates.find(b => b.bom_id === product.bom_id) || null
        : null;
      const shippingBom = product.shipping_bom_id
        ? shippingBOMs.find(b => b.bom_id === product.shipping_bom_id) || null
        : null;
      const fixedCost = bom?.total_cost || (product.fixed_price || 0);
      const variableCost = bom?.variable_cost || (product.variable_price || 0);
      const shippingCost = shippingBom?.total_cost || (product.shipping_cost || 0);
      const bom_cost = fixedCost + variableCost + shippingCost;
      const selling_price = product.selling_price || 0;
      const grossMargin = selling_price - bom_cost;
      const margin_percent = selling_price > 0 ? (grossMargin / selling_price) * 100 : 0;
      const multiplier = bom_cost > 0 ? selling_price / bom_cost : 0;

      let status: ProductMarginRow['status'] = 'healthy';
      if (!bom) status = 'no_bom';
      else if (selling_price <= 0) status = 'no_price';
      else if (margin_percent < 20) status = 'critical';
      else if (margin_percent < 40) status = 'warning';

      return { product, bom, shippingBom, fixedCost, variableCost, shippingCost, bom_cost, selling_price, grossMargin, margin_percent, multiplier, status };
    });
  }, []);

  const filtered = useMemo(() => {
    let result = rows.filter(r => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || r.product.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    result.sort((a, b) => {
      let aVal: number | string, bVal: number | string;
      switch (sortField) {
        case 'name': aVal = a.product.name; bVal = b.product.name; break;
        case 'bom_cost': aVal = a.bom_cost; bVal = b.bom_cost; break;
        case 'selling_price': aVal = a.selling_price; bVal = b.selling_price; break;
        case 'margin_percent': aVal = a.margin_percent; bVal = b.margin_percent; break;
        case 'multiplier': aVal = a.multiplier; bVal = b.multiplier; break;
        default: aVal = a.margin_percent; bVal = b.margin_percent;
      }
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [rows, search, categoryFilter, statusFilter, sortField, sortDir]);

  // KPI calculations
  const stats = useMemo(() => {
    const withPrice = rows.filter(r => r.status !== 'no_price' && r.status !== 'no_bom');
    const avgMargin = withPrice.length > 0
      ? withPrice.reduce((sum, r) => sum + r.margin_percent, 0) / withPrice.length
      : 0;
    const avgMultiplier = withPrice.length > 0
      ? withPrice.reduce((sum, r) => sum + r.multiplier, 0) / withPrice.length
      : 0;
    const totalBOMCost = rows.reduce((sum, r) => sum + r.bom_cost, 0);
    const totalRevenue = rows.reduce((sum, r) => sum + r.selling_price, 0);
    const criticalCount = rows.filter(r => r.status === 'critical').length;
    const warningCount = rows.filter(r => r.status === 'warning').length;

    return { avgMargin, avgMultiplier, totalBOMCost, totalRevenue, criticalCount, warningCount };
  }, [rows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExportCSV = () => {
    const csvRows = filtered.map(r => ({
      Product: r.product.name,
      SKU: r.product.sku,
      Category: categoryConfig[r.product.category]?.label || r.product.category,
      'Fixed Cost (AED)': r.fixedCost.toFixed(2),
      'Variable Cost (AED)': r.variableCost.toFixed(2),
      'Shipping Cost (AED)': r.shippingCost.toFixed(2),
      'Total BOM Cost (AED)': r.bom_cost.toFixed(2),
      'Selling Price (AED)': r.selling_price.toFixed(2),
      'Gross Margin (AED)': r.grossMargin.toFixed(2),
      'Margin %': r.margin_percent.toFixed(1),
      'Multiplier': r.multiplier.toFixed(2),
      Status: r.status,
    }));
    const headers = Object.keys(csvRows[0] || {}).join(',');
    const body = csvRows.map(r => Object.values(r).join(',')).join('\n');
    const csv = headers + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bom-pricing-margin-report.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const getStatusBadge = (status: ProductMarginRow['status']) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-success/10 text-success border-success/30 text-[10px]">Healthy</Badge>;
      case 'warning': return <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">Low Margin</Badge>;
      case 'critical': return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Critical</Badge>;
      case 'no_price': return <Badge variant="outline" className="text-[10px] text-muted-foreground">No Price</Badge>;
      case 'no_bom': return <Badge variant="outline" className="text-[10px] text-muted-foreground">No BOM</Badge>;
    }
  };

  const getMarginColor = (percent: number, status: string) => {
    if (status === 'no_price' || status === 'no_bom') return 'text-muted-foreground';
    if (percent >= 60) return 'text-success';
    if (percent >= 40) return 'text-emerald-500';
    if (percent >= 20) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="BOM Pricing & Margin Report"
        subtitle="Compare BOM cost vs selling price — identify margin health and pricing opportunities"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports' },
          { label: 'BOM Pricing & Margin' },
        ]}
        actions={
          <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KPICard
            label="Avg Margin"
            value={`${stats.avgMargin.toFixed(1)}%`}
            icon={Percent}
            variant={stats.avgMargin >= 40 ? 'success' : stats.avgMargin >= 20 ? 'warning' : 'destructive'}
          />
          <KPICard
            label="Avg Multiplier"
            value={`${stats.avgMultiplier.toFixed(2)}×`}
            icon={TrendingUp}
            variant="gold"
          />
          <KPICard
            label="Total BOM Cost"
            value={`AED ${stats.totalBOMCost.toFixed(0)}`}
            icon={Layers}
            variant="default"
          />
          <KPICard
            label="Total Revenue"
            value={`AED ${stats.totalRevenue.toFixed(0)}`}
            icon={DollarSign}
            variant="success"
          />
          <KPICard
            label="Critical Margin"
            value={stats.criticalCount}
            icon={AlertTriangle}
            variant={stats.criticalCount > 0 ? 'destructive' : 'default'}
          />
          <KPICard
            label="Low Margin"
            value={stats.warningCount}
            icon={TrendingDown}
            variant={stats.warningCount > 0 ? 'warning' : 'default'}
          />
        </div>

        {/* Margin Health Summary */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-info" />
              Margin Health Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 h-8 rounded-lg overflow-hidden">
              {(() => {
                const total = rows.length || 1;
                const healthy = rows.filter(r => r.status === 'healthy').length;
                const warning = rows.filter(r => r.status === 'warning').length;
                const critical = rows.filter(r => r.status === 'critical').length;
                const noData = rows.filter(r => r.status === 'no_price' || r.status === 'no_bom').length;
                return (
                  <>
                    {healthy > 0 && (
                      <div className="bg-success/80 flex items-center justify-center text-[10px] text-white font-semibold" style={{ width: `${(healthy / total) * 100}%` }}>
                        {healthy} Healthy
                      </div>
                    )}
                    {warning > 0 && (
                      <div className="bg-warning/80 flex items-center justify-center text-[10px] text-white font-semibold" style={{ width: `${(warning / total) * 100}%` }}>
                        {warning} Low
                      </div>
                    )}
                    {critical > 0 && (
                      <div className="bg-destructive/80 flex items-center justify-center text-[10px] text-white font-semibold" style={{ width: `${(critical / total) * 100}%` }}>
                        {critical} Critical
                      </div>
                    )}
                    {noData > 0 && (
                      <div className="bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-semibold" style={{ width: `${(noData / total) * 100}%` }}>
                        {noData} No Data
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Healthy (≥40%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Low (20–40%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Critical (&lt;20%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted" /> No Data</span>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search products or SKUs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Low Margin</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="no_price">No Price</SelectItem>
              <SelectItem value="no_bom">No BOM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data Table */}
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  {[
                    { field: 'name' as SortField, label: 'Product', width: 'min-w-[200px]' },
                    { field: null, label: 'Category', width: 'min-w-[120px]' },
                    { field: null, label: 'Fixed', width: 'min-w-[70px]' },
                    { field: null, label: 'Variable', width: 'min-w-[70px]' },
                    { field: null, label: 'Shipping', width: 'min-w-[70px]' },
                    { field: 'bom_cost' as SortField, label: 'Total', width: 'min-w-[90px]' },
                    { field: 'selling_price' as SortField, label: 'Sell Price', width: 'min-w-[100px]' },
                    { field: null, label: 'Margin', width: 'min-w-[100px]' },
                    { field: 'margin_percent' as SortField, label: '%', width: 'min-w-[60px]' },
                    { field: 'multiplier' as SortField, label: 'Mult.', width: 'min-w-[60px]' },
                    { field: null, label: 'Status', width: 'min-w-[80px]' },
                  ].map(col => (
                    <th
                      key={col.label}
                      className={cn(
                        'text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold',
                        col.width,
                        col.field && 'cursor-pointer hover:text-foreground transition-colors',
                      )}
                      onClick={() => col.field && toggleSort(col.field)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.field && sortField === col.field && (
                          <ArrowUpDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map(row => {
                  const cat = categoryConfig[row.product.category];
                  const CatIcon = cat?.icon || Package;

                  return (
                    <tr key={row.product.product_id} className={cn(
                      'hover:bg-muted/20 transition-colors',
                      row.status === 'critical' && 'bg-destructive/5',
                    )}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {row.product.image_url ? (
                            <img src={row.product.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <CatIcon className={cn('w-4 h-4', cat?.color)} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{row.product.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{row.product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={cn('text-[10px] gap-1', cat?.color)}>
                          <CatIcon className="w-3 h-3" /> {cat?.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-muted-foreground">
                          {row.fixedCost > 0 ? `${row.fixedCost.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-gold">
                          {row.variableCost > 0 ? `${row.variableCost.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-blue-400">
                          {row.shippingCost > 0 ? `${row.shippingCost.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono font-semibold">
                          {row.bom_cost > 0 ? `${row.bom_cost.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono font-semibold">
                          {row.selling_price > 0 ? `${row.selling_price.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('text-sm font-mono', row.grossMargin > 0 ? 'text-success' : row.grossMargin < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                          {row.selling_price > 0 ? `${row.grossMargin.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('text-sm font-semibold', getMarginColor(row.margin_percent, row.status))}>
                          {row.status !== 'no_price' && row.status !== 'no_bom' ? `${row.margin_percent.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('text-sm font-mono', row.multiplier >= 2 ? 'text-success' : row.multiplier >= 1.5 ? 'text-warning' : 'text-muted-foreground')}>
                          {row.multiplier > 0 ? `${row.multiplier.toFixed(2)}×` : '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(row.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="p-8">
              <EmptyState icon={DollarSign} title="No products match your filters" description="Try adjusting your search or filters." />
            </div>
          )}
        </div>

        {/* Insights */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                Top Margin Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rows
                  .filter(r => r.status === 'healthy')
                  .sort((a, b) => b.margin_percent - a.margin_percent)
                  .slice(0, 5)
                  .map(r => (
                    <div key={r.product.product_id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 min-w-0">{r.product.name}</span>
                      <span className="text-success font-semibold ml-2">{r.margin_percent.toFixed(1)}%</span>
                    </div>
                  ))}
                {rows.filter(r => r.status === 'healthy').length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No healthy-margin products found</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                Margin Improvement Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rows
                  .filter(r => r.status === 'critical' || r.status === 'warning')
                  .sort((a, b) => a.margin_percent - b.margin_percent)
                  .slice(0, 5)
                  .map(r => (
                    <div key={r.product.product_id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 min-w-0">{r.product.name}</span>
                      <span className={cn('font-semibold ml-2', r.status === 'critical' ? 'text-destructive' : 'text-warning')}>
                        {r.margin_percent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                {rows.filter(r => r.status === 'critical' || r.status === 'warning').length === 0 && (
                  <p className="text-sm text-muted-foreground italic">All products have healthy margins</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multiplier Guide */}
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4">
            <h4 className="text-sm font-semibold mb-2">Understanding the Multiplier</h4>
            <p className="text-sm text-muted-foreground mb-3">
              The multiplier shows how many times the BOM cost fits into the selling price. A higher multiplier means better margins.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { range: '< 1.5×', label: 'Thin Margin', color: 'text-destructive', desc: 'Consider raising price or reducing BOM cost' },
                { range: '1.5–2.0×', label: 'Acceptable', color: 'text-warning', desc: 'Covers costs but limited profit' },
                { range: '2.0–3.0×', label: 'Healthy', color: 'text-success', desc: 'Good margin for sustainable growth' },
                { range: '> 3.0×', label: 'Premium', color: 'text-gold', desc: 'Strong pricing power or low BOM cost' },
              ].map(tier => (
                <div key={tier.range} className="border border-border/50 rounded-lg p-3">
                  <p className={cn('text-lg font-bold', tier.color)}>{tier.range}</p>
                  <p className="text-xs font-semibold mt-1">{tier.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{tier.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
