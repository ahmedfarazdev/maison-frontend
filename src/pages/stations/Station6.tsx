// ============================================================
// Shipping & Dispatch
// Enhanced: Connected to Print Queue + Shipping Companies from Settings
// Flow: Select Carrier → Generate AWB → Send to Print Queue → Ready → Pickup → Shipped
// ============================================================

import { useState, useRef, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { Link } from 'wouter';
import {
  Truck, Printer, CheckCircle2, FileText, Package, MapPin,
  Camera, Clock, ArrowRight, User, Tag, Copy, Send,
  AlertTriangle, Wifi, WifiOff, ExternalLink, Settings2,
  ChevronDown, ChevronUp, RotateCcw, Eye, Loader2,
  PackageCheck, Box, Boxes, Zap, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';
import { generateShippingManifest } from '@/lib/shipping-manifest-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import StationHeader from '@/components/StationHeader';

type ShipStage = 'preparing' | 'label_generated' | 'printing' | 'ready' | 'shipped';

// Shipping companies pulled from Settings (mock — mirrors the Settings data)
interface ShippingCompany {
  id: string;
  name: string;
  carrier_type: string;
  prefix: string;
  color: string;
  status: 'active' | 'inactive';
  api_connected: boolean;
  tracking_url_template?: string;
}

const SHIPPING_COMPANIES: ShippingCompany[] = [
  { id: 'aramex', name: 'Aramex', carrier_type: 'express', prefix: 'ARX', color: 'text-orange-500', status: 'active', api_connected: true, tracking_url_template: 'https://www.aramex.com/track/results?ShipmentNumber={tracking}' },
  { id: 'dhl', name: 'DHL Express', carrier_type: 'international', prefix: 'DHL', color: 'text-yellow-600', status: 'active', api_connected: true, tracking_url_template: 'https://www.dhl.com/en/express/tracking.html?AWB={tracking}' },
  { id: 'emirates-post', name: 'Emirates Post', carrier_type: 'standard', prefix: 'EP', color: 'text-red-500', status: 'active', api_connected: false },
  { id: 'fedex', name: 'FedEx', carrier_type: 'international', prefix: 'FDX', color: 'text-purple-600', status: 'active', api_connected: true, tracking_url_template: 'https://www.fedex.com/fedextrack/?trknbr={tracking}' },
  { id: 'fetchr', name: 'Fetchr', carrier_type: 'local', prefix: 'FTR', color: 'text-teal-500', status: 'inactive', api_connected: false },
];

// Print Queue job type for AWB labels
interface PrintQueueJob {
  id: string;
  order_id: string;
  type: 'shipping_label';
  printer_name: string;
  status: 'queued' | 'printing' | 'completed' | 'failed';
  created_at: string;
  tracking: string;
  carrier: string;
}

export default function Station6() {
  const { data: ordersRes } = useApiQuery(() => api.orders.list(), []);
  const orders = ((ordersRes || []) as Order[]).filter(o =>
    ['packed', 'shipped', 'qc_passed'].includes(o.status)
  );

  const [stages, setStages] = useState<Record<string, ShipStage>>({});
  const [selectedCourier, setSelectedCourier] = useState<Record<string, string>>({});
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [labelPrinted, setLabelPrinted] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [courierConfirmed, setCourierConfirmed] = useState(false);
  const [courierDriverName, setCourierDriverName] = useState('');
  const [courierTime, setCourierTime] = useState('');
  const [defaultCourier, setDefaultCourier] = useState('aramex');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoTarget, setPhotoTarget] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Print Queue state — tracks AWB print jobs sent from this station
  const [printQueue, setPrintQueue] = useState<PrintQueueJob[]>([]);
  const [showPrintQueue, setShowPrintQueue] = useState(false);

  const activeCarriers = useMemo(() => SHIPPING_COMPANIES.filter(c => c.status === 'active'), []);

  const getStage = (orderId: string): ShipStage => stages[orderId] || 'preparing';

  const preparingOrders = orders.filter(o => getStage(o.order_id) === 'preparing');
  const labelledOrders = orders.filter(o => ['label_generated', 'printing'].includes(getStage(o.order_id)));
  const readyOrders = orders.filter(o => getStage(o.order_id) === 'ready');
  const shippedOrders = orders.filter(o => getStage(o.order_id) === 'shipped');

  const generateLabel = (orderId: string) => {
    const courier = selectedCourier[orderId] || defaultCourier;
    const courierInfo = activeCarriers.find(c => c.id === courier) || activeCarriers[0];
    const tracking = `${courierInfo.prefix}-${Date.now().toString(36).toUpperCase()}-${orderId.slice(-4)}`;
    setSelectedCourier(prev => ({ ...prev, [orderId]: courier }));
    setTrackingNumbers(prev => ({ ...prev, [orderId]: tracking }));
    setStages(prev => ({ ...prev, [orderId]: 'label_generated' }));
    toast.success(`AWB generated via ${courierInfo.name}`, {
      description: `Tracking: ${tracking}`,
      action: {
        label: 'Send to Printer',
        onClick: () => sendToPrintQueue(orderId, tracking, courierInfo.name),
      },
    });
  };

  const generateAllLabels = () => {
    const toGenerate = preparingOrders.filter(o => getStage(o.order_id) === 'preparing');
    toGenerate.forEach(o => generateLabel(o.order_id));
    if (toGenerate.length > 0) {
      toast.success(`Generated ${toGenerate.length} AWB labels`, {
        description: 'Click "Print All" to send to Print Queue',
      });
    }
  };

  // Send AWB label to Print Queue
  const sendToPrintQueue = (orderId: string, tracking: string, carrierName: string) => {
    const job: PrintQueueJob = {
      id: `PQ-AWB-${Date.now().toString(36).toUpperCase()}`,
      order_id: orderId,
      type: 'shipping_label',
      printer_name: 'Shipping Printer (Zebra ZD421)',
      status: 'queued',
      created_at: new Date().toISOString(),
      tracking,
      carrier: carrierName,
    };
    setPrintQueue(prev => [...prev, job]);
    setLabelPrinted(prev => ({ ...prev, [orderId]: true }));

    // Simulate print completion after 2 seconds
    setTimeout(() => {
      setPrintQueue(prev => prev.map(j => j.id === job.id ? { ...j, status: 'printing' } : j));
      setTimeout(() => {
        setPrintQueue(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed' } : j));
      }, 1500);
    }, 800);

    toast.success('AWB sent to Print Queue', {
      description: `${job.printer_name} — ${tracking}`,
      action: {
        label: 'View Queue',
        onClick: () => setShowPrintQueue(true),
      },
    });
  };

  const printLabel = (orderId: string) => {
    const tracking = trackingNumbers[orderId] || '';
    const courier = activeCarriers.find(c => c.id === (selectedCourier[orderId] || defaultCourier));
    sendToPrintQueue(orderId, tracking, courier?.name || 'Unknown');
  };

  const printAllLabels = () => {
    labelledOrders.forEach(o => {
      if (!labelPrinted[o.order_id]) {
        const tracking = trackingNumbers[o.order_id] || '';
        const courier = activeCarriers.find(c => c.id === (selectedCourier[o.order_id] || defaultCourier));
        sendToPrintQueue(o.order_id, tracking, courier?.name || 'Unknown');
      }
    });
    toast.success(`${labelledOrders.filter(o => !labelPrinted[o.order_id]).length} AWB labels sent to Print Queue`);
  };

  const moveToReady = (orderId: string) => {
    if (!labelPrinted[orderId]) {
      toast.warning('Print the AWB label first');
      return;
    }
    setStages(prev => ({ ...prev, [orderId]: 'ready' }));
    toast.success('Order ready for courier pickup');
  };

  const moveAllToReady = () => {
    const printedLabelled = labelledOrders.filter(o => labelPrinted[o.order_id]);
    printedLabelled.forEach(o => {
      setStages(prev => ({ ...prev, [o.order_id]: 'ready' }));
    });
    toast.success(`${printedLabelled.length} orders moved to ready`);
  };

  const moveToShipped = (orderId: string) => {
    setStages(prev => ({ ...prev, [orderId]: 'shipped' }));
    toast.success('Order marked as shipped');
  };

  const handlePhotoUpload = (orderId: string) => {
    setPhotoTarget(orderId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTarget) return;
    const url = URL.createObjectURL(file);
    setPhotos(prev => ({ ...prev, [photoTarget]: url }));
    toast.success('Photo attached');
    setPhotoTarget(null);
    e.target.value = '';
  };

  const confirmCourierPickup = () => {
    if (!courierDriverName.trim()) {
      toast.warning('Enter courier/driver name');
      return;
    }
    readyOrders.forEach(o => moveToShipped(o.order_id));
    setCourierConfirmed(true);
    setCourierTime(new Date().toLocaleTimeString());
    toast.success(`Courier pickup confirmed — ${readyOrders.length} orders shipped`);
  };

  const copyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    toast.info('Tracking number copied');
  };

  const getCourierInfo = (orderId: string) => {
    const courierId = selectedCourier[orderId] || defaultCourier;
    return activeCarriers.find(c => c.id === courierId) || activeCarriers[0];
  };

  const getTrackingUrl = (orderId: string) => {
    const courier = getCourierInfo(orderId);
    const tracking = trackingNumbers[orderId];
    if (!courier?.tracking_url_template || !tracking) return null;
    return courier.tracking_url_template.replace('{tracking}', tracking);
  };

  // ---- Order Card Component ----
  const OrderCard = ({ order, stage }: { order: Order; stage: ShipStage }) => {
    const courier = getCourierInfo(order.order_id);
    const tracking = trackingNumbers[order.order_id];
    const printed = labelPrinted[order.order_id];
    const trackingUrl = getTrackingUrl(order.order_id);
    const isExpanded = expandedCard === order.order_id;
    const printJob = printQueue.find(j => j.order_id === order.order_id);

    return (
      <div className={cn(
        'rounded-lg border bg-card transition-all hover:shadow-sm',
        stage === 'shipped' ? 'border-success/30' :
        stage === 'ready' ? 'border-gold/30' :
        stage === 'label_generated' || stage === 'printing' ? 'border-amber-500/30' : 'border-border',
      )}>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-semibold">{order.order_id}</p>
                {order.notes && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">Note</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3" /> {order.customer.name}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {order.customer.city}, {order.customer.country}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{order.items.length} items</p>
              {tracking && (
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[10px] font-mono text-gold">{tracking}</p>
                  <button onClick={() => copyTracking(tracking)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                  {trackingUrl && (
                    <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Courier + Print Status */}
          {stage !== 'preparing' && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Truck className={cn('w-3 h-3', courier?.color || 'text-muted-foreground')} />
                <span className="text-xs font-medium">{courier?.name}</span>
                {courier?.api_connected ? (
                  <Wifi className="w-2.5 h-2.5 text-success" />
                ) : (
                  <WifiOff className="w-2.5 h-2.5 text-muted-foreground" />
                )}
              </div>
              {printJob && (
                <div className={cn(
                  'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border',
                  printJob.status === 'completed' ? 'bg-success/10 border-success/20 text-success' :
                  printJob.status === 'printing' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600' :
                  printJob.status === 'queued' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                  'bg-red-500/10 border-red-500/20 text-red-600',
                )}>
                  {printJob.status === 'printing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                  {printJob.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {printJob.status === 'queued' && <Clock className="w-2.5 h-2.5" />}
                  <Printer className="w-2.5 h-2.5" />
                  <span className="font-medium capitalize">{printJob.status}</span>
                </div>
              )}
              {printed && !printJob && <StatusBadge variant="success">Printed</StatusBadge>}
            </div>
          )}

          {/* Photo preview */}
          {photos[order.order_id] && (
            <div className="mb-2">
              <img src={photos[order.order_id]} alt="Package" className="w-full h-24 object-cover rounded border border-border" />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {stage === 'preparing' && (
              <>
                <select
                  value={selectedCourier[order.order_id] || defaultCourier}
                  onChange={e => setSelectedCourier(prev => ({ ...prev, [order.order_id]: e.target.value }))}
                  className="h-7 text-xs bg-background border border-input rounded-md px-2"
                >
                  {activeCarriers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.api_connected ? '✓' : ''}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  className="gap-1 text-xs h-7 bg-gold hover:bg-gold/90 text-gold-foreground"
                  onClick={() => generateLabel(order.order_id)}
                >
                  <Tag className="w-3 h-3" /> Generate AWB
                </Button>
              </>
            )}

            {(stage === 'label_generated' || stage === 'printing') && (
              <>
                <Button
                  size="sm"
                  variant={printed ? 'outline' : 'default'}
                  className={cn('gap-1 text-xs h-7', !printed && 'bg-gold hover:bg-gold/90 text-gold-foreground')}
                  onClick={() => printLabel(order.order_id)}
                >
                  <Send className="w-3 h-3" /> {printed ? 'Reprint AWB' : 'Send to Printer'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-7"
                  onClick={() => handlePhotoUpload(order.order_id)}
                >
                  <Camera className="w-3 h-3" /> Photo
                </Button>
                <Button
                  size="sm"
                  className="gap-1 text-xs h-7 bg-success hover:bg-success/90 text-success-foreground"
                  disabled={!printed}
                  onClick={() => moveToReady(order.order_id)}
                >
                  <ArrowRight className="w-3 h-3" /> Ready
                </Button>
              </>
            )}

            {stage === 'ready' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-7"
                  onClick={() => handlePhotoUpload(order.order_id)}
                >
                  <Camera className="w-3 h-3" /> Photo
                </Button>
                <StatusBadge variant="gold">Awaiting Pickup</StatusBadge>
              </>
            )}

            {stage === 'shipped' && (
              <div className="flex items-center gap-2">
                <StatusBadge variant="success">Shipped</StatusBadge>
                {trackingUrl && (
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gold hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Track
                  </a>
                )}
              </div>
            )}

            {/* Expand/collapse for item details */}
            <button
              onClick={() => setExpandedCard(isExpanded ? null : order.order_id)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border bg-muted/10 p-3 space-y-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1">Item</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1">Size</th>
                      <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium py-1">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map(item => (
                      <tr key={item.item_id} className="border-b border-border/30">
                        <td className="py-1 font-medium">{item.perfume_name}</td>
                        <td className="py-1 text-center font-mono">{item.size_ml}ml</td>
                        <td className="py-1 text-center font-mono">×{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {order.notes && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{order.notes}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Shipping & Dispatch"
        subtitle={`Generate AWB → Send to Printer → Courier Pickup — ${shippedOrders.length}/${orders.length} shipped`}
        breadcrumbs={[{ label: 'Pod Framework' }, { label: 'Shipping & Dispatch' }]}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={generateAllLabels}
              disabled={preparingOrders.length === 0}
            >
              <Tag className="w-3.5 h-3.5" /> Generate All AWBs ({preparingOrders.length})
            </Button>
            {labelledOrders.filter(o => !labelPrinted[o.order_id]).length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={printAllLabels}
              >
                <Send className="w-3.5 h-3.5" /> Send All to Printer ({labelledOrders.filter(o => !labelPrinted[o.order_id]).length})
              </Button>
            )}
            {labelledOrders.filter(o => labelPrinted[o.order_id]).length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={moveAllToReady}
              >
                <ArrowRight className="w-3.5 h-3.5" /> All to Ready
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowPrintQueue(!showPrintQueue)}
            >
              <Printer className="w-3.5 h-3.5" /> Print Queue ({printQueue.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                generateShippingManifest({
                  orders,
                  trackingNumbers,
                  courierName: courierDriverName || undefined,
                  courierTime: courierTime || undefined,
                  batchLabel: `Batch — ${new Date().toLocaleDateString()}`,
                });
                toast.success('Manifest PDF downloaded');
              }}
            >
              <FileText className="w-3.5 h-3.5" /> Manifest
            </Button>
          </div>
        }
      />

      <StationHeader stationNumber={6} queueCount={orders.length} />

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileSelected}
      />

      <div className="p-6 space-y-6">
        {/* Active Carriers Strip */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card overflow-x-auto">
          <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Active Carriers:</span>
          <div className="flex items-center gap-2">
            {activeCarriers.map(c => (
              <div key={c.id} className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer',
                defaultCourier === c.id
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-border hover:border-muted-foreground/30',
              )} onClick={() => setDefaultCourier(c.id)}>
                <Truck className={cn('w-3 h-3', c.color)} />
                <span>{c.name}</span>
                {c.api_connected ? (
                  <Wifi className="w-2.5 h-2.5 text-success" />
                ) : (
                  <WifiOff className="w-2.5 h-2.5 text-muted-foreground/50" />
                )}
                {defaultCourier === c.id && (
                  <span className="text-[8px] uppercase tracking-wider font-bold">Default</span>
                )}
              </div>
            ))}
          </div>
          <Link href="/settings" className="ml-auto shrink-0">
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1">
              <Settings2 className="w-3 h-3" /> Manage
            </Button>
          </Link>
        </div>

        {/* Print Queue Panel (collapsible) */}
        <AnimatePresence>
          {showPrintQueue && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <SectionCard
                title="AWB Print Queue"
                subtitle={`${printQueue.filter(j => j.status === 'queued' || j.status === 'printing').length} active · ${printQueue.filter(j => j.status === 'completed').length} completed`}
                headerActions={
                  <div className="flex items-center gap-2">
                    <Link href="/print-queue">
                      <Button size="sm" variant="ghost" className="text-xs gap-1">
                        <ExternalLink className="w-3 h-3" /> Full Queue
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setShowPrintQueue(false)}>
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                  </div>
                }
              >
                {printQueue.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <Printer className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p>No print jobs yet. Generate AWB labels and send to printer.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {printQueue.slice().reverse().map(job => (
                      <div key={job.id} className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                        job.status === 'completed' ? 'border-success/20 bg-success/5' :
                        job.status === 'printing' ? 'border-blue-500/20 bg-blue-500/5' :
                        job.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                        'border-border',
                      )}>
                        <div className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                          job.status === 'completed' ? 'bg-success/10' :
                          job.status === 'printing' ? 'bg-blue-500/10' :
                          'bg-muted',
                        )}>
                          {job.status === 'printing' ? (
                            <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                          ) : job.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium">{job.order_id}</span>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] font-mono text-gold">{job.tracking}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{job.carrier}</span>
                            <span>·</span>
                            <span>{job.printer_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'text-[10px] font-medium capitalize px-1.5 py-0.5 rounded-full',
                            job.status === 'completed' ? 'bg-success/10 text-success' :
                            job.status === 'printing' ? 'bg-blue-500/10 text-blue-600' :
                            job.status === 'queued' ? 'bg-amber-500/10 text-amber-600' :
                            'bg-red-500/10 text-red-600',
                          )}>
                            {job.status}
                          </span>
                          {job.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px] gap-0.5"
                              onClick={() => {
                                const newJob = { ...job, id: `PQ-AWB-${Date.now().toString(36).toUpperCase()}`, status: 'queued' as const, created_at: new Date().toISOString() };
                                setPrintQueue(prev => [...prev, newJob]);
                                setTimeout(() => {
                                  setPrintQueue(prev => prev.map(j => j.id === newJob.id ? { ...j, status: 'printing' } : j));
                                  setTimeout(() => {
                                    setPrintQueue(prev => prev.map(j => j.id === newJob.id ? { ...j, status: 'completed' } : j));
                                  }, 1500);
                                }, 800);
                                toast.success('Reprinting AWB label');
                              }}
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Reprint
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Four-column Shipping Kanban */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Preparing */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <h3 className="text-sm font-semibold">Preparing</h3>
              <span className="text-xs text-muted-foreground ml-auto">{preparingOrders.length}</span>
            </div>
            <div className="space-y-3">
              {preparingOrders.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                  No orders preparing
                </div>
              ) : (
                preparingOrders.map(o => <OrderCard key={o.order_id} order={o} stage="preparing" />)
              )}
            </div>
          </div>

          {/* Label Generated */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <h3 className="text-sm font-semibold">AWB Generated</h3>
              <span className="text-xs text-muted-foreground ml-auto">{labelledOrders.length}</span>
            </div>
            <div className="space-y-3">
              {labelledOrders.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                  No AWBs pending print
                </div>
              ) : (
                labelledOrders.map(o => <OrderCard key={o.order_id} order={o} stage="label_generated" />)
              )}
            </div>
          </div>

          {/* Ready for Pickup */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gold" />
              <h3 className="text-sm font-semibold">Ready for Pickup</h3>
              <span className="text-xs text-muted-foreground ml-auto">{readyOrders.length}</span>
            </div>
            <div className="space-y-3">
              {readyOrders.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                  No orders ready
                </div>
              ) : (
                readyOrders.map(o => <OrderCard key={o.order_id} order={o} stage="ready" />)
              )}
            </div>
          </div>

          {/* Shipped */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-success" />
              <h3 className="text-sm font-semibold">Shipped</h3>
              <span className="text-xs text-muted-foreground ml-auto">{shippedOrders.length}</span>
            </div>
            <div className="space-y-3">
              {shippedOrders.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                  No orders shipped yet
                </div>
              ) : (
                shippedOrders.map(o => <OrderCard key={o.order_id} order={o} stage="shipped" />)
              )}
            </div>
          </div>
        </div>

        {/* Courier Pickup Section */}
        <SectionCard
          title="Courier Pickup"
          subtitle="Confirm when courier collects all ready packages"
          headerActions={
            courierConfirmed
              ? <StatusBadge variant="success">Picked Up at {courierTime}</StatusBadge>
              : <StatusBadge variant="muted">Pending</StatusBadge>
          }
        >
          {courierConfirmed ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-success/30 bg-success/5">
              <Truck className="w-6 h-6 text-success" />
              <div>
                <p className="text-sm font-semibold text-success">Courier pickup confirmed</p>
                <p className="text-xs text-muted-foreground">
                  {courierDriverName} · Picked up at {courierTime} · {shippedOrders.length} packages
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Courier / Driver Name</label>
                  <input
                    type="text"
                    value={courierDriverName}
                    onChange={e => setCourierDriverName(e.target.value)}
                    placeholder="Enter courier/driver name..."
                    className="w-full h-10 px-3 text-sm bg-background border border-input rounded-md"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Courier Service</label>
                  <div className="h-10 px-3 flex items-center text-sm bg-muted/30 border border-border rounded-md">
                    {activeCarriers.find(c => c.id === defaultCourier)?.name || 'Aramex'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Packages Ready</label>
                  <div className="h-10 px-3 flex items-center text-sm bg-muted/30 border border-border rounded-md font-mono">
                    {readyOrders.length} packages
                  </div>
                </div>
              </div>
              <Button
                onClick={confirmCourierPickup}
                disabled={readyOrders.length === 0}
                className="gap-1.5 bg-gold hover:bg-gold/90 text-gold-foreground"
              >
                <Truck className="w-4 h-4" /> Confirm Courier Pickup ({readyOrders.length} packages)
              </Button>
              {readyOrders.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Move orders to "Ready" before confirming pickup
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-border text-center">
            <p className="text-2xl font-bold">{preparingOrders.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preparing</p>
          </div>
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-center">
            <p className="text-2xl font-bold text-amber-500">{labelledOrders.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AWB Generated</p>
          </div>
          <div className="p-3 rounded-lg border border-gold/30 bg-gold/5 text-center">
            <p className="text-2xl font-bold text-gold">{readyOrders.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ready</p>
          </div>
          <div className="p-3 rounded-lg border border-success/30 bg-success/5 text-center">
            <p className="text-2xl font-bold text-success">{shippedOrders.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Shipped</p>
          </div>
        </div>
      </div>
    </div>
  );
}
