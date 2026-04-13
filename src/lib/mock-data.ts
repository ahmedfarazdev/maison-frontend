// ============================================================
// Maison Em OS — Mock Data Layer
// Realistic data for development without backend
// ============================================================

import type {
  Perfume, AuraDefinition, Family, SubFamily, VaultLocation,
  Supplier, Syringe, PackagingSKU, SealedBottle, DecantBottle,
  PackagingStock, Order, Job, SubscriptionCycle, PrintJob,
  DashboardKPIs, PipelineStage, InventoryAlert, CriticalPerfume,
  DecantPickItem, SyringePickItem, PackagingPickItem, LabelQueueItem,
  BatchDecantItem, ManualDecantProcess, BottleLedgerEvent, DecantLedgerEvent,
  FilterConfig, ActivityEvent,
} from '@/types';






export const mockFilterConfig: FilterConfig = {
  aura_colors: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Pink', 'Violet'],
  scent_types: ['Fresh', 'Light', 'Powdery', 'Strong', 'Sweet', 'Warm'],
  seasons: ['All Year Round', 'Fall', 'Spring', 'Summer', 'Winter'],
  occasions: ['Date Night', 'Everyday', 'Office', 'Party', 'Vacation', 'Workout'],
  concentrations: ['Extrait de Parfum', 'Eau de Parfum', 'Parfum', 'Eau de Toilette', 'Cologne'],
  genders: ['Feminine', 'Masculine', 'Unisex'],
  personalities: ['Classic', 'Elegant', 'Flirty', 'Mysterious', 'Sexy'],
  main_families: ['FRESH', 'FLORAL', 'ORIENTAL', 'WOODY', 'MODERN'],
  sub_families: ['Fresh Citrus', 'Fresh Aquatic', 'Fresh Green', 'Fresh Aromatic', 'Floral', 'Soft Floral', 'Floral Fruity', 'Floral Oriental', 'Soft Oriental', 'Oriental', 'Woody Oriental', 'Woods', 'Mossy Woods', 'Dry Woods', 'Gourmand', 'Fruity', 'Fougere', 'Exotic'],
};

export const mockPerfumes: Perfume[] = [
  {
    master_id: 'ME-PER/RED-MAI-BACC540-EDP', brand: 'Maison Francis Kurkdjian', name: 'Baccarat Rouge 540', concentration: 'Eau de Parfum',
    gender_target: 'unisex', visibility: 'active', main_family_id: 'fam_01', sub_family_id: 'sub_01',
    aura_id: 'aura_04', aura_color: 'Red', hype_level: 'High', scent_type: 'Warm',
    season: ['Fall', 'Winter'], occasion: ['Party', 'Date Night'], personality: ['Elegant', 'Sexy'],
    notes_top: ['Saffron', 'Jasmine'], notes_heart: ['Ambergris', 'Cedar'], notes_base: ['Fir Resin', 'Musk'],
    scent_signature: 'Luminous amber crystal', aura_verse: 'Where light meets warmth', scent_prose: 'A radiant amber that glows on skin',
    scent_story: 'The DNA of modern luxury', proposed_vault: 'Signature Vault', made_in: 'France',
    retail_price: 350, wholesale_price: 210,
    reference_size_ml: 70, price_per_ml: 5.00, price_multiplier: 1.1, surcharge: 0, surcharge_category: 'S1' as const,
    decant_pricing: [{ size_ml: 2, price: 25 }, { size_ml: 5, price: 45 }, { size_ml: 7.5, price: 60 }, { size_ml: 10, price: 75 }, { size_ml: 18, price: 120 }, { size_ml: 20, price: 130 }, { size_ml: 30, price: 180 }],
    in_stock: true, bottle_image_url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=200', brand_image_url: '',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
  },
  {
    master_id: 'ME-PER/ORG-TOMFO-TOBAVAN-EDP', brand: 'Tom Ford', name: 'Tobacco Vanille', concentration: 'Eau de Parfum',
    gender_target: 'unisex', visibility: 'active', main_family_id: 'fam_05', sub_family_id: 'sub_09',
    aura_id: 'aura_03', aura_color: 'Orange', hype_level: 'High', scent_type: 'Warm',
    season: ['Fall', 'Winter'], occasion: ['Date Night'], personality: ['Classic', 'Elegant'],
    notes_top: ['Tobacco Leaf', 'Spicy Notes'], notes_heart: ['Vanilla', 'Cacao'], notes_base: ['Dried Fruits', 'Woody Notes'],
    scent_signature: 'Opulent tobacco warmth', aura_verse: 'Smoke and velvet', scent_prose: 'Rich tobacco blended with sweet vanilla',
    scent_story: 'A modern classic of indulgence', proposed_vault: 'Signature Vault', made_in: 'United States',
    retail_price: 280, wholesale_price: 168,
    reference_size_ml: 50, price_per_ml: 5.60, price_multiplier: 1.2, surcharge: 5, surcharge_category: 'S2' as const,
    decant_pricing: [{ size_ml: 2, price: 30 }, { size_ml: 5, price: 55 }, { size_ml: 7.5, price: 72 }, { size_ml: 10, price: 90 }, { size_ml: 18, price: 145 }, { size_ml: 20, price: 155 }, { size_ml: 30, price: 215 }],
    in_stock: true, bottle_image_url: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=200', brand_image_url: '',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
  },
  {
    master_id: 'ME-PER/BLU-CRE-AVEN-EDP', brand: 'Creed', name: 'Aventus', concentration: 'Eau de Parfum',
    gender_target: 'masculine', visibility: 'active', main_family_id: 'fam_04', sub_family_id: 'sub_07',
    aura_id: 'aura_01', aura_color: 'Blue', hype_level: 'High', scent_type: 'Fresh',
    season: ['Spring', 'Summer'], occasion: ['Office', 'Everyday'], personality: ['Classic', 'Elegant'],
    notes_top: ['Pineapple', 'Bergamot', 'Apple'], notes_heart: ['Birch', 'Jasmine', 'Patchouli'], notes_base: ['Musk', 'Oak Moss', 'Vanilla'],
    scent_signature: 'Triumphant freshness', aura_verse: 'Built to conquer', scent_prose: 'A celebration of strength and vision',
    scent_story: 'Inspired by the dramatic life of a historic emperor', proposed_vault: 'Heritage Vault', made_in: 'France',
    retail_price: 445, wholesale_price: 267,
    reference_size_ml: 100, price_per_ml: 4.45, price_multiplier: 1.1, surcharge: 0, surcharge_category: 'S1' as const,
    decant_pricing: [{ size_ml: 2, price: 28 }, { size_ml: 5, price: 50 }, { size_ml: 7.5, price: 65 }, { size_ml: 10, price: 82 }, { size_ml: 18, price: 130 }, { size_ml: 20, price: 142 }, { size_ml: 30, price: 195 }],
    in_stock: true, bottle_image_url: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=200', brand_image_url: '',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
  },
  {
    master_id: 'ME-PER/GRN-PARDE-LAYT-EDP', brand: 'Parfums de Marly', name: 'Layton', concentration: 'Eau de Parfum',
    gender_target: 'masculine', visibility: 'active', main_family_id: 'fam_01', sub_family_id: 'sub_02',
    aura_id: 'aura_01', aura_color: 'Green', hype_level: 'Medium', scent_type: 'Warm',
    season: ['Fall', 'Winter', 'Spring'], occasion: ['Office', 'Party'], personality: ['Classic', 'Mysterious'],
    notes_top: ['Apple', 'Bergamot', 'Mandarin'], notes_heart: ['Jasmine', 'Violet', 'Geranium'], notes_base: ['Vanilla', 'Sandalwood', 'Cardamom'],
    scent_signature: 'Royal sophistication', aura_verse: 'The gentleman\'s armor', scent_prose: 'A masterful blend of fresh and warm',
    scent_story: 'Named after a legendary English estate', proposed_vault: 'Discovery Vault', made_in: 'France',
    retail_price: 315, wholesale_price: 189,
    reference_size_ml: 125, price_per_ml: 2.52, price_multiplier: 1.0, surcharge: 0, surcharge_category: 'S0' as const,
    decant_pricing: [{ size_ml: 2, price: 18 }, { size_ml: 5, price: 35 }, { size_ml: 7.5, price: 48 }, { size_ml: 10, price: 58 }, { size_ml: 18, price: 95 }, { size_ml: 20, price: 105 }, { size_ml: 30, price: 145 }],
    in_stock: true, bottle_image_url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=200', brand_image_url: '',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
  },
  {
    master_id: 'ME-PER/VIO-INI-OUDFORGRE-EDP', brand: 'Initio', name: 'Oud for Greatness', concentration: 'Eau de Parfum',
    gender_target: 'unisex', visibility: 'active', main_family_id: 'fam_02', sub_family_id: 'sub_03',
    aura_id: 'aura_06', aura_color: 'Violet', hype_level: 'Medium', scent_type: 'Strong',
    season: ['Fall', 'Winter'], occasion: ['Party', 'Date Night'], personality: ['Mysterious', 'Sexy'],
    notes_top: ['Oud', 'Nutmeg'], notes_heart: ['Musk', 'Patchouli'], notes_base: ['Lavender', 'Saffron'],
    scent_signature: 'Sacred oud ritual', aura_verse: 'Beyond the veil', scent_prose: 'Oud elevated to its purest expression',
    scent_story: 'A journey into the heart of oud', proposed_vault: 'Oud Vault', made_in: 'France',
    retail_price: 360, wholesale_price: 216,
    reference_size_ml: 90, price_per_ml: 4.00, price_multiplier: 1.3, surcharge: 10, surcharge_category: 'S2' as const,
    decant_pricing: [{ size_ml: 2, price: 32 }, { size_ml: 5, price: 58 }, { size_ml: 7.5, price: 78 }, { size_ml: 10, price: 95 }, { size_ml: 18, price: 155 }, { size_ml: 20, price: 168 }, { size_ml: 30, price: 230 }],
    in_stock: true, bottle_image_url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=200', brand_image_url: '',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
  },
  {
    master_id: 'ME-PER/YEL-XER-NAXO-EDP', brand: 'Xerjoff', name: 'Naxos', concentration: 'Eau de Parfum',
    gender_target: 'unisex', visibility: 'active', main_family_id: 'fam_05', sub_family_id: 'sub_10',
    aura_id: 'aura_07', aura_color: 'Yellow', hype_level: 'Medium', scent_type: 'Sweet',
    season: ['Fall', 'Winter'], occasion: ['Date Night', 'Everyday'], personality: ['Elegant', 'Classic'],
    notes_top: ['Lavender', 'Bergamot', 'Lemon'], notes_heart: ['Honey', 'Cinnamon', 'Cashmeran'], notes_base: ['Tobacco', 'Vanilla', 'Tonka Bean'],
    scent_signature: 'Mediterranean warmth', aura_verse: 'Sun-kissed elegance', scent_prose: 'A honeyed tobacco masterpiece',
    scent_story: 'Inspired by the ancient Greek colony of Naxos', proposed_vault: 'Discovery Vault', made_in: 'Italy',
    retail_price: 290, wholesale_price: 174,
    reference_size_ml: 100, price_per_ml: 2.90, price_multiplier: 1.0, surcharge: 0, surcharge_category: 'S1' as const,
    decant_pricing: [{ size_ml: 2, price: 22 }, { size_ml: 5, price: 40 }, { size_ml: 7.5, price: 55 }, { size_ml: 10, price: 68 }, { size_ml: 18, price: 110 }, { size_ml: 20, price: 120 }, { size_ml: 30, price: 165 }],
    in_stock: true, bottle_image_url: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=200', brand_image_url: '',
    created_at: '2024-06-01T00:00:00Z', updated_at: '2024-12-01T00:00:00Z',
  },
];



