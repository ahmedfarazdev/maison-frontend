import { useState, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Factory, Boxes, ShoppingCart, RotateCcw, Search,
  ArrowRight, Clock, CheckCircle2, AlertTriangle, Package,
  Beaker, Truck, Timer, TrendingUp, Eye,
} from 'lucide-react';
import { useLocation } from 'wouter';

// ---- Types ----
type ModuleType = 'ready_to_ship' | 'one_time' | 'subscription';
type ProductionStatus = 'queued' | 'in_progress' | 'completed' | 'blocked';

interface ProductionItem {
  id: string;
  module: ModuleType;
  title: string;
  subtitle: string;
  status: ProductionStatus;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  itemCount: number;
  completedCount: number;
  assignedStation?: string;
  dueDate?: string;
  createdAt: string;
}

// ---- Mock Data ----
const mockItems: ProductionItem[] = [
  // Ready-to-Ship
  { id: 'RTS-001', module: 'ready_to_ship', title: 'Capsule Drop — House of Oud Chapter', subtitle: '12 perfumes × 50 units each', status: 'in_progress', priority: 'high', itemCount: 600, completedCount: 340, assignedStation: 'S4', dueDate: '2026-03-05', createdAt: '2026-02-25' },
  { id: 'RTS-002', module: 'ready_to_ship', title: 'Gift Set — Discovery Collection', subtitle: '5 perfumes × 100 sets', status: 'queued', priority: 'normal', itemCount: 500, completedCount: 0, dueDate: '2026-03-10', createdAt: '2026-02-27' },
  { id: 'RTS-003', module: 'ready_to_ship', title: 'AuraKey Refill Packs — March Stock', subtitle: '8 perfumes × 200 units', status: 'in_progress', priority: 'high', itemCount: 1600, completedCount: 800, assignedStation: 'S4', dueDate: '2026-03-01', createdAt: '2026-02-20' },
  { id: 'RTS-004', module: 'ready_to_ship', title: 'Capsule Drop — Niche Legends', subtitle: '8 perfumes × 30 units', status: 'completed', priority: 'normal', itemCount: 240, completedCount: 240, createdAt: '2026-02-15' },

  // One-Time Orders
  { id: 'OT-001', module: 'one_time', title: 'AuraKey Orders — Feb 28 Cutoff', subtitle: '14 AuraKey + 8 Refill orders', status: 'in_progress', priority: 'urgent', itemCount: 22, completedCount: 6, assignedStation: 'S2', dueDate: '2026-02-28', createdAt: '2026-02-28' },
  { id: 'OT-002', module: 'one_time', title: 'Whisper Vials — Feb 28 Cutoff', subtitle: '5 × 1ml + 3 × 2ml orders', status: 'queued', priority: 'high', itemCount: 8, completedCount: 0, dueDate: '2026-02-28', createdAt: '2026-02-28' },
  { id: 'OT-003', module: 'one_time', title: 'First-Time Sub Orders — Feb 28', subtitle: '11 new subscriber welcome kits', status: 'queued', priority: 'high', itemCount: 11, completedCount: 0, dueDate: '2026-02-28', createdAt: '2026-02-28' },
  { id: 'OT-004', module: 'one_time', title: 'AuraKey Orders — Feb 27 Cutoff', subtitle: '9 AuraKey + 5 Refill orders', status: 'completed', priority: 'normal', itemCount: 14, completedCount: 14, createdAt: '2026-02-27' },

  // Subscription Cycles — unified per cycle (no tier separation)
  { id: 'SUB-001', module: 'subscription', title: 'Mar 2026 — Cycle 1 (W1)', subtitle: '297 subscribers · 1,341 vials', status: 'in_progress', priority: 'high', itemCount: 297, completedCount: 155, assignedStation: 'S4', dueDate: '2026-03-07', createdAt: '2026-02-25' },
  { id: 'SUB-002', module: 'subscription', title: 'Mar 2026 — Cycle 2 (W2)', subtitle: '305 subscribers · 1,380 vials', status: 'queued', priority: 'high', itemCount: 305, completedCount: 0, dueDate: '2026-03-14', createdAt: '2026-02-26' },
  { id: 'SUB-003', module: 'subscription', title: 'Mar 2026 — Cycle 3 (W3)', subtitle: '310 subscribers · 1,405 vials', status: 'queued', priority: 'normal', itemCount: 310, completedCount: 0, dueDate: '2026-03-21', createdAt: '2026-02-26' },
  { id: 'SUB-004', module: 'subscription', title: 'Feb 2026 — Cycle 1 (W1)', subtitle: '278 subscribers fulfilled', status: 'completed', priority: 'normal', itemCount: 278, completedCount: 278, createdAt: '2026-02-01' },
];

