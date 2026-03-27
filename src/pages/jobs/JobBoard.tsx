// ============================================================
// Pod Dashboard — Unified view of all job types
// Shows active jobs across all categories with filtering
// Round 40: Major operations restructure
// ============================================================
import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, KPICard, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Package, Layers, Box, Droplets, Tag,
  CheckCircle2, FlaskConical, Factory, Truck,
  ChevronRight, Eye, Clock, AlertTriangle, ArrowRight,
  RotateCcw, Gift, Building2, Sparkles, ShoppingCart,
  ClipboardList, ScanBarcode, PackageCheck, Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { JobType } from '@/types';

// ---- 6 Job Type Definitions ----
const JOB_TYPES: {
  id: JobType;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  stations: string[];
}[] = [
  {
    id: 'subscription_first_order', label: 'Subscription First Order', shortLabel: 'Sub 1st',
    icon: ShoppingCart, color: 'text-amber-600', bgColor: 'bg-amber-500', borderColor: 'border-amber-500/30',
    description: 'New subscriber first order — full decanting process',
    stations: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  },
  {
    id: 'subscription_cycle', label: 'Subscription Cycle', shortLabel: 'Sub Cycle',
    icon: RotateCcw, color: 'text-blue-600', bgColor: 'bg-blue-500', borderColor: 'border-blue-500/30',
    description: 'Monthly cycle batch — all subscribers',
    stations: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  },
  {
    id: 'internal_production', label: 'Internal Production', shortLabel: 'Production',
    icon: Factory, color: 'text-purple-600', bgColor: 'bg-purple-500', borderColor: 'border-purple-500/30',
    description: 'Create capsules, gift sets, inventory batches',
    stations: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
  },
  {
    id: 'aurakey_ondemand', label: 'AuraKey & Refills', shortLabel: 'AuraKey',
    icon: Droplets, color: 'text-emerald-600', bgColor: 'bg-emerald-500', borderColor: 'border-emerald-500/30',
    description: 'On-demand AuraKey / refill / Whisper vial orders',
    stations: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  },
  {
    id: 'ready_product_fulfillment', label: 'Ready Product Fulfillment', shortLabel: 'Ready Ship',
    icon: PackageCheck, color: 'text-orange-600', bgColor: 'bg-orange-500', borderColor: 'border-orange-500/30',
    description: 'Pre-made items — pick, pack, ship (no decanting)',
    stations: ['S1', 'S5', 'S6'],
  },
  {
    id: 'corporate_gift_activation', label: 'Corporate Gift Activation', shortLabel: 'Corporate',
    icon: Building2, color: 'text-slate-600', bgColor: 'bg-slate-500', borderColor: 'border-slate-500/30',
    description: 'Corporate gifts — prepare, customize, activate',
    stations: ['Custom'],
  },
];

// Station progress definitions
const STATION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  S1: { label: 'Pod Dashboard', icon: ClipboardList },
  S2: { label: 'Picking', icon: ScanBarcode },
  S3: { label: 'Prep & Label', icon: Printer },
  S4: { label: 'Decanting', icon: FlaskConical },
  S5: { label: 'Fulfillment', icon: PackageCheck },
  S6: { label: 'Shipping', icon: Truck },
  F1: { label: 'Picking', icon: Package },
  F2: { label: 'Prep Labels', icon: Tag },
  F3: { label: 'Print', icon: Printer },
  F4: { label: 'Decanting', icon: FlaskConical },
  F5: { label: 'Compile', icon: Layers },
  F6: { label: 'QC', icon: CheckCircle2 },
  F7: { label: 'Log Inventory', icon: Box },
};

// Mock active jobs
interface ActiveJob {
  jobId: string;
  type: JobType;
  title: string;
  orderCount: number;
  totalVials: number;
  currentStation: string;
  priority: 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  createdAt: string;
  source: string;
}

