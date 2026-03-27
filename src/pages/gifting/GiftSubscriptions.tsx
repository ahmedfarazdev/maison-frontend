// ============================================================
// Gift Subscriptions — Link to End Product/BOM
// NOT custom pricing — select a subscription BOM (3mo, 6mo, 12mo)
// Auto-fetch duration, vials/month, total price from BOM
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Gift, Plus, DollarSign, Search, Loader2,
  Clock, CheckCircle2, CalendarDays, Heart,
  Eye, Link2, AlertCircle, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  pending: { label: 'Pending Activation', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
  completed: { label: 'Completed', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
};

// Subscription End Products / BOMs — auto-fetch data from these
const SUBSCRIPTION_BOMS = [
  {
    productId: 'EP-SUB3M',
    name: 'AuraKey Gift — 3 Months',
    bomId: 'BOM-SUB3M',
    months: 3,
    vialsPerMonth: 2,
    price: 674.97,
    description: '3-month AuraKey subscription gift. 2 curated vials per month + Whisperer vials. Includes AuraKey atomiser.',
    includesAuraKey: true,
  },
  {
    productId: 'EP-SUB6M',
    name: 'AuraKey Gift — 6 Months',
    bomId: 'BOM-SUB6M',
    months: 6,
    vialsPerMonth: 2,
    price: 1349.94,
    description: '6-month AuraKey subscription gift. 2 curated vials per month + Whisperer vials. Includes AuraKey atomiser.',
    includesAuraKey: true,
  },
  {
    productId: 'EP-SUB12M',
    name: 'AuraKey Gift — 12 Months (Annual)',
    bomId: 'BOM-SUB12M',
    months: 12,
    vialsPerMonth: 2,
    price: 2429.89,
    description: '12-month AuraKey subscription gift with annual discount. 2 curated vials per month + Whisperer vials. Includes AuraKey atomiser.',
    includesAuraKey: true,
  },
  {
    productId: 'EP-SUB3M-3V',
    name: 'AuraKey Gift — 3 Months (3 Vials)',
    bomId: 'BOM-SUB3M-3V',
    months: 3,
    vialsPerMonth: 3,
    price: 899.97,
    description: '3-month AuraKey subscription gift. 3 curated vials per month + Whisperer vials. Includes AuraKey atomiser.',
    includesAuraKey: true,
  },
  {
    productId: 'EP-SUB6M-3V',
    name: 'AuraKey Gift — 6 Months (3 Vials)',
    bomId: 'BOM-SUB6M-3V',
    months: 6,
    vialsPerMonth: 3,
    price: 1799.94,
    description: '6-month AuraKey subscription gift. 3 curated vials per month + Whisperer vials. Includes AuraKey atomiser.',
    includesAuraKey: true,
  },
];

export default function GiftSubscriptions() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const { data: subsData, isLoading: loading, refetch } = useApiQuery<any>(api.gifting.listSubscriptions);
  const subs = (subsData as any)?.data ?? [];

  const [form, setForm] = useState({
    senderName: '', senderEmail: '', recipientName: '', recipientEmail: '',
    endProductId: '', message: '', discountPercent: 0,
  });

  // Auto-fetch data from linked BOM
  const linkedBom = useMemo(() =>
    SUBSCRIPTION_BOMS.find(b => b.productId === form.endProductId),
    [form.endProductId]
  );

  const handleCreate = useCallback(async () => {
    if (!form.senderName.trim()) { toast.error('Sender name is required'); return; }
    if (!form.recipientEmail.trim()) { toast.error('Recipient email is required'); return; }
    if (!form.endProductId) { toast.error('Select a subscription product'); return; }
    if (!linkedBom) return;

    setCreating(true);
    try {
      const giftId = `GSUB-${Date.now().toString(36).toUpperCase()}`;
      await api.gifting.createSubscription({
        giftId,
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        recipientName: form.recipientName,
        recipientEmail: form.recipientEmail,
        tier: `${linkedBom.vialsPerMonth}-vial`,
        months: linkedBom.months,
        amount: form.discountPercent > 0 ? linkedBom.price * (1 - form.discountPercent / 100) : linkedBom.price,
        discount: form.discountPercent,
        status: 'pending',
        startDate: new Date().toISOString(),
        message: form.message,
      });
      toast.success('Gift subscription created');
      setShowCreate(false);
      setForm({ senderName: '', senderEmail: '', recipientName: '', recipientEmail: '', endProductId: '', message: '', discountPercent: 0 });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create');
    } finally {
      setCreating(false);
    }
  }, [form, linkedBom, refetch]);

  const filtered = subs.filter((s: any) => {
    if (tab !== 'all' && s.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.senderName?.toLowerCase().includes(q) || s.recipientName?.toLowerCase().includes(q) || s.recipientEmail?.toLowerCase().includes(q) || s.giftId?.toLowerCase().includes(q));
    }
    return true;
  });

  const statusCounts = subs.reduce((acc: Record<string, number>, s: any) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalValue = subs.reduce((s: number, g: any) => s + (g.amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Gift Subscriptions"
        subtitle="AuraKey subscription gifts — linked to subscription End Products/BOMs"
        actions={
          <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> New Gift Subscription
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center"><Gift className="w-5 h-5 text-pink-600" /></div><div><p className="text-2xl font-bold">{subs.length}</p><p className="text-xs text-muted-foreground">Total Gift Subs</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{statusCounts.active ?? 0}</p><p className="text-xs text-muted-foreground">Active</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{statusCounts.pending ?? 0}</p><p className="text-xs text-muted-foreground">Pending Activation</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-gold" /></div><div><p className="text-2xl font-bold">AED {totalValue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Value</p></div></div></CardContent></Card>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({subs.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({statusCounts.active ?? 0})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({statusCounts.pending ?? 0})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({statusCounts.completed ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {!loading && filtered.length === 0 && (
          <EmptyState icon={Gift} title="No gift subscriptions" description="Create your first gift subscription to start spreading the fragrance love." />
        )}

        {/* Gift Sub Table */}
        {!loading && filtered.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Gift ID</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">From → To</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Product</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Duration</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Value</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Progress</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sub: any) => {
                      const sc = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.pending;
                      const startDate = sub.startDate ? new Date(sub.startDate) : null;
                      const monthsElapsed = startDate ? Math.max(0, Math.min(sub.months ?? 0, Math.floor((Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)))) : 0;
                      const progressPct = sub.months > 0 ? Math.round((monthsElapsed / sub.months) * 100) : 0;
                      return (
                        <tr key={sub.giftId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <span className="font-mono text-xs font-bold">{sub.giftId}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="font-medium">{sub.senderName || '—'}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium">{sub.recipientName || sub.recipientEmail || '—'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link2 className="w-3 h-3 text-blue-500" />
                              <Badge variant="outline" className="text-[10px]">{sub.tier || 'Standard'}</Badge>
                            </div>
                          </td>
                          <td className="p-3 text-center text-xs">{sub.months} months</td>
                          <td className="p-3 text-right font-medium">AED {(sub.amount ?? 0).toLocaleString()}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn('text-[10px] uppercase', sc.bg, sc.color)}>{sc.label}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div className="bg-pink-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{monthsElapsed}/{sub.months}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowDetail(sub)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog — Select End Product, auto-fetch data */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Gift Subscription</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Sender Name *</Label><Input value={form.senderName} onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} placeholder="Gift giver" /></div>
              <div><Label>Sender Email</Label><Input type="email" value={form.senderEmail} onChange={e => setForm(f => ({ ...f, senderEmail: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Recipient Name</Label><Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Lucky recipient" /></div>
              <div><Label>Recipient Email *</Label><Input type="email" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} /></div>
            </div>

            {/* REQUIRED: Select Subscription End Product */}
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <Label className="flex items-center gap-1.5 mb-2"><Link2 className="w-3.5 h-3.5 text-blue-500" /> Subscription Product (Required) *</Label>
              <Select value={form.endProductId} onValueChange={v => setForm(f => ({ ...f, endProductId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subscription BOM..." /></SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_BOMS.map(b => (
                    <SelectItem key={b.productId} value={b.productId}>
                      {b.name} — AED {b.price.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.endProductId && (
                <p className="mt-1.5 text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Duration, vials, and price are auto-fetched from the selected product
                </p>
              )}
            </div>

            {/* Auto-fetched data from BOM */}
            {linkedBom && (
              <Card className="bg-gradient-to-r from-blue-500/5 to-pink-500/5 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold">Auto-fetched from BOM</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{linkedBom.bomId}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Duration</span>
                      <p className="font-semibold">{linkedBom.months} months</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Vials per Month</span>
                      <p className="font-semibold">{linkedBom.vialsPerMonth} vials</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Includes AuraKey</span>
                      <p className="font-semibold">{linkedBom.includesAuraKey ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Total Price</span>
                      <p className="font-bold text-pink-600 text-lg">AED {linkedBom.price.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">{linkedBom.description}</p>

                  {/* Discount Field */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <Label className="text-xs flex items-center gap-1.5 mb-1.5">Discount (%)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number" min={0} max={100}
                        value={form.discountPercent || ''}
                        onChange={e => setForm(f => ({ ...f, discountPercent: Number(e.target.value) || 0 }))}
                        placeholder="0" className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      {form.discountPercent > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs line-through text-muted-foreground">AED {linkedBom.price.toLocaleString()}</span>
                          <span className="text-sm font-bold text-emerald-600">
                            AED {(linkedBom.price * (1 - form.discountPercent / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">-{form.discountPercent}%</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label>Personal Message</Label>
              <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="A heartfelt message for the recipient..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-pink-600 hover:bg-pink-700 text-white">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Heart className="w-4 h-4 mr-1" />} Create Gift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {showDetail && (
        <Dialog open onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Gift Subscription Details</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-pink-500/10 to-pink-500/5 border border-pink-500/20">
                <div>
                  <p className="font-mono text-sm font-bold">{showDetail.giftId}</p>
                  <p className="text-xs text-muted-foreground mt-1">{showDetail.tier || 'Standard'} plan</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-pink-600">AED {(showDetail.amount ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{showDetail.months} months</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">From:</span> {showDetail.senderName || '—'}</div>
                <div><span className="text-muted-foreground">To:</span> {showDetail.recipientName || showDetail.recipientEmail || '—'}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={cn('text-[10px] uppercase ml-1', STATUS_CONFIG[showDetail.status]?.bg, STATUS_CONFIG[showDetail.status]?.color)}>{STATUS_CONFIG[showDetail.status]?.label}</Badge></div>
                <div><span className="text-muted-foreground">Started:</span> {showDetail.startDate ? new Date(showDetail.startDate).toLocaleDateString() : '—'}</div>
              </div>
              {showDetail.message && (
                <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
                  <p className="text-xs text-muted-foreground mb-1">Personal Message</p>
                  <p className="text-sm italic">"{showDetail.message}"</p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold mb-2">Delivery Timeline</h4>
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <CalendarDays className="w-5 h-5 mx-auto text-muted-foreground/30 mb-1" />
                  <p className="text-xs text-muted-foreground">Monthly delivery tracking will appear here once the subscription is active</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
