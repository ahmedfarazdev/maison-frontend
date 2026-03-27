// ============================================================
// BOM Mock Data — Maison Em OS
// Matches the Whimsical BOM diagram structure:
// Shipping BOM (base), Box Bundles, Em Sets, Aura Play, Aura Key Subscription
// Includes Master BOM compiler with deduplication
// ============================================================

import type {
  BOMComponent, BOMTemplate, BOMLineItem, EndProduct, OrderTypeBOMMapping,
  BOMPickListItem, BOMOrderBreakdown, BOMInventoryImpact,
  OrderTypeTag, MasterBOM, MasterBOMLine, BOMComponentCategory,
} from '@/types';
import { COMMON_COMPONENT_IDS } from '@/types';

// ---- Shared Components Library ----
// Photos use placeholder URLs — in production these auto-fetch from inventory SKU reference
const IMG = 'https://placehold.co';

export const bomComponents: BOMComponent[] = [
  // Packaging
  { component_id: 'comp-box-standard', name: 'Standard Mailer Box', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/MAILER-STD-BLK', image_url: `${IMG}/80x80/1a1a2e/c9a961?text=Box`, unit_cost: 3.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-box-premium', name: 'Premium Gift Box (Magnetic)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/GIFTBOX-MAG-BLK', image_url: `${IMG}/80x80/1a1a2e/c9a961?text=Gift+Box`, unit_cost: 12.00, unit: 'pc', is_variable: false },
  { component_id: 'comp-box-collector', name: 'Collector Edition Box', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/COLLECTOR-BLK', image_url: `${IMG}/80x80/1a1a2e/c9a961?text=Collector`, unit_cost: 22.00, unit: 'pc', is_variable: false },
  { component_id: 'comp-sleeve-gold', name: 'Gold Foil Sleeve', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/SLEEVE-GOLD', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=Sleeve`, unit_cost: 1.80, unit: 'pc', is_variable: false },
  { component_id: 'comp-tissue', name: 'Tissue Paper (Black)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/TISSUE-BLK', image_url: `${IMG}/80x80/333/fff?text=Tissue`, unit_cost: 0.30, unit: 'sheet', is_variable: false },
  { component_id: 'comp-bubble-wrap', name: 'Bubble Wrap Sheet', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/SHIP/BUBBLE-STD', image_url: `${IMG}/80x80/e0e0e0/333?text=Bubble`, unit_cost: 0.25, unit: 'sheet', is_variable: false },
  { component_id: 'comp-ribbon', name: 'Satin Ribbon (Gold)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKGACC/RIBBON-GOLD', image_url: `${IMG}/80x80/c9a961/fff?text=Ribbon`, unit_cost: 0.60, unit: 'pc', is_variable: false },
  { component_id: 'comp-seal-sticker', name: 'Wax Seal Sticker', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKGACC/SEAL-WAX', image_url: `${IMG}/80x80/8b0000/c9a961?text=Seal`, unit_cost: 0.45, unit: 'pc', is_variable: false },
  { component_id: 'comp-inlay-3', name: 'Foam Inlay (3-slot)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/INLAY-3SLOT', image_url: `${IMG}/80x80/333/fff?text=3-Slot`, unit_cost: 2.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-inlay-5', name: 'Foam Inlay (5-slot)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/INLAY-5SLOT', image_url: `${IMG}/80x80/333/fff?text=5-Slot`, unit_cost: 3.80, unit: 'pc', is_variable: false },
  { component_id: 'comp-inlay-7', name: 'Foam Inlay (7-slot)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKG/INLAY-7SLOT', image_url: `${IMG}/80x80/333/fff?text=7-Slot`, unit_cost: 4.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-pouch-velvet', name: 'Velvet Pouch (Black)', category: 'packaging', source: 'packaging_sku', source_ref_id: 'EM/PCKGACC/POUCH-VLV-BLK', image_url: `${IMG}/80x80/1a1a2e/c9a961?text=Pouch`, unit_cost: 2.00, unit: 'pc', is_variable: false },

  // Atomizers & Vials
  { component_id: 'comp-atm-5ml', name: 'Atomizer 5ml (Gold Cap)', category: 'atomizer', source: 'packaging_sku', source_ref_id: 'EM/ATM/ATM-5ML-GOLD', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=5ml`, unit_cost: 1.20, unit: 'pc', is_variable: false },
  { component_id: 'comp-atm-8ml', name: 'Atomizer 8ml (Gold Cap)', category: 'atomizer', source: 'packaging_sku', source_ref_id: 'EM/ATM/ATM-8ML-GOLD', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=8ml`, unit_cost: 1.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-atm-10ml', name: 'Atomizer 10ml (Gold Cap)', category: 'atomizer', source: 'packaging_sku', source_ref_id: 'EM/ATM/ATM-10ML-GOLD', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=10ml`, unit_cost: 1.80, unit: 'pc', is_variable: false },
  { component_id: 'comp-atm-20ml', name: 'Atomizer 20ml (Premium)', category: 'atomizer', source: 'packaging_sku', source_ref_id: 'EM/ATM/ATM-20ML-PREM', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=20ml`, unit_cost: 3.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-vial-1ml', name: 'Sample Vial 1ml', category: 'atomizer', source: 'packaging_sku', source_ref_id: 'EM/ATM/VIAL-1ML', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=1ml`, unit_cost: 0.30, unit: 'pc', is_variable: false },
  { component_id: 'comp-atm-premium', name: 'Premium Atomiser (Aura Key)', category: 'atomizer', source: 'packaging_sku', source_ref_id: 'EM/ATM/AURAKEY-PREM', image_url: `${IMG}/80x80/c9a961/1a1a2e?text=Aura`, unit_cost: 8.00, unit: 'pc', is_variable: false },

  // Perfumes (variable — customer selects)
  { component_id: 'comp-perfume-5ml', name: 'Perfume Decant 5ml', category: 'perfume', source: 'sealed_vault', image_url: `${IMG}/80x80/4a0e4e/c9a961?text=5ml`, unit_cost: 25.00, unit: 'ml', is_variable: true, price_per_ml: 5.00, decant_size_ml: 5, notes: 'Customer-selected perfume, 5ml decant' },
  { component_id: 'comp-perfume-10ml', name: 'Perfume Decant 10ml', category: 'perfume', source: 'sealed_vault', image_url: `${IMG}/80x80/4a0e4e/c9a961?text=10ml`, unit_cost: 50.00, unit: 'ml', is_variable: true, price_per_ml: 5.00, decant_size_ml: 10, notes: 'Customer-selected perfume, 10ml decant' },
  { component_id: 'comp-perfume-20ml', name: 'Perfume Decant 20ml', category: 'perfume', source: 'sealed_vault', image_url: `${IMG}/80x80/4a0e4e/c9a961?text=20ml`, unit_cost: 100.00, unit: 'ml', is_variable: true, price_per_ml: 5.00, decant_size_ml: 20, notes: 'Customer-selected perfume, 20ml decant' },
  { component_id: 'comp-perfume-75ml', name: 'Perfume Decant 7.5ml (Aura Key)', category: 'perfume', source: 'sealed_vault', image_url: `${IMG}/80x80/4a0e4e/c9a961?text=7.5ml`, unit_cost: 37.50, unit: 'ml', is_variable: true, price_per_ml: 5.00, decant_size_ml: 7.5, notes: 'POTM or customer-selected, 7.5ml vial' },
  { component_id: 'comp-full-bottle', name: 'Full Sealed Bottle', category: 'perfume', source: 'sealed_vault', image_url: `${IMG}/80x80/4a0e4e/c9a961?text=Bottle`, unit_cost: 350.00, unit: 'pc', is_variable: true, notes: 'Customer-selected full bottle — price varies by perfume' },

  // Inserts
  { component_id: 'comp-thank-you-card', name: 'Thank You Card', category: 'insert', source: 'packaging_sku', source_ref_id: 'EM/LBL/THANKYOU-STD', image_url: `${IMG}/80x80/f5f0e8/1a1a2e?text=Thanks`, unit_cost: 0.40, unit: 'pc', is_variable: false },
  { component_id: 'comp-aura-booklet', name: 'Aura Guide Booklet', category: 'insert', source: 'packaging_sku', source_ref_id: 'EM/LBL/AURA-BOOKLET', image_url: `${IMG}/80x80/f5f0e8/1a1a2e?text=Booklet`, unit_cost: 1.20, unit: 'pc', is_variable: false },
  { component_id: 'comp-perfume-card', name: 'Perfume Info Card', category: 'insert', source: 'packaging_sku', source_ref_id: 'EM/LBL/PERFUME-CARD', image_url: `${IMG}/80x80/f5f0e8/1a1a2e?text=Info`, unit_cost: 0.25, unit: 'pc', is_variable: false },
  { component_id: 'comp-complimentary-1ml', name: 'Complimentary 1ml Sample', category: 'insert', source: 'packaging_sku', source_ref_id: 'EM/ATM/VIAL-1ML', image_url: `${IMG}/80x80/f5f0e8/1a1a2e?text=Sample`, unit_cost: 0.80, unit: 'pc', is_variable: false },
  { component_id: 'comp-discount-card', name: 'Discount/Promo Card', category: 'insert', source: 'packaging_sku', source_ref_id: 'EM/LBL/PROMO-CARD', image_url: `${IMG}/80x80/f5f0e8/1a1a2e?text=Promo`, unit_cost: 0.15, unit: 'pc', is_variable: false },
  { component_id: 'comp-ritual-card', name: 'Ritual Guide Card', category: 'insert', source: 'packaging_sku', source_ref_id: 'EM/LBL/RITUAL-CARD', image_url: `${IMG}/80x80/f5f0e8/1a1a2e?text=Ritual`, unit_cost: 0.35, unit: 'pc', is_variable: false },

  // Labels
  { component_id: 'comp-label-decant', name: 'Decant Label (Branded)', category: 'label', source: 'packaging_sku', source_ref_id: 'EM/LBL/DECANT-BRAND', image_url: `${IMG}/80x80/1a1a2e/c9a961?text=Label`, unit_cost: 0.10, unit: 'pc', is_variable: false },
  { component_id: 'comp-label-box', name: 'Box Seal Label', category: 'label', source: 'packaging_sku', source_ref_id: 'EM/LBL/BOX-SEAL', image_url: `${IMG}/80x80/1a1a2e/c9a961?text=Seal`, unit_cost: 0.08, unit: 'pc', is_variable: false },

  // Shipping
  { component_id: 'comp-shipping-envelope', name: 'Padded Shipping Envelope', category: 'shipping', source: 'packaging_sku', source_ref_id: 'EM/SHIP/ENVELOPE-PAD', image_url: `${IMG}/80x80/6b5b3e/fff?text=Envelope`, unit_cost: 1.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-shipping-box', name: 'Shipping Box (Outer)', category: 'shipping', source: 'packaging_sku', source_ref_id: 'EM/SHIP/BOX-OUTER', image_url: `${IMG}/80x80/6b5b3e/fff?text=Ship+Box`, unit_cost: 2.80, unit: 'pc', is_variable: false },
  { component_id: 'comp-shipping-tape', name: 'Branded Tape', category: 'shipping', source: 'packaging_sku', source_ref_id: 'EM/SHIP/TAPE-BRAND', image_url: `${IMG}/80x80/6b5b3e/fff?text=Tape`, unit_cost: 0.20, unit: 'pc', is_variable: false },

  // Accessories
  { component_id: 'comp-funnel', name: 'Mini Funnel', category: 'accessory', source: 'packaging_sku', source_ref_id: 'EM/PCKGACC/FUNNEL-MINI', image_url: `${IMG}/80x80/555/c9a961?text=Funnel`, unit_cost: 0.50, unit: 'pc', is_variable: false },
  { component_id: 'comp-pipette', name: 'Disposable Pipette', category: 'accessory', source: 'packaging_sku', source_ref_id: 'EM/PCKGACC/PIPETTE', image_url: `${IMG}/80x80/555/c9a961?text=Pipette`, unit_cost: 0.10, unit: 'pc', is_variable: false },
];

/** Lookup a component by ID */
export function getComponent(id: string): BOMComponent | undefined {
  return bomComponents.find(c => c.component_id === id);
}

function makeLineItem(compId: string, qty: number, sortOrder: number, optional = false, condition?: string): BOMLineItem {
  const comp = bomComponents.find(c => c.component_id === compId)!;
  return {
    line_id: `li-${compId}-${sortOrder}`,
    component_id: compId,
    component: comp,
    qty,
    is_optional: optional,
    condition,
    sort_order: sortOrder,
  };
}

function calcFixedCost(items: BOMLineItem[]): number {
  return items.filter(li => !li.component.is_variable).reduce((s, li) => s + li.qty * li.component.unit_cost, 0);
}

function calcVariableCost(items: BOMLineItem[]): number {
  return items.filter(li => li.component.is_variable).reduce((s, li) => s + li.qty * li.component.unit_cost, 0);
}

// ============================================================
// SHIPPING BOMs — Different shipping configurations
// Each has its own serial, components, fixed cost, and version
// ============================================================

const shippingBOMBag: BOMTemplate = {
  bom_id: 'bom-ship-bag',
  name: 'SHIP-001 · Shipping Bag',
  description: 'Lightweight shipping bag for single decant orders. Includes padded envelope, branded tape, thank you card, and seal sticker.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-shipping-envelope', 1, 1),
    makeLineItem('comp-shipping-tape', 1, 2),
    makeLineItem('comp-bubble-wrap', 1, 3),
    makeLineItem('comp-thank-you-card', 1, 10),
    makeLineItem('comp-seal-sticker', 1, 11),
    makeLineItem('comp-discount-card', 1, 12, true),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-10-01T10:00:00Z',
  updated_at: '2026-01-15T14:30:00Z',
  created_by: 'karim',
};
shippingBOMBag.total_cost = calcFixedCost(shippingBOMBag.line_items);
shippingBOMBag.variable_cost = calcVariableCost(shippingBOMBag.line_items);

const shippingBOMStandardBox: BOMTemplate = {
  bom_id: 'bom-ship-std-box',
  name: 'SHIP-002 · Standard Shipping Box',
  description: 'Standard outer shipping box for multi-item orders. Includes shipping box, double bubble wrap, branded tape, thank you card, and box seal.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-shipping-box', 1, 1),
    makeLineItem('comp-bubble-wrap', 2, 2),
    makeLineItem('comp-shipping-tape', 1, 3),
    makeLineItem('comp-thank-you-card', 1, 10),
    makeLineItem('comp-label-box', 1, 11),
    makeLineItem('comp-seal-sticker', 1, 12),
    makeLineItem('comp-discount-card', 1, 13, true),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-10-01T10:00:00Z',
  updated_at: '2026-01-15T14:30:00Z',
  created_by: 'karim',
};
shippingBOMStandardBox.total_cost = calcFixedCost(shippingBOMStandardBox.line_items);
shippingBOMStandardBox.variable_cost = calcVariableCost(shippingBOMStandardBox.line_items);

const shippingBOMPaddedEnvelope: BOMTemplate = {
  bom_id: 'bom-ship-padded',
  name: 'SHIP-003 · Padded Envelope',
  description: 'Padded envelope for lightweight orders (1–2 decants). Minimal packaging with envelope, tape, and thank you card.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-shipping-envelope', 1, 1),
    makeLineItem('comp-shipping-tape', 1, 2),
    makeLineItem('comp-thank-you-card', 1, 10),
    makeLineItem('comp-seal-sticker', 1, 11),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-11-01T10:00:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  created_by: 'karim',
};
shippingBOMPaddedEnvelope.total_cost = calcFixedCost(shippingBOMPaddedEnvelope.line_items);
shippingBOMPaddedEnvelope.variable_cost = calcVariableCost(shippingBOMPaddedEnvelope.line_items);

const shippingBOMPremiumBox: BOMTemplate = {
  bom_id: 'bom-ship-premium',
  name: 'SHIP-004 · Premium Shipping Box',
  description: 'Premium shipping for gift sets and high-value orders. Double-walled box, extra bubble wrap, tissue paper, ribbon, and branded tape.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-shipping-box', 1, 1),
    makeLineItem('comp-bubble-wrap', 3, 2),
    makeLineItem('comp-tissue', 2, 3),
    makeLineItem('comp-ribbon', 1, 4),
    makeLineItem('comp-shipping-tape', 1, 5),
    makeLineItem('comp-thank-you-card', 1, 10),
    makeLineItem('comp-label-box', 1, 11),
    makeLineItem('comp-seal-sticker', 1, 12),
    makeLineItem('comp-discount-card', 1, 13, true),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-11-15T10:00:00Z',
  updated_at: '2026-02-01T14:30:00Z',
  created_by: 'karim',
};
shippingBOMPremiumBox.total_cost = calcFixedCost(shippingBOMPremiumBox.line_items);
shippingBOMPremiumBox.variable_cost = calcVariableCost(shippingBOMPremiumBox.line_items);

// Export all shipping BOMs
export const shippingBOMs: BOMTemplate[] = [
  shippingBOMBag,
  shippingBOMStandardBox,
  shippingBOMPaddedEnvelope,
  shippingBOMPremiumBox,
];

// Legacy alias for backward compatibility
export const shippingBOM: BOMTemplate = shippingBOMStandardBox;

// ============================================================
// PRODUCT BOMs — Per-product component lists
// ============================================================

const bomStandardOneTime: BOMTemplate = {
  bom_id: 'bom-std-onetime',
  name: 'Standard One-Time Decant',
  description: 'Single decant order (any size). Mailer box, tissue, perfume card, complimentary sample.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-perfume-5ml', 1, 1),
    makeLineItem('comp-atm-5ml', 1, 2),
    makeLineItem('comp-label-decant', 1, 3),
    makeLineItem('comp-box-standard', 1, 10),
    makeLineItem('comp-tissue', 2, 11),
    makeLineItem('comp-perfume-card', 1, 20),
    makeLineItem('comp-complimentary-1ml', 1, 21, true),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-12-01T10:00:00Z',
  updated_at: '2026-01-15T14:30:00Z',
  created_by: 'karim',
};
bomStandardOneTime.total_cost = calcFixedCost(bomStandardOneTime.line_items);
bomStandardOneTime.variable_cost = calcVariableCost(bomStandardOneTime.line_items);

const bomSubExplorer: BOMTemplate = {
  bom_id: 'bom-sub-gm1',
  name: 'Grand Master 1 Subscription Box',
  description: '1x 7.5ml Aura Key vial, premium atomiser, aura booklet, ritual card.',
  status: 'active',
  version: 2,
  line_items: [
    makeLineItem('comp-perfume-75ml', 3, 1),
    makeLineItem('comp-atm-premium', 1, 2),
    makeLineItem('comp-atm-8ml', 3, 3),
    makeLineItem('comp-label-decant', 3, 4),
    makeLineItem('comp-box-premium', 1, 10),
    makeLineItem('comp-inlay-3', 1, 11),
    makeLineItem('comp-sleeve-gold', 1, 12),
    makeLineItem('comp-tissue', 3, 13),
    makeLineItem('comp-ribbon', 1, 14),
    makeLineItem('comp-aura-booklet', 1, 20),
    makeLineItem('comp-ritual-card', 1, 21),
    makeLineItem('comp-perfume-card', 3, 23),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-11-15T10:00:00Z',
  updated_at: '2026-01-20T09:00:00Z',
  created_by: 'karim',
};
bomSubExplorer.total_cost = calcFixedCost(bomSubExplorer.line_items);
bomSubExplorer.variable_cost = calcVariableCost(bomSubExplorer.line_items);

const bomSubAlchemist: BOMTemplate = {
  bom_id: 'bom-sub-gm2',
  name: 'Grand Master 2 Subscription Box',
  description: '2x 7.5ml Aura Key vials, premium atomiser, collector box, aura booklet.',
  status: 'active',
  version: 2,
  line_items: [
    makeLineItem('comp-perfume-75ml', 5, 1),
    makeLineItem('comp-atm-premium', 1, 2),
    makeLineItem('comp-atm-8ml', 5, 3),
    makeLineItem('comp-label-decant', 5, 4),
    makeLineItem('comp-box-collector', 1, 10),
    makeLineItem('comp-inlay-5', 1, 11),
    makeLineItem('comp-sleeve-gold', 1, 12),
    makeLineItem('comp-tissue', 5, 13),
    makeLineItem('comp-ribbon', 1, 14),
    makeLineItem('comp-pouch-velvet', 1, 15),
    makeLineItem('comp-aura-booklet', 1, 20),
    makeLineItem('comp-ritual-card', 1, 21),
    makeLineItem('comp-perfume-card', 5, 23),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-11-15T10:00:00Z',
  updated_at: '2026-01-20T09:00:00Z',
  created_by: 'karim',
};
bomSubAlchemist.total_cost = calcFixedCost(bomSubAlchemist.line_items);
bomSubAlchemist.variable_cost = calcVariableCost(bomSubAlchemist.line_items);

const bomSubConnoisseur: BOMTemplate = {
  bom_id: 'bom-sub-connoisseur',
  name: 'Connoisseur Subscription Box',
  description: '7x 7.5ml Aura Key vials, premium atomiser, collector box, full aura set.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-perfume-75ml', 7, 1),
    makeLineItem('comp-atm-premium', 1, 2),
    makeLineItem('comp-atm-8ml', 7, 3),
    makeLineItem('comp-label-decant', 7, 4),
    makeLineItem('comp-box-collector', 1, 10),
    makeLineItem('comp-inlay-7', 1, 11),
    makeLineItem('comp-sleeve-gold', 1, 12),
    makeLineItem('comp-tissue', 7, 13),
    makeLineItem('comp-ribbon', 1, 14),
    makeLineItem('comp-pouch-velvet', 1, 15),
    makeLineItem('comp-aura-booklet', 1, 20),
    makeLineItem('comp-ritual-card', 1, 21),
    makeLineItem('comp-perfume-card', 7, 23),
    makeLineItem('comp-complimentary-1ml', 2, 24, true),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-11-15T10:00:00Z',
  updated_at: '2026-02-01T09:00:00Z',
  created_by: 'karim',
};
bomSubConnoisseur.total_cost = calcFixedCost(bomSubConnoisseur.line_items);
bomSubConnoisseur.variable_cost = calcVariableCost(bomSubConnoisseur.line_items);

const bomEmSetTraveler: BOMTemplate = {
  bom_id: 'bom-emset-traveler',
  name: 'Em Set — The Traveler',
  description: 'Build-your-own set: 3 decants (5ml or 10ml), standard box, foam inlay.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-perfume-5ml', 3, 1),
    makeLineItem('comp-atm-5ml', 3, 2),
    makeLineItem('comp-label-decant', 3, 3),
    makeLineItem('comp-box-standard', 1, 10),
    makeLineItem('comp-inlay-3', 1, 11),
    makeLineItem('comp-tissue', 2, 12),
    makeLineItem('comp-perfume-card', 3, 20),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-12-01T10:00:00Z',
  updated_at: '2026-01-10T14:30:00Z',
  created_by: 'karim',
};
bomEmSetTraveler.total_cost = calcFixedCost(bomEmSetTraveler.line_items);
bomEmSetTraveler.variable_cost = calcVariableCost(bomEmSetTraveler.line_items);

const bomEmSetConnoisseur: BOMTemplate = {
  bom_id: 'bom-emset-connoisseur',
  name: 'Em Set — The Connoisseur',
  description: 'Build-your-own premium set: 5 decants (10ml or 20ml), premium gift box, velvet pouch.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-perfume-10ml', 5, 1),
    makeLineItem('comp-atm-10ml', 5, 2),
    makeLineItem('comp-label-decant', 5, 3),
    makeLineItem('comp-box-premium', 1, 10),
    makeLineItem('comp-inlay-5', 1, 11),
    makeLineItem('comp-sleeve-gold', 1, 12),
    makeLineItem('comp-tissue', 3, 13),
    makeLineItem('comp-ribbon', 1, 14),
    makeLineItem('comp-pouch-velvet', 1, 15),
    makeLineItem('comp-perfume-card', 5, 20),
    makeLineItem('comp-aura-booklet', 1, 21),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2025-12-01T10:00:00Z',
  updated_at: '2026-01-10T14:30:00Z',
  created_by: 'karim',
};
bomEmSetConnoisseur.total_cost = calcFixedCost(bomEmSetConnoisseur.line_items);
bomEmSetConnoisseur.variable_cost = calcVariableCost(bomEmSetConnoisseur.line_items);

const bomAuraPlaySampler: BOMTemplate = {
  bom_id: 'bom-auraplay-sampler',
  name: 'Aura Play — Sampler',
  description: 'Discovery sampler: 7x 1ml vials across all 7 Auras, compact box.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-vial-1ml', 7, 1),
    makeLineItem('comp-label-decant', 7, 2),
    makeLineItem('comp-box-standard', 1, 10),
    makeLineItem('comp-inlay-7', 1, 11),
    makeLineItem('comp-perfume-card', 7, 20),
    makeLineItem('comp-aura-booklet', 1, 21),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2026-01-05T10:00:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  created_by: 'karim',
};
bomAuraPlaySampler.total_cost = calcFixedCost(bomAuraPlaySampler.line_items);
bomAuraPlaySampler.variable_cost = calcVariableCost(bomAuraPlaySampler.line_items);

const bomDiscoveryBundle: BOMTemplate = {
  bom_id: 'bom-discovery-bundle',
  name: 'Discovery Box Bundle',
  description: 'Curated box bundle: 5x 5ml decants, premium box, aura booklet.',
  status: 'active',
  version: 1,
  line_items: [
    makeLineItem('comp-perfume-5ml', 5, 1),
    makeLineItem('comp-atm-5ml', 5, 2),
    makeLineItem('comp-label-decant', 5, 3),
    makeLineItem('comp-box-premium', 1, 10),
    makeLineItem('comp-inlay-5', 1, 11),
    makeLineItem('comp-tissue', 3, 12),
    makeLineItem('comp-ribbon', 1, 13),
    makeLineItem('comp-perfume-card', 5, 20),
    makeLineItem('comp-aura-booklet', 1, 21),
  ],
  total_cost: 0,
  variable_cost: 0,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-02-01T14:30:00Z',
  created_by: 'karim',
};
bomDiscoveryBundle.total_cost = calcFixedCost(bomDiscoveryBundle.line_items);
bomDiscoveryBundle.variable_cost = calcVariableCost(bomDiscoveryBundle.line_items);

// ---- Export all templates ----
export const bomTemplates: BOMTemplate[] = [
  bomStandardOneTime,
  bomSubExplorer,
  bomSubAlchemist,
  bomSubConnoisseur,
  bomEmSetTraveler,
  bomEmSetConnoisseur,
  bomAuraPlaySampler,
  bomDiscoveryBundle,
];

// ============================================================
// END PRODUCTS — with photos, tags, fixed prices
// ============================================================
export const endProducts: EndProduct[] = [
  {
    product_id: 'ep-std-decant',
    name: 'Standard Decant Order',
    sku: 'EM/PRD/STD-DECANT',
    category: 'single_aurakey',
    description: 'Single perfume decant in any available size (5ml, 10ml, 20ml).',
    image_url: `${IMG}/200x200/1a1a2e/c9a961?text=Standard+Decant`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-bag',
    shipping_bom: shippingBOMBag,
    shopify_product_id: 'shopify_8901234567',
    fixed_price: bomStandardOneTime.total_cost,
    variable_price: bomStandardOneTime.variable_cost,
    shipping_cost: shippingBOMBag.total_cost,
    selling_price: 89,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 2.8,
    tags: ['bestseller', 'core'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-15T14:30:00Z',
  },
  {
    product_id: 'ep-sub-gm1',
    name: 'Aura Key — Grand Master 1',
    sku: 'EM/PRD/SUB-GM1',
    category: 'monthly_subscription',
    description: 'Monthly subscription: 1 curated 7.5ml Aura Key vial with premium atomiser.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=GM1+Sub`,
    bom_id: 'bom-sub-gm1',
    bom: bomSubExplorer,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_8901234568',
    fixed_price: bomSubExplorer.total_cost,
    variable_price: bomSubExplorer.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 399,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 2.5,
    tags: ['subscription', 'popular'],
    active: true,
    created_at: '2025-11-15T10:00:00Z',
    updated_at: '2026-01-20T09:00:00Z',
  },
  {
    product_id: 'ep-sub-gm2',
    name: 'Aura Key — Grand Master 2',
    sku: 'EM/PRD/SUB-GM2',
    category: 'monthly_subscription',
    description: 'Monthly subscription: 2 curated 7.5ml Aura Key vials with collector box.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=GM2+Sub`,
    bom_id: 'bom-sub-gm2',
    bom: bomSubAlchemist,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_8901234569',
    fixed_price: bomSubAlchemist.total_cost,
    variable_price: bomSubAlchemist.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 599,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 2.5,
    tags: ['subscription', 'premium'],
    active: true,
    created_at: '2025-11-15T10:00:00Z',
    updated_at: '2026-01-20T09:00:00Z',
  },
  {
    product_id: 'ep-sub-connoisseur',
    name: 'Aura Key — Connoisseur',
    sku: 'EM/PRD/SUB-CONNOISSEUR',
    category: 'monthly_subscription',
    description: 'Monthly subscription: 7 curated 7.5ml Aura Key vials, full aura set, collector box.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=Connoisseur+Sub`,
    bom_id: 'bom-sub-connoisseur',
    bom: bomSubConnoisseur,
    shipping_bom_id: 'bom-ship-premium',
    shipping_bom: shippingBOMPremiumBox,
    shopify_product_id: 'shopify_8901234570',
    fixed_price: bomSubConnoisseur.total_cost,
    variable_price: bomSubConnoisseur.variable_cost,
    shipping_cost: shippingBOMPremiumBox.total_cost,
    selling_price: 899,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 2.5,
    tags: ['subscription', 'luxury', 'limited'],
    active: true,
    created_at: '2025-11-15T10:00:00Z',
    updated_at: '2026-02-01T09:00:00Z',
  },
  {
    product_id: 'ep-emset-traveler',
    name: 'Em Set — The Traveler',
    sku: 'EM/PRD/EMSET-TRAVELER',
    category: 'capsule_themed_set',
    description: 'Build-your-own set: choose 3 perfumes in 5ml or 10ml decants.',
    image_url: `${IMG}/200x200/2d5a27/c9a961?text=Traveler+Set`,
    bom_id: 'bom-emset-traveler',
    bom: bomEmSetTraveler,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_8901234571',
    fixed_price: bomEmSetTraveler.total_cost,
    variable_price: bomEmSetTraveler.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 249,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 3,
    tags: ['em-set', 'build-your-own'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-10T14:30:00Z',
  },
  {
    product_id: 'ep-emset-connoisseur',
    name: 'Em Set — The Connoisseur',
    sku: 'EM/PRD/EMSET-CONNOISSEUR',
    category: 'capsule_themed_set',
    description: 'Premium build-your-own set: choose 5 perfumes in 10ml or 20ml, gift box.',
    image_url: `${IMG}/200x200/2d5a27/c9a961?text=Connoisseur+Set`,
    bom_id: 'bom-emset-connoisseur',
    bom: bomEmSetConnoisseur,
    shipping_bom_id: 'bom-ship-premium',
    shipping_bom: shippingBOMPremiumBox,
    shopify_product_id: 'shopify_8901234572',
    fixed_price: bomEmSetConnoisseur.total_cost,
    variable_price: bomEmSetConnoisseur.variable_cost,
    shipping_cost: shippingBOMPremiumBox.total_cost,
    selling_price: 699,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 2.5,
    tags: ['em-set', 'premium', 'gift'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-10T14:30:00Z',
  },
  {
    product_id: 'ep-auraplay-sampler',
    name: 'Aura Play — Sampler',
    sku: 'EM/PRD/AURAPLAY-SAMPLER',
    category: 'whisperer_set',
    description: 'Discovery sampler: 7x 1ml vials across all 7 Auras.',
    image_url: `${IMG}/200x200/8b0000/c9a961?text=Aura+Sampler`,
    bom_id: 'bom-auraplay-sampler',
    bom: bomAuraPlaySampler,
    shipping_bom_id: 'bom-ship-padded',
    shipping_bom: shippingBOMPaddedEnvelope,
    shopify_product_id: 'shopify_8901234573',
    fixed_price: bomAuraPlaySampler.total_cost,
    variable_price: bomAuraPlaySampler.variable_cost,
    shipping_cost: shippingBOMPaddedEnvelope.total_cost,
    selling_price: 49,
    selling_price_method: 'manual' as const,
    tags: ['aura-play', 'discovery', 'new'],
    active: true,
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
  },
  {
    product_id: 'ep-discovery-bundle',
    name: 'Discovery Box Bundle',
    sku: 'EM/PRD/DISCOVERY-BUNDLE',
    category: 'capsule_layering_set',
    description: 'Curated box bundle: 5x 5ml decants of our top-rated perfumes.',
    image_url: `${IMG}/200x200/1a3a5c/c9a961?text=Discovery+Box`,
    bom_id: 'bom-discovery-bundle',
    bom: bomDiscoveryBundle,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_8901234574',
    fixed_price: bomDiscoveryBundle.total_cost,
    variable_price: bomDiscoveryBundle.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 349,
    selling_price_method: 'multiplier' as const,
    selling_price_multiplier: 2.5,
    tags: ['bundle', 'curated', 'gift'],
    active: true,
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-02-01T14:30:00Z',
  },
  // ---- Gift Set Seasonal ----
  {
    product_id: 'ep-gs-valentines',
    name: 'Valentine\'s Ritual Box',
    sku: 'EM/PRD/GS-VALENTINES',
    category: 'gift_set_seasonal',
    description: 'Limited edition Valentine\'s set: 3 romantic fragrances with chocolate pairing and red velvet wrap.',
    image_url: `${IMG}/200x200/8b0000/c9a961?text=Valentine+Box`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-premium',
    shipping_bom: shippingBOMPremiumBox,
    shopify_product_id: 'shopify_9001001',
    fixed_price: 85,
    variable_price: 42,
    shipping_cost: shippingBOMPremiumBox.total_cost,
    selling_price: 520,
    selling_price_method: 'manual' as const,
    tags: ['seasonal', 'valentines', 'limited', 'gift'],
    active: true,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-02-01T14:30:00Z',
  },
  {
    product_id: 'ep-gs-ramadan',
    name: 'Ramadan Oud Collection',
    sku: 'EM/PRD/GS-RAMADAN',
    category: 'gift_set_seasonal',
    description: 'Ramadan gift set: 4 premium oud-based fragrances in a crescent moon gift box.',
    image_url: `${IMG}/200x200/2d1b69/c9a961?text=Ramadan+Oud`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-premium',
    shipping_bom: shippingBOMPremiumBox,
    shopify_product_id: 'shopify_9001002',
    fixed_price: 110,
    variable_price: 55,
    shipping_cost: shippingBOMPremiumBox.total_cost,
    selling_price: 680,
    selling_price_method: 'manual' as const,
    tags: ['seasonal', 'ramadan', 'oud', 'premium'],
    active: true,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-15T14:30:00Z',
  },
  {
    product_id: 'ep-gs-summer-escape',
    name: 'Summer Escape Set',
    sku: 'EM/PRD/GS-SUMMER',
    category: 'gift_set_seasonal',
    description: 'Summer collection: 3 fresh citrus & aquatic fragrances with travel pouch.',
    image_url: `${IMG}/200x200/0d6efd/c9a961?text=Summer+Escape`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_9001003',
    fixed_price: 65,
    variable_price: 32,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 380,
    selling_price_method: 'manual' as const,
    tags: ['seasonal', 'summer', 'fresh'],
    active: false,
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-09-01T14:30:00Z',
  },
  // ---- Gift Set For Him ----
  {
    product_id: 'ep-gsh-gentleman',
    name: 'The Gentleman\'s Edit',
    sku: 'EM/PRD/GSH-GENTLEMAN',
    category: 'gift_set_him',
    description: 'Curated set of 3 masculine fragrances: woody, leather, and spice notes.',
    image_url: `${IMG}/200x200/1a1a2e/c9a961?text=Gentleman+Edit`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-premium',
    shipping_bom: shippingBOMPremiumBox,
    shopify_product_id: 'shopify_9001004',
    fixed_price: 75,
    variable_price: 38,
    shipping_cost: shippingBOMPremiumBox.total_cost,
    selling_price: 450,
    selling_price_method: 'manual' as const,
    tags: ['gift', 'for-him', 'masculine'],
    active: true,
    created_at: '2025-11-01T10:00:00Z',
    updated_at: '2026-01-15T14:30:00Z',
  },
  // ---- Gift Set For Her ----
  {
    product_id: 'ep-gshr-rose-oud',
    name: 'Rose & Oud Discovery',
    sku: 'EM/PRD/GSHR-ROSEOUD',
    category: 'gift_set_her',
    description: 'Explore rose and oud with 4 curated vials in a silk-lined box.',
    image_url: `${IMG}/200x200/8b2252/c9a961?text=Rose+Oud`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_9001005',
    fixed_price: 60,
    variable_price: 30,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 380,
    selling_price_method: 'manual' as const,
    tags: ['gift', 'for-her', 'rose', 'oud'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-10T14:30:00Z',
  },
  // ---- Gift Subscription ----
  {
    product_id: 'ep-gsub-3mo-2v',
    name: 'Gift AuraKey 3-Month (2 Vials)',
    sku: 'EM/PRD/GSUB-3M-2V',
    category: 'gift_subscription',
    description: '3-month gift subscription: 2 vials per month, curated selections.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=Gift+3M+2V`,
    bom_id: 'bom-sub-explorer',
    bom: bomSubExplorer,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_9001006',
    fixed_price: bomSubExplorer.total_cost,
    variable_price: bomSubExplorer.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 450,
    selling_price_method: 'manual' as const,
    tags: ['gift', 'subscription', '3-month'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
  },
  {
    product_id: 'ep-gsub-6mo-1v',
    name: 'Gift AuraKey 6-Month (1 Vial)',
    sku: 'EM/PRD/GSUB-6M-1V',
    category: 'gift_subscription',
    description: '6-month gift subscription: 1 vial per month, perfect introduction.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=Gift+6M+1V`,
    bom_id: 'bom-sub-explorer',
    bom: bomSubExplorer,
    shipping_bom_id: 'bom-ship-bag',
    shipping_bom: shippingBOMBag,
    shopify_product_id: 'shopify_9001007',
    fixed_price: bomSubExplorer.total_cost,
    variable_price: bomSubExplorer.variable_cost,
    shipping_cost: shippingBOMBag.total_cost,
    selling_price: 540,
    selling_price_method: 'manual' as const,
    tags: ['gift', 'subscription', '6-month'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
  },
  {
    product_id: 'ep-gsub-12mo-3v',
    name: 'Gift AuraKey 12-Month (3 Vials)',
    sku: 'EM/PRD/GSUB-12M-3V',
    category: 'gift_subscription',
    description: '12-month gift subscription: 3 vials per month, the ultimate fragrance journey.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=Gift+12M+3V`,
    bom_id: 'bom-sub-alchemist',
    bom: bomSubAlchemist,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_9001008',
    fixed_price: bomSubAlchemist.total_cost,
    variable_price: bomSubAlchemist.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 2160,
    selling_price_method: 'manual' as const,
    tags: ['gift', 'subscription', '12-month', 'premium'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
  },
  // ---- Corporate Subscription ----
  {
    product_id: 'ep-corp-2v',
    name: 'Corporate AuraKey (2 Vials)',
    sku: 'EM/PRD/CORP-2V',
    category: 'corporate_subscription',
    description: 'Corporate subscription: 2 vials per employee per month with branded packaging.',
    image_url: `${IMG}/200x200/1a1a2e/c9a961?text=Corp+2V`,
    bom_id: 'bom-sub-explorer',
    bom: bomSubExplorer,
    shipping_bom_id: 'bom-ship-std-box',
    shipping_bom: shippingBOMStandardBox,
    shopify_product_id: 'shopify_9001009',
    fixed_price: bomSubExplorer.total_cost,
    variable_price: bomSubExplorer.variable_cost,
    shipping_cost: shippingBOMStandardBox.total_cost,
    selling_price: 110,
    selling_price_method: 'manual' as const,
    tags: ['corporate', 'b2b'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
  },
  // ---- AuraKEY Refills ----
  {
    product_id: 'ep-refill-5ml',
    name: 'AuraKEY Refill — 5ml',
    sku: 'EM/PRD/REFILL-5ML',
    category: 'aurakey_refills',
    description: 'Single 5ml refill vial of any available perfume.',
    image_url: `${IMG}/200x200/0d6efd/c9a961?text=Refill+5ml`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-padded',
    shipping_bom: shippingBOMPaddedEnvelope,
    shopify_product_id: 'shopify_9001010',
    fixed_price: bomStandardOneTime.total_cost,
    variable_price: bomStandardOneTime.variable_cost,
    shipping_cost: shippingBOMPaddedEnvelope.total_cost,
    selling_price: 45,
    selling_price_method: 'manual' as const,
    tags: ['refill', 'core'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-15T14:30:00Z',
  },
  {
    product_id: 'ep-refill-10ml',
    name: 'AuraKEY Refill — 10ml',
    sku: 'EM/PRD/REFILL-10ML',
    category: 'aurakey_refills',
    description: 'Single 10ml refill vial of any available perfume.',
    image_url: `${IMG}/200x200/0d6efd/c9a961?text=Refill+10ml`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-padded',
    shipping_bom: shippingBOMPaddedEnvelope,
    shopify_product_id: 'shopify_9001011',
    fixed_price: bomStandardOneTime.total_cost,
    variable_price: bomStandardOneTime.variable_cost,
    shipping_cost: shippingBOMPaddedEnvelope.total_cost,
    selling_price: 75,
    selling_price_method: 'manual' as const,
    tags: ['refill', 'core'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-15T14:30:00Z',
  },
  // ---- First Time Subscription ----
  {
    product_id: 'ep-fts-welcome',
    name: 'Welcome AuraKey — First Month',
    sku: 'EM/PRD/FTS-WELCOME',
    category: 'first_time_subscription',
    description: 'First-time subscriber welcome box with 2 curated vials + welcome card.',
    image_url: `${IMG}/200x200/4a0e4e/c9a961?text=Welcome+Box`,
    bom_id: 'bom-sub-explorer',
    bom: bomSubExplorer,
    shipping_bom_id: 'bom-ship-premium',
    shipping_bom: shippingBOMPremiumBox,
    shopify_product_id: 'shopify_9001012',
    fixed_price: bomSubExplorer.total_cost,
    variable_price: bomSubExplorer.variable_cost,
    shipping_cost: shippingBOMPremiumBox.total_cost,
    selling_price: 149,
    selling_price_method: 'manual' as const,
    tags: ['first-time', 'welcome', 'onboarding'],
    active: true,
    created_at: '2025-11-01T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
  },
  // ---- Gift Card ----
  {
    product_id: 'ep-gc-500',
    name: 'Em Gift Card — AED 500',
    sku: 'EM/PRD/GC-500',
    category: 'gift_card',
    description: 'Digital gift card worth AED 500, redeemable on any Maison Em product.',
    image_url: `${IMG}/200x200/c9a961/1a1a2e?text=Gift+Card+500`,
    bom_id: 'bom-std-onetime',
    bom: bomStandardOneTime,
    shipping_bom_id: 'bom-ship-padded',
    shipping_bom: shippingBOMPaddedEnvelope,
    shopify_product_id: 'shopify_9001013',
    fixed_price: 0,
    variable_price: 0,
    shipping_cost: 0,
    selling_price: 500,
    selling_price_method: 'manual' as const,
    tags: ['gift-card', 'digital'],
    active: true,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-15T14:30:00Z',
  },
];

// ============================================================
// ORDER TYPE → BOM MAPPINGS
// ============================================================
export const orderTypeBOMMappings: OrderTypeBOMMapping[] = [
  { mapping_id: 'map-1', order_type_tag: 'standard_one_time', order_type_label: 'Standard One-Time Order', product_id: 'ep-std-decant', bom_id: 'bom-std-onetime', auto_apply: true, created_at: '2025-12-01' },
  { mapping_id: 'map-2', order_type_tag: 'subscription_gm1', order_type_label: 'Grand Master 1 Subscription', product_id: 'ep-sub-gm1', bom_id: 'bom-sub-gm1', auto_apply: true, created_at: '2025-11-15' },
  { mapping_id: 'map-3', order_type_tag: 'subscription_gm2', order_type_label: 'Grand Master 2 Subscription', product_id: 'ep-sub-gm2', bom_id: 'bom-sub-gm2', auto_apply: true, created_at: '2025-11-15' },
  { mapping_id: 'map-4', order_type_tag: 'subscription_gm3', order_type_label: 'Grand Master 3 Subscription', product_id: 'ep-sub-connoisseur', bom_id: 'bom-sub-connoisseur', auto_apply: true, created_at: '2025-11-15' },
  { mapping_id: 'map-9', order_type_tag: 'subscription_gm4', order_type_label: 'Grand Master 4 Subscription', product_id: 'ep-sub-gm4', bom_id: 'bom-sub-gm4', auto_apply: true, created_at: '2025-11-15' },
  { mapping_id: 'map-5', order_type_tag: 'em_set_traveler', order_type_label: 'Em Set — Traveler', product_id: 'ep-emset-traveler', bom_id: 'bom-emset-traveler', auto_apply: true, created_at: '2025-12-01' },
  { mapping_id: 'map-6', order_type_tag: 'em_set_connoisseur', order_type_label: 'Em Set — Connoisseur', product_id: 'ep-emset-connoisseur', bom_id: 'bom-emset-connoisseur', auto_apply: true, created_at: '2025-12-01' },
  { mapping_id: 'map-7', order_type_tag: 'aura_play_sampler', order_type_label: 'Aura Play — Sampler', product_id: 'ep-auraplay-sampler', bom_id: 'bom-auraplay-sampler', auto_apply: true, created_at: '2026-01-05' },
  { mapping_id: 'map-8', order_type_tag: 'box_bundle', order_type_label: 'Discovery Box Bundle', product_id: 'ep-discovery-bundle', bom_id: 'bom-discovery-bundle', auto_apply: true, created_at: '2026-01-10' },
];

// ============================================================
// MASTER BOM COMPILER — Deduplication Logic
// ============================================================

/** Resolve which product BOMs apply to an order based on type/tier/tags */
export function resolveBOMsForOrder(
  orderType: string,
  subscriptionTier?: string,
  tags?: string[],
): BOMTemplate[] {
  const results: BOMTemplate[] = [];
  for (const mapping of orderTypeBOMMappings) {
    let match = false;
    if (orderType === 'one_time' && mapping.order_type_tag === 'standard_one_time') match = true;
    if (orderType === 'subscription') {
      if ((subscriptionTier === 'Grand Master 1' || subscriptionTier === 'GM1' || subscriptionTier === 'Explorer') && mapping.order_type_tag === 'subscription_gm1') match = true;
      if ((subscriptionTier === 'Grand Master 2' || subscriptionTier === 'GM2' || subscriptionTier === 'Alchemist') && mapping.order_type_tag === 'subscription_gm2') match = true;
      if ((subscriptionTier === 'Grand Master 3' || subscriptionTier === 'GM3' || subscriptionTier === 'Grand Master' || subscriptionTier === 'Connoisseur') && mapping.order_type_tag === 'subscription_gm3') match = true;
      if ((subscriptionTier === 'Grand Master 4' || subscriptionTier === 'GM4') && mapping.order_type_tag === 'subscription_gm4') match = true;
    }
    if (tags?.includes('em_set_traveler') && mapping.order_type_tag === 'em_set_traveler') match = true;
    if (tags?.includes('em_set_connoisseur') && mapping.order_type_tag === 'em_set_connoisseur') match = true;
    if (tags?.includes('aura_play_sampler') && mapping.order_type_tag === 'aura_play_sampler') match = true;
    if (tags?.includes('box_bundle') && mapping.order_type_tag === 'box_bundle') match = true;
    if (match) {
      const bom = bomTemplates.find(b => b.bom_id === mapping.bom_id);
      if (bom) results.push(bom);
    }
  }
  return results.length > 0 ? results : [bomStandardOneTime];
}

/**
 * Compile a Master BOM for an order.
 * Combines Shipping BOM + Product BOMs, deduplicating common items.
 * Common items (thank you card, seal, bubble wrap, etc.) appear only once per order.
 */
export function compileMasterBOM(
  orderId: string,
  productBoms: { product_name: string; bom: BOMTemplate }[],
): MasterBOM {
  const commonIds = new Set<string>(COMMON_COMPONENT_IDS);
  const lineMap = new Map<string, MasterBOMLine>();

  // 1. Add shipping BOM lines
  for (const li of shippingBOM.line_items) {
    lineMap.set(li.component_id, {
      component_id: li.component_id,
      component: li.component,
      qty: li.qty,
      layer: 'shipping',
      source_bom_ids: [shippingBOM.bom_id],
      deduplicated: false,
    });
  }

  // 2. Add product BOM lines, deduplicating common items
  let dedupSavings = 0;
  for (const { bom } of productBoms) {
    for (const li of bom.line_items) {
      const existing = lineMap.get(li.component_id);
      if (existing) {
        // Common item already in shipping or another product BOM
        if (commonIds.has(li.component_id)) {
          // Don't add again — mark as deduplicated
          if (!existing.source_bom_ids.includes(bom.bom_id)) {
            existing.source_bom_ids.push(bom.bom_id);
          }
          existing.deduplicated = true;
          dedupSavings += li.qty;
        } else {
          // Non-common item: accumulate quantity
          existing.qty += li.qty;
          if (!existing.source_bom_ids.includes(bom.bom_id)) {
            existing.source_bom_ids.push(bom.bom_id);
          }
          existing.layer = 'product';
        }
      } else {
        lineMap.set(li.component_id, {
          component_id: li.component_id,
          component: li.component,
          qty: li.qty,
          layer: 'product',
          source_bom_ids: [bom.bom_id],
          deduplicated: false,
        });
      }
    }
  }

  const compiled = Array.from(lineMap.values());
  const totalFixedCost = compiled
    .filter(l => !l.component.is_variable)
    .reduce((s, l) => s + l.qty * l.component.unit_cost, 0);

  return {
    order_id: orderId,
    shipping_bom: shippingBOM,
    product_boms: productBoms,
    compiled_lines: compiled,
    total_fixed_cost: totalFixedCost,
    total_components: compiled.length,
    dedup_savings: dedupSavings,
  };
}

// ============================================================
// PICKING LIST GENERATOR
// ============================================================

/** Generate aggregated picking list from multiple orders' Master BOMs */
export function generateBOMPickList(
  orders: { order_id: string; type: string; subscription_tier?: string; tags?: string[] }[]
): BOMPickListItem[] {
  const componentMap = new Map<string, BOMPickListItem>();

  for (const order of orders) {
    const productBoms = resolveBOMsForOrder(order.type, order.subscription_tier, order.tags);
    const masterBOM = compileMasterBOM(order.order_id, productBoms.map(b => ({ product_name: b.name, bom: b })));

    for (const line of masterBOM.compiled_lines) {
      const existing = componentMap.get(line.component_id);
      if (existing) {
        existing.total_qty_needed += line.qty;
        if (!existing.orders_needing.includes(order.order_id)) {
          existing.orders_needing.push(order.order_id);
        }
      } else {
        componentMap.set(line.component_id, {
          component_id: line.component_id,
          component: line.component,
          total_qty_needed: line.qty,
          qty_picked: 0,
          orders_needing: [order.order_id],
          picked: false,
        });
      }
    }
  }

  const catOrder: BOMComponentCategory[] = ['shipping', 'packaging', 'atomizer', 'perfume', 'insert', 'label', 'accessory'];
  return Array.from(componentMap.values()).sort((a, b) =>
    catOrder.indexOf(a.component.category) - catOrder.indexOf(b.component.category)
  );
}

/** Generate per-order BOM breakdown for fulfillment */
export function generateBOMOrderBreakdown(
  orders: { order_id: string; type: string; subscription_tier?: string; tags?: string[] }[]
): BOMOrderBreakdown[] {
  const breakdowns: BOMOrderBreakdown[] = [];
  for (const order of orders) {
    const boms = resolveBOMsForOrder(order.type, order.subscription_tier, order.tags);
    for (const bom of boms) {
      breakdowns.push({
        order_id: order.order_id,
        order_type_tag: (orderTypeBOMMappings.find(m => m.bom_id === bom.bom_id)?.order_type_tag || 'custom') as OrderTypeTag,
        bom_id: bom.bom_id,
        bom_name: bom.name,
        line_items: bom.line_items.map(li => ({ ...li, fulfilled: false })),
      });
    }
  }
  return breakdowns;
}

/** Calculate inventory impact of fulfilling a set of orders */
export function calculateBOMInventoryImpact(
  orders: { order_id: string; type: string; subscription_tier?: string; tags?: string[] }[],
  currentStock: Map<string, number>
): BOMInventoryImpact[] {
  const requirements = new Map<string, { name: string; source: any; ref?: string; qty: number }>();

  for (const order of orders) {
    const productBoms = resolveBOMsForOrder(order.type, order.subscription_tier, order.tags);
    const masterBOM = compileMasterBOM(order.order_id, productBoms.map(b => ({ product_name: b.name, bom: b })));

    for (const line of masterBOM.compiled_lines) {
      if (line.component.is_variable) continue;
      const existing = requirements.get(line.component_id);
      if (existing) {
        existing.qty += line.qty;
      } else {
        requirements.set(line.component_id, {
          name: line.component.name,
          source: line.component.source,
          ref: line.component.source_ref_id,
          qty: line.qty,
        });
      }
    }
  }

  const impacts: BOMInventoryImpact[] = [];
  for (const [compId, req] of Array.from(requirements)) {
    const available = currentStock.get(compId) || 0;
    const shortage = Math.max(0, req.qty - available);
    impacts.push({
      component_id: compId,
      component_name: req.name,
      source: req.source,
      source_ref_id: req.ref,
      qty_required: req.qty,
      qty_available: available,
      shortage,
      status: shortage > 0 ? (available === 0 ? 'out_of_stock' : 'low') : 'ok',
    });
  }

  return impacts.sort((a, b) => {
    const statusOrder = { out_of_stock: 0, low: 1, ok: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
}

/** Component category display labels */
export const componentCategoryLabels: Record<BOMComponentCategory, string> = {
  perfume: 'Perfumes',
  atomizer: 'Atomizers & Vials',
  packaging: 'Packaging',
  insert: 'Inserts & Cards',
  accessory: 'Accessories',
  label: 'Labels',
  shipping: 'Shipping',
};
