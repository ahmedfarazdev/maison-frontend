// ============================================================
// Shared Inventory Store — Event Bus & State
// Connects: Suppliers PO → Ledger → Sealed Vault → Locations
// Uses simple pub/sub + singleton state so all pages stay in sync.
// ============================================================

import type {
  SealedBottle, BottleLedgerEvent, VaultLocation, Supplier,
  SupplierPurchase, Perfume, BottleStatus, BottleType,
} from '@/types';
import { mockSealedBottles, mockBottleLedger, mockLocations, mockSuppliers } from '@/lib/mock-data';

// ---- Document Types ----
export type DocumentCategory = 'invoice' | 'certificate_of_authenticity' | 'shipping_document' | 'packing_list' | 'customs_declaration' | 'quality_report' | 'insurance' | 'other';

export interface PODocument {
  doc_id: string;
  po_id: string;
  category: DocumentCategory;
  file_name: string;
  file_type: string; // mime type
  file_size: number; // bytes
  uploaded_by: string;
  uploaded_at: string;
  notes?: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  file_url: string;
  thumbnail_url?: string;
}

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; icon: string; required: boolean }[] = [
  { value: 'invoice', label: 'Invoice', icon: 'receipt', required: true },
  { value: 'certificate_of_authenticity', label: 'Certificate of Authenticity', icon: 'shield-check', required: true },
  { value: 'shipping_document', label: 'Shipping Document', icon: 'truck', required: false },
  { value: 'packing_list', label: 'Packing List', icon: 'clipboard-list', required: false },
  { value: 'customs_declaration', label: 'Customs Declaration', icon: 'landmark', required: false },
  { value: 'quality_report', label: 'Quality Report', icon: 'microscope', required: false },
  { value: 'insurance', label: 'Insurance', icon: 'shield', required: false },
  { value: 'other', label: 'Other', icon: 'paperclip', required: false },
];

// ---- PO Status lifecycle ----
export type POStatus = 'draft' | 'pending' | 'partially_received' | 'received' | 'cancelled';

export type POCancelCategory = 'supplier_delay' | 'price_change' | 'quality_issue' | 'duplicate' | 'out_of_stock' | 'other';

export interface PurchaseOrderItem {
  master_id: string;
  perfume_name: string;
  qty: number;
  size_ml: number;
  unit_price: number;
  bottle_type: BottleType;
  received_qty: number;
}

export interface PurchaseOrder {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  status: POStatus;
  items: PurchaseOrderItem[];
  total_amount: number;
  currency: string;
  invoice_ref?: string;
  expected_delivery?: string;
  notes?: string;
  cancel_reason?: string;
  cancel_category?: POCancelCategory;
  documents: PODocument[];
  compliance_status: 'pending' | 'partial' | 'complete';
  created_at: string;
  received_at?: string;
  cancelled_at?: string;
}

// ---- Listeners ----
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn());
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- Singleton State ----
let docCounter = 1;
let _sealedBottles: SealedBottle[] = [...mockSealedBottles];
let _bottleLedger: BottleLedgerEvent[] = [...mockBottleLedger];
let _locations: VaultLocation[] = [...mockLocations];
let _suppliers: Supplier[] = [...mockSuppliers];
let _purchaseOrders: PurchaseOrder[] = initPOsFromSuppliers();