export const mockSuppliers: Supplier[] = [
  {
    supplier_id: 'sup_01', type: 'wholesaler', supplier_type: 'perfume', name: 'FragranceNet Wholesale', contact_name: 'James Miller', contact_email: 'wholesale@fragrancenet.com', contact_phone: '+1-800-555-0101', country: 'US', city: 'New York', payment_terms: 'Net 30', currency: 'AED', website: 'https://fragrancenet.com', notes: 'Primary supplier for mainstream niche', risk_flag: false, active: true, purchases: [
      { purchase_id: 'po_001', date: '2025-01-15', items: [{ master_id: 'ME-PER/RED-MAI-BACC540-EDP', perfume_name: 'Baccarat Rouge 540', qty: 3, size_ml: 70, unit_price: 195 }, { master_id: 'ME-PER/ORG-TOMFO-TOBAVAN-EDP', perfume_name: 'Tobacco Vanille', qty: 2, size_ml: 50, unit_price: 168 }], total_amount: 921, invoice_ref: 'FN-2025-0142' },
      { purchase_id: 'po_002', date: '2024-11-20', items: [{ master_id: 'ME-PER/GRN-PARDE-LAYT-EDP', perfume_name: 'Layton', qty: 2, size_ml: 125, unit_price: 189 }], total_amount: 378, invoice_ref: 'FN-2024-0891' },
      { purchase_id: 'po_003', date: '2024-09-05', items: [{ master_id: 'ME-PER/BLU-CRE-AVEN-EDP', perfume_name: 'Aventus', qty: 4, size_ml: 100, unit_price: 267 }], total_amount: 1068, invoice_ref: 'FN-2024-0612' },
    ], total_spent: 2367, total_items: 11, created_at: '2024-06-01T00:00:00Z'
  },
  {
    supplier_id: 'sup_02', type: 'retailer', supplier_type: 'perfume', name: 'Harrods', contact_name: 'Sarah Thompson', contact_email: 'buying@harrods.com', country: 'UK', city: 'London', payment_terms: 'Prepaid', currency: 'AED', website: 'https://harrods.com', notes: 'Retail backup — higher prices but guaranteed authentic', risk_flag: false, active: true, purchases: [
      { purchase_id: 'po_004', date: '2024-12-10', items: [{ master_id: 'ME-PER/VIO-INI-OUDFORGRE-EDP', perfume_name: 'Oud for Greatness', qty: 1, size_ml: 90, unit_price: 216 }], total_amount: 216, invoice_ref: 'HAR-2024-8821' },
    ], total_spent: 216, total_items: 1, created_at: '2024-08-15T00:00:00Z'
  },
  {
    supplier_id: 'sup_03', type: 'private_collector', supplier_type: 'perfume', name: 'Ahmed K.', contact_name: 'Ahmed Khalil', contact_email: 'ahmed@collector.ae', contact_phone: '+971-50-555-0103', country: 'UAE', city: 'Dubai', payment_terms: 'COD', currency: 'AED', notes: 'Rare bottles only — vintage and discontinued. Verify authenticity on every purchase.', risk_flag: true, active: true, purchases: [
      { purchase_id: 'po_005', date: '2025-01-02', items: [{ master_id: 'ME-PER/YEL-XER-NAXO-EDP', perfume_name: 'Naxos', qty: 2, size_ml: 100, unit_price: 145 }], total_amount: 290, invoice_ref: 'AK-2025-003' },
    ], total_spent: 290, total_items: 2, created_at: '2024-07-20T00:00:00Z'
  },
  {
    supplier_id: 'sup_04', type: 'direct', supplier_type: 'perfume', name: 'MFK Direct', contact_name: 'Pierre Dubois', contact_email: 'pro@mfranciskurkdjian.com', country: 'FR', city: 'Paris', payment_terms: 'Net 60', currency: 'AED', website: 'https://franciskurkdjian.com', notes: 'Brand direct account — best prices for MFK line', risk_flag: false, active: true, purchases: [
      { purchase_id: 'po_006', date: '2024-11-01', items: [{ master_id: 'ME-PER/RED-MAI-BACC540-EDP', perfume_name: 'Baccarat Rouge 540', qty: 5, size_ml: 70, unit_price: 175 }], total_amount: 875, invoice_ref: 'MFK-PRO-2024-112' },
      { purchase_id: 'po_007', date: '2024-08-15', items: [{ master_id: 'ME-PER/RED-MAI-BACC540-EDP', perfume_name: 'Baccarat Rouge 540', qty: 3, size_ml: 200, unit_price: 310 }], total_amount: 930, invoice_ref: 'MFK-PRO-2024-078' },
    ], total_spent: 1805, total_items: 8, created_at: '2024-05-10T00:00:00Z'
  },
  { supplier_id: 'sup_05', type: 'wholesaler', supplier_type: 'both', name: 'Niche Perfumery GmbH', contact_name: 'Klaus Weber', contact_email: 'orders@nicheperfumery.de', contact_phone: '+49-30-555-0199', country: 'DE', city: 'Berlin', payment_terms: 'Net 45', currency: 'AED', website: 'https://nicheperfumery.de', notes: 'European niche distributor — Xerjoff, Initio, Amouage', risk_flag: false, active: true, purchases: [], total_spent: 0, total_items: 0, created_at: '2025-01-20T00:00:00Z' },
  { supplier_id: 'sup_06', type: 'direct', supplier_type: 'perfume', name: 'Amouage Direct', contact_name: 'Fatima Al-Said', contact_email: 'wholesale@amouage.com', country: 'OM', city: 'Muscat', payment_terms: 'Net 30', currency: 'AED', notes: 'Direct from Amouage — Oman factory', risk_flag: false, active: false, purchases: [], total_spent: 0, total_items: 0, created_at: '2024-03-01T00:00:00Z' },
];

