// ============================================================
// Shipping & Dispatch Ledger
// Tracks all shipment events: dispatched, delivered, returned, failed
// A historical log of everything that went out and came back
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Truck, Package, CheckCircle2, AlertTriangle, Search,
  ArrowRight, ArrowLeft, Calendar, FileText, Box,
  Globe, Star, XCircle, RotateCcw, Send, Clock,
  Filter, Download, Smile, Meh, Frown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
type LedgerEventType =
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'failed'
  | 'case_closed'
  | 're_dispatched';

type ShipmentType = 'domestic' | 'international';
type Carrier = 'aramex' | 'smsa' | 'fetchr' | 'dhl' | 'emirates_post';

interface LedgerEntry {
  id: string;
  orderId: string;
  boxSerial: string;
  customerName: string;
  city: string;
  country: string;
  shipmentType: ShipmentType;
  carrier: Carrier;
  event: LedgerEventType;
  timestamp: string;
  labelId: string;
  awbNumber?: string;
  trackingNumber?: string;
  itemCount: number;
  weight: string;
  notes?: string;
  satisfaction?: 'satisfied' | 'good' | 'bad';
  operator: string;
}

// ---- Config ----
const EVENT_CONFIG: Record<LedgerEventType, { label: string; color: string; bgColor: string; icon: React.ElementType; direction: 'out' | 'in' | 'neutral' }> = {
  dispatched: { label: 'Dispatched', color: 'text-indigo-700', bgColor: 'bg-indigo-50', icon: Send, direction: 'out' },
  in_transit: { label: 'In Transit', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: Truck, direction: 'out' },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50', icon: CheckCircle2, direction: 'out' },
  returned: { label: 'Returned', color: 'text-orange-700', bgColor: 'bg-orange-50', icon: RotateCcw, direction: 'in' },
  failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-50', icon: XCircle, direction: 'neutral' },
  case_closed: { label: 'Case Closed', color: 'text-gold', bgColor: 'bg-gold/10', icon: Star, direction: 'neutral' },
  re_dispatched: { label: 'Re-Dispatched', color: 'text-blue-700', bgColor: 'bg-blue-50', icon: ArrowRight, direction: 'out' },
};

const CARRIER_CONFIG: Record<Carrier, { label: string; color: string }> = {
  aramex: { label: 'Aramex', color: 'text-red-600' },
  smsa: { label: 'SMSA', color: 'text-blue-600' },
  fetchr: { label: 'Fetchr', color: 'text-purple-600' },
  dhl: { label: 'DHL', color: 'text-yellow-600' },
  emirates_post: { label: 'Emirates Post', color: 'text-emerald-600' },
};

const SATISFACTION_EMOJI: Record<string, string> = {
  satisfied: '😊',
  good: '🙂',
  bad: '😞',
};

