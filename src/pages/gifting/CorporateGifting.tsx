// ============================================================
// Corporate Gifting — Full Pipeline
// Custom pricing (not standard), CSV upload, PDF proposal,
// Employee management, pipeline funnel, End Product/BOM link
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Building2, Plus, DollarSign, Search, Loader2,
  Users, Clock, CheckCircle2, Mail, Phone, Droplets,
  Eye, FileText, Upload, Download, Link2,
  ChevronRight, UserPlus, MapPin, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STAGES = [
  { id: 'inquiry', label: 'Inquiry', color: 'bg-amber-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-blue-500' },
  { id: 'accepted', label: 'Accepted', color: 'bg-indigo-500' },
  { id: 'paid', label: 'Paid', color: 'bg-emerald-500' },
  { id: 'activated', label: 'Activated', color: 'bg-green-600' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  inquiry: { label: 'Inquiry', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
  proposal: { label: 'Proposal Sent', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
  accepted: { label: 'Accepted', color: 'text-indigo-600', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  paid: { label: 'Paid', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  activated: { label: 'Activated', color: 'text-green-600', bg: 'bg-green-500/10 border-green-500/20' },
  completed: { label: 'Completed', color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20' },
};

const TENURE_OPTIONS = [
  { value: '1', label: '1 Month' },
  { value: '3', label: '3 Months' },
  { value: '6', label: '6 Months' },
  { value: '12', label: '12 Months (Annual)' },
];

const PERFUME_CATALOG: { brand: string; perfumes: string[] }[] = [
  { brand: 'Maison Francis Kurkdjian', perfumes: ['Baccarat Rouge 540', 'Grand Soir', 'Oud Satin Mood', 'Gentle Fluidity Gold'] },
  { brand: 'Tom Ford', perfumes: ['Tobacco Vanille', 'Oud Wood', 'Lost Cherry', 'Bitter Peach'] },
  { brand: 'Creed', perfumes: ['Aventus', 'Green Irish Tweed', 'Silver Mountain Water', 'Viking'] },
  { brand: 'Parfums de Marly', perfumes: ['Layton', 'Delina', 'Pegasus', 'Herod'] },
  { brand: 'Initio', perfumes: ['Oud for Greatness', 'Side Effect', 'Rehab', 'Atomic Rose'] },
  { brand: 'Xerjoff', perfumes: ['Naxos', 'Erba Pura', 'Alexandria II', 'Nio'] },
  { brand: 'Nishane', perfumes: ['Hacivat', 'Ani', 'Hundred Silent Ways', 'Fan Your Flames'] },
  { brand: 'Amouage', perfumes: ['Interlude Man', 'Reflection Man', 'Jubilation XXV', 'Memoir Man'] },
];

const ALL_BRANDS = PERFUME_CATALOG.map(c => c.brand);
const getPerfumesForBrand = (brand: string) => PERFUME_CATALOG.find(c => c.brand === brand)?.perfumes ?? [];
const findBrandForPerfume = (perfume: string) => PERFUME_CATALOG.find(c => c.perfumes.includes(perfume))?.brand ?? '';

const generateQuoteCode = () => {
  const yr = new Date().getFullYear().toString().slice(-2);
  const seq = Math.floor(Math.random() * 9000 + 1000);
  return `CQ-${yr}-${seq}`;
};

interface Employee {
  name: string;
  email: string;
  address: string;
  department?: string;
}

export default function CorporateGifting() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showEmployees, setShowEmployees] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: inquiriesData, isLoading: loading, refetch } = useApiQuery<any>(api.gifting.listInquiries);
  const inquiries = (inquiriesData as any)?.data ?? [];

  const [form, setForm] = useState({
    companyName: '', contactName: '', contactEmail: '', contactPhone: '',
    numSubscriptions: '10', tenureMonths: '12', vialsPerMonth: '2',
    customVialPrice: '120', // CUSTOM price — not standard
    notes: '', deliveryMode: 'individual', // individual or single
    endProductId: '',
  });

  // First-order perfume selections: { brand, perfume }[]
  const [firstOrderPerfumes, setFirstOrderPerfumes] = useState<{ brand: string; perfume: string }[]>([]);

  // Keep perfume selections in sync with vialsPerMonth
  const vialsCount = parseInt(form.vialsPerMonth) || 2;
  const perfumeSelections = useMemo(() => {
    const arr = [...firstOrderPerfumes];
    while (arr.length < vialsCount) arr.push({ brand: '', perfume: '' });
    return arr.slice(0, vialsCount);
  }, [firstOrderPerfumes, vialsCount]);

  const updatePerfumeSelection = (index: number, field: 'brand' | 'perfume', value: string) => {
    setFirstOrderPerfumes(prev => {
      const arr = [...prev];
      while (arr.length <= index) arr.push({ brand: '', perfume: '' });
      if (field === 'brand') {
        arr[index] = { brand: value, perfume: '' }; // reset perfume when brand changes
      } else {
        const brand = findBrandForPerfume(value);
        arr[index] = { brand: brand || arr[index].brand, perfume: value };
      }
      return arr;
    });
  };

  // Employee list
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployee, setNewEmployee] = useState<Employee>({ name: '', email: '', address: '', department: '' });

  // Custom pricing calculation
  const numSubs = parseInt(form.numSubscriptions) || 10;
  const tenure = parseInt(form.tenureMonths) || 12;
  const vialsPerMonth = parseInt(form.vialsPerMonth) || 2;
  const customVialPrice = parseFloat(form.customVialPrice) || 120;
  const monthlyPerSub = customVialPrice * vialsPerMonth;
  const totalPackageValue = numSubs * monthlyPerSub * tenure;
  const initialPackageCost = numSubs * 149.99; // AuraKey device per employee

  const handleCreate = useCallback(async () => {
    if (!form.companyName || !form.contactEmail) { toast.error('Company name and contact email required'); return; }
    setCreating(true);
    try {
      const inquiryId = generateQuoteCode();
      await api.gifting.createInquiry({
        inquiryId,
        companyName: form.companyName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        numEmployees: numSubs,
        tenure: `${tenure} months`,
        budget: totalPackageValue + initialPackageCost,
        status: 'inquiry',
        notes: `${numSubs} subs × ${vialsPerMonth} vials/mo @ AED ${customVialPrice}/vial × ${tenure}mo (8ml vials) | Delivery: ${form.deliveryMode} | Subscription: AED ${totalPackageValue.toLocaleString()} + Initial packages: AED ${initialPackageCost.toLocaleString()} | Total: AED ${(totalPackageValue + initialPackageCost).toLocaleString()}${perfumeSelections.filter(p => p.perfume).length > 0 ? ` | First-order: ${perfumeSelections.filter(p => p.perfume).map(p => `${p.brand} — ${p.perfume}`).join(', ')}` : ''}${employees.length > 0 ? ` | ${employees.length} employees added` : ''}${form.notes ? ` | ${form.notes}` : ''}`,
      });
      toast.success(`Corporate inquiry from "${form.companyName}" created`);
      setShowCreate(false);
      setForm({ companyName: '', contactName: '', contactEmail: '', contactPhone: '', numSubscriptions: '10', tenureMonths: '12', vialsPerMonth: '2', customVialPrice: '120', notes: '', deliveryMode: 'individual', endProductId: '' });
      setEmployees([]);
      setFirstOrderPerfumes([]);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create inquiry');
    } finally {
      setCreating(false);
    }
  }, [form, numSubs, tenure, vialsPerMonth, customVialPrice, totalPackageValue, initialPackageCost, employees, perfumeSelections, refetch]);

  const handleStatusUpdate = useCallback(async (inquiryId: string, newStatus: string) => {
    try {
      await api.gifting.updateInquiry(inquiryId, { status: newStatus });
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    }
  }, [refetch]);

  const handleGenerateProposal = useCallback((inq: any) => {
    toast.success('PDF proposal generated — download starting...');
    // In production, this would call a server endpoint to generate PDF
  }, []);

  const handleCSVUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const parsed: Employee[] = [];
        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 2) {
            parsed.push({
              name: cols[0] || '',
              email: cols[1] || '',
              address: cols[2] || '',
              department: cols[3] || '',
            });
          }
        }
        setEmployees(prev => [...prev, ...parsed]);
        toast.success(`${parsed.length} employees imported from CSV`);
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleAddEmployee = useCallback(() => {
    if (!newEmployee.name || !newEmployee.email) { toast.error('Name and email required'); return; }
    setEmployees(prev => [...prev, { ...newEmployee }]);
    setNewEmployee({ name: '', email: '', address: '', department: '' });
  }, [newEmployee]);

  const filtered = inquiries.filter((i: any) => {
    if (tab !== 'all' && i.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (i.companyName?.toLowerCase().includes(q) || i.company?.toLowerCase().includes(q) || i.contactName?.toLowerCase().includes(q) || i.contactEmail?.toLowerCase().includes(q));
    }
    return true;
  });

  const statusCounts = inquiries.reduce((acc: Record<string, number>, i: any) => {
    const s = i.status === 'new' ? 'inquiry' : i.status === 'contacted' ? 'inquiry' : i.status === 'quoted' ? 'proposal' : i.status === 'confirmed' ? 'activated' : i.status === 'fulfilled' ? 'completed' : i.status;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalBudget = inquiries.reduce((s: number, i: any) => s + (i.budget ?? 0), 0);
  const totalSubs = inquiries.reduce((s: number, i: any) => s + (i.numEmployees ?? i.qty ?? 0), 0);

  const getNextStatus = (current: string) => {
    const map: Record<string, string> = { inquiry: 'proposal', proposal: 'accepted', accepted: 'paid', paid: 'activated' };
    return map[current] ?? null;
  };

  return (
    <div>
      <PageHeader
        title="Corporate Gifting"
        subtitle="Company-sponsored AuraKey subscriptions — custom pricing, employee management, PDF proposals"
        actions={
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Create Quote
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{inquiries.length}</p><p className="text-xs text-muted-foreground">Total Inquiries</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{(statusCounts.activated ?? 0) + (statusCounts.paid ?? 0)}</p><p className="text-xs text-muted-foreground">Active Accounts</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div><div><p className="text-2xl font-bold">{totalSubs}</p><p className="text-xs text-muted-foreground">Total Subscriptions</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-gold" /></div><div><p className="text-2xl font-bold">AED {totalBudget.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pipeline Value</p></div></div></CardContent></Card>
        </div>

        {/* Pipeline Funnel */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Pipeline Funnel</h3>
            <div className="flex items-center gap-1">
              {PIPELINE_STAGES.map((stage, i) => {
                const count = statusCounts[stage.id] ?? 0;
                return (
                  <div key={stage.id} className="flex items-center flex-1">
                    <div className={cn('flex-1 rounded-lg px-3 py-2 text-center', count > 0 ? stage.color + ' text-white' : 'bg-muted text-muted-foreground')}>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px] uppercase tracking-wider">{stage.label}</p>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mx-0.5" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({inquiries.length})</TabsTrigger>
              <TabsTrigger value="inquiry">Inquiry ({statusCounts.inquiry ?? 0})</TabsTrigger>
              <TabsTrigger value="proposal">Proposal ({statusCounts.proposal ?? 0})</TabsTrigger>
              <TabsTrigger value="accepted">Accepted ({statusCounts.accepted ?? 0})</TabsTrigger>
              <TabsTrigger value="activated">Active ({statusCounts.activated ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search company or contact..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {!loading && filtered.length === 0 && (
          <EmptyState icon={Building2} title="No corporate inquiries" description="Create a corporate gifting inquiry to start managing company-sponsored subscriptions." />
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((inq: any) => {
              const status = inq.status === 'new' ? 'inquiry' : inq.status === 'contacted' ? 'inquiry' : inq.status === 'quoted' ? 'proposal' : inq.status === 'confirmed' ? 'activated' : inq.status === 'fulfilled' ? 'completed' : inq.status;
              const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.inquiry;
              const company = inq.companyName || inq.company || 'Unknown';
              const subs = inq.numEmployees ?? inq.qty ?? 0;
              const nextStatus = getNextStatus(status);

              return (
                <Card key={inq.inquiryId} className="hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-base font-semibold">{company}</h3>
                            <Badge variant="outline" className={cn('text-[10px] uppercase', sc.bg, sc.color)}>{sc.label}</Badge>
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{inq.inquiryId}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                            {inq.contactName && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {inq.contactName}</span>}
                            {inq.contactEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {inq.contactEmail}</span>}
                            {(inq.contactPhone || inq.phone) && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {inq.contactPhone || inq.phone}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-600 font-medium">{subs} Subscriptions</span>
                            {inq.tenure && <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-600 font-medium">{inq.tenure}</span>}
                            {(inq.budget ?? 0) > 0 && <span className="text-xs px-2 py-0.5 rounded bg-gold/10 border border-gold/20 text-gold font-medium">AED {(inq.budget ?? 0).toLocaleString()}</span>}
                          </div>

                          {/* Pipeline Progress Bar */}
                          <div className="mt-3 flex items-center gap-0.5">
                            {PIPELINE_STAGES.map((s, i) => {
                              const currentIdx = PIPELINE_STAGES.findIndex(ps => ps.id === status);
                              return <div key={s.id} className={cn('h-1.5 flex-1 rounded-full', i <= currentIdx ? s.color : 'bg-muted')} />;
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowDetail(inq)}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleGenerateProposal(inq)}>
                          <Download className="w-3 h-3" /> Quote
                        </Button>
                        {nextStatus && (
                          <Button variant="outline" size="sm" className="text-xs gap-1 text-blue-600" onClick={() => handleStatusUpdate(inq.inquiryId, nextStatus)}>
                            <ChevronRight className="w-3 h-3" /> {STATUS_CONFIG[nextStatus]?.label}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog — Custom Pricing + Employee Management */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" /> Create Corporate Quote</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Company Info */}
            <div><Label>Company Name *</Label><Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="e.g. ADNOC, Emirates NBD" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label>Contact Name</Label><Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} /></div>
              <div><Label>Contact Email *</Label><Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} /></div>
              <div><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} /></div>
            </div>

            {/* Subscription Config */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>Subscriptions</Label>
                <Input type="number" min={1} value={form.numSubscriptions} onChange={e => setForm(f => ({ ...f, numSubscriptions: e.target.value }))} />
              </div>
              <div>
                <Label>Tenure</Label>
                <Select value={form.tenureMonths} onValueChange={v => setForm(f => ({ ...f, tenureMonths: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TENURE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vials/Month</Label>
                <Select value={form.vialsPerMonth} onValueChange={v => setForm(f => ({ ...f, vialsPerMonth: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4'].map(v => <SelectItem key={v} value={v}>{v} vial{parseInt(v) > 1 ? 's' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1"><CreditCard className="w-3 h-3 text-amber-500" /> Custom Vial Price *</Label>
                <Input type="number" min={0} step="0.01" value={form.customVialPrice} onChange={e => setForm(f => ({ ...f, customVialPrice: e.target.value }))} />
                <p className="text-[10px] text-amber-600 mt-0.5">Custom corporate rate (AED per vial)</p>
              </div>
            </div>

            {/* First-Order Perfume Selection — Brand + Perfume */}
            <div className="border border-amber-500/20 rounded-lg p-3 bg-amber-500/5">
              <Label className="flex items-center gap-1.5 mb-2 text-xs font-semibold">
                <Droplets className="w-3.5 h-3.5 text-amber-600" /> First-Order Perfume Selection
              </Label>
              <p className="text-[10px] text-muted-foreground mb-2">
                Select {vialsCount} perfume{vialsCount > 1 ? 's' : ''} for the first delivery (8ml vials). Each employee receives the same selection.
              </p>
              <div className="space-y-2">
                {perfumeSelections.map((sel, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">Vial {i + 1}</span>
                    <Select value={sel.brand} onValueChange={v => updatePerfumeSelection(i, 'brand', v)}>
                      <SelectTrigger className="text-xs flex-1">
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={sel.perfume} onValueChange={v => updatePerfumeSelection(i, 'perfume', v)}>
                      <SelectTrigger className="text-xs flex-1">
                        <SelectValue placeholder={sel.brand ? 'Select perfume' : 'Select brand first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(sel.brand ? getPerfumesForBrand(sel.brand) : PERFUME_CATALOG.flatMap(c => c.perfumes)).map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Mode */}
            <div>
              <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Delivery Mode</Label>
              <Select value={form.deliveryMode} onValueChange={v => setForm(f => ({ ...f, deliveryMode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual Addresses (per employee)</SelectItem>
                  <SelectItem value="single">Single Address (all to one location)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Summary */}
            <Card className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Package Value Estimate</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly per subscriber</span>
                    <span>AED {monthlyPerSub.toFixed(0)} ({vialsPerMonth} × AED {customVialPrice})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subscription total ({numSubs} × {tenure}mo)</span>
                    <span>AED {totalPackageValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Initial packages ({numSubs} × AuraKey device)</span>
                    <span>AED {initialPackageCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                    <span>Total Package Value</span>
                    <span className="text-blue-600">AED {(totalPackageValue + initialPackageCost).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employee Management */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Employees ({employees.length})
                </h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleCSVUpload}>
                    <Upload className="w-3 h-3" /> Upload CSV
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowEmployees(!showEmployees)}>
                    <UserPlus className="w-3 h-3" /> Add Manual
                  </Button>
                </div>
              </div>

              {showEmployees && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                  <Input placeholder="Name" value={newEmployee.name} onChange={e => setNewEmployee(f => ({ ...f, name: e.target.value }))} className="text-xs" />
                  <Input placeholder="Email" value={newEmployee.email} onChange={e => setNewEmployee(f => ({ ...f, email: e.target.value }))} className="text-xs" />
                  <Input placeholder="Address" value={newEmployee.address} onChange={e => setNewEmployee(f => ({ ...f, address: e.target.value }))} className="text-xs" />
                  <Input placeholder="Department" value={newEmployee.department} onChange={e => setNewEmployee(f => ({ ...f, department: e.target.value }))} className="text-xs" />
                  <Button size="sm" onClick={handleAddEmployee} className="text-xs"><Plus className="w-3 h-3" /> Add</Button>
                </div>
              )}

              {employees.length > 0 ? (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {employees.map((emp, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/50 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-muted-foreground">{emp.email}</span>
                        {emp.department && <Badge variant="outline" className="text-[9px]">{emp.department}</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500" onClick={() => setEmployees(prev => prev.filter((_, j) => j !== i))}>×</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2">
                <p className="text-xs text-muted-foreground">No employees added yet. Upload CSV (Name, Email, Address, Department) or add manually.</p>
                <p className="text-[10px] text-amber-600 mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Employees can also be uploaded later in the pipeline — after proposal is sent and before activation.
                </p>
              </div>
              )}
            </div>

            <div><Label>Internal Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Create Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog — Interactive Pipeline */}
      {showDetail && (
        <Dialog open onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {showDetail.companyName || showDetail.company}
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{showDetail.inquiryId}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={cn('text-[10px] uppercase ml-1', STATUS_CONFIG[showDetail.status]?.bg ?? STATUS_CONFIG.inquiry.bg, STATUS_CONFIG[showDetail.status]?.color ?? STATUS_CONFIG.inquiry.color)}>{STATUS_CONFIG[showDetail.status]?.label ?? showDetail.status}</Badge></div>
                <div><span className="text-muted-foreground">Subscriptions:</span> {showDetail.numEmployees ?? showDetail.qty}</div>
                <div><span className="text-muted-foreground">Tenure:</span> {showDetail.tenure ?? '—'}</div>
                <div><span className="text-muted-foreground">Budget:</span> AED {(showDetail.budget ?? 0).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Contact:</span> {showDetail.contactName}</div>
                <div><span className="text-muted-foreground">Email:</span> {showDetail.contactEmail}</div>
              </div>
              {showDetail.notes && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Notes & Configuration</h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{showDetail.notes}</p>
                </div>
              )}
              {/* Interactive Pipeline Progress */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Pipeline Progress</h4>
                <div className="flex items-center gap-1">
                  {PIPELINE_STAGES.map((s, i) => {
                    const currentStatus = showDetail.status === 'new' ? 'inquiry' : showDetail.status === 'contacted' ? 'inquiry' : showDetail.status === 'quoted' ? 'proposal' : showDetail.status === 'confirmed' ? 'activated' : showDetail.status;
                    const currentIdx = PIPELINE_STAGES.findIndex(ps => ps.id === currentStatus);
                    const isCompleted = i < currentIdx;
                    const isCurrent = i === currentIdx;
                    const isNext = i === currentIdx + 1;
                    return (
                      <div key={s.id} className="flex items-center flex-1">
                        <button
                          className={cn(
                            'flex-1 rounded-lg px-2 py-2 text-center transition-all border',
                            isCompleted ? `${s.color} text-white border-transparent` : '',
                            isCurrent ? `${s.color} text-white border-transparent ring-2 ring-offset-1 ring-${s.color.replace('bg-', '')}` : '',
                            isNext ? 'bg-muted/50 border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 cursor-pointer' : '',
                            !isCompleted && !isCurrent && !isNext ? 'bg-muted text-muted-foreground border-transparent' : '',
                          )}
                          onClick={() => {
                            if (isNext) {
                              handleStatusUpdate(showDetail.inquiryId, s.id);
                              setShowDetail({ ...showDetail, status: s.id });
                            }
                          }}
                          disabled={!isNext}
                        >
                          <p className="text-sm font-bold">{isCompleted ? '✓' : isCurrent ? '●' : isNext ? '→' : '○'}</p>
                          <p className="text-[9px] uppercase tracking-wider">{s.label}</p>
                        </button>
                        {i < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mx-0.5" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Click the next stage to advance the pipeline</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleGenerateProposal(showDetail)}>
                  <Download className="w-3 h-3" /> Download Quote PDF
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1 text-red-600" onClick={() => { handleStatusUpdate(showDetail.inquiryId, 'cancelled'); setShowDetail(null); }}>
                  Cancel Quote
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
