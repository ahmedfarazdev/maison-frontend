// ============================================================
// Fulfillment Center — Shipping & Dispatch (Kanban Board)
// Drag-and-drop enabled via @dnd-kit
// Primary flow: Shipping Label (per order, per courier)
// AWB: optional, for international orders only — separate from Kanban
// Kanban: Preparing → Label Applied → Ready for Pickup → Dispatched → In Transit → Delivered → Closed
// Box Serial from QC & Assembly is shown on each card
// Delivered column: click to open Guest Report popup
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Truck, Package, CheckCircle2, AlertTriangle, Search,
  ArrowRight, Eye, User, MapPin, Clock, Send,
  FileText, Copy, ExternalLink, Printer, BarChart3,
  PackageCheck, Timer, Star, MessageSquare, XCircle,
  Phone, ThumbsUp, ThumbsDown, Sparkles, Frown, Meh, Smile,
  Tag, Box, Download, Globe, StickyNote, QrCode, Users,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type ShipmentStatus =
  | 'preparing'
  | 'label_applied'
  | 'ready_for_pickup'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'case_closed'
  | 'failed';

type ShipmentType = 'domestic' | 'international';
type Carrier = 'aramex' | 'smsa' | 'fetchr' | 'dhl' | 'emirates_post';
type GuestSatisfaction = 'satisfied' | 'good' | 'bad';

interface GuestReport {
  satisfaction: GuestSatisfaction;
  reason: string;
  submittedAt?: string;
  agentName?: string;
}

interface AWBDocument {
  awbNumber: string;
  generatedAt: string;
  printed: boolean;
}

interface Shipment {
  id: string;
  orderId: string;
  boxSerial: string;
  customerName: string;
  address: string;
  city: string;
  country: string;
  shipmentType: ShipmentType;
  status: ShipmentStatus;
  carrier?: Carrier;
  shippingLabel?: {
    labelId: string;
    generatedAt: string;
    applied: boolean;
  };
  awb?: AWBDocument;
  trackingUrl?: string;
  priority: 'rush' | 'normal';
  itemCount: number;
  weight: string;
  createdAt: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  guestReport?: GuestReport;
}

// ---- Config ----
const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; bgColor: string; headerBg: string }> = {
  preparing: { label: 'Preparing', color: 'text-slate-700', bgColor: 'bg-slate-50', headerBg: 'bg-slate-100 border-slate-200' },
  label_applied: { label: 'Label Applied', color: 'text-blue-700', bgColor: 'bg-blue-50', headerBg: 'bg-blue-100 border-blue-200' },
  ready_for_pickup: { label: 'Ready for Pickup', color: 'text-purple-700', bgColor: 'bg-purple-50', headerBg: 'bg-purple-100 border-purple-200' },
  dispatched: { label: 'Dispatched', color: 'text-indigo-700', bgColor: 'bg-indigo-50', headerBg: 'bg-indigo-100 border-indigo-200' },
  in_transit: { label: 'In Transit', color: 'text-amber-700', bgColor: 'bg-amber-50', headerBg: 'bg-amber-100 border-amber-200' },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50', headerBg: 'bg-emerald-100 border-emerald-200' },
  case_closed: { label: 'Closed', color: 'text-gold', bgColor: 'bg-gold/5', headerBg: 'bg-gold/20 border-gold/30' },
  failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50', headerBg: 'bg-red-100 border-red-200' },
};

