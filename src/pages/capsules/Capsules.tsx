// ============================================================
// Capsules — Public Limited Drops Management
// Types: Themed Sets | House Chapters | Layering Sets | Scent Stories
// REQUIRED: End Product link → auto-fetch price from BOM
// Subscriber price: auto-applies 15% from settings (not shown)
// Toggle visibility on/off anytime
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Gem, Plus, Package, TrendingUp, Eye, Droplets, Timer,
  Search, CheckCircle2, Trash2, Loader2, Link2, EyeOff,
  Calendar, AlertCircle, ToggleLeft, Users, Edit,
  X, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  themed_set: { label: 'Themed Set', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/20', icon: '🎨' },
  house_chapter: { label: 'House Chapter', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', icon: '🏛️' },
  layering_set: { label: 'Layering Set', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '🧪' },
  scent_story: { label: 'Scent Story', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', icon: '📖' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  visible: { label: 'Visible', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  hidden: { label: 'Hidden', color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  sold_out: { label: 'Sold Out', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
  draft: { label: 'Draft', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
};

// Mock end products for linking
const MOCK_END_PRODUCTS = [
  { id: 'ep-desert-nights', name: 'Desert Nights Collection', category: 'capsule', price: 450, costPerUnit: 180 },
  { id: 'ep-oud-masters', name: 'Oud Masters Set', category: 'capsule', price: 680, costPerUnit: 290 },
  { id: 'ep-summer-breeze', name: 'Summer Breeze Trio', category: 'capsule', price: 320, costPerUnit: 130 },
  { id: 'ep-rose-collection', name: 'Rose Collection', category: 'capsule', price: 520, costPerUnit: 210 },
  { id: 'ep-layering-101', name: 'Layering 101 Kit', category: 'capsule', price: 390, costPerUnit: 155 },
  { id: 'ep-discovery-set', name: 'Discovery Set', category: 'capsule', price: 280, costPerUnit: 110 },
];

export default function Capsules() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null); // full capsule object
  const [showTimingDialog, setShowTimingDialog] = useState<any>(null);

  // Real data from backend
  const { data: dropsData, isLoading: loading, refetch } = useApiQuery<any>(api.capsules.listDrops);
  const { data: statsData } = useApiQuery<any>(api.capsules.stats);

  const drops = (dropsData as any)?.data ?? [];
  const stats = statsData ?? { totalDrops: 0, liveDrops: 0, totalSold: 0, totalRevenue: 0, sellThrough: 0, remainingAllocation: 0 };

  // Create form state — End Product is REQUIRED
  const [form, setForm] = useState({
    name: '', type: 'themed_set', theme: '', description: '',
    launchDate: '', endDate: '', maxAllocation: 100,
    endProductId: '', // REQUIRED
    discountPercent: 0, // optional discount for everyone
  });

  // Auto-fetch price from linked End Product
  const linkedProduct = useMemo(() => {
    return MOCK_END_PRODUCTS.find(p => p.id === form.endProductId);
  }, [form.endProductId]);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.endProductId) { toast.error('End Product link is required — every capsule must connect to a BOM'); return; }
    setCreating(true);
    try {
      const price = linkedProduct?.price ?? 0;
      const finalPrice = form.discountPercent > 0 ? price * (1 - form.discountPercent / 100) : price;
      const dropId = `CAP-${Date.now().toString(36).toUpperCase()}`;
      await api.capsules.createDrop({
        dropId, ...form,
        price: String(finalPrice),
        subscriberPrice: String(finalPrice * 0.85), // auto 15% off
      });
      toast.success(`Capsule "${form.name}" created — linked to ${linkedProduct?.name}`);
      setShowCreate(false);
      setForm({ name: '', type: 'themed_set', theme: '', description: '', launchDate: '', endDate: '', maxAllocation: 100, endProductId: '', discountPercent: 0 });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create capsule');
    } finally {
      setCreating(false);
    }
  }, [form, linkedProduct, refetch]);

  const handleDelete = useCallback(async (e: React.MouseEvent, dropId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete capsule "${name}"? This cannot be undone.`)) return;
    try {
      await api.capsules.deleteDrop(dropId);
      toast.success(`Capsule "${name}" deleted`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete');
    }
  }, [refetch]);

  // Toggle visibility — can toggle off anytime, even if launch/end date set
  const handleToggleVisibility = useCallback(async (e: React.MouseEvent | null, capsule: any) => {
    if (e) e.stopPropagation();
    const isCurrentlyVisible = capsule.status === 'visible';
    if (isCurrentlyVisible) {
      try {
        await api.capsules.updateDrop(capsule.dropId, { status: 'hidden' });
        toast.success(`"${capsule.name}" is now hidden`);
        refetch();
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to hide');
      }
    } else {
      if (!capsule.launchDate) {
        setShowTimingDialog(capsule);
      } else {
        try {
          await api.capsules.updateDrop(capsule.dropId, { status: 'visible' });
          toast.success(`"${capsule.name}" is now visible`);
          refetch();
        } catch (e: any) {
          toast.error(e?.message ?? 'Failed to show');
        }
      }
    }
  }, [refetch]);

  const handleSetTimingAndShow = useCallback(async (capsule: any, launchDate: string, endDate: string) => {
    try {
      await api.capsules.updateDrop(capsule.dropId, { status: 'visible', launchDate, endDate });
      toast.success(`"${capsule.name}" is now visible (${launchDate} → ${endDate})`);
      setShowTimingDialog(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    }
  }, [refetch]);

  const filtered = drops.filter((c: any) => {
    if (tab !== 'all' && c.status !== tab) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Capsules"
        subtitle="Public limited drops — each linked to an End Product/BOM for auto-pricing"
        actions={
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-3.5 h-3.5" /> New Capsule
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Gem, label: 'Total Capsules', value: stats.totalDrops || drops.length, color: 'text-purple-600', bg: 'bg-purple-500/10' },
            { icon: CheckCircle2, label: 'Visible', value: stats.liveDrops || drops.filter((c: any) => c.status === 'visible').length, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
            { icon: TrendingUp, label: 'Sell-Through', value: `${stats.sellThrough}%`, color: 'text-gold', bg: 'bg-gold/10' },
            { icon: Package, label: 'Units Sold', value: stats.totalSold, color: 'text-blue-600', bg: 'bg-blue-500/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}><Icon className={cn('w-4 h-4', color)} /></div>
                  <div><p className="text-xl font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({drops.length})</TabsTrigger>
              <TabsTrigger value="visible">Visible ({drops.filter((c: any) => c.status === 'visible').length})</TabsTrigger>
              <TabsTrigger value="hidden">Hidden ({drops.filter((c: any) => c.status === 'hidden').length})</TabsTrigger>
              <TabsTrigger value="sold_out">Sold Out ({drops.filter((c: any) => c.status === 'sold_out').length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search capsules..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {/* Loading */}
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {/* Capsule Cards — Grid Layout */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((capsule: any) => {
              const sellThrough = capsule.maxAllocation > 0 ? Math.round((capsule.sold / capsule.maxAllocation) * 100) : 0;
              const typeConfig = TYPE_LABELS[capsule.type] ?? TYPE_LABELS.themed_set;
              const statusConfig = STATUS_CONFIG[capsule.status] ?? STATUS_CONFIG.draft;
              const isVisible = capsule.status === 'visible';
              const isSoldOut = capsule.status === 'sold_out';
              const daysLeft = isVisible && capsule.endDate
                ? Math.max(0, Math.ceil((new Date(capsule.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
              const perfumeList: string[] = capsule.perfumes ?? [];

              return (
                <Card
                  key={capsule.dropId}
                  className={cn(
                    'transition-all hover:shadow-lg cursor-pointer group overflow-hidden',
                    isVisible && 'border-purple-500/30 shadow-purple-500/5 hover:border-purple-500/50',
                    capsule.status === 'hidden' && 'opacity-70',
                    isSoldOut && 'border-red-500/20',
                  )}
                  onClick={() => setShowDetail(capsule)}
                >
                  <CardContent className="p-0">
                    {/* Type header strip */}
                    <div className={cn(
                      'px-5 py-2.5 border-b flex items-center justify-between',
                      isVisible ? 'bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent' : 'bg-muted/30',
                    )}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', typeConfig.bg, typeConfig.color)}>
                          {typeConfig.label}
                        </Badge>
                        {capsule.theme && (
                          <span className="text-[10px] text-muted-foreground italic">{capsule.theme}</span>
                        )}
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', statusConfig.bg, statusConfig.color)}>
                        {isVisible ? <Eye className="w-2.5 h-2.5 mr-0.5" /> : <EyeOff className="w-2.5 h-2.5 mr-0.5" />}
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="p-5">
                      {/* Title + price */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-base font-bold group-hover:text-purple-600 transition-colors leading-tight">
                          {capsule.name}
                        </h3>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-gold">AED {Number(capsule.price).toFixed(0)}</p>
                          {capsule.discountPercent > 0 && (
                            <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-500 border-red-500/20">
                              {capsule.discountPercent}% off
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* End Product link */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <Link2 className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] text-blue-600 font-medium">{capsule.endProductName ?? capsule.endProductId ?? 'Not linked'}</span>
                        <span className="text-[10px] text-muted-foreground/60">→ BOM</span>
                      </div>

                      {capsule.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{capsule.description}</p>
                      )}

                      {/* Perfume preview chips */}
                      {perfumeList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {perfumeList.slice(0, 3).map((p: string, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/5 border border-purple-500/15 font-medium text-foreground">
                              <Droplets className="w-2.5 h-2.5 text-purple-500" />
                              {p}
                            </span>
                          ))}
                          {perfumeList.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              +{perfumeList.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Sell-through progress */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">
                            {capsule.sold}/{capsule.maxAllocation} sold
                          </span>
                          <span className={cn('text-[10px] font-mono font-bold',
                            sellThrough >= 80 ? 'text-emerald-600' : sellThrough >= 50 ? 'text-purple-600' : 'text-amber-600'
                          )}>
                            {sellThrough}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              sellThrough >= 80 ? 'bg-emerald-500' : sellThrough >= 50 ? 'bg-purple-500' : 'bg-amber-500',
                            )}
                            style={{ width: `${Math.min(sellThrough, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Date + countdown */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                        {capsule.launchDate && capsule.endDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(capsule.launchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(capsule.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {daysLeft !== null && (
                          <Badge variant="outline" className="text-[9px] font-mono bg-gold/10 text-gold border-gold/20">
                            <Timer className="w-2.5 h-2.5 mr-0.5" />{daysLeft}d left
                          </Badge>
                        )}
                        {capsule.vialSize && (
                          <span className="flex items-center gap-1">
                            <Droplets className="w-2.5 h-2.5" /> {capsule.vialCount}× {capsule.vialSize}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="px-5 py-2.5 border-t bg-muted/30 flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={(e) => { e.stopPropagation(); setShowDetail(capsule); }}>
                        <Eye className="w-3 h-3" /> Details
                      </Button>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1.5 mr-1">
                          <span className="text-[10px] text-muted-foreground">{isVisible ? 'Visible' : 'Hidden'}</span>
                          <Switch
                            checked={isVisible}
                            onCheckedChange={() => handleToggleVisibility(null, capsule)}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7 w-7 p-0" onClick={(e) => handleDelete(e, capsule.dropId, capsule.name)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="col-span-full border border-dashed border-border rounded-lg p-12 text-center">
                <Gem className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No capsules found</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Create First Capsule
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== CREATE DIALOG ===== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gem className="w-4 h-4 text-purple-600" /> New Capsule Drop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Desert Nights Collection" />
            </div>

            {/* REQUIRED: End Product Link */}
            <div>
              <Label className="flex items-center gap-1">
                <Link2 className="w-3 h-3 text-blue-500" /> End Product (Required) *
              </Label>
              <Select value={form.endProductId} onValueChange={v => setForm(f => ({ ...f, endProductId: v }))}>
                <SelectTrigger className={cn(!form.endProductId && 'border-red-500/50')}>
                  <SelectValue placeholder="Select End Product from BOM..." />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_END_PRODUCTS.map(ep => (
                    <SelectItem key={ep.id} value={ep.id}>
                      {ep.name} — AED {ep.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.endProductId && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Every capsule must be linked to an End Product for auto-pricing
                </p>
              )}
            </div>

            {/* Auto-fetched pricing */}
            {linkedProduct && (
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Price from End Product</p>
                      <p className="text-lg font-bold text-gold">AED {linkedProduct.price}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Subscriber Price (auto 15% off)</p>
                      <p className="text-sm font-semibold text-emerald-600">AED {(linkedProduct.price * 0.85).toFixed(0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Cost/Unit</p>
                      <p className="text-sm font-mono">AED {linkedProduct.costPerUnit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="themed_set">Themed Set</SelectItem>
                    <SelectItem value="house_chapter">House Chapter</SelectItem>
                    <SelectItem value="layering_set">Layering Set</SelectItem>
                    <SelectItem value="scent_story">Scent Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Allocation</Label>
                <Input type="number" value={form.maxAllocation} onChange={e => setForm(f => ({ ...f, maxAllocation: Number(e.target.value) }))} />
              </div>
            </div>

            <div>
              <Label>Theme</Label>
              <Input value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} placeholder="e.g. Arabian Oud & Amber" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            {/* Optional discount for everyone */}
            <div>
              <Label>Discount for Everyone (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={50}
                  value={form.discountPercent}
                  onChange={e => setForm(f => ({ ...f, discountPercent: Number(e.target.value) }))}
                  className="max-w-[100px]"
                />
                {form.discountPercent > 0 && linkedProduct && (
                  <span className="text-xs text-muted-foreground">
                    Final: AED {(linkedProduct.price * (1 - form.discountPercent / 100)).toFixed(0)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Launch Date (optional)</Label>
                <Input type="date" value={form.launchDate} onChange={e => setForm(f => ({ ...f, launchDate: e.target.value }))} />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleCreate} disabled={creating || !form.endProductId}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Create Capsule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== TIMING DIALOG (when toggling visibility on without dates) ===== */}
      {showTimingDialog && <TimingDialog capsule={showTimingDialog} onConfirm={handleSetTimingAndShow} onClose={() => setShowTimingDialog(null)} />}

      {/* Detail Dialog */}
      {showDetail && <CapsuleDetailDialog capsule={showDetail} onClose={() => setShowDetail(null)} onRefresh={refetch} onToggleVisibility={handleToggleVisibility} />}
    </div>
  );
}

// ---- Timing Dialog (popup when re-opening a capsule) ----
function TimingDialog({ capsule, onConfirm, onClose }: { capsule: any; onConfirm: (c: any, launch: string, end: string) => void; onClose: () => void }) {
  const [launch, setLaunch] = useState(capsule.launchDate ?? new Date().toISOString().split('T')[0]);
  const [end, setEnd] = useState(capsule.endDate ?? '');

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ToggleLeft className="w-4 h-4 text-emerald-600" /> Set Timing for "{capsule.name}"
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This capsule doesn't have dates set. Choose when it should be visible:
        </p>
        <div className="space-y-3">
          <div>
            <Label>Launch Date</Label>
            <Input type="date" value={launch} onChange={e => setLaunch(e.target.value)} />
          </div>
          <div>
            <Label>End Date (optional)</Label>
            <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onConfirm(capsule, launch, end)} disabled={!launch}>
            Make Visible
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Capsule Detail Dialog (view + manage items + edit) ----
function CapsuleDetailDialog({
  capsule,
  onClose,
  onRefresh,
  onToggleVisibility,
}: {
  capsule: any;
  onClose: () => void;
  onRefresh: () => void;
  onToggleVisibility: (e: React.MouseEvent | null, capsule: any) => void;
}) {
  const [addingItem, setAddingItem] = useState(false);
  const [showAddPerfume, setShowAddPerfume] = useState(false);
  const [itemForm, setItemForm] = useState({ masterId: '', perfumeName: '', brand: '', sizeMl: 8, unitPrice: '0' });

  const typeConfig = TYPE_LABELS[capsule.type] ?? TYPE_LABELS.themed_set;
  const statusConfig = STATUS_CONFIG[capsule.status] ?? STATUS_CONFIG.draft;
  const isVisible = capsule.status === 'visible';
  const isSoldOut = capsule.status === 'sold_out';
  const sellThrough = capsule.maxAllocation > 0 ? Math.round((capsule.sold / capsule.maxAllocation) * 100) : 0;
  const perfumeList: string[] = capsule.perfumes ?? [];

  const handleAddItem = async () => {
    if (!itemForm.masterId || !itemForm.perfumeName) { toast.error('Master ID and name required'); return; }
    setAddingItem(true);
    try {
      await api.capsules.addItem({ dropId: capsule.dropId, ...itemForm, sizeMl: itemForm.sizeMl, unitPrice: itemForm.unitPrice });
      toast.success('Item added');
      setItemForm({ masterId: '', perfumeName: '', brand: '', sizeMl: 8, unitPrice: '0' });
      setShowAddPerfume(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (id: number) => {
    try {
      await api.capsules.removeItem(id);
      toast.success('Item removed');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove');
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-purple-600" />
            <span className="text-xl">{capsule.name}</span>
            <Badge variant="outline" className={cn('text-[10px] uppercase ml-2', statusConfig.bg, statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Info strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
              <p className="text-sm font-bold">{typeConfig.label}</p>
            </div>
            <div className="p-3 rounded-lg bg-gold/5 border border-gold/15 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-sm font-bold text-gold">AED {Number(capsule.price).toFixed(0)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Allocation</p>
              <p className="text-sm font-bold">{capsule.maxAllocation}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sold</p>
              <p className="text-sm font-bold">{capsule.sold} ({sellThrough}%)</p>
            </div>
          </div>

          {/* End Product link */}
          {capsule.endProductId && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-600">Linked to: {capsule.endProductName ?? capsule.endProductId}</span>
                <span className="text-xs text-muted-foreground ml-auto">Price auto-fetched from BOM</span>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          {capsule.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{capsule.description}</p>
          )}

          {/* Sell-through bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{capsule.sold}/{capsule.maxAllocation} sold · {capsule.maxAllocation - capsule.sold} remaining</span>
              <span className={cn('text-xs font-mono font-bold',
                sellThrough >= 80 ? 'text-emerald-600' : sellThrough >= 50 ? 'text-purple-600' : 'text-amber-600'
              )}>{sellThrough}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all',
                  sellThrough >= 80 ? 'bg-emerald-500' : sellThrough >= 50 ? 'bg-purple-500' : 'bg-amber-500',
                )}
                style={{ width: `${Math.min(sellThrough, 100)}%` }}
              />
            </div>
          </div>

          {/* Date range */}
          {capsule.launchDate && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(capsule.launchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {capsule.endDate && ` → ${new Date(capsule.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </span>
            </div>
          )}

          {/* Pricing details */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="p-2 rounded bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground">Retail Price</p>
              <p className="font-bold text-gold">AED {Number(capsule.price).toFixed(0)}</p>
            </div>
            <div className="p-2 rounded bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground">Subscriber Price</p>
              <p className="font-bold text-emerald-600">AED {Number(capsule.subscriberPrice).toFixed(0)}</p>
            </div>
            {capsule.discountPercent > 0 && (
              <div className="p-2 rounded bg-red-500/5 border border-red-500/15">
                <p className="text-[10px] text-muted-foreground">Discount</p>
                <p className="font-bold text-red-500">{capsule.discountPercent}% off for all</p>
              </div>
            )}
          </div>

          {/* Perfumes in Set */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Droplets className="w-4 h-4 text-purple-600" /> Perfumes in Set ({perfumeList.length})
              </h4>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowAddPerfume(!showAddPerfume)}>
                {showAddPerfume ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {showAddPerfume ? 'Cancel' : 'Add Perfume'}
              </Button>
            </div>

            {perfumeList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {perfumeList.map((perfume: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/5 to-transparent border border-purple-500/15 group/item">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <Droplets className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{perfume}</p>
                      {capsule.vialSize && (
                        <p className="text-[10px] text-muted-foreground">{capsule.vialSize} vial</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg p-6 text-center">
                <Droplets className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No perfumes listed — click "Add Perfume" above</p>
              </div>
            )}
          </div>

          {/* Add Perfume Section */}
          {showAddPerfume && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Perfume to Set</h4>
              <div className="grid grid-cols-5 gap-2">
                <Input placeholder="Master ID" value={itemForm.masterId} onChange={e => setItemForm(f => ({ ...f, masterId: e.target.value }))} className="text-xs" />
                <Input placeholder="Perfume Name" value={itemForm.perfumeName} onChange={e => setItemForm(f => ({ ...f, perfumeName: e.target.value }))} className="text-xs" />
                <Input placeholder="Brand" value={itemForm.brand} onChange={e => setItemForm(f => ({ ...f, brand: e.target.value }))} className="text-xs" />
                <Input type="number" placeholder="ml" value={itemForm.sizeMl} onChange={e => setItemForm(f => ({ ...f, sizeMl: Number(e.target.value) }))} className="text-xs" />
                <Button size="sm" onClick={handleAddItem} disabled={addingItem} className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                  {addingItem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                className={cn('text-xs gap-1', isVisible ? 'text-amber-600' : 'text-emerald-600')}
                onClick={() => { onToggleVisibility(null, capsule); onClose(); }}
              >
                {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {isVisible ? 'Hide' : 'Make Visible'}
              </Button>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