// Initialize POs from existing supplier purchase history (all marked as received)
function initPOsFromSuppliers(): PurchaseOrder[] {
  const pos: PurchaseOrder[] = [];
  for (const sup of mockSuppliers) {
    for (const po of sup.purchases) {
      const mockDocs: PODocument[] = [
        {
          doc_id: `doc_${String(docCounter++).padStart(3, '0')}`,
          po_id: po.purchase_id,
          category: 'invoice',
          file_name: `${po.invoice_ref || po.purchase_id}_invoice.pdf`,
          file_type: 'application/pdf',
          file_size: 245000 + Math.floor(Math.random() * 100000),
          uploaded_by: 'usr_001',
          uploaded_at: po.date,
          verified: true,
          verified_by: 'usr_001',
          verified_at: po.date,
          file_url: '#',
        },
        {
          doc_id: `doc_${String(docCounter++).padStart(3, '0')}`,
          po_id: po.purchase_id,
          category: 'certificate_of_authenticity',
          file_name: `${po.purchase_id}_COA.pdf`,
          file_type: 'application/pdf',
          file_size: 180000 + Math.floor(Math.random() * 80000),
          uploaded_by: 'usr_001',
          uploaded_at: po.date,
          verified: true,
          verified_by: 'usr_001',
          verified_at: po.date,
          file_url: '#',
        },
        {
          doc_id: `doc_${String(docCounter++).padStart(3, '0')}`,
          po_id: po.purchase_id,
          category: 'shipping_document',
          file_name: `${po.purchase_id}_shipping.pdf`,
          file_type: 'application/pdf',
          file_size: 120000 + Math.floor(Math.random() * 60000),
          uploaded_by: 'usr_001',
          uploaded_at: po.date,
          verified: true,
          verified_by: 'usr_001',
          verified_at: po.date,
          file_url: '#',
        },
      ];
      pos.push({
        po_id: po.purchase_id,
        supplier_id: sup.supplier_id,
        supplier_name: sup.name,
        status: 'received',
        items: po.items.map(i => ({ ...i, bottle_type: 'sealed' as BottleType, received_qty: i.qty })),
        total_amount: po.total_amount,
        currency: sup.currency || 'AED',
        invoice_ref: po.invoice_ref,
        notes: po.notes,
        documents: mockDocs,
        compliance_status: 'complete',
        created_at: po.date,
        received_at: po.date,
      });
    }
  }
  return pos;
}

// ---- Getters ----
export function getSealedBottles(): SealedBottle[] { return _sealedBottles; }
export function getBottleLedger(): BottleLedgerEvent[] { return _bottleLedger; }
export function getLocations(): VaultLocation[] { return _locations; }
export function getSuppliers(): Supplier[] { return _suppliers; }
export function getPurchaseOrders(): PurchaseOrder[] { return _purchaseOrders; }

// ---- Setters (for pages that manage their own state but need to sync) ----
export function updateLocations(locs: VaultLocation[]) {
  _locations = locs;
  notify();
}

export function updateSuppliers(sups: Supplier[]) {
  _suppliers = sups;
  notify();
}

// ---- Create Purchase Order (draft -> pending) ----
let poCounter = _purchaseOrders.length + 1;

export function createPurchaseOrder(params: {
  supplier_id: string;
  supplier_name: string;
  currency: string;
  items: { master_id: string; perfume_name: string; qty: number; size_ml: number; unit_price: number; bottle_type?: BottleType }[];
  invoice_ref?: string;
  expected_delivery?: string;
  notes?: string;
}): PurchaseOrder {
  const po: PurchaseOrder = {
    po_id: `po_${String(poCounter++).padStart(3, '0')}`,
    supplier_id: params.supplier_id,
    supplier_name: params.supplier_name,
    status: 'pending',
    items: params.items.map(i => ({ ...i, bottle_type: i.bottle_type || 'sealed' as BottleType, received_qty: 0 })),
    total_amount: params.items.reduce((s, i) => s + i.qty * i.unit_price, 0),
    currency: params.currency,
    invoice_ref: params.invoice_ref,
    expected_delivery: params.expected_delivery,
    notes: params.notes,
    documents: [],
    compliance_status: 'pending',
    created_at: new Date().toISOString(),
  };
  _purchaseOrders = [po, ..._purchaseOrders];
  notify();
  return po;
}

// ---- Confirm Receipt of PO ----
let bottleCounter = _sealedBottles.length + 1;
let ledgerCounter = _bottleLedger.length + 1;

