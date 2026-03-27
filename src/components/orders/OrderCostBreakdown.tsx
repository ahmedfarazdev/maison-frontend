// ============================================================
// A7 — Order Cost Breakdown
// Per-order cost calculation: perfume cost (PO price ÷ ML) +
// packaging + syringe + labor estimate. Shows margin per order.
// ============================================================

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DollarSign, TrendingUp, TrendingDown, Minus, Droplets, Box,
  Package, Pipette, Clock, Info,
} from 'lucide-react';
import type { Order, OrderItem } from '@/types';

// ---- Cost Config (configurable in settings) ----
const COST_DEFAULTS = {
  labor_per_decant_aed: 2.5,      // labor cost per decant unit
  labor_per_sealed_aed: 1.0,      // labor cost per sealed bottle pick
  syringe_cost_per_use_aed: 0.5,  // syringe amortized cost per use
  atomizer_5ml_aed: 3.0,
  atomizer_8ml_aed: 3.5,
  atomizer_10ml_aed: 4.0,
  box_per_order_aed: 2.0,         // packaging box cost
  insert_per_order_aed: 0.5,      // insert card cost
  shipping_label_aed: 0.3,
  bubble_wrap_aed: 0.8,
};

// ---- Cost Calculation Types ----
export interface ItemCost {
  item_id: string;
  perfume_name: string;
  size_ml: number;
  qty: number;
  type: 'decant' | 'sealed_bottle' | 'vial';
  perfume_cost_per_ml: number;
  perfume_cost: number;
  packaging_cost: number;
  syringe_cost: number;
  labor_cost: number;
  total_cost: number;
  revenue: number;
  margin: number;
  margin_pct: number;
}

export interface OrderCostSummary {
  order_id: string;
  items: ItemCost[];
  total_perfume_cost: number;
  total_packaging_cost: number;
  total_syringe_cost: number;
  total_labor_cost: number;
  total_cost: number;
  total_revenue: number;
  gross_margin: number;
  margin_pct: number;
}

// ---- Helper: estimate perfume cost per ML from mock PO data ----
function estimatePerfumeCostPerMl(item: OrderItem): number {
  // In production, this would come from the PO price / bottle size
  // For now, use a heuristic based on unit_price (retail) with ~40% COGS ratio
  const retailPerMl = item.unit_price / item.size_ml;
  return retailPerMl * 0.4; // approximate wholesale = 40% of retail
}

// ---- Helper: get packaging cost for a decant size ----
function getAtomizerCost(sizeMl: number): number {
  if (sizeMl <= 5) return COST_DEFAULTS.atomizer_5ml_aed;
  if (sizeMl <= 8) return COST_DEFAULTS.atomizer_8ml_aed;
  return COST_DEFAULTS.atomizer_10ml_aed;
}

// ---- Calculate order cost breakdown ----
export function calculateOrderCost(order: Order): OrderCostSummary {
  const items: ItemCost[] = order.items.map(item => {
    const costPerMl = estimatePerfumeCostPerMl(item);
    const perfumeCost = costPerMl * item.size_ml * item.qty;

    let packagingCost = 0;
    let syringeCost = 0;
    let laborCost = 0;

    if (item.type === 'decant') {
      packagingCost = getAtomizerCost(item.size_ml) * item.qty;
      syringeCost = COST_DEFAULTS.syringe_cost_per_use_aed * item.qty;
      laborCost = COST_DEFAULTS.labor_per_decant_aed * item.qty;
    } else {
      packagingCost = COST_DEFAULTS.bubble_wrap_aed * item.qty;
      laborCost = COST_DEFAULTS.labor_per_sealed_aed * item.qty;
    }

    const totalCost = perfumeCost + packagingCost + syringeCost + laborCost;
    const revenue = item.unit_price * item.qty;
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    return {
      item_id: item.item_id,
      perfume_name: item.perfume_name,
      size_ml: item.size_ml,
      qty: item.qty,
      type: item.type,
      perfume_cost_per_ml: costPerMl,
      perfume_cost: perfumeCost,
      packaging_cost: packagingCost,
      syringe_cost: syringeCost,
      labor_cost: laborCost,
      total_cost: totalCost,
      revenue,
      margin,
      margin_pct: marginPct,
    };
  });

  // Add per-order fixed costs
  const orderFixedCost = COST_DEFAULTS.box_per_order_aed + COST_DEFAULTS.insert_per_order_aed + COST_DEFAULTS.shipping_label_aed;

  const totalPerfumeCost = items.reduce((s, i) => s + i.perfume_cost, 0);
  const totalPackagingCost = items.reduce((s, i) => s + i.packaging_cost, 0) + orderFixedCost;
  const totalSyringeCost = items.reduce((s, i) => s + i.syringe_cost, 0);
  const totalLaborCost = items.reduce((s, i) => s + i.labor_cost, 0);
  const totalCost = totalPerfumeCost + totalPackagingCost + totalSyringeCost + totalLaborCost;
  const totalRevenue = order.total_amount;
  const grossMargin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

  return {
    order_id: order.order_id,
    items,
    total_perfume_cost: totalPerfumeCost,
    total_packaging_cost: totalPackagingCost,
    total_syringe_cost: totalSyringeCost,
    total_labor_cost: totalLaborCost,
    total_cost: totalCost,
    total_revenue: totalRevenue,
    gross_margin: grossMargin,
    margin_pct: marginPct,
  };
}

