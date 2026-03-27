// ============================================================
// BOM Inventory Impact — Working simulation with consistent dummy stock,
// shortage alerts, ledger events, auto-reorder suggestions, CSV export
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, StatusBadge, KPICard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, Package, TrendingDown, Minus,
  ArrowDownCircle, ShieldAlert, Layers, DollarSign,
  BarChart3, RefreshCw, Droplets, Box, Pipette, StickyNote,
  Tag, Truck, Wrench, Download, ShoppingCart, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { bomTemplates, bomComponents, calculateBOMInventoryImpact } from '@/lib/bom-data';
import type { BOMComponent, BOMComponentCategory, BOMInventoryImpact } from '@/types';

const categoryIcons: Record<BOMComponentCategory, React.ElementType> = {
  perfume: Droplets, atomizer: Pipette, packaging: Box,
  insert: StickyNote, accessory: Wrench, label: Tag, shipping: Truck,
};

const categoryLabels: Record<BOMComponentCategory, string> = {
  perfume: 'Perfumes', atomizer: 'Atomizers', packaging: 'Packaging',
  insert: 'Inserts', accessory: 'Accessories', label: 'Labels', shipping: 'Shipping',
};

// Consistent dummy stock levels (seeded, not random)
function getDummyStock(): Map<string, number> {
  const stock = new Map<string, number>();
  const seedStocks: Record<string, number> = {};
  bomComponents.forEach((comp, idx) => {
    // Deterministic stock: some items plentiful, some scarce
    const base = [45, 12, 80, 5, 30, 22, 60, 8, 100, 15, 35, 50, 3, 70, 25, 40, 18, 55, 10, 90];
    seedStocks[comp.component_id] = base[idx % base.length];
  });
  for (const [id, qty] of Object.entries(seedStocks)) {
    stock.set(id, qty);
  }
  return stock;
}

interface LedgerEvent {
  timestamp: string;
  type: 'DEDUCT' | 'SHORTAGE_ALERT' | 'REORDER_SUGGESTION';
  component_id: string;
  component_name: string;
  category: BOMComponentCategory;
  qty: number;
  unit: string;
  cost: number;
  note: string;
}