export const mockSyringes: Syringe[] = [
  { syringe_id: 'S/1', assigned_master_id: 'ME-PER/RED-MAI-BACC540-EDP', dedicated_perfume_name: 'Baccarat Rouge 540', sequence_number: 1, size: '5ml', status: 'active', last_used: '2025-02-05', use_count: 34, active: true, notes: 'Auto-created with perfume', created_at: '2024-10-15T00:00:00Z' },
  { syringe_id: 'S/2', assigned_master_id: 'ME-PER/ORG-TOMFO-TOBAVAN-EDP', dedicated_perfume_name: 'Tobacco Vanille', sequence_number: 2, size: '5ml', status: 'active', last_used: '2025-02-04', use_count: 28, active: true, notes: 'Auto-created with perfume', created_at: '2024-10-20T00:00:00Z' },
  { syringe_id: 'S/3', assigned_master_id: 'ME-PER/BLU-CRE-AVEN-EDP', dedicated_perfume_name: 'Aventus', sequence_number: 3, size: '10ml', status: 'active', last_used: '2025-02-06', use_count: 41, active: true, notes: 'Auto-created with perfume', created_at: '2024-09-15T00:00:00Z' },
  { syringe_id: 'S/4', assigned_master_id: 'ME-PER/VIO-INI-OUDFORGRE-EDP', dedicated_perfume_name: 'Oud for Greatness', sequence_number: 4, size: '5ml', status: 'active', last_used: '2025-01-28', use_count: 12, active: true, notes: 'Auto-created with perfume', created_at: '2024-08-20T00:00:00Z' },
  { syringe_id: 'S/5', assigned_master_id: 'ME-PER/GRN-PARDE-LAYT-EDP', dedicated_perfume_name: 'Layton', sequence_number: 5, size: '5ml', status: 'cleaning', last_used: '2025-02-01', use_count: 22, active: true, notes: 'Sent for cleaning cycle', created_at: '2024-11-10T00:00:00Z' },
  { syringe_id: 'S/6', assigned_master_id: 'ME-PER/YEL-XER-NAXO-EDP', dedicated_perfume_name: 'Naxos', sequence_number: 6, size: '5ml', status: 'active', last_used: '2025-02-03', use_count: 18, active: true, notes: 'Auto-created with perfume', created_at: '2024-12-01T00:00:00Z' },
  { syringe_id: 'S/7', sequence_number: 7, size: '10ml', status: 'retired', use_count: 89, active: false, notes: 'Retired — tip worn. Was used for Aventus backup.', created_at: '2024-06-01T00:00:00Z' },
  { syringe_id: 'S/8', sequence_number: 8, size: '20ml', status: 'active', use_count: 0, active: true, notes: 'Spare — unassigned', created_at: '2025-01-15T00:00:00Z' },
];

export const mockPackagingSKUs: PackagingSKU[] = [];

