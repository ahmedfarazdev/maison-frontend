// ============================================================
// Fulfillment Queue — Operations Center
// Kanban + List view with fragmented fulfillment pipeline:
// Preparing → Assembly → Labels Generated → Ready for Pickup → Shipped
// Priority tags: Low / Medium / High / Urgent / VIP
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, KPICard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  PackageCheck, Truck, Package, Clock, CheckCircle2, Search,
  Eye, RefreshCw, Timer, Boxes, Play, Tag, LayoutGrid, List,
  ArrowRight, RotateCcw, Key, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
type FulfillmentStage = 'preparing' | 'assembly' | 'labels_generated' | 'ready_pickup' | 'shipped';
type JobTag = 'subscription_cycle' | 'one_time' | 'first_subscription' | 'rts_production';
type PriorityLevel = 'vip' | 'urgent' | 'high' | 'medium' | 'low';

interface FulfillmentOrder {
  id: string;
  jobId: string;
  customerName: string;
  tag: JobTag;
  itemCount: number;
  vialCount: number;
  stage: FulfillmentStage;
  assignedPod?: string;
  completedAt: string;
  shippingMethod: string;
  priority: PriorityLevel;
}

// ---- Config ----
const STAGE_CONFIG: { id: FulfillmentStage; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'preparing', label: 'Preparing', icon: Package, color: 'text-amber-500' },
  { id: 'assembly', label: 'Assembly', icon: PackageCheck, color: 'text-blue-500' },
  { id: 'labels_generated', label: 'Labels Generated', icon: Tag, color: 'text-purple-500' },
  { id: 'ready_pickup', label: 'Ready for Pickup', icon: Truck, color: 'text-emerald-500' },
  { id: 'shipped', label: 'Shipped', icon: CheckCircle2, color: 'text-green-600' },
];

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

const STAGE_VARIANT: Record<FulfillmentStage, 'muted' | 'info' | 'gold' | 'success'> = {
  preparing: 'muted',
  assembly: 'info',
  labels_generated: 'gold',
  ready_pickup: 'success',
  shipped: 'success',
};

// ---- Mock Data ----
const MOCK_ORDERS: FulfillmentOrder[] = [
  { id: 'ORD-2024-1891', jobId: 'JOB-122', customerName: 'Ahmed K.', tag: 'subscription_cycle', itemCount: 3, vialCount: 3, stage: 'preparing', completedAt: '11:42 AM', shippingMethod: 'Express', priority: 'high' },
  { id: 'ORD-2024-1892', jobId: 'JOB-122', customerName: 'Fatima M.', tag: 'subscription_cycle', itemCount: 2, vialCount: 2, stage: 'preparing', completedAt: '11:45 AM', shippingMethod: 'Standard', priority: 'medium' },
  { id: 'ORD-2024-1893', jobId: 'JOB-123', customerName: 'Omar S.', tag: 'one_time', itemCount: 4, vialCount: 4, stage: 'assembly', completedAt: '11:50 AM', shippingMethod: 'Express', priority: 'urgent' },
  { id: 'ORD-2024-1894', jobId: 'JOB-123', customerName: 'Sara N.', tag: 'first_subscription', itemCount: 5, vialCount: 5, stage: 'assembly', completedAt: '11:55 AM', shippingMethod: 'Express', priority: 'vip' },
  { id: 'ORD-2024-1888', jobId: 'JOB-121', customerName: 'Layla R.', tag: 'subscription_cycle', itemCount: 3, vialCount: 3, stage: 'labels_generated', assignedPod: 'Pod Delta', completedAt: '10:30 AM', shippingMethod: 'Standard', priority: 'medium' },
  { id: 'ORD-2024-1889', jobId: 'JOB-121', customerName: 'Hassan B.', tag: 'one_time', itemCount: 1, vialCount: 1, stage: 'labels_generated', assignedPod: 'Pod Delta', completedAt: '10:35 AM', shippingMethod: 'Express', priority: 'high' },
  { id: 'ORD-2024-1885', jobId: 'JOB-120', customerName: 'Rania T.', tag: 'rts_production', itemCount: 6, vialCount: 6, stage: 'ready_pickup', assignedPod: 'Pod Delta', completedAt: '09:45 AM', shippingMethod: 'Express', priority: 'urgent' },
  { id: 'ORD-2024-1880', jobId: 'JOB-120', customerName: 'Nora A.', tag: 'subscription_cycle', itemCount: 2, vialCount: 2, stage: 'shipped', assignedPod: 'Pod Delta', completedAt: '09:15 AM', shippingMethod: 'Standard', priority: 'medium' },
  { id: 'ORD-2024-1881', jobId: 'JOB-120', customerName: 'Youssef T.', tag: 'one_time', itemCount: 5, vialCount: 5, stage: 'shipped', assignedPod: 'Pod Delta', completedAt: '09:20 AM', shippingMethod: 'Express', priority: 'low' },
];