const CARRIER_CONFIG: Record<Carrier, { label: string; color: string; bgColor: string }> = {
  aramex: { label: 'Aramex', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
  smsa: { label: 'SMSA', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' },
  fetchr: { label: 'Fetchr', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200' },
  dhl: { label: 'DHL', color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200' },
  emirates_post: { label: 'Emirates Post', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
};

const SATISFACTION_CONFIG: Record<GuestSatisfaction, { label: string; emoji: string; color: string; bgColor: string; icon: React.ElementType }> = {
  satisfied: { label: 'Satisfied', emoji: '😊', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: Smile },
  good: { label: 'Good', emoji: '🙂', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: Meh },
  bad: { label: 'Bad', emoji: '😞', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: Frown },
};

// ---- Kanban Column Order ----
const KANBAN_COLUMNS: ShipmentStatus[] = [
  'preparing',
  'label_applied',
  'ready_for_pickup',
  'dispatched',
  'in_transit',
  'delivered',
  'case_closed',
];

// Valid forward transitions — only allow moving to the NEXT column (or skip at most one)
const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  preparing: ['label_applied'],
  label_applied: ['ready_for_pickup'],
  ready_for_pickup: ['dispatched'],
  dispatched: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['case_closed'],
  case_closed: [],
  failed: ['preparing'],
};

// Statuses where the label has already been printed
const POST_LABEL_STATUSES: ShipmentStatus[] = ['dispatched', 'in_transit', 'delivered', 'case_closed'];

// ---- Mock Data ----
const INITIAL_SHIPMENTS: Shipment[] = [
  {
    id: 'SHP-001', orderId: 'ORD-1847', boxSerial: 'BOX-M3X7A-1847',
    customerName: 'Sarah Al Maktoum', address: 'Dubai Marina, Tower 5, Apt 2301', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'dispatched', carrier: 'aramex',
    shippingLabel: { labelId: 'LBL-ARX-001', generatedAt: '2026-02-28T13:30:00', applied: true },
    trackingUrl: '#', priority: 'normal', itemCount: 3, weight: '0.4kg',
    createdAt: '2026-02-28T10:00:00', dispatchedAt: '2026-02-28T14:00:00',
  },
  {
    id: 'SHP-002', orderId: 'ORD-1848', boxSerial: 'BOX-N4Y8B-1848',
    customerName: 'Ahmed Khalifa', address: 'JBR, Amwaj 2, Unit 1504', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'ready_for_pickup', carrier: 'smsa',
    shippingLabel: { labelId: 'LBL-SMSA-002', generatedAt: '2026-02-28T11:30:00', applied: true },
    priority: 'rush', itemCount: 4, weight: '0.6kg', createdAt: '2026-02-28T11:00:00',
  },
  {
    id: 'SHP-003', orderId: 'ORD-1849', boxSerial: 'BOX-P5Z9C-1849',
    customerName: 'Fatima Noor', address: 'Business Bay, Executive Tower B', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'preparing', priority: 'normal',
    itemCount: 2, weight: '0.3kg', createdAt: '2026-02-28T12:00:00',
  },
  {
    id: 'SHP-004', orderId: 'ORD-1850', boxSerial: 'BOX-Q6A1D-1850',
    customerName: 'Khalid Saeed', address: 'Downtown, Burj Vista 2', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'case_closed', carrier: 'fetchr',
    shippingLabel: { labelId: 'LBL-FTR-004', generatedAt: '2026-02-27T09:30:00', applied: true },
    priority: 'normal', itemCount: 1, weight: '0.5kg',
    createdAt: '2026-02-27T09:00:00', dispatchedAt: '2026-02-27T15:00:00', deliveredAt: '2026-02-28T10:30:00',
    guestReport: { satisfaction: 'satisfied', reason: 'Customer loved the packaging. Would recommend to friends.', submittedAt: '2026-02-28T14:15:00', agentName: 'Nadia H.' },
  },
  {
    id: 'SHP-005', orderId: 'ORD-1851', boxSerial: 'BOX-R7B2E-1851',
    customerName: 'Noura Mansour', address: 'Palm Jumeirah, Shoreline 8', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'preparing', priority: 'rush',
    itemCount: 2, weight: '0.5kg', createdAt: '2026-02-28T13:00:00',
  },
  {
    id: 'SHP-006', orderId: 'ORD-1852', boxSerial: 'BOX-S8C3F-1852',
    customerName: 'Omar Al Falasi', address: 'Al Barsha, Villa 12', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'in_transit', carrier: 'aramex',
    shippingLabel: { labelId: 'LBL-ARX-006', generatedAt: '2026-02-27T14:30:00', applied: true },
    trackingUrl: '#', priority: 'normal', itemCount: 5, weight: '0.7kg',
    createdAt: '2026-02-27T14:00:00', dispatchedAt: '2026-02-28T08:00:00',
  },
  {
    id: 'SHP-007', orderId: 'ORD-1853', boxSerial: 'BOX-T9D4G-1853',
    customerName: 'Reem Hassan', address: 'DIFC, Gate Village 3', city: 'Dubai', country: 'UAE',
    shipmentType: 'international', status: 'failed', carrier: 'dhl',
    shippingLabel: { labelId: 'LBL-DHL-007', generatedAt: '2026-02-27T10:30:00', applied: true },
    awb: { awbNumber: 'DHL-5839201', generatedAt: '2026-02-27T10:45:00', printed: true },
    priority: 'rush', itemCount: 25, weight: '8.5kg',
    createdAt: '2026-02-27T10:00:00', dispatchedAt: '2026-02-27T16:00:00',
  },
  {
    id: 'SHP-008', orderId: 'ORD-1854', boxSerial: 'BOX-U1E5H-1854',
    customerName: 'Layla Ibrahim', address: 'JLT, Cluster D, Tower 2', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'delivered', carrier: 'aramex',
    shippingLabel: { labelId: 'LBL-ARX-008', generatedAt: '2026-02-26T10:30:00', applied: true },
    priority: 'normal', itemCount: 2, weight: '0.3kg',
    createdAt: '2026-02-26T10:00:00', dispatchedAt: '2026-02-26T16:00:00', deliveredAt: '2026-02-27T11:00:00',
  },
  {
    id: 'SHP-009', orderId: 'ORD-1855', boxSerial: 'BOX-V2F6I-1855',
    customerName: 'Mariam Al Suwaidi', address: 'Mirdif, Villa 45', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'delivered', carrier: 'smsa',
    shippingLabel: { labelId: 'LBL-SMSA-009', generatedAt: '2026-02-25T09:30:00', applied: true },
    priority: 'normal', itemCount: 3, weight: '0.4kg',
    createdAt: '2026-02-25T09:00:00', dispatchedAt: '2026-02-25T14:00:00', deliveredAt: '2026-02-26T10:00:00',
  },
  {
    id: 'SHP-010', orderId: 'ORD-1856', boxSerial: 'BOX-W3G7J-1856',
    customerName: 'Yusuf Al Hashimi', address: 'Silicon Oasis, Binghatti Stars', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'in_transit', carrier: 'dhl',
    shippingLabel: { labelId: 'LBL-DHL-010', generatedAt: '2026-02-28T07:30:00', applied: true },
    trackingUrl: '#', priority: 'normal', itemCount: 1, weight: '0.2kg',
    createdAt: '2026-02-28T07:00:00', dispatchedAt: '2026-02-28T12:00:00',
  },
  {
    id: 'SHP-011', orderId: 'ORD-1857', boxSerial: 'BOX-X4H8K-1857',
    customerName: 'James Morrison', address: '14 Kensington Rd', city: 'London', country: 'UK',
    shipmentType: 'international', status: 'ready_for_pickup', carrier: 'dhl',
    shippingLabel: { labelId: 'LBL-DHL-011', generatedAt: '2026-02-28T09:30:00', applied: true },
    awb: { awbNumber: 'DHL-5839250', generatedAt: '2026-02-28T09:45:00', printed: true },
    priority: 'normal', itemCount: 6, weight: '1.2kg', createdAt: '2026-02-28T09:00:00',
  },
  {
    id: 'SHP-012', orderId: 'ORD-1858', boxSerial: 'BOX-Y5I9L-1858',
    customerName: 'Aisha Al Mansoori', address: 'Jumeirah Village Circle, Tower 3', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'ready_for_pickup', carrier: 'aramex',
    shippingLabel: { labelId: 'LBL-ARX-012', generatedAt: '2026-02-28T10:30:00', applied: true },
    priority: 'normal', itemCount: 1, weight: '0.2kg', createdAt: '2026-02-28T10:00:00',
  },
  {
    id: 'SHP-013', orderId: 'ORD-1859', boxSerial: 'BOX-Z6J0M-1859',
    customerName: 'Rashid Al Nuaimi', address: 'Al Nahda, Building 7', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'ready_for_pickup', carrier: 'aramex',
    shippingLabel: { labelId: 'LBL-ARX-013', generatedAt: '2026-02-28T10:45:00', applied: true },
    priority: 'rush', itemCount: 3, weight: '0.5kg', createdAt: '2026-02-28T10:15:00',
  },
  {
    id: 'SHP-014', orderId: 'ORD-1860', boxSerial: 'BOX-A7K1N-1860',
    customerName: 'Huda Bin Zayed', address: 'Motor City, Green Community', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', status: 'label_applied', carrier: 'aramex',
    shippingLabel: { labelId: 'LBL-ARX-014', generatedAt: '2026-02-28T12:30:00', applied: true },
    priority: 'normal', itemCount: 2, weight: '0.3kg', createdAt: '2026-02-28T12:00:00',
  },
];

// ---- Draggable Card Component ----
function DraggableCard({ shipment, children }: { shipment: Shipment; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shipment.id,
    data: { shipment },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10" {...listeners}>
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors" />
      </div>
      <div className="pl-5">
        {children}
      </div>
    </div>
  );
}

// ---- Droppable Column Component ----
function DroppableColumn({ id, children, isOver, isValidDrop }: {
  id: string;
  children: React.ReactNode;
  isOver: boolean;
  isValidDrop: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-b-lg border border-t-0 p-2 space-y-2 min-h-[200px] transition-all duration-200',
        isOver && isValidDrop && 'ring-2 ring-emerald-400 bg-emerald-50/50 shadow-inner',
        isOver && !isValidDrop && 'ring-2 ring-red-400 bg-red-50/30 shadow-inner',
      )}
    >
      {children}
    </div>
  );
}

// ---- Component ----
export default function Shipping() {
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);
  const [search, setSearch] = useState('');
  const [labelDialog, setLabelDialog] = useState<Shipment | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('');
  const [guestReportDialog, setGuestReportDialog] = useState<Shipment | null>(null);
  const [grSatisfaction, setGrSatisfaction] = useState<GuestSatisfaction | null>(null);
  const [grReason, setGrReason] = useState('');
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [awbDialog, setAwbDialog] = useState<Shipment | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // DnD sensors — require 8px movement to start drag (avoids accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Group shipments by status for Kanban
  const columnData = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = search
      ? shipments.filter(s =>
          s.customerName.toLowerCase().includes(q) ||
          s.orderId.toLowerCase().includes(q) ||
          s.boxSerial.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.awb?.awbNumber?.toLowerCase().includes(q)
        )
      : shipments;

    const groups: Record<string, Shipment[]> = {};
    for (const col of KANBAN_COLUMNS) groups[col] = [];
    groups['failed'] = [];

    for (const s of filtered) {
      if (groups[s.status]) groups[s.status].push(s);
    }
    return groups;
  }, [search, shipments]);

  // Group Ready for Pickup by carrier
  const readyByCarrier = useMemo(() => {
    const items = columnData['ready_for_pickup'] || [];
    const grouped: Record<string, Shipment[]> = {};
    for (const s of items) {
      const key = s.carrier || 'unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    }
    return grouped;
  }, [columnData]);

  const stats = useMemo(() => ({
    total: shipments.length,
    active: shipments.filter(s => !['case_closed', 'failed'].includes(s.status)).length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    readyForPickup: shipments.filter(s => s.status === 'ready_for_pickup').length,
    failed: shipments.filter(s => s.status === 'failed').length,
    international: shipments.filter(s => s.shipmentType === 'international').length,
  }), [shipments]);

  // Find the active dragged shipment
  const activeShipment = useMemo(() =>
    activeId ? shipments.find(s => s.id === activeId) : null
  , [activeId, shipments]);

  // Check if a drop is valid
  const isValidDrop = useCallback((shipmentId: string, targetColumn: string) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return false;
    if (shipment.status === targetColumn) return false;
    const valid = VALID_TRANSITIONS[shipment.status] || [];
    return valid.includes(targetColumn as ShipmentStatus);
  }, [shipments]);

  // ---- DnD Handlers ----
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverColumnId(overId && KANBAN_COLUMNS.includes(overId as ShipmentStatus) ? overId : null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over) return;

    const shipmentId = active.id as string;
    const targetColumn = over.id as ShipmentStatus;

    if (!KANBAN_COLUMNS.includes(targetColumn)) return;

    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;
    if (shipment.status === targetColumn) return;

    // Validate transition
    const valid = VALID_TRANSITIONS[shipment.status] || [];
    if (!valid.includes(targetColumn)) {
      const fromLabel = STATUS_CONFIG[shipment.status].label;
      const toLabel = STATUS_CONFIG[targetColumn].label;
      toast.error(`Cannot move from "${fromLabel}" to "${toLabel}". Only forward transitions are allowed.`);
      return;
    }

    // Special case: dropping into "delivered" opens guest report
    if (targetColumn === 'delivered') {
      setShipments(prev => prev.map(s =>
        s.id === shipmentId
          ? { ...s, status: 'delivered', deliveredAt: new Date().toISOString() }
          : s
      ));
      const updated = { ...shipment, status: 'delivered' as ShipmentStatus, deliveredAt: new Date().toISOString() };
      toast.success(`${shipment.orderId} marked as delivered`);
      // Auto-open guest report after a brief delay
      setTimeout(() => handleOpenGuestReport(updated), 400);
      return;
    }

    // Special case: dropping into "case_closed" from "delivered" opens guest report
    if (targetColumn === 'case_closed' && shipment.status === 'delivered') {
      handleOpenGuestReport(shipment);
      return;
    }

    // Normal transition
    const updates: Partial<Shipment> = { status: targetColumn };
    if (targetColumn === 'dispatched') updates.dispatchedAt = new Date().toISOString();

    setShipments(prev => prev.map(s =>
      s.id === shipmentId ? { ...s, ...updates } : s
    ));

    const fromLabel = STATUS_CONFIG[shipment.status].label;
    const toLabel = STATUS_CONFIG[targetColumn].label;
    toast.success(`${shipment.orderId} moved: ${fromLabel} → ${toLabel}`);
  }, [shipments]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  // ---- Action Handlers ----
  const handleGenerateLabel = () => {
    if (!labelDialog || !selectedCarrier) return;
    setShipments(prev => prev.map(s =>
      s.id === labelDialog.id
        ? {
            ...s,
            status: 'label_applied' as ShipmentStatus,
            carrier: selectedCarrier as Carrier,
            shippingLabel: {
              labelId: `LBL-${selectedCarrier.toUpperCase().slice(0, 3)}-${Date.now().toString(36)}`,
              generatedAt: new Date().toISOString(),
              applied: true,
            },
          }
        : s
    ));
    toast.success(`Shipping label generated for ${labelDialog.orderId} via ${CARRIER_CONFIG[selectedCarrier as Carrier].label}`);
    setLabelDialog(null);
    setSelectedCarrier('');
  };

  const handleMarkReadyForPickup = (shipment: Shipment) => {
    setShipments(prev => prev.map(s =>
      s.id === shipment.id ? { ...s, status: 'ready_for_pickup' as ShipmentStatus } : s
    ));
    toast.success(`${shipment.orderId} marked as ready for pickup — ${shipment.carrier ? CARRIER_CONFIG[shipment.carrier].label : 'carrier'}`);
  };

  const handleDispatch = (shipment: Shipment) => {
    setShipments(prev => prev.map(s =>
      s.id === shipment.id ? { ...s, status: 'dispatched' as ShipmentStatus, dispatchedAt: new Date().toISOString() } : s
    ));
    toast.success(`${shipment.orderId} dispatched via ${shipment.carrier ? CARRIER_CONFIG[shipment.carrier].label : 'carrier'}`);
  };

  const handleDispatchGroup = (carrier: string, groupShipments: Shipment[]) => {
    setShipments(prev => prev.map(s =>
      groupShipments.some(gs => gs.id === s.id)
        ? { ...s, status: 'dispatched' as ShipmentStatus, dispatchedAt: new Date().toISOString() }
        : s
    ));
    toast.success(`${groupShipments.length} packages dispatched via ${CARRIER_CONFIG[carrier as Carrier]?.label || carrier}`);
  };

  const handleMarkDelivered = (shipment: Shipment) => {
    setShipments(prev => prev.map(s =>
      s.id === shipment.id ? { ...s, status: 'delivered' as ShipmentStatus, deliveredAt: new Date().toISOString() } : s
    ));
    toast.success(`${shipment.orderId} marked as delivered`);
  };

  const handleOpenGuestReport = (shipment: Shipment) => {
    setGuestReportDialog(shipment);
    setGrSatisfaction(shipment.guestReport?.satisfaction || null);
    setGrReason(shipment.guestReport?.reason || '');
  };

  const handleSubmitGuestReport = () => {
    if (!guestReportDialog || !grSatisfaction) {
      toast.error('Please select a satisfaction level');
      return;
    }
    setShipments(prev => prev.map(s =>
      s.id === guestReportDialog.id
        ? {
            ...s,
            status: 'case_closed' as ShipmentStatus,
            guestReport: {
              satisfaction: grSatisfaction,
              reason: grReason,
              submittedAt: new Date().toISOString(),
              agentName: 'Current User',
            },
          }
        : s
    ));
    toast.success(`Guest report submitted for ${guestReportDialog.orderId} — case closed`);
    setGuestReportDialog(null);
    setGrSatisfaction(null);
    setGrReason('');
  };

  const handleCloseCaseDirectly = (shipment: Shipment) => {
    setShipments(prev => prev.map(s =>
      s.id === shipment.id ? { ...s, status: 'case_closed' as ShipmentStatus } : s
    ));
    toast.success(`${shipment.orderId} — case closed directly`);
  };

  const handleGenerateAWB = (shipment: Shipment) => {
    setShipments(prev => prev.map(s =>
      s.id === shipment.id
        ? {
            ...s,
            awb: {
              awbNumber: `AWB-${Date.now().toString(36).toUpperCase()}`,
              generatedAt: new Date().toISOString(),
              printed: false,
            },
          }
        : s
    ));
    toast.success(`AWB generated for international shipment ${shipment.orderId}`);
    setAwbDialog(shipment);
  };

  const handlePrintAWB = (shipment: Shipment) => {
    toast.success(`AWB document sent to printer for ${shipment.orderId}`);
  };

  // ---- Render a single card (content only, wrapper handles DnD) ----
  const renderCardContent = (shipment: Shipment) => {
    const isDelivered = shipment.status === 'delivered';
    const isClosed = shipment.status === 'case_closed';
    const isInternational = shipment.shipmentType === 'international';

    return (
      <div
        onClick={() => isDelivered ? handleOpenGuestReport(shipment) : setDetailShipment(shipment)}
        className={cn(
          'bg-card rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
          shipment.priority === 'rush' && 'border-l-[3px] border-l-red-400',
          isDelivered && 'ring-1 ring-emerald-300/50 hover:ring-emerald-400',
        )}
      >
        {/* Header: Order ID + Box Serial */}
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <span className="text-xs font-bold font-mono">{shipment.orderId}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Box className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-mono text-gold">{shipment.boxSerial}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {shipment.priority === 'rush' && (
              <Badge className="text-[8px] bg-red-100 text-red-700 px-1 h-4">RUSH</Badge>
            )}
            {isInternational && (
              <Badge className="text-[8px] bg-violet-100 text-violet-700 px-1 h-4">
                <Globe className="w-2.5 h-2.5 mr-0.5" />INTL
              </Badge>
            )}
          </div>
        </div>

        {/* Customer */}
        <p className="text-sm font-medium truncate">{shipment.customerName}</p>
        <p className="text-[11px] text-muted-foreground truncate">{shipment.city}, {shipment.country}</p>

        {/* Carrier */}
        {shipment.carrier && (
          <div className="flex items-center gap-1 mt-1">
            <Truck className="w-3 h-3 text-muted-foreground" />
            <span className={cn('text-[10px] font-medium', CARRIER_CONFIG[shipment.carrier].color)}>
              {CARRIER_CONFIG[shipment.carrier].label}
            </span>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground">{shipment.itemCount} items · {shipment.weight}</span>
          {shipment.shippingLabel && (
            <span className="text-[10px] font-mono text-blue-600">{shipment.shippingLabel.labelId.slice(-6)}</span>
          )}
        </div>

        {/* AWB indicator for international */}
        {isInternational && shipment.awb && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-violet-600">
            <FileText className="w-3 h-3" />
            <span className="font-mono">{shipment.awb.awbNumber}</span>
            {shipment.awb.printed && <CheckCircle2 className="w-3 h-3 text-success" />}
          </div>
        )}

        {/* Delivered: hint to click for guest report */}
        {isDelivered && (
          <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
            <Star className="w-3 h-3" />
            Click for Guest Report
          </div>
        )}

        {/* Closed: show satisfaction badge */}
        {isClosed && shipment.guestReport && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5">
            <span className={cn('text-[10px] font-medium', SATISFACTION_CONFIG[shipment.guestReport.satisfaction].color)}>
              {SATISFACTION_CONFIG[shipment.guestReport.satisfaction].emoji} {SATISFACTION_CONFIG[shipment.guestReport.satisfaction].label}
            </span>
          </div>
        )}

        {/* Action buttons per status */}
        <div className="mt-2 flex gap-1">
          {shipment.status === 'preparing' && (
            <Button size="sm" className="h-6 text-[10px] w-full gap-1" onClick={(e) => { e.stopPropagation(); setLabelDialog(shipment); }}>
              <Tag className="w-3 h-3" /> Generate Shipping Label
            </Button>
          )}
          {shipment.status === 'label_applied' && (
            <Button size="sm" className="h-6 text-[10px] w-full gap-1 bg-purple-600 hover:bg-purple-700" onClick={(e) => { e.stopPropagation(); handleMarkReadyForPickup(shipment); }}>
              <PackageCheck className="w-3 h-3" /> Mark Ready
            </Button>
          )}
          {shipment.status === 'in_transit' && (
            <Button size="sm" className="h-6 text-[10px] w-full gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); handleMarkDelivered(shipment); }}>
              <CheckCircle2 className="w-3 h-3" /> Mark Delivered
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Render a draggable card
  const renderCard = (shipment: Shipment) => (
    <DraggableCard key={shipment.id} shipment={shipment}>
      {renderCardContent(shipment)}
    </DraggableCard>
  );

  // Render the Ready for Pickup column with courier grouping
  const renderReadyForPickupColumn = () => {
    const allReady = columnData['ready_for_pickup'] || [];
    const cfg = STATUS_CONFIG['ready_for_pickup'];
    const carrierGroups = Object.entries(readyByCarrier).sort(([a], [b]) => a.localeCompare(b));
    const isColumnOver = overColumnId === 'ready_for_pickup';
    const canDrop = activeId ? isValidDrop(activeId, 'ready_for_pickup') : false;

    return (
      <div className="flex-1 min-w-[280px] max-w-[360px]">
        {/* Column Header */}
        <div className={cn('rounded-t-lg border px-3 py-2.5 flex items-center justify-between', cfg.headerBg)}>
          <span className={cn('text-xs font-bold uppercase tracking-wider', cfg.color)}>{cfg.label}</span>
          <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">{allReady.length}</Badge>
        </div>

        {/* Column Body — grouped by carrier */}
        <DroppableColumn id="ready_for_pickup" isOver={isColumnOver} isValidDrop={canDrop}>
          {allReady.length === 0 && (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">
              {activeId ? 'Drop here' : 'No shipments ready'}
            </div>
          )}
          {carrierGroups.map(([carrier, groupShipments]) => {
            const carrierCfg = CARRIER_CONFIG[carrier as Carrier];
            return (
              <div key={carrier} className="mb-3 last:mb-0">
                {/* Carrier Group Header */}
                <div className={cn('rounded-lg border px-2.5 py-1.5 mb-2 flex items-center justify-between', carrierCfg?.bgColor || 'bg-muted/50 border-border')}>
                  <div className="flex items-center gap-1.5">
                    <Truck className={cn('w-3.5 h-3.5', carrierCfg?.color || 'text-muted-foreground')} />
                    <span className={cn('text-xs font-bold', carrierCfg?.color || 'text-muted-foreground')}>
                      {carrierCfg?.label || carrier}
                    </span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{groupShipments.length}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 text-[9px] gap-1 border-current"
                    onClick={() => handleDispatchGroup(carrier, groupShipments)}
                  >
                    <Send className="w-2.5 h-2.5" /> Dispatch All
                  </Button>
                </div>

                {/* Cards in this carrier group */}
                <div className="space-y-2 pl-1">
                  {groupShipments.map(renderCard)}
                </div>
              </div>
            );
          })}
        </DroppableColumn>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping & Dispatch"
        subtitle="Drag cards between columns or use action buttons — shipping label flow with optional AWB"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders, box serials..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 w-64"
              />
            </div>
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50"><Truck className="w-4 h-4 text-blue-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50"><Clock className="w-4 h-4 text-amber-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.active}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-50"><PackageCheck className="w-4 h-4 text-purple-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.readyForPickup}</p>
                <p className="text-[10px] text-muted-foreground">Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.delivered}</p>
                <p className="text-[10px] text-muted-foreground">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-violet-50"><Globe className="w-4 h-4 text-violet-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.international}</p>
                <p className="text-[10px] text-muted-foreground">Intl</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-red-50"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.failed}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drag hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-dashed">
        <GripVertical className="w-4 h-4" />
        <span>Drag cards using the grip handle to move shipments between columns. Only forward transitions are allowed.</span>
      </div>

      {/* Kanban Board with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${KANBAN_COLUMNS.length * 260}px` }}>
            {KANBAN_COLUMNS.map(status => {
              // Special rendering for Ready for Pickup (grouped by carrier)
              if (status === 'ready_for_pickup') {
                return <div key={status}>{renderReadyForPickupColumn()}</div>;
              }

              const cfg = STATUS_CONFIG[status];
              const cards = columnData[status] || [];
              const isColumnOver = overColumnId === status;
              const canDrop = activeId ? isValidDrop(activeId, status) : false;

              return (
                <div key={status} className="flex-1 min-w-[240px] max-w-[320px]">
                  {/* Column Header */}
                  <div className={cn('rounded-t-lg border px-3 py-2.5 flex items-center justify-between', cfg.headerBg)}>
                    <span className={cn('text-xs font-bold uppercase tracking-wider', cfg.color)}>{cfg.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">{cards.length}</Badge>
                  </div>

                  {/* Column Body — Droppable */}
                  <DroppableColumn id={status} isOver={isColumnOver} isValidDrop={canDrop}>
                    {cards.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">
                        {activeId ? 'Drop here' : 'No shipments'}
                      </div>
                    )}
                    {cards.map(renderCard)}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay — shows a preview of the dragged card */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeShipment ? (
            <div className="opacity-90 rotate-[2deg] scale-105 shadow-2xl pointer-events-none max-w-[300px]">
              {renderCardContent(activeShipment)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Failed Shipments (separate section) */}
      {(columnData['failed'] || []).length > 0 && (
        <SectionCard title="Failed Shipments" subtitle="Shipments that require attention">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(columnData['failed'] || []).map(shipment => (
              <div key={shipment.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold font-mono">{shipment.orderId}</span>
                  <Badge className="text-[8px] bg-red-100 text-red-700">FAILED</Badge>
                </div>
                <p className="text-sm font-medium">{shipment.customerName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Box className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground">{shipment.boxSerial}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{shipment.city} · {shipment.itemCount} items</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1 border-red-300 text-red-700 hover:bg-red-100" onClick={() => setDetailShipment(shipment)}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                  <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => toast.info('Re-dispatch flow coming soon')}>
                    Retry
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ===== DIALOGS ===== */}

      {/* Generate Shipping Label Dialog */}
      <Dialog open={!!labelDialog} onOpenChange={() => { setLabelDialog(null); setSelectedCarrier(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-600" />
              Generate Shipping Label
            </DialogTitle>
            <DialogDescription>
              Create a shipping label for {labelDialog?.orderId}
            </DialogDescription>
          </DialogHeader>
          {labelDialog && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{labelDialog.customerName}</span>
                  <Badge className="text-[8px]">{labelDialog.shipmentType === 'international' ? 'INTL' : 'DOM'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{labelDialog.address}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Box className="w-3 h-3 text-gold" />
                  <span className="text-[10px] font-mono text-gold">{labelDialog.boxSerial}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Weight</p>
                <p className="text-sm font-medium">{labelDialog.weight}</p>
              </div>
              <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select carrier..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CARRIER_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className={cn('font-medium', cfg.color)}>{cfg.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {labelDialog.shipmentType === 'international' && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-violet-50 border border-violet-200 text-violet-700 text-xs">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span>International shipment — you can generate an AWB after the label is applied.</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLabelDialog(null); setSelectedCarrier(''); }}>Cancel</Button>
            <Button onClick={handleGenerateLabel} disabled={!selectedCarrier} className="gap-1.5">
              <Tag className="w-4 h-4" /> Generate & Print Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AWB Dialog */}
      <Dialog open={!!awbDialog} onOpenChange={() => setAwbDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-600" />
              AWB Document
            </DialogTitle>
            <DialogDescription>
              Air Waybill for international shipment {awbDialog?.orderId}
            </DialogDescription>
          </DialogHeader>
          {awbDialog && (
            <div className="space-y-4">
              <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-widest text-violet-500 mb-1">AWB NUMBER</p>
                  <p className="text-xl font-bold font-mono text-violet-700">
                    {awbDialog.awb?.awbNumber || `AWB-${Date.now().toString(36).toUpperCase()}`}
                  </p>
                  <p className="text-xs text-violet-600 mt-2">
                    {awbDialog.customerName} · {awbDialog.city}, {awbDialog.country}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Box className="w-3 h-3 text-gold" />
                    <span className="text-[10px] font-mono text-gold">{awbDialog.boxSerial}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={() => handlePrintAWB(awbDialog)}>
                  <Printer className="w-4 h-4" /> Print AWB
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" onClick={() => toast.info('AWB PDF download — coming soon')}>
                  <Download className="w-4 h-4" /> Download PDF
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                AWB is for international shipping documentation only. The shipping label handles courier routing.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwbDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guest Report Dialog */}
      <Dialog open={!!guestReportDialog} onOpenChange={() => { setGuestReportDialog(null); setGrSatisfaction(null); setGrReason(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-gold" />
              Guest Report
            </DialogTitle>
            <DialogDescription>
              Quick guest feedback for {guestReportDialog?.orderId} — {guestReportDialog?.customerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Order Summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{guestReportDialog?.customerName}</span>
                <span className="text-xs text-muted-foreground">{guestReportDialog?.city}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Box className="w-3 h-3 text-gold" />
                <span className="text-[10px] font-mono text-gold">{guestReportDialog?.boxSerial}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{guestReportDialog?.itemCount} items · {guestReportDialog?.carrier ? CARRIER_CONFIG[guestReportDialog.carrier].label : '—'}</p>
              {guestReportDialog?.deliveredAt && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Delivered: {new Date(guestReportDialog.deliveredAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* Satisfaction Selector */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">How was the guest experience?</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(SATISFACTION_CONFIG) as [GuestSatisfaction, typeof SATISFACTION_CONFIG[GuestSatisfaction]][]).map(([key, cfg]) => {
                  const isSelected = grSatisfaction === key;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setGrSatisfaction(key)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                        isSelected
                          ? cn(cfg.bgColor, 'border-current shadow-sm scale-[1.02]', cfg.color)
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                      )}
                    >
                      <Icon className={cn('w-8 h-8', isSelected ? cfg.color : 'text-muted-foreground/40')} />
                      <span className={cn('text-sm font-semibold', isSelected ? cfg.color : 'text-muted-foreground')}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Why? */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Why? <span className="text-muted-foreground/50 normal-case">(optional)</span>
              </p>
              <Textarea
                value={grReason}
                onChange={e => setGrReason(e.target.value)}
                placeholder="Any feedback, issues, or notes about the delivery experience..."
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setGuestReportDialog(null); setGrSatisfaction(null); setGrReason(''); }} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button variant="ghost" className="flex-1 sm:flex-none text-muted-foreground" onClick={() => {
              if (guestReportDialog) handleCloseCaseDirectly(guestReportDialog);
              setGuestReportDialog(null);
              setGrSatisfaction(null);
              setGrReason('');
            }}>
              Close Without Report
            </Button>
            <Button
              onClick={handleSubmitGuestReport}
              disabled={!grSatisfaction}
              className="flex-1 sm:flex-none bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Submit & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailShipment} onOpenChange={() => setDetailShipment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              {detailShipment?.orderId} — Shipping Details
            </DialogTitle>
            <DialogDescription>
              Shipment {detailShipment?.id}
            </DialogDescription>
          </DialogHeader>
          {detailShipment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{detailShipment.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={cn('text-xs', `${STATUS_CONFIG[detailShipment.status].color} ${STATUS_CONFIG[detailShipment.status].bgColor}`)}>
                    {STATUS_CONFIG[detailShipment.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Box Serial</p>
                  <div className="flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-gold" />
                    <p className="font-mono font-medium text-gold">{detailShipment.boxSerial}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge className={cn('text-xs', detailShipment.shipmentType === 'international' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700')}>
                    {detailShipment.shipmentType === 'international' ? 'International' : 'Domestic'}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-xs">{detailShipment.address}, {detailShipment.city}, {detailShipment.country}</p>
                </div>
                {detailShipment.carrier && (
                  <div>
                    <p className="text-xs text-muted-foreground">Carrier</p>
                    <p className={cn('font-medium', CARRIER_CONFIG[detailShipment.carrier].color)}>
                      {CARRIER_CONFIG[detailShipment.carrier].label}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Items / Weight</p>
                  <p className="font-medium">{detailShipment.itemCount} items · {detailShipment.weight}</p>
                </div>
              </div>

              {/* Shipping Label Info */}
              {detailShipment.shippingLabel && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Shipping Label
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">{detailShipment.shippingLabel.labelId}</span>
                    {!POST_LABEL_STATUSES.includes(detailShipment.status) && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-blue-300" onClick={() => toast.success(`Shipping label sent to printer for ${detailShipment.orderId}`)}>
                        <Printer className="w-3 h-3" /> Print
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* AWB Info */}
              {detailShipment.awb && (
                <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
                  <p className="text-xs font-medium text-violet-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> AWB Document
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">{detailShipment.awb.awbNumber}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-violet-300" onClick={() => handlePrintAWB(detailShipment)}>
                        <Printer className="w-3 h-3" /> Print
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-violet-300" onClick={() => toast.info('PDF download coming soon')}>
                        <Download className="w-3 h-3" /> PDF
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate AWB button for international without AWB */}
              {detailShipment.shipmentType === 'international' && !detailShipment.awb && detailShipment.status !== 'preparing' && (
                <Button variant="outline" className="w-full gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50" onClick={() => {
                  setDetailShipment(null);
                  handleGenerateAWB(detailShipment);
                }}>
                  <FileText className="w-4 h-4" /> Generate AWB for International Shipment
                </Button>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Timeline</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Created: {new Date(detailShipment.createdAt).toLocaleString('en-AE')}</span>
                  </div>
                  {detailShipment.shippingLabel && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>Label: {new Date(detailShipment.shippingLabel.generatedAt).toLocaleString('en-AE')}</span>
                    </div>
                  )}
                  {detailShipment.dispatchedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>Dispatched: {new Date(detailShipment.dispatchedAt).toLocaleString('en-AE')}</span>
                    </div>
                  )}
                  {detailShipment.deliveredAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Delivered: {new Date(detailShipment.deliveredAt).toLocaleString('en-AE')}</span>
                    </div>
                  )}
                  {detailShipment.guestReport?.submittedAt && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-gold" />
                      <span>Report: {new Date(detailShipment.guestReport.submittedAt).toLocaleString('en-AE')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Guest Report Summary */}
              {detailShipment.guestReport && (
                <div className={cn('rounded-lg p-3 border', SATISFACTION_CONFIG[detailShipment.guestReport.satisfaction].bgColor)}>
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-gold" /> Guest Report
                  </p>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-sm font-bold', SATISFACTION_CONFIG[detailShipment.guestReport.satisfaction].color)}>
                      {SATISFACTION_CONFIG[detailShipment.guestReport.satisfaction].emoji} {SATISFACTION_CONFIG[detailShipment.guestReport.satisfaction].label}
                    </span>
                    {detailShipment.guestReport.agentName && (
                      <span className="text-xs text-muted-foreground">by {detailShipment.guestReport.agentName}</span>
                    )}
                  </div>
                  {detailShipment.guestReport.reason && (
                    <p className="text-xs text-muted-foreground italic">"{detailShipment.guestReport.reason}"</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailShipment(null)}>Close</Button>
            {detailShipment?.status === 'delivered' && (
              <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1" onClick={() => {
                setDetailShipment(null);
                if (detailShipment) handleOpenGuestReport(detailShipment);
              }}>
                <Star className="w-4 h-4" /> Guest Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