export const mockSealedBottles: SealedBottle[] = [
  // Sealed bottles (for sale or decanting)
  { bottle_id: 'BTL-001', master_id: 'ME-PER/RED-MAI-BACC540-EDP', bottle_type: 'sealed', size_ml: 70, supplier_id: 'sup_01', purchase_price: 195, purchase_date: '2024-10-15', location_code: 'MAIN-A-1-01', status: 'available', manufacturer_id: 'MFK-2024-001', barcode: 'EM-BTL-001-BACC540', qr_data: '{"id":"BTL-001","master":"ME-PER/RED-MAI-BACC540-EDP","type":"sealed","ml":70}', photos: [], created_at: '2024-10-15T00:00:00Z' },
  { bottle_id: 'BTL-002', master_id: 'ME-PER/RED-MAI-BACC540-EDP', bottle_type: 'sealed', size_ml: 70, supplier_id: 'sup_04', purchase_price: 185, purchase_date: '2024-11-01', location_code: 'MAIN-A-1-02', status: 'available', manufacturer_id: 'MFK-2024-002', barcode: 'EM-BTL-002-BACC540', qr_data: '{"id":"BTL-002","master":"ME-PER/RED-MAI-BACC540-EDP","type":"sealed","ml":70}', photos: [], created_at: '2024-11-01T00:00:00Z' },
  { bottle_id: 'BTL-003', master_id: 'ME-PER/ORG-TOMFO-TOBAVAN-EDP', bottle_type: 'sealed', size_ml: 50, supplier_id: 'sup_01', purchase_price: 168, purchase_date: '2024-10-20', location_code: 'MAIN-A-2-01', status: 'allocated', manufacturer_id: 'TF-2024-001', barcode: 'EM-BTL-003-TOBAVAN', qr_data: '{"id":"BTL-003","master":"ME-PER/ORG-TOMFO-TOBAVAN-EDP","type":"sealed","ml":50}', photos: [], created_at: '2024-10-20T00:00:00Z' },
  { bottle_id: 'BTL-004', master_id: 'ME-PER/BLU-CRE-AVEN-EDP', bottle_type: 'sealed', size_ml: 100, supplier_id: 'sup_02', purchase_price: 267, purchase_date: '2024-09-15', location_code: 'MAIN-B-1-01', status: 'available', manufacturer_id: 'CR-2024-001', barcode: 'EM-BTL-004-AVEN', qr_data: '{"id":"BTL-004","master":"ME-PER/BLU-CRE-AVEN-EDP","type":"sealed","ml":100}', photos: [], created_at: '2024-09-15T00:00:00Z' },
  // Open bottles (from suppliers/collectors, for decanting)
  { bottle_id: 'BTL-005', master_id: 'ME-PER/GRN-PARDE-LAYT-EDP', bottle_type: 'open', size_ml: 125, current_ml: 98, supplier_id: 'sup_01', purchase_price: 189, purchase_date: '2024-11-10', location_code: 'MAIN-B-1-02', status: 'available', manufacturer_id: 'PDM-2024-001', barcode: 'EM-BTL-005-LAYT', qr_data: '{"id":"BTL-005","master":"ME-PER/GRN-PARDE-LAYT-EDP","type":"open","ml":125}', photos: [], notes: 'Received open from FragranceNet — partial bottle', created_at: '2024-11-10T00:00:00Z' },
  { bottle_id: 'BTL-006', master_id: 'ME-PER/VIO-INI-OUDFORGRE-EDP', bottle_type: 'open', size_ml: 90, current_ml: 82, supplier_id: 'sup_03', purchase_price: 216, purchase_date: '2024-08-20', location_code: 'MAIN-B-2-01', status: 'reserved', manufacturer_id: 'INI-2024-001', barcode: 'EM-BTL-006-OUDFORGRE', qr_data: '{"id":"BTL-006","master":"ME-PER/VIO-INI-OUDFORGRE-EDP","type":"open","ml":90}', photos: [], notes: 'Private collector — opened, verified authentic', created_at: '2024-08-20T00:00:00Z' },
  // Tester bottles (for decanting only)
  { bottle_id: 'TST-001', master_id: 'ME-PER/RED-MAI-BACC540-EDP', bottle_type: 'tester', size_ml: 70, current_ml: 55, supplier_id: 'sup_04', purchase_price: 120, purchase_date: '2024-09-01', location_code: 'MAIN-A-2-02', status: 'available', manufacturer_id: 'MFK-TST-2024-001', barcode: 'EM-TST-001-BACC540', qr_data: '{"id":"TST-001","master":"ME-PER/RED-MAI-BACC540-EDP","type":"tester","ml":70}', photos: [], notes: 'MFK official tester — no box', created_at: '2024-09-01T00:00:00Z' },
  { bottle_id: 'TST-002', master_id: 'ME-PER/BLU-CRE-AVEN-EDP', bottle_type: 'tester', size_ml: 100, current_ml: 78, supplier_id: 'sup_02', purchase_price: 180, purchase_date: '2024-10-05', location_code: 'MAIN-B-2-02', status: 'available', manufacturer_id: 'CR-TST-2024-001', barcode: 'EM-TST-002-AVEN', qr_data: '{"id":"TST-002","master":"ME-PER/BLU-CRE-AVEN-EDP","type":"tester","ml":100}', photos: [], notes: 'Harrods tester — marked TESTER on bottle', created_at: '2024-10-05T00:00:00Z' },
];

export const mockDecantBottles: DecantBottle[] = [
  { bottle_id: 'DEC-001', master_id: 'ME-PER/RED-MAI-BACC540-EDP', size_ml: 70, current_ml: 42.5, opened_at: '2024-12-01', location_code: 'DEC-D-1-01', manufacturer_id: 'MFK-2024-003', photos: [] },
  { bottle_id: 'DEC-002', master_id: 'ME-PER/ORG-TOMFO-TOBAVAN-EDP', size_ml: 50, current_ml: 18.0, opened_at: '2024-12-05', location_code: 'DEC-D-1-02', manufacturer_id: 'TF-2024-002', photos: [] },
  { bottle_id: 'DEC-003', master_id: 'ME-PER/BLU-CRE-AVEN-EDP', size_ml: 100, current_ml: 67.0, opened_at: '2024-12-10', location_code: 'DEC-D-1-01', manufacturer_id: 'CR-2024-002', photos: [] },
  { bottle_id: 'DEC-004', master_id: 'ME-PER/YEL-XER-NAXO-EDP', size_ml: 100, current_ml: 85.0, opened_at: '2025-01-05', location_code: 'DEC-D-1-02', manufacturer_id: 'XER-2024-001', photos: [] },
];

