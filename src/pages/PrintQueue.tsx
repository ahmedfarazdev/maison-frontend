// ============================================================
// Print Job Queue — Live print queue per pod
// Design: "Maison Ops" — enterprise operations view
// Features: Pod tabs, job status workflow, reprint, history
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, KPICard, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Printer, RefreshCcw, Search, Filter, Clock, CheckCircle2,
  XCircle, Loader2, RotateCcw, Trash2, Eye, ChevronDown, ChevronUp,
  Tag, MapPin, FileText, Package, AlertTriangle, Wifi, WifiOff,
  Play, Pause, SkipForward, Calendar, ArrowUpDown, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ---- Types ----
type JobStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';
type PrintJobType = 'product_label' | 'shipping_label' | 'insert_card' | 'packing_list' | 'manifest' | 'thank_you_card';
type PrinterType = 'labels' | 'shipping' | 'inserts' | 'general';

interface PrintJob {
  id: string;
  order_id: string;
  customer_name: string;
  job_type: PrintJobType;
  printer_id: string;
  printer_name: string;
  printer_type: PrinterType;
  station: string;
  status: JobStatus;
  copies: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retries: number;
  priority: 'normal' | 'high' | 'urgent';
  label_details?: string;
}

interface PrinterInfo {
  id: string;
  name: string;
  type: PrinterType;
  status: 'online' | 'offline' | 'error';
  station: string;
  active_job?: string;
  queue_length: number;
}

// ---- Constants ----
const JOB_TYPE_CONFIG: Record<PrintJobType, { label: string; icon: React.ElementType; color: string }> = {
  product_label: { label: 'Product Label', icon: Tag, color: 'text-blue-600 bg-blue-500/10' },
  shipping_label: { label: 'Shipping Label', icon: MapPin, color: 'text-amber-600 bg-amber-500/10' },
  insert_card: { label: 'Insert Card', icon: FileText, color: 'text-purple-600 bg-purple-500/10' },
  packing_list: { label: 'Packing List', icon: Package, color: 'text-emerald-600 bg-emerald-500/10' },
  manifest: { label: 'Manifest', icon: FileText, color: 'text-zinc-600 bg-zinc-500/10' },
  thank_you_card: { label: 'Thank You Card', icon: FileText, color: 'text-pink-600 bg-pink-500/10' },
};

const STATUS_CONFIG: Record<JobStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  queued: { label: 'Queued', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
  printing: { label: 'Printing', icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'text-muted-foreground bg-muted' },
  high: { label: 'High', color: 'text-amber-600 bg-amber-500/10' },
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-500/10' },
};

const STATION_TABS = [
  { id: 'all', label: 'All Pods' },
  { id: 'stock', label: 'Stock Register' },
  { id: 'pod-dashboard', label: 'Pod Dashboard' },
  { id: 'picking', label: 'Picking' },
  { id: 'labeling', label: 'Labeling' },
  { id: 'decanting', label: 'Decanting' },
  { id: 'qc-assembly', label: 'QC & Assembly' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'manual-decant', label: 'Manual Decant' },
];

// ---- Mock Data ----
const now = new Date();
const fmt = (d: Date) => d.toISOString();
const ago = (mins: number) => new Date(now.getTime() - mins * 60000);

const MOCK_PRINTERS: PrinterInfo[] = [
  { id: 'prt-001', name: 'Brother QL-820NWB', type: 'labels', status: 'online', station: 'labeling', active_job: 'pj-001', queue_length: 3 },
  { id: 'prt-002', name: 'Zebra ZD421', type: 'shipping', status: 'online', station: 'shipping', active_job: 'pj-005', queue_length: 2 },
  { id: 'prt-003', name: 'Epson TM-T88VI', type: 'inserts', status: 'offline', station: 'labeling', queue_length: 0 },
  { id: 'prt-004', name: 'HP LaserJet Pro', type: 'general', status: 'online', station: 'all', queue_length: 1 },
];

