// ============================================================
// Maison Em OS — Core Type Definitions
// Design: "Maison Ops" — Luxury Operations
// All types match the backend contract; mock layer uses these.
// ============================================================

// ---- Auth & Roles ----
export type UserRole =
  | 'owner'
  | 'admin'
  | 'system_architect'
  | 'inventory_admin'
  | 'qc'
  | 'viewer'
  | 'vault_guardian'
  | 'pod_leader'
  | 'pod_senior'
  | 'pod_junior'
  | 'user'
  | 'vault_ops'
  | 'fulfillment_ops';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  roles: string[];
  permissions: string[];
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ---- Master Data ----
export type Concentration = 'Extrait de Parfum' | 'Eau de Parfum' | 'Parfum' | 'Eau de Toilette' | 'Cologne';
export type AuraColor = 'Red' | 'Blue' | 'Violet' | 'Green' | 'Yellow' | 'Orange' | 'Pink';
export type HypeLevel = 'Extreme' | 'High' | 'Medium' | 'Low' | 'Rare' | 'Discontinued';
export type ScentType = 'Fresh' | 'Light' | 'Powdery' | 'Strong' | 'Sweet' | 'Warm';
export type Season = 'All Year Round' | 'Fall' | 'Spring' | 'Summer' | 'Winter';
export type Occasion = 'Date Night' | 'Everyday' | 'Office' | 'Party' | 'Vacation' | 'Workout';
export type Personality = 'Classic' | 'Elegant' | 'Flirty' | 'Mysterious' | 'Sexy';
export type Gender = 'Feminine' | 'Masculine' | 'Unisex';

export interface DecantPricing {
  size_ml: number;
  price: number;
}

export interface Perfume {
  id?: string; // DB UUID used for update/delete on persisted records
  master_id: string;
  brand_id?: string;
  brand: string;
  name: string;
  concentration: Concentration;
  gender_target: 'masculine' | 'feminine' | 'unisex';
  visibility: 'active' | 'archived' | 'draft';
  main_family_id: string;
  sub_family_id: string;
  aura_id: string;
  aura_color: AuraColor;
  hype_level: HypeLevel;
  scent_type: ScentType;
  season: string[];
  occasion: string[];
  personality: string[];
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  proposed_vault: string;
  scent_signature: string;
  aura_verse: string;
  scent_prose: string;
  scent_story: string;
  made_in: string;
  retail_price: number;
  wholesale_price: number;
  reference_size_ml: number;
  price_per_ml: number;
  price_multiplier: number;
  surcharge: number;
  surcharge_category: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  decant_pricing: DecantPricing[];
  in_stock: boolean;
  bottle_image_url: string;
  bottle_images?: string[];
  brand_image_url: string;
  created_at: string;
  updated_at: string;
}

export interface PerfumeSearchResult {
  id: string;
  master_id: string;
  name: string;
  brand: string;
}

export interface BrandInsights {
  brandId: string;
  brandName: string;
  totals: {
    totalPerfumes: number;
    inStock: number;
    outOfStock: number;
  };
  pricing: {
    avgPricePerMl: number;
    totalRetailValue: number;
  };
  concentrationDistribution: { name: string; value: number }[];
  auraDistribution: { name: string; value: number }[];
  hypeDistribution: { name: string; value: number }[];
  topPricePerMl: { masterId: string; name: string; pricePerMl: number; retailPrice: number }[];
}

