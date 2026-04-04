// ============================================================
// Settings — System configuration, users, integrations, audit
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Settings as SettingsIcon, Users, Link, Shield, Bell, Database,
  ChevronRight, Save, Plus, Key, Globe, Webhook, Clock, Calendar,
  Loader2, RotateCcw, Printer as PrinterIcon, Wifi, WifiOff, Trash2, Edit2,
  Monitor, Tag as TagIcon, MapPin as MapPinIcon, Power, AlertCircle, CheckCircle2 as CheckCircle2Icon,
  Truck, Package, Plane, Ship, Zap, ExternalLink, ToggleLeft, ToggleRight,
  Eye, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';

type SettingsTab = 'general' | 'printers' | 'shipping' | 'users' | 'integrations' | 'notifications' | 'audit' | 'role_preview';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },

  { id: 'printers', label: 'Printers', icon: PrinterIcon },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Link },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit Log', icon: Shield },
  { id: 'role_preview', label: 'Role Preview', icon: Eye },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="System configuration and administration"
        breadcrumbs={[{ label: 'Settings' }]}
      />
      <div className="p-6">
        <div className="flex gap-6">
          {/* Tab Nav */}
          <div className="w-56 shrink-0">
            <nav className="space-y-1">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}>
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'general' && <GeneralSettings />}

            {activeTab === 'printers' && <PrinterSettings />}
            {activeTab === 'shipping' && <ShippingSettings />}
            {activeTab === 'users' && <UsersSettings />}
            {activeTab === 'integrations' && <IntegrationsSettings />}
            {activeTab === 'notifications' && <NotificationsSettings />}
            {activeTab === 'audit' && <AuditLog />}
            {activeTab === 'role_preview' && <RolePreview />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Operations Settings ----
function OperationsSettings() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // One-time order cut-off
  const [cutoffStart, setCutoffStart] = useState('09:00');
  const [cutoffEnd, setCutoffEnd] = useState('21:00');
  const [packLeadDays, setPackLeadDays] = useState('1');
  const [deliveryLeadDays, setDeliveryLeadDays] = useState('2');

  // Subscription cycle settings
  const [cycleDays, setCycleDays] = useState('7,14,21,28');
  const [cycleDeliveryLeadDays, setCycleDeliveryLeadDays] = useState('7');
  const [cyclesPerMonth, setCyclesPerMonth] = useState('4');
  const [cycleProcessingDays, setCycleProcessingDays] = useState('5');

  // Load settings from DB
  useEffect(() => {
    (async () => {
      try {
        const res = await api.settings.list();
        const map = new Map(res.data.map((s: any) => [s.key, s.value]));
        if (map.has('cutoff_start')) setCutoffStart(String(map.get('cutoff_start')));
        if (map.has('cutoff_end')) setCutoffEnd(String(map.get('cutoff_end')));
        if (map.has('pack_lead_days')) setPackLeadDays(String(map.get('pack_lead_days')));
        if (map.has('delivery_lead_days')) setDeliveryLeadDays(String(map.get('delivery_lead_days')));
        if (map.has('cycle_cutoff_days')) setCycleDays(String(map.get('cycle_cutoff_days')));
        if (map.has('cycle_delivery_lead_days')) setCycleDeliveryLeadDays(String(map.get('cycle_delivery_lead_days')));
        if (map.has('cycles_per_month')) setCyclesPerMonth(String(map.get('cycles_per_month')));
        if (map.has('cycle_processing_days')) setCycleProcessingDays(String(map.get('cycle_processing_days')));
      } catch (e) {
        console.warn('Failed to load settings', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.mutations.settings.setBulk([
        { key: 'cutoff_start', value: cutoffStart, description: 'Daily order cut-off start time (HH:mm)' },
        { key: 'cutoff_end', value: cutoffEnd, description: 'Daily order cut-off end time (HH:mm)' },
        { key: 'pack_lead_days', value: packLeadDays, description: 'Days after cut-off to pack orders' },
        { key: 'delivery_lead_days', value: deliveryLeadDays, description: 'Days after cut-off to deliver orders' },
        { key: 'cycle_cutoff_days', value: cycleDays, description: 'Subscription cycle cut-off days of month (comma-separated)' },
        { key: 'cycle_delivery_lead_days', value: cycleDeliveryLeadDays, description: 'Days after cycle cut-off to deliver subscription orders' },
        { key: 'cycles_per_month', value: cyclesPerMonth, description: 'Number of subscription cycles per month' },
        { key: 'cycle_processing_days', value: cycleProcessingDays, description: 'Days to process a subscription cycle (picking through shipping)' },
      ]);
      toast.success('Operations settings saved');
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* One-Time Order Cut-off */}
      <SectionCard title="One-Time Orders Cut-Off Time Window Settings" subtitle="Configure daily order collection windows and fulfillment timelines">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off Start Time</label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <input
                type="time"
                value={cutoffStart}
                onChange={e => setCutoffStart(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Orders received after this time start a new batch window</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off End Time</label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <input
                type="time"
                value={cutoffEnd}
                onChange={e => setCutoffEnd(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Orders received before this time are included in today's batch</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Pack Lead (Days After Cut-off)</label>
            <input
              type="number"
              min={0}
              max={7}
              value={packLeadDays}
              onChange={e => setPackLeadDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Orders packed this many days after cut-off (e.g., 1 = next day)</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Delivery Lead (Days After Cut-off)</label>
            <input
              type="number"
              min={0}
              max={14}
              value={deliveryLeadDays}
              onChange={e => setDeliveryLeadDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Orders delivered this many days after cut-off (e.g., 2 = day after packing)</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Example Timeline</p>
          <p className="text-sm">
            Orders from <span className="font-mono font-semibold text-gold">{cutoffStart}</span> to{' '}
            <span className="font-mono font-semibold text-gold">{cutoffEnd}</span> →{' '}
            Packed <span className="font-semibold">{packLeadDays} day(s)</span> later →{' '}
            Delivered <span className="font-semibold">{deliveryLeadDays} day(s)</span> after cut-off
          </p>
        </div>
      </SectionCard>

      {/* Subscription Cycle Settings */}
      <SectionCard title="Subscription Cut-Off Time Window Settings" subtitle="Configure monthly subscription cycle cut-off dates, processing windows, and delivery timelines">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cycles Per Month</label>
            <input
              type="number"
              min={1}
              max={8}
              value={cyclesPerMonth}
              onChange={e => setCyclesPerMonth(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cut-off Days of Month</label>
            <input
              type="text"
              value={cycleDays}
              onChange={e => setCycleDays(e.target.value)}
              placeholder="7,14,21,28"
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Comma-separated days (e.g., 7,14,21,28)</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Processing Window (Days)</label>
            <input
              type="number"
              min={1}
              max={14}
              value={cycleProcessingDays}
              onChange={e => setCycleProcessingDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Days to process cycle (picking → decanting → fulfillment)</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Delivery Lead (Days After Cycle Cut-off)</label>
            <input
              type="number"
              min={1}
              max={14}
              value={cycleDeliveryLeadDays}
              onChange={e => setCycleDeliveryLeadDays(e.target.value)}
              className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Delivery starts this many days after cycle cut-off</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Cycle Schedule Preview</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {cycleDays.split(',').map((day, i) => {
              const d = parseInt(day.trim());
              if (isNaN(d)) return null;
              const deliveryDay = d + parseInt(cycleDeliveryLeadDays || '7');
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <span>Cut-off: <span className="font-mono font-semibold">{d}th</span></span>
                  <span className="text-muted-foreground">→</span>
                  <span>Deliver: <span className="font-mono font-semibold">{deliveryDay > 28 ? `${deliveryDay - 28}th (next mo.)` : `${deliveryDay}th`}</span></span>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Operations Settings
        </Button>
      </div>
    </div>
  );
}

// ---- Printer Types ----
type PrinterType = 'labels' | 'shipping' | 'inserts' | 'general';
type PrinterStatus = 'online' | 'offline' | 'error';

interface PrinterConfig {
  id: string;
  name: string;
  model: string;
  type: PrinterType;
  ip_address: string;
  port: number;
  station_assignments: string[]; // station IDs
  status: PrinterStatus;
  is_default: boolean;
  last_seen: string;
  paper_size: string;
  notes: string;
}

const PRINTER_TYPE_CONFIG: Record<PrinterType, { label: string; color: string; icon: React.ElementType; description: string }> = {
  labels: { label: 'Label Printer', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: TagIcon, description: 'Prints product labels, perfume labels, and atomizer stickers' },
  shipping: { label: 'Shipping Printer', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: MapPinIcon, description: 'Prints shipping labels, waybills, and courier manifests' },
  inserts: { label: 'Insert Printer', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30', icon: PrinterIcon, description: 'Prints thank-you cards, inserts, and promotional materials' },
  general: { label: 'General Printer', color: 'bg-slate-500/15 text-slate-600 border-slate-500/30', icon: Monitor, description: 'General-purpose printing for reports, packing lists, and documents' },
};

const STATION_OPTIONS = [
  { id: 'stock', label: 'Stock Registry' },
  { id: 'S1', label: 'Pod Dashboard' },
  { id: 'S2', label: 'Picking' },
  { id: 'S3', label: 'Labeling' },
  { id: 'S4', label: 'Decanting' },
  { id: 'S5', label: 'QC & Assembly' },
  { id: 'S6', label: 'Shipping' },
  { id: 'MD', label: 'Manual Decant' },
  { id: 'ALL', label: 'All Stations' },
];

const PAPER_SIZES = ['62mm x 100mm (Label)', '100mm x 150mm (Shipping)', '80mm x 80mm (Receipt)', 'A4', 'A5', 'Custom'];

const DEFAULT_PRINTERS: PrinterConfig[] = [
  {
    id: 'prt-001', name: 'Brother QL-820NWB', model: 'QL-820NWB', type: 'labels',
    ip_address: '192.168.1.101', port: 9100, station_assignments: ['S3', 'S5'],
    status: 'online', is_default: true, last_seen: '2026-02-14 09:30',
    paper_size: '62mm x 100mm (Label)', notes: 'Primary label printer — Station 3 prep area',
  },
  {
    id: 'prt-002', name: 'Zebra ZD421', model: 'ZD421', type: 'shipping',
    ip_address: '192.168.1.102', port: 9100, station_assignments: ['S6'],
    status: 'online', is_default: true, last_seen: '2026-02-14 09:28',
    paper_size: '100mm x 150mm (Shipping)', notes: 'Shipping label printer — Station 6',
  },
  {
    id: 'prt-003', name: 'Epson TM-T88VI', model: 'TM-T88VI', type: 'inserts',
    ip_address: '192.168.1.103', port: 9100, station_assignments: ['S3'],
    status: 'offline', is_default: false, last_seen: '2026-02-13 16:00',
    paper_size: 'A5', notes: 'Insert / thank-you card printer',
  },
  {
    id: 'prt-004', name: 'HP LaserJet Pro', model: 'M404dn', type: 'general',
    ip_address: '192.168.1.104', port: 9100, station_assignments: ['ALL'],
    status: 'online', is_default: true, last_seen: '2026-02-14 09:25',
    paper_size: 'A4', notes: 'General office printer — reports, manifests, packing lists',
  },
];

function PrinterSettings() {
  const [printers, setPrinters] = useState<PrinterConfig[]>(DEFAULT_PRINTERS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Form state
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formType, setFormType] = useState<PrinterType>('labels');
  const [formIp, setFormIp] = useState('');
  const [formPort, setFormPort] = useState('9100');
  const [formStations, setFormStations] = useState<string[]>([]);
  const [formPaper, setFormPaper] = useState('62mm x 100mm (Label)');
  const [formNotes, setFormNotes] = useState('');
  const [formDefault, setFormDefault] = useState(false);

  const resetForm = () => {
    setFormName(''); setFormModel(''); setFormType('labels');
    setFormIp(''); setFormPort('9100'); setFormStations([]);
    setFormPaper('62mm x 100mm (Label)'); setFormNotes(''); setFormDefault(false);
  };

  const startEdit = (printer: PrinterConfig) => {
    setEditingPrinter(printer.id);
    setFormName(printer.name); setFormModel(printer.model); setFormType(printer.type);
    setFormIp(printer.ip_address); setFormPort(String(printer.port));
    setFormStations(printer.station_assignments); setFormPaper(printer.paper_size);
    setFormNotes(printer.notes); setFormDefault(printer.is_default);
    setShowAddForm(true);
  };

  const handleSave = () => {
    if (!formName || !formIp) { toast.error('Printer name and IP address are required'); return; }
    if (editingPrinter) {
      setPrinters(prev => prev.map(p => p.id === editingPrinter ? {
        ...p, name: formName, model: formModel, type: formType,
        ip_address: formIp, port: parseInt(formPort) || 9100,
        station_assignments: formStations.length ? formStations : ['ALL'],
        paper_size: formPaper, notes: formNotes, is_default: formDefault,
      } : p));
      toast.success(`Printer "${formName}" updated`);
    } else {
      const newPrinter: PrinterConfig = {
        id: `prt-${Date.now()}`, name: formName, model: formModel, type: formType,
        ip_address: formIp, port: parseInt(formPort) || 9100,
        station_assignments: formStations.length ? formStations : ['ALL'],
        status: 'offline', is_default: formDefault,
        last_seen: 'Never', paper_size: formPaper, notes: formNotes,
      };
      setPrinters(prev => [...prev, newPrinter]);
      toast.success(`Printer "${formName}" added`);
    }
    setShowAddForm(false); setEditingPrinter(null); resetForm();
  };

  const handleDelete = (id: string) => {
    const printer = printers.find(p => p.id === id);
    setPrinters(prev => prev.filter(p => p.id !== id));
    toast.success(`Printer "${printer?.name}" removed`);
  };

  const handleToggleDefault = (id: string) => {
    const printer = printers.find(p => p.id === id);
    if (!printer) return;
    setPrinters(prev => prev.map(p => {
      if (p.id === id) return { ...p, is_default: !p.is_default };
      // If setting as default, unset other defaults of same type
      if (!printer.is_default && p.type === printer.type && p.is_default) return { ...p, is_default: false };
      return p;
    }));
    toast.success(printer.is_default ? `"${printer.name}" is no longer default` : `"${printer.name}" set as default for ${PRINTER_TYPE_CONFIG[printer.type].label}`);
  };

  const handleTestConnection = (id: string) => {
    const printer = printers.find(p => p.id === id);
    toast.info(`Testing connection to ${printer?.name} at ${printer?.ip_address}...`);
    setTimeout(() => {
      const success = Math.random() > 0.3;
      if (success) {
        setPrinters(prev => prev.map(p => p.id === id ? { ...p, status: 'online', last_seen: new Date().toLocaleString() } : p));
        toast.success(`${printer?.name} is online and responding`);
      } else {
        setPrinters(prev => prev.map(p => p.id === id ? { ...p, status: 'error' } : p));
        toast.error(`${printer?.name} is not responding — check network connection`);
      }
    }, 1500);
  };

  const toggleStationAssignment = (stationId: string) => {
    setFormStations(prev => {
      if (stationId === 'ALL') return prev.includes('ALL') ? [] : ['ALL'];
      const next = prev.filter(s => s !== 'ALL');
      return next.includes(stationId) ? next.filter(s => s !== stationId) : [...next, stationId];
    });
  };

  // Filtered printers
  const filteredPrinters = printers.filter(p => {
    if (selectedType !== 'all' && p.type !== selectedType) return false;
    if (selectedStation !== 'all' && !p.station_assignments.includes(selectedStation) && !p.station_assignments.includes('ALL')) return false;
    return true;
  });

  const onlineCount = printers.filter(p => p.status === 'online').length;
  const offlineCount = printers.filter(p => p.status !== 'online').length;

  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-background">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Printers</p>
          <p className="text-2xl font-semibold mt-0.5">{printers.length}</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-background">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Online</p>
          </div>
          <p className="text-2xl font-semibold mt-0.5 text-green-600">{onlineCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-background">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Offline / Error</p>
          </div>
          <p className="text-2xl font-semibold mt-0.5 text-red-500">{offlineCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-background">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Printer Types</p>
          <p className="text-2xl font-semibold mt-0.5">{new Set(printers.map(p => p.type)).size}</p>
        </div>
      </div>

      {/* Actions + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <option value="all">All Types</option>
            {Object.entries(PRINTER_TYPE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <select
            value={selectedStation}
            onChange={e => setSelectedStation(e.target.value)}
            className="h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
          >
            <option value="all">All Stations</option>
            {STATION_OPTIONS.filter(s => s.id !== 'ALL').map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
          onClick={() => { setShowAddForm(!showAddForm); setEditingPrinter(null); resetForm(); }}>
          <Plus className="w-3.5 h-3.5" /> {showAddForm ? 'Cancel' : 'Add Printer'}
        </Button>
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <SectionCard title={editingPrinter ? 'Edit Printer' : 'Add New Printer'} subtitle="Configure printer connection and station assignments">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Printer Name</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="e.g., Brother QL-820NWB" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Model</label>
              <input type="text" value={formModel} onChange={e => setFormModel(e.target.value)}
                placeholder="e.g., QL-820NWB" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Printer Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as PrinterType)}
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30">
                {Object.entries(PRINTER_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">{PRINTER_TYPE_CONFIG[formType].description}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">IP Address</label>
              <input type="text" value={formIp} onChange={e => setFormIp(e.target.value)}
                placeholder="192.168.1.100" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Port</label>
              <input type="number" value={formPort} onChange={e => setFormPort(e.target.value)}
                placeholder="9100" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Paper Size</label>
              <select value={formPaper} onChange={e => setFormPaper(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30">
                {PAPER_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 block">Station Assignments</label>
              <div className="flex flex-wrap gap-2">
                {STATION_OPTIONS.map(station => (
                  <button key={station.id}
                    onClick={() => toggleStationAssignment(station.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md border transition-all',
                      formStations.includes(station.id)
                        ? 'bg-gold/15 text-gold border-gold/30 ring-1 ring-gold/20'
                        : 'bg-background text-muted-foreground border-border hover:border-gold/20',
                    )}>
                    {station.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Select which stations can use this printer. "All Stations" makes it globally available.</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Notes</label>
              <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                placeholder="Location, purpose, or special instructions..." className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={formDefault} onChange={e => setFormDefault(e.target.checked)} className="w-4 h-4 accent-gold" />
              <label className="text-xs text-muted-foreground">Set as default for this printer type</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> {editingPrinter ? 'Update Printer' : 'Add Printer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setEditingPrinter(null); resetForm(); }}>Cancel</Button>
          </div>
        </SectionCard>
      )}

      {/* Printer Cards */}
      {filteredPrinters.length === 0 ? (
        <div className="text-center py-12">
          <PrinterIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No printers match the current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrinters.map(printer => {
            const typeConfig = PRINTER_TYPE_CONFIG[printer.type];
            const TypeIcon = typeConfig.icon;
            return (
              <div key={printer.id} className={cn(
                'rounded-lg border p-4 transition-all',
                printer.status === 'online' ? 'border-green-500/20 bg-green-500/[0.02]' :
                printer.status === 'error' ? 'border-red-500/20 bg-red-500/[0.02]' :
                'border-border',
              )}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', typeConfig.color.split(' ')[0])}>
                      <TypeIcon className={cn('w-5 h-5', typeConfig.color.split(' ')[1])} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{printer.name}</h4>
                        {printer.is_default && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/20">Default</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{printer.model} · {printer.paper_size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full',
                      printer.status === 'online' ? 'bg-green-500/15 text-green-600' :
                      printer.status === 'error' ? 'bg-red-500/15 text-red-600' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {printer.status === 'online' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {printer.status === 'online' ? 'Online' : printer.status === 'error' ? 'Error' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">IP Address:</span>{' '}
                    <span className="font-mono font-medium">{printer.ip_address}:{printer.port}</span>
                  </div>
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Last Seen:</span>{' '}
                    <span className="font-medium">{printer.last_seen}</span>
                  </div>
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full border', typeConfig.color)}>
                      {typeConfig.label}
                    </span>
                  </div>
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Stations:</span>{' '}
                    <span className="font-medium">
                      {printer.station_assignments.includes('ALL') ? 'All Stations' : printer.station_assignments.join(', ')}
                    </span>
                  </div>
                </div>

                {printer.notes && (
                  <p className="text-[11px] text-muted-foreground italic mb-3">{printer.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 border-t border-border/50 pt-3">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => handleTestConnection(printer.id)}>
                    <Power className="w-3 h-3" /> Test
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => handleToggleDefault(printer.id)}>
                    {printer.is_default ? 'Unset Default' : 'Set Default'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => startEdit(printer)}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(printer.id)}>
                    <Trash2 className="w-3 h-3" /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Printer Type Reference */}
      <SectionCard title="Printer Type Reference" subtitle="Recommended printer types for each station workflow">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(PRINTER_TYPE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const assignedCount = printers.filter(p => p.type === key).length;
            const defaultPrinter = printers.find(p => p.type === key && p.is_default);
            return (
              <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', cfg.color.split(' ')[0])}>
                  <Icon className={cn('w-4 h-4', cfg.color.split(' ')[1])} />
                </div>
                <div>
                  <h5 className="text-xs font-semibold">{cfg.label}</h5>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cfg.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-medium">{assignedCount} configured</span>
                    {defaultPrinter && (
                      <span className="text-[10px] text-gold">Default: {defaultPrinter.name}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ---- Shipping Companies ----
type ShippingCarrierType = 'express' | 'standard' | 'economy' | 'freight' | 'local';
type ShippingCarrierStatus = 'active' | 'inactive' | 'suspended';

interface ShippingCarrier {
  id: string;
  name: string;
  carrier_code: string;
  type: ShippingCarrierType;
  api_connected: boolean;
  api_key_set: boolean;
  status: ShippingCarrierStatus;
  tracking_url_template: string;
  contact_email: string;
  contact_phone: string;
  account_number: string;
  supported_regions: string[];
  avg_delivery_days: number;
  cost_per_kg_aed: number;
  notes: string;
}

const CARRIER_TYPE_CONFIG: Record<ShippingCarrierType, { label: string; color: string; icon: React.ElementType; description: string }> = {
  express: { label: 'Express', color: 'bg-red-500/15 text-red-600 border-red-500/30', icon: Zap, description: 'Same-day or next-day delivery — premium rate' },
  standard: { label: 'Standard', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: Truck, description: '2-5 business days — standard domestic/regional' },
  economy: { label: 'Economy', color: 'bg-green-500/15 text-green-600 border-green-500/30', icon: Package, description: '5-10 business days — cost-effective option' },
  freight: { label: 'Freight', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30', icon: Ship, description: 'Bulk/heavy shipments — sea or land freight' },
  local: { label: 'Local Courier', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: MapPinIcon, description: 'Same-city delivery — local courier service' },
};

const SUPPORTED_REGIONS = ['UAE', 'GCC', 'Middle East', 'Europe', 'North America', 'Asia', 'Africa', 'Worldwide'];

const DEFAULT_CARRIERS: ShippingCarrier[] = [
  {
    id: 'ship-001', name: 'Aramex', carrier_code: 'ARAMEX', type: 'standard',
    api_connected: true, api_key_set: true, status: 'active',
    tracking_url_template: 'https://www.aramex.com/track/results?ShipmentNumber={tracking}',
    contact_email: 'support@aramex.com', contact_phone: '+971-600-544-000',
    account_number: 'ARX-2026-001', supported_regions: ['UAE', 'GCC', 'Middle East'],
    avg_delivery_days: 3, cost_per_kg_aed: 18,
    notes: 'Primary domestic and GCC carrier — API fully integrated',
  },
  {
    id: 'ship-002', name: 'DHL Express', carrier_code: 'DHL', type: 'express',
    api_connected: true, api_key_set: true, status: 'active',
    tracking_url_template: 'https://www.dhl.com/en/express/tracking.html?AWB={tracking}',
    contact_email: 'express@dhl.com', contact_phone: '+971-800-4004',
    account_number: 'DHL-AE-88712', supported_regions: ['Worldwide'],
    avg_delivery_days: 2, cost_per_kg_aed: 45,
    notes: 'International express — used for premium overseas orders',
  },
  {
    id: 'ship-003', name: 'Emirates Post', carrier_code: 'EMPOST', type: 'economy',
    api_connected: false, api_key_set: false, status: 'active',
    tracking_url_template: 'https://www.epg.gov.ae/track?id={tracking}',
    contact_email: 'info@epg.gov.ae', contact_phone: '+971-600-599-999',
    account_number: 'EP-2026-ME', supported_regions: ['UAE', 'GCC'],
    avg_delivery_days: 5, cost_per_kg_aed: 8,
    notes: 'Economy option — no API integration yet, manual tracking',
  },
  {
    id: 'ship-004', name: 'FedEx', carrier_code: 'FEDEX', type: 'express',
    api_connected: false, api_key_set: false, status: 'inactive',
    tracking_url_template: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
    contact_email: 'support@fedex.com', contact_phone: '+971-800-4050',
    account_number: '', supported_regions: ['Worldwide'],
    avg_delivery_days: 3, cost_per_kg_aed: 42,
    notes: 'Not currently active — pending contract renewal',
  },
  {
    id: 'ship-005', name: 'Fetchr', carrier_code: 'FETCHR', type: 'local',
    api_connected: true, api_key_set: true, status: 'active',
    tracking_url_template: 'https://track.fetchr.us/track/{tracking}',
    contact_email: 'ops@fetchr.us', contact_phone: '+971-4-123-4567',
    account_number: 'FTR-ME-001', supported_regions: ['UAE'],
    avg_delivery_days: 1, cost_per_kg_aed: 12,
    notes: 'Same-day local delivery in Dubai and Abu Dhabi',
  },
];

function ShippingSettings() {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>(DEFAULT_CARRIERS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<ShippingCarrier | null>(null);
  const [filterType, setFilterType] = useState<ShippingCarrierType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ShippingCarrierStatus | 'all'>('all');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<ShippingCarrierType>('standard');
  const [formTrackingUrl, setFormTrackingUrl] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAccount, setFormAccount] = useState('');
  const [formRegions, setFormRegions] = useState<string[]>([]);
  const [formDeliveryDays, setFormDeliveryDays] = useState(3);
  const [formCostPerKg, setFormCostPerKg] = useState(20);
  const [formNotes, setFormNotes] = useState('');

  const resetForm = () => {
    setFormName(''); setFormCode(''); setFormType('standard');
    setFormTrackingUrl(''); setFormEmail(''); setFormPhone('');
    setFormAccount(''); setFormRegions([]); setFormDeliveryDays(3);
    setFormCostPerKg(20); setFormNotes('');
  };

  const startEdit = (c: ShippingCarrier) => {
    setEditingCarrier(c);
    setFormName(c.name); setFormCode(c.carrier_code); setFormType(c.type);
    setFormTrackingUrl(c.tracking_url_template); setFormEmail(c.contact_email);
    setFormPhone(c.contact_phone); setFormAccount(c.account_number);
    setFormRegions(c.supported_regions); setFormDeliveryDays(c.avg_delivery_days);
    setFormCostPerKg(c.cost_per_kg_aed); setFormNotes(c.notes);
    setShowAddForm(true);
  };

  const handleSave = () => {
    if (!formName || !formCode) { toast.error('Name and carrier code are required'); return; }
    if (editingCarrier) {
      setCarriers(prev => prev.map(c => c.id === editingCarrier.id ? {
        ...c, name: formName, carrier_code: formCode, type: formType,
        tracking_url_template: formTrackingUrl, contact_email: formEmail,
        contact_phone: formPhone, account_number: formAccount,
        supported_regions: formRegions, avg_delivery_days: formDeliveryDays,
        cost_per_kg_aed: formCostPerKg, notes: formNotes,
      } : c));
      toast.success(`Updated ${formName}`);
    } else {
      const newCarrier: ShippingCarrier = {
        id: `ship-${Date.now()}`, name: formName, carrier_code: formCode, type: formType,
        api_connected: false, api_key_set: false, status: 'inactive',
        tracking_url_template: formTrackingUrl, contact_email: formEmail,
        contact_phone: formPhone, account_number: formAccount,
        supported_regions: formRegions, avg_delivery_days: formDeliveryDays,
        cost_per_kg_aed: formCostPerKg, notes: formNotes,
      };
      setCarriers(prev => [...prev, newCarrier]);
      toast.success(`Added ${formName}`);
    }
    setShowAddForm(false); setEditingCarrier(null); resetForm();
  };

  const handleDelete = (id: string) => {
    setCarriers(prev => prev.filter(c => c.id !== id));
    toast.success('Shipping company removed');
  };

  const handleToggleStatus = (id: string) => {
    setCarriers(prev => prev.map(c => c.id === id ? {
      ...c, status: c.status === 'active' ? 'inactive' : 'active',
    } : c));
    toast.success('Status updated');
  };

  const handleTestApi = (id: string) => {
    const carrier = carriers.find(c => c.id === id);
    if (!carrier) return;
    if (!carrier.api_key_set) {
      toast.error(`No API key configured for ${carrier.name}`);
      return;
    }
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      { loading: `Testing ${carrier.name} API...`, success: `${carrier.name} API connection successful`, error: 'Connection failed' },
    );
  };

  const toggleRegion = (region: string) => {
    setFormRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
  };

  const filteredCarriers = carriers.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const activeCount = carriers.filter(c => c.status === 'active').length;
  const apiConnectedCount = carriers.filter(c => c.api_connected).length;

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-semibold">{carriers.length}</span>
            <span className="text-muted-foreground"> carriers</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="font-semibold text-success">{activeCount}</span>
            <span className="text-muted-foreground"> active</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="font-semibold text-blue-600">{apiConnectedCount}</span>
            <span className="text-muted-foreground"> API connected</span>
          </div>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setEditingCarrier(null); setShowAddForm(true); }}
          className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Shipping Company
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Type:</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
            className="h-7 px-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30">
            <option value="all">All Types</option>
            {Object.entries(CARRIER_TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Status:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="h-7 px-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <SectionCard title={editingCarrier ? `Edit: ${editingCarrier.name}` : 'Add New Shipping Company'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Company Name *</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="e.g., Aramex" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Carrier Code *</label>
              <input type="text" value={formCode} onChange={e => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g., ARAMEX" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 font-mono" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Service Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as ShippingCarrierType)}
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30">
                {Object.entries(CARRIER_TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account Number</label>
              <input type="text" value={formAccount} onChange={e => setFormAccount(e.target.value)}
                placeholder="e.g., ARX-2026-001" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 font-mono" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Contact Email</label>
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                placeholder="support@carrier.com" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Contact Phone</label>
              <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                placeholder="+971-..." className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Tracking URL Template</label>
              <input type="text" value={formTrackingUrl} onChange={e => setFormTrackingUrl(e.target.value)}
                placeholder="https://carrier.com/track?id={tracking}" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Use {'{tracking}'} as placeholder for the tracking number</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Avg. Delivery Days</label>
              <input type="number" value={formDeliveryDays} onChange={e => setFormDeliveryDays(Number(e.target.value))}
                min={1} max={30} className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cost per KG (AED)</label>
              <input type="number" value={formCostPerKg} onChange={e => setFormCostPerKg(Number(e.target.value))}
                min={0} step={0.5} className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Supported Regions</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SUPPORTED_REGIONS.map(region => (
                  <button key={region} onClick={() => toggleRegion(region)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-full border transition-colors',
                      formRegions.includes(region)
                        ? 'bg-gold/15 text-gold border-gold/30 font-medium'
                        : 'border-border text-muted-foreground hover:border-gold/30',
                    )}>
                    {region}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Notes</label>
              <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)}
                rows={2} placeholder="Internal notes about this carrier..."
                className="mt-1 w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSave}>
              <Save className="w-3.5 h-3.5" /> {editingCarrier ? 'Update Carrier' : 'Add Carrier'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setEditingCarrier(null); resetForm(); }}>Cancel</Button>
          </div>
        </SectionCard>
      )}

      {/* Carrier Cards */}
      {filteredCarriers.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No shipping companies match the current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCarriers.map(carrier => {
            const typeConfig = CARRIER_TYPE_CONFIG[carrier.type];
            const TypeIcon = typeConfig.icon;
            return (
              <div key={carrier.id} className={cn(
                'rounded-lg border p-4 transition-all',
                carrier.status === 'active' ? 'border-green-500/20 bg-green-500/[0.02]' :
                carrier.status === 'suspended' ? 'border-red-500/20 bg-red-500/[0.02]' :
                'border-border opacity-70',
              )}>
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', typeConfig.color.split(' ')[0])}>
                      <TypeIcon className={cn('w-5 h-5', typeConfig.color.split(' ')[1])} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">{carrier.name}</h4>
                        <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{carrier.carrier_code}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{typeConfig.label} · ~{carrier.avg_delivery_days}d · AED {carrier.cost_per_kg_aed}/kg</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {carrier.api_connected && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 border border-blue-500/20">API</span>
                    )}
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full',
                      carrier.status === 'active' ? 'bg-green-500/15 text-green-600' :
                      carrier.status === 'suspended' ? 'bg-red-500/15 text-red-600' :
                      'bg-muted text-muted-foreground',
                    )}>
                      {carrier.status === 'active' ? 'Active' : carrier.status === 'suspended' ? 'Suspended' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Account:</span>{' '}
                    <span className="font-mono font-medium">{carrier.account_number || '—'}</span>
                  </div>
                  <div className="text-[11px]">
                    <span className="text-muted-foreground">Contact:</span>{' '}
                    <span className="font-medium">{carrier.contact_email || '—'}</span>
                  </div>
                  <div className="text-[11px] col-span-2">
                    <span className="text-muted-foreground">Regions:</span>{' '}
                    <span className="font-medium">{carrier.supported_regions.join(', ') || '—'}</span>
                  </div>
                </div>

                {carrier.notes && (
                  <p className="text-[11px] text-muted-foreground italic mb-3">{carrier.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 border-t border-border/50 pt-3">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => handleToggleStatus(carrier.id)}>
                    {carrier.status === 'active' ? <ToggleRight className="w-3 h-3 text-success" /> : <ToggleLeft className="w-3 h-3" />}
                    {carrier.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  {carrier.api_key_set && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => handleTestApi(carrier.id)}>
                      <Zap className="w-3 h-3" /> Test API
                    </Button>
                  )}
                  {!carrier.api_key_set && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1"
                      onClick={() => toast.info(`Configure ${carrier.name} API key in Integrations`)}>
                      <Key className="w-3 h-3" /> Set API Key
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => startEdit(carrier)}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(carrier.id)}>
                    <Trash2 className="w-3 h-3" /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Carrier Type Reference */}
      <SectionCard title="Shipping Service Types" subtitle="Available service tiers and their typical use cases">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(CARRIER_TYPE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const assignedCount = carriers.filter(c => c.type === key).length;
            const activeInType = carriers.filter(c => c.type === key && c.status === 'active').length;
            return (
              <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0', cfg.color.split(' ')[0])}>
                  <Icon className={cn('w-4 h-4', cfg.color.split(' ')[1])} />
                </div>
                <div>
                  <h5 className="text-xs font-semibold">{cfg.label}</h5>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cfg.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-medium">{assignedCount} configured</span>
                    <span className="text-[10px] text-success">{activeInType} active</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ---- Subscription Pricing Settings ----
function SubscriptionPricingSettings() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Base pricing
  const [basePrice, setBasePrice] = useState('149.99');
  const [extraVialPrice, setExtraVialPrice] = useState('75');
  const [minVials, setMinVials] = useState('1');
  const [maxVials, setMaxVials] = useState('4');

  // Surcharge tiers (S0-S5)
  const [surchargePerLevel, setSurchargePerLevel] = useState('25');
  const [baseSurchargeTier, setBaseSurchargeTier] = useState('S0');

  // Discounts
  const [annualDiscount, setAnnualDiscount] = useState('20');
  const [refillDiscount, setRefillDiscount] = useState('10');
  const [capsuleDiscount, setCapsuleDiscount] = useState('15');

  // Subscriber perks
  const [vaultAccessFree, setVaultAccessFree] = useState(true);
  const [exchangesPerYear, setExchangesPerYear] = useState('3');

  // Whisperer vials
  const [whispererVialsPerMonth, setWhispererVialsPerMonth] = useState('2');
  const [whispererVialSize, setWhispererVialSize] = useState('1');

  // First order
  const [firstOrderAtomisers, setFirstOrderAtomisers] = useState('2');
  const [firstOrderCollectionBox, setFirstOrderCollectionBox] = useState(true);

  // Billing terms
  const [billingTerms, setBillingTerms] = useState<string[]>(['monthly', 'annual']);
  const [pauseEnabled, setPauseEnabled] = useState(true);
  const [skipEnabled, setSkipEnabled] = useState(true);
  const [cancelEnabled, setCancelEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.settings.list();
        const s = Object.fromEntries(res.data.map((r: any) => [r.key, r.value]));
        if (s.sub_base_price) setBasePrice(s.sub_base_price);
        if (s.sub_extra_vial_price) setExtraVialPrice(s.sub_extra_vial_price);
        if (s.sub_min_vials) setMinVials(s.sub_min_vials);
        if (s.sub_max_vials) setMaxVials(s.sub_max_vials);
        if (s.sub_surcharge_per_level) setSurchargePerLevel(s.sub_surcharge_per_level);
        if (s.sub_base_surcharge_tier) setBaseSurchargeTier(s.sub_base_surcharge_tier);
        if (s.sub_annual_discount) setAnnualDiscount(s.sub_annual_discount);
        if (s.sub_refill_discount) setRefillDiscount(s.sub_refill_discount);
        if (s.sub_capsule_discount) setCapsuleDiscount(s.sub_capsule_discount);
        if (s.sub_vault_access_free) setVaultAccessFree(s.sub_vault_access_free === 'true');
        if (s.sub_exchanges_per_year) setExchangesPerYear(s.sub_exchanges_per_year);
        if (s.sub_whisperer_vials_per_month) setWhispererVialsPerMonth(s.sub_whisperer_vials_per_month);
        if (s.sub_whisperer_vial_size) setWhispererVialSize(s.sub_whisperer_vial_size);
        if (s.sub_first_order_atomisers) setFirstOrderAtomisers(s.sub_first_order_atomisers);
        if (s.sub_first_order_collection_box) setFirstOrderCollectionBox(s.sub_first_order_collection_box === 'true');
        if (s.sub_billing_terms) setBillingTerms(JSON.parse(s.sub_billing_terms));
        if (s.sub_pause_enabled) setPauseEnabled(s.sub_pause_enabled === 'true');
        if (s.sub_skip_enabled) setSkipEnabled(s.sub_skip_enabled === 'true');
        if (s.sub_cancel_enabled) setCancelEnabled(s.sub_cancel_enabled === 'true');
      } catch { /* defaults */ }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const pairs: Record<string, string> = {
        sub_base_price: basePrice,
        sub_extra_vial_price: extraVialPrice,
        sub_min_vials: minVials,
        sub_max_vials: maxVials,
        sub_surcharge_per_level: surchargePerLevel,
        sub_base_surcharge_tier: baseSurchargeTier,
        sub_annual_discount: annualDiscount,
        sub_refill_discount: refillDiscount,
        sub_capsule_discount: capsuleDiscount,
        sub_vault_access_free: String(vaultAccessFree),
        sub_exchanges_per_year: exchangesPerYear,
        sub_whisperer_vials_per_month: whispererVialsPerMonth,
        sub_whisperer_vial_size: whispererVialSize,
        sub_first_order_atomisers: firstOrderAtomisers,
        sub_first_order_collection_box: String(firstOrderCollectionBox),
        sub_billing_terms: JSON.stringify(billingTerms),
        sub_pause_enabled: String(pauseEnabled),
        sub_skip_enabled: String(skipEnabled),
        sub_cancel_enabled: String(cancelEnabled),
      };
      await api.mutations.settings.setBulk(Object.entries(pairs).map(([key, value]) => ({ key, value })));
      toast.success('Subscription pricing saved');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const inputCls = 'mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30';
  const labelCls = 'text-xs uppercase tracking-wider text-muted-foreground font-medium';

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Base Subscription Pricing */}
      <SectionCard title="AuraKey Subscription — Base Pricing">
        <p className="text-xs text-muted-foreground mb-4">Core subscription pricing structure. Starts from BASE PRICE per month. Every extra vial adds a flat fee.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Base Price (AED/month)</label>
            <input type="number" step="0.01" value={basePrice} onChange={e => setBasePrice(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Extra Vial Price (AED)</label>
            <input type="number" step="0.01" value={extraVialPrice} onChange={e => setExtraVialPrice(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Min Vials per Month</label>
            <input type="number" min="1" max="10" value={minVials} onChange={e => setMinVials(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Max Vials per Month</label>
            <input type="number" min="1" max="10" value={maxVials} onChange={e => setMaxVials(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground">Example: {minVials} vial = {parseFloat(basePrice).toFixed(2)} AED · {maxVials} vials = {(parseFloat(basePrice) + (parseInt(maxVials) - 1) * parseFloat(extraVialPrice)).toFixed(2)} AED</p>
        </div>
      </SectionCard>

      {/* Surcharge Tiers */}
      <SectionCard title="Premium Surcharge (S-Tiers)">
        <p className="text-xs text-muted-foreground mb-4">For premium perfumes (S1–S5), each S-level adds a surcharge on top of the base price. S0 = no surcharge (covered in base).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Surcharge per S-Level (AED)</label>
            <input type="number" step="1" value={surchargePerLevel} onChange={e => setSurchargePerLevel(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Base Surcharge Tier (covered in base)</label>
            <select value={baseSurchargeTier} onChange={e => setBaseSurchargeTier(e.target.value)} className={inputCls}>
              {['S0','S1','S2','S3','S4','S5'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2 text-xs uppercase text-muted-foreground">Tier</th>
              <th className="text-right py-2 text-xs uppercase text-muted-foreground">Surcharge (AED)</th>
              <th className="text-right py-2 text-xs uppercase text-muted-foreground">Total per Vial</th>
            </tr></thead>
            <tbody>
              {['S0','S1','S2','S3','S4','S5'].map((tier, i) => {
                const baseIdx = ['S0','S1','S2','S3','S4','S5'].indexOf(baseSurchargeTier);
                const surcharge = Math.max(0, (i - baseIdx) * parseFloat(surchargePerLevel || '0'));
                return (
                  <tr key={tier} className="border-b border-border/50">
                    <td className="py-2 font-medium">{tier}</td>
                    <td className="py-2 text-right">{surcharge === 0 ? <span className="text-green-500">Included</span> : `+${surcharge} AED`}</td>
                    <td className="py-2 text-right font-medium">{(parseFloat(basePrice) / parseInt(minVials || '1') + surcharge).toFixed(2)} AED</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Discounts */}
      <SectionCard title="Subscriber Discounts">
        <p className="text-xs text-muted-foreground mb-4">All active subscribers receive these discounts across the Maison Em ecosystem.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Annual Discount (paid in full)</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min="0" max="50" value={annualDiscount} onChange={e => setAnnualDiscount(e.target.value)} className={inputCls} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>AuraKey Refill Discount</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min="0" max="50" value={refillDiscount} onChange={e => setRefillDiscount(e.target.value)} className={inputCls} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>AuraKey Capsule Discount</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min="0" max="50" value={capsuleDiscount} onChange={e => setCapsuleDiscount(e.target.value)} className={inputCls} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Whisperer Vials */}
      <SectionCard title="The Whisperer Vials (House Selection)">
        <p className="text-xs text-muted-foreground mb-4">Monthly recurring orders include house-selected 2ml Whisperer vials as a calibration tool for the Taste Graph.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Whisperer Vials per Month</label>
            <input type="number" min="0" max="5" value={whispererVialsPerMonth} onChange={e => setWhispererVialsPerMonth(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vial Size (ml)</label>
            <input type="number" min="1" max="5" value={whispererVialSize} onChange={e => setWhispererVialSize(e.target.value)} className={inputCls} />
          </div>
        </div>
      </SectionCard>

      {/* First Order Includes */}
      <SectionCard title="First Order Includes">
        <p className="text-xs text-muted-foreground mb-4">Items included in the subscriber's first order (onboarding kit).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Atomiser Shells</label>
            <input type="number" min="0" max="5" value={firstOrderAtomisers} onChange={e => setFirstOrderAtomisers(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => setFirstOrderCollectionBox(!firstOrderCollectionBox)} className="text-muted-foreground hover:text-foreground">
              {firstOrderCollectionBox ? <ToggleRight className="w-8 h-5 text-gold" /> : <ToggleLeft className="w-8 h-5" />}
            </button>
            <span className="text-sm">Vials Collection Box (Empty)</span>
          </div>
        </div>
      </SectionCard>

      {/* Subscriber Perks */}
      <SectionCard title="Subscriber Perks">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setVaultAccessFree(!vaultAccessFree)} className="text-muted-foreground hover:text-foreground">
              {vaultAccessFree ? <ToggleRight className="w-8 h-5 text-gold" /> : <ToggleLeft className="w-8 h-5" />}
            </button>
            <span className="text-sm">Complimentary Em.Vault Access</span>
          </div>
          <div>
            <label className={labelCls}>Vial Exchanges per Year</label>
            <input type="number" min="0" max="12" value={exchangesPerYear} onChange={e => setExchangesPerYear(e.target.value)} className={inputCls} />
          </div>
        </div>
      </SectionCard>

      {/* Billing & Flexibility */}
      <SectionCard title="Billing & Flexibility">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Billing Terms</label>
            <div className="flex gap-3 mt-2">
              {['monthly', 'annual'].map(term => (
                <label key={term} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={billingTerms.includes(term)} onChange={e => {
                    if (e.target.checked) setBillingTerms([...billingTerms, term]);
                    else setBillingTerms(billingTerms.filter(t => t !== term));
                  }} className="rounded border-input" />
                  <span className="capitalize">{term}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Subscriber Controls</label>
            <div className="flex flex-col gap-2 mt-2">
              {[
                { label: 'Pause a month', state: pauseEnabled, setter: setPauseEnabled },
                { label: 'Skip a month', state: skipEnabled, setter: setSkipEnabled },
                { label: 'Cancel anytime', state: cancelEnabled, setter: setCancelEnabled },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <button onClick={() => item.setter(!item.state)} className="text-muted-foreground hover:text-foreground">
                    {item.state ? <ToggleRight className="w-7 h-4 text-gold" /> : <ToggleLeft className="w-7 h-4" />}
                  </button>
                  <span className="text-sm">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Annual: all applies T&C. Pause, Skip, Cancel available per billing term rules.</p>
      </SectionCard>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Subscription Pricing
        </Button>
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <SectionCard title="Company Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Company Name</label>
            <input type="text" defaultValue="Maison Em" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Brand Name</label>
            <input type="text" defaultValue="Maison Em" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Default Currency</label>
            <input type="text" defaultValue="AED" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Timezone</label>
            <input type="text" defaultValue="Asia/Dubai (GMT+4)" className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>
        </div>
        <Button size="sm" className="mt-4 bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
          onClick={() => toast.success('Settings saved')}>
          <Save className="w-3.5 h-3.5" /> Save Changes
        </Button>
      </SectionCard>

      <SectionCard title="Operations & Defaults" subtitle="Operations settings have moved to System Setup">
        <p className="text-sm text-muted-foreground">
          Operations Config and Operational Defaults are now managed under <span className="font-semibold text-foreground">System Setup</span> in the sidebar.
        </p>
      </SectionCard>
    </div>
  );
}

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin?: string;
  joinedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  system_architect: 'System Architect',
  inventory_admin: 'Inventory Admin',
  qc: 'QC Inspector',
  viewer: 'Viewer',
  vault_guardian: 'Vault Guardian',
  pod_junior: 'Pod Junior Member',
  pod_leader: 'Pod Leader',
  pod_senior: 'Pod Senior Member',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full system access. Can manage all settings, users, and data.',
  admin: 'Full operational access. Can manage users and configure the system.',
  system_architect: 'Designs BOM structures, master data, inventory config, and system architecture. Access to reports and setup guides.',
  inventory_admin: 'Manages inventory, procurement, stock operations, and master data. Access to ledger and cost reports.',
  qc: 'Quality control at S4 Batch Decanting and S5 Fulfillment. Read access to orders, inventory, and reports.',
  viewer: 'Read-only access to dashboard, orders, inventory, ledger, and reports.',
  vault_guardian: 'Manages bottle check-out/check-in, vault inventory, procurement, and master data.',
  pod_junior: 'Junior pod member. Operates pod stations under supervision. Access to assigned pod operations, print queue, and orders.',
  pod_leader: 'Pod leader. Manages pod operations, job allocation, team coordination, and performance oversight.',
  pod_senior: 'Senior pod member. Operates all pod stations independently. Manual decant, print queue, and order access.',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  admin: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  system_architect: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  inventory_admin: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  qc: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
  viewer: 'bg-slate-500/15 text-slate-600 border-slate-500/30',
  vault_guardian: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  pod_junior: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
  pod_leader: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
  pod_senior: 'bg-teal-500/15 text-teal-600 border-teal-500/30',
};

const ASSIGNABLE_ROLES = ['admin', 'system_architect', 'inventory_admin', 'qc', 'viewer', 'vault_guardian', 'pod_leader', 'pod_senior', 'pod_junior'];

function UsersSettings() {
  const [users, setUsers] = useState<TeamUser[]>([
    { id: 'u1', fullName: 'Karim Morcos', email: 'karim@maisonem.com', role: 'owner', active: true, lastLogin: '2026-02-14 09:15', joinedAt: '2025-01-01' },
    { id: 'u2', fullName: 'Ops Manager', email: 'ops@maisonem.com', role: 'admin', active: true, lastLogin: '2026-02-14 08:30', joinedAt: '2025-01-15' },
    { id: 'u3', fullName: 'Ahmed K.', email: 'ahmed@maisonem.com', role: 'system_architect', active: true, lastLogin: '2026-02-13 17:00', joinedAt: '2025-02-01' },
    { id: 'u4', fullName: 'Sara M.', email: 'sara@maisonem.com', role: 'inventory_admin', active: true, lastLogin: '2026-02-14 07:45', joinedAt: '2025-03-01' },
    { id: 'u5', fullName: 'Layla B.', email: 'layla@maisonem.com', role: 'vault_guardian', active: true, lastLogin: '2026-02-14 10:00', joinedAt: '2025-02-15' },
    { id: 'u6', fullName: 'Khalid R.', email: 'khalid@maisonem.com', role: 'pod_junior', active: true, lastLogin: '2026-02-13 16:30', joinedAt: '2025-04-01' },
    { id: 'u9', fullName: 'Fatima A.', email: 'fatima@maisonem.com', role: 'pod_senior', active: true, lastLogin: '2026-02-14 11:00', joinedAt: '2025-03-15' },
    { id: 'u10', fullName: 'Nadia H.', email: 'nadia@maisonem.com', role: 'pod_leader', active: true, lastLogin: '2026-02-14 08:00', joinedAt: '2025-02-01' },
    { id: 'u7', fullName: 'QC Inspector', email: 'qc@maisonem.com', role: 'qc', active: false, lastLogin: '2026-02-10 14:00', joinedAt: '2025-05-01' },
    { id: 'u8', fullName: 'Board Viewer', email: 'viewer@maisonem.com', role: 'viewer', active: true, lastLogin: '2026-02-12 11:00', joinedAt: '2025-06-01' },
  ]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const handleRoleChange = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: editRole } : u));
    setEditingUser(null);
    toast.success(`Role updated to ${ROLE_LABELS[editRole]}`);
  };

  const handleToggleActive = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !u.active } : u));
    const user = users.find(u => u.id === userId);
    toast.success(`${user?.fullName} ${user?.active ? 'deactivated' : 'activated'}`);
  };

  const handleInvite = () => {
    if (!inviteName || !inviteEmail) { toast.error('Name and email required'); return; }
    const newUser: TeamUser = {
      id: `u${Date.now()}`,
      fullName: inviteName,
      email: inviteEmail,
      role: inviteRole,
      active: true,
      joinedAt: new Date().toISOString().split('T')[0],
    };
    setUsers(prev => [...prev, newUser]);
    setShowInvite(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('viewer');
    toast.success(`Invited ${inviteName} as ${ROLE_LABELS[inviteRole]}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Team Members</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{users.filter(u => u.active).length} active of {users.length} total</p>
        </div>
        <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
          onClick={() => setShowInvite(!showInvite)}>
          <Plus className="w-3.5 h-3.5" /> Invite User
        </Button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <SectionCard title="Invite New Team Member">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Full Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="e.g., John Smith"
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="e.g., john@maisonem.com"
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
              >
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">{ROLE_DESCRIPTIONS[inviteRole]}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleInvite}>
              <Plus className="w-3.5 h-3.5" /> Send Invite
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
          </div>
        </SectionCard>
      )}

      {/* Users Table */}
      <SectionCard title="">
        <table className="w-full ops-table">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Name</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Email</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Role</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Last Login</th>
              <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Status</th>
              <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center text-[10px] font-bold text-gold">
                      {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium">{u.fullName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2.5">
                  {editingUser === u.id ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        className="h-7 px-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30"
                      >
                        {ASSIGNABLE_ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleRoleChange(u.id)}>
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingUser(null)}>
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className={cn('inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border', ROLE_COLORS[u.role] || ROLE_COLORS.viewer)}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.lastLogin || '—'}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge variant={u.active ? 'success' : 'muted'}>{u.active ? 'Active' : 'Inactive'}</StatusBadge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {u.role !== 'owner' && (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                        onClick={() => { setEditingUser(u.id); setEditRole(u.role); }}>
                        Change Role
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                        onClick={() => handleToggleActive(u.id)}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {/* Role Reference */}
      <SectionCard title="Role Reference" subtitle="Click a role to see its access permissions">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setExpandedRole(expandedRole === key ? null : key)}
              className={cn(
                'text-left p-3 rounded-lg border transition-all',
                expandedRole === key
                  ? 'ring-2 ring-gold/40 border-gold/30 bg-gold/5'
                  : 'border-border hover:border-gold/20 hover:bg-muted/30',
              )}
            >
              <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border mb-1.5', ROLE_COLORS[key] || ROLE_COLORS.viewer)}>
                {label}
              </span>
              <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_DESCRIPTIONS[key]}</p>
            </button>
          ))}
        </div>

        {expandedRole && (
          <div className="mt-4 p-4 rounded-lg border border-gold/20 bg-gold/5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-gold" />
              <h4 className="text-sm font-semibold">{ROLE_LABELS[expandedRole]} — Access Matrix</h4>
            </div>
            <RoleAccessMatrix role={expandedRole} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function RoleAccessMatrix({ role }: { role: string }) {
  const modules = [
    { name: 'Welcome', key: 'welcome' },
    { name: 'Ops Dashboard', key: 'dashboard' },
    { name: 'Job Management', key: 'job_mgmt' },
    { name: 'Pod Operations', key: 'stations' },
    { name: 'Manual Decant', key: 'manual_decant' },
    { name: 'Orders / CRM', key: 'orders' },
    { name: 'Inventory', key: 'inventory' },
    { name: 'Master Data', key: 'master_data' },
    { name: 'Procurement', key: 'procurement' },
    { name: 'BOM Setup', key: 'bom' },
    { name: 'Ledger', key: 'ledger' },
    { name: 'Reports', key: 'reports' },
    { name: 'Setup Guides', key: 'guides' },
    { name: 'Settings', key: 'settings' },
  ];

  // Round 23: Corrected access matrix
  const access: Record<string, Record<string, 'full' | 'read' | 'none'>> = {
    owner:                   { welcome: 'full', dashboard: 'full', job_mgmt: 'full', stations: 'full', manual_decant: 'full', orders: 'full', inventory: 'full', master_data: 'full', procurement: 'full', bom: 'full', ledger: 'full', reports: 'full', guides: 'full', settings: 'full' },
    admin:                   { welcome: 'full', dashboard: 'full', job_mgmt: 'full', stations: 'full', manual_decant: 'full', orders: 'full', inventory: 'full', master_data: 'full', procurement: 'full', bom: 'full', ledger: 'full', reports: 'full', guides: 'full', settings: 'full' },
    system_architect:        { welcome: 'full', dashboard: 'read', job_mgmt: 'none', stations: 'none', manual_decant: 'none', orders: 'none', inventory: 'read', master_data: 'full', procurement: 'none', bom: 'full', ledger: 'read', reports: 'read', guides: 'full', settings: 'read' },
    inventory_admin:         { welcome: 'full', dashboard: 'read', job_mgmt: 'none', stations: 'none', manual_decant: 'none', orders: 'none', inventory: 'full', master_data: 'full', procurement: 'full', bom: 'none', ledger: 'read', reports: 'read', guides: 'none', settings: 'none' },
    qc:                      { welcome: 'full', dashboard: 'read', job_mgmt: 'none', stations: 'read', manual_decant: 'none', orders: 'read', inventory: 'read', master_data: 'none', procurement: 'none', bom: 'none', ledger: 'none', reports: 'read', guides: 'none', settings: 'none' },
    viewer:                  { welcome: 'full', dashboard: 'read', job_mgmt: 'none', stations: 'none', manual_decant: 'none', orders: 'read', inventory: 'read', master_data: 'none', procurement: 'none', bom: 'none', ledger: 'read', reports: 'read', guides: 'none', settings: 'none' },
    vault_guardian:           { welcome: 'full', dashboard: 'none', job_mgmt: 'read', stations: 'none', manual_decant: 'none', orders: 'none', inventory: 'full', master_data: 'full', procurement: 'full', bom: 'none', ledger: 'read', reports: 'none', guides: 'none', settings: 'none' },
    pod_junior:  { welcome: 'full', dashboard: 'none', job_mgmt: 'read', stations: 'full', manual_decant: 'none', orders: 'read', inventory: 'read', master_data: 'none', procurement: 'none', bom: 'none', ledger: 'none', reports: 'none', guides: 'none', settings: 'none' },
    pod_leader:      { welcome: 'full', dashboard: 'full', job_mgmt: 'full', stations: 'full', manual_decant: 'full', orders: 'read', inventory: 'read', master_data: 'none', procurement: 'none', bom: 'none', ledger: 'read', reports: 'full', guides: 'none', settings: 'none' },
    pod_senior:       { welcome: 'full', dashboard: 'none', job_mgmt: 'read', stations: 'full', manual_decant: 'full', orders: 'read', inventory: 'read', master_data: 'none', procurement: 'none', bom: 'none', ledger: 'none', reports: 'none', guides: 'none', settings: 'none' },
  };

  const roleAccess = access[role] || access.viewer;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
      {modules.map(m => {
        const level = roleAccess[m.key] || 'none';
        return (
          <div key={m.key} className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs',
            level === 'full' ? 'bg-emerald-500/10 text-emerald-600' :
            level === 'read' ? 'bg-blue-500/10 text-blue-600' :
            'bg-muted/30 text-muted-foreground line-through',
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              level === 'full' ? 'bg-emerald-500' : level === 'read' ? 'bg-blue-500' : 'bg-muted-foreground/30',
            )} />
            {m.name}
            <span className="ml-auto text-[9px] font-medium uppercase opacity-70">
              {level === 'full' ? 'Full' : level === 'read' ? 'Read' : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function IntegrationsSettings() {
  const integrations = [
    { name: 'Shopify', desc: 'Order sync, product management, and storefront', icon: Globe, connected: true, category: 'Commerce' },
    { name: 'Zoho Books', desc: 'Accounting, invoicing, and financial reporting', icon: Database, connected: false, category: 'Finance' },
    { name: 'Slack', desc: 'Team communication and operational alerts', icon: Bell, connected: false, category: 'Communication' },
    { name: 'Monday.com', desc: 'Task management and project tracking', icon: Key, connected: false, category: 'Productivity' },
    { name: 'Power BI', desc: 'Business intelligence and advanced analytics dashboards', icon: Database, connected: false, category: 'Analytics' },
    { name: 'Supabase', desc: 'Database backend, real-time subscriptions, and authentication', icon: Database, connected: false, category: 'Infrastructure' },
    { name: 'LabelLive', desc: 'Cloud label design and printing platform — connects to your printer fleet for automated label generation', icon: PrinterIcon, connected: false, category: 'Printing' },
    { name: 'Webhooks', desc: 'Custom event notifications to external services', icon: Webhook, connected: false, category: 'Developer' },
    { name: 'APIs', desc: 'REST API access for custom integrations and automation', icon: Key, connected: false, category: 'Developer' },
  ];

  return (
    <div className="space-y-4">
      {integrations.map(i => (
        <SectionCard key={i.name} title="">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <i.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{i.name}</h4>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {i.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant={i.connected ? 'success' : 'muted'}>
                {i.connected ? 'Connected' : 'Not Connected'}
              </StatusBadge>
              <Button size="sm" variant="outline"
                onClick={() => toast.info(`${i.name} integration — coming soon`)}>
                {i.connected ? 'Configure' : 'Connect'}
              </Button>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}


function NotificationsSettings() {
  const channels = [
    { event: 'Low Stock Alert', email: true, push: true, slack: false },
    { event: 'Order Received', email: true, push: false, slack: true },
    { event: 'Batch Completed', email: false, push: true, slack: true },
    { event: 'QC Failure', email: true, push: true, slack: true },
    { event: 'Shipping Dispatched', email: true, push: false, slack: false },
  ];

  return (
    <SectionCard title="Notification Channels">
      <table className="w-full ops-table">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Event</th>
            <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Email</th>
            <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Push</th>
            <th className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Slack</th>
          </tr>
        </thead>
        <tbody>
          {channels.map(c => (
            <tr key={c.event} className="border-b border-border/50">
              <td className="px-3 py-2 text-sm">{c.event}</td>
              <td className="px-3 py-2 text-center">
                <input type="checkbox" defaultChecked={c.email} className="w-4 h-4 accent-gold" />
              </td>
              <td className="px-3 py-2 text-center">
                <input type="checkbox" defaultChecked={c.push} className="w-4 h-4 accent-gold" />
              </td>
              <td className="px-3 py-2 text-center">
                <input type="checkbox" defaultChecked={c.slack} className="w-4 h-4 accent-gold" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

function AuditLog() {
  const logs = [
    { ts: '2025-02-06 14:32', user: 'Em', action: 'Created batch JOB-2025-001', type: 'create' },
    { ts: '2025-02-06 13:15', user: 'Ops Manager', action: 'Updated stock for BTL-001', type: 'update' },
    { ts: '2025-02-06 12:00', user: 'Vault Operator', action: 'Completed decant session', type: 'complete' },
    { ts: '2025-02-06 11:45', user: 'System', action: 'Auto-generated subscription cycle CYC-2025-02', type: 'system' },
    { ts: '2025-02-06 10:30', user: 'Em', action: 'Registered new bottle BTL-007', type: 'create' },
    { ts: '2025-02-05 16:00', user: 'Fulfillment Lead', action: 'Shipped order ORD-2025-004', type: 'complete' },
  ];

  return (
    <SectionCard title="Recent Activity">
      <div className="space-y-0">
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
            <div className={cn(
              'w-2 h-2 rounded-full mt-1.5 shrink-0',
              l.type === 'create' ? 'bg-gold' : l.type === 'update' ? 'bg-blue-500' : l.type === 'complete' ? 'bg-green-500' : 'bg-muted-foreground',
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{l.action}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{l.user} · {l.ts}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}


// ---- Role Preview ----
function RolePreview() {
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const ALL_ROLES = Object.keys(ROLE_LABELS);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Role Preview</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Preview what each role sees on their Welcome page without logging out. Select a role below to see their personalized dashboard.
        </p>
      </div>

      {/* Role Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ALL_ROLES.map(role => {
          const isActive = previewRole === role;
          return (
            <button
              key={role}
              onClick={() => setPreviewRole(isActive ? null : role)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                isActive
                  ? 'border-gold bg-gold/5 shadow-md'
                  : 'border-border hover:border-gold/30 hover:bg-muted/30',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                ROLE_COLORS[role] || 'bg-muted text-muted-foreground',
              )}>
                {ROLE_LABELS[role]?.charAt(0) || '?'}
              </div>
              <span className="text-xs font-medium leading-tight">{ROLE_LABELS[role]}</span>
              {isActive && (
                <span className="text-[9px] text-gold font-medium uppercase tracking-wider">Previewing</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Preview Banner + Description */}
      {previewRole && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gold/10 border border-gold/20">
            <Eye className="w-5 h-5 text-gold shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Previewing as <strong>{ROLE_LABELS[previewRole]}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ROLE_DESCRIPTIONS[previewRole]}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-gold/30 text-gold hover:bg-gold/5"
              onClick={() => setPreviewRole(null)}
            >
              Exit Preview
            </Button>
          </div>

          {/* Role Details Card */}
          <SectionCard title={`${ROLE_LABELS[previewRole]} — Access Summary`}>
            <div className="space-y-4">
              {/* Permissions */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Permissions</h4>
                <div className="flex flex-wrap gap-1.5">
                  {getRolePermissions(previewRole).map(perm => (
                    <span key={perm} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200/50 dark:border-emerald-800/30">
                      <CheckCircle2Icon className="w-2.5 h-2.5" />
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick Actions Preview */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Welcome Page Quick Actions</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {getRoleQuickActions(previewRole).map(action => (
                    <div key={action} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/50">
                      <Sparkles className="w-3 h-3 text-gold" />
                      <span className="text-[11px] font-medium">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modules Preview */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Accessible Modules</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {getRoleModules(previewRole).map(mod => (
                    <div key={mod} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/30 dark:border-blue-800/20">
                      <Package className="w-3 h-3 text-blue-500" />
                      <span className="text-[11px] font-medium">{mod}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {!previewRole && (
        <div className="text-center py-8 text-muted-foreground">
          <Eye className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium">Select a role above to preview</p>
          <p className="text-xs mt-1">See what each team member experiences on their Welcome page</p>
        </div>
      )}
    </div>
  );
}

// Helper: get permissions for a role
function getRolePermissions(role: string): string[] {
  const permMap: Record<string, string[]> = {
    owner: ['Full Access', 'All Modules', 'User Management', 'System Config'],
    admin: ['Full Access', 'All Modules', 'User Management', 'System Config'],
    system_architect: ['BOM Design', 'Master Data', 'Inventory (read)', 'Settings', 'Ledger', 'Dashboard', 'Reports'],
    inventory_admin: ['Station 0', 'Inventory', 'Procurement', 'Master Data', 'Ledger', 'Dashboard', 'Reports'],
    qc: ['Station 4', 'Station 5', 'Orders (read)', 'Inventory (read)', 'Dashboard', 'Reports'],
    viewer: ['Dashboard (read)', 'Orders (read)', 'Inventory (read)', 'Ledger (read)', 'Reports'],
    vault_guardian: ['Station 0', 'Vault Ledger', 'Procurement', 'Master Data', 'Inventory'],
    pod_junior: ['Pod Dashboard', 'Assigned Pod Ops', 'Orders (read)', 'Print Queue'],
    pod_leader: ['Pod Dashboard', 'All Pod Ops', 'Job Allocation', 'Dashboard', 'Reports', 'Team Mgmt'],
    pod_senior: ['Pod Dashboard', 'All Pod Ops', 'Manual Decant', 'Orders (read)', 'Print Queue'],
  };
  return permMap[role] || [];
}

// Helper: get quick actions for a role
function getRoleQuickActions(role: string): string[] {
  const actionMap: Record<string, string[]> = {
    owner: ['New Order', 'Pod Dashboard', 'Dashboard', 'BOM Setup', 'Inventory', 'Procurement', 'Reports', 'Settings'],
    admin: ['New Order', 'Pod Dashboard', 'Dashboard', 'BOM Setup', 'Inventory', 'Procurement', 'Reports', 'Settings'],
    system_architect: ['BOM Templates', 'End Products', 'Master Data', 'Aura Definitions', 'Pricing', 'Families'],
    inventory_admin: ['Sealed Vault', 'Decanting Pool', 'Procurement', 'PO Management', 'Master Data', 'Ledger'],
    qc: ['Batch Decant', 'Fulfillment', 'Orders', 'Inventory', 'Daily Ops', 'Ops Dashboard'],
    viewer: ['Ops Dashboard', 'Orders', 'Ledger', 'Daily Ops'],
    vault_guardian: ['Sealed Vault', 'Decanting Pool', 'Check-In', 'Check-Out', 'Procurement', 'PO Mgmt'],
    pod_junior: ['Pod Dashboard', 'Assigned Ops', 'Print Queue', 'Orders'],
    pod_leader: ['Pod Dashboard', 'Job Allocation', 'Manual Decant', 'Dashboard', 'Reports'],
    pod_senior: ['Pod Dashboard', 'All Pod Ops', 'Manual Decant', 'Print Queue'],
  };
  return actionMap[role] || [];
}

// Helper: get modules for a role
function getRoleModules(role: string): string[] {
  const modMap: Record<string, string[]> = {
    owner: ['Dashboard', 'Orders & CRM', 'Inventory', 'Stations', 'BOM', 'Procurement', 'Reports', 'Settings'],
    admin: ['Dashboard', 'Orders & CRM', 'Inventory', 'Stations', 'BOM', 'Procurement', 'Reports', 'Settings'],
    system_architect: ['BOM Builder', 'End Products', 'Master Data', 'Pricing Engine', 'Inventory', 'Reports'],
    inventory_admin: ['Sealed Vault', 'Decanting Pool', 'Procurement', 'Master Data', 'Ledger', 'Reports'],
    qc: ['Batch Decant', 'Fulfillment', 'Orders & CRM', 'Inventory'],
    viewer: ['Ops Dashboard', 'Orders & CRM', 'Financial Ledger', 'Reports'],
    vault_guardian: ['Sealed Vault', 'Decanting Pool', 'Procurement', 'Master Data'],
    pod_junior: ['Pod Dashboard', 'Assigned Ops', 'Print Queue', 'Orders'],
    pod_leader: ['Pod Dashboard', 'All Pod Ops', 'Job Allocation', 'Dashboard', 'Reports'],
    pod_senior: ['Pod Dashboard', 'All Pod Ops', 'Manual Decant', 'Print Queue'],
  };
  return modMap[role] || [];
}
