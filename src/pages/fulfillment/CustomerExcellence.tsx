// ============================================================
// Customer Excellence — Post-delivery customer satisfaction flow
// Shipped → Delivered → Customer Check → Case Closed
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Search, Filter, ArrowUpDown, Heart, CheckCircle2,
  Phone, MessageSquare, AlertTriangle, Star, Package,
  Clock, User, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CaseStatus = 'delivered' | 'follow_up_scheduled' | 'contacted' | 'issue_reported' | 'resolved' | 'case_closed';
type CasePriority = 'normal' | 'high' | 'urgent';

interface CustomerCase {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  product_name: string;
  delivery_date: string;
  status: CaseStatus;
  priority: CasePriority;
  assigned_to: string;
  satisfaction_rating: number | null;
  notes: string[];
  last_contact: string | null;
}

const STATUS_CONFIG: Record<CaseStatus, { label: string; variant: 'default' | 'gold' | 'info' | 'success' | 'destructive'; step: number }> = {
  delivered: { label: 'Delivered', variant: 'default', step: 1 },
  follow_up_scheduled: { label: 'Follow-up Scheduled', variant: 'gold', step: 2 },
  contacted: { label: 'Contacted', variant: 'info', step: 3 },
  issue_reported: { label: 'Issue Reported', variant: 'destructive', step: 3 },
  resolved: { label: 'Resolved', variant: 'success', step: 4 },
  case_closed: { label: 'Case Closed', variant: 'success', step: 5 },
};

const PRIORITY_CONFIG: Record<CasePriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'text-muted-foreground' },
  high: { label: 'High', color: 'text-amber-500' },
  urgent: { label: 'Urgent', color: 'text-red-500' },
};

