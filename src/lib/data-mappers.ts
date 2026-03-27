/**
 * Data Mappers — convert DB rows (camelCase from Drizzle) to frontend types (snake_case).
 * These are used in the tRPC hooks layer so page components don't need to change.
 */

import type {
  Perfume, Brand, Supplier, SupplierPurchase, Syringe, PackagingSKU,
  VaultLocation, InventoryBottle, DecantBottle, Order, Job,
  BottleLedgerEvent, DecantLedgerEvent, SubscriptionCycle, PrintJob,
  InventoryAlert,
} from '@/types';

// Helper: convert Date to ISO string
const ts = (d: Date | string | null | undefined): string =>
  d instanceof Date ? d.toISOString() : (d ?? '');

// Helper: convert decimal string to number
const num = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : Number(v ?? 0);

// ---- Perfume ----
export function mapPerfume(row: any): Perfume {
  return {
    master_id: row.masterId,
    brand: row.brand,
    name: row.name,
    concentration: row.concentration,
    gender_target: row.genderTarget,
    visibility: row.visibility ?? 'active',
    main_family_id: row.mainFamilyId ?? '',
    sub_family_id: row.subFamilyId ?? '',
    aura_id: row.auraId ?? '',
    aura_color: row.auraColor ?? 'Red',
    hype_level: row.hypeLevel ?? 'Medium',
    scent_type: row.scentType ?? 'Fresh',
    season: row.season ?? [],
    occasion: row.occasion ?? [],
    personality: row.personality ?? [],
    notes_top: row.notesTop ?? [],
    notes_heart: row.notesHeart ?? [],
    notes_base: row.notesBase ?? [],
    proposed_vault: row.proposedVault ?? '',
    scent_signature: row.scentSignature ?? '',
    aura_verse: row.auraVerse ?? '',
    scent_prose: row.scentProse ?? '',
    scent_story: row.scentStory ?? '',
    made_in: row.madeIn ?? '',
    retail_price: num(row.retailPrice),
    wholesale_price: num(row.wholesalePrice),
    reference_size_ml: row.referenceSizeMl ?? 100,
    price_per_ml: num(row.pricePerMl),
    price_multiplier: num(row.priceMultiplier),
    surcharge: num(row.surcharge),
    surcharge_category: row.surchargeCategory ?? 'S0',
    decant_pricing: row.decantPricing ?? [],
    in_stock: row.inStock ?? true,
    bottle_image_url: row.bottleImageUrl ?? '',
    bottle_images: row.bottleImages ?? [],
    brand_image_url: row.brandImageUrl ?? '',
    created_at: ts(row.createdAt),
    updated_at: ts(row.updatedAt),
  };
}

// ---- Brand ----
export function mapBrand(row: any): Brand {
  return {
    brand_id: row.brandId,
    name: row.name,
    made_in: row.madeIn ?? '',
    logo_url: row.logoUrl ?? undefined,
    website: row.website ?? undefined,
    notes: row.notes ?? undefined,
    active: row.active ?? true,
    created_at: ts(row.createdAt),
  };
}

// ---- Supplier ----
export function mapSupplier(row: any, purchases?: any[]): Supplier {
  return {
    supplier_id: row.supplierId,
    type: row.type,
    supplier_type: row.supplierType || 'perfume',
    name: row.name,
    contact_name: row.contactName ?? undefined,
    contact_email: row.contactEmail ?? '',
    contact_phone: row.contactPhone ?? undefined,
    country: row.country,
    city: row.city ?? undefined,
    payment_terms: row.paymentTerms ?? undefined,
    currency: row.currency ?? undefined,
    website: row.website ?? undefined,
    notes: row.notes ?? '',
    risk_flag: row.riskFlag ?? false,
    active: row.active ?? true,
    purchases: (purchases ?? []).map(mapPurchase),
    total_spent: num(row.totalSpent),
    total_items: row.totalItems ?? 0,
    created_at: ts(row.createdAt),
  };
}