// ---- Mock Data ----
const mockLedger: LedgerEntry[] = [
  {
    id: 'SL-001', orderId: 'ORD-1847', boxSerial: 'BOX-M3X7A-1847',
    customerName: 'Sarah Al Maktoum', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 'dispatched',
    timestamp: '2026-02-28T14:00:00', labelId: 'LBL-ARX-001',
    itemCount: 3, weight: '0.4kg', operator: 'Ali M.',
  },
  {
    id: 'SL-002', orderId: 'ORD-1847', boxSerial: 'BOX-M3X7A-1847',
    customerName: 'Sarah Al Maktoum', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 'in_transit',
    timestamp: '2026-02-28T16:30:00', labelId: 'LBL-ARX-001',
    trackingNumber: 'ARX-TRK-98712', itemCount: 3, weight: '0.4kg', operator: 'System',
  },
  {
    id: 'SL-003', orderId: 'ORD-1850', boxSerial: 'BOX-Q6A1D-1850',
    customerName: 'Khalid Saeed', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'fetchr', event: 'dispatched',
    timestamp: '2026-02-27T15:00:00', labelId: 'LBL-FTR-004',
    itemCount: 1, weight: '0.5kg', operator: 'Ali M.',
  },
  {
    id: 'SL-004', orderId: 'ORD-1850', boxSerial: 'BOX-Q6A1D-1850',
    customerName: 'Khalid Saeed', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'fetchr', event: 'delivered',
    timestamp: '2026-02-28T10:30:00', labelId: 'LBL-FTR-004',
    trackingNumber: 'FTR-TRK-44521', itemCount: 1, weight: '0.5kg', operator: 'System',
  },
  {
    id: 'SL-005', orderId: 'ORD-1850', boxSerial: 'BOX-Q6A1D-1850',
    customerName: 'Khalid Saeed', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'fetchr', event: 'case_closed',
    timestamp: '2026-02-28T14:15:00', labelId: 'LBL-FTR-004',
    itemCount: 1, weight: '0.5kg', satisfaction: 'satisfied',
    notes: 'Customer loved the packaging. Would recommend to friends.', operator: 'Nadia H.',
  },
  {
    id: 'SL-006', orderId: 'ORD-1853', boxSerial: 'BOX-T9D4G-1853',
    customerName: 'Reem Hassan', city: 'Dubai', country: 'UAE',
    shipmentType: 'international', carrier: 'dhl', event: 'dispatched',
    timestamp: '2026-02-27T16:00:00', labelId: 'LBL-DHL-007',
    awbNumber: 'DHL-5839201', itemCount: 25, weight: '8.5kg', operator: 'Ali M.',
  },
  {
    id: 'SL-007', orderId: 'ORD-1853', boxSerial: 'BOX-T9D4G-1853',
    customerName: 'Reem Hassan', city: 'Dubai', country: 'UAE',
    shipmentType: 'international', carrier: 'dhl', event: 'failed',
    timestamp: '2026-02-28T09:00:00', labelId: 'LBL-DHL-007',
    awbNumber: 'DHL-5839201', itemCount: 25, weight: '8.5kg',
    notes: 'Customs hold — documentation incomplete', operator: 'System',
  },
  {
    id: 'SL-008', orderId: 'ORD-1852', boxSerial: 'BOX-S8C3F-1852',
    customerName: 'Omar Al Falasi', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 'dispatched',
    timestamp: '2026-02-28T08:00:00', labelId: 'LBL-ARX-006',
    itemCount: 5, weight: '0.7kg', operator: 'Ali M.',
  },
  {
    id: 'SL-009', orderId: 'ORD-1854', boxSerial: 'BOX-U1E5H-1854',
    customerName: 'Layla Ibrahim', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 'dispatched',
    timestamp: '2026-02-26T16:00:00', labelId: 'LBL-ARX-008',
    itemCount: 2, weight: '0.3kg', operator: 'Ali M.',
  },
  {
    id: 'SL-010', orderId: 'ORD-1854', boxSerial: 'BOX-U1E5H-1854',
    customerName: 'Layla Ibrahim', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 'delivered',
    timestamp: '2026-02-27T11:00:00', labelId: 'LBL-ARX-008',
    trackingNumber: 'ARX-TRK-88341', itemCount: 2, weight: '0.3kg', operator: 'System',
  },
  {
    id: 'SL-011', orderId: 'ORD-1856', boxSerial: 'BOX-W3G7J-1856',
    customerName: 'Yusuf Al Hashimi', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'dhl', event: 'dispatched',
    timestamp: '2026-02-28T12:00:00', labelId: 'LBL-DHL-010',
    itemCount: 1, weight: '0.2kg', operator: 'Ali M.',
  },
  {
    id: 'SL-012', orderId: 'ORD-1860', boxSerial: 'BOX-A7K1N-1860',
    customerName: 'Huda Bin Zayed', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 'returned',
    timestamp: '2026-02-25T09:00:00', labelId: 'LBL-ARX-060',
    trackingNumber: 'ARX-TRK-77120', itemCount: 2, weight: '0.3kg',
    notes: 'Customer refused delivery — wrong address on file', operator: 'System',
  },
  {
    id: 'SL-013', orderId: 'ORD-1860', boxSerial: 'BOX-A7K1N-1860',
    customerName: 'Huda Bin Zayed', city: 'Dubai', country: 'UAE',
    shipmentType: 'domestic', carrier: 'aramex', event: 're_dispatched',
    timestamp: '2026-02-26T10:00:00', labelId: 'LBL-ARX-060B',
    itemCount: 2, weight: '0.3kg', notes: 'Address corrected, re-dispatched', operator: 'Ali M.',
  },
];

