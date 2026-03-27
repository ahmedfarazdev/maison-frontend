// ============================================================
// Pricing Calculator — Auto-compute decant prices from pricing rules
// Uses: Surcharge Tiers, Hype Multiplier, ML Discount, A La Carte Multiplier
// ============================================================

import { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp, Info, TrendingUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Perfume, HypeLevel, SurchargeTier, SubscriptionHypeMultiplier, MlDiscount, AlaCartePricingMultiplier } from '@/types';

// Default pricing rules (matching the MasterDataPages defaults)
const DEFAULT_SURCHARGES: SurchargeTier[] = [
  { from_price_per_ml: 0, to_price_per_ml: 3, s_category: 'S0', s_price: 0 },
  { from_price_per_ml: 3, to_price_per_ml: 6, s_category: 'S1', s_price: 25 },
  { from_price_per_ml: 6, to_price_per_ml: 9, s_category: 'S2', s_price: 50 },
  { from_price_per_ml: 9, to_price_per_ml: 12, s_category: 'S3', s_price: 75 },
  { from_price_per_ml: 12, to_price_per_ml: 15, s_category: 'S4', s_price: 100 },
  { from_price_per_ml: 15, to_price_per_ml: null, s_category: 'S5', s_price: 125 },
];

const DEFAULT_SUB_HYPE_MULT: SubscriptionHypeMultiplier[] = [
  { hype: 'Extreme', multiplier: 1.2 },
  { hype: 'High', multiplier: 1.1 },
  { hype: 'Medium', multiplier: 1 },
  { hype: 'Low', multiplier: 1 },
  { hype: 'Rare', multiplier: 1.4 },
  { hype: 'Discontinued', multiplier: 1.5 },
];

const DEFAULT_ML_DISCOUNTS: MlDiscount[] = [
  { label: 'Premium', ml_size: 1, discount_factor: 0.10 },
  { label: 'Discount', ml_size: 2, discount_factor: 0 },
  { label: 'Discount', ml_size: 3, discount_factor: 0.03 },
  { label: 'Discount', ml_size: 5, discount_factor: 0.05 },
  { label: 'Discount', ml_size: 8, discount_factor: 0.10 },
  { label: 'Discount', ml_size: 10, discount_factor: 0.12 },
  { label: 'Discount', ml_size: 20, discount_factor: 0.15 },
  { label: 'Discount', ml_size: 30, discount_factor: 0.18 },
];

const DEFAULT_ALACARTE_MULT: AlaCartePricingMultiplier[] = [
  { hype: 'Extreme', multiplier: 4 },
  { hype: 'High', multiplier: 3.75 },
  { hype: 'Medium', multiplier: 3.5 },
  { hype: 'Low', multiplier: 3.25 },
  { hype: 'Rare', multiplier: 5 },
  { hype: 'Discontinued', multiplier: 5 },
];

interface PricingCalculatorProps {
  perfume: Perfume;
}

interface CalculatedPrice {
  ml_size: number;
  label: string;
  subscription_price: number;
  alacarte_price: number;
  discount_factor: number;
}