export function mapPurchase(row: any): SupplierPurchase {
  return {
    purchase_id: row.purchaseId,
    date: row.date,
    items: row.items ?? [],
    total_amount: num(row.totalAmount),
    invoice_ref: row.invoiceRef ?? undefined,
    notes: row.notes ?? undefined,
  };
}

// ---- Syringe ----
export function mapSyringe(row: any): Syringe {
  return {
    syringe_id: row.syringeId,
    assigned_master_id: row.assignedMasterId ?? undefined,
    dedicated_perfume_name: row.dedicatedPerfumeName ?? undefined,
    dedicated_perfume_id: row.dedicatedPerfumeId ?? undefined,
    sequence_number: row.sequenceNumber,
    size: row.size,
    status: row.status ?? 'active',
    last_used: row.lastUsed ?? undefined,
    use_count: row.useCount ?? 0,
    active: row.active ?? true,
    notes: row.notes ?? '',
    created_at: ts(row.createdAt),
  };
}

// ---- Packaging SKU ----
export function mapPackagingSku(row: any): PackagingSKU {
  return {
    sku_id: row.skuId,
    name: row.name,
    category: row.category,
    size_spec: row.sizeSpec ?? '',
    color_variant: row.colorVariant ?? '',
    type: row.type,
    initial_qty: row.initialQty ?? 0,
    unit_cost: num(row.unitCost),
    qty_on_hand: row.qtyOnHand ?? 0,
    qty_used: row.qtyUsed ?? 0,
    requires_print: row.requiresPrint ?? false,
    requires_inlay: row.requiresInlay ?? false,
    requires_qc: row.requiresQc ?? false,
    unit: row.unit ?? 'pc',
    min_stock_level: row.minStockLevel ?? 0,
    supplier_id: row.supplierId ?? undefined,
    zone: row.zone ?? undefined,
    active: row.active ?? true,
    created_at: ts(row.createdAt),
  };
}

// ---- Vault Location ----
export function mapVaultLocation(row: any): VaultLocation {
  return {
    location_id: row.locationId,
    location_code: row.locationCode,
    vault: row.vault,
    zone: row.zone,
    shelf: row.shelf,
    slot: row.slot,
    position: row.position ?? '',
    code: row.code ?? row.locationCode,
    type: row.type,
    occupied: row.occupied ?? false,
    bottle_id: row.bottleId ?? undefined,
    master_id: row.masterId ?? undefined,
    perfume_name: row.perfumeName ?? undefined,
  };
}

// ---- Inventory Bottle ----
export function mapInventoryBottle(row: any): InventoryBottle {
  return {
    bottle_id: row.bottleId,
    master_id: row.masterId,
    bottle_type: row.bottleType,
    size_ml: row.sizeMl,
    current_ml: row.currentMl ? num(row.currentMl) : undefined,
    supplier_id: row.supplierId ?? '',
    purchase_price: num(row.purchasePrice),
    purchase_date: row.purchaseDate ?? '',
    location_code: row.locationCode ?? '',
    status: row.status ?? 'available',
    manufacturer_id: row.manufacturerId ?? '',
    batch_number: row.batchNumber ?? undefined,
    barcode: row.barcode ?? undefined,
    qr_data: row.qrData ?? undefined,
    photos: row.photos ?? [],
    notes: row.notes ?? undefined,
    created_at: ts(row.createdAt),
  };
}

// ---- Decant Bottle ----
export function mapDecantBottle(row: any): DecantBottle {
  return {
    bottle_id: row.bottleId,
    master_id: row.masterId,
    size_ml: row.sizeMl,
    current_ml: num(row.currentMl),
    opened_at: row.openedAt ?? '',
    location_code: row.locationCode ?? '',
    manufacturer_id: row.manufacturerId ?? '',
    photos: row.photos ?? [],
  };
}

