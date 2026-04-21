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

export function mapPerfume(row: any): Perfume {
  return {
    id: row.id ?? undefined,
    master_id: row.masterId ?? row.master_id,
    brand_id: row.brandId ?? row.brand_id ?? undefined,
    brand: row.brand,
    name: row.name,
    concentration: row.concentration,
    gender_target: row.genderTarget ?? row.gender_target,
    visibility: row.visibility ?? 'active',
    main_family_id: row.mainFamilyId ?? row.main_family_id ?? '',
    sub_family_id: row.subFamilyId ?? row.sub_family_id ?? '',
    aura_id: row.auraId ?? row.aura_id ?? '',
    aura_color: row.auraColor ?? row.aura_color ?? 'Red',
    hype_level: row.hypeLevel ?? row.hype_level ?? 'Medium',
    scent_type: row.scentType ?? row.scent_type ?? 'Fresh',
    season: row.season ?? [],
    occasion: row.occasion ?? [],
    personality: row.personality ?? [],
    notes_top: row.notesTop ?? row.notes_top ?? [],
    notes_heart: row.notesHeart ?? row.notes_heart ?? [],
    notes_base: row.notesBase ?? row.notes_base ?? [],
    proposed_vault: row.proposedVault ?? row.proposed_vault ?? '',
    scent_signature: row.scentSignature ?? row.scent_signature ?? '',
    aura_verse: row.auraVerse ?? row.aura_verse ?? '',
    scent_prose: row.scentProse ?? row.scent_prose ?? '',
    scent_story: row.scentStory ?? row.scent_story ?? '',
    made_in: row.madeIn ?? row.made_in ?? '',
    retail_price: num(row.retailPrice ?? row.retail_price),
    wholesale_price: num(row.wholesalePrice ?? row.wholesale_price),
    reference_size_ml: row.referenceSizeMl ?? row.reference_size_ml ?? 100,
    price_per_ml: num(row.pricePerMl ?? row.price_per_ml),
    price_multiplier: num(row.priceMultiplier ?? row.price_multiplier),
    surcharge: num(row.surcharge),
    surcharge_category: row.surchargeCategory ?? row.surcharge_category ?? 'S0',
    decant_pricing: row.decantPricing ?? row.decant_pricing ?? [],
    in_stock: row.inStock ?? row.in_stock ?? true,
    bottle_image_url: row.bottleImageUrl ?? row.bottle_image_url ?? '',
    bottle_images: row.bottleImages ?? row.bottle_images ?? [],
    brand_image_url: row.brandImageUrl ?? row.brand_image_url ?? '',
    created_at: ts(row.createdAt ?? row.created_at),
    updated_at: ts(row.updatedAt ?? row.updated_at),
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
    id: row.id ?? undefined,
    supplier_id: row.supplierId,
    type: row.type,
    supplier_type: row.supplierType || 'perfume',
    active_po_count: row.activePoCount ?? 0,
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
    id: row.id,
    syringe_id: row.syringe_id ?? row.syringeId,
    assigned_master_id: row.assigned_master_id ?? row.assignedMasterId ?? undefined,
    dedicated_perfume_name: row.dedicated_perfume_name ?? row.dedicatedPerfumeName ?? undefined,
    dedicated_perfume_id: row.dedicated_perfume_id ?? row.dedicatedPerfumeId ?? undefined,
    sequence_number: row.sequence_number ?? row.sequenceNumber,
    size: row.size,
    status: row.status ?? 'active',
    last_used: row.last_used ?? row.lastUsed ?? undefined,
    use_count: row.use_count ?? row.useCount ?? 0,
    active: row.active ?? true,
    notes: row.notes ?? '',
    created_at: ts(row.created_at ?? row.createdAt),
  };
}

