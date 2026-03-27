// ============================================================
// BOM Picking List — Bulk BOM-based picking view
// Shows all components needed for a batch, grouped by category,
// with photos, quantities, and tick checkboxes.
// Can be embedded in Picking Ops or used standalone.
// ============================================================

import { useState, useMemo } from 'react';
import { SectionCard, StatusBadge, EmptyState, CheckboxRow } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  CheckCircle2, Package, Droplets, Box, Pipette, StickyNote,
  Tag, Truck, Wrench, Layers, ClipboardList, Download,
  AlertTriangle, Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { bomTemplates, bomComponents, generateBOMPickList } from '@/lib/bom-data';
import type { BOMPickListItem, BOMComponentCategory } from '@/types';

const categoryConfig: Record<BOMComponentCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  perfume: { label: 'Perfumes', icon: Droplets, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  atomizer: { label: 'Atomizers & Vials', icon: Pipette, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  packaging: { label: 'Packaging', icon: Box, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  insert: { label: 'Inserts & Cards', icon: StickyNote, color: 'text-green-500', bg: 'bg-green-500/10' },
  accessory: { label: 'Accessories', icon: Wrench, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  label: { label: 'Labels', icon: Tag, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  shipping: { label: 'Shipping Materials', icon: Truck, color: 'text-slate-500', bg: 'bg-slate-500/10' },
};

interface BOMPickingListProps {
  orders: { order_id: string; type: string; subscription_tier?: string; tags?: string[] }[];
  onComplete?: () => void;
  compact?: boolean;
}

export default function BOMPickingList({ orders, onComplete, compact = false }: BOMPickingListProps) {
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});

  const pickList = useMemo(() => {
    if (orders.length === 0) return [];
    return generateBOMPickList(orders);
  }, [orders]);

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

  const totalItems = pickList.length;
  const pickedCount = Object.values(pickedItems).filter(Boolean).length;
  const allPicked = totalItems > 0 && pickedCount === totalItems;

  const handleToggle = (componentId: string, checked: boolean) => {
    setPickedItems(prev => ({ ...prev, [componentId]: checked }));
    if (checked) {
      const remaining = totalItems - pickedCount - 1;
      if (remaining === 0) {
        toast.success('All BOM items picked!');
        onComplete?.();
      }
    }
  };

  const handlePickAll = () => {
    const all: Record<string, boolean> = {};
    pickList.forEach(item => { all[item.component_id] = true; });
    setPickedItems(all);
    toast.success('All BOM items marked as picked');
    onComplete?.();
  };

  const handleExportCSV = () => {
    const header = 'Component,Category,Qty Needed,Unit,Variable,Orders';
    const rows = pickList.map(item =>
      `"${item.component.name}","${item.component.category}",${item.total_qty_needed},"${item.component.unit}",${item.component.is_variable ? 'Yes' : 'No'},${item.orders_needing.length}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bom-pick-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('BOM picking list exported as CSV');
  };

  if (pickList.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No BOM Picking List"
        description="No orders with BOM templates found. Add orders to generate a BOM-based picking list."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-gold" />
          <div>
            <h3 className="font-semibold text-sm">BOM Picking List</h3>
            <p className="text-xs text-muted-foreground">
              {totalItems} components across {Array.from(grouped.keys()).length} categories · {orders.length} orders
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={allPicked ? 'success' : 'gold'}>
            {allPicked ? 'Complete' : `${pickedCount}/${totalItems}`}
          </StatusBadge>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          {!allPicked && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handlePickAll}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Pick All
            </Button>
          )}
        </div>
      </div>

      {/* Category Sections */}
      {Array.from(grouped.entries()).map(([category, items]) => {
        const config = categoryConfig[category];
        const CatIcon = config.icon;
        const catPicked = items.filter(i => pickedItems[i.component_id]).length;
        const catComplete = catPicked === items.length;

        return (
          <Card key={category} className={cn(
            'border transition-all',
            catComplete ? 'border-success/30 bg-success/5' : 'border-border/60',
          )}>
            <CardContent className="p-0">
              {/* Category Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className={cn('w-7 h-7 rounded flex items-center justify-center', config.bg)}>
                    <CatIcon className={cn('w-4 h-4', config.color)} />
                  </div>
                  <span className="font-semibold text-sm">{config.label}</span>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </div>
                <StatusBadge variant={catComplete ? 'success' : 'default'}>
                  {catComplete ? 'Done' : `${catPicked}/${items.length}`}
                </StatusBadge>
              </div>

              {/* Items */}
              <div className="divide-y divide-border/20">
                {items.map(item => {
                  const isPicked = !!pickedItems[item.component_id];
                  return (
                    <div
                      key={item.component_id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 transition-all cursor-pointer hover:bg-muted/20',
                        isPicked && 'bg-success/5',
                      )}
                      onClick={() => handleToggle(item.component_id, !isPicked)}
                    >
                      {/* Checkbox */}
                      <div className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                        isPicked ? 'bg-success border-success' : 'border-muted-foreground/30',
                      )}>
                        {isPicked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>

                      {/* Component Photo */}
                      <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', config.bg)}>
                        <CatIcon className={cn('w-4.5 h-4.5', config.color)} />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isPicked && 'line-through text-muted-foreground',
                        )}>
                          {item.component.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {item.component.source_ref_id && (
                            <span className="font-mono">{item.component.source_ref_id}</span>
                          )}
                          {item.component.is_variable && (
                            <Badge variant="outline" className="text-[9px] bg-gold/10 text-gold border-gold/30 py-0">
                              Variable
                            </Badge>
                          )}
                          <span>· {item.orders_needing.length} order{item.orders_needing.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold font-mono">{item.total_qty_needed}</p>
                        <p className="text-[10px] text-muted-foreground">{item.component.unit}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Completion Bar */}
      <div className={cn(
        'flex items-center justify-between p-3 rounded-lg border',
        allPicked ? 'border-success/30 bg-success/5' : 'border-amber-500/20 bg-amber-500/5',
      )}>
        <div className="flex items-center gap-2">
          {allPicked ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            {allPicked ? 'All BOM components picked' : `${totalItems - pickedCount} items remaining`}
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', allPicked ? 'bg-success' : 'bg-gold')}
            style={{ width: `${totalItems > 0 ? (pickedCount / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