const mockJobs: ActiveJob[] = [
  { jobId: 'JB-2026-0301', type: 'subscription_cycle', title: 'March 2026 Cycle — Batch A', orderCount: 45, totalVials: 135, currentStation: 'S3', priority: 'high', assignedTo: 'Ahmed K.', createdAt: '2026-02-25T09:00:00Z', source: 'Cycle Mar 2026' },
  { jobId: 'JB-2026-0302', type: 'subscription_cycle', title: 'March 2026 Cycle — Batch B', orderCount: 38, totalVials: 114, currentStation: 'S2', priority: 'normal', assignedTo: 'Karim R.', createdAt: '2026-02-25T09:30:00Z', source: 'Cycle Mar 2026' },
  { jobId: 'JB-2026-0303', type: 'subscription_first_order', title: 'First Order — Layla M.', orderCount: 1, totalVials: 3, currentStation: 'S4', priority: 'normal', assignedTo: 'Sara M.', createdAt: '2026-02-26T14:00:00Z', source: 'Order #EM-1847' },
  { jobId: 'JB-2026-0304', type: 'subscription_first_order', title: 'First Order — Omar H.', orderCount: 1, totalVials: 2, currentStation: 'S1', priority: 'normal', createdAt: '2026-02-27T10:00:00Z', source: 'Order #EM-1852' },
  { jobId: 'JB-2026-0305', type: 'aurakey_ondemand', title: 'AuraKey Refill — Carlos R.', orderCount: 1, totalVials: 3, currentStation: 'S2', priority: 'normal', assignedTo: 'Ahmed K.', createdAt: '2026-02-26T16:00:00Z', source: 'Order #EM-1849' },
  { jobId: 'JB-2026-0306', type: 'aurakey_ondemand', title: 'AuraKey New — Emma W.', orderCount: 1, totalVials: 3, currentStation: 'S4', priority: 'high', assignedTo: 'Karim R.', createdAt: '2026-02-27T08:00:00Z', source: 'Order #EM-1851' },
  { jobId: 'JB-2026-0307', type: 'aurakey_ondemand', title: 'Whisper Vial — John S.', orderCount: 1, totalVials: 2, currentStation: 'S5', priority: 'normal', createdAt: '2026-02-27T11:00:00Z', source: 'Order #EM-1853' },
  { jobId: 'JB-2026-0308', type: 'internal_production', title: 'Oud Legacy Collection × 25', orderCount: 0, totalVials: 75, currentStation: 'F4', priority: 'high', assignedTo: 'Karim R.', createdAt: '2026-02-25T10:00:00Z', source: 'PJ-001' },
  { jobId: 'JB-2026-0309', type: 'internal_production', title: 'Rose & Oud Discovery × 40', orderCount: 0, totalVials: 80, currentStation: 'F1', priority: 'normal', assignedTo: 'Ahmed K.', createdAt: '2026-02-26T13:00:00Z', source: 'PJ-002' },
  { jobId: 'JB-2026-0310', type: 'ready_product_fulfillment', title: 'Gift Set — Valentine\'s Box × 3', orderCount: 3, totalVials: 0, currentStation: 'S5', priority: 'normal', createdAt: '2026-02-27T09:00:00Z', source: 'Orders #EM-1850,1854,1855' },
  { jobId: 'JB-2026-0311', type: 'ready_product_fulfillment', title: 'Capsule Drop — GM1 × 2', orderCount: 2, totalVials: 0, currentStation: 'S1', priority: 'normal', createdAt: '2026-02-27T12:00:00Z', source: 'Orders #EM-1856,1857' },
  { jobId: 'JB-2026-0312', type: 'corporate_gift_activation', title: 'Emirates NBD — 50 Sets', orderCount: 1, totalVials: 100, currentStation: 'Custom', priority: 'urgent', assignedTo: 'Sara M.', createdAt: '2026-02-24T08:00:00Z', source: 'CQ-2026-001' },
];

