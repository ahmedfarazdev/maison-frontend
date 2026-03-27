// ============================================================
// Pricing Engine — Centralized dynamic pricing calculations
// All pricing rules are stored here and used by all components.
// Changes to these rules dynamically recalculate all prices.
// Currency: AED only
// ============================================================

import type { HypeLevel } from '@/types';

// ---- Surcharge Tiers (S0–S5) ----
// Based on price/ml ranges. S number is auto-determined.
export interface SurchargeTier {
  from_price_per_ml: number;
  to_price_per_ml: number | null; // null = infinity
  s_category: string;
  s_price: number; // AED flat surcharge
}

export const DEFAULT_SURCHARGES: SurchargeTier[] = [
  { from_price_per_ml: 0, to_price_per_ml: 3, s_category: 'S0', s_price: 0 },
  { from_price_per_ml: 3, to_price_per_ml: 6, s_category: 'S1', s_price: 25 },
  { from_price_per_ml: 6, to_price_per_ml: 9, s_category: 'S2', s_price: 50 },
  { from_price_per_ml: 9, to_price_per_ml: 12, s_category: 'S3', s_price: 75 },
  { from_price_per_ml: 12, to_price_per_ml: 15, s_category: 'S4', s_price: 100 },
  { from_price_per_ml: 15, to_price_per_ml: null, s_category: 'S5', s_price: 125 },
];

// ---- S — Hype Multiplier (Subscription) ----
export interface HypeMultiplier {
  hype: string;
  multiplier: number;
}

export const DEFAULT_SUB_HYPE_MULT: HypeMultiplier[] = [
  { hype: 'Extreme', multiplier: 1.2 },
  { hype: 'High', multiplier: 1.1 },
  { hype: 'Medium', multiplier: 1 },
  { hype: 'Low', multiplier: 1 },
  { hype: 'Rare', multiplier: 1.4 },
  { hype: 'Discontinued', multiplier: 1.5 },
];

// ---- ml Discount (One-Time / A La Carte) ----
// 1ml = PREMIUM (10% markup), 2ml = 0% (base), rest = discount
export interface MlDiscount {
  label: 'Premium' | 'Discount';
  ml_size: number;
  discount_factor: number; // 0.10 = 10% premium for 1ml, 0.03 = 3% discount for 3ml, etc.
}

export const DEFAULT_ML_DISCOUNTS: MlDiscount[] = [
  { label: 'Premium', ml_size: 1, discount_factor: 0.10 },
  { label: 'Discount', ml_size: 2, discount_factor: 0 },
  { label: 'Discount', ml_size: 3, discount_factor: 0.03 },
  { label: 'Discount', ml_size: 5, discount_factor: 0.05 },
  { label: 'Discount', ml_size: 8, discount_factor: 0.10 },
  { label: 'Discount', ml_size: 10, discount_factor: 0.12 },
  { label: 'Discount', ml_size: 20, discount_factor: 0.15 },
  { label: 'Discount', ml_size: 30, discount_factor: 0.18 },
];

// ---- Pricing Multiplier (A La Carte) ----
// Hype-based pricing multiplier for one-time decant orders
export const DEFAULT_ALACARTE_MULT: HypeMultiplier[] = [
  { hype: 'Extreme', multiplier: 4 },
  { hype: 'High', multiplier: 3.75 },
  { hype: 'Medium', multiplier: 3.5 },
  { hype: 'Low', multiplier: 3.25 },
  { hype: 'Rare', multiplier: 5 },
  { hype: 'Discontinued', multiplier: 5 },
];

// ---- Decant Sizes ----
export const DECANT_SIZES = [1, 2, 3, 5, 8, 10, 20, 30] as const;

// ============================================================
// PRICING FORMULAS
// ============================================================

/**
 * Calculate price per ml from WHOLESALE price (not retail)
 * Formula: wholesale_price / reference_size_ml
 */
export function calcPricePerMl(wholesalePrice: number, referenceSizeMl: number): number {
  if (wholesalePrice <= 0 || referenceSizeMl <= 0) return 0;
  return wholesalePrice / referenceSizeMl;
}

/**
 * Determine surcharge tier (S0–S5) based on price/ml
 * Formula from Google Sheet:
 * =IFERROR(INDEX('Surcharge Tiers'!$D$4:$D$9,
 *   MATCH(price_per_ml * hype_multiplier, 'Surcharge Tiers'!$B$4:$B$9, 1)), "Not Found")
 */
