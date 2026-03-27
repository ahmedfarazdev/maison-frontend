// ============================================================
// Gift Cards — Wallet / CRM View
// Customer-centric: balance, redemption history, wallet tracking
// Aligned with Maison Em Product Architecture
// ============================================================

import { useState, useCallback } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  CreditCard, Plus, DollarSign, Search, Loader2,
  CheckCircle2, Clock, XCircle, Mail, Wallet, Users,
  ArrowUpRight, ArrowDownRight, Eye, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  redeemed: { label: 'Fully Used', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
  expired: { label: 'Expired', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EM-';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function GiftCards() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const { data: cardsData, isLoading: loading, refetch } = useApiQuery<any>(api.gifting.listCards);
  const cards = (cardsData as any)?.data ?? [];

  const [form, setForm] = useState({
    amount: 250, senderName: '', recipientName: '', recipientEmail: '', message: '',
  });

  const handleCreate = useCallback(async () => {
    if (!form.recipientEmail) { toast.error('Recipient email is required'); return; }
    setCreating(true);
    try {
      const cardId = `GC-${Date.now().toString(36).toUpperCase()}`;
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await api.gifting.createCard({
        cardId, code, amount: form.amount, balance: form.amount,
        senderName: form.senderName, recipientEmail: form.recipientEmail,
        status: 'active', expiresAt,
      });
      toast.success(`Gift card created — Code: ${code}`);
      setShowCreate(false);
      setForm({ amount: 250, senderName: '', recipientName: '', recipientEmail: '', message: '' });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create gift card');
    } finally {
      setCreating(false);
    }
  }, [form, refetch]);

  const filtered = cards.filter((c: any) => {
    if (tab !== 'all' && c.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (c.code?.toLowerCase().includes(q) || c.senderName?.toLowerCase().includes(q) || c.recipientEmail?.toLowerCase().includes(q));
    }
    return true;
  });

  const statusCounts = cards.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalIssued = cards.reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
  const totalBalance = cards.reduce((s: number, c: any) => s + (c.balance ?? 0), 0);
  const totalRedeemed = totalIssued - totalBalance;
  const uniqueRecipients = new Set(cards.map((c: any) => c.recipientEmail)).size;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  return (
    <div>
      <PageHeader
        title="Gift Cards & Wallets"
        subtitle="Customer wallet balances, gift card issuance, and redemption tracking"
        actions={
          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Issue Gift Card
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center"><CreditCard className="w-5 h-5 text-gold" /></div><div><p className="text-2xl font-bold">{cards.length}</p><p className="text-xs text-muted-foreground">Total Cards</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">AED {totalBalance.toLocaleString()}</p><p className="text-xs text-muted-foreground">Outstanding Balance</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-purple-600" /></div><div><p className="text-2xl font-bold">AED {totalIssued.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Issued</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><ArrowDownRight className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">AED {totalRedeemed.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Redeemed</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-pink-600" /></div><div><p className="text-2xl font-bold">{uniqueRecipients}</p><p className="text-xs text-muted-foreground">Recipients</p></div></div></CardContent></Card>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({cards.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({statusCounts.active ?? 0})</TabsTrigger>
              <TabsTrigger value="redeemed">Fully Used ({statusCounts.redeemed ?? 0})</TabsTrigger>
              <TabsTrigger value="expired">Expired ({statusCounts.expired ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search code, name, or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {!loading && filtered.length === 0 && (
          <EmptyState icon={Wallet} title="No gift cards" description="Issue your first gift card to start building customer wallets." />
        )}

        {/* Customer Wallet Table */}
        {!loading && filtered.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Code</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Recipient</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">From</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Issued</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Balance</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Used %</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Expires</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((card: any) => {
                      const sc = STATUS_CONFIG[card.status] ?? STATUS_CONFIG.active;
                      const usedPct = card.amount > 0 ? Math.round(((card.amount - (card.balance ?? 0)) / card.amount) * 100) : 0;
                      return (
                        <tr key={card.cardId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold tracking-wider">{card.code}</span>
                              <button onClick={() => copyCode(card.code)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{card.recipientEmail || '—'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{card.senderName || '—'}</td>
                          <td className="p-3 text-right font-medium">AED {(card.amount ?? 0).toLocaleString()}</td>
                          <td className="p-3 text-right">
                            <span className={cn('font-bold', card.balance > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                              AED {(card.balance ?? 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div className="bg-gold h-1.5 rounded-full transition-all" style={{ width: `${usedPct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8">{usedPct}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={cn('text-[10px] uppercase', sc.bg, sc.color)}>{sc.label}</Badge>
                          </td>
                          <td className="p-3 text-center text-xs text-muted-foreground">
                            {card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowDetail(card)}>
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

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Issue Gift Card</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (AED)</Label>
                <div className="flex gap-2 mt-1">
                  {[100, 250, 500, 1000].map(amt => (
                    <Button key={amt} variant={form.amount === amt ? 'default' : 'outline'} size="sm" className="text-xs flex-1" onClick={() => setForm(f => ({ ...f, amount: amt }))}>
                      {amt}
                    </Button>
                  ))}
                </div>
                <Input type="number" min={50} step={50} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="mt-2" />
              </div>
              <div>
                <Label>Sender Name</Label>
                <Input value={form.senderName} onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} placeholder="Who is sending?" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Recipient Name</Label><Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Recipient name" /></div>
              <div><Label>Recipient Email *</Label><Input type="email" value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} placeholder="email@example.com" /></div>
            </div>
            <div><Label>Personal Message (optional)</Label><Input value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="A special message..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />} Issue Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {showDetail && (
        <Dialog open onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Gift Card Details</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/20">
                <div>
                  <p className="font-mono text-lg font-bold tracking-wider">{showDetail.code}</p>
                  <p className="text-xs text-muted-foreground mt-1">Card ID: {showDetail.cardId}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">AED {(showDetail.amount ?? 0).toLocaleString()}</p>
                  <p className="text-sm text-emerald-600 font-medium">Balance: AED {(showDetail.balance ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={cn('text-[10px] uppercase ml-1', STATUS_CONFIG[showDetail.status]?.bg, STATUS_CONFIG[showDetail.status]?.color)}>{STATUS_CONFIG[showDetail.status]?.label}</Badge></div>
                <div><span className="text-muted-foreground">Recipient:</span> {showDetail.recipientEmail}</div>
                <div><span className="text-muted-foreground">Sender:</span> {showDetail.senderName || '—'}</div>
                <div><span className="text-muted-foreground">Expires:</span> {showDetail.expiresAt ? new Date(showDetail.expiresAt).toLocaleDateString() : '—'}</div>
                <div><span className="text-muted-foreground">Created:</span> {showDetail.createdAt ? new Date(showDetail.createdAt).toLocaleDateString() : '—'}</div>
                <div><span className="text-muted-foreground">Redeemed:</span> AED {((showDetail.amount ?? 0) - (showDetail.balance ?? 0)).toLocaleString()}</div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Redemption History</h4>
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <Clock className="w-5 h-5 mx-auto text-muted-foreground/30 mb-1" />
                  <p className="text-xs text-muted-foreground">Redemption history will appear here once the card is used</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
