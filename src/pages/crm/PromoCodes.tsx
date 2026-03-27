// ============================================================
// Promo Codes — CRM Module
// Comprehensive promo code creation, management, and analytics.
// Types: percentage, fixed amount, free shipping, free vial.
// Modes: single-use, multi-use, auto-apply, stackable.
// Linkable to specific CRM customers or public/open.
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Tag, Plus, Search, Copy, Trash2, Edit, Eye, EyeOff,
  Percent, DollarSign, Truck, Droplets, Users, User,
  Calendar, Clock, BarChart3, TrendingUp, Gift, Shield,
  CheckCircle, XCircle, Layers, Sparkles, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
type PromoType = 'percentage' | 'fixed' | 'free_shipping' | 'free_vial';
type PromoScope = 'public' | 'customer_specific' | 'segment';
type PromoUsage = 'single_use' | 'multi_use' | 'unlimited';

interface PromoCode {
  id: string;
  code: string;
  name: string;
  description: string;
  type: PromoType;
  value: number; // percentage or AED amount
  scope: PromoScope;
  linked_customer?: string; // customer name if customer_specific
  linked_segment?: string; // segment name if segment
  usage_mode: PromoUsage;
  max_uses: number | null; // null = unlimited
  current_uses: number;
  min_order_value: number;
  max_discount?: number; // cap for percentage discounts
  applies_to: 'all' | 'subscription' | 'one_time' | 'gift' | 'capsule';
  stackable: boolean;
  auto_apply: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  total_revenue_generated: number;
  total_discount_given: number;
}

// ---- Mock Data ----
const mockPromoCodes: PromoCode[] = [
  {
    id: 'PC-001', code: 'WELCOME15', name: 'Welcome Discount', description: 'First-time subscriber welcome offer',
    type: 'percentage', value: 15, scope: 'public', usage_mode: 'single_use', max_uses: null, current_uses: 43,
    min_order_value: 0, max_discount: 50, applies_to: 'subscription', stackable: false, auto_apply: false,
    start_date: '2025-01-01', end_date: null, is_active: true, created_at: '2025-01-01',
    total_revenue_generated: 12450, total_discount_given: 1890,
  },
  {
    id: 'PC-002', code: 'REEM-VIP', name: 'Reem VIP Code', description: 'Personal code for Reem Al-Falasi',
    type: 'fixed', value: 50, scope: 'customer_specific', linked_customer: 'Reem Al-Falasi',
    usage_mode: 'multi_use', max_uses: 5, current_uses: 2,
    min_order_value: 100, applies_to: 'all', stackable: false, auto_apply: false,
    start_date: '2025-06-01', end_date: '2026-06-01', is_active: true, created_at: '2025-06-01',
    total_revenue_generated: 890, total_discount_given: 100,
  },
  {
    id: 'PC-003', code: 'FREESHIP', name: 'Free Shipping Weekend', description: 'Weekend free shipping promo',
    type: 'free_shipping', value: 0, scope: 'public', usage_mode: 'unlimited', max_uses: null, current_uses: 156,
    min_order_value: 50, applies_to: 'all', stackable: true, auto_apply: true,
    start_date: '2026-02-22', end_date: '2026-02-28', is_active: true, created_at: '2026-02-20',
    total_revenue_generated: 8200, total_discount_given: 2340,
  },
  {
    id: 'PC-004', code: 'EXTRAVIAL', name: 'Free Extra Vial', description: 'Get a bonus vial with 3+ vial subscription',
    type: 'free_vial', value: 1, scope: 'segment', linked_segment: '3+ Vial Subscribers',
    usage_mode: 'single_use', max_uses: 100, current_uses: 28,
    min_order_value: 0, applies_to: 'subscription', stackable: false, auto_apply: false,
    start_date: '2026-01-15', end_date: '2026-03-15', is_active: true, created_at: '2026-01-15',
    total_revenue_generated: 5600, total_discount_given: 840,
  },
  {
    id: 'PC-005', code: 'GIFT20', name: 'Gift Set Discount', description: '20% off all gift sets',
    type: 'percentage', value: 20, scope: 'public', usage_mode: 'multi_use', max_uses: 200, current_uses: 67,
    min_order_value: 150, max_discount: 100, applies_to: 'gift', stackable: false, auto_apply: false,
    start_date: '2025-12-01', end_date: '2026-01-31', is_active: false, created_at: '2025-12-01',
    total_revenue_generated: 15800, total_discount_given: 3960,
  },
];