const MOCK_JOBS: PrintJob[] = [
  // Currently printing
  {
    id: 'pj-001', order_id: 'ORD-2025-0147', customer_name: 'Layla Bitar',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'printing', copies: 3,
    created_at: fmt(ago(8)), started_at: fmt(ago(2)), retries: 0, priority: 'normal',
    label_details: 'Aventus 10ml × 2, Baccarat Rouge 5ml × 1',
  },
  // Queued jobs
  {
    id: 'pj-002', order_id: 'ORD-2025-0148', customer_name: 'Mona Al-Faisal',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'queued', copies: 4,
    created_at: fmt(ago(6)), retries: 0, priority: 'high',
    label_details: 'Oud Wood 20ml × 1, Tobacco Vanille 10ml × 2, Lost Cherry 5ml × 1',
  },
  {
    id: 'pj-003', order_id: 'ORD-2025-0149', customer_name: 'Hassan Jaber',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'queued', copies: 2,
    created_at: fmt(ago(4)), retries: 0, priority: 'normal',
    label_details: 'Sauvage Elixir 10ml × 1, Bleu de Chanel 10ml × 1',
  },
  {
    id: 'pj-004', order_id: 'ORD-2025-0150', customer_name: 'Sara Khalil',
    job_type: 'insert_card', printer_id: 'prt-003', printer_name: 'Epson TM-T88VI',
    printer_type: 'inserts', station: 'labeling', status: 'queued', copies: 1,
    created_at: fmt(ago(3)), retries: 0, priority: 'normal',
    label_details: 'Thank-you insert for Aura Key subscriber',
  },
  // Shipping labels
  {
    id: 'pj-005', order_id: 'ORD-2025-0147', customer_name: 'Layla Bitar',
    job_type: 'shipping_label', printer_id: 'prt-002', printer_name: 'Zebra ZD421',
    printer_type: 'shipping', station: 'shipping', status: 'printing', copies: 1,
    created_at: fmt(ago(5)), started_at: fmt(ago(1)), retries: 0, priority: 'normal',
    label_details: 'Aramex — Dubai, UAE',
  },
  {
    id: 'pj-006', order_id: 'ORD-2025-0148', customer_name: 'Mona Al-Faisal',
    job_type: 'shipping_label', printer_id: 'prt-002', printer_name: 'Zebra ZD421',
    printer_type: 'shipping', station: 'shipping', status: 'queued', copies: 1,
    created_at: fmt(ago(3)), retries: 0, priority: 'high',
    label_details: 'DHL Express — Riyadh, KSA',
  },
  // Packing list
  {
    id: 'pj-007', order_id: 'ORD-2025-0147', customer_name: 'Layla Bitar',
    job_type: 'packing_list', printer_id: 'prt-004', printer_name: 'HP LaserJet Pro',
    printer_type: 'general', station: 'qc-assembly', status: 'queued', copies: 1,
    created_at: fmt(ago(7)), retries: 0, priority: 'normal',
    label_details: 'Packing list — 3 items',
  },
  // Failed job
  {
    id: 'pj-008', order_id: 'ORD-2025-0145', customer_name: 'Ahmad Nassar',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'failed', copies: 2,
    created_at: fmt(ago(45)), started_at: fmt(ago(44)), retries: 2, priority: 'normal',
    error_message: 'Paper jam — clear tray and retry',
    label_details: 'Interlude Man 10ml × 2',
  },
  // Completed jobs (history)
  {
    id: 'pj-009', order_id: 'ORD-2025-0140', customer_name: 'Nadia Haddad',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'completed', copies: 5,
    created_at: fmt(ago(120)), started_at: fmt(ago(119)), completed_at: fmt(ago(118)), retries: 0, priority: 'normal',
    label_details: 'Aventus 10ml × 3, Layton 5ml × 2',
  },
  {
    id: 'pj-010', order_id: 'ORD-2025-0141', customer_name: 'Omar Farouk',
    job_type: 'shipping_label', printer_id: 'prt-002', printer_name: 'Zebra ZD421',
    printer_type: 'shipping', station: 'shipping', status: 'completed', copies: 1,
    created_at: fmt(ago(110)), started_at: fmt(ago(109)), completed_at: fmt(ago(108)), retries: 0, priority: 'normal',
    label_details: 'Aramex — Abu Dhabi, UAE',
  },
  {
    id: 'pj-011', order_id: 'ORD-2025-0142', customer_name: 'Reem Al-Sabah',
    job_type: 'insert_card', printer_id: 'prt-003', printer_name: 'Epson TM-T88VI',
    printer_type: 'inserts', station: 'labeling', status: 'completed', copies: 1,
    created_at: fmt(ago(100)), started_at: fmt(ago(99)), completed_at: fmt(ago(98)), retries: 0, priority: 'normal',
    label_details: 'Welcome card — new subscriber',
  },
  {
    id: 'pj-012', order_id: 'ORD-2025-0143', customer_name: 'Khalid Mansour',
    job_type: 'packing_list', printer_id: 'prt-004', printer_name: 'HP LaserJet Pro',
    printer_type: 'general', station: 'qc-assembly', status: 'completed', copies: 1,
    created_at: fmt(ago(95)), started_at: fmt(ago(94)), completed_at: fmt(ago(93)), retries: 0, priority: 'normal',
    label_details: 'Packing list — 6 items',
  },
  {
    id: 'pj-013', order_id: 'ORD-2025-0144', customer_name: 'Fatima Zayed',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'completed', copies: 3,
    created_at: fmt(ago(85)), started_at: fmt(ago(84)), completed_at: fmt(ago(83)), retries: 0, priority: 'high',
    label_details: 'BR540 Extrait 10ml × 1, Oud Satin Mood 5ml × 2',
  },
  {
    id: 'pj-014', order_id: 'ORD-2025-0139', customer_name: 'Youssef Karam',
    job_type: 'shipping_label', printer_id: 'prt-002', printer_name: 'Zebra ZD421',
    printer_type: 'shipping', station: 'shipping', status: 'completed', copies: 1,
    created_at: fmt(ago(150)), started_at: fmt(ago(149)), completed_at: fmt(ago(148)), retries: 0, priority: 'normal',
    label_details: 'FedEx — Doha, Qatar',
  },
  // Cancelled
  {
    id: 'pj-015', order_id: 'ORD-2025-0138', customer_name: 'Dina Sabbagh',
    job_type: 'product_label', printer_id: 'prt-001', printer_name: 'Brother QL-820NWB',
    printer_type: 'labels', station: 'labeling', status: 'cancelled', copies: 2,
    created_at: fmt(ago(200)), retries: 0, priority: 'normal',
    label_details: 'Order cancelled by customer',
  },
];

