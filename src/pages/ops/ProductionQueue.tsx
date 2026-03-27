// ============================================================
// Production Queue — Operations Center
// Kanban + List view for production jobs
// Priority tags: Low / Medium / High / Urgent / VIP (editable inline)
// Job tags: Subscription Cycle / One-Time / First Subscription / RTS Production
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, KPICard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Layers, Package, Clock, Search, Eye, RefreshCw, Zap, Box,
  Timer, Play, Boxes, LayoutGrid, List, Tag, RotateCcw,
  Key, Sparkles, PackageCheck, Pause, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
type JobTag = 'subscription_cycle' | 'one_time' | 'first_subscription' | 'rts_production';
type QueueStatus = 'queued' | 'assigned' | 'in_progress' | 'paused';
type PriorityLevel = 'vip' | 'urgent' | 'high' | 'medium' | 'low';

interface QueueJob {
  id: string;
  title: string;
  tag: JobTag;
  orderCount: number;
  vialCount: number;
  priority: PriorityLevel;
  status: QueueStatus;
  assignedPod?: string;
  createdAt: string;
  deadline?: string;
  estimatedTime: string;
  timeline?: string;
}

// ---- Config ----
const TAG_CONFIG: Record<JobTag, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  subscription_cycle: { label: 'Subscription Cycle', icon: RotateCcw, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  one_time: { label: 'One-Time', icon: Key, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  first_subscription: { label: 'First Subscription', icon: Sparkles, color: 'text-gold', bgColor: 'bg-amber-100' },
  rts_production: { label: 'RTS Production', icon: PackageCheck, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; color: string; bgColor: string }> = {
  vip: { label: 'VIP', color: 'text-gold', bgColor: 'bg-amber-100' },
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  medium: { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  low: { label: 'Low', color: 'text-slate-500', bgColor: 'bg-slate-100' },
};

const STATUS_CONFIG: { id: QueueStatus; label: string; variant: 'muted' | 'info' | 'gold' | 'success'; icon: React.ElementType }[] = [
  { id: 'queued', label: 'In Queue', variant: 'muted', icon: Layers },
  { id: 'assigned', label: 'Assigned', variant: 'info', icon: Tag },
  { id: 'in_progress', label: 'In Progress', variant: 'gold', icon: Play },
  { id: 'paused', label: 'Paused', variant: 'muted', icon: Pause },
];

// ---- Mock Data ----
const INITIAL_QUEUE: QueueJob[] = [
  { id: 'JOB-127', title: 'March Subscription Batch B', tag: 'subscription_cycle', orderCount: 95, vialCount: 285, priority: 'high', status: 'queued', createdAt: '10:15 AM', deadline: 'Today 6:00 PM', estimatedTime: '3h 20m', timeline: '5 days' },
  { id: 'JOB-128', title: 'Daily On-Demand — Afternoon', tag: 'one_time', orderCount: 32, vialCount: 96, priority: 'medium', status: 'queued', createdAt: '11:00 AM', estimatedTime: '1h 45m', timeline: '1 day + 1 day contingency' },
  { id: 'JOB-129', title: 'Whisperer Vial Production', tag: 'rts_production', orderCount: 200, vialCount: 200, priority: 'medium', status: 'queued', createdAt: '09:00 AM', deadline: 'Mar 6', estimatedTime: '5h 00m', timeline: '2 days' },
  { id: 'JOB-130', title: 'Capsule Drop — House of Oud', tag: 'one_time', orderCount: 28, vialCount: 84, priority: 'urgent', status: 'queued', createdAt: '11:30 AM', deadline: 'Today 3:00 PM', estimatedTime: '1h 30m', timeline: '1 day' },
  { id: 'JOB-131', title: 'VIP Client — Bespoke Set', tag: 'first_subscription', orderCount: 1, vialCount: 7, priority: 'vip', status: 'queued', createdAt: '12:00 PM', deadline: 'Today 2:00 PM', estimatedTime: '25m', timeline: '1 day' },
  { id: 'JOB-124', title: 'March Subscription Batch A', tag: 'subscription_cycle', orderCount: 120, vialCount: 360, priority: 'high', status: 'in_progress', assignedPod: 'Pod Alpha', createdAt: '08:00 AM', deadline: 'Today 5:00 PM', estimatedTime: '4h 10m', timeline: '5 days' },
  { id: 'JOB-125', title: 'Daily On-Demand — Morning', tag: 'one_time', orderCount: 45, vialCount: 135, priority: 'medium', status: 'in_progress', assignedPod: 'Pod Bravo', createdAt: '09:30 AM', estimatedTime: '2h 15m', timeline: '1 day + 1 day contingency' },
  { id: 'JOB-126', title: 'First-Time Subscriber Welcome', tag: 'first_subscription', orderCount: 18, vialCount: 54, priority: 'high', status: 'paused', assignedPod: 'Pod Alpha', createdAt: '07:30 AM', estimatedTime: '1h 00m', timeline: '2 days' },
];

export default function ProductionQueue() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [jobs, setJobs] = useState(INITIAL_QUEUE);

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (tagFilter !== 'all' && j.tag !== tagFilter) return false;
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && j.priority !== priorityFilter) return false;
      return true;
    }).sort((a, b) => {
      const priorityOrder: Record<PriorityLevel, number> = { vip: 0, urgent: 1, high: 2, medium: 3, low: 4 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [search, tagFilter, statusFilter, priorityFilter, jobs]);

  const queuedCount = jobs.filter(j => j.status === 'queued').length;
  const inProgressCount = jobs.filter(j => j.status === 'in_progress').length;
  const pausedCount = jobs.filter(j => j.status === 'paused').length;
  const totalOrders = jobs.filter(j => j.status === 'queued').reduce((s, j) => s + j.orderCount, 0);
  const totalVials = jobs.filter(j => j.status === 'queued').reduce((s, j) => s + j.vialCount, 0);

  const handlePriorityChange = (jobId: string, newPriority: PriorityLevel) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, priority: newPriority } : j));
    toast.success(`Priority updated to ${PRIORITY_CONFIG[newPriority].label}`);
  };

  // Kanban columns by status
  const kanbanColumns = STATUS_CONFIG.map(status => ({
    ...status,
    jobs: filtered.filter(j => j.status === status.id),
  }));

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Production Queue"
        subtitle="Jobs waiting for production pods — editable priority tags and Kanban view"
        breadcrumbs={[
          { label: 'Jobs & Queue Mgmt' },
          { label: 'Production Queue' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-none h-8 px-3', viewMode === 'kanban' && 'bg-gold hover:bg-gold/90 text-gold-foreground')}
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className={cn('rounded-none h-8 px-3', viewMode === 'list' && 'bg-gold hover:bg-gold/90 text-gold-foreground')}
                onClick={() => setViewMode('list')}
              >
                <List className="w-3.5 h-3.5 mr-1" /> List
              </Button>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Refreshing queue...')}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard label="In Queue" value={queuedCount} sublabel={`${totalOrders} orders`} icon={Layers} variant="gold" />
          <KPICard label="In Progress" value={inProgressCount} sublabel="Active in pods" icon={Play} variant="success" />
          <KPICard label="Paused" value={pausedCount} sublabel="On hold" icon={Pause} />
          <KPICard label="Queued Vials" value={totalVials} sublabel="To produce" icon={Boxes} />
          <KPICard label="Est. Queue Time" value="6h 35m" sublabel="At capacity" icon={Timer} variant="warning" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {Object.entries(TAG_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_CONFIG.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {kanbanColumns.map(col => {
              const ColIcon = col.icon;
              return (
                <div key={col.id} className="min-w-[280px] w-[280px] flex-shrink-0">
                  {/* Column Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <ColIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-bold">{col.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">{col.jobs.length}</Badge>
                  </div>
                  {/* Column Cards */}
                  <div className="space-y-2">
                    {col.jobs.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-muted-foreground/20 text-center">
                        <p className="text-[11px] text-muted-foreground">No jobs</p>
                      </div>
                    ) : (
                      col.jobs.map(job => {
                        const tagCfg = TAG_CONFIG[job.tag];
                        const TagIcon = tagCfg.icon;
                        const prioCfg = PRIORITY_CONFIG[job.priority];
                        return (
                          <Card
                            key={job.id}
                            className={cn(
                              'hover:shadow-md transition-all border-l-[3px]',
                              job.priority === 'vip' ? 'border-l-gold' :
                              job.priority === 'urgent' ? 'border-l-red-500' :
                              job.priority === 'high' ? 'border-l-orange-500' : 'border-l-border',
                            )}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-muted-foreground">{job.id}</span>
                                {/* Inline priority selector */}
                                <Select value={job.priority} onValueChange={(v) => handlePriorityChange(job.id, v as PriorityLevel)}>
                                  <SelectTrigger className={cn('h-5 w-auto min-w-0 border-0 px-1.5 py-0 text-[9px] font-bold', prioCfg.bgColor, prioCfg.color)}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                                      <SelectItem key={k} value={k}>
                                        <span className={cn('font-semibold', v.color)}>{v.label}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <h4 className="text-xs font-semibold mb-1.5">{job.title}</h4>
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <Badge className={cn('text-[8px] px-1.5 py-0', tagCfg.bgColor, tagCfg.color)}>
                                  <TagIcon className="w-2.5 h-2.5 mr-0.5" />{tagCfg.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                <span>{job.orderCount} orders</span>
                                <span>{job.vialCount} vials</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" /> {job.estimatedTime}</span>
                                {job.deadline && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {job.deadline}</span>}
                              </div>
                              {job.timeline && (
                                <p className="text-[10px] text-muted-foreground/70 mt-1">Timeline: {job.timeline}</p>
                              )}
                              {job.assignedPod && (
                                <p className="text-[10px] text-blue-500 mt-1">{job.assignedPod}</p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <EmptyState icon={Layers} title="No Jobs Found" description="No jobs match your current filters." />
            ) : (
              filtered.map(job => {
                const tagCfg = TAG_CONFIG[job.tag];
                const TagIcon = tagCfg.icon;
                const prioCfg = PRIORITY_CONFIG[job.priority];
                const statusCfg = STATUS_CONFIG.find(s => s.id === job.status)!;

                return (
                  <Card key={job.id} className={cn(
                    'border-l-[3px] transition-all hover:shadow-md',
                    job.priority === 'vip' ? 'border-l-gold' :
                    job.priority === 'urgent' ? 'border-l-red-500' :
                    job.priority === 'high' ? 'border-l-orange-500' : 'border-l-border',
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', tagCfg.bgColor)}>
                            <TagIcon className={cn('w-5 h-5', tagCfg.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{job.id}</span>
                              <Badge className={cn('text-[9px]', tagCfg.bgColor, tagCfg.color)}>
                                <TagIcon className="w-3 h-3 mr-0.5" />{tagCfg.label}
                              </Badge>
                              {/* Inline priority selector */}
                              <Select value={job.priority} onValueChange={(v) => handlePriorityChange(job.id, v as PriorityLevel)}>
                                <SelectTrigger className={cn('h-5 w-auto min-w-0 border-0 px-2 py-0 text-[9px] font-bold rounded-full', prioCfg.bgColor, prioCfg.color)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>
                                      <span className={cn('font-semibold', v.color)}>{v.label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <h4 className="text-sm font-semibold mt-1">{job.title}</h4>
                            <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {job.orderCount} orders</span>
                              <span className="flex items-center gap-1"><Boxes className="w-3 h-3" /> {job.vialCount} vials</span>
                              <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> Est. {job.estimatedTime}</span>
                              {job.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due {job.deadline}</span>}
                              {job.timeline && <span className="flex items-center gap-1">Timeline: {job.timeline}</span>}
                            </div>
                            {job.assignedPod && (
                              <p className="text-[11px] text-blue-500 mt-1">Assigned to {job.assignedPod}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge variant={statusCfg.variant}>{statusCfg.label}</StatusBadge>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast.info('Opening job details...')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