export default function PricingCalculator({ perfume }: PricingCalculatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const pricePerMl = perfume.price_per_ml;
  const hype = (perfume.hype_level || 'Medium') as HypeLevel;

  // 1. Determine surcharge tier
  const surcharge = useMemo(() => {
    for (const tier of DEFAULT_SURCHARGES) {
      if (pricePerMl >= tier.from_price_per_ml && (tier.to_price_per_ml === null || pricePerMl < tier.to_price_per_ml)) {
        return tier;
      }
    }
    return DEFAULT_SURCHARGES[DEFAULT_SURCHARGES.length - 1];
  }, [pricePerMl]);

  // 2. Get subscription hype multiplier
  const subHypeMult = useMemo(() => {
    return DEFAULT_SUB_HYPE_MULT.find(m => m.hype === hype)?.multiplier || 1;
  }, [hype]);

  // 3. Get a la carte hype multiplier
  const alacarteHypeMult = useMemo(() => {
    return DEFAULT_ALACARTE_MULT.find(m => m.hype === hype)?.multiplier || 3.5;
  }, [hype]);

  // 4. Calculate prices for each ML size
  const calculatedPrices: CalculatedPrice[] = useMemo(() => {
    return DEFAULT_ML_DISCOUNTS.map(d => {
      // Subscription price: (price_per_ml × ml_size × hype_mult) + surcharge - discount
      const baseSubPrice = pricePerMl * d.ml_size * subHypeMult;
      const subWithSurcharge = baseSubPrice + surcharge.s_price;
      const subscriptionDiscount = d.discount_factor;
      const subscription_price = Math.round(subWithSurcharge * (1 - subscriptionDiscount) * 100) / 100;

      // A la carte price: price_per_ml × ml_size × alacarte_mult - discount
      const baseAlacartePrice = pricePerMl * d.ml_size * alacarteHypeMult;
      const alacarte_price = Math.round(baseAlacartePrice * (1 - d.discount_factor) * 100) / 100;

      return {
        ml_size: d.ml_size,
        label: d.label,
        subscription_price,
        alacarte_price,
        discount_factor: d.discount_factor,
      };
    });
  }, [pricePerMl, subHypeMult, alacarteHypeMult, surcharge]);

  return (
    <div className="border-t border-border pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full group"
      >
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5" />
          Pricing Calculator
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Input Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/40 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Price/ml</span>
              <span className="text-sm font-mono font-bold">AED {pricePerMl.toFixed(2)}</span>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Hype Level</span>
              <span className={cn(
                'text-sm font-bold',
                hype === 'Extreme' && 'text-red-600',
                hype === 'Rare' && 'text-purple-600',
                hype === 'Discontinued' && 'text-zinc-500',
                hype === 'High' && 'text-amber-600',
              )}>{hype}</span>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Surcharge Tier</span>
              <span className="text-sm font-mono font-bold">{surcharge.s_category} <span className="text-muted-foreground font-normal">(+AED {surcharge.s_price})</span></span>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Multipliers</span>
              <span className="text-sm font-mono">
  <span className="text-amber-600">Hype: ×{alacarteHypeMult}</span>
              </span>
            </div>
          </div>

          {/* Price Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[60px_1fr_1fr] bg-muted/60 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Size</span>
              <span className="text-right">Price (AED)</span>
              <span className="text-right">Discount</span>
            </div>
            {calculatedPrices.map((row, i) => (
              <div
                key={row.ml_size}
                className={cn(
                  'grid grid-cols-[60px_1fr_1fr] px-3 py-2.5 text-sm items-center',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                  row.label === 'Premium' && 'bg-amber-50/50 dark:bg-amber-950/20',
                )}
              >
                <span className="font-mono font-bold text-xs">{row.ml_size}ml</span>
                <span className="text-right font-mono">
                  <span className="text-amber-700 dark:text-amber-400 font-semibold">AED {row.alacarte_price.toFixed(0)}</span>
                </span>
                <span className="text-right">
                  {row.discount_factor > 0 ? (
                    <span className="text-xs text-green-600 font-medium">-{(row.discount_factor * 100).toFixed(0)}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Breakdown toggle */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="w-3 h-3" />
            {showBreakdown ? 'Hide' : 'Show'} calculation breakdown
          </button>

          {showBreakdown && (
            <div className="bg-muted/30 rounded-lg p-4 text-xs space-y-3 font-mono animate-in fade-in duration-200">
              <div>
                <span className="text-muted-foreground font-sans font-medium uppercase tracking-wider text-[10px] block mb-1">Decant Pricing Formula</span>
                <p className="text-foreground">
                  price_per_ml × ml_size × alacarte_mult × (1 - discount)
                </p>
                <p className="text-muted-foreground mt-1">
                  {pricePerMl.toFixed(2)} × ml × {alacarteHypeMult} × (1 - discount%)
                </p>
              </div>
              <div className="border-t border-border pt-2">
                <span className="text-muted-foreground font-sans font-medium uppercase tracking-wider text-[10px] block mb-1">Applied Rules</span>
                <p>Surcharge Tier: {surcharge.s_category} (AED {pricePerMl.toFixed(2)}/ml → range {surcharge.from_price_per_ml}–{surcharge.to_price_per_ml ?? '∞'})</p>
<p>Hype Mult: {hype} → ×{alacarteHypeMult}</p>
              </div>
            </div>
          )}

          {/* Quick comparison with existing decant_pricing */}
          {perfume.decant_pricing && perfume.decant_pricing.length > 0 && (
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded-lg p-3">
              <h4 className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3 h-3" /> Comparison with Current Prices
              </h4>
              <div className="flex flex-wrap gap-2">
                {perfume.decant_pricing.map(dp => {
                  const calc = calculatedPrices.find(c => c.ml_size === dp.size_ml);
                  if (!calc) return null;
                  const diff = dp.price - calc.alacarte_price;
                  const pct = calc.alacarte_price > 0 ? ((diff / calc.alacarte_price) * 100) : 0;
                  return (
                    <div key={dp.size_ml} className="text-xs bg-white dark:bg-background rounded px-2 py-1.5 border border-blue-100 dark:border-blue-800/30">
                      <span className="font-mono font-bold">{dp.size_ml}ml</span>
                      <span className="text-muted-foreground ml-1">Current: AED {dp.price}</span>
                      <span className={cn(
                        'ml-1 font-medium',
                        diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-muted-foreground',
                      )}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(0)} ({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