export default function CustomerExcellence() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<CaseStatus | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const cases: CustomerCase[] = useMemo(() => [
    {
      id: 'CE-001', order_id: 'ORD-2026-0892', customer_name: 'Mariam Al Hashimi',
      customer_phone: '+971 50 123 4567', customer_email: 'mariam@example.com',
      product_name: 'Aura Discovery Set — Woody', delivery_date: '2026-03-08',
      status: 'delivered', priority: 'normal', assigned_to: 'Unassigned',
      satisfaction_rating: null, notes: ['Package delivered to reception desk'],
      last_contact: null,
    },
    {
      id: 'CE-002', order_id: 'ORD-2026-0885', customer_name: 'Ahmed Khalil',
      customer_phone: '+971 55 987 6543', customer_email: 'ahmed.k@example.com',
      product_name: 'Monthly Refill — Oud Collection', delivery_date: '2026-03-07',
      status: 'follow_up_scheduled', priority: 'normal', assigned_to: 'Nadia H.',
      satisfaction_rating: null,
      notes: ['Package delivered', 'Follow-up call scheduled for March 10'],
      last_contact: null,
    },
    {
      id: 'CE-003', order_id: 'ORD-2026-0878', customer_name: 'Fatima Al Zahra',
      customer_phone: '+971 52 456 7890', customer_email: 'fatima.z@example.com',
      product_name: 'Gift Set For Her — Rose Edition', delivery_date: '2026-03-06',
      status: 'contacted', priority: 'normal', assigned_to: 'Nadia H.',
      satisfaction_rating: 5,
      notes: ['Package delivered', 'Called customer — very happy with the set', 'Customer mentioned she loves the rose notes'],
      last_contact: '2026-03-08T10:30:00',
    },
    {
      id: 'CE-004', order_id: 'ORD-2026-0871', customer_name: 'Khalid Bin Rashid',
      customer_phone: '+971 56 321 0987', customer_email: 'khalid.r@example.com',
      product_name: 'Capsule: Oud Royale Collection', delivery_date: '2026-03-05',
      status: 'issue_reported', priority: 'urgent', assigned_to: 'Sara M.',
      satisfaction_rating: 2,
      notes: ['Package delivered', 'Customer called — one vial arrived with loose cap', 'Replacement vial being prepared', 'Escalated to urgent priority'],
      last_contact: '2026-03-07T14:00:00',
    },
    {
      id: 'CE-005', order_id: 'ORD-2026-0864', customer_name: 'Layla Noor',
      customer_phone: '+971 58 654 3210', customer_email: 'layla.n@example.com',
      product_name: 'Whisperer Vials — Amber Night', delivery_date: '2026-03-04',
      status: 'resolved', priority: 'high', assigned_to: 'Nadia H.',
      satisfaction_rating: 4,
      notes: ['Package delivered', 'Customer reported wrong fragrance in slot 2', 'Replacement sent via express', 'Customer confirmed replacement received — satisfied'],
      last_contact: '2026-03-08T16:00:00',
    },
    {
      id: 'CE-006', order_id: 'ORD-2026-0857', customer_name: 'Omar Saeed',
      customer_phone: '+971 50 789 0123', customer_email: 'omar.s@example.com',
      product_name: 'Aura Discovery Set — Floral', delivery_date: '2026-03-03',
      status: 'case_closed', priority: 'normal', assigned_to: 'Nadia H.',
      satisfaction_rating: 5,
      notes: ['Package delivered', 'Follow-up call — customer delighted', 'Mentioned he wants to upgrade to Grand Master 3', 'Case closed — positive outcome'],
      last_contact: '2026-03-05T11:00:00',
    },
  ], []);

  const filteredCases = useMemo(() => {
    let result = cases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.customer_name.toLowerCase().includes(q) ||
        c.order_id.toLowerCase().includes(q) ||
        c.product_name.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(c => c.status === filterStatus);
    }
    result = [...result].sort((a, b) => {
      const diff = new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });
    return result;
  }, [cases, search, filterStatus, sortOrder]);

  // KPIs
  const kpis = useMemo(() => {
    const total = cases.length;
    const open = cases.filter(c => !['case_closed', 'resolved'].includes(c.status)).length;
    const issues = cases.filter(c => c.status === 'issue_reported').length;
    const ratings = cases.filter(c => c.satisfaction_rating !== null).map(c => c.satisfaction_rating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const closed = cases.filter(c => c.status === 'case_closed').length;
    return { total, open, issues, avgRating, closed };
  }, [cases]);

  const handleCloseCase = (caseId: string) => {
    toast.success(`Case ${caseId} closed`);
  };

  const handleScheduleFollowUp = (caseId: string) => {
    toast.success(`Follow-up scheduled for ${caseId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Excellence"
        subtitle="Post-delivery customer satisfaction tracking — follow-up calls, issue resolution, and case management"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Cases</p>
          <p className="text-2xl font-mono font-bold mt-1">{kpis.total}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Open Cases</p>
          <p className="text-2xl font-mono font-bold text-gold mt-1">{kpis.open}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Issues</p>
          <p className="text-2xl font-mono font-bold text-red-500 mt-1">{kpis.issues}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Avg. Rating</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="w-4 h-4 text-gold fill-gold" />
            <p className="text-2xl font-mono font-bold">{kpis.avgRating.toFixed(1)}</p>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Closed</p>
          <p className="text-2xl font-mono font-bold text-emerald-500 mt-1">{kpis.closed}</p>
        </div>
      </div>

      {/* Pipeline Flow Visualization */}
      <SectionCard title="Post-Delivery Pipeline" subtitle="Customer excellence workflow stages">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {(['delivered', 'follow_up_scheduled', 'contacted', 'issue_reported', 'resolved', 'case_closed'] as CaseStatus[]).map((status, i, arr) => {
            const config = STATUS_CONFIG[status];
            const count = cases.filter(c => c.status === status).length;
            return (
              <div key={status} className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg border transition-all min-w-[100px]',
                    filterStatus === status
                      ? 'border-gold bg-gold/10 ring-1 ring-gold/30'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <span className="text-lg font-mono font-bold">{count}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">{config.label}</span>
                </button>
                {i < arr.length - 1 && (
                  <div className="w-6 h-px bg-border flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer, order ID, or product..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <button
          onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" /> {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {filteredCases.map(c => {
          const statusConfig = STATUS_CONFIG[c.status];
          const priorityConfig = PRIORITY_CONFIG[c.priority];
          const isExpanded = expandedCase === c.id;

          return (
            <div
              key={c.id}
              className={cn(
                'bg-card border rounded-xl overflow-hidden transition-all',
                c.priority === 'urgent' ? 'border-red-500/40' :
                c.priority === 'high' ? 'border-amber-500/40' : 'border-border/60'
              )}
            >
              {/* Case Header */}
              <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCase(isExpanded ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{c.id}</span>
                    <span className="text-xs font-mono text-muted-foreground">{c.order_id}</span>
                    {c.priority !== 'normal' && (
                      <span className={cn('text-[10px] uppercase font-bold', priorityConfig.color)}>
                        <AlertTriangle className="w-3 h-3 inline mr-0.5" />{priorityConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-0.5">{c.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{c.product_name}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.satisfaction_rating !== null && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'w-3 h-3',
                            i < c.satisfaction_rating! ? 'text-gold fill-gold' : 'text-muted-foreground/30'
                          )}
                        />
                      ))}
                    </div>
                  )}
                  <StatusBadge variant={statusConfig.variant}>{statusConfig.label}</StatusBadge>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-border/50 px-4 py-4 bg-muted/10 space-y-4">
                  {/* Customer Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Phone</p>
                      <p className="text-sm font-mono mt-0.5">{c.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</p>
                      <p className="text-sm mt-0.5">{c.customer_email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Delivered</p>
                      <p className="text-sm font-mono mt-0.5">{new Date(c.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Assigned To</p>
                      <p className="text-sm mt-0.5">{c.assigned_to}</p>
                    </div>
                  </div>

                  {/* Notes Timeline */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Activity Log</p>
                    <div className="space-y-2">
                      {c.notes.map((note, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
                    {c.status !== 'case_closed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => handleScheduleFollowUp(c.id)}
                        >
                          <Phone className="w-3 h-3" /> Schedule Follow-up
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => toast.info('WhatsApp message template — coming soon')}
                        >
                          <MessageSquare className="w-3 h-3" /> Send WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleCloseCase(c.id)}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Close Case
                        </Button>
                      </>
                    )}
                    {c.status === 'case_closed' && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="font-medium">Case closed</span>
                        {c.last_contact && (
                          <span className="text-muted-foreground ml-1">
                            · Last contact: {new Date(c.last_contact).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredCases.length === 0 && (
          <div className="text-center py-10">
            <Heart className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No customer cases found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Post-delivery cases will appear here after orders are shipped</p>
          </div>
        )}
      </div>
    </div>
  );
}