export const mockPackagingStock: PackagingStock[] = [
  // Atomiser & Vials
  { sku_id: 'EM/ATM/DIAATO-8ML-PNK', qty_on_hand: 400 },
  { sku_id: 'EM/ATM/DIAATO-8ML-BLK', qty_on_hand: 400 },
  { sku_id: 'EM/ATM/STRATO-8ML-BLK', qty_on_hand: 500 },
  { sku_id: 'EM/ATM/STRATO-8ML-GLD', qty_on_hand: 400 },
  { sku_id: 'EM/ATM/INNVIAEMP-8ML-GLD', qty_on_hand: 1500 },
  { sku_id: 'EM/ATM/INNVIAEMP-8ML-BLK', qty_on_hand: 2500 },
  { sku_id: 'EM/ATM/INNVIAEMP-8ML-PNK', qty_on_hand: 1500 },
  // Decant Bottles
  { sku_id: 'EM/DCB/DECBOT-3ML-BLK', qty_on_hand: 500 },
  { sku_id: 'EM/DCB/DECBOT-5ML-BLK', qty_on_hand: 500 },
  { sku_id: 'EM/DCB/DECBOT-10ML-BLK', qty_on_hand: 500 },
  { sku_id: 'EM/DCB/DECBOT-20ML-BLK', qty_on_hand: 250 },
  { sku_id: 'EM/DCB/DECBOT-30ML-BLK', qty_on_hand: 250 },
  { sku_id: 'EM/DCB/DECVIA-1ML-CLE', qty_on_hand: 2000 },
  { sku_id: 'EM/DCB/DECVIA-1.5ML-CLE', qty_on_hand: 2000 },
  { sku_id: 'EM/DCB/DECVIA-2ML-CLE', qty_on_hand: 2000 },
  // Packaging Accessories
  { sku_id: 'EM/PCKGACC/TWICOTPOU-CUBE16*16*28CM-IVO', qty_on_hand: 250 },
  { sku_id: 'EM/PCKGACC/TWICOTPOU-STRAIGHT7*7*20CM-IVO', qty_on_hand: 500 },
  { sku_id: 'EM/PCKGACC/TWICOTPOU-FOLDER27*3.5*36CM-IVO', qty_on_hand: 500 },
  { sku_id: 'EM/PCKGACC/TWICOTPOUCIRBAS-ATOMIZER3.5*13CM-BLK', qty_on_hand: 1500 },
  { sku_id: 'EM/PCKGACC/TWICOTPOUPAPCOV-PAPER12*17CM-IVO', qty_on_hand: 1000 },
  { sku_id: 'EM/PCKGACC/CLECLO-CLEANING15*10CM-BLK', qty_on_hand: 1000 },
  { sku_id: 'EM/PCKGACC/METLAB-SQU-4.2X4.2CM-BLA', qty_on_hand: 1000 },
  { sku_id: 'EM/PCKGACC/METLAB-VAUMAS-5X2CM-BLA', qty_on_hand: 1000 },
  { sku_id: 'EM/PCKGACC/METLAB-ROU-3.5D-GLD', qty_on_hand: 1000 },
  { sku_id: 'EM/PCKGACC/METLAB-ROU-3.5D-BLA', qty_on_hand: 100 },
  { sku_id: 'EM/PCKGACC/TAS-1.2-BLA', qty_on_hand: 250 },
  { sku_id: 'EM/PCKGACC/WAXSEA-3.5CM-GLD', qty_on_hand: 3000 },
  { sku_id: 'EM/PCKGACC/TAG-RECTANGULAR-BLK', qty_on_hand: 400 },
  { sku_id: 'EM/PCKGACC/EMBSTI-5CM-GLD', qty_on_hand: 1000 },
  // Packaging Material
  { sku_id: 'EM/PCKG/PAPBAG20XCM-SMALL-BLK', qty_on_hand: 200 },
  { sku_id: 'EM/PCKG/PAPBAG25XCM-MEDIUM-BLK', qty_on_hand: 200 },
  { sku_id: 'EM/PCKG/BOX1-FOLBOX-26X20X3CM-BLK', qty_on_hand: 200 },
  { sku_id: 'EM/PCKG/BOX2-CUB-15X15X15CM-BLK', qty_on_hand: 200 },
  { sku_id: 'EM/PCKG/BOX3-STRBOX-6X6X13CM-BLK', qty_on_hand: 200 },
  { sku_id: 'EM/PCKG/BOX4-ENVBOX-21X16X2.5CM-BLK', qty_on_hand: 400 },
  // Labels
  { sku_id: 'EM/LBL/LAB32X10LAB-SMALL-WHI', qty_on_hand: 5 },
  { sku_id: 'EM/LBL/LAB38X10LAB-MEDIUM-WHI', qty_on_hand: 5 },
  // Shipping Material
  { sku_id: 'EM/SHIP/WRASHE-50X70CM-50X70CM-GRE', qty_on_hand: 1000 },
  { sku_id: 'EM/SHIP/KRABUBMAI190-SMALL-GRE', qty_on_hand: 4000 },
  { sku_id: 'EM/SHIP/KRABUBMAI250-MEDIUM-BLA', qty_on_hand: 4000 },
  { sku_id: 'EM/SHIP/FRASTIROL~NA', qty_on_hand: 5 },
];