export default function FulfillmentQueue() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const filtered = useMemo(() => {
    return MOCK_ORDERS.filter(o => {
      if (search && !o.customerName.toLowerCase().includes(search.toLowerCase()) && !o.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (stageFilter !== 'all' && o.stage !== stageFilter) return false;
      if (priorityFilter !== 'all' && o.priority !== priorityFilter) return false;
      return true;
    });
  }, [search, stageFilter, priorityFilter]);

  const preparingCount = MOCK_ORDERS.filter(o => o.stage === 'preparing').length;
  const assemblyCount = MOCK_ORDERS.filter(o => o.stage === 'assembly').length;
  const labelsCount = MOCK_ORDERS.filter(o => o.stage === 'labels_generated').length;
  const readyCount = MOCK_ORDERS.filter(o => o.stage === 'ready_pickup').length;
  const shippedCount = MOCK_ORDERS.filter(o => o.stage === 'shipped').length;

  // Kanban columns
  const kanbanColumns = STAGE_CONFIG.map(stage => ({
    ...stage,
    orders: filtered.filter(o => o.stage === stage.id),
  }));

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Fulfillment Queue"
        subtitle="Fragmented fulfillment pipeline — Preparing → Assembly → Labels → Ready → Shipped"
        breadcrumbs={[
          { label: 'Jobs & Queue Mgmt' },
          { label: 'Fulfillment Queue' },
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
          <KPICard label="Preparing" value={preparingCount} sublabel="Being prepared" icon={Package} variant="default" />
          <KPICard label="Assembly" value={assemblyCount} sublabel="In assembly" icon={PackageCheck} variant="gold" />
          <KPICard label="Labels Ready" value={labelsCount} sublabel="Labels generated" icon={Tag} />
          <KPICard label="Ready for Pickup" value={readyCount} sublabel="Awaiting courier" icon={Truck} variant="success" />
          <KPICard label="Shipped Today" value={shippedCount} sublabel="Dispatched" icon={CheckCircle2} variant="success" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGE_CONFIG.map(s => (
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
                <div key={col.id} className="min-w-[260px] w-[260px] flex-shrink-0">
                  {/* Column Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <ColIcon className={cn('w-4 h-4', col.color)} />
                    <span className="text-sm font-bold">{col.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">{col.orders.length}</Badge>
                  </div>
                  {/* Column Cards */}
                  <div className="space-y-2">
                    {col.orders.length === 0 ? (
                      <div className="p-4 rounded-lg border border-dashed border-muted-foreground/20 text-center">
                        <p className="text-[11px] text-muted-foreground">No orders</p>
                      </div>
                    ) : (
                      col.orders.map(order => {
                        const tagCfg = TAG_CONFIG[order.tag];
                        const TagIcon = tagCfg.icon;
                        const prioCfg = PRIORITY_CONFIG[order.priority];
                        return (
                          <Card
                            key={order.id}
                            className={cn(
                              'cursor-pointer hover:shadow-md transition-all border-l-[3px]',
                              order.priority === 'vip' ? 'border-l-gold' :
                              order.priority === 'urgent' ? 'border-l-red-500' :
                              order.priority === 'high' ? 'border-l-orange-500' : 'border-l-border',
                            )}
                            onClick={() => toast.info(`Opening ${order.id} details...`)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-mono text-muted-foreground">{order.id}</span>
                                <Badge className={cn('text-[8px] px-1.5 py-0', prioCfg.bgColor, prioCfg.color)}>{prioCfg.label}</Badge>
                              </div>
                              <p className="text-xs font-semibold mb-1">{order.customerName}</p>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Badge className={cn('text-[8px] px-1.5 py-0', tagCfg.bgColor, tagCfg.color)}>
                                  <TagIcon className="w-2.5 h-2.5 mr-0.5" />{tagCfg.label}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{order.itemCount} items · {order.vialCount} vials</span>
                                <span>{order.shippingMethod}</span>
                              </div>
                              {order.assignedPod && (
                                <p className="text-[10px] text-blue-500 mt-1">{order.assignedPod}</p>
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
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No Orders Found" description="No orders match your current filters." />
            ) : (
              filtered.map(order => {
                const stageCfg = STAGE_CONFIG.find(s => s.id === order.stage)!;
                const StageIcon = stageCfg.icon;
                const tagCfg = TAG_CONFIG[order.tag];
                const TagIcon = tagCfg.icon;
                const prioCfg = PRIORITY_CONFIG[order.priority];
                return (
                  <Card key={order.id} className={cn(
                    'border-l-[3px] transition-all hover:shadow-md',
                    order.priority === 'vip' ? 'border-l-gold' :
                    order.priority === 'urgent' ? 'border-l-red-500' :
                    order.priority === 'high' ? 'border-l-orange-500' : 'border-l-border',
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                            order.stage === 'shipped' ? 'bg-emerald-100' :
                            order.stage === 'ready_pickup' ? 'bg-emerald-50' : 'bg-muted',
                          )}>
                            <StageIcon className={cn('w-5 h-5', stageCfg.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{order.id}</span>
                              <span className="text-[10px] text-muted-foreground/60">from {order.jobId}</span>
                              <Badge className={cn('text-[9px]', tagCfg.bgColor, tagCfg.color)}>
                                <TagIcon className="w-3 h-3 mr-0.5" />{tagCfg.label}
                              </Badge>
                              <Badge className={cn('text-[9px]', prioCfg.bgColor, prioCfg.color)}>{prioCfg.label}</Badge>
                            </div>
                            <p className="text-sm font-semibold mt-0.5">{order.customerName}</p>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                              <span>{order.itemCount} items · {order.vialCount} vials</span>
                              <span>{order.shippingMethod}</span>
                              <span>Completed {order.completedAt}</span>
                            </div>
                            {order.assignedPod && (
                              <p className="text-[11px] text-blue-500 mt-0.5">{order.assignedPod}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge variant={STAGE_VARIANT[order.stage]}>{stageCfg.label}</StatusBadge>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast.info('Opening order details...')}>
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