// ---- Component ----
export default function ShippingLedger() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [carrierFilter, setCarrierFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let items = [...mockLedger].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const q = search.toLowerCase();
    if (search) {
      items = items.filter(e =>
        e.orderId.toLowerCase().includes(q) ||
        e.boxSerial.toLowerCase().includes(q) ||
        e.customerName.toLowerCase().includes(q) ||
        e.labelId.toLowerCase().includes(q) ||
        e.awbNumber?.toLowerCase().includes(q) ||
        e.trackingNumber?.toLowerCase().includes(q)
      );
    }
    if (eventFilter !== 'all') items = items.filter(e => e.event === eventFilter);
    if (carrierFilter !== 'all') items = items.filter(e => e.carrier === carrierFilter);
    return items;
  }, [search, eventFilter, carrierFilter]);

  const stats = useMemo(() => ({
    totalEvents: mockLedger.length,
    dispatched: mockLedger.filter(e => e.event === 'dispatched').length,
    delivered: mockLedger.filter(e => e.event === 'delivered').length,
    returned: mockLedger.filter(e => e.event === 'returned').length,
    failed: mockLedger.filter(e => e.event === 'failed').length,
  }), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping Ledger"
        subtitle="Historical log of all shipment events — dispatched, delivered, returned, failed"
        actions={
          <Button variant="outline" className="gap-1.5" onClick={() => toast('CSV export coming soon')}>
            <Download className="w-4 h-4" /> Export
          </Button>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50"><FileText className="w-4 h-4 text-blue-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.totalEvents}</p>
                <p className="text-[10px] text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50"><Send className="w-4 h-4 text-indigo-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.dispatched}</p>
                <p className="text-[10px] text-muted-foreground">Dispatched</p>
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
              <div className="p-2 rounded-lg bg-orange-50"><RotateCcw className="w-4 h-4 text-orange-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.returned}</p>
                <p className="text-[10px] text-muted-foreground">Returned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-red-50"><XCircle className="w-4 h-4 text-red-600" /></div>
              <div>
                <p className="text-xl font-bold">{stats.failed}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search orders, box serials, labels..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Event type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <span className={cfg.color}>{cfg.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={carrierFilter} onValueChange={setCarrierFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Carrier..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Carriers</SelectItem>
            {Object.entries(CARRIER_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <span className={cfg.color}>{cfg.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      {/* Ledger Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[140px]">Date / Time</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[100px]">Event</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[90px]">Order</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[130px]">Box Serial</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[80px]">Carrier</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[110px]">Label / AWB</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[80px]">Items</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground w-[80px]">Operator</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                    No ledger entries match your filters
                  </td>
                </tr>
              )}
              {filtered.map(entry => {
                const evtCfg = EVENT_CONFIG[entry.event];
                const Icon = evtCfg.icon;
                return (
                  <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="text-xs font-medium">
                        {new Date(entry.timestamp).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', evtCfg.bgColor, evtCfg.color)}>
                        <Icon className="w-3 h-3" />
                        {evtCfg.label}
                      </div>
                      {evtCfg.direction === 'out' && (
                        <ArrowRight className="inline w-3 h-3 ml-1 text-muted-foreground/40" />
                      )}
                      {evtCfg.direction === 'in' && (
                        <ArrowLeft className="inline w-3 h-3 ml-1 text-orange-400" />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-bold font-mono">{entry.orderId}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Box className="w-3 h-3 text-gold" />
                        <span className="text-[10px] font-mono text-gold">{entry.boxSerial}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium truncate max-w-[150px]">{entry.customerName}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{entry.city}, {entry.country}</span>
                        {entry.shipmentType === 'international' && (
                          <Badge className="text-[7px] bg-violet-100 text-violet-700 px-1 h-3">INTL</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs font-medium', CARRIER_CONFIG[entry.carrier].color)}>
                        {CARRIER_CONFIG[entry.carrier].label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-mono text-blue-600 block">{entry.labelId}</span>
                      {entry.awbNumber && (
                        <span className="text-[10px] font-mono text-violet-600 block">{entry.awbNumber}</span>
                      )}
                      {entry.trackingNumber && (
                        <span className="text-[10px] font-mono text-muted-foreground block">{entry.trackingNumber}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs">{entry.itemCount} · {entry.weight}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-muted-foreground">{entry.operator}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {entry.satisfaction && (
                        <span className="text-xs mr-1">{SATISFACTION_EMOJI[entry.satisfaction]}</span>
                      )}
                      {entry.notes && (
                        <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px] block">
                          {entry.notes}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