export default function InventoryImpactPage() {
  const [selectedBOM, setSelectedBOM] = useState<string>('');
  const [orderCount, setOrderCount] = useState<number>(10);
  const [impacts, setImpacts] = useState<BOMInventoryImpact[] | null>(null);
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [activeTab, setActiveTab] = useState('impact');

  const dummyStock = useMemo(() => getDummyStock(), []);

  const handleSimulate = useCallback(() => {
    if (!selectedBOM) { toast.error('Please select a BOM template'); return; }

    const bom = bomTemplates.find(b => b.bom_id === selectedBOM);
    if (!bom) return;

    // Determine order type from BOM name
    const orderType = bom.name.includes('Grand Master 1') ? 'subscription_gm1'
      : bom.name.includes('Grand Master 2') ? 'subscription_gm2'
      : bom.name.includes('Grand Master 3') ? 'subscription_gm3'
      : bom.name.includes('Grand Master 4') ? 'subscription_gm4'
      : bom.name.includes('Traveler') ? 'em_set'
      : bom.name.includes('Play') ? 'aura_play'
      : bom.name.includes('Bundle') || bom.name.includes('Discovery') ? 'box_bundle'
      : 'one_time';

    const mockOrders = Array.from({ length: orderCount }, (_, i) => ({
      order_id: `sim-${i + 1}`,
      type: orderType,
    }));

    const result = calculateBOMInventoryImpact(mockOrders, dummyStock);
    setImpacts(result);

    // Generate ledger events
    const now = new Date();
    const events: LedgerEvent[] = [];
    for (const impact of result) {
      const comp = bomComponents.find(c => c.component_id === impact.component_id);
      if (!comp) continue;

      // Deduction event
      events.push({
        timestamp: now.toISOString(),
        type: 'DEDUCT',
        component_id: impact.component_id,
        component_name: impact.component_name,
        category: comp.category,
        qty: impact.qty_required,
        unit: comp.unit,
        cost: impact.qty_required * comp.unit_cost,
        note: `BOM deduction for ${orderCount}× ${bom.name}`,
      });

      // Shortage alert
      if (impact.shortage > 0) {
        events.push({
          timestamp: now.toISOString(),
          type: 'SHORTAGE_ALERT',
          component_id: impact.component_id,
          component_name: impact.component_name,
          category: comp.category,
          qty: impact.shortage,
          unit: comp.unit,
          cost: 0,
          note: `Short ${impact.shortage} ${comp.unit} — need ${impact.qty_required}, have ${impact.qty_available}`,
        });
      }

      // Auto-reorder suggestion for items that would go below 10
      const remaining = impact.qty_available - impact.qty_required;
      if (remaining < 10 && !comp.is_variable) {
        const suggestedQty = Math.max(impact.qty_required * 2, 50);
        events.push({
          timestamp: now.toISOString(),
          type: 'REORDER_SUGGESTION',
          component_id: impact.component_id,
          component_name: impact.component_name,
          category: comp.category,
          qty: suggestedQty,
          unit: comp.unit,
          cost: suggestedQty * comp.unit_cost,
          note: `Suggested reorder: ${suggestedQty} ${comp.unit} (2× batch need or min 50)`,
        });
      }
    }
    setLedgerEvents(events);
    toast.success(`Simulated impact for ${orderCount} orders using ${bom.name}`);
  }, [selectedBOM, orderCount, dummyStock]);

  const stats = useMemo(() => {
    if (!impacts) return null;
    const totalCost = impacts.reduce((s, i) => {
      const comp = bomComponents.find(c => c.component_id === i.component_id);
      return s + i.qty_required * (comp?.unit_cost || 0);
    }, 0);
    return {
      total: impacts.length,
      shortages: impacts.filter(i => i.shortage > 0).length,
      sufficient: impacts.filter(i => i.shortage === 0).length,
      totalCost,
      reorders: ledgerEvents.filter(e => e.type === 'REORDER_SUGGESTION').length,
    };
  }, [impacts, ledgerEvents]);

  const handleExportCSV = () => {
    if (!impacts) return;
    const rows = impacts.map(i => {
      const comp = bomComponents.find(c => c.component_id === i.component_id);
      return {
        Component: i.component_name,
        Category: comp?.category || '',
        'Qty Per Unit': Math.ceil(i.qty_required / orderCount),
        'Total Needed': i.qty_required,
        'Current Stock': i.qty_available,
        'After Deduct': i.qty_available - i.qty_required,
        Shortage: i.shortage,
        'Est Cost (AED)': (i.qty_required * (comp?.unit_cost || 0)).toFixed(2),
        Status: i.shortage > 0 ? 'SHORTAGE' : (i.qty_available - i.qty_required) < 10 ? 'LOW' : 'OK',
      };
    });
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inventory-impact-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Group impacts by category
  const groupedImpacts = useMemo(() => {
    if (!impacts) return new Map<BOMComponentCategory, (BOMInventoryImpact & { comp: BOMComponent })[]>();
    const groups = new Map<BOMComponentCategory, (BOMInventoryImpact & { comp: BOMComponent })[]>();
    for (const impact of impacts) {
      const comp = bomComponents.find(c => c.component_id === impact.component_id);
      if (!comp) continue;
      if (!groups.has(comp.category)) groups.set(comp.category, []);
      groups.get(comp.category)!.push({ ...impact, comp });
    }
    return groups;
  }, [impacts]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Inventory Impact Simulator"
        subtitle="Simulate BOM-based inventory deductions, identify shortages, and preview ledger events before confirming a batch"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM', href: '/bom/setup' },
          { label: 'Inventory Impact' },
        ]}
        actions={impacts ? (
          <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        ) : undefined}
      />

      <div className="p-6 space-y-6">
        {/* Simulation Controls */}
        <Card className="border-gold/20 bg-gold/5">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gold" />
              Simulation Parameters
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-1.5 block">BOM Template</label>
                <Select value={selectedBOM} onValueChange={setSelectedBOM}>
                  <SelectTrigger><SelectValue placeholder="Select a BOM template..." /></SelectTrigger>
                  <SelectContent>
                    {bomTemplates.map(b => (
                      <SelectItem key={b.bom_id} value={b.bom_id}>
                        {b.name} ({b.line_items.length} components · AED {b.total_cost.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label className="text-sm text-muted-foreground mb-1.5 block">Order Count</label>
                <Input type="number" min={1} max={500} value={orderCount} onChange={e => setOrderCount(parseInt(e.target.value) || 1)} />
              </div>
              <Button onClick={handleSimulate} className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground">
                <RefreshCw className="w-4 h-4" /> Run Simulation
              </Button>
            </div>

            {/* Quick presets */}
            <div className="flex gap-2 mt-3">
              <span className="text-xs text-muted-foreground self-center">Quick:</span>
              {[5, 10, 25, 50, 100].map(n => (
                <Button key={n} variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOrderCount(n)}>
                  {n} orders
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {stats && impacts && (
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard label="Components" value={stats.total} icon={Package} variant="default" />
              <KPICard label="Sufficient" value={stats.sufficient} icon={CheckCircle2} variant="success" />
              <KPICard label="Shortages" value={stats.shortages} icon={AlertTriangle} variant="destructive" />
              <KPICard label="Reorder Needed" value={stats.reorders} icon={ShoppingCart} variant="warning" />
              <KPICard label="Total Cost" value={`AED ${stats.totalCost.toFixed(0)}`} icon={DollarSign} variant="gold" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="impact" className="gap-1.5">
                  <ArrowDownCircle className="w-3.5 h-3.5" /> Impact Table
                </TabsTrigger>
                <TabsTrigger value="shortages" className="gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Shortages ({stats.shortages})
                </TabsTrigger>
                <TabsTrigger value="ledger" className="gap-1.5">
                  <History className="w-3.5 h-3.5" /> Ledger Events ({ledgerEvents.length})
                </TabsTrigger>
                <TabsTrigger value="reorder" className="gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" /> Reorder ({stats.reorders})
                </TabsTrigger>
              </TabsList>

              {/* Impact Table Tab */}
              <TabsContent value="impact" className="space-y-4 mt-4">
                {Array.from(groupedImpacts).map(([cat, items]) => {
                  const CatIcon = categoryIcons[cat];
                  return (
                    <Card key={cat} className="border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CatIcon className="w-4 h-4 text-muted-foreground" />
                          {categoryLabels[cat]} ({items.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/50 bg-muted/30">
                                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Component</th>
                                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Per Unit</th>
                                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Need</th>
                                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stock</th>
                                <th className="text-right px-4 py-2 font-medium text-muted-foreground">After</th>
                                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cost</th>
                                <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {items.map(item => {
                                const remaining = item.qty_available - item.qty_required;
                                const estCost = item.qty_required * item.comp.unit_cost;
                                return (
                                  <tr key={item.component_id} className={cn(
                                    'hover:bg-muted/20 transition-colors',
                                    item.shortage > 0 && 'bg-destructive/5',
                                  )}>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center gap-2">
                                        {item.comp.image_url ? (
                                          <img src={item.comp.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                                        ) : (
                                          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                                            <CatIcon className="w-3 h-3 text-muted-foreground" />
                                          </div>
                                        )}
                                        <span className="font-medium">{item.component_name}</span>
                                        {item.comp.is_variable && (
                                          <Badge variant="outline" className="text-[9px] bg-gold/10 text-gold border-gold/30">Var</Badge>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                                      {Math.ceil(item.qty_required / orderCount)} {item.comp.unit}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                                      {item.qty_required}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono">
                                      {item.qty_available}
                                    </td>
                                    <td className={cn(
                                      'px-4 py-2.5 text-right font-mono font-semibold',
                                      remaining < 0 ? 'text-destructive' : remaining < 10 ? 'text-warning' : 'text-success',
                                    )}>
                                      {remaining}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                                      AED {estCost.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      {item.shortage > 0 ? (
                                        <StatusBadge variant="destructive">Short {item.shortage}</StatusBadge>
                                      ) : remaining < 10 ? (
                                        <StatusBadge variant="warning">Low</StatusBadge>
                                      ) : (
                                        <StatusBadge variant="success">OK</StatusBadge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              {/* Shortages Tab */}
              <TabsContent value="shortages" className="mt-4">
                {stats.shortages === 0 ? (
                  <Card className="border-success/30 bg-success/5">
                    <CardContent className="p-8 text-center">
                      <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                      <h3 className="font-semibold text-lg">No Shortages</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All components have sufficient stock for {orderCount} orders.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <ShieldAlert className="w-5 h-5 text-destructive" />
                        <h3 className="font-semibold text-destructive">
                          {stats.shortages} Component{stats.shortages !== 1 ? 's' : ''} Short
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {impacts.filter(i => i.shortage > 0).map(impact => {
                          const comp = bomComponents.find(c => c.component_id === impact.component_id);
                          const CatIcon = comp ? categoryIcons[comp.category] : Package;
                          return (
                            <div key={impact.component_id} className="flex items-center gap-3 bg-background/80 rounded-lg px-4 py-3 border border-destructive/20">
                              <CatIcon className="w-5 h-5 text-destructive shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{impact.component_name}</p>
                                <p className="text-xs text-muted-foreground">{comp?.category} · {comp?.unit}</p>
                              </div>
                              <div className="text-right text-xs space-y-0.5">
                                <p><span className="text-muted-foreground">Need:</span> <span className="font-semibold">{impact.qty_required}</span></p>
                                <p><span className="text-muted-foreground">Have:</span> <span className="font-semibold">{impact.qty_available}</span></p>
                              </div>
                              <Badge variant="destructive" className="text-xs shrink-0">
                                Short {impact.shortage}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Ledger Events Tab */}
              <TabsContent value="ledger" className="mt-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-gold" />
                      Ledger Events Preview — {ledgerEvents.length} events
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-background z-10">
                          <tr className="border-b border-border/50 bg-muted/30">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Component</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cost</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {ledgerEvents.map((event, idx) => (
                            <tr key={idx} className={cn(
                              'hover:bg-muted/20',
                              event.type === 'SHORTAGE_ALERT' && 'bg-destructive/5',
                              event.type === 'REORDER_SUGGESTION' && 'bg-warning/5',
                            )}>
                              <td className="px-4 py-2.5">
                                <Badge variant={
                                  event.type === 'DEDUCT' ? 'outline' :
                                  event.type === 'SHORTAGE_ALERT' ? 'destructive' : 'secondary'
                                } className="text-[10px]">
                                  {event.type === 'DEDUCT' && <Minus className="w-3 h-3 mr-1" />}
                                  {event.type === 'SHORTAGE_ALERT' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                  {event.type === 'REORDER_SUGGESTION' && <ShoppingCart className="w-3 h-3 mr-1" />}
                                  {event.type.replace('_', ' ')}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 font-medium">{event.component_name}</td>
                              <td className="px-4 py-2.5 text-right font-mono">
                                {event.type === 'DEDUCT' ? '-' : ''}{event.qty} {event.unit}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">
                                {event.cost > 0 ? `AED ${event.cost.toFixed(2)}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                                {event.note}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Reorder Suggestions Tab */}
              <TabsContent value="reorder" className="mt-4">
                {stats.reorders === 0 ? (
                  <Card className="border-success/30 bg-success/5">
                    <CardContent className="p-8 text-center">
                      <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                      <h3 className="font-semibold text-lg">No Reorders Needed</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        All fixed components remain above minimum threshold after deduction.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-warning/30 bg-warning/5">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-warning" />
                          <h3 className="font-semibold">Reorder Suggestions</h3>
                          <Badge variant="secondary" className="text-[10px]">{stats.reorders}</Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => toast.success('Draft PO created for all suggested items')}>
                          Create Draft PO
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {ledgerEvents.filter(e => e.type === 'REORDER_SUGGESTION').map((event, idx) => {
                          const comp = bomComponents.find(c => c.component_id === event.component_id);
                          const CatIcon = comp ? categoryIcons[comp.category] : Package;
                          return (
                            <div key={idx} className="flex items-center gap-3 bg-background/80 rounded-lg px-4 py-3 border border-warning/20">
                              <CatIcon className="w-5 h-5 text-warning shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{event.component_name}</p>
                                <p className="text-xs text-muted-foreground">{event.note}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm">{event.qty} {event.unit}</p>
                                <p className="text-xs text-muted-foreground">AED {event.cost.toFixed(2)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {!impacts && (
          <EmptyState
            icon={BarChart3}
            title="Run a Simulation"
            description="Select a BOM template and order count above, then click 'Run Simulation' to see the inventory impact, shortages, and ledger events."
          />
        )}
      </div>
    </div>
  );
}
