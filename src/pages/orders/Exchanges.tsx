// ============================================================
// Exchanges — Orders & CX Module
// Subscriber exchange tracking: swap monthly vials up to 3x/year.
// Partial exchange: select specific vials to swap (1-4 out of total).
// Each partial exchange counts as 1 exchange toward the 3/year limit.
// Flow: Receive → Check Eligibility → Exchange with new selections.
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  ArrowLeftRight, Plus, Search, CheckCircle, XCircle, Clock,
  AlertTriangle, User, Droplets, Calendar, ArrowRight, Shield,
  Package, RefreshCcw, Eye, ChevronRight, Pencil, X, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type ExchangeStatus = 'pending_receipt' | 'eligibility_check' | 'approved' | 'new_selection' | 'shipped' | 'completed' | 'rejected';

interface VialExchange {
  original: string;
  replacement: string;
  selected: boolean; // whether this vial is being exchanged
}

interface ExchangeRequest {
  id: string;
  customer_name: string;
  customer_email: string;
  subscription_vials: number;
  exchange_number: number;
  max_exchanges_year: number;
  status: ExchangeStatus;
  vial_exchanges: VialExchange[]; // per-vial tracking
  original_perfumes: string[]; // kept for backward compat
  new_perfumes: string[];
  reason: string;
  created_at: string;
  completed_at?: string;
  notes?: string;
}

// ---- Mock Data ----
const mockExchanges: ExchangeRequest[] = [
  {
    id: 'EX-001', customer_name: 'Reem Al-Falasi', customer_email: 'reem@example.com',
    subscription_vials: 4, exchange_number: 1, max_exchanges_year: 3,
    status: 'completed',
    vial_exchanges: [
      { original: 'Baccarat Rouge 540', replacement: 'Lost Cherry', selected: true },
      { original: 'Oud Wood', replacement: '', selected: false },
      { original: 'Aventus', replacement: 'Hacivat', selected: true },
      { original: 'Layton', replacement: '', selected: false },
    ],
    original_perfumes: ['Baccarat Rouge 540', 'Oud Wood', 'Aventus', 'Layton'],
    new_perfumes: ['Lost Cherry', 'Hacivat'],
    reason: "Didn't enjoy BR540 this month, wanted to try Lost Cherry and Hacivat instead",
    created_at: '2026-01-15', completed_at: '2026-01-18',
  },
  {
    id: 'EX-002', customer_name: 'Omar Khalil', customer_email: 'omar@example.com',
    subscription_vials: 2, exchange_number: 2, max_exchanges_year: 3,
    status: 'new_selection',
    vial_exchanges: [
      { original: 'Tobacco Vanille', replacement: '', selected: true },
      { original: 'Interlude Man', replacement: '', selected: false },
    ],
    original_perfumes: ['Tobacco Vanille', 'Interlude Man'],
    new_perfumes: [],
    reason: 'Received wrong concentration, expected EDP got EDT',
    created_at: '2026-02-20',
  },
  {
    id: 'EX-003', customer_name: 'Layla Hassan', customer_email: 'layla@example.com',
    subscription_vials: 1, exchange_number: 1, max_exchanges_year: 3,
    status: 'pending_receipt',
    vial_exchanges: [
      { original: 'Delina', replacement: '', selected: true },
    ],
    original_perfumes: ['Delina'],
    new_perfumes: [],
    reason: 'Allergic reaction to one of the notes',
    created_at: '2026-02-25',
  },
  {
    id: 'EX-004', customer_name: 'Faisal Noor', customer_email: 'faisal@example.com',
    subscription_vials: 3, exchange_number: 3, max_exchanges_year: 3,
    status: 'rejected',
    vial_exchanges: [
      { original: 'Aventus', replacement: '', selected: true },
      { original: 'Layton', replacement: '', selected: true },
      { original: 'Oud Wood', replacement: '', selected: true },
    ],
    original_perfumes: ['Aventus', 'Layton', 'Oud Wood'],
    new_perfumes: [],
    reason: 'Just want different scents',
    created_at: '2026-02-10', notes: 'Rejected: already used all 3 exchanges for this year',
  },
  {
    id: 'EX-005', customer_name: 'Nadia Youssef', customer_email: 'nadia@example.com',
    subscription_vials: 2, exchange_number: 1, max_exchanges_year: 3,
    status: 'eligibility_check',
    vial_exchanges: [
      { original: 'Lost Cherry', replacement: '', selected: true },
      { original: 'Tobacco Vanille', replacement: '', selected: true },
    ],
    original_perfumes: ['Lost Cherry', 'Tobacco Vanille'],
    new_perfumes: [],
    reason: 'Vials arrived damaged',
    created_at: '2026-02-26',
  },
];