// ---- Brands ----
export interface Brand {
  id?: string; // Database UUID (added for Supabase connection)
  brand_id: string;
  name: string;
  made_in: string;
  logo_url?: string;
  website?: string;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface AuraDefinition {
  id?: string;
  aura_id: string;
  name: string;
  color: AuraColor;
  element: string;
  keywords: string[];
  persona: string;
  tagline: string;
  description: string;
  core_drive: string;
  balance_aura: string;
  color_hex: string;
}

export interface Family {
  id?: string;
  main_family_id: string;
  name: string;
  display_order: number;
  tagline: string;
  description: string;
  sub_families: string[]; // sub-family names
}

export interface SubFamily {
  id?: string;
  sub_family_id: string;
  ff_code: string; // e.g. FF001
  main_family_id: string;
  main_family_name: string;
  name: string;
  scent_dna: string;
  ritual_name: string;
  ritual_occasions: string;
  aura_name: string;
  aura_color: AuraColor;
  description: string;
  scent_story: string;
  key_notes: string[];
  mood_tags: string[];
  prominent_notes?: string;
  display_order?: number;
}

export interface FilterConfig {
  aura_colors: AuraColor[];
  scent_types: ScentType[];
  seasons: Season[];
  occasions: Occasion[];
  concentrations: Concentration[];
  genders: Gender[];
  personalities: Personality[];
  main_families: string[];
  sub_families: string[];
}

// ---- Pricing Rules Schema ----

// Surcharge Tiers (Subscription flat surcharges)
export interface SurchargeTier {
  from_price_per_ml: number;
  to_price_per_ml: number | null; // null = infinity
  s_category: string; // S0, S1, S2...
  s_price: number; // surcharge in AED
}

// Subscription Hype Multiplier
export interface SubscriptionHypeMultiplier {
  hype: string; // Extreme, High, Medium, Low, Rare, Discontinued
  multiplier: number;
}

// ML Discount (A la carte / one-time decant orders)
export interface MlDiscount {
  label: 'Premium' | 'Discount';
  ml_size: number;
  discount_factor: number; // 0.10 = 10%
}

// A La Carte Pricing Multiplier (hype-based)
export interface AlaCartePricingMultiplier {
  hype: string;
  multiplier: number;
}

// 2ml Pricing Tier
export interface TwoMlTier {
  s_category: string; // S0, S1, S2...
  price: number; // price in AED
}

export interface PricingRuleSet {
  id: string;
  surcharge_tiers: SurchargeTier[];
  subscription_hype_multipliers: SubscriptionHypeMultiplier[];
  ml_discounts: MlDiscount[];
  alacarte_pricing_multipliers: AlaCartePricingMultiplier[];
}

// ---- Vault Locations (hierarchical: zone → shelf → slot) ----
export type LocationType = 'sealed' | 'decant' | 'packaging' | 'staging';

export interface VaultSlot {
  slot_number: number;
  occupied: boolean;
  bottle_id?: string;       // if occupied, which bottle
  master_id?: string;       // if occupied, which perfume
  perfume_name?: string;
}

export interface VaultShelf {
  shelf_number: number;
  slots_count: number;
  slots: VaultSlot[];
}

export interface VaultZone {
  zone_id: string;          // e.g., 'A', 'B', 'C'
  zone_name: string;        // e.g., 'Zone A — Sealed Niche'
  type: LocationType;
  shelves: VaultShelf[];
}

export interface VaultLocation {
  id?: string;
  location_id: string;
  location_code: string;    // auto-generated: {VAULT}-{ZONE}-{SHELF}-{SLOT}
  vault: string;            // 'Main', 'Decant', 'Staging'
  zone: string;
  shelf: string;
  slot: string;
  position: string;
  code: string;
  type: LocationType;
  occupied: boolean;
  bottle_id?: string;
  master_id?: string;
  perfume_name?: string;
}

export interface VaultConfig {
  vault_name: string;       // 'Main', 'Decant', 'Staging'
  zones: VaultZone[];
  total_slots: number;
  occupied_slots: number;
  created_at: string;
}

// ---- Suppliers (with purchase history) ----
export type SupplierType = 'retailer' | 'wholesaler' | 'private_collector' | 'direct';

export interface SupplierPurchase {
  purchase_id: string;
  date: string;
  items: { master_id: string; perfume_name: string; qty: number; size_ml: number; unit_price: number }[];
  total_amount: number;
  invoice_ref?: string;
  notes?: string;
}

export type SupplierProcType = 'perfume' | 'packaging' | 'both';

export interface Supplier {
  id?: string;
  supplier_id: string;
  type: SupplierType;
  supplier_type: SupplierProcType;
  active_po_count: number;
  name: string;
  contact_name?: string;
  contact_email: string;
  contact_phone?: string;
  country: string;
  city?: string;
  payment_terms?: string;   // e.g., 'Net 30', 'COD', 'Prepaid'
  currency?: string;        // e.g., 'AED', 'USD', 'EUR'
  website?: string;
  notes: string;
  risk_flag: boolean;
  active: boolean;
  purchases: SupplierPurchase[];
  total_spent: number;
  total_items: number;
  created_at: string;
}

// ---- Syringes Registry ----
export type SyringeStatus = 'active' | 'retired' | 'cleaning' | 'damaged';
export type SyringeSize = '5ml' | '10ml' | '20ml' | 'custom';

export interface Syringe {
  id: string;               // Database UUID
  syringe_id: string;       // S/1, S/2, S/3... auto-generated sequentially
  assigned_master_id?: string;
  dedicated_perfume_name?: string;
  dedicated_perfume_id?: string;
  sequence_number: number;
  size: SyringeSize;
  custom_size_ml?: number;
  status: SyringeStatus;
  last_used?: string;       // ISO date
  use_count: number;
  active: boolean;
  notes: string;
  created_at: string;
}

// ---- Packaging SKUs (non-liquid inventory from Excel) ----
export type PackagingCategory =
  | 'Atomiser & Vials'
  | 'Decant Bottles'
  | 'Packaging Material'
  | 'Packaging Accessories'
  | 'Shipping Material'
  | 'Labels'
  | 'Others';

export const PACKAGING_CATEGORY_CODES: Record<PackagingCategory, string> = {
  'Atomiser & Vials': 'ATM',
  'Decant Bottles': 'DCB',
  'Packaging Material': 'PCKG',
  'Packaging Accessories': 'PCKGACC',
  'Shipping Material': 'SHIP',
  'Labels': 'LBL',
  'Others': 'OTH',
};

export interface PackagingSKU {
  sku_id: string;           // auto-generated: EM/{CAT_CODE}/{ITEM_ABBREV}-{SPEC}-{COLOR_CODE}
  name: string;
  category: PackagingCategory;
  size_spec: string;        // e.g., '8ml', '5ml', 'Straight7*7*20cm'
  color_variant: string;    // e.g., 'Pink', 'Black', 'Gold', 'Ivory'
  type: 'atomizer' | 'vial' | 'cap' | 'box' | 'inlay' | 'insert' | 'label' | 'pouch' | 'cloth' | 'bottle' | 'other';
  initial_qty: number;
  unit_cost: number;        // cost per unit
  qty_on_hand: number;
  qty_used: number;
  requires_print: boolean;
  requires_inlay: boolean;
  requires_qc: boolean;
  unit: string;             // 'pc', 'sheet', 'roll'
  min_stock_level: number;  // reorder threshold
  supplier_id?: string;
  zone?: string;           // storage zone location
  active: boolean;
  created_at: string;
}

// ---- Inventory ----
export type BottleStatus = 'available' | 'reserved' | 'allocated' | 'sold' | 'in_decanting';
export type BottleType = 'sealed' | 'open' | 'tester';

/** Unified bottle record — replaces the old SealedBottle */
export interface InventoryBottle {
  bottle_id: string;
  master_id: string;
  bottle_type: BottleType;   // sealed = retail sealed, open = opened from supplier/collector, tester = tester unit
  size_ml: number;
  current_ml?: number;       // for open/tester: remaining ml (sealed = full)
  supplier_id: string;
  purchase_price: number;
  purchase_date: string;
  location_code: string;
  status: BottleStatus;
  manufacturer_id: string;
  batch_number?: string;
  barcode?: string;          // auto-generated barcode string
  qr_data?: string;          // JSON-encoded QR payload
  photos: string[];
  notes?: string;
  created_at: string;
}

/** @deprecated — alias kept for backward compat */
export type SealedBottle = InventoryBottle;

export interface DecantBottle {
  bottle_id: string;
  master_id: string;
  size_ml: number;
  current_ml: number;
  opened_at: string;
  location_code: string;
  manufacturer_id: string;
  photos: string[];
}

export interface PackagingStock {
  sku_id: string;
  qty_on_hand: number;
  qty_reserved?: number;
  unit_cost?: number;
  zone?: string;
  notes?: string;
  last_restocked?: string;
}

// ---- Ledgers (append-only) ----
export type BottleLedgerEventType =
  | 'INTAKE'
  | 'ALLOCATED'
  | 'OPENED'
  | 'DECANTED_OUT'
  | 'SOLD'
  | 'ADJUSTMENT'
  | 'RETURNED';

export interface BottleLedgerEvent {
  event_id: string;
  bottle_id: string;
  type: BottleLedgerEventType;
  qty_ml?: number;
  reason: string;
  job_id?: string;
  user_id: string;
  created_at: string;
}

export type DecantLedgerEventType =
  | 'BATCH_DECANT'
  | 'MANUAL_DECANT'
  | 'LOSS'
  | 'BREAKAGE'
  | 'ADJUSTMENT';

export interface DecantLedgerEvent {
  event_id: string;
  type: DecantLedgerEventType;
  bottle_id: string;
  qty_ml: number;
  units_produced?: number;
  job_id?: string;
  user_id: string;
  notes: string;
  created_at: string;
}

export type PackagingLedgerEventType =
  | 'INTAKE'
  | 'CONSUMED'
  | 'ADJUSTMENT'
  | 'DAMAGED';

export interface PackagingLedgerEvent {
  event_id: string;
  sku_id: string;
  type: PackagingLedgerEventType;
  qty: number;
  job_id?: string;
  user_id: string;
  created_at: string;
}

// ---- Orders & Jobs ----
export type OrderStatus =
  | 'new'
  | 'processing'
  | 'picked'
  | 'prepped'
  | 'decanted'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  item_id: string;
  master_id: string;
  perfume_name: string;
  size_ml: number;
  qty: number;
  type: 'decant' | 'sealed_bottle' | 'vial';
  unit_price: number;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
}