export function confirmPOReceipt(poId: string): {
  bottles: SealedBottle[];
  ledgerEvents: BottleLedgerEvent[];
} {
  const po = _purchaseOrders.find(p => p.po_id === poId);
  if (!po || po.status === 'received' || po.status === 'cancelled') {
    return { bottles: [], ledgerEvents: [] };
  }

  const newBottles: SealedBottle[] = [];
  const newLedgerEvents: BottleLedgerEvent[] = [];
  const now = new Date().toISOString();

  for (const item of po.items) {
    const qtyToReceive = item.qty - item.received_qty;
    for (let i = 0; i < qtyToReceive; i++) {
      const emptySlot = _locations.find(l => !l.occupied && l.type === 'sealed');
      const locationCode = emptySlot ? emptySlot.code : 'UNASSIGNED';

      const bottleId = `BTL-${String(bottleCounter++).padStart(3, '0')}`;

      const bottleType: BottleType = item.bottle_type || 'sealed';
      const barcodeStr = `EM-${bottleId}-${item.master_id.split('/').pop()?.split('-')[0] || 'UNK'}`;
      const qrPayload = JSON.stringify({ id: bottleId, master: item.master_id, type: bottleType, ml: item.size_ml, po: po.po_id });

      const bottle: SealedBottle = {
        bottle_id: bottleId,
        master_id: item.master_id,
        bottle_type: bottleType,
        size_ml: item.size_ml,
        current_ml: bottleType !== 'sealed' ? item.size_ml : undefined,
        supplier_id: po.supplier_id,
        purchase_price: item.unit_price,
        purchase_date: now.split('T')[0],
        location_code: locationCode,
        status: 'available' as BottleStatus,
        manufacturer_id: `${po.supplier_name.substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${String(bottleCounter).padStart(3, '0')}`,
        barcode: barcodeStr,
        qr_data: qrPayload,
        photos: [],
        created_at: now,
      };
      newBottles.push(bottle);

      const ledgerEvent: BottleLedgerEvent = {
        event_id: `ble_${String(ledgerCounter++).padStart(3, '0')}`,
        bottle_id: bottleId,
        type: 'INTAKE',
        qty_ml: item.size_ml,
        reason: `PO ${po.po_id} received from ${po.supplier_name} \u2014 ${item.perfume_name}`,
        job_id: po.po_id,
        user_id: 'usr_001',
        created_at: now,
      };
      newLedgerEvents.push(ledgerEvent);

      if (emptySlot) {
        _locations = _locations.map(l =>
          l.location_id === emptySlot.location_id
            ? { ...l, occupied: true, bottle_id: bottleId, master_id: item.master_id, perfume_name: item.perfume_name }
            : l
        );
      }

      item.received_qty++;
    }
  }

  const allReceived = po.items.every(i => i.received_qty >= i.qty);
  po.status = allReceived ? 'received' : 'partially_received';
  po.received_at = now;

  const supplier = _suppliers.find(s => s.supplier_id === po.supplier_id);
  if (supplier) {
    const existingPO = supplier.purchases.find(p => p.purchase_id === po.po_id);
    if (!existingPO) {
      const supplierPurchase: SupplierPurchase = {
        purchase_id: po.po_id,
        date: now.split('T')[0],
        items: po.items.map(i => ({
          master_id: i.master_id,
          perfume_name: i.perfume_name,
          qty: i.qty,
          size_ml: i.size_ml,
          unit_price: i.unit_price,
        })),
        total_amount: po.total_amount,
        invoice_ref: po.invoice_ref,
        notes: po.notes,
      };
      supplier.purchases = [supplierPurchase, ...supplier.purchases];
      supplier.total_spent += po.total_amount;
      supplier.total_items += po.items.reduce((s, i) => s + i.qty, 0);
    }
  }

  _sealedBottles = [..._sealedBottles, ...newBottles];
  _bottleLedger = [...newLedgerEvents, ..._bottleLedger];
  _purchaseOrders = _purchaseOrders.map(p => p.po_id === poId ? po : p);

  notify();
  return { bottles: newBottles, ledgerEvents: newLedgerEvents };
}

// ---- Cancel PO with reason ----
export interface POCancelRecord {
  po_id: string;
  reason: string;
  category: POCancelCategory;
  cancelled_by: string;
  cancelled_at: string;
}

let _cancelRecords: POCancelRecord[] = [];

export function getCancelRecords(): POCancelRecord[] { return _cancelRecords; }