const STATUS_CONFIG: Record<ExchangeStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending_receipt: { label: 'Pending Receipt', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Package },
  eligibility_check: { label: 'Eligibility Check', color: 'bg-info/15 text-info border-info/30', icon: Shield },
  approved: { label: 'Approved', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle },
  new_selection: { label: 'Awaiting Selection', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30', icon: Droplets },
  shipped: { label: 'Shipped', color: 'bg-info/15 text-info border-info/30', icon: Package },
  completed: { label: 'Completed', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: XCircle },
};

const EXCHANGE_FLOW: ExchangeStatus[] = ['pending_receipt', 'eligibility_check', 'approved', 'new_selection', 'shipped', 'completed'];

// Mock perfumes for selection
const AVAILABLE_PERFUMES = [
  'Baccarat Rouge 540', 'Aventus', 'Oud Wood', 'Layton', 'Lost Cherry',
  'Hacivat', 'Interlude Man', 'Tobacco Vanille', 'Delina', 'Grand Soir',
  'Reflection Man', 'Rehab', 'Tiziana Terenzi Kirke', 'Xerjoff Naxos',
  'Initio Oud for Greatness', 'Kilian Angels Share',
];

// Mock customer database for dropdown
const MOCK_CUSTOMERS = [
  { name: 'Reem Al-Falasi', email: 'reem@example.com', vials: 4, exchanges_used: 1 },
  { name: 'Omar Khalil', email: 'omar@example.com', vials: 2, exchanges_used: 2 },
  { name: 'Layla Hassan', email: 'layla@example.com', vials: 1, exchanges_used: 1 },
  { name: 'Faisal Noor', email: 'faisal@example.com', vials: 3, exchanges_used: 3 },
  { name: 'Nadia Youssef', email: 'nadia@example.com', vials: 2, exchanges_used: 1 },
  { name: 'Sara Mahmoud', email: 'sara@example.com', vials: 3, exchanges_used: 0 },
  { name: 'Ahmed Al-Rashid', email: 'ahmed@example.com', vials: 4, exchanges_used: 1 },
  { name: 'Maryam Khalifa', email: 'maryam@example.com', vials: 2, exchanges_used: 0 },
  { name: 'Yousef Ibrahim', email: 'yousef@example.com', vials: 1, exchanges_used: 2 },
  { name: 'Huda Al-Mansoori', email: 'huda@example.com', vials: 3, exchanges_used: 0 },
];

// Mock current month perfumes per customer (what they received this month)
const MOCK_CURRENT_PERFUMES: Record<string, string[]> = {
  'reem@example.com': ['Baccarat Rouge 540', 'Oud Wood', 'Aventus', 'Layton'],
  'omar@example.com': ['Tobacco Vanille', 'Interlude Man'],
  'layla@example.com': ['Delina'],
  'faisal@example.com': ['Aventus', 'Layton', 'Oud Wood'],
  'nadia@example.com': ['Lost Cherry', 'Tobacco Vanille'],
  'sara@example.com': ['Grand Soir', 'Reflection Man', 'Rehab'],
  'ahmed@example.com': ['Xerjoff Naxos', 'Hacivat', 'Oud Wood', 'Aventus'],
  'maryam@example.com': ['Kilian Angels Share', 'Delina'],
  'yousef@example.com': ['Layton'],
  'huda@example.com': ['Lost Cherry', 'Baccarat Rouge 540', 'Grand Soir'],
};