// ---- Order ----
export function mapOrder(row: any): Order {
  return {
    order_id: row.orderId,
    shopify_id: row.shopifyId ?? '',
    customer: row.customer,
    items: row.items ?? [],
    status: row.status ?? 'new',
    tags: row.tags ?? [],
    type: row.type ?? 'one_time',
    subscription_tier: row.subscriptionTier ?? undefined,
    total_amount: num(row.totalAmount),
    notes: row.notes ?? undefined,
    created_at: ts(row.createdAt),
    updated_at: ts(row.updatedAt),
  };
}

// ---- Job ----
export function mapJob(row: any): Job {
  return {
    job_id: row.jobId,
    type: row.type,
    source: row.source,
    status: row.status ?? 'pending',
    station_statuses: row.stationStatuses ?? [],
    order_ids: row.orderIds ?? [],
    created_at: ts(row.createdAt),
    updated_at: ts(row.updatedAt),
  };
}

// ---- Bottle Ledger Event ----
export function mapBottleLedgerEvent(row: any): BottleLedgerEvent {
  return {
    event_id: row.eventId,
    bottle_id: row.bottleId,
    type: row.type,
    qty_ml: row.qtyMl ? num(row.qtyMl) : undefined,
    reason: row.reason ?? '',
    job_id: row.jobId ?? undefined,
    user_id: row.userId ?? '',
    created_at: ts(row.createdAt),
  };
}

// ---- Decant Ledger Event ----
export function mapDecantLedgerEvent(row: any): DecantLedgerEvent {
  return {
    event_id: row.eventId,
    type: row.type,
    bottle_id: row.bottleId,
    qty_ml: num(row.qtyMl),
    units_produced: row.unitsProduced ?? undefined,
    job_id: row.jobId ?? undefined,
    user_id: row.userId ?? '',
    notes: row.notes ?? '',
    created_at: ts(row.createdAt),
  };
}

// ---- Subscription Cycle ----
export function mapSubscriptionCycle(row: any): SubscriptionCycle {
  return {
    cycle_id: row.cycleId,
    cycle_number: row.cycleNumber ?? undefined,
    month: row.month ?? undefined,
    cutoff_date: row.cutoffDate,
    delivery_start_date: row.deliveryStartDate ?? undefined,
    delivery_end_date: row.deliveryEndDate ?? undefined,
    status: row.status ?? 'upcoming',
    forecast_summary: row.forecastSummary ?? { total_orders: 0, total_decants: 0, perfumes_needed: [] },
    generated_jobs_count: row.generatedJobsCount ?? 0,
    total_orders: row.totalOrders ?? 0,
    total_decants: row.totalDecants ?? 0,
  };
}

// ---- Print Job ----
export function mapPrintJob(row: any): PrintJob {
  return {
    print_job_id: row.printJobId,
    type: row.type,
    target_type: row.targetType,
    target_id: row.targetId,
    qty: row.qty ?? 1,
    status: row.status ?? 'pending',
    printed_by: row.printedBy ?? undefined,
    reprint_reason: row.reprintReason ?? undefined,
    created_at: ts(row.createdAt),
    updated_at: ts(row.updatedAt),
  };
}

// ---- Inventory Alert ----
export function mapAlert(row: any): InventoryAlert {
  return {
    id: row.alertId,
    type: row.type,
    severity: row.severity,
    message: row.message,
    created_at: ts(row.createdAt),
  };
}