export function cancelPO(poId: string, reason: string, category: POCancelCategory) {
  const now = new Date().toISOString();
  _purchaseOrders = _purchaseOrders.map(p =>
    p.po_id === poId ? { ...p, status: 'cancelled' as POStatus } : p
  );
  _cancelRecords = [{ po_id: poId, reason, category, cancelled_by: 'usr_001', cancelled_at: now }, ..._cancelRecords];

  const po = _purchaseOrders.find(p => p.po_id === poId);
  if (po) {
    const auditEvent: BottleLedgerEvent = {
      event_id: `ble_${String(ledgerCounter++).padStart(3, '0')}`,
      bottle_id: 'N/A',
      type: 'ADJUSTMENT',
      reason: `PO ${poId} CANCELLED \u2014 ${category}: ${reason} (Supplier: ${po.supplier_name})`,
      user_id: 'usr_001',
      created_at: now,
    };
    _bottleLedger = [auditEvent, ..._bottleLedger];
  }
  notify();
}

// ---- Add single bottle (from Vault Locations "Add Bottle" flow) ----
export function addBottleToInventory(params: {
  perfume: Perfume;
  supplier: Supplier;
  bottleId: string;
  sizeMl: number;
  purchasePrice: number;
  locationCode: string;
  locationId: string;
}): { bottle: SealedBottle; ledgerEvent: BottleLedgerEvent } {
  const now = new Date().toISOString();

  const bottleType: BottleType = (params as any).bottleType || 'sealed';
  const barcodeStr = `EM-${params.bottleId}-${params.perfume.master_id.split('/').pop()?.split('-')[0] || 'UNK'}`;
  const qrPayload = JSON.stringify({ id: params.bottleId, master: params.perfume.master_id, type: bottleType, ml: params.sizeMl });

  const bottle: SealedBottle = {
    bottle_id: params.bottleId,
    master_id: params.perfume.master_id,
    bottle_type: bottleType,
    size_ml: params.sizeMl,
    current_ml: bottleType !== 'sealed' ? params.sizeMl : undefined,
    supplier_id: params.supplier.supplier_id,
    purchase_price: params.purchasePrice,
    purchase_date: now.split('T')[0],
    location_code: params.locationCode,
    status: 'available',
    manufacturer_id: `${params.supplier.name.substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${String(bottleCounter++).padStart(3, '0')}`,
    barcode: barcodeStr,
    qr_data: qrPayload,
    photos: [],
    created_at: now,
  };

  const ledgerEvent: BottleLedgerEvent = {
    event_id: `ble_${String(ledgerCounter++).padStart(3, '0')}`,
    bottle_id: params.bottleId,
    type: 'INTAKE',
    qty_ml: params.sizeMl,
    reason: `Manual intake \u2014 ${params.perfume.brand} ${params.perfume.name} from ${params.supplier.name}`,
    user_id: 'usr_001',
    created_at: now,
  };

  _locations = _locations.map(l =>
    l.location_id === params.locationId
      ? { ...l, occupied: true, bottle_id: params.bottleId, master_id: params.perfume.master_id, perfume_name: `${params.perfume.brand} ${params.perfume.name}` }
      : l
  );

  _sealedBottles = [..._sealedBottles, bottle];
  _bottleLedger = [ledgerEvent, ..._bottleLedger];

  notify();
  return { bottle, ledgerEvent };
}

// ---- Document Management ----
export function addDocumentToPO(poId: string, doc: {
  category: DocumentCategory;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  notes?: string;
}): PODocument | null {
  const po = _purchaseOrders.find(p => p.po_id === poId);
  if (!po) return null;

  const now = new Date().toISOString();
  const newDoc: PODocument = {
    doc_id: `doc_${String(docCounter++).padStart(3, '0')}`,
    po_id: poId,
    category: doc.category,
    file_name: doc.file_name,
    file_type: doc.file_type,
    file_size: doc.file_size,
    uploaded_by: doc.uploaded_by,
    notes: doc.notes,
    uploaded_at: now,
    verified: false,
    file_url: `#simulated-${doc.file_name}`,
  };

  po.documents = [...po.documents, newDoc];
  po.compliance_status = computeComplianceStatus(po.documents);
  _purchaseOrders = _purchaseOrders.map(p => p.po_id === poId ? { ...po } : p);

  // Log audit event
  const auditEvent: BottleLedgerEvent = {
    event_id: `ble_${String(ledgerCounter++).padStart(3, '0')}`,
    bottle_id: 'N/A',
    type: 'ADJUSTMENT',
    reason: `Document uploaded to ${poId}: ${doc.file_name} (${getCategoryLabel(doc.category)})`,
    user_id: doc.uploaded_by,
    created_at: now,
  };
  _bottleLedger = [auditEvent, ..._bottleLedger];

  notify();
  return newDoc;
}

