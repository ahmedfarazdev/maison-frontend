// ============================================================
// One-Time Order Production — Production Center Module 2
// Daily cutoff processing: AuraKey, AuraKey Refills, Whisper vials,
// First-Time Subscription Orders
// Each day's orders are grouped into a batch for production
// ============================================================
import { useState, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Key, RefreshCw, Wind, Users, Clock, Timer, CheckCircle2,
  AlertTriangle, Package, Search, Eye, ArrowRight, Play,
  Calendar, Scissors, ShoppingCart, Beaker, Truck, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type OrderCategory = 'aurakey' | 'aurakey_refill' | 'whisper' | 'first_sub';
type BatchStatus = 'pending_cutoff' | 'ready' | 'in_production' | 'completed';
type OrderStatus = 'pending' | 'picked' | 'decanting' | 'fulfilled' | 'shipped';

interface OneTimeOrder {
  id: string;
  category: OrderCategory;
  customerName: string;
  perfumes: { name: string; size: string }[];
  status: OrderStatus;
  createdAt: string;
  priority: 'rush' | 'normal';
}

interface DailyBatch {
  id: string;
  date: string;
  cutoffTime: string;
  status: BatchStatus;
  orders: OneTimeOrder[];
  assignedStation?: string;
}

// ---- Config ----
const CATEGORY_CONFIG: Record<OrderCategory, { label: string; icon: React.ElementType; color: string; bgColor: string; description: string }> = {
  aurakey: { label: 'AuraKey', icon: Key, color: 'text-amber-600', bgColor: 'bg-amber-50', description: 'New AuraKey starter kits with atomiser + 3 vials' },
  aurakey_refill: { label: 'AuraKey Refills', icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-50', description: 'Refill vial packs for existing AuraKey holders' },
  whisper: { label: 'Whisper Vials', icon: Wind, color: 'text-purple-600', bgColor: 'bg-purple-50', description: '1ml & 2ml sample/discovery vials' },
  first_sub: { label: 'First-Time Subscription', icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-50', description: 'Welcome kits for new subscribers' },
};

const BATCH_STATUS_CONFIG: Record<BatchStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_cutoff: { label: 'Pending Cutoff', color: 'bg-slate-100 text-slate-700', icon: Clock },
  ready: { label: 'Ready for Production', color: 'bg-amber-100 text-amber-700', icon: Timer },
  in_production: { label: 'In Production', color: 'bg-blue-100 text-blue-700', icon: Beaker },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  picked: { label: 'Picked', color: 'bg-blue-100 text-blue-700' },
  decanting: { label: 'Decanting', color: 'bg-amber-100 text-amber-700' },
  fulfilled: { label: 'Fulfilled', color: 'bg-emerald-100 text-emerald-700' },
  shipped: { label: 'Shipped', color: 'bg-green-100 text-green-800' },
};

// ---- Mock Data ----
const mockBatches: DailyBatch[] = [
  {
    id: 'BATCH-0228',
    date: '2026-02-28',
    cutoffTime: '14:00',
    status: 'pending_cutoff',
    orders: [
      { id: 'AK-1201', category: 'aurakey', customerName: 'Sarah Al Maktoum', perfumes: [{ name: 'Baccarat Rouge 540', size: '8ml' }, { name: 'Oud Wood', size: '8ml' }, { name: 'Aventus', size: '8ml' }], status: 'pending', createdAt: '2026-02-28T08:30:00', priority: 'normal' },
      { id: 'AK-1202', category: 'aurakey', customerName: 'Ahmed Hassan', perfumes: [{ name: 'Layton', size: '8ml' }, { name: 'Sauvage Elixir', size: '8ml' }, { name: 'Bleu de Chanel', size: '8ml' }], status: 'pending', createdAt: '2026-02-28T09:15:00', priority: 'rush' },
      { id: 'AKR-0501', category: 'aurakey_refill', customerName: 'Fatima Khalid', perfumes: [{ name: 'Lost Cherry', size: '8ml' }, { name: 'Rehab', size: '8ml' }], status: 'pending', createdAt: '2026-02-28T07:45:00', priority: 'normal' },
      { id: 'AKR-0502', category: 'aurakey_refill', customerName: 'Omar Bin Rashid', perfumes: [{ name: 'Interlude Man', size: '8ml' }], status: 'pending', createdAt: '2026-02-28T10:00:00', priority: 'normal' },
      { id: 'WH-0301', category: 'whisper', customerName: 'Layla Noor', perfumes: [{ name: 'Oud Satin Mood', size: '1ml' }, { name: 'Grand Soir', size: '2ml' }], status: 'pending', createdAt: '2026-02-28T08:00:00', priority: 'normal' },
      { id: 'FS-0101', category: 'first_sub', customerName: 'Khalid Al Ameri', perfumes: [{ name: 'Baccarat Rouge 540', size: '8ml' }, { name: 'Aventus', size: '8ml' }, { name: 'Oud Wood', size: '8ml' }, { name: 'Layton', size: '8ml' }], status: 'pending', createdAt: '2026-02-28T06:30:00', priority: 'normal' },
      { id: 'FS-0102', category: 'first_sub', customerName: 'Noura Salem', perfumes: [{ name: 'Lost Cherry', size: '8ml' }, { name: 'Rehab', size: '8ml' }, { name: 'Delina', size: '8ml' }], status: 'pending', createdAt: '2026-02-28T11:00:00', priority: 'normal' },
    ],
  },
  {
    id: 'BATCH-0227',
    date: '2026-02-27',
    cutoffTime: '14:00',
    status: 'in_production',
    assignedStation: 'Picking → Decanting',
    orders: [
      { id: 'AK-1198', category: 'aurakey', customerName: 'Reem Al Falasi', perfumes: [{ name: 'Tobacco Vanille', size: '8ml' }, { name: 'Oud Wood', size: '8ml' }, { name: 'Tuscan Leather', size: '8ml' }], status: 'decanting', createdAt: '2026-02-27T09:00:00', priority: 'normal' },
      { id: 'AK-1199', category: 'aurakey', customerName: 'Youssef Mansour', perfumes: [{ name: 'Aventus', size: '8ml' }, { name: 'Green Irish Tweed', size: '8ml' }, { name: 'Viking', size: '8ml' }], status: 'picked', createdAt: '2026-02-27T10:30:00', priority: 'normal' },
      { id: 'AKR-0499', category: 'aurakey_refill', customerName: 'Hind Saeed', perfumes: [{ name: 'Baccarat Rouge 540', size: '8ml' }, { name: 'Oud Satin Mood', size: '8ml' }], status: 'fulfilled', createdAt: '2026-02-27T08:15:00', priority: 'normal' },
      { id: 'WH-0299', category: 'whisper', customerName: 'Tariq Ali', perfumes: [{ name: 'Layton', size: '1ml' }], status: 'fulfilled', createdAt: '2026-02-27T07:00:00', priority: 'normal' },
      { id: 'FS-0099', category: 'first_sub', customerName: 'Maryam Jaber', perfumes: [{ name: 'Delina', size: '8ml' }, { name: 'Lost Cherry', size: '8ml' }, { name: 'Rehab', size: '8ml' }, { name: 'Interlude Woman', size: '8ml' }], status: 'decanting', createdAt: '2026-02-27T06:00:00', priority: 'normal' },
    ],
  },
  {
    id: 'BATCH-0226',
    date: '2026-02-26',
    cutoffTime: '14:00',
    status: 'completed',
    orders: [
      { id: 'AK-1195', category: 'aurakey', customerName: 'Salim Nasser', perfumes: [{ name: 'Baccarat Rouge 540', size: '8ml' }, { name: 'Layton', size: '8ml' }, { name: 'Sauvage Elixir', size: '8ml' }], status: 'shipped', createdAt: '2026-02-26T08:00:00', priority: 'normal' },
      { id: 'AKR-0497', category: 'aurakey_refill', customerName: 'Dana Khalil', perfumes: [{ name: 'Oud Wood', size: '8ml' }], status: 'shipped', createdAt: '2026-02-26T09:00:00', priority: 'normal' },
      { id: 'WH-0297', category: 'whisper', customerName: 'Zain Mahmoud', perfumes: [{ name: 'Aventus', size: '2ml' }, { name: 'Tobacco Vanille', size: '1ml' }], status: 'shipped', createdAt: '2026-02-26T07:30:00', priority: 'normal' },
    ],
  },
];

// ---- Component ----
export default function OneTimeOrderProduction() {
  const [selectedBatch, setSelectedBatch] = useState<DailyBatch | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [detailOrder, setDetailOrder] = useState<OneTimeOrder | null>(null);

  // Stats
  const stats = useMemo(() => {
    const allOrders = mockBatches.flatMap(b => b.orders);
    const todayBatch = mockBatches.find(b => b.status === 'pending_cutoff');
    const inProd = mockBatches.filter(b => b.status === 'in_production');
    return {
      todayOrders: todayBatch?.orders.length ?? 0,
      inProduction: inProd.reduce((s, b) => s + b.orders.length, 0),
      totalVials: allOrders.reduce((s, o) => s + o.perfumes.length, 0),
      completedToday: mockBatches.filter(b => b.status === 'completed' && b.date === '2026-02-26').reduce((s, b) => s + b.orders.length, 0),
      byCategory: {
        aurakey: allOrders.filter(o => o.category === 'aurakey').length,
        aurakey_refill: allOrders.filter(o => o.category === 'aurakey_refill').length,
        whisper: allOrders.filter(o => o.category === 'whisper').length,
        first_sub: allOrders.filter(o => o.category === 'first_sub').length,
      },
    };
  }, []);

  // Filtered batch orders
  const filteredOrders = useMemo(() => {
    if (!selectedBatch) return [];
    let orders = selectedBatch.orders;
    if (categoryFilter !== 'all') orders = orders.filter(o => o.category === categoryFilter);
    if (search) orders = orders.filter(o => o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()));
    return orders;
  }, [selectedBatch, categoryFilter, search]);

  const handleStartProduction = (batch: DailyBatch) => {
    toast.success(`Batch ${batch.id} moved to production`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="One-Time Order Production"
        subtitle="Daily cutoff processing — AuraKey, Refills, Whisper vials, First-Time Subscriptions"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "Today's Orders", value: stats.todayOrders, icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
          { label: 'In Production', value: stats.inProduction, icon: Beaker, color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Vials Queued', value: stats.totalVials, icon: Package, color: 'bg-purple-50 text-purple-600' },
          { label: 'Completed (Yesterday)', value: stats.completedToday, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
        ] as const).map(kpi => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-lg', kpi.color.split(' ')[0])}>
                  <kpi.icon className={cn('w-5 h-5', kpi.color.split(' ')[1])} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(CATEGORY_CONFIG) as [OrderCategory, typeof CATEGORY_CONFIG[OrderCategory]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('p-1.5 rounded-md', cfg.bgColor)}><Icon className={cn('w-4 h-4', cfg.color)} /></div>
                  <span className="text-sm font-medium">{cfg.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
                <p className="text-lg font-bold mt-1">{stats.byCategory[key]} orders</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Daily Batches */}
      <SectionCard title="Daily Batches" subtitle="Each day's orders are grouped into a production batch at cutoff time (2:00 PM)">
        <div className="space-y-3">
          {mockBatches.map(batch => {
            const bCfg = BATCH_STATUS_CONFIG[batch.status];
            const BIcon = bCfg.icon;
            const catCounts = {
              aurakey: batch.orders.filter(o => o.category === 'aurakey').length,
              aurakey_refill: batch.orders.filter(o => o.category === 'aurakey_refill').length,
              whisper: batch.orders.filter(o => o.category === 'whisper').length,
              first_sub: batch.orders.filter(o => o.category === 'first_sub').length,
            };
            const totalVials = batch.orders.reduce((s, o) => s + o.perfumes.length, 0);
            const isSelected = selectedBatch?.id === batch.id;

            return (
              <Card
                key={batch.id}
                className={cn(
                  'border shadow-sm hover:shadow-md transition-all cursor-pointer',
                  isSelected && 'ring-2 ring-blue-500 border-blue-300',
                )}
                onClick={() => setSelectedBatch(isSelected ? null : batch)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-sm">
                          {new Date(batch.date).toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{batch.id}</Badge>
                      <Badge className={cn('text-[10px]', bCfg.color)}>
                        <BIcon className="w-3 h-3 mr-1" />
                        {bCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {batch.assignedStation && (
                        <Badge variant="outline" className="text-[10px]">{batch.assignedStation}</Badge>
                      )}
                      {batch.status === 'pending_cutoff' && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <Scissors className="w-3.5 h-3.5" />
                          <span>Cutoff at {batch.cutoffTime}</span>
                        </div>
                      )}
                      {batch.status === 'ready' && (
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); handleStartProduction(batch); }}>
                          <Play className="w-3 h-3" /> Start Production
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{batch.orders.length} orders</span>
                    <span>·</span>
                    <span>{totalVials} vials</span>
                    <span>·</span>
                    {Object.entries(catCounts).filter(([, v]) => v > 0).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1">
                        {(() => { const C = CATEGORY_CONFIG[k as OrderCategory]; const I = C.icon; return <I className={cn('w-3 h-3', C.color)} />; })()}
                        {v}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionCard>

      {/* Expanded Batch — Order List */}
      {selectedBatch && (
        <SectionCard
          title={`Batch ${selectedBatch.id} — Orders`}
          subtitle={`${new Date(selectedBatch.date).toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
        >
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="aurakey" className="text-xs">AuraKey</TabsTrigger>
                  <TabsTrigger value="aurakey_refill" className="text-xs">Refills</TabsTrigger>
                  <TabsTrigger value="whisper" className="text-xs">Whisper</TabsTrigger>
                  <TabsTrigger value="first_sub" className="text-xs">First Sub</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex-1" />
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
            </div>

            {/* Order Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredOrders.map(order => {
                const catCfg = CATEGORY_CONFIG[order.category];
                const CatIcon = catCfg.icon;
                const statusCfg = ORDER_STATUS_CONFIG[order.status];
                return (
                  <Card key={order.id} className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailOrder(order)}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1.5 rounded-md', catCfg.bgColor)}>
                            <CatIcon className={cn('w-3.5 h-3.5', catCfg.color)} />
                          </div>
                          <span className="text-xs font-mono font-medium">{order.id}</span>
                        </div>
                        <Badge className={cn('text-[10px]', statusCfg.color)}>{statusCfg.label}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order.customerName}</p>
                        {order.priority === 'rush' && (
                          <Badge className="text-[10px] bg-red-100 text-red-700 mt-1">RUSH</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {order.perfumes.map((p, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium">
                            {p.name} · {p.size}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{catCfg.label}</span>
                        <span>{new Date(order.createdAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredOrders.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">No orders match your filters</div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailOrder && (() => { const C = CATEGORY_CONFIG[detailOrder.category]; const I = C.icon; return <I className={cn('w-5 h-5', C.color)} />; })()}
              Order {detailOrder?.id}
            </DialogTitle>
            <DialogDescription>
              {detailOrder && CATEGORY_CONFIG[detailOrder.category].label} order details
            </DialogDescription>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{detailOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={cn('text-xs', ORDER_STATUS_CONFIG[detailOrder.status].color)}>
                    {ORDER_STATUS_CONFIG[detailOrder.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{CATEGORY_CONFIG[detailOrder.category].label}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(detailOrder.createdAt).toLocaleString('en-AE')}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Perfumes ({detailOrder.perfumes.length} vials)</p>
                <div className="space-y-2">
                  {detailOrder.perfumes.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge variant="outline" className="text-xs">{p.size}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {detailOrder.priority === 'rush' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700 font-medium">Rush order — prioritize in production queue</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOrder(null)}>Close</Button>
            <Button onClick={() => { toast.success('Order advanced to next stage'); setDetailOrder(null); }}>
              Advance Status <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