// ---- Reverse mappers (frontend snake_case → DB camelCase for mutations) ----
export function perfumeToDb(p: Partial<Perfume>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (p.master_id !== undefined) m.masterId = p.master_id;
  if (p.brand !== undefined) m.brand = p.brand;
  if (p.name !== undefined) m.name = p.name;
  if (p.concentration !== undefined) m.concentration = p.concentration;
  if (p.gender_target !== undefined) m.genderTarget = p.gender_target;
  if (p.visibility !== undefined) m.visibility = p.visibility;
  if (p.main_family_id !== undefined) m.mainFamilyId = p.main_family_id;
  if (p.sub_family_id !== undefined) m.subFamilyId = p.sub_family_id;
  if (p.aura_id !== undefined) m.auraId = p.aura_id;
  if (p.aura_color !== undefined) m.auraColor = p.aura_color;
  if (p.hype_level !== undefined) m.hypeLevel = p.hype_level;
  if (p.scent_type !== undefined) m.scentType = p.scent_type;
  if (p.season !== undefined) m.season = p.season;
  if (p.occasion !== undefined) m.occasion = p.occasion;
  if (p.personality !== undefined) m.personality = p.personality;
  if (p.notes_top !== undefined) m.notesTop = p.notes_top;
  if (p.notes_heart !== undefined) m.notesHeart = p.notes_heart;
  if (p.notes_base !== undefined) m.notesBase = p.notes_base;
  if (p.proposed_vault !== undefined) m.proposedVault = p.proposed_vault;
  if (p.scent_signature !== undefined) m.scentSignature = p.scent_signature;
  if (p.aura_verse !== undefined) m.auraVerse = p.aura_verse;
  if (p.scent_prose !== undefined) m.scentProse = p.scent_prose;
  if (p.scent_story !== undefined) m.scentStory = p.scent_story;
  if (p.made_in !== undefined) m.madeIn = p.made_in;
  if (p.retail_price !== undefined) m.retailPrice = String(p.retail_price);
  if (p.wholesale_price !== undefined) m.wholesalePrice = String(p.wholesale_price);
  if (p.reference_size_ml !== undefined) m.referenceSizeMl = p.reference_size_ml;
  if (p.price_per_ml !== undefined) m.pricePerMl = String(p.price_per_ml);
  if (p.price_multiplier !== undefined) m.priceMultiplier = String(p.price_multiplier);
  if (p.surcharge !== undefined) m.surcharge = String(p.surcharge);
  if (p.surcharge_category !== undefined) m.surchargeCategory = p.surcharge_category;
  if (p.decant_pricing !== undefined) m.decantPricing = p.decant_pricing;
  if (p.in_stock !== undefined) m.inStock = p.in_stock;
  if (p.bottle_image_url !== undefined) m.bottleImageUrl = p.bottle_image_url;
  if (p.bottle_images !== undefined) m.bottleImages = p.bottle_images;
  if (p.brand_image_url !== undefined) m.brandImageUrl = p.brand_image_url;
  return m;
}

export function bottleToDb(b: Partial<InventoryBottle>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (b.bottle_id !== undefined) m.bottleId = b.bottle_id;
  if (b.master_id !== undefined) m.masterId = b.master_id;
  if (b.bottle_type !== undefined) m.bottleType = b.bottle_type;
  if (b.size_ml !== undefined) m.sizeMl = b.size_ml;
  if (b.current_ml !== undefined) m.currentMl = String(b.current_ml);
  if (b.supplier_id !== undefined) m.supplierId = b.supplier_id;
  if (b.purchase_price !== undefined) m.purchasePrice = String(b.purchase_price);
  if (b.purchase_date !== undefined) m.purchaseDate = b.purchase_date;
  if (b.location_code !== undefined) m.locationCode = b.location_code;
  if (b.status !== undefined) m.status = b.status;
  if (b.manufacturer_id !== undefined) m.manufacturerId = b.manufacturer_id;
  if (b.batch_number !== undefined) m.batchNumber = b.batch_number;
  if (b.barcode !== undefined) m.barcode = b.barcode;
  if (b.qr_data !== undefined) m.qrData = b.qr_data;
  if (b.photos !== undefined) m.photos = b.photos;
  if (b.notes !== undefined) m.notes = b.notes;
  return m;
}
