// ============================================================
// Master BOM View — Shows compiled BOM for an order, merging
// all product BOMs and deduplicating common items
// ============================================================

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import {
  Layers, Package, Droplets, Box, Pipette, StickyNote,
  Tag, Truck, Wrench, ChevronDown, ChevronUp, DollarSign,
  Merge, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { compileMasterBOM, bomTemplates, endProducts } from '@/lib/bom-data';
import type { BOMComponentCategory, MasterBOMLine, MasterBOM, Order } from '@/types';

const categoryIcons: Record<BOMComponentCategory, React.ElementType> = {
  perfume: Droplets, atomizer: Pipette, packaging: Box,
  insert: StickyNote, accessory: Wrench, label: Tag, shipping: Truck,
};

const categoryColors: Record<BOMComponentCategory, string> = {
  perfume: 'text-amber-600 bg-amber-500/10',
  atomizer: 'text-blue-500 bg-blue-500/10',
  packaging: 'text-emerald-500 bg-emerald-500/10',
  insert: 'text-purple-500 bg-purple-500/10',
  accessory: 'text-orange-500 bg-orange-500/10',
  label: 'text-pink-500 bg-pink-500/10',
  shipping: 'text-cyan-500 bg-cyan-500/10',
};

interface MasterBOMViewProps {
  order: Order;
  compact?: boolean;
}

export function MasterBOMView({ order, compact = false }: MasterBOMViewProps) {
  const [expanded, setExpanded] = useState(!compact);

  // Compile master BOM for this order
  const masterBOM = useMemo((): MasterBOM | null => {
    // Determine which BOM templates apply based on order type
    const isSubscription = !!order.subscription_tier;
    const tierKey = order.subscription_tier?.toLowerCase() || '';

    // Find matching BOM templates by name
    const matchingBoms = bomTemplates.filter(b => {
      const nameLower = b.name.toLowerCase();
      if (isSubscription) {
        return nameLower.includes(tierKey) || nameLower.includes('subscription');
      }
      return nameLower.includes('one-time') || nameLower.includes('standard');
    });

    if (matchingBoms.length === 0) {
      // Fallback: use first BOM template
      const fallback = bomTemplates[0];
      if (!fallback) return null;
      return compileMasterBOM(order.order_id, [{ product_name: fallback.name, bom: fallback }]);
    }

    return compileMasterBOM(
      order.order_id,
      matchingBoms.map(b => ({ product_name: b.name, bom: b }))
    );
  }, [order]);

  if (!masterBOM) return null;

  // Group lines by category
  const grouped = useMemo(() => {
    const groups = new Map<BOMComponentCategory, MasterBOMLine[]>();
    for (const line of masterBOM.compiled_lines) {
      const cat = line.component.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(line);
    }
    return groups;
  }, [masterBOM]);

  const deduplicatedCount = masterBOM.compiled_lines.filter(l => l.source_bom_ids.length > 1).length;

  if (compact) {
    return (
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gold" />
            <span className="text-xs font-semibold">Master BOM</span>
            <Badge variant="outline" className="text-[9px]">{masterBOM.total_components} items</Badge>
            {deduplicatedCount > 0 && (
              <Badge variant="secondary" className="text-[9px] gap-0.5">
                <Merge className="w-2.5 h-2.5" /> {deduplicatedCount} merged
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              AED {masterBOM.total_fixed_cost.toFixed(2)}
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {expanded && (
          <div className="p-3 space-y-2">
            {/* Source BOMs */}
            <div className="flex flex-wrap gap-1 mb-2">
              {masterBOM.product_boms.map(pb => pb.bom.bom_id).concat(masterBOM.shipping_bom ? [masterBOM.shipping_bom.bom_id] : []).map(id => {
                const bom = bomTemplates.find(b => b.bom_id === id);
                return bom ? (
                  <Badge key={id} variant="outline" className="text-[9px]">{bom.name}</Badge>
                ) : null;
              })}
            </div>

            {/* Component list */}
            <div className="space-y-1">
              {masterBOM.compiled_lines.map(line => {
                const cat = line.component.category;
                const CatIcon = categoryIcons[cat];
                const lineCost = line.qty * line.component.unit_cost;
                return (
                  <div key={line.component_id} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30">
                    <div className={cn('w-5 h-5 rounded flex items-center justify-center', categoryColors[cat])}>
                      <CatIcon className="w-3 h-3" />
                    </div>
                    <span className={cn('flex-1', line.component.is_variable && 'italic')}>
                      {line.component.name}
                    </span>
                    {line.source_bom_ids.length > 1 && (
                      <Merge className="w-3 h-3 text-info" />
                    )}
                    <span className="font-mono text-muted-foreground">×{line.qty}</span>
                    <span className="font-mono w-16 text-right">AED {lineCost.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs font-semibold">Total BOM Cost</span>
              <span className="text-xs font-mono font-semibold">AED {masterBOM.total_fixed_cost.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <Card className="border-gold/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-5 h-5 text-gold" />
            Master BOM — Order {order.order_id}
          </CardTitle>
          <div className="flex items-center gap-2">
            {deduplicatedCount > 0 && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Merge className="w-3 h-3" /> {deduplicatedCount} deduplicated
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {masterBOM.total_components} components
            </Badge>
          </div>
        </div>

        {/* Source BOMs */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-xs text-muted-foreground">Sources:</span>
          {masterBOM.product_boms.map(pb => pb.bom.bom_id).concat(masterBOM.shipping_bom ? [masterBOM.shipping_bom.bom_id] : []).map(id => {
            const bom = bomTemplates.find(b => b.bom_id === id);
            return bom ? (
              <Badge key={id} variant="outline" className="text-[10px] bg-gold/5">{bom.name}</Badge>
            ) : null;
          })}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {Array.from(grouped).map(([cat, lines]) => {
          const CatIcon = categoryIcons[cat];
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-y border-border/30">
                <CatIcon className={cn('w-4 h-4', categoryColors[cat].split(' ')[0])} />
                <span className="text-xs font-semibold capitalize">{cat}</span>
                <Badge variant="outline" className="text-[9px]">{lines.length}</Badge>
              </div>
              <div className="divide-y divide-border/20">
                {lines.map(line => {
                  const lineCost = line.qty * line.component.unit_cost;
                  return (
                  <div key={line.component_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                    {line.component.image_url ? (
                      <img src={line.component.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className={cn('w-8 h-8 rounded flex items-center justify-center', categoryColors[cat])}>
                        <CatIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', line.component.is_variable && 'italic')}>
                        {line.component.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {line.component.unit} · AED {line.component.unit_cost.toFixed(2)} each
                      </p>
                    </div>
                    {line.source_bom_ids.length > 1 && (
                      <Badge variant="secondary" className="text-[9px] gap-0.5 shrink-0">
                        <Merge className="w-2.5 h-2.5" /> Merged
                      </Badge>
                    )}
                    {line.component.is_variable && (
                      <Badge variant="outline" className="text-[9px] bg-gold/10 text-gold border-gold/30 shrink-0">
                        Variable
                      </Badge>
                    )}
                    <span className="font-mono text-sm shrink-0">×{line.qty}</span>
                    <span className="font-mono text-sm w-20 text-right shrink-0">
                      AED {lineCost.toFixed(2)}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Footer totals */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border/50">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">Total BOM Cost</span>
          </div>
          <span className="text-sm font-mono font-bold">AED {masterBOM.total_fixed_cost.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