// ---- Margin Indicator ----
function MarginIndicator({ pct }: { pct: number }) {
  const color = pct >= 50 ? 'text-success' : pct >= 30 ? 'text-gold' : pct >= 15 ? 'text-warning' : 'text-destructive';
  const Icon = pct >= 30 ? TrendingUp : pct >= 15 ? Minus : TrendingDown;
  return (
    <span className={cn('flex items-center gap-0.5 font-semibold', color)}>
      <Icon className="w-3.5 h-3.5" />
      {pct.toFixed(1)}%
    </span>
  );
}

// ---- Order Cost Breakdown Panel (for order detail) ----
export function OrderCostPanel({ order }: { order: Order }) {
  const cost = useMemo(() => calculateOrderCost(order), [order]);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gold" />
          Cost Breakdown
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Costs estimated from PO prices, packaging SKU costs, syringe amortization, and labor rates. Adjust rates in Settings.
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        {/* Per-item breakdown */}
        <div className="space-y-2">
          {cost.items.map(item => (
            <div key={item.item_id} className="border border-border/50 rounded-md p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {item.type === 'decant' ? <Droplets className="w-3.5 h-3.5 text-info" /> : <Box className="w-3.5 h-3.5 text-gold" />}
                  <span className="text-xs font-medium truncate">{item.perfume_name}</span>
                  <span className="text-[10px] text-muted-foreground">{item.size_ml}ml × {item.qty}</span>
                </div>
                <MarginIndicator pct={item.margin_pct} />
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div>
                  <span className="text-muted-foreground block">Perfume</span>
                  <span className="font-mono font-medium">AED {item.perfume_cost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Packaging</span>
                  <span className="font-mono font-medium">AED {item.packaging_cost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">{item.type === 'decant' ? 'Syringe' : 'Handling'}</span>
                  <span className="font-mono font-medium">AED {item.syringe_cost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Labor</span>
                  <span className="font-mono font-medium">AED {item.labor_cost.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30 text-[10px]">
                <span>Revenue: <span className="font-mono font-medium">AED {item.revenue.toFixed(2)}</span></span>
                <span>Cost: <span className="font-mono font-medium">AED {item.total_cost.toFixed(2)}</span></span>
                <span className={cn('font-medium', item.margin >= 0 ? 'text-success' : 'text-destructive')}>
                  Margin: AED {item.margin.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Order totals */}
        <div className="border-t border-border pt-3 space-y-1.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3 h-3 text-info" />
              <span className="text-muted-foreground">Perfume Cost</span>
              <span className="ml-auto font-mono font-medium">AED {cost.total_perfume_cost.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="w-3 h-3 text-gold" />
              <span className="text-muted-foreground">Packaging</span>
              <span className="ml-auto font-mono font-medium">AED {cost.total_packaging_cost.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Pipette className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Syringe</span>
              <span className="ml-auto font-mono font-medium">AED {cost.total_syringe_cost.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Labor</span>
              <span className="ml-auto font-mono font-medium">AED {cost.total_labor_cost.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 text-sm font-medium mt-2">
            <div>
              <span className="text-muted-foreground text-xs">Total Cost</span>
              <p className="font-mono">AED {cost.total_cost.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <span className="text-muted-foreground text-xs">Revenue</span>
              <p className="font-mono">AED {cost.total_revenue.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Gross Margin</span>
              <p className={cn('font-mono', cost.gross_margin >= 0 ? 'text-success' : 'text-destructive')}>
                AED {cost.gross_margin.toFixed(2)}
              </p>
            </div>
            <MarginIndicator pct={cost.margin_pct} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Compact Cost Badge (for order table rows) ----
export function OrderMarginBadge({ order }: { order: Order }) {
  const cost = useMemo(() => calculateOrderCost(order), [order]);
  const color = cost.margin_pct >= 50 ? 'success' : cost.margin_pct >= 30 ? 'gold' : cost.margin_pct >= 15 ? 'warning' : 'destructive';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn(
          'text-[10px] font-mono cursor-default gap-0.5',
          `border-${color}/40 text-${color}`,
        )}>
          <DollarSign className="w-2.5 h-2.5" />
          {cost.margin_pct.toFixed(0)}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>Revenue: AED {cost.total_revenue.toFixed(2)}</p>
        <p>Cost: AED {cost.total_cost.toFixed(2)}</p>
        <p className="font-medium">Margin: AED {cost.gross_margin.toFixed(2)} ({cost.margin_pct.toFixed(1)}%)</p>
      </TooltipContent>
    </Tooltip>
  );
}