export function verifyDocument(poId: string, docId: string): void {
  const po = _purchaseOrders.find(p => p.po_id === poId);
  if (!po) return;

  const now = new Date().toISOString();
  po.documents = po.documents.map(d =>
    d.doc_id === docId ? { ...d, verified: true, verified_by: 'usr_001', verified_at: now } : d
  );
  po.compliance_status = computeComplianceStatus(po.documents);
  _purchaseOrders = _purchaseOrders.map(p => p.po_id === poId ? { ...po } : p);

  const doc = po.documents.find(d => d.doc_id === docId);
  const auditEvent: BottleLedgerEvent = {
    event_id: `ble_${String(ledgerCounter++).padStart(3, '0')}`,
    bottle_id: 'N/A',
    type: 'ADJUSTMENT',
    reason: `Document verified on ${poId}: ${doc?.file_name || docId} (${getCategoryLabel(doc?.category || 'other')})`,
    user_id: 'usr_001',
    created_at: now,
  };
  _bottleLedger = [auditEvent, ..._bottleLedger];

  notify();
}

export function removeDocument(poId: string, docId: string): void {
  const po = _purchaseOrders.find(p => p.po_id === poId);
  if (!po) return;

  const removedDoc = po.documents.find(d => d.doc_id === docId);
  po.documents = po.documents.filter(d => d.doc_id !== docId);
  po.compliance_status = computeComplianceStatus(po.documents);
  _purchaseOrders = _purchaseOrders.map(p => p.po_id === poId ? { ...po } : p);

  const now = new Date().toISOString();
  const auditEvent: BottleLedgerEvent = {
    event_id: `ble_${String(ledgerCounter++).padStart(3, '0')}`,
    bottle_id: 'N/A',
    type: 'ADJUSTMENT',
    reason: `Document removed from ${poId}: ${removedDoc?.file_name || docId}`,
    user_id: 'usr_001',
    created_at: now,
  };
  _bottleLedger = [auditEvent, ..._bottleLedger];

  notify();
}

function computeComplianceStatus(docs: PODocument[]): 'pending' | 'partial' | 'complete' {
  const requiredCategories = DOCUMENT_CATEGORIES.filter(c => c.required).map(c => c.value);
  const uploadedRequired = requiredCategories.filter(cat => docs.some(d => d.category === cat));
  const verifiedRequired = requiredCategories.filter(cat => docs.some(d => d.category === cat && d.verified));

  if (verifiedRequired.length >= requiredCategories.length) return 'complete';
  if (uploadedRequired.length > 0) return 'partial';
  return 'pending';
}

export function getDocumentsForPO(poId: string): PODocument[] {
  const po = _purchaseOrders.find(p => p.po_id === poId);
  return po?.documents || [];
}

function getCategoryLabel(cat: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find(c => c.value === cat)?.label || cat;
}

// ---- React hook for subscribing to store changes ----
import { useSyncExternalStore } from 'react';

function getSealedBottlesSnapshot() { return _sealedBottles; }
function getBottleLedgerSnapshot() { return _bottleLedger; }
function getLocationsSnapshot() { return _locations; }
function getSuppliersSnapshot() { return _suppliers; }
function getPurchaseOrdersSnapshot() { return _purchaseOrders; }

export function useSealedBottles(): SealedBottle[] {
  return useSyncExternalStore(subscribe, getSealedBottlesSnapshot);
}

export function useBottleLedger(): BottleLedgerEvent[] {
  return useSyncExternalStore(subscribe, getBottleLedgerSnapshot);
}

export function useLocations(): VaultLocation[] {
  return useSyncExternalStore(subscribe, getLocationsSnapshot);
}

export function useStoreSuppliers(): Supplier[] {
  return useSyncExternalStore(subscribe, getSuppliersSnapshot);
}

export function usePurchaseOrders(): PurchaseOrder[] {
  return useSyncExternalStore(subscribe, getPurchaseOrdersSnapshot);
}