export type SubscriptionTier = 'explorer' | 'alchemist' | 'grand_master';

export interface Order {
  order_id: string;
  shopify_id: string;
  customer: OrderCustomer;
  items: OrderItem[];
  status: OrderStatus;
  tags: string[];
  type: 'one_time' | 'subscription';
  subscription_tier?: SubscriptionTier;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type JobStatus =
  | 'pending'
  | 'picked'
  | 'prepped'
  | 'decanted'
  | 'packed'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export type JobType =
  | 'subscription_first_order'  // New subscriber's first order — full process
  | 'subscription_cycle'        // Monthly cycle batch — S1→S6
  | 'internal_production'       // Create Products batch — F1→F7
  | 'aurakey_ondemand'          // AuraKey & Refills — on-demand decanting
  | 'ready_product_fulfillment' // Pre-made items — pick, pack, ship (no decanting)
  | 'corporate_gift_activation' // Corporate gifts — prepare, customize, ship
  // Legacy types (kept for backward compatibility)
  | 'decant_batch' | 'fulfillment' | 'manual_decant';

export interface StationStatus {
  station: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  operator_id?: string;
}

export interface Job {
  job_id: string;
  type: JobType;
  source: 'one_time' | 'subscription' | 'manual' | 'production' | 'corporate' | 'ready_to_ship';
  status: JobStatus;
  station_statuses: StationStatus[];
  order_ids: string[];
  assigned_operator?: string;
  assigned_operator_id?: string;
  created_at: string;
  updated_at: string;
}

export type CycleStatus = 'upcoming' | 'active' | 'collecting' | 'closed' | 'processing' | 'delivering' | 'completed';

export interface SubscriptionCycle {
  cycle_id: string;
  cycle_number?: number;
  month?: string;
  cutoff_date: string;
  delivery_start_date?: string;
  delivery_end_date?: string;
  status: CycleStatus;
  forecast_summary: {
    total_orders: number;
    total_decants: number;
    perfumes_needed: { master_id: string; name: string; total_ml: number; in_stock_ml?: number }[];
  };
  generated_jobs_count: number;
  total_orders?: number;
  total_decants?: number;
}

// ---- Print Jobs ----
export type PrintJobType = 'label' | 'insert' | 'inlay' | 'shipping_label' | 'barcode';
export type PrintJobStatus = 'pending' | 'printing' | 'printed' | 'reprinted' | 'failed';

export interface PrintJob {
  print_job_id: string;
  type: PrintJobType;
  target_type: 'job' | 'order' | 'sku' | 'bottle';
  target_id: string;
  qty: number;
  status: PrintJobStatus;
  printed_by?: string;
  reprint_reason?: string;
  created_at: string;
  updated_at: string;
}

// ---- Manual Decant ----
export interface ManualDecantEntry {
  bottle_id: string;
  master_id: string;
  perfume_name: string;
  bottle_image_url: string;
  current_ml: number;
  decant_ml: number;
  sizes: { size_ml: number; qty: number }[];
  syringe_id: string;
  packaging_items: { sku_id: string; qty: number }[];
}

export interface ManualDecantProcess {
  process_id: string;
  entries: ManualDecantEntry[];
  notes: string;
  status: 'in_progress' | 'completed';
  operator_id: string;
  created_at: string;
  completed_at?: string;
}

// ---- Pick Lists ----
export interface DecantPickItem {
  bottle_id: string;
  master_id: string;
  perfume_name: string;
  perfume_image: string;
  location_code: string;
  required_sizes: { size_ml: number; qty: number }[];
  picked: boolean;
}

export interface SyringePickItem {
  syringe_id: string;
  recommended_perfume: string;
  picked: boolean;
}

export interface PackagingPickItem {
  sku_id: string;
  name: string;
  qty_required: number;
  picked: boolean;
}

export interface LabelQueueItem {
  size_ml: number;
  qty_to_print: number;
  print_job_id?: string;
}

// ---- Dashboard ----
export interface DashboardKPIs {
  one_time_orders: { new: number; in_progress: number; packed: number; shipped: number };
  subscription: { active_cycle_cutoff: string; days_left: number; orders_count: number };
  decant_batches: { pending: number; in_progress: number; completed: number };
  shipping: { ready_for_pickup: number };
  // Extended KPIs
  full_bottles?: { pending: number; in_progress: number; packed: number; shipped: number };
  revenue?: { total_aed: number; subscription_aed: number; one_time_aed: number; full_bottle_aed: number };
  customers?: { total: number; new_this_period: number; returning: number };
  inventory?: { total_bottles: number; total_ml: number; low_stock_count: number };
}

export interface PipelineStage {
  stage: string;
  count: number;
}

export interface InventoryAlert {
  id: string;
  type: 'low_ml' | 'low_packaging' | 'missing_scan' | 'variance' | 'reprint' | 'cutoff' | 'stuck_order';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  created_at: string;
}

export interface CriticalPerfume {
  master_id: string;
  name: string;
  brand: string;
  current_ml: number;
  threshold_ml: number;
}

// ---- Station 4: Batch Decanting ----
export interface DecantMatrixRow {
  size_ml: number;
  qty_required: number;
  qty_completed: number;
  remaining: number;
}

export interface BatchDecantItem {
  master_id: string;
  perfume_name: string;
  perfume_image: string;
  bottle_id: string;
  manufacturer_id: string;
  current_ml: number;
  location_code: string;
  matrix: DecantMatrixRow[];
  syringe_id?: string;
  progress: number;
  completed: boolean;
}

// ---- API Response Wrappers ----
export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface ApiListResponse<T> {
  data: T[];
  error?: string;
  meta: {
    total: number;
    page: number;
    per_page: number;
  };
}

// ---- Bill of Materials (BOM) ----
export type BOMComponentCategory =
  | 'perfume'
  | 'atomizer'
  | 'packaging'
  | 'insert'
  | 'accessory'
  | 'label'
  | 'shipping';

export type BOMComponentSource = 'sealed_vault' | 'packaging_sku' | 'custom';

export const DECANT_SIZES_ML = [1, 2, 3, 5, 7.5, 8, 10, 20, 30] as const;
export type DecantSizeMl = typeof DECANT_SIZES_ML[number];

export interface BOMComponent {
  component_id: string;
  name: string;
  category: BOMComponentCategory;
  source: BOMComponentSource;
  /** Links to sku_id (PackagingSKU) or master_id (Perfume) depending on source */
  source_ref_id?: string;
  image_url?: string;
  unit_cost: number;
  unit: string; // 'pc', 'ml', 'sheet'
  is_variable: boolean; // true = customer-selected (e.g. perfume choice), false = fixed (e.g. box, insert)
  /** For variable (perfume) components: average price per ml entered manually */
  price_per_ml?: number;
  /** For variable (perfume) components: decant size in ml */
  decant_size_ml?: DecantSizeMl | number;
  notes?: string;
}

export interface BOMLineItem {
  line_id: string;
  component_id: string;
  component: BOMComponent;
  qty: number;
  is_optional: boolean;
  condition?: string; // e.g. "if order includes 20ml decant"
  sort_order: number;
}

export type BOMStatus = 'draft' | 'active' | 'archived';

export interface BOMTemplate {
  bom_id: string;
  name: string;
  description: string;
  status: BOMStatus;
  version: number;
  line_items: BOMLineItem[];
  total_cost: number; // sum of fixed component costs (non-variable)
  variable_cost: number; // sum of estimated variable component costs (perfume per-ml × size × qty)
  created_at: string;
  updated_at: string;
  created_by: string;
}

export type EndProductCategory =
  | 'first_time_subscription'
  | 'monthly_subscription'
  | 'single_aurakey'
  | 'aurakey_refills'
  | 'capsule_themed_set'
  | 'capsule_house_chapter'
  | 'capsule_layering_set'
  | 'capsule_scent_story'
  | 'whisperer_set'
  | 'gift_set_him'
  | 'gift_set_her'
  | 'gift_set_seasonal'
  | 'gift_subscription'
  | 'corporate_subscription'
  | 'gift_card'
  | 'one_time_decant'
  | 'other';

export const END_PRODUCT_CATEGORY_CODES: Record<EndProductCategory, string> = {
  first_time_subscription: 'FTS',
  monthly_subscription: 'MSB',
  single_aurakey: 'SAK',
  aurakey_refills: 'AKR',
  capsule_themed_set: 'CTS',
  capsule_house_chapter: 'CHC',
  capsule_layering_set: 'CLS',
  capsule_scent_story: 'CSS',
  whisperer_set: 'WSP',
  gift_set_him: 'GSH',
  gift_set_her: 'GSR',
  gift_set_seasonal: 'GSS',
  gift_subscription: 'GSB',
  corporate_subscription: 'CSB',
  gift_card: 'GCD',
  one_time_decant: 'OTD',
  other: 'OTH',
};

export const END_PRODUCT_CATEGORY_LABELS: Record<EndProductCategory, string> = {
  first_time_subscription: '1st Time Subscription',
  monthly_subscription: 'Monthly Subscription',
  single_aurakey: 'Single AuraKEY',
  aurakey_refills: 'AuraKEY Refills',
  capsule_themed_set: 'Capsule: Themed Set',
  capsule_house_chapter: 'Capsule: House Chapter',
  capsule_layering_set: 'Capsule: Layering Set',
  capsule_scent_story: 'Capsule: Scent Story',
  whisperer_set: 'Whisperer Vials Set',
  gift_set_him: 'Gift Set For Him',
  gift_set_her: 'Gift Set For Her',
  gift_set_seasonal: 'Gift Set Seasonal',
  gift_subscription: 'Gift Subscription',
  corporate_subscription: 'Corporate Subscription',
  gift_card: 'Gift Card',
  one_time_decant: 'One-Time Decant',
  other: 'Other',
};

export interface EndProduct {
  product_id: string;
  name: string;
  sku: string;
  category: EndProductCategory;
  description: string;
  image_url?: string;
  bom_id?: string; // linked BOM template (product/component BOM)
  bom?: BOMTemplate;
  shipping_bom_id?: string; // linked shipping BOM template
  shipping_bom?: BOMTemplate;
  shopify_product_id?: string;
  fixed_price?: number; // sum of fixed (non-variable) BOM component costs
  variable_price?: number; // sum of variable (perfume) BOM component costs
  shipping_cost?: number; // cost from linked shipping BOM
  selling_price?: number; // retail selling price (for margin analysis)
  selling_price_method?: 'manual' | 'multiplier'; // how selling price was set
  selling_price_multiplier?: number; // multiplier used if method is 'multiplier'
  tags?: string[]; // e.g. ['bestseller', 'new', 'limited']
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderTypeTag =
  | 'standard_one_time'
  | 'subscription_gm1'
  | 'subscription_gm2'
  | 'subscription_gm3'
  | 'subscription_gm4'
  // Legacy tags for backward compatibility
  | 'subscription_explorer'
  | 'subscription_alchemist'
  | 'subscription_grand_master'
  | 'box_bundle'
  | 'em_set_traveler'
  | 'em_set_connoisseur'
  | 'em_set_alchemist_edition'
  | 'em_set_private_oud'
  | 'em_set_collector'
  | 'aura_play_connoisseur'
  | 'aura_play_explorer'
  | 'aura_play_sampler'
  | 'custom';

export interface OrderTypeBOMMapping {
  mapping_id: string;
  order_type_tag: OrderTypeTag;
  order_type_label: string;
  product_id: string;
  bom_id: string;
  auto_apply: boolean; // auto-apply BOM when order matches this type
  created_at: string;
}

// BOM Picking — generated from BOMs for a batch of orders
export interface BOMPickListItem {
  component_id: string;
  component: BOMComponent;
  total_qty_needed: number;
  qty_picked: number;
  orders_needing: string[]; // order_ids
  picked: boolean;
}

// BOM Fulfillment — per-order BOM breakdown
export interface BOMOrderBreakdown {
  order_id: string;
  order_type_tag: OrderTypeTag;
  bom_id: string;
  bom_name: string;
  line_items: (BOMLineItem & { fulfilled: boolean })[];
}

// BOM Inventory Impact
export interface BOMInventoryImpact {
  component_id: string;
  component_name: string;
  source: BOMComponentSource;
  source_ref_id?: string;
  qty_required: number;
  qty_available: number;
  shortage: number;
  status: 'ok' | 'low' | 'out_of_stock';
}

// Workflow node types for the visual BOM designer
export type BOMNodeType = 'product' | 'component' | 'group' | 'condition';

export interface BOMWorkflowNode {
  node_id: string;
  type: BOMNodeType;
  label: string;
  data: {
    component_id?: string;
    category?: BOMComponentCategory;
    qty?: number;
    image_url?: string;
    is_variable?: boolean;
    condition?: string;
  };
  position: { x: number; y: number };
}

export interface BOMWorkflowEdge {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
}

export interface BOMWorkflow {
  bom_id: string;
  nodes: BOMWorkflowNode[];
  edges: BOMWorkflowEdge[];
}

// ---- Master / Umbrella BOM ----
// A Master BOM is the compiled BOM for an entire order.
// It combines: Shipping BOM (base packaging) + Product BOMs (per-product components)
// Common items across product BOMs are deduplicated (e.g. one thank-you card per order, not per product)
export type BOMLayerType = 'shipping' | 'product';

export interface MasterBOMLine {
  component_id: string;
  component: BOMComponent;
  qty: number;
  layer: BOMLayerType; // which layer contributed this line
  source_bom_ids: string[]; // which BOM(s) originally required this
  deduplicated: boolean; // true if qty was capped to avoid duplication
}

export interface MasterBOM {
  order_id: string;
  shipping_bom: BOMTemplate | null; // the base/shipping BOM
  product_boms: { product_name: string; bom: BOMTemplate }[];
  compiled_lines: MasterBOMLine[]; // deduplicated final list
  total_fixed_cost: number;
  total_components: number;
  dedup_savings: number; // how many items saved by deduplication
}

// Components that are "common" and should only appear once per order regardless of product count
export const COMMON_COMPONENT_IDS = [
  'comp-thank-you-card',
  'comp-discount-card',
  'comp-label-box',
  'comp-seal-sticker',
  'comp-bubble-wrap',
  'comp-tissue',
  'comp-ribbon',
] as const;


// ---- Activity Feed ----
export interface ActivityEvent {
  id: string;
  type: 'bottle_intake' | 'bottle_opened' | 'decant_deduction' | 'order_created' | 'order_updated' | 'job_created' | 'job_updated' | 'po_created' | 'po_updated';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  icon: string;
  color: string;
  timestamp: string;
}