function getNextStatus(status: ExchangeStatus): ExchangeStatus | null {
  const idx = EXCHANGE_FLOW.indexOf(status);
  if (idx < 0 || idx >= EXCHANGE_FLOW.length - 1) return null;
  return EXCHANGE_FLOW[idx + 1];
}

export default function Exchanges() {
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>(mockExchanges);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ExchangeStatus | 'all'>('all');
  const [showInitiate, setShowInitiate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Initiate form state
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formVialSelections, setFormVialSelections] = useState<VialExchange[]>([]);
  const [formReason, setFormReason] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const selectedCustomer = MOCK_CUSTOMERS.find(c => c.email === formCustomerEmail);

  // When customer is selected, populate vial selections
  const handleSelectCustomer = (email: string) => {
    setFormCustomerEmail(email);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
    const perfumes = MOCK_CURRENT_PERFUMES[email] || [];
    setFormVialSelections(perfumes.map(p => ({ original: p, replacement: '', selected: false })));
  };

  const filteredCustomers = MOCK_CUSTOMERS.filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const filtered = useMemo(() => {
    let result = exchanges;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.customer_name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.original_perfumes.some(p => p.toLowerCase().includes(q))
      );
    }
    if (filterStatus !== 'all') result = result.filter(e => e.status === filterStatus);
    return result;
  }, [exchanges, search, filterStatus]);

  const stats = useMemo(() => ({
    total: exchanges.length,
    pending: exchanges.filter(e => ['pending_receipt', 'eligibility_check', 'new_selection'].includes(e.status)).length,
    completed: exchanges.filter(e => e.status === 'completed').length,
    rejected: exchanges.filter(e => e.status === 'rejected').length,
  }), [exchanges]);

  const handleInitiate = () => {
    if (!selectedCustomer) { toast.error('Please select a customer'); return; }
    if (!formReason) { toast.error('Reason is required'); return; }
    const selectedVials = formVialSelections.filter(v => v.selected);
    if (selectedVials.length === 0) { toast.error('Select at least one vial to exchange'); return; }

    const newExchange: ExchangeRequest = {
      id: `EX-${String(exchanges.length + 1).padStart(3, '0')}`,
      customer_name: selectedCustomer.name,
      customer_email: selectedCustomer.email,
      subscription_vials: selectedCustomer.vials,
      exchange_number: selectedCustomer.exchanges_used + 1,
      max_exchanges_year: 3,
      status: 'pending_receipt',
      vial_exchanges: formVialSelections,
      original_perfumes: formVialSelections.filter(v => v.selected).map(v => v.original),
      new_perfumes: [],
      reason: formReason,
      created_at: new Date().toISOString().split('T')[0],
    };
    setExchanges(prev => [newExchange, ...prev]);
    toast.success(`Exchange ${newExchange.id} initiated — ${selectedVials.length} of ${selectedCustomer.vials} vials`);
    setShowInitiate(false);
    resetForm();
  };

  const resetForm = () => {
    setFormCustomerEmail('');
    setFormVialSelections([]);
    setFormReason('');
    setCustomerSearch('');
  };

  const advanceStatus = (id: string) => {
    setExchanges(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = getNextStatus(e.status);
      if (!next) return e;
      return { ...e, status: next, completed_at: next === 'completed' ? new Date().toISOString().split('T')[0] : e.completed_at };
    }));
    toast.success('Exchange status advanced');
  };

  const rejectExchange = (id: string) => {
    setExchanges(prev => prev.map(e => e.id === id ? { ...e, status: 'rejected' as ExchangeStatus, notes: 'Rejected by operator' } : e));
    toast.success('Exchange rejected');
  };

  const updateExchange = (id: string, patch: Partial<ExchangeRequest>) => {
    setExchanges(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const selectedExchangeCount = formVialSelections.filter(v => v.selected).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Exchanges"
        subtitle="Subscriber vial exchanges — swap specific vials up to 3 times per year"
        breadcrumbs={[
          { label: 'Orders & CX', href: '/orders/one-time' },
          { label: 'Exchanges' },
        ]}
        actions={
          <Button onClick={() => setShowInitiate(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            <ArrowLeftRight className="w-4 h-4" /> Initiate Exchange
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Exchanges</p>
              <p className="text-xl font-semibold mt-0.5">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-amber-500">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">In Progress</p>
              <p className="text-xl font-semibold mt-0.5 text-amber-600">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Completed</p>
              <p className="text-xl font-semibold mt-0.5 text-success">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-destructive">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rejected</p>
              <p className="text-xl font-semibold mt-0.5 text-destructive">{stats.rejected}</p>
            </CardContent>
          </Card>
        </div>

        {/* Exchange Policy Banner */}
        <Card className="border-info/20 bg-info/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Shield className="w-5 h-5 text-info shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium">Exchange Policy — Partial Vial Exchange</p>
              <p className="text-[10px] text-muted-foreground">
                Subscribers can exchange up to <strong>3 times per year</strong>. Each exchange allows swapping <strong>specific vials</strong> (1, 2, 3, or all 4) — each counts as 1 exchange regardless of how many vials are swapped.
                Flow: Receive original vials → Check eligibility → Approve → Customer selects replacements → Ship.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by customer, ID, or perfume..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_receipt">Pending Receipt</SelectItem>
              <SelectItem value="eligibility_check">Eligibility Check</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="new_selection">Awaiting Selection</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Exchanges Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Vials Swapped</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Exchange #</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Original → New</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ex => {
                    const statusConfig = STATUS_CONFIG[ex.status];
                    const StatusIcon = statusConfig.icon;
                    const canAdvance = EXCHANGE_FLOW.includes(ex.status) && ex.status !== 'completed' && ex.status !== 'rejected';
                    const remainingExchanges = ex.max_exchanges_year - ex.exchange_number;
                    const selectedCount = ex.vial_exchanges.filter(v => v.selected).length;

                    return (
                      <tr key={ex.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetailId(ex.id)}>
                        <td className="px-4 py-3">
                          <code className="text-xs font-mono font-bold text-gold">{ex.id}</code>
                          <p className="text-[10px] text-muted-foreground">{ex.created_at}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{ex.customer_name}</p>
                          <p className="text-[10px] text-muted-foreground">{ex.customer_email}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs font-bold">{selectedCount}</span>
                            <span className="text-[10px] text-muted-foreground">of {ex.subscription_vials}</span>
                          </div>
                          <div className="flex items-center justify-center gap-0.5 mt-0.5">
                            {ex.vial_exchanges.map((v, i) => (
                              <div key={i} className={cn(
                                'w-2.5 h-2.5 rounded-full border',
                                v.selected ? 'bg-gold border-gold' : 'bg-muted border-border'
                              )} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-center">
                            <span className="text-xs font-bold">{ex.exchange_number}/{ex.max_exchanges_year}</span>
                            <p className={cn('text-[10px]', remainingExchanges <= 0 ? 'text-destructive' : 'text-muted-foreground')}>
                              {remainingExchanges <= 0 ? 'No exchanges left' : `${remainingExchanges} remaining`}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {ex.vial_exchanges.filter(v => v.selected).map((v, i) => (
                              <div key={i} className="flex items-center gap-1 text-[10px]">
                                <span className="text-muted-foreground">{v.original}</span>
                                {v.replacement && (
                                  <>
                                    <ArrowRight className="w-2.5 h-2.5 text-gold shrink-0" />
                                    <span className="font-medium text-foreground">{v.replacement}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={cn('text-[10px]', statusConfig.color)}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {ex.reason}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {canAdvance && (
                              <Button size="sm" variant="outline" onClick={() => advanceStatus(ex.id)} className="h-7 text-[10px] gap-1">
                                <ChevronRight className="w-3 h-3" /> Advance
                              </Button>
                            )}
                            {canAdvance && ex.status !== 'completed' && (
                              <Button size="sm" variant="outline" onClick={() => rejectExchange(ex.id)} className="h-7 text-[10px] text-destructive hover:bg-destructive/10">
                                <XCircle className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setDetailId(ex.id)} className="h-7 text-[10px]">
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <ArrowLeftRight className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No exchanges found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exchange Flow Visual */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-gold" />
              Exchange Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
              {EXCHANGE_FLOW.map((step, idx) => {
                const config = STATUS_CONFIG[step];
                const StepIcon = config.icon;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1 min-w-[100px]">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', config.color)}>
                        <StepIcon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-center font-medium">{config.label}</span>
                    </div>
                    {idx < EXCHANGE_FLOW.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== INITIATE EXCHANGE DIALOG ===== */}
      <Dialog open={showInitiate} onOpenChange={(open) => { if (!open) { setShowInitiate(false); resetForm(); } else setShowInitiate(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-gold" />
              Initiate Exchange
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Customer *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search customer by name or email..."
                  value={selectedCustomer ? selectedCustomer.name : customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setFormCustomerEmail(''); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="pl-9"
                />
                {selectedCustomer && (
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0" onClick={() => { setFormCustomerEmail(''); setFormVialSelections([]); setCustomerSearch(''); }}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
                {showCustomerDropdown && !selectedCustomer && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.email}
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors"
                        onClick={() => handleSelectCustomer(c.email)}
                      >
                        <div>
                          <p className="text-xs font-medium">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-medium">{c.vials} vials/mo</p>
                          <p className={cn('text-[10px]', c.exchanges_used >= 3 ? 'text-destructive' : 'text-muted-foreground')}>
                            {c.exchanges_used}/3 used
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No customers found</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Customer Info Card */}
            {selectedCustomer && (
              <Card className="border-gold/20 bg-gold/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{selectedCustomer.name}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedCustomer.email}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: selectedCustomer.vials }).map((_, i) => (
                          <Droplets key={i} className="w-3 h-3 text-gold" />
                        ))}
                      </div>
                      <p className={cn('text-[10px] mt-0.5', selectedCustomer.exchanges_used >= 3 ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                        {selectedCustomer.exchanges_used}/3 exchanges used
                      </p>
                    </div>
                  </div>
                  {selectedCustomer.exchanges_used >= 3 && (
                    <div className="mt-2 flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">This customer has used all 3 exchanges for this year</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Partial Vial Selection */}
            {formVialSelections.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Vials to Exchange</Label>
                <p className="text-[10px] text-muted-foreground">Check the vials the customer wants to swap. Each exchange (regardless of vial count) counts as 1 of 3 annual exchanges.</p>
                <div className="space-y-2">
                  {formVialSelections.map((vial, idx) => (
                    <Card key={idx} className={cn(
                      'transition-all',
                      vial.selected ? 'border-gold/40 bg-gold/5' : 'border-border/50 opacity-60'
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={vial.selected}
                            onCheckedChange={(checked) => {
                              const updated = [...formVialSelections];
                              updated[idx] = { ...updated[idx], selected: !!checked };
                              setFormVialSelections(updated);
                            }}
                            className="mt-0.5"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Droplets className="w-3.5 h-3.5 text-gold" />
                              <span className="text-xs font-medium">Vial {idx + 1}: {vial.original}</span>
                            </div>
                            {vial.selected && (
                              <div className="flex items-center gap-2">
                                <ArrowRight className="w-3 h-3 text-gold shrink-0" />
                                <Select
                                  value={vial.replacement}
                                  onValueChange={(v) => {
                                    const updated = [...formVialSelections];
                                    updated[idx] = { ...updated[idx], replacement: v };
                                    setFormVialSelections(updated);
                                  }}
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder="Select replacement perfume..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AVAILABLE_PERFUMES.filter(p => p !== vial.original).map(p => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {selectedExchangeCount > 0 && (
                  <p className="text-[10px] text-gold font-medium">
                    {selectedExchangeCount} of {formVialSelections.length} vials selected for exchange
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Exchange *</Label>
              <Textarea value={formReason} onChange={e => setFormReason(e.target.value)} placeholder="Why is the customer requesting an exchange?" rows={3} />
            </div>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">Eligibility will be checked automatically</p>
                  <p className="text-[10px] text-muted-foreground">
                    System will verify the customer hasn't exceeded their annual exchange limit (3/year default).
                    Each partial exchange counts as 1 exchange regardless of how many vials are swapped.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowInitiate(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleInitiate} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" disabled={!selectedCustomer || selectedExchangeCount === 0}>
              <ArrowLeftRight className="w-4 h-4" /> Initiate Exchange ({selectedExchangeCount} vials)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DETAIL POPUP ===== */}
      {detailId && (
        <ExchangeDetailPopup
          exchange={exchanges.find(e => e.id === detailId)!}
          onClose={() => setDetailId(null)}
          onAdvance={advanceStatus}
          onReject={rejectExchange}
          onUpdate={updateExchange}
        />
      )}
    </div>
  );
}

// ---- Exchange Detail Popup ----
function ExchangeDetailPopup({ exchange, onClose, onAdvance, onReject, onUpdate }: {
  exchange: ExchangeRequest;
  onClose: () => void;
  onAdvance: (id: string) => void;
  onReject: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ExchangeRequest>) => void;
}) {
  if (!exchange) return null;

  const [editing, setEditing] = useState(false);
  const [editReason, setEditReason] = useState(exchange.reason);
  const [editNotes, setEditNotes] = useState(exchange.notes || '');
  const [editVials, setEditVials] = useState<VialExchange[]>(exchange.vial_exchanges);

  const statusConfig = STATUS_CONFIG[exchange.status];
  const StatusIcon = statusConfig.icon;
  const canAdvance = EXCHANGE_FLOW.includes(exchange.status) && exchange.status !== 'completed' && exchange.status !== 'rejected';
  const nextStatus = getNextStatus(exchange.status);
  const selectedCount = exchange.vial_exchanges.filter(v => v.selected).length;
  const remainingExchanges = exchange.max_exchanges_year - exchange.exchange_number;

  const handleSaveEdit = () => {
    const selectedVials = editVials.filter(v => v.selected);
    onUpdate(exchange.id, {
      reason: editReason,
      notes: editNotes || undefined,
      vial_exchanges: editVials,
      original_perfumes: selectedVials.map(v => v.original),
      new_perfumes: selectedVials.filter(v => v.replacement).map(v => v.replacement),
    });
    setEditing(false);
    toast.success('Exchange updated');
  };

  const handleCancel = () => {
    if (confirm('Cancel this exchange? It will be marked as rejected.')) {
      onReject(exchange.id);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-gold" />
            Exchange {exchange.id}
            {!editing && exchange.status !== 'completed' && exchange.status !== 'rejected' && (
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-[10px] gap-1" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer & Status Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{exchange.customer_name}</p>
              <p className="text-xs text-muted-foreground">{exchange.customer_email}</p>
            </div>
            <div className="text-right">
              <Badge className={cn('text-xs', statusConfig.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          {/* Exchange Info Strip */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground uppercase">Vials</p>
              <p className="text-sm font-bold">{selectedCount}/{exchange.subscription_vials}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground uppercase">Exchange #</p>
              <p className="text-sm font-bold">{exchange.exchange_number}/{exchange.max_exchanges_year}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground uppercase">Remaining</p>
              <p className={cn('text-sm font-bold', remainingExchanges <= 0 ? 'text-destructive' : '')}>{remainingExchanges}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground uppercase">Created</p>
              <p className="text-xs font-medium">{exchange.created_at}</p>
            </div>
          </div>

          {/* Pipeline */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {EXCHANGE_FLOW.map((step, idx) => {
              const config = STATUS_CONFIG[step];
              const isActive = exchange.status === step;
              const isPast = EXCHANGE_FLOW.indexOf(exchange.status) > idx;
              return (
                <div key={step} className="flex items-center gap-1">
                  <div className={cn(
                    'px-2 py-1 rounded-full text-[9px] font-medium whitespace-nowrap transition-all',
                    isActive ? config.color + ' ring-1 ring-offset-1' : isPast ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/50 text-muted-foreground'
                  )}>
                    {config.label}
                  </div>
                  {idx < EXCHANGE_FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Vial Exchange Details */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Vial Exchange Details</p>
            {(editing ? editVials : exchange.vial_exchanges).map((vial, idx) => (
              <Card key={idx} className={cn(
                'transition-all',
                vial.selected ? 'border-gold/30 bg-gold/5' : 'border-border/30 opacity-50'
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {editing ? (
                      <Checkbox
                        checked={vial.selected}
                        onCheckedChange={(checked) => {
                          const updated = [...editVials];
                          updated[idx] = { ...updated[idx], selected: !!checked };
                          setEditVials(updated);
                        }}
                      />
                    ) : (
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                        vial.selected ? 'bg-gold text-gold-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {idx + 1}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-3.5 h-3.5 text-gold" />
                        <span className="text-xs font-medium">{vial.original}</span>
                        {vial.selected && vial.replacement && (
                          <>
                            <ArrowRight className="w-3 h-3 text-gold" />
                            <span className="text-xs font-medium text-emerald-600">{vial.replacement}</span>
                          </>
                        )}
                        {vial.selected && !vial.replacement && (
                          <>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            {editing ? (
                              <Select
                                value={vial.replacement}
                                onValueChange={(v) => {
                                  const updated = [...editVials];
                                  updated[idx] = { ...updated[idx], replacement: v };
                                  setEditVials(updated);
                                }}
                              >
                                <SelectTrigger className="text-xs h-7 w-48">
                                  <SelectValue placeholder="Select replacement..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {AVAILABLE_PERFUMES.filter(p => p !== vial.original).map(p => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Pending selection</span>
                            )}
                          </>
                        )}
                      </div>
                      {!vial.selected && <span className="text-[10px] text-muted-foreground ml-7">Not exchanged — keeping original</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reason */}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">Reason</p>
            {editing ? (
              <Textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} className="text-xs" />
            ) : (
              <p className="text-xs border-l-2 border-gold/30 pl-3">{exchange.reason}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">Notes</p>
            {editing ? (
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="text-xs" placeholder="Add internal notes..." />
            ) : exchange.notes ? (
              <p className="text-xs text-muted-foreground border-l-2 border-muted pl-3">{exchange.notes}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">No notes</p>
            )}
          </div>

          {/* Completed date */}
          {exchange.completed_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3.5 h-3.5 text-success" />
              Completed on {exchange.completed_at}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap border-t pt-4">
            {editing ? (
              <>
                <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleSaveEdit}>
                  <Save className="w-3 h-3" /> Save Changes
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { setEditing(false); setEditVials(exchange.vial_exchanges); setEditReason(exchange.reason); setEditNotes(exchange.notes || ''); }}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {canAdvance && nextStatus && (
                  <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={() => { onAdvance(exchange.id); }}>
                    <ArrowRight className="w-3 h-3" /> Advance to {STATUS_CONFIG[nextStatus].label}
                  </Button>
                )}
                {canAdvance && (
                  <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10 gap-1" onClick={handleCancel}>
                    <XCircle className="w-3 h-3" /> Cancel Exchange
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
