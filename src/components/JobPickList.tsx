// ============================================================
// JobPickList — BOM-driven pick list for a job's orders
// Uses generateBOMPickList() from bom-data to resolve
// Order → End Product → BOM → aggregated component list
// ============================================================

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Package, Printer, CheckCircle2, ClipboardList, Droplets,
  Pipette, Box, Tag, StickyNote, Wrench, Truck, AlertTriangle,
  Download, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateBOMPickList, componentCategoryLabels } from '@/lib/bom-data';
import type { BOMPickListItem, BOMComponentCategory, Order } from '@/types';
import { toast } from 'sonner';

const categoryIcons: Record<BOMComponentCategory, React.ElementType> = {
  perfume: Droplets,
  atomizer: Pipette,
  packaging: Box,
  insert: StickyNote,
  accessory: Wrench,
  label: Tag,
  shipping: Truck,
};

const categoryColors: Record<BOMComponentCategory, string> = {
  perfume: 'text-gold bg-gold/10 border-gold/30',
  atomizer: 'text-info bg-info/10 border-info/30',
  packaging: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  insert: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  accessory: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  label: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  shipping: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
};

interface JobPickListProps {
  open: boolean;
  onClose: () => void;
  jobCode: string;
  orders: Order[];
  mode: 'one_time' | 'subscription';
}

export default function JobPickList({ open, onClose, jobCode, orders, mode }: JobPickListProps) {
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());

  // Generate BOM pick list from orders
  const pickList = useMemo(() => {
    if (!orders.length) return [];
    const orderInputs = orders.map(o => ({
      order_id: o.order_id,
      type: mode === 'subscription' ? 'subscription' : 'one_time',
      subscription_tier: o.subscription_tier,
      tags: o.tags,
    }));
    return generateBOMPickList(orderInputs);
  }, [orders, mode]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = new Map<BOMComponentCategory, BOMPickListItem[]>();
    for (const item of pickList) {
      const cat = item.component.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [pickList]);

  const totalComponents = pickList.length;
  const pickedCount = pickedItems.size;
  const allPicked = totalComponents > 0 && pickedCount === totalComponents;
  const progress = totalComponents > 0 ? (pickedCount / totalComponents) * 100 : 0;

  const togglePicked = (componentId: string) => {
    setPickedItems(prev => {
      const next = new Set(prev);
      if (next.has(componentId)) next.delete(componentId);
      else next.add(componentId);
      return next;
    });
  };

  const markAllPicked = () => {
    setPickedItems(new Set(pickList.map(i => i.component_id)));
    toast.success('All items marked as picked');
  };

  const exportCSV = () => {
    const headers = ['Category', 'Component', 'Qty Needed', 'Unit', 'Orders', 'Picked'];
    const rows = pickList.map(item => [
      componentCategoryLabels[item.component.category] || item.component.category,
      item.component.name,
      item.total_qty_needed,
      item.component.unit,
      item.orders_needing.length,
      pickedItems.has(item.component_id) ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pick-list-${jobCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Pick list exported');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gold" />
            BOM Pick List — {jobCode}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Bar */}
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-3 border border-border/50">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">
                {pickedCount} / {totalComponents} components picked
              </span>
              <span className="text-xs font-mono text-muted-foreground">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-300', allPicked ? 'bg-success' : 'bg-gold')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="text-center px-3 border-l border-border/50">
            <p className="text-lg font-bold">{orders.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
          </div>
          <div className="text-center px-3 border-l border-border/50">
            <p className="text-lg font-bold">{totalComponents}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Items</p>
          </div>
        </div>

        {allPicked && (
          <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-lg p-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-success">All components picked — ready for next station</span>
          </div>
        )}

        {/* Pick List by Category */}
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([category, items]) => {
            const CatIcon = categoryIcons[category] || Package;
            const colors = categoryColors[category] || 'text-muted-foreground bg-muted/30 border-border/50';
            const catPicked = items.filter(i => pickedItems.has(i.component_id)).length;

            return (
              <Card key={category} className="border-border/60">
                <CardContent className="p-0">
                  {/* Category Header */}
                  <div className={cn('flex items-center justify-between px-4 py-2.5 border-b border-border/30', colors.split(' ').slice(1).join(' '))}>
                    <div className="flex items-center gap-2">
                      <CatIcon className={cn('w-4 h-4', colors.split(' ')[0])} />
                      <span className="text-sm font-semibold">{componentCategoryLabels[category] || category}</span>
                      <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{catPicked}/{items.length} picked</span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-border/30">
                    {items.map(item => {
                      const isPicked = pickedItems.has(item.component_id);
                      return (
                        <div
                          key={item.component_id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer',
                            isPicked && 'bg-success/5'
                          )}
                          onClick={() => togglePicked(item.component_id)}
                        >
                          <Checkbox
                            checked={isPicked}
                            onCheckedChange={() => togglePicked(item.component_id)}
                            className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                          />
                          {item.component.image_url && (
                            <img
                              src={item.component.image_url}
                              alt={item.component.name}
                              className="w-8 h-8 rounded object-cover border border-border/50"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium', isPicked && 'line-through text-muted-foreground')}>
                              {item.component.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.orders_needing.length} order{item.orders_needing.length !== 1 ? 's' : ''} need this
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono font-semibold">
                              {item.total_qty_needed} <span className="text-[10px] text-muted-foreground">{item.component.unit}</span>
                            </p>
                          </div>
                          {isPicked ? (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          ) : (
                            <div className="w-4 h-4 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {pickList.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning" />
            <p className="text-sm">No BOM data found for these orders.</p>
            <p className="text-xs mt-1">Ensure End Products are linked to BOM templates in BOM Setup.</p>
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => toast.info('Print functionality coming soon')} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print
          </Button>
          {!allPicked && (
            <Button onClick={markAllPicked} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Mark All Picked
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="w-4 h-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
