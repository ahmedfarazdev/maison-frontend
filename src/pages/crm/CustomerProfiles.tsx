// ============================================================
// Customer Profiles — D1 Feature
// Dedicated customer list with search/filter.
// Profile: order history, subscription tier, LTV, preferred perfumes.
// Delivery address history and internal notes.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Users, Search, User, Mail, Phone, MapPin, ShoppingCart,
  DollarSign, Star, Package, Calendar, ChevronRight,
  TrendingUp, Heart, Crown, Loader2, X, StickyNote,
  RotateCcw, Eye, Lock, CreditCard, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, OrderCustomer } from '@/types';

// ---- Customer Profile Type ----
interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  country: string;
  orders: Order[];
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  subscriptionTier?: string;
  isSubscriber: boolean;
  preferredPerfumes: { name: string; brand: string; count: number }[];
  notes: string;
  // I1: Vault access & gift card fields
  vaultAccessCode?: string;
  vaultAccessGranted: boolean;
  giftCardBalance: number;
  giftCardsIssued: number;
}

// ---- Build customer profiles from orders ----
function buildCustomerProfiles(orders: Order[]): CustomerProfile[] {
  const customerMap = new Map<string, CustomerProfile>();

  orders.forEach(order => {
    const key = order.customer.email || order.customer.name;
    const existing = customerMap.get(key);

    if (existing) {
      existing.orders.push(order);
      existing.totalOrders++;
      existing.totalSpent += order.total_amount;
      if (new Date(order.created_at) < new Date(existing.firstOrderDate)) {
        existing.firstOrderDate = order.created_at;
      }
      if (new Date(order.created_at) > new Date(existing.lastOrderDate)) {
        existing.lastOrderDate = order.created_at;
      }
      if (order.type === 'subscription' && order.subscription_tier) {
        existing.subscriptionTier = order.subscription_tier;
        existing.isSubscriber = true;
      }
    } else {
      customerMap.set(key, {
        id: `CUS-${String(customerMap.size + 1).padStart(3, '0')}`,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        address: order.customer.address,
        city: order.customer.city,
        country: order.customer.country,
        orders: [order],
        totalOrders: 1,
        totalSpent: order.total_amount,
        avgOrderValue: order.total_amount,
        firstOrderDate: order.created_at,
        lastOrderDate: order.created_at,
        subscriptionTier: order.subscription_tier,
        isSubscriber: order.type === 'subscription',
        preferredPerfumes: [],
        notes: '',
        vaultAccessCode: undefined,
        vaultAccessGranted: false,
        giftCardBalance: 0,
        giftCardsIssued: 0,
      });
    }
  });

  // Calculate derived fields
  customerMap.forEach(customer => {
    customer.avgOrderValue = Math.round(customer.totalSpent / customer.totalOrders);

    // I1: Auto-generate vault access code and grant for subscribers
    const hash = customer.email.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    customer.vaultAccessCode = `EV-${String(hash).padStart(4, '0')}-${customer.id.replace('CUS-', '')}`;
    customer.vaultAccessGranted = customer.isSubscriber; // subscribers get auto-access

    // I1: Mock gift card balance based on order history
    const giftOrders = customer.orders.filter(o => o.items.some(i => i.perfume_name?.toLowerCase().includes('gift card')));
    customer.giftCardsIssued = giftOrders.length;
    customer.giftCardBalance = giftOrders.length * 100; // mock: AED 100 per gift card

    // Build preferred perfumes
    const perfumeCount = new Map<string, { name: string; brand: string; count: number }>();
    customer.orders.forEach(o => {
      o.items.forEach(item => {
        const key = item.perfume_name;
        const existing = perfumeCount.get(key);
        if (existing) {
          existing.count++;
        } else {
          perfumeCount.set(key, { name: item.perfume_name, brand: '', count: 1 });
        }
      });
    });
    customer.preferredPerfumes = Array.from(perfumeCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  return Array.from(customerMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent);
}

// ---- Tier Badge ----
function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const config: Record<string, { label: string; color: string }> = {
    gm1: { label: 'Grand Master 1', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    gm2: { label: 'Grand Master 2', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    gm3: { label: 'Grand Master 3', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    gm4: { label: 'Grand Master 4', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
    // Legacy keys for backward compatibility
    explorer: { label: 'Grand Master 1', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    alchemist: { label: 'Grand Master 2', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    grand_master: { label: 'Grand Master 3', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  };
  const c = config[tier] || { label: tier, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', c.color)}>
      <Crown className="w-3 h-3" />
      {c.label}
    </span>
  );
}

// ---- Customer Detail Sheet ----
function CustomerDetailSheet({ customer, open, onClose }: { customer: CustomerProfile | null; open: boolean; onClose: () => void }) {
  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg">{customer.name}</SheetTitle>
              <SheetDescription className="text-sm">{customer.id}</SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {customer.isSubscriber && <TierBadge tier={customer.subscriptionTier} />}
            <Badge variant="secondary" className="text-[10px]">
              {customer.totalOrders} orders
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-160px)]">
          {/* Contact Info */}
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contact</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{customer.address}, {customer.city}, {customer.country}</span>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Lifetime Value</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold">AED {customer.totalSpent.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Total Spent</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold">{customer.totalOrders}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-lg font-bold">AED {customer.avgOrderValue}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Avg Order</p>
              </div>
            </div>
          </div>

          {/* Preferred Perfumes */}
          {customer.preferredPerfumes.length > 0 && (
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Preferred Perfumes</h3>
              <div className="space-y-2">
                {customer.preferredPerfumes.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.brand && <span className="text-xs text-muted-foreground ml-2">{p.brand}</span>}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{p.count}x</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* I1: Vault Access & Subscription Status */}
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Vault Access & Subscription</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gold" />
                  <div>
                    <p className="text-sm font-medium">Em Vault Access</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{customer.vaultAccessCode || 'N/A'}</p>
                  </div>
                </div>
                <Badge variant={customer.vaultAccessGranted ? 'default' : 'secondary'}
                  className={customer.vaultAccessGranted ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : ''}>
                  {customer.vaultAccessGranted ? 'Granted' : 'Locked'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-info" />
                  <div>
                    <p className="text-sm font-medium">Subscription</p>
                    <p className="text-[10px] text-muted-foreground">
                      {customer.isSubscriber ? `Active — ${customer.subscriptionTier || 'Standard'}` : 'Not subscribed'}
                    </p>
                  </div>
                </div>
                <Badge variant={customer.isSubscriber ? 'default' : 'secondary'}
                  className={customer.isSubscriber ? 'bg-gold/15 text-gold border-gold/30' : ''}>
                  {customer.isSubscriber ? 'Subscriber' : 'Non-Subscriber'}
                </Badge>
              </div>
              {customer.giftCardBalance > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">Gift Card Balance</p>
                      <p className="text-[10px] text-muted-foreground">{customer.giftCardsIssued} card(s) issued</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-amber-600">AED {customer.giftCardBalance}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order History */}
          <div className="px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Order History</h3>
            <div className="space-y-2">
              {customer.orders
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(order => (
                  <div key={order.order_id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium">{order.order_id}</span>
                        <StatusBadge variant={order.status === 'shipped' ? 'success' : order.status === 'cancelled' ? 'destructive' : 'default'}>{order.status}</StatusBadge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}
                        {order.items.length} item(s)
                      </p>
                    </div>
                    <span className="text-sm font-semibold">AED {order.total_amount}</span>
                  </div>
                ))}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---- Main Customer Profiles Page ----
export default function CustomerProfiles() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'subscriber' | 'one_time'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [vaultOverrides, setVaultOverrides] = useState<Record<string, boolean>>({});

  // Fetch all orders
  const { data: ordersData, isLoading } = useApiQuery(() => api.orders.list());

  const customers = useMemo(() => {
    const orders = (ordersData as any)?.data || ordersData || [];
    if (!Array.isArray(orders)) return [];
    return buildCustomerProfiles(orders);
  }, [ordersData]);

  const filtered = useMemo(() => {
    let result = customers;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    }

    if (filterType === 'subscriber') {
      result = result.filter(c => c.isSubscriber);
    } else if (filterType === 'one_time') {
      result = result.filter(c => !c.isSubscriber);
    }

    return result;
  }, [customers, search, filterType]);

  const totalLTV = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const subscriberCount = customers.filter(c => c.isSubscriber).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Profiles"
        subtitle="Customer database with order history, LTV, and subscription details"
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Total Customers</span>
          </div>
          <p className="text-2xl font-bold">{customers.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Crown className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Subscribers</span>
          </div>
          <p className="text-2xl font-bold">{subscriberCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Total LTV</span>
          </div>
          <p className="text-2xl font-bold">AED {totalLTV.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Avg LTV</span>
          </div>
          <p className="text-2xl font-bold">AED {customers.length > 0 ? Math.round(totalLTV / customers.length).toLocaleString() : 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {(['all', 'subscriber', 'one_time'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                filterType === type ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {type === 'one_time' ? 'One-Time' : type === 'all' ? 'All' : 'Subscribers'}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} customers</span>
      </div>

      {/* Customer Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={search ? 'Try a different search term' : 'No customer data available yet'}
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Tier</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Orders</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Total Spent</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Avg Order</th>
                   <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Vault Code</th>
                   <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                   <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Last Order</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(customer => (
                  <tr
                    key={customer.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => { setSelectedCustomer(customer); setShowDetail(true); }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="text-[10px] text-muted-foreground">{customer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{customer.city}, {customer.country}</span>
                    </td>
                    <td className="px-4 py-3">
                      {customer.isSubscriber ? (
                        <TierBadge tier={customer.subscriptionTier} />
                      ) : (
                        <span className="text-xs text-muted-foreground">One-time</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-medium">{customer.totalOrders}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold">AED {customer.totalSpent.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-muted-foreground">AED {customer.avgOrderValue}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {customer.vaultAccessCode ? (
                        <span className="text-[11px] font-mono bg-muted/50 px-1.5 py-0.5 rounded">{customer.vaultAccessCode}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {customer.vaultAccessCode ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentState = vaultOverrides[customer.id] ?? customer.vaultAccessGranted;
                            setVaultOverrides(prev => ({ ...prev, [customer.id]: !currentState }));
                            toast.success(`Vault access ${currentState ? 'locked' : 'activated'} for ${customer.name}`);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer border ${
                            (vaultOverrides[customer.id] ?? customer.vaultAccessGranted)
                              ? 'border-emerald-500/30 text-emerald-600 bg-emerald-50 hover:bg-red-50 hover:text-red-600 hover:border-red-500/30'
                              : 'border-amber-500/30 text-amber-600 bg-amber-50 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-500/30'
                          }`}
                          title={(vaultOverrides[customer.id] ?? customer.vaultAccessGranted) ? 'Click to lock vault access' : 'Click to activate vault access'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${(vaultOverrides[customer.id] ?? customer.vaultAccessGranted) ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {(vaultOverrides[customer.id] ?? customer.vaultAccessGranted) ? 'Active' : 'Locked'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {new Date(customer.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={e => { e.stopPropagation(); setSelectedCustomer(customer); setShowDetail(true); }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Detail Sheet */}
      <CustomerDetailSheet
        customer={selectedCustomer}
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </div>
  );
}
