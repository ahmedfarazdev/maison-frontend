// ============================================================
// Gift Sets — Like Capsules: link to End Product, fetch pricing from BOM
// Optional wrapping BOM (product BOM + wrapping BOM = 2 BOMs)
// Discount option, toggle visibility
// Detail view shows perfume contents, pricing breakdown, wrapping info
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Gift, Plus, Heart, Package, Star, TrendingUp,
  Search, Eye, Edit, Trash2, Loader2, ShoppingCart,
  Sparkles, Crown, Box, Link2, ToggleLeft, ToggleRight,
  Percent, Layers, AlertCircle, Droplets, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  for_him: { label: 'For Him', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', icon: Package },
  for_her: { label: 'For Her', color: 'text-pink-600', bg: 'bg-pink-500/10 border-pink-500/20', icon: Heart },
  seasonal: { label: 'Seasonal', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', icon: Star },
  // Fallback for old data
  gift_him: { label: 'For Him', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20', icon: Package },
  gift_her: { label: 'For Her', color: 'text-pink-600', bg: 'bg-pink-500/10 border-pink-500/20', icon: Heart },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Visible', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  draft: { label: 'Hidden', color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  ended: { label: 'Ended', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
};

// Mock end products for linking
const MOCK_END_PRODUCTS = [
  { productId: 'EP-GS001', name: 'Discovery Set For Him', category: 'gift_set_him', price: 399, bomId: 'BOM-GS001' },
  { productId: 'EP-GS002', name: 'Discovery Set For Her', category: 'gift_set_her', price: 399, bomId: 'BOM-GS002' },
  { productId: 'EP-GS003', name: 'Signature Collection', category: 'gift_set_him', price: 599, bomId: 'BOM-GS003' },
  { productId: 'EP-GS004', name: 'Eid Gift Box', category: 'gift_seasonal', price: 499, bomId: 'BOM-GS004' },
  { productId: 'EP-GS005', name: 'Valentine\'s Edition', category: 'gift_seasonal', price: 449, bomId: 'BOM-GS005' },
];

const MOCK_WRAPPING_BOMS = [
  { bomId: 'BOM-WRP01', name: 'Signature Box Wrapping', cost: 35 },
  { bomId: 'BOM-WRP02', name: 'Luxury Case Wrapping', cost: 65 },
  { bomId: 'BOM-WRP03', name: 'Personalized Wrapping', cost: 45 },
  { bomId: 'BOM-WRP04', name: 'Seasonal Special Wrapping', cost: 55 },
];

export default function Gifting() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null); // full gift set object

  // Real data
  const { data: setsData, isLoading: loading, refetch } = useApiQuery<any>(api.gifting.listSets);
  const { data: statsData } = useApiQuery<any>(api.gifting.stats);

  const sets = (setsData as any)?.data ?? [];
  const stats = statsData ?? { totalSets: 0, activeSets: 0, totalSold: 0, totalRevenue: 0, lowStock: 0 };

  const filtered = sets.filter((g: any) => {
    if (tab !== 'all' && g.type !== tab) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeCounts = sets.reduce((acc: Record<string, number>, g: any) => {
    acc[g.type] = (acc[g.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Create form
  const [form, setForm] = useState({
    name: '', type: 'for_him', description: '',
    endProductId: '', wrappingBomId: '',
    discountPercent: '0', inventoryCount: '0',
    visible: true,
  });

  // Auto-fetch price from linked End Product
  const linkedProduct = useMemo(() =>
    MOCK_END_PRODUCTS.find(ep => ep.productId === form.endProductId),
    [form.endProductId]
  );
  const linkedWrapping = useMemo(() =>
    MOCK_WRAPPING_BOMS.find(w => w.bomId === form.wrappingBomId),
    [form.wrappingBomId]
  );

  const basePrice = linkedProduct?.price ?? 0;
  const wrappingCost = linkedWrapping?.cost ?? 0;
  const discountAmount = basePrice * (Number(form.discountPercent) / 100);
  const finalPrice = basePrice - discountAmount + wrappingCost;

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.endProductId) { toast.error('End Product is required — link to a BOM'); return; }
    setCreating(true);
    try {
      const setId = `GFT-${Date.now().toString(36).toUpperCase()}`;
      await api.gifting.createSet({
        setId,
        name: form.name,
        category: form.type,
        description: form.description
          + (form.endProductId ? ` [EndProduct: ${form.endProductId}]` : '')
          + (form.wrappingBomId ? ` [WrappingBOM: ${form.wrappingBomId}]` : '')
          + (Number(form.discountPercent) > 0 ? ` [Discount: ${form.discountPercent}%]` : ''),
        price: String(finalPrice),
        wrappingIncluded: !!form.wrappingBomId,
        personalizationAvailable: false,
      });
      toast.success(`Gift set "${form.name}" created`);
      setShowCreate(false);
      setForm({ name: '', type: 'for_him', description: '', endProductId: '', wrappingBomId: '', discountPercent: '0', inventoryCount: '0', visible: true });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create gift set');
    } finally {
      setCreating(false);
    }
  }, [form, finalPrice, refetch]);

  const handleDelete = useCallback(async (e: React.MouseEvent, setId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete gift set "${name}"? This cannot be undone.`)) return;
    try {
      await api.gifting.deleteSet(setId);
      toast.success(`"${name}" deleted`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete');
    }
  }, [refetch]);

  const handleToggleVisibility = useCallback(async (e: React.MouseEvent, setId: string, currentStatus: string) => {
    e.stopPropagation();
    try {
      const newStatus = currentStatus === 'active' ? 'draft' : 'active';
      await api.gifting.updateSet(setId, { status: newStatus });
      toast.success(newStatus === 'active' ? 'Gift set is now visible' : 'Gift set is now hidden');
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    }
  }, [refetch]);

  return (
    <div>
      <PageHeader
        title="Gift Sets"
        subtitle="Curated gift sets linked to End Products — For Him, For Her, and Seasonal collections"
        actions={
          <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> New Gift Set
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center"><Gift className="w-5 h-5 text-pink-600" /></div><div><p className="text-2xl font-bold">{sets.length}</p><p className="text-xs text-muted-foreground">Total Sets</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Package className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{(typeCounts.for_him ?? 0) + (typeCounts.gift_him ?? 0)}</p><p className="text-xs text-muted-foreground">For Him</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center"><Heart className="w-5 h-5 text-pink-500" /></div><div><p className="text-2xl font-bold">{(typeCounts.for_her ?? 0) + (typeCounts.gift_her ?? 0)}</p><p className="text-xs text-muted-foreground">For Her</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Star className="w-5 h-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{typeCounts.seasonal ?? 0}</p><p className="text-xs text-muted-foreground">Seasonal</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{sets.reduce((s: number, g: any) => s + (g.sold ?? 0), 0)}</p><p className="text-xs text-muted-foreground">Total Sold</p></div></div></CardContent></Card>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({sets.length})</TabsTrigger>
              <TabsTrigger value="for_him">For Him ({(typeCounts.for_him ?? 0) + (typeCounts.gift_him ?? 0)})</TabsTrigger>
              <TabsTrigger value="for_her">For Her ({(typeCounts.for_her ?? 0) + (typeCounts.gift_her ?? 0)})</TabsTrigger>
              <TabsTrigger value="seasonal">Seasonal ({typeCounts.seasonal ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search gift sets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {/* Gift Set Cards — clickable to open detail */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((gift: any) => {
              const typeConfig = TYPE_LABELS[gift.type] ?? TYPE_LABELS.for_him;
              const statusConfig = STATUS_CONFIG[gift.status] ?? STATUS_CONFIG.draft;
              const TypeIcon = typeConfig.icon;
              const perfumes: string[] = gift.perfumes ?? [];
              const price = Number(gift.price ?? gift.priceAed ?? gift.finalPrice ?? 0);
              const discount = Number(gift.discountPercent ?? 0);

              return (
                <Card
                  key={gift.setId}
                  className={cn(
                    'transition-all hover:shadow-lg hover:border-gold/30 cursor-pointer group',
                    gift.stock > 0 && gift.stock < 10 && 'border-amber-500/30'
                  )}
                  onClick={() => setShowDetail(gift)}
                >
                  <CardContent className="p-0">
                    {/* Header strip */}
                    <div className={cn('px-5 py-3 border-b flex items-center justify-between', typeConfig.bg)}>
                      <div className="flex items-center gap-2">
                        <TypeIcon className={cn('w-4 h-4', typeConfig.color)} />
                        <span className={cn('text-xs font-bold uppercase tracking-wider', typeConfig.color)}>{typeConfig.label}</span>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', statusConfig.bg, statusConfig.color)}>
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="p-5">
                      {/* Title + description */}
                      <h3 className="text-lg font-bold mb-1 group-hover:text-gold transition-colors">{gift.name}</h3>
                      {gift.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{gift.description}</p>}

                      {/* Perfume preview chips */}
                      {perfumes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {perfumes.slice(0, 4).map((p: string, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border font-medium">
                              <Droplets className="w-2.5 h-2.5 text-gold" />
                              {p}
                            </span>
                          ))}
                          {perfumes.length > 4 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">+{perfumes.length - 4} more</span>
                          )}
                        </div>
                      )}

                      {/* Vial info */}
                      {gift.vialCount && (
                        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                          <Box className="w-3 h-3" />
                          <span>{gift.vialCount} × {gift.vialSize ?? '8ml'} vials</span>
                          {gift.includes && <><span>·</span><span className="text-amber-600">{gift.includes}</span></>}
                        </div>
                      )}

                      {/* BOM Link indicator */}
                      {(gift.endProductId || gift.endProductName) && (
                        <div className="flex items-center gap-1.5 mb-3">
                          <Link2 className="w-3 h-3 text-blue-500" />
                          <span className="text-[10px] text-blue-600 font-medium">{gift.endProductName ?? 'Linked to End Product'}</span>
                          {(gift.wrappingBomId || gift.wrappingBomName) && (
                            <>
                              <span className="text-muted-foreground mx-1">+</span>
                              <Layers className="w-3 h-3 text-amber-500" />
                              <span className="text-[10px] text-amber-600 font-medium">{gift.wrappingBomName ?? 'Wrapping'}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Price + stock row */}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          {discount > 0 && (
                            <span className="text-xs text-muted-foreground line-through">AED {(price / (1 - discount / 100)).toFixed(0)}</span>
                          )}
                          <span className="text-lg font-bold text-gold">AED {price.toFixed(0)}</span>
                          {discount > 0 && (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">-{discount}%</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{gift.sold ?? 0} sold</span>
                          <span>·</span>
                          {gift.stock === 0 ? (
                            <span className="text-red-500 font-medium">Out of Stock</span>
                          ) : gift.stock < 10 ? (
                            <span className="text-amber-600 font-medium">{gift.stock} left</span>
                          ) : (
                            <span>{gift.stock} in stock</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="px-5 py-2.5 border-t bg-muted/30 flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={(e) => { e.stopPropagation(); setShowDetail(gift); }}>
                        <Eye className="w-3 h-3" /> Details
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="sm" className="text-xs gap-1 h-7"
                          onClick={(e) => handleToggleVisibility(e, gift.setId, gift.status)}
                        >
                          {gift.status === 'active' ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                          {gift.status === 'active' ? 'Hide' : 'Show'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7 w-7 p-0" onClick={(e) => handleDelete(e, gift.setId, gift.name)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <Gift className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No gift sets found</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Create First Gift Set</Button>
          </div>
        )}
      </div>

      {/* Create Dialog — Like Capsules: requires End Product link */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Gift Set</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Marketing Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. The Discovery Set" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="for_him">Gift Set For Him</SelectItem>
                    <SelectItem value="for_her">Gift Set For Her</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Gift set description for customers" /></div>

            {/* REQUIRED: Link to End Product */}
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <Label className="flex items-center gap-1.5 mb-2"><Link2 className="w-3.5 h-3.5 text-blue-500" /> Link to End Product (Required) *</Label>
              <Select value={form.endProductId} onValueChange={v => setForm(f => ({ ...f, endProductId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select end product..." /></SelectTrigger>
                <SelectContent>
                  {MOCK_END_PRODUCTS.map(ep => (
                    <SelectItem key={ep.productId} value={ep.productId}>
                      {ep.name} — AED {ep.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkedProduct && (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">BOM: <span className="font-mono">{linkedProduct.bomId}</span></span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold text-foreground">Price from BOM: AED {linkedProduct.price}</span>
                </div>
              )}
              {!form.endProductId && (
                <p className="mt-1.5 text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Price is fetched from the linked End Product's BOM
                </p>
              )}
            </div>

            {/* Optional: Wrapping BOM */}
            <div>
              <Label className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-amber-500" /> Wrapping BOM (Optional)</Label>
              <Select value={form.wrappingBomId} onValueChange={v => setForm(f => ({ ...f, wrappingBomId: v }))}>
                <SelectTrigger><SelectValue placeholder="No wrapping" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Wrapping</SelectItem>
                  {MOCK_WRAPPING_BOMS.map(w => (
                    <SelectItem key={w.bomId} value={w.bomId}>
                      {w.name} — AED {w.cost}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkedWrapping && (
                <p className="mt-1 text-[10px] text-muted-foreground">Wrapping cost: AED {linkedWrapping.cost} (added to final price)</p>
              )}
            </div>

            {/* Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Discount (%)</Label>
                <Input type="number" min="0" max="50" value={form.discountPercent} onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))} />
              </div>
              <div>
                <Label>Assembled Inventory</Label>
                <Input type="number" min={0} value={form.inventoryCount} onChange={e => setForm(f => ({ ...f, inventoryCount: e.target.value }))} />
              </div>
            </div>

            {/* Price Summary */}
            {linkedProduct && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Price Breakdown</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Product BOM Price</span><span>AED {basePrice}</span></div>
                  {Number(form.discountPercent) > 0 && (
                    <div className="flex justify-between text-red-500"><span>Discount ({form.discountPercent}%)</span><span>-AED {discountAmount.toFixed(0)}</span></div>
                  )}
                  {linkedWrapping && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Wrapping BOM</span><span>+AED {wrappingCost}</span></div>
                  )}
                  <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                    <span>Final Price</span><span className="text-gold">AED {finalPrice.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Visibility Toggle */}
            <div className="flex items-center gap-3">
              <button onClick={() => setForm(f => ({ ...f, visible: !f.visible }))} className="text-muted-foreground hover:text-foreground">
                {form.visible ? <ToggleRight className="w-8 h-5 text-emerald-500" /> : <ToggleLeft className="w-8 h-5" />}
              </button>
              <span className="text-sm">{form.visible ? 'Visible to customers' : 'Hidden (draft)'}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-pink-600 hover:bg-pink-700 text-white" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Create Gift Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog — uses the gift set object directly from list */}
      {showDetail && (
        <Dialog open onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', (TYPE_LABELS[showDetail.type] ?? TYPE_LABELS.for_him).bg)}>
                  {(() => { const Icon = (TYPE_LABELS[showDetail.type] ?? TYPE_LABELS.for_him).icon; return <Icon className={cn('w-5 h-5', (TYPE_LABELS[showDetail.type] ?? TYPE_LABELS.for_him).color)} />; })()}
                </div>
                <div>
                  <span className="text-xl">{showDetail.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', (TYPE_LABELS[showDetail.type] ?? TYPE_LABELS.for_him).bg, (TYPE_LABELS[showDetail.type] ?? TYPE_LABELS.for_him).color)}>
                      {(TYPE_LABELS[showDetail.type] ?? TYPE_LABELS.for_him).label}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', (STATUS_CONFIG[showDetail.status] ?? STATUS_CONFIG.draft).bg, (STATUS_CONFIG[showDetail.status] ?? STATUS_CONFIG.draft).color)}>
                      {(STATUS_CONFIG[showDetail.status] ?? STATUS_CONFIG.draft).label}
                    </Badge>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Description */}
              {showDetail.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{showDetail.description}</p>
              )}

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gold/5 border border-gold/20 text-center">
                  <p className="text-xl font-bold text-gold">AED {Number(showDetail.price ?? showDetail.priceAed ?? showDetail.finalPrice ?? 0).toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">Final Price</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold">{showDetail.vialCount ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Vials ({showDetail.vialSize ?? '8ml'})</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold">{showDetail.stock ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">In Stock</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold">{showDetail.sold ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Sold</p>
                </div>
              </div>

              {/* Discount info */}
              {Number(showDetail.discountPercent ?? 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <Percent className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600">{showDetail.discountPercent}% discount applied</span>
                  <span className="text-xs text-muted-foreground ml-auto">Original: AED {(Number(showDetail.price ?? 0) / (1 - Number(showDetail.discountPercent) / 100)).toFixed(0)}</span>
                </div>
              )}

              {/* BOM Links */}
              <div className="space-y-2">
                {(showDetail.endProductId || showDetail.endProductName) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <Link2 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-600">End Product: {showDetail.endProductName ?? showDetail.endProductId}</span>
                  </div>
                )}
                {(showDetail.wrappingBomId || showDetail.wrappingBomName) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600">Wrapping: {showDetail.wrappingBomName ?? showDetail.wrappingBomId}</span>
                  </div>
                )}
              </div>

              {/* Perfume Contents */}
              {(showDetail.perfumes?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-gold" />
                    Gift Set Contents ({showDetail.perfumes.length} perfumes)
                  </h4>
                  <div className="space-y-2">
                    {showDetail.perfumes.map((p: string, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50 border border-border hover:border-gold/30 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold">{i + 1}</div>
                        <div className="flex-1">
                          <span className="text-sm font-medium">{p}</span>
                          <span className="text-xs text-muted-foreground ml-2">{showDetail.vialSize ?? '8ml'} vial</span>
                        </div>
                        <Droplets className="w-4 h-4 text-gold/40" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Includes */}
              {showDetail.includes && (
                <div className="px-4 py-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">Also includes: {showDetail.includes}</span>
                  </div>
                </div>
              )}

              {/* Created date */}
              {showDetail.createdAt && (
                <p className="text-xs text-muted-foreground">Created: {new Date(showDetail.createdAt).toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