export function determineSurchargeTier(
  pricePerMl: number,
  hypeLevel: HypeLevel,
  surcharges: SurchargeTier[] = DEFAULT_SURCHARGES,
  hypeMultipliers: HypeMultiplier[] = DEFAULT_SUB_HYPE_MULT,
): SurchargeTier {
  // Get hype multiplier for the S number calculation
  const hypeMult = hypeMultipliers.find(m => m.hype === hypeLevel)?.multiplier || 1;
  const adjustedPricePerMl = pricePerMl * hypeMult;

  // Find the matching surcharge tier using the adjusted price/ml
  for (const tier of surcharges) {
    if (adjustedPricePerMl >= tier.from_price_per_ml &&
        (tier.to_price_per_ml === null || adjustedPricePerMl < tier.to_price_per_ml)) {
      return tier;
    }
  }
  return surcharges[surcharges.length - 1];
}

/**
 * Get the a la carte pricing multiplier based on hype level
 * Formula from Google Sheet:
 * =XLOOKUP(hype_level, 'Surcharge Tiers'!$D$22:$D$27, 'Surcharge Tiers'!$E$22:$E$27, "Not Found")
 */
export function getAlacarteMultiplier(
  hypeLevel: HypeLevel,
  multipliers: HypeMultiplier[] = DEFAULT_ALACARTE_MULT,
): number {
  return multipliers.find(m => m.hype === hypeLevel)?.multiplier || 3.5;
}

/**
 * Calculate decant size price (A La Carte / One-Time)
 * Formula from Google Sheet:
 * =ROUNDUP(((price_per_ml * alacarte_multiplier) * ml_size) * (1 - discount_factor))
 *
 * For 1ml (Premium): price is INCREASED by 10% (premium markup)
 * For 2ml: base price (0% discount)
 * For 3ml+: price is DECREASED by discount_factor
 */
export function calcDecantPrice(
  pricePerMl: number,
  mlSize: number,
  hypeLevel: HypeLevel,
  mlDiscounts: MlDiscount[] = DEFAULT_ML_DISCOUNTS,
  alacarteMultipliers: HypeMultiplier[] = DEFAULT_ALACARTE_MULT,
): number {
  const alacarteMult = getAlacarteMultiplier(hypeLevel, alacarteMultipliers);
  const discount = mlDiscounts.find(d => d.ml_size === mlSize);

  if (!discount) return 0;

  const basePrice = pricePerMl * alacarteMult * mlSize;

  let finalPrice: number;
  if (discount.label === 'Premium') {
    // 1ml premium: price * (1 + premium_factor)
    finalPrice = Math.ceil(basePrice * (1 + discount.discount_factor));
  } else {
    // Discount: price * (1 - discount_factor)
    finalPrice = Math.ceil(basePrice * (1 - discount.discount_factor));
  }

  // Minimum pricing rule: no decant size should ever be below AED 10
  return Math.max(finalPrice, 10);
}

/**
 * Calculate all decant prices for a perfume
 * Returns an array of { size_ml, price } for all DECANT_SIZES
 */
export function calcAllDecantPrices(
  pricePerMl: number,
  hypeLevel: HypeLevel,
): { size_ml: number; price: number; label: string; discount_factor: number }[] {
  return DEFAULT_ML_DISCOUNTS.map(d => ({
    size_ml: d.ml_size,
    price: calcDecantPrice(pricePerMl, d.ml_size, hypeLevel),
    label: d.label,
    discount_factor: d.discount_factor,
  }));
}

/**
 * Full pricing summary for a perfume
 */
export interface PricingSummary {
  wholesale_price: number;
  reference_size_ml: number;
  price_per_ml: number;
  hype_level: HypeLevel;
  surcharge_tier: SurchargeTier;
  alacarte_multiplier: number;
  sub_hype_multiplier: number;
  decant_prices: { size_ml: number; price: number; label: string; discount_factor: number }[];
}

export function calcFullPricing(
  wholesalePrice: number,
  referenceSizeMl: number,
  hypeLevel: HypeLevel,
): PricingSummary {
  const pricePerMl = calcPricePerMl(wholesalePrice, referenceSizeMl);
  const surchargeTier = determineSurchargeTier(pricePerMl, hypeLevel);
  const alacarteMult = getAlacarteMultiplier(hypeLevel);
  const subHypeMult = DEFAULT_SUB_HYPE_MULT.find(m => m.hype === hypeLevel)?.multiplier || 1;
  const decantPrices = calcAllDecantPrices(pricePerMl, hypeLevel);

  return {
    wholesale_price: wholesalePrice,
    reference_size_ml: referenceSizeMl,
    price_per_ml: pricePerMl,
    hype_level: hypeLevel,
    surcharge_tier: surchargeTier,
    alacarte_multiplier: alacarteMult,
    sub_hype_multiplier: subHypeMult,
    decant_prices: decantPrices,
  };
}