export const mockOrders: Order[] = [
  {
    order_id: 'ORD-2025-001', shopify_id: 'SH-10001', type: 'one_time',
    customer: { name: 'Sarah Al-Rashid', email: 'sarah@example.com', phone: '+971501234567', address: '123 Marina Walk', city: 'Dubai', country: 'UAE' },
    items: [
      { item_id: 'itm_01', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 5, qty: 2, type: 'decant', unit_price: 45 },
      { item_id: 'itm_02', master_id: 'PF-002', perfume_name: 'Tobacco Vanille', size_ml: 10, qty: 1, type: 'decant', unit_price: 65 },
    ],
    status: 'new', tags: ['priority', 'dubai'], total_amount: 155, notes: 'Gift wrapping requested', created_at: '2025-02-06T10:00:00Z', updated_at: '2025-02-06T10:00:00Z',
  },
  {
    order_id: 'ORD-2025-002', shopify_id: 'SH-10002', type: 'one_time',
    customer: { name: 'James Chen', email: 'james@example.com', address: '45 Orchard Road', city: 'Singapore', country: 'SG' },
    items: [
      { item_id: 'itm_03', master_id: 'PF-003', perfume_name: 'Aventus', size_ml: 10, qty: 1, type: 'decant', unit_price: 55 },
      { item_id: 'itm_04', master_id: 'PF-005', perfume_name: 'Oud for Greatness', size_ml: 5, qty: 1, type: 'decant', unit_price: 48 },
    ],
    status: 'processing', tags: ['international'], total_amount: 103, created_at: '2025-02-05T14:30:00Z', updated_at: '2025-02-06T08:00:00Z',
  },
  {
    order_id: 'ORD-2025-003', shopify_id: 'SH-10003', type: 'subscription', subscription_tier: 'alchemist',
    customer: { name: 'Aisha Mohammed', email: 'aisha@example.com', address: '78 Jumeirah Beach Rd', city: 'Dubai', country: 'UAE' },
    items: [
      { item_id: 'itm_05', master_id: 'PF-004', perfume_name: 'Layton', size_ml: 5, qty: 1, type: 'decant', unit_price: 38 },
      { item_id: 'itm_06', master_id: 'PF-006', perfume_name: 'Naxos', size_ml: 5, qty: 1, type: 'decant', unit_price: 35 },
    ],
    status: 'picked', tags: ['subscription', 'vip'], total_amount: 73, created_at: '2025-02-04T09:00:00Z', updated_at: '2025-02-06T11:00:00Z',
  },
  {
    order_id: 'ORD-2025-004', shopify_id: 'SH-10004', type: 'one_time',
    customer: { name: 'Marco Rossi', email: 'marco@example.com', address: '12 Via Roma', city: 'Milan', country: 'IT' },
    items: [
      { item_id: 'itm_07', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 10, qty: 2, type: 'decant', unit_price: 85 },
    ],
    status: 'packed', tags: ['international', 'express'], total_amount: 170, created_at: '2025-02-03T16:00:00Z', updated_at: '2025-02-06T09:00:00Z',
  },
  {
    order_id: 'ORD-2025-006', shopify_id: 'SH-10006', type: 'one_time',
    customer: { name: 'Khalid Al-Mansoori', email: 'khalid@example.com', address: '22 Sheikh Zayed Rd', city: 'Dubai', country: 'UAE' },
    items: [
      { item_id: 'itm_10', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 70, qty: 1, type: 'sealed_bottle', unit_price: 350 },
      { item_id: 'itm_11', master_id: 'PF-003', perfume_name: 'Aventus', size_ml: 5, qty: 2, type: 'decant', unit_price: 48 },
    ],
    status: 'new', tags: ['full-bottle'], total_amount: 446, created_at: '2025-02-06T14:00:00Z', updated_at: '2025-02-06T14:00:00Z',
  },
  {
    order_id: 'ORD-2025-007', shopify_id: 'SH-10007', type: 'one_time',
    customer: { name: 'Lina Haddad', email: 'lina@example.com', address: '88 Hamra St', city: 'Beirut', country: 'LB' },
    items: [
      { item_id: 'itm_12', master_id: 'PF-002', perfume_name: 'Tobacco Vanille', size_ml: 50, qty: 1, type: 'sealed_bottle', unit_price: 280 },
    ],
    status: 'new', tags: ['international', 'full-bottle'], total_amount: 280, created_at: '2025-02-06T15:30:00Z', updated_at: '2025-02-06T15:30:00Z',
  },
  {
    order_id: 'ORD-2025-008', shopify_id: 'SH-10008', type: 'subscription', subscription_tier: 'explorer',
    customer: { name: 'Noor Patel', email: 'noor@example.com', address: '33 Al Wasl Rd', city: 'Dubai', country: 'UAE' },
    items: [
      { item_id: 'itm_13', master_id: 'PF-006', perfume_name: 'Naxos', size_ml: 5, qty: 1, type: 'decant', unit_price: 35 },
    ],
    status: 'new', tags: ['subscription', 'first-time'], total_amount: 35, created_at: '2025-02-06T16:00:00Z', updated_at: '2025-02-06T16:00:00Z',
  },
  {
    order_id: 'ORD-2025-009', shopify_id: 'SH-10009', type: 'subscription', subscription_tier: 'grand_master',
    customer: { name: 'Omar Farouk', email: 'omar@example.com', address: '7 Corniche Rd', city: 'Abu Dhabi', country: 'UAE' },
    items: [
      { item_id: 'itm_14', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 5, qty: 2, type: 'decant', unit_price: 45 },
      { item_id: 'itm_15', master_id: 'PF-004', perfume_name: 'Layton', size_ml: 5, qty: 2, type: 'decant', unit_price: 38 },
      { item_id: 'itm_16', master_id: 'PF-005', perfume_name: 'Oud for Greatness', size_ml: 5, qty: 1, type: 'decant', unit_price: 48 },
    ],
    status: 'new', tags: ['subscription', 'first-time', 'vip'], total_amount: 214, created_at: '2025-02-06T17:00:00Z', updated_at: '2025-02-06T17:00:00Z',
  },
  {
    order_id: 'ORD-2025-005', shopify_id: 'SH-10005', type: 'one_time',
    customer: { name: 'Fatima Al-Sayed', email: 'fatima@example.com', address: '56 Corniche', city: 'Abu Dhabi', country: 'UAE' },
    items: [
      { item_id: 'itm_08', master_id: 'PF-002', perfume_name: 'Tobacco Vanille', size_ml: 5, qty: 3, type: 'decant', unit_price: 42 },
      { item_id: 'itm_09', master_id: 'PF-003', perfume_name: 'Aventus', size_ml: 5, qty: 2, type: 'decant', unit_price: 48 },
    ],
    status: 'shipped', tags: ['uae'], total_amount: 222, created_at: '2025-02-02T11:00:00Z', updated_at: '2025-02-05T15:00:00Z',
  },
  // Additional full bottle orders for demonstrating the Full Bottles tab
  {
    order_id: 'ORD-2025-010', shopify_id: 'SH-10010', type: 'one_time',
    customer: { name: 'Rania Khoury', email: 'rania@example.com', address: '14 Verdun St', city: 'Beirut', country: 'LB' },
    items: [
      { item_id: 'itm_17', master_id: 'PF-004', perfume_name: 'Layton', size_ml: 125, qty: 1, type: 'sealed_bottle', unit_price: 420 },
      { item_id: 'itm_18', master_id: 'PF-005', perfume_name: 'Oud for Greatness', size_ml: 100, qty: 1, type: 'sealed_bottle', unit_price: 580 },
      { item_id: 'itm_19', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 5, qty: 1, type: 'decant', unit_price: 45 },
    ],
    status: 'new', tags: ['international', 'full-bottle', 'vip'], total_amount: 1045, created_at: '2025-02-07T11:00:00Z', updated_at: '2025-02-07T11:00:00Z',
  },
  {
    order_id: 'ORD-2025-011', shopify_id: 'SH-10011', type: 'one_time',
    customer: { name: 'Tariq Al-Hashimi', email: 'tariq@example.com', address: '9 Al Khaleej Rd', city: 'Sharjah', country: 'UAE' },
    items: [
      { item_id: 'itm_20', master_id: 'PF-003', perfume_name: 'Aventus', size_ml: 100, qty: 2, type: 'sealed_bottle', unit_price: 450 },
    ],
    status: 'processing', tags: ['full-bottle', 'uae'], total_amount: 900, created_at: '2025-02-07T16:00:00Z', updated_at: '2025-02-07T16:30:00Z',
  },
  {
    order_id: 'ORD-2025-012', shopify_id: 'SH-10012', type: 'one_time',
    customer: { name: 'Yasmine Darwish', email: 'yasmine@example.com', address: '5 Zamalek St', city: 'Cairo', country: 'EG' },
    items: [
      { item_id: 'itm_21', master_id: 'PF-006', perfume_name: 'Naxos', size_ml: 100, qty: 1, type: 'sealed_bottle', unit_price: 320 },
      { item_id: 'itm_22', master_id: 'PF-002', perfume_name: 'Tobacco Vanille', size_ml: 100, qty: 1, type: 'sealed_bottle', unit_price: 380 },
    ],
    status: 'new', tags: ['international', 'full-bottle'], total_amount: 700, created_at: '2025-02-05T20:00:00Z', updated_at: '2025-02-05T20:00:00Z',
  },
  // More full bottle orders at various lifecycle stages
  {
    order_id: 'ORD-2025-013', shopify_id: 'SH-10013', type: 'one_time',
    customer: { name: 'Ahmed Al-Nasser', email: 'ahmed.n@example.com', address: '18 Pearl Blvd', city: 'Doha', country: 'QA' },
    items: [
      { item_id: 'itm_23', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 200, qty: 1, type: 'sealed_bottle', unit_price: 680 },
      { item_id: 'itm_24', master_id: 'PF-005', perfume_name: 'Oud for Greatness', size_ml: 100, qty: 1, type: 'sealed_bottle', unit_price: 580 },
    ],
    status: 'picked', tags: ['international', 'full-bottle', 'vip'], total_amount: 1260, created_at: '2025-02-04T09:30:00Z', updated_at: '2025-02-05T14:00:00Z',
  },
  {
    order_id: 'ORD-2025-014', shopify_id: 'SH-10014', type: 'one_time',
    customer: { name: 'Layla Bitar', email: 'layla.b@example.com', address: '42 Hamad St', city: 'Manama', country: 'BH' },
    items: [
      { item_id: 'itm_25', master_id: 'PF-004', perfume_name: 'Layton', size_ml: 75, qty: 2, type: 'sealed_bottle', unit_price: 310 },
    ],
    status: 'packed', tags: ['full-bottle', 'international'], total_amount: 620, created_at: '2025-02-03T12:00:00Z', updated_at: '2025-02-06T10:00:00Z',
  },
  {
    order_id: 'ORD-2025-015', shopify_id: 'SH-10015', type: 'one_time',
    customer: { name: 'Hassan Jaber', email: 'hassan.j@example.com', address: '7 Muscat Hills', city: 'Muscat', country: 'OM' },
    items: [
      { item_id: 'itm_26', master_id: 'PF-003', perfume_name: 'Aventus', size_ml: 50, qty: 1, type: 'sealed_bottle', unit_price: 290 },
      { item_id: 'itm_27', master_id: 'PF-006', perfume_name: 'Naxos', size_ml: 50, qty: 1, type: 'sealed_bottle', unit_price: 210 },
      { item_id: 'itm_28', master_id: 'PF-002', perfume_name: 'Tobacco Vanille', size_ml: 5, qty: 2, type: 'decant', unit_price: 42 },
    ],
    status: 'shipped', tags: ['full-bottle', 'international'], total_amount: 584, created_at: '2025-02-01T08:00:00Z', updated_at: '2025-02-04T16:00:00Z',
  },
  {
    order_id: 'ORD-2025-016', shopify_id: 'SH-10016', type: 'one_time',
    customer: { name: 'Mona Al-Faisal', email: 'mona.f@example.com', address: '31 King Fahd Rd', city: 'Riyadh', country: 'SA' },
    items: [
      { item_id: 'itm_29', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', size_ml: 70, qty: 1, type: 'sealed_bottle', unit_price: 350 },
      { item_id: 'itm_30', master_id: 'PF-004', perfume_name: 'Layton', size_ml: 125, qty: 1, type: 'sealed_bottle', unit_price: 420 },
      { item_id: 'itm_31', master_id: 'PF-003', perfume_name: 'Aventus', size_ml: 100, qty: 1, type: 'sealed_bottle', unit_price: 450 },
    ],
    status: 'prepped', tags: ['full-bottle', 'vip', 'international'], total_amount: 1220, created_at: '2025-02-05T07:00:00Z', updated_at: '2025-02-06T11:30:00Z',
  },
];

export const mockJobs: Job[] = [
  {
    job_id: 'JOB-2025-001', type: 'decant_batch', source: 'one_time', status: 'pending',
    station_statuses: [
      { station: 1, status: 'completed', started_at: '2025-02-06T08:00:00Z', completed_at: '2025-02-06T08:15:00Z' },
      { station: 2, status: 'in_progress', started_at: '2025-02-06T08:20:00Z' },
      { station: 3, status: 'pending' },
      { station: 4, status: 'pending' },
    ],
    order_ids: ['ORD-2025-001', 'ORD-2025-002'], created_at: '2025-02-06T08:00:00Z', updated_at: '2025-02-06T08:20:00Z',
  },
  {
    job_id: 'JOB-2025-002', type: 'fulfillment', source: 'one_time', status: 'picked',
    station_statuses: [
      { station: 5, status: 'in_progress', started_at: '2025-02-06T09:00:00Z' },
      { station: 6, status: 'pending' },
    ],
    order_ids: ['ORD-2025-003'], created_at: '2025-02-06T09:00:00Z', updated_at: '2025-02-06T09:00:00Z',
  },
  {
    job_id: 'JOB-2025-003', type: 'decant_batch', source: 'subscription', status: 'decanted',
    station_statuses: [
      { station: 1, status: 'completed' },
      { station: 2, status: 'completed' },
      { station: 3, status: 'completed' },
      { station: 4, status: 'completed' },
    ],
    order_ids: ['ORD-2025-004'], created_at: '2025-02-05T08:00:00Z', updated_at: '2025-02-06T07:00:00Z',
  },
];

export const mockSubscriptionCycles: SubscriptionCycle[] = [
  {
    cycle_id: 'CYC-2025-02', cutoff_date: '2025-02-14', status: 'active',
    forecast_summary: { total_orders: 24, total_decants: 72, perfumes_needed: [{ master_id: 'PF-001', name: 'Baccarat Rouge 540', total_ml: 120 }, { master_id: 'PF-002', name: 'Tobacco Vanille', total_ml: 85 }, { master_id: 'PF-004', name: 'Layton', total_ml: 60 }, { master_id: 'PF-006', name: 'Naxos', total_ml: 45 }] },
    generated_jobs_count: 3,
  },
  {
    cycle_id: 'CYC-2025-01', cutoff_date: '2025-01-28', status: 'completed',
    forecast_summary: { total_orders: 18, total_decants: 54, perfumes_needed: [{ master_id: 'PF-001', name: 'Baccarat Rouge 540', total_ml: 90 }, { master_id: 'PF-003', name: 'Aventus', total_ml: 75 }, { master_id: 'PF-005', name: 'Oud for Greatness', total_ml: 50 }] },
    generated_jobs_count: 2,
  },
];

export const mockDashboardKPIs: DashboardKPIs = {
  one_time_orders: { new: 3, in_progress: 5, packed: 2, shipped: 8 },
  subscription: { active_cycle_cutoff: '2025-02-14', days_left: 7, orders_count: 24 },
  decant_batches: { pending: 2, in_progress: 1, completed: 4 },
  shipping: { ready_for_pickup: 3 },
  full_bottles: { pending: 2, in_progress: 1, packed: 1, shipped: 3 },
  revenue: { total_aed: 14250, subscription_aed: 4800, one_time_aed: 5950, full_bottle_aed: 3500 },
  customers: { total: 47, new_this_period: 8, returning: 39 },
  inventory: { total_bottles: 52, total_ml: 3200, low_stock_count: 3 },
};

export const mockPipeline: PipelineStage[] = [
  { stage: 'Orders In', count: 3 },
  { stage: 'Picked', count: 5 },
  { stage: 'Prepped', count: 4 },
  { stage: 'Decanted', count: 2 },
  { stage: 'Packed', count: 2 },
  { stage: 'Shipped', count: 8 },
];

export const mockAlerts: InventoryAlert[] = [
  { id: 'alert_01', type: 'low_ml', severity: 'critical', message: 'Tobacco Vanille (DEC-002) — only 18ml remaining', created_at: '2025-02-06T07:00:00Z' },
  { id: 'alert_02', type: 'low_packaging', severity: 'warning', message: '5ml Labels (PKG-LBL-5ML) — only 8 sheets left', created_at: '2025-02-06T06:30:00Z' },
  { id: 'alert_03', type: 'cutoff', severity: 'info', message: 'Subscription cutoff in 7 days (Feb 14)', created_at: '2025-02-06T06:00:00Z' },
  { id: 'alert_04', type: 'stuck_order', severity: 'warning', message: 'ORD-2025-002 stuck in processing for 24h', created_at: '2025-02-06T08:00:00Z' },
  { id: 'alert_05', type: 'low_packaging', severity: 'critical', message: '2ml Labels (PKG-LBL-2ML) — only 15 sheets left', created_at: '2025-02-06T05:00:00Z' },
];

export const mockSettings: Record<string, string> = {
  cutoff_start: '09:00',
  cutoff_end: '21:00',
  pack_lead_days: '1',
  delivery_lead_days: '2',
  cycle_cutoff_days: '7,14,21,28',
  cycle_delivery_lead_days: '7',
  cycles_per_month: '4',
  cycle_processing_days: '5',
  sub_base_price: '149.99',
  sub_extra_vial_price: '75',
  sub_min_vials: '1',
  sub_max_vials: '4',
  sub_surcharge_per_level: '25',
  sub_base_surcharge_tier: 'S0',
};

export const mockCriticalPerfumes: CriticalPerfume[] = [
  { master_id: 'PF-002', name: 'Tobacco Vanille', brand: 'Tom Ford', current_ml: 18, threshold_ml: 30 },
  { master_id: 'PF-001', name: 'Baccarat Rouge 540', brand: 'MFK', current_ml: 42.5, threshold_ml: 50 },
  { master_id: 'PF-003', name: 'Aventus', brand: 'Creed', current_ml: 67, threshold_ml: 80 },
];

export const mockDecantPickList: DecantPickItem[] = [
  { bottle_id: 'DEC-001', master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', perfume_image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=80', location_code: 'DEC-D-1-01', required_sizes: [{ size_ml: 5, qty: 4 }, { size_ml: 10, qty: 2 }], picked: false },
  { bottle_id: 'DEC-002', master_id: 'PF-002', perfume_name: 'Tobacco Vanille', perfume_image: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=80', location_code: 'DEC-D-1-02', required_sizes: [{ size_ml: 5, qty: 3 }, { size_ml: 10, qty: 1 }], picked: false },
  { bottle_id: 'DEC-003', master_id: 'PF-003', perfume_name: 'Aventus', perfume_image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=80', location_code: 'DEC-D-1-01', required_sizes: [{ size_ml: 5, qty: 2 }, { size_ml: 10, qty: 1 }], picked: false },
];

export const mockSyringePickList: SyringePickItem[] = [
  { syringe_id: 'SYR-001', recommended_perfume: 'Baccarat Rouge 540', picked: false },
  { syringe_id: 'SYR-002', recommended_perfume: 'Tobacco Vanille', picked: false },
  { syringe_id: 'SYR-003', recommended_perfume: 'Aventus', picked: false },
];

export const mockPackagingPickProduction: PackagingPickItem[] = [
  { sku_id: 'PKG-ATM-5ML', name: '5ml Atomizer', qty_required: 9, picked: false },
  { sku_id: 'PKG-ATM-10ML', name: '10ml Atomizer', qty_required: 4, picked: false },
  { sku_id: 'PKG-CAP-STD', name: 'Standard Cap', qty_required: 13, picked: false },
];

export const mockPackagingPickFulfillment: PackagingPickItem[] = [
  { sku_id: 'PKG-BOX-SM', name: 'Small Gift Box', qty_required: 3, picked: false },
  { sku_id: 'PKG-INL-SM', name: 'Small Box Inlay', qty_required: 3, picked: false },
  { sku_id: 'PKG-INS-STD', name: 'Brand Insert Card', qty_required: 5, picked: false },
];

export const mockLabelQueue: LabelQueueItem[] = [
  { size_ml: 2, qty_to_print: 0 },
  { size_ml: 5, qty_to_print: 9 },
  { size_ml: 10, qty_to_print: 4 },
];

export const mockBatchDecantItems: BatchDecantItem[] = [
  {
    master_id: 'PF-001', perfume_name: 'Baccarat Rouge 540', perfume_image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400',
    bottle_id: 'DEC-001', manufacturer_id: 'MFK-2024-003', current_ml: 42.5, location_code: 'DEC-D-1-01',
    matrix: [
      { size_ml: 5, qty_required: 4, qty_completed: 0, remaining: 4 },
      { size_ml: 10, qty_required: 2, qty_completed: 0, remaining: 2 },
    ],
    progress: 0, completed: false,
  },
  {
    master_id: 'PF-002', perfume_name: 'Tobacco Vanille', perfume_image: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?w=400',
    bottle_id: 'DEC-002', manufacturer_id: 'TF-2024-002', current_ml: 18.0, location_code: 'DEC-D-1-02',
    matrix: [
      { size_ml: 5, qty_required: 3, qty_completed: 0, remaining: 3 },
      { size_ml: 10, qty_required: 1, qty_completed: 0, remaining: 1 },
    ],
    progress: 0, completed: false,
  },
  {
    master_id: 'PF-003', perfume_name: 'Aventus', perfume_image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=400',
    bottle_id: 'DEC-003', manufacturer_id: 'CR-2024-002', current_ml: 67.0, location_code: 'DEC-D-1-01',
    matrix: [
      { size_ml: 5, qty_required: 2, qty_completed: 0, remaining: 2 },
      { size_ml: 10, qty_required: 1, qty_completed: 0, remaining: 1 },
    ],
    progress: 0, completed: false,
  },
];

export const mockPrintJobs: PrintJob[] = [
  { print_job_id: 'PJ-001', type: 'label', target_type: 'job', target_id: 'JOB-2025-001', qty: 9, status: 'pending', created_at: '2025-02-06T08:30:00Z', updated_at: '2025-02-06T08:30:00Z' },
  { print_job_id: 'PJ-002', type: 'label', target_type: 'job', target_id: 'JOB-2025-001', qty: 4, status: 'pending', created_at: '2025-02-06T08:30:00Z', updated_at: '2025-02-06T08:30:00Z' },
  { print_job_id: 'PJ-003', type: 'insert', target_type: 'order', target_id: 'ORD-2025-001', qty: 1, status: 'printed', printed_by: 'usr_001', created_at: '2025-02-06T09:00:00Z', updated_at: '2025-02-06T09:15:00Z' },
];

export const mockBottleLedger: BottleLedgerEvent[] = [
  { event_id: 'ble_01', bottle_id: 'BTL-001', type: 'INTAKE', reason: 'Stock intake', user_id: 'usr_001', created_at: '2024-10-15T10:00:00Z' },
  { event_id: 'ble_02', bottle_id: 'DEC-001', type: 'OPENED', qty_ml: 70, reason: 'Opened for decanting', user_id: 'usr_001', created_at: '2024-12-01T09:00:00Z' },
  { event_id: 'ble_03', bottle_id: 'DEC-001', type: 'DECANTED_OUT', qty_ml: 27.5, reason: 'Batch decant JOB-2024-015', job_id: 'JOB-2024-015', user_id: 'usr_001', created_at: '2024-12-15T11:00:00Z' },
];

export const mockDecantLedger: DecantLedgerEvent[] = [
  { event_id: 'dle_01', type: 'BATCH_DECANT', bottle_id: 'DEC-001', qty_ml: 20, units_produced: 4, job_id: 'JOB-2024-015', user_id: 'usr_001', notes: '4x 5ml BR540', created_at: '2024-12-15T11:00:00Z' },
  { event_id: 'dle_02', type: 'BATCH_DECANT', bottle_id: 'DEC-001', qty_ml: 7.5, units_produced: 1, job_id: 'JOB-2024-015', user_id: 'usr_001', notes: '1x 7.5ml BR540 (Aura Key)', created_at: '2024-12-15T11:30:00Z' },
  { event_id: 'dle_03', type: 'MANUAL_DECANT', bottle_id: 'DEC-002', qty_ml: 10, units_produced: 2, user_id: 'usr_001', notes: 'Manual 2x 5ml TV for VIP', created_at: '2025-01-10T14:00:00Z' },
];

export const mockCycles = mockSubscriptionCycles;

export const mockActivity: ActivityEvent[] = [
  {
    id: 'act_01',
    type: 'order_created',
    title: 'New Order: ORD-2025-001',
    description: 'Sarah Al-Rashid placed an order for 3 items.',
    entityType: 'order',
    entityId: 'ORD-2025-001',
    icon: 'ShoppingCart',
    color: 'blue',
    timestamp: '2025-02-06T10:00:00Z',
  },
  {
    id: 'act_02',
    type: 'bottle_intake',
    title: 'Bottle Intake: BTL-001',
    description: 'Baccarat Rouge 540 (70ml) added to Zone A.',
    entityType: 'bottle',
    entityId: 'BTL-001',
    icon: 'Package',
    color: 'green',
    timestamp: '2025-02-06T09:30:00Z',
  },
  {
    id: 'act_03',
    type: 'decant_deduction',
    title: 'Decant Sync: DEC-001',
    description: '20ml deducted from Baccarat Rouge 540 decant bottle.',
    entityType: 'bottle',
    entityId: 'DEC-001',
    icon: 'Droplet',
    color: 'orange',
    timestamp: '2025-02-06T08:45:00Z',
  },
];