// ---- Helpers ----
function timeAgo(dateStr: string): string {
  const diff = now.getTime() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ---- Component ----
export default function PrintQueue() {
  const [jobs, setJobs] = useState<PrintJob[]>(MOCK_JOBS);
  const [printers] = useState<PrinterInfo[]>(MOCK_PRINTERS);
  const [activeStation, setActiveStation] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'priority'>('time');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [view, setView] = useState<'queue' | 'history'>('queue');

  // ---- Actions ----
  const handleReprint = useCallback((job: PrintJob) => {
    const newJob: PrintJob = {
      ...job,
      id: `pj-${Date.now()}`,
      status: 'queued',
      created_at: fmt(new Date()),
      started_at: undefined,
      completed_at: undefined,
      error_message: undefined,
      retries: 0,
    };
    setJobs(prev => [newJob, ...prev]);
    toast.success(`Reprint queued for ${job.order_id}`, {
      description: `${JOB_TYPE_CONFIG[job.job_type].label} → ${job.printer_name}`,
    });
  }, []);

  const handleCancel = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' as JobStatus } : j));
    toast.success('Print job cancelled');
  }, []);

  const handleRetry = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? {
      ...j, status: 'queued' as JobStatus, error_message: undefined, retries: j.retries + 1,
    } : j));
    toast.success('Job re-queued for printing');
  }, []);

  const handlePrioritize = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? {
      ...j, priority: j.priority === 'urgent' ? 'normal' : j.priority === 'high' ? 'urgent' : 'high',
    } : j));
    toast.success('Job priority updated');
  }, []);

  const handleRefresh = useCallback(() => {
    toast.success('Queue refreshed', { description: 'Synced with all printers' });
  }, []);

  // ---- Filtering ----
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Station filter
    if (activeStation !== 'all') {
      result = result.filter(j => j.station === activeStation);
    }

    // View filter (queue = active, history = completed/cancelled/failed)
    if (view === 'queue') {
      if (statusFilter === 'active') {
        result = result.filter(j => ['queued', 'printing'].includes(j.status));
      } else if (statusFilter === 'failed') {
        result = result.filter(j => j.status === 'failed');
      } else if (statusFilter !== 'all') {
        result = result.filter(j => j.status === statusFilter);
      }
    } else {
      result = result.filter(j => ['completed', 'cancelled', 'failed'].includes(j.status));
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(j => j.job_type === typeFilter);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.order_id.toLowerCase().includes(q) ||
        j.customer_name.toLowerCase().includes(q) ||
        j.printer_name.toLowerCase().includes(q) ||
        (j.label_details || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'priority') {
      const pOrder = { urgent: 0, high: 1, normal: 2 };
      result.sort((a, b) => pOrder[a.priority] - pOrder[b.priority] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [jobs, activeStation, statusFilter, typeFilter, searchQuery, sortBy, view]);

  // ---- KPIs ----
  const stationJobs = activeStation === 'all' ? jobs : jobs.filter(j => j.station === activeStation);
  const queuedCount = stationJobs.filter(j => j.status === 'queued').length;
  const printingCount = stationJobs.filter(j => j.status === 'printing').length;
  const completedToday = stationJobs.filter(j => j.status === 'completed' && j.completed_at && (now.getTime() - new Date(j.completed_at).getTime()) < 86400000).length;
  const failedCount = stationJobs.filter(j => j.status === 'failed').length;
  const onlinePrinters = printers.filter(p => p.status === 'online').length;

  return (
    <div>
      <PageHeader
        title="Print Queue"
        subtitle="Live print job management across all stations"
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Print Queue' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh}>
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Export coming soon')}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard label="In Queue" value={queuedCount} sublabel="Waiting to print" icon={Clock} variant="warning" />
          <KPICard label="Now Printing" value={printingCount} sublabel="Active print jobs" icon={Printer} variant="gold" />
          <KPICard label="Completed Today" value={completedToday} sublabel="Successfully printed" icon={CheckCircle2} variant="success" />
          <KPICard label="Failed" value={failedCount} sublabel="Needs attention" icon={AlertTriangle} variant={failedCount > 0 ? 'destructive' : 'default'} />
          <KPICard label="Printers Online" value={`${onlinePrinters}/${printers.length}`} sublabel={`${printers.length - onlinePrinters} offline`} icon={Wifi} variant={onlinePrinters === printers.length ? 'success' : 'warning'} />
        </div>

        {/* Station Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STATION_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStation(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all',
                activeStation === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.id !== 'all' && (() => {
                const count = jobs.filter(j => j.station === tab.id && ['queued', 'printing'].includes(j.status)).length;
                return count > 0 ? (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-gold/20 text-gold">
                    {count}
                  </span>
                ) : null;
              })()}
            </button>
          ))}
        </div>

        {/* Printer Status Strip */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {printers
            .filter(p => activeStation === 'all' || p.station === activeStation || p.station === 'ALL')
            .map(p => (
              <div key={p.id} className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs shrink-0 transition-all',
                p.status === 'online' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5',
              )}>
                {p.status === 'online' ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-red-500" />
                )}
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">·</span>
                <span className={cn('font-mono', p.status === 'online' ? 'text-emerald-600' : 'text-red-600')}>
                  {p.status}
                </span>
                {p.queue_length > 0 && (
                  <span className="text-muted-foreground">({p.queue_length} in queue)</span>
                )}
              </div>
            ))}
        </div>

        {/* View Toggle + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setView('queue')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                view === 'queue' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Play className="w-3 h-3 inline mr-1" /> Live Queue
            </button>
            <button
              onClick={() => setView('history')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                view === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Clock className="w-3 h-3 inline mr-1" /> History
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search order, customer, printer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs w-56"
              />
            </div>

            {view === 'queue' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Jobs</SelectItem>
                  <SelectItem value="queued">Queued Only</SelectItem>
                  <SelectItem value="printing">Printing Only</SelectItem>
                  <SelectItem value="failed">Failed Only</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(JOB_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setSortBy(prev => prev === 'time' ? 'priority' : 'time')}
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === 'time' ? 'By Time' : 'By Priority'}
            </Button>
          </div>
        </div>

        {/* Job List */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredJobs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon={Printer}
                  title={view === 'queue' ? 'No active print jobs' : 'No print history'}
                  description={view === 'queue'
                    ? 'All print jobs have been completed. New jobs will appear here when orders are processed.'
                    : 'Completed and cancelled print jobs will appear here.'
                  }
                />
              </motion.div>
            ) : (
              filteredJobs.map((job) => {
                const statusCfg = STATUS_CONFIG[job.status];
                const typeCfg = JOB_TYPE_CONFIG[job.job_type];
                const priorityCfg = PRIORITY_CONFIG[job.priority];
                const StatusIcon = statusCfg.icon;
                const TypeIcon = typeCfg.icon;
                const isExpanded = expandedJob === job.id;

                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  >
                    <div
                      className={cn(
                        'border rounded-lg bg-card transition-all',
                        job.status === 'printing' && 'border-blue-500/30 shadow-sm shadow-blue-500/5',
                        job.status === 'failed' && 'border-red-500/30',
                        job.status === 'queued' && 'border-border',
                        job.status === 'completed' && 'border-border opacity-80',
                        job.status === 'cancelled' && 'border-border opacity-60',
                      )}
                    >
                      {/* Main Row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                      >
                        {/* Status indicator */}
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border', statusCfg.bg)}>
                          <StatusIcon className={cn('w-4 h-4', statusCfg.color, job.status === 'printing' && 'animate-spin')} />
                        </div>

                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold font-mono">{job.order_id}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground truncate">{job.customer_name}</span>
                            {job.priority !== 'normal' && (
                              <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full', priorityCfg.color)}>
                                {priorityCfg.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded', typeCfg.color)}>
                              <TypeIcon className="w-3 h-3" />
                              {typeCfg.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">→ {job.printer_name}</span>
                            <span className="text-[10px] text-muted-foreground">· {job.copies} {job.copies === 1 ? 'copy' : 'copies'}</span>
                          </div>
                        </div>

                        {/* Station badge */}
                        <div className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded shrink-0">
                          {job.station}
                        </div>

                        {/* Time */}
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground">{timeAgo(job.created_at)}</p>
                          {job.started_at && <p className="text-[9px] text-muted-foreground/60">Started {formatTime(job.started_at)}</p>}
                        </div>

                        {/* Status badge */}
                        <div className={cn('px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border shrink-0', statusCfg.bg, statusCfg.color)}>
                          {statusCfg.label}
                        </div>

                        {/* Expand chevron */}
                        <div className="shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 pt-0 border-t border-border">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                                {/* Details */}
                                <div className="space-y-2">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Job Details</p>
                                  {job.label_details && (
                                    <p className="text-xs text-foreground">{job.label_details}</p>
                                  )}
                                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                                    <p>Printer: <span className="text-foreground font-medium">{job.printer_name}</span></p>
                                    <p>Station: <span className="text-foreground font-medium">{job.station}</span></p>
                                    <p>Copies: <span className="text-foreground font-medium">{job.copies}</span></p>
                                    {job.retries > 0 && <p>Retries: <span className="text-foreground font-medium">{job.retries}</span></p>}
                                  </div>
                                </div>

                                {/* Timeline */}
                                <div className="space-y-2">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Timeline</p>
                                  <div className="text-[11px] space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                                      <span className="text-muted-foreground">Created:</span>
                                      <span className="font-mono">{formatTime(job.created_at)}</span>
                                    </div>
                                    {job.started_at && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span className="text-muted-foreground">Started:</span>
                                        <span className="font-mono">{formatTime(job.started_at)}</span>
                                      </div>
                                    )}
                                    {job.completed_at && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-muted-foreground">Completed:</span>
                                        <span className="font-mono">{formatTime(job.completed_at)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Error / Actions */}
                                <div className="space-y-2">
                                  {job.error_message && (
                                    <div className="p-2 rounded-md bg-red-500/5 border border-red-500/20">
                                      <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-1">Error</p>
                                      <p className="text-xs text-red-600">{job.error_message}</p>
                                    </div>
                                  )}
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Actions</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleReprint(job)}>
                                        <RotateCcw className="w-3 h-3" /> Reprint
                                      </Button>
                                    )}
                                    {job.status === 'failed' && (
                                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleRetry(job.id)}>
                                        <RefreshCcw className="w-3 h-3" /> Retry
                                      </Button>
                                    )}
                                    {job.status === 'queued' && (
                                      <>
                                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handlePrioritize(job.id)}>
                                          <SkipForward className="w-3 h-3" /> Prioritize
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-destructive hover:text-destructive" onClick={() => handleCancel(job.id)}>
                                          <Trash2 className="w-3 h-3" /> Cancel
                                        </Button>
                                      </>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => toast.info('Order detail view coming soon')}>
                                      <Eye className="w-3 h-3" /> View Order
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Summary footer */}
        {filteredJobs.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <span>
              Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
              {activeStation !== 'all' && ` in ${STATION_TABS.find(t => t.id === activeStation)?.label}`}
            </span>
            <span className="font-mono">
              {queuedCount} queued · {printingCount} printing · {completedToday} completed today
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