// ---- Packaging SKU ----
export function mapPackagingSku(row: any): PackagingSKU {
  return {
    sku_id: row.skuId,
    barcode_value: row.barcodeValue ?? row.barcode_value ?? undefined,
    barcode_image_url: row.barcodeImageUrl ?? row.barcode_image_url ?? undefined,
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
    id: row.id,
    location_id: row.location_id ?? row.locationId,
    location_code: row.location_code ?? row.locationCode,
    vault: row.vault,
    zone: row.zone,
    shelf: row.shelf,
    slot: row.slot,
    position: row.position ?? '',
    code: row.code ?? row.location_code ?? row.locationCode,
    type: row.type,
    occupied: row.occupied ?? false,
    bottle_id: row.bottle_id ?? row.bottleId ?? undefined,
    master_id: row.master_id ?? row.masterId ?? undefined,
    perfume_name: row.perfume_name ?? row.perfumeName ?? undefined,
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
  if (p.master_id !== undefined) m.master_id = p.master_id;
  if (p.brand_id !== undefined) m.brand_id = p.brand_id;
  if (p.brand !== undefined) m.brand = p.brand;
  if (p.name !== undefined) m.name = p.name;
  if (p.concentration !== undefined) m.concentration = p.concentration;
  if (p.gender_target !== undefined) m.gender_target = p.gender_target;
  if (p.visibility !== undefined) m.visibility = p.visibility;
  if (p.main_family_id !== undefined) m.main_family_id = p.main_family_id;
  if (p.sub_family_id !== undefined) m.sub_family_id = p.sub_family_id;
  if (p.aura_id !== undefined) m.aura_id = p.aura_id;
  if (p.aura_color !== undefined) m.aura_color = p.aura_color;
  if (p.hype_level !== undefined) m.hype_level = p.hype_level;
  if (p.scent_type !== undefined) m.scent_type = p.scent_type;
  if (p.season !== undefined) m.season = p.season;
  if (p.occasion !== undefined) m.occasion = p.occasion;
  if (p.personality !== undefined) m.personality = p.personality;
  if (p.notes_top !== undefined) m.notes_top = p.notes_top;
  if (p.notes_heart !== undefined) m.notes_heart = p.notes_heart;
  if (p.notes_base !== undefined) m.notes_base = p.notes_base;
  if (p.proposed_vault !== undefined) m.proposed_vault = p.proposed_vault;
  if (p.scent_signature !== undefined) m.scent_signature = p.scent_signature;
  if (p.aura_verse !== undefined) m.aura_verse = p.aura_verse;
  if (p.scent_prose !== undefined) m.scent_prose = p.scent_prose;
  if (p.scent_story !== undefined) m.scent_story = p.scent_story;
  if (p.made_in !== undefined) m.made_in = p.made_in;
  if (p.retail_price !== undefined) m.retail_price = String(p.retail_price);
  if (p.wholesale_price !== undefined) m.wholesale_price = String(p.wholesale_price);
  if (p.reference_size_ml !== undefined) m.reference_sizeMl = p.reference_size_ml;
  if (p.price_per_ml !== undefined) m.price_perMl = String(p.price_per_ml);
  if (p.price_multiplier !== undefined) m.price_multiplier = String(p.price_multiplier);
  if (p.surcharge !== undefined) m.surcharge = String(p.surcharge);
  if (p.surcharge_category !== undefined) m.surcharge_category = p.surcharge_category;
  if (p.decant_pricing !== undefined) m.decant_pricing = p.decant_pricing;
  if (p.in_stock !== undefined) m.in_stock = p.in_stock;
  if (p.bottle_image_url !== undefined) m.bottle_imageUrl = p.bottle_image_url;
  if (p.bottle_images !== undefined) m.bottle_images = p.bottle_images;
  if (p.brand_image_url !== undefined) m.brand_imageUrl = p.brand_image_url;
  return m;
}

export function bottleToDb(b: Partial<InventoryBottle>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (b.bottle_id !== undefined) m.bottle_id = b.bottle_id;
  if (b.master_id !== undefined) m.master_id = b.master_id;
  if (b.bottle_type !== undefined) m.bottle_type = b.bottle_type;
  if (b.size_ml !== undefined) m.size_ml = b.size_ml;
  if (b.current_ml !== undefined) m.current_ml = String(b.current_ml);
  if (b.supplier_id !== undefined) m.supplier_id = b.supplier_id;
  if (b.purchase_price !== undefined) m.purchase_price = String(b.purchase_price);
  if (b.purchase_date !== undefined) m.purchase_date = b.purchase_date;
  if (b.location_code !== undefined) m.location_code = b.location_code;
  if (b.status !== undefined) m.status = b.status;
  if (b.manufacturer_id !== undefined) m.manufacturer_id = b.manufacturer_id;
  if (b.batch_number !== undefined) m.batch_number = b.batch_number;
  if (b.barcode !== undefined) m.barcode = b.barcode;
  if (b.qr_data !== undefined) m.qr_data = b.qr_data;
  if (b.photos !== undefined) m.photos = b.photos;
  if (b.notes !== undefined) m.notes = b.notes;
  return m;
}

export function syringeToDb(s: Partial<Syringe>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (s.syringe_id !== undefined) m.syringe_id = s.syringe_id;
  if (s.assigned_master_id !== undefined) m.assigned_master_id = s.assigned_master_id;
  if (s.dedicated_perfume_name !== undefined) m.dedicated_perfume_name = s.dedicated_perfume_name;
  if (s.dedicated_perfume_id !== undefined) m.dedicated_perfume_id = s.dedicated_perfume_id;
  if (s.sequence_number !== undefined) m.sequence_number = s.sequence_number;
  if (s.size !== undefined) m.size = s.size;
  if (s.custom_size_ml !== undefined) m.custom_size_ml = s.custom_size_ml;
  if (s.status !== undefined) m.status = s.status;
  if (s.last_used !== undefined) m.last_used = s.last_used;
  if (s.use_count !== undefined) m.use_count = s.use_count;
  if (s.active !== undefined) m.active = s.active;
  if (s.notes !== undefined) m.notes = s.notes;
  return m;
}

export function brandToDb(b: Partial<Brand>): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (b.brand_id !== undefined) m.brand_id = b.brand_id;
  if (b.name !== undefined) m.name = b.name;
  if (b.made_in !== undefined) m.made_in = b.made_in;
  if (b.logo_url !== undefined) m.logo_url = b.logo_url;
  if (b.website !== undefined) m.website = b.website;
  if (b.notes !== undefined) m.notes = b.notes;
  if (b.active !== undefined) m.active = b.active;
  return m;
}