export default function JobBoard() {
  const [jobs] = useState<ActiveJob[]>(mockJobs);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Stats per job type
  const typeStats = useMemo(() => {
    const stats: Record<string, { count: number; vials: number; urgent: number }> = {};
    JOB_TYPES.forEach(t => { stats[t.id] = { count: 0, vials: 0, urgent: 0 }; });
    jobs.forEach(j => {
      if (stats[j.type]) {
        stats[j.type].count++;
        stats[j.type].vials += j.totalVials;
        if (j.priority === 'urgent') stats[j.type].urgent++;
      }
    });
    return stats;
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (activeTab !== 'all') {
      result = result.filter(j => j.type === activeTab);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.jobId.toLowerCase().includes(q) ||
        j.source.toLowerCase().includes(q)
      );
    }
    // Sort: urgent first, then high, then by date
    return result.sort((a, b) => {
      const prio = { urgent: 0, high: 1, normal: 2 };
      if (prio[a.priority] !== prio[b.priority]) return prio[a.priority] - prio[b.priority];
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobs, activeTab, searchQuery]);

  const totalActive = jobs.length;
  const totalVials = jobs.reduce((s, j) => s + j.totalVials, 0);
  const urgentCount = jobs.filter(j => j.priority === 'urgent').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pod Dashboard"
        subtitle="Unified view of all active jobs across 6 job types"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Active Jobs" value={totalActive} icon={ClipboardList} />
        <KPICard label="Total Vials" value={totalVials.toLocaleString()} icon={Droplets} />
        <KPICard label="Urgent" value={urgentCount} icon={AlertTriangle} />
        <KPICard label="Job Types" value={JOB_TYPES.length} icon={Layers} />
      </div>

      {/* Job Type Cards — Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {JOB_TYPES.map(jt => {
          const Icon = jt.icon;
          const stat = typeStats[jt.id];
          const isActive = activeTab === jt.id;
          return (
            <button
              key={jt.id}
              onClick={() => setActiveTab(isActive ? 'all' : jt.id)}
              className={cn(
                'p-3 rounded-xl border text-left transition-all',
                isActive
                  ? `${jt.borderColor} bg-card shadow-md ring-1 ring-gold/20`
                  : 'border-border/50 bg-card/50 hover:bg-card hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', jt.bgColor)}>
                  <Icon className="w-4 h-4" />
                </div>
                {stat.urgent > 0 && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-auto">
                    {stat.urgent} urgent
                  </Badge>
                )}
              </div>
              <div className="text-xs font-semibold truncate">{jt.shortLabel}</div>
              <div className="text-lg font-bold mt-0.5">{stat.count}</div>
              <div className="text-[10px] text-muted-foreground">{stat.vials} vials</div>
            </button>
          );
        })}
      </div>

      {/* Job List */}
      <SectionCard
        title={activeTab === 'all' ? 'All Active Jobs' : JOB_TYPES.find(t => t.id === activeTab)?.label || 'Jobs'}
        subtitle={`${filteredJobs.length} jobs`}
        headerActions={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        }
      >
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No active jobs"
            description={activeTab !== 'all' ? 'No jobs of this type. Try a different filter.' : 'No active jobs at the moment.'}
          />
        ) : (
          <div className="space-y-2">
            {filteredJobs.map(job => {
              const jt = JOB_TYPES.find(t => t.id === job.type);
              if (!jt) return null;
              const Icon = jt.icon;
              const stationInfo = STATION_LABELS[job.currentStation];
              const StationIcon = stationInfo?.icon || Clock;
              const stationIdx = jt.stations.indexOf(job.currentStation);
              const progress = stationIdx >= 0 ? Math.round(((stationIdx + 1) / jt.stations.length) * 100) : 0;

              return (
                <Card key={job.jobId} className="hover:shadow-sm transition-shadow border-border/60">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Type icon */}
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0', jt.bgColor)}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>

                      {/* Job info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-muted-foreground">{job.jobId}</span>
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', jt.color, jt.borderColor)}>
                            {jt.shortLabel}
                          </Badge>
                          {job.priority === 'urgent' && <StatusBadge variant="destructive">Urgent</StatusBadge>}
                          {job.priority === 'high' && <StatusBadge variant="gold">High</StatusBadge>}
                        </div>
                        <h4 className="text-sm font-medium truncate mt-0.5">{job.title}</h4>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span>{job.orderCount > 0 ? `${job.orderCount} orders` : 'Batch'} · {job.totalVials} vials</span>
                          {job.assignedTo && <span>→ {job.assignedTo}</span>}
                          <span className="ml-auto">{job.source}</span>
                        </div>
                      </div>

                      {/* Current station + progress */}
                      <div className="text-right shrink-0 w-28">
                        <div className="flex items-center gap-1.5 justify-end">
                          <StationIcon className={cn('w-3.5 h-3.5', jt.color)} />
                          <span className="text-xs font-medium">{job.currentStation}</span>
                          <span className="text-[10px] text-muted-foreground">{stationInfo?.label}</span>
                        </div>
                        <div className="mt-1.5">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all', jt.bgColor)}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground">{progress}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini station progress */}
                    <div className="flex items-center gap-0.5 mt-2">
                      {jt.stations.map((s, i) => {
                        const isCompleted = stationIdx > i;
                        const isCurrent = s === job.currentStation;
                        return (
                          <div
                            key={s}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-colors',
                              isCompleted ? jt.bgColor :
                              isCurrent ? `${jt.bgColor} animate-pulse` :
                              'bg-muted'
                            )}
                            title={`${s} · ${STATION_LABELS[s]?.label || s}`}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Job Type Legend */}
      <SectionCard title="Job Types Reference" subtitle="6 operational job categories">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {JOB_TYPES.map(jt => {
            const Icon = jt.icon;
            return (
              <div key={jt.id} className={cn('p-3 rounded-lg border', jt.borderColor, 'bg-card/50')}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('w-7 h-7 rounded-md flex items-center justify-center text-white', jt.bgColor)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold">{jt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{jt.description}</p>
                <div className="flex items-center gap-1">
                  {jt.stations.map((s, i) => (
                    <div key={s} className="flex items-center">
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{s}</Badge>
                      {i < jt.stations.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