const PROMO_TYPE_CONFIG: Record<PromoType, { label: string; icon: typeof Percent; color: string }> = {
  percentage: { label: 'Percentage Off', icon: Percent, color: 'text-gold' },
  fixed: { label: 'Fixed Amount Off', icon: DollarSign, color: 'text-info' },
  free_shipping: { label: 'Free Shipping', icon: Truck, color: 'text-emerald-500' },
  free_vial: { label: 'Free Vial', icon: Droplets, color: 'text-purple-500' },
};

const SCOPE_CONFIG: Record<PromoScope, { label: string; icon: typeof Users }> = {
  public: { label: 'Public / Open', icon: Users },
  customer_specific: { label: 'Specific Customer', icon: User },
  segment: { label: 'Customer Segment', icon: Shield },
};

export default function PromoCodes() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(mockPromoCodes);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<PromoType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);

  // Create form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PromoType>('percentage');
  const [formValue, setFormValue] = useState('');
  const [formScope, setFormScope] = useState<PromoScope>('public');
  const [formLinkedCustomer, setFormLinkedCustomer] = useState('');
  const [formLinkedSegment, setFormLinkedSegment] = useState('');
  const [formUsageMode, setFormUsageMode] = useState<PromoUsage>('single_use');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formMinOrder, setFormMinOrder] = useState('0');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formAppliesTo, setFormAppliesTo] = useState<PromoCode['applies_to']>('all');
  const [formStackable, setFormStackable] = useState(false);
  const [formAutoApply, setFormAutoApply] = useState(false);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');

  const filtered = useMemo(() => {
    let result = promoCodes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.linked_customer?.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'all') result = result.filter(p => p.type === filterType);
    if (filterStatus === 'active') result = result.filter(p => p.is_active);
    if (filterStatus === 'expired') result = result.filter(p => !p.is_active);
    return result;
  }, [promoCodes, search, filterType, filterStatus]);

  const stats = useMemo(() => ({
    total: promoCodes.length,
    active: promoCodes.filter(p => p.is_active).length,
    totalUses: promoCodes.reduce((s, p) => s + p.current_uses, 0),
    totalRevenue: promoCodes.reduce((s, p) => s + p.total_revenue_generated, 0),
    totalDiscount: promoCodes.reduce((s, p) => s + p.total_discount_given, 0),
  }), [promoCodes]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setFormCode(code);
  };

  const resetForm = () => {
    setFormCode(''); setFormName(''); setFormDescription('');
    setFormType('percentage'); setFormValue(''); setFormScope('public');
    setFormLinkedCustomer(''); setFormLinkedSegment('');
    setFormUsageMode('single_use'); setFormMaxUses(''); setFormMinOrder('0');
    setFormMaxDiscount(''); setFormAppliesTo('all');
    setFormStackable(false); setFormAutoApply(false);
    setFormStartDate(new Date().toISOString().split('T')[0]); setFormEndDate('');
    setEditingCode(null);
  };

  const handleCreate = () => {
    if (!formCode || !formName) { toast.error('Code and name are required'); return; }
    if (promoCodes.some(p => p.code === formCode && p.id !== editingCode?.id)) {
      toast.error('Code already exists'); return;
    }

    const newCode: PromoCode = {
      id: editingCode?.id || `PC-${String(promoCodes.length + 1).padStart(3, '0')}`,
      code: formCode.toUpperCase(),
      name: formName,
      description: formDescription,
      type: formType,
      value: Number(formValue) || 0,
      scope: formScope,
      linked_customer: formScope === 'customer_specific' ? formLinkedCustomer : undefined,
      linked_segment: formScope === 'segment' ? formLinkedSegment : undefined,
      usage_mode: formUsageMode,
      max_uses: formUsageMode === 'unlimited' ? null : (Number(formMaxUses) || null),
      current_uses: editingCode?.current_uses || 0,
      min_order_value: Number(formMinOrder) || 0,
      max_discount: formType === 'percentage' && formMaxDiscount ? Number(formMaxDiscount) : undefined,
      applies_to: formAppliesTo,
      stackable: formStackable,
      auto_apply: formAutoApply,
      start_date: formStartDate,
      end_date: formEndDate || null,
      is_active: true,
      created_at: editingCode?.created_at || new Date().toISOString(),
      total_revenue_generated: editingCode?.total_revenue_generated || 0,
      total_discount_given: editingCode?.total_discount_given || 0,
    };

    if (editingCode) {
      setPromoCodes(prev => prev.map(p => p.id === editingCode.id ? newCode : p));
      toast.success(`Promo code ${newCode.code} updated`);
    } else {
      setPromoCodes(prev => [...prev, newCode]);
      toast.success(`Promo code ${newCode.code} created`);
    }
    setShowCreate(false);
    resetForm();
  };

  const handleEdit = (code: PromoCode) => {
    setEditingCode(code);
    setFormCode(code.code); setFormName(code.name); setFormDescription(code.description);
    setFormType(code.type); setFormValue(String(code.value)); setFormScope(code.scope);
    setFormLinkedCustomer(code.linked_customer || ''); setFormLinkedSegment(code.linked_segment || '');
    setFormUsageMode(code.usage_mode); setFormMaxUses(code.max_uses ? String(code.max_uses) : '');
    setFormMinOrder(String(code.min_order_value)); setFormMaxDiscount(code.max_discount ? String(code.max_discount) : '');
    setFormAppliesTo(code.applies_to); setFormStackable(code.stackable); setFormAutoApply(code.auto_apply);
    setFormStartDate(code.start_date); setFormEndDate(code.end_date || '');
    setShowCreate(true);
  };

  const toggleActive = (id: string) => {
    setPromoCodes(prev => prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p));
    const code = promoCodes.find(p => p.id === id);
    toast.success(`${code?.code} ${code?.is_active ? 'deactivated' : 'activated'}`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`${code} copied to clipboard`);
  };

  const deleteCode = (id: string) => {
    setPromoCodes(prev => prev.filter(p => p.id !== id));
    toast.success('Promo code deleted');
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Promo Codes"
        subtitle="Create and manage promotional codes, discounts, and special offers"
        breadcrumbs={[
          { label: 'CRM', href: '/crm/customers' },
          { label: 'Promo Codes' },
        ]}
        actions={
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            <Plus className="w-4 h-4" /> Create Promo Code
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Codes</p>
              <p className="text-xl font-semibold mt-0.5">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">{stats.active} active</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Uses</p>
              <p className="text-xl font-semibold mt-0.5">{stats.totalUses}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-info">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Revenue Generated</p>
              <p className="text-xl font-semibold mt-0.5 font-mono">AED {(stats.totalRevenue / 1000).toFixed(1)}K</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-destructive">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Discounts</p>
              <p className="text-xl font-semibold mt-0.5 font-mono text-destructive">AED {(stats.totalDiscount / 1000).toFixed(1)}K</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ROI</p>
              <p className="text-xl font-semibold mt-0.5 text-success">
                {stats.totalDiscount > 0 ? ((stats.totalRevenue / stats.totalDiscount) * 100 - 100).toFixed(0) : '0'}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search codes, names, customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="percentage">Percentage Off</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
              <SelectItem value="free_shipping">Free Shipping</SelectItem>
              <SelectItem value="free_vial">Free Vial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Promo Codes Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Value</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Scope</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Uses</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Applies To</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Flags</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(code => {
                    const typeConfig = PROMO_TYPE_CONFIG[code.type];
                    const TypeIcon = typeConfig.icon;
                    return (
                      <tr key={code.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded">{code.code}</code>
                            <button onClick={() => copyCode(code.code)} className="text-muted-foreground hover:text-foreground">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{code.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{code.description}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <TypeIcon className={cn('w-3.5 h-3.5', typeConfig.color)} />
                            <span className="text-[10px]">{typeConfig.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs font-semibold">
                          {code.type === 'percentage' ? `${code.value}%` :
                           code.type === 'fixed' ? `AED ${code.value}` :
                           code.type === 'free_vial' ? `${code.value} vial` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {code.scope === 'customer_specific' ? code.linked_customer :
                             code.scope === 'segment' ? code.linked_segment : 'Public'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-mono">
                          {code.current_uses}{code.max_uses ? `/${code.max_uses}` : '/∞'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className="text-[10px] capitalize">{code.applies_to.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => toggleActive(code.id)}>
                            {code.is_active ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] cursor-pointer hover:bg-red-500/15 hover:text-red-600">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground cursor-pointer hover:bg-emerald-500/15 hover:text-emerald-600">Inactive</Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {code.stackable && <Badge variant="outline" className="text-[9px] px-1">Stack</Badge>}
                            {code.auto_apply && <Badge variant="outline" className="text-[9px] px-1 border-gold/30 text-gold">Auto</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleEdit(code)} className="p-1 hover:bg-muted rounded">
                              <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteCode(code.id)} className="p-1 hover:bg-destructive/10 rounded">
                              <Trash2 className="w-3.5 h-3.5 text-destructive/60" />
                            </button>
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
                <Tag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No promo codes found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="border-gold/20 bg-gold/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              Promo Code Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="text-xs font-semibold mb-1">Single-Use Welcome</p>
                <p className="text-[10px] text-muted-foreground">One-time 10-15% off for new subscribers. Set scope to "Public" with single-use mode.</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="text-xs font-semibold mb-1">VIP Customer Codes</p>
                <p className="text-[10px] text-muted-foreground">Link to specific CRM customer. Multi-use with 3-5 max uses. Fixed AED amount works best.</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="text-xs font-semibold mb-1">Auto-Apply Shipping</p>
                <p className="text-[10px] text-muted-foreground">Enable auto-apply + stackable for free shipping. Set min order to prevent abuse.</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border">
                <p className="text-xs font-semibold mb-1">Segment Targeting</p>
                <p className="text-[10px] text-muted-foreground">Target "3+ Vial Subscribers" or "At-Risk" segments with free vial promos to retain.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } else setShowCreate(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-gold" />
              {editingCode ? 'Edit Promo Code' : 'Create Promo Code'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Code & Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Promo Code *</Label>
                <div className="flex gap-2">
                  <Input value={formCode} onChange={e => setFormCode(e.target.value.toUpperCase())} placeholder="WELCOME15" className="font-mono" />
                  <Button type="button" variant="outline" size="sm" onClick={generateCode} className="shrink-0 text-xs">Generate</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Welcome Discount" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Internal note about this promo..." rows={2} />
            </div>

            {/* Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Discount Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as PromoType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (AED)</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                    <SelectItem value="free_vial">Free Vial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {formType === 'percentage' ? 'Discount %' :
                   formType === 'fixed' ? 'Amount (AED)' :
                   formType === 'free_vial' ? 'Number of Vials' : 'N/A'}
                </Label>
                <Input
                  type="number"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder={formType === 'percentage' ? '15' : formType === 'fixed' ? '50' : '1'}
                  disabled={formType === 'free_shipping'}
                />
              </div>
            </div>

            {/* Scope */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Scope</Label>
                <Select value={formScope} onValueChange={(v) => setFormScope(v as PromoScope)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public / Open</SelectItem>
                    <SelectItem value="customer_specific">Specific Customer</SelectItem>
                    <SelectItem value="segment">Customer Segment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formScope === 'customer_specific' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Name</Label>
                  <Input value={formLinkedCustomer} onChange={e => setFormLinkedCustomer(e.target.value)} placeholder="Reem Al-Falasi" />
                </div>
              )}
              {formScope === 'segment' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Segment</Label>
                  <Select value={formLinkedSegment} onValueChange={setFormLinkedSegment}>
                    <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Subscribers">All Subscribers</SelectItem>
                      <SelectItem value="3+ Vial Subscribers">3+ Vial Subscribers</SelectItem>
                      <SelectItem value="At-Risk Subscribers">At-Risk Subscribers</SelectItem>
                      <SelectItem value="New Subscribers (< 3mo)">New Subscribers (&lt; 3mo)</SelectItem>
                      <SelectItem value="VIP (12+ months)">VIP (12+ months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Usage */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Usage Mode</Label>
                <Select value={formUsageMode} onValueChange={(v) => setFormUsageMode(v as PromoUsage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_use">Single Use (per customer)</SelectItem>
                    <SelectItem value="multi_use">Multi Use (limited)</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Uses</Label>
                <Input
                  type="number"
                  value={formUsageMode === 'multi_use' ? formMaxUses : ''}
                  onChange={e => setFormMaxUses(e.target.value)}
                  placeholder={formUsageMode === 'multi_use' ? '100' : '—'}
                  disabled={formUsageMode !== 'multi_use'}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min Order Value (AED)</Label>
                <Input type="number" value={formMinOrder} onChange={e => setFormMinOrder(e.target.value)} placeholder="0" />
              </div>
            </div>

            {/* Max discount cap for percentage */}
            {formType === 'percentage' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Max Discount Cap (AED) — optional</Label>
                <Input type="number" value={formMaxDiscount} onChange={e => setFormMaxDiscount(e.target.value)} placeholder="100" />
              </div>
            )}

            {/* Applies To */}
            <div className="space-y-1.5">
              <Label className="text-xs">Applies To</Label>
              <Select value={formAppliesTo} onValueChange={(v) => setFormAppliesTo(v as PromoCode['applies_to'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="subscription">Subscription Only</SelectItem>
                  <SelectItem value="one_time">One-Time Orders Only</SelectItem>
                  <SelectItem value="gift">Gift Sets / Gift Subscriptions</SelectItem>
                  <SelectItem value="capsule">Capsules Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date (leave blank for no expiry)</Label>
                <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-8 py-2">
              <div className="flex items-center gap-2">
                <Switch checked={formStackable} onCheckedChange={setFormStackable} />
                <Label className="text-xs">Stackable (can combine with other codes)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formAutoApply} onCheckedChange={setFormAutoApply} />
                <Label className="text-xs">Auto-Apply (no code entry needed)</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
              <Tag className="w-4 h-4" />
              {editingCode ? 'Update Code' : 'Create Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