const MODULE_CONFIG: Record<ModuleType, { label: string; icon: React.ElementType; color: string; bgColor: string; description: string; path: string }> = {
  ready_to_ship: { label: 'Ready-to-Ship Products', icon: Boxes, color: 'text-blue-600', bgColor: 'bg-blue-50', description: 'Batch-produce capsules, gift sets, refill packs → inventory', path: '/production/create' },
  one_time: { label: 'One-Time Order Production', icon: ShoppingCart, color: 'text-amber-600', bgColor: 'bg-amber-50', description: 'Daily cutoff: AuraKey, Refills, Whisper, First-Time Subs', path: '/production/one-time' },
  subscription: { label: 'Subscription Cycle Production', icon: RotateCcw, color: 'text-emerald-600', bgColor: 'bg-emerald-50', description: 'Unified production hub per cycle — all subscribers combined', path: '/production/subscription' },
};

const STATUS_CONFIG: Record<ProductionStatus, { label: string; color: string; icon: React.ElementType }> = {
  queued: { label: 'Queued', color: 'bg-slate-100 text-slate-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Timer },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-amber-500',
  normal: 'border-l-blue-400',
  low: 'border-l-slate-300',
};

// ---- Component ----
export default function ProductionManagement() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | ModuleType>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Stats
  const stats = useMemo(() => {
    const byModule = (m: ModuleType) => mockItems.filter(i => i.module === m);
    const active = mockItems.filter(i => i.status !== 'completed');
    const totalItems = active.reduce((s, i) => s + i.itemCount, 0);
    const completedItems = active.reduce((s, i) => s + i.completedCount, 0);
    return {
      totalActive: active.length,
      totalItems,
      completedItems,
      overallProgress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      byModule: {
        ready_to_ship: { active: byModule('ready_to_ship').filter(i => i.status !== 'completed').length, total: byModule('ready_to_ship').length },
        one_time: { active: byModule('one_time').filter(i => i.status !== 'completed').length, total: byModule('one_time').length },
        subscription: { active: byModule('subscription').filter(i => i.status !== 'completed').length, total: byModule('subscription').length },
      },
    };
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = activeTab === 'overview' ? mockItems : mockItems.filter(i => i.module === activeTab);
    if (search) items = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    return items;
  }, [activeTab, search, statusFilter]);

  // Group by status for Kanban
  const kanbanColumns: { status: ProductionStatus; items: ProductionItem[] }[] = useMemo(() => {
    const statuses: ProductionStatus[] = ['queued', 'in_progress', 'completed', 'blocked'];
    return statuses.map(s => ({ status: s, items: filteredItems.filter(i => i.status === s) })).filter(c => c.items.length > 0 || c.status !== 'blocked');
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Management"
        subtitle="Master view across all production modules — track, prioritize, and manage production flow"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50"><Factory className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.totalActive}</p>
                <p className="text-xs text-muted-foreground">Active Production Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50"><Package className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.totalItems.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Units in Production</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50"><TrendingUp className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.overallProgress}%</p>
                <p className="text-xs text-muted-foreground">Overall Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50"><Beaker className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-2xl font-bold">{stats.completedItems.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Units Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(MODULE_CONFIG) as [ModuleType, typeof MODULE_CONFIG[ModuleType]][]).map(([key, config]) => {
          const Icon = config.icon;
          const moduleStats = stats.byModule[key];
          return (
            <Card key={key} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setLocation(config.path)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${config.bgColor}`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{config.label}</h3>
                <p className="text-xs text-muted-foreground mb-3">{config.description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-medium">{moduleStats.active} active</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{moduleStats.total} total</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kanban Board */}
      <SectionCard title="Production Kanban" subtitle="All production items across modules">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="h-9">
                <TabsTrigger value="overview" className="text-xs">All Modules</TabsTrigger>
                <TabsTrigger value="ready_to_ship" className="text-xs">Ready-to-Ship</TabsTrigger>
                <TabsTrigger value="one_time" className="text-xs">One-Time Orders</TabsTrigger>
                <TabsTrigger value="subscription" className="text-xs">Subscription</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1" />
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kanbanColumns.map(col => {
              const cfg = STATUS_CONFIG[col.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={col.status} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <StatusIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{cfg.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-5">{col.items.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {col.items.map(item => {
                      const modCfg = MODULE_CONFIG[item.module];
                      const ModIcon = modCfg.icon;
                      const progress = item.itemCount > 0 ? Math.round((item.completedCount / item.itemCount) * 100) : 0;
                      return (
                        <Card key={item.id} className={`border-l-4 ${PRIORITY_COLORS[item.priority]} shadow-sm hover:shadow-md transition-shadow cursor-pointer`} onClick={() => toast.info(`Opening ${item.id} details`)}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-1.5">
                                <ModIcon className={`w-3.5 h-3.5 ${modCfg.color}`} />
                                <span className="text-[10px] font-medium text-muted-foreground">{item.id}</span>
                              </div>
                              {item.assignedStation && (
                                <Badge variant="outline" className="text-[10px] h-5">{item.assignedStation}</Badge>
                              )}
                            </div>
                            <h4 className="text-sm font-medium leading-tight">{item.title}</h4>
                            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                            {item.status !== 'completed' && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span>{item.completedCount}/{item.itemCount} units</span>
                                  <span className="font-medium">{progress}%</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            )}
                            {item.dueDate && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>Due {new Date(item.dueDate).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {col.items.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground">No items</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
