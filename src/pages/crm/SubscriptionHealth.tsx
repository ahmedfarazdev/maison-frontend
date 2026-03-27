// ============================================================
// Subscription Health Dashboard — Vials-Based Analytics
// Vial distribution (1/2/3/4), perfume & S-tier stats,
// at-risk subscribers by vial count, retention curves.
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle,
  RefreshCcw, Heart, UserMinus, UserPlus, Crown, Shield,
  Star, ArrowRight, Clock, Minus, BarChart3, Download,
  Droplets, Beaker, Sparkles, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
interface SubscriptionMetrics {
  total_subscribers: number;
  active_subscribers: number;
  paused_subscribers: number;
  cancelled_subscribers: number;
  mrr: number;
  arr: number;
  churn_rate: number;
  renewal_rate: number;
  avg_lifetime_months: number;
  avg_ltv: number;
  new_this_month: number;
  churned_this_month: number;
  net_growth: number;
}

interface AtRiskSubscriber {
  customer_name: string;
  customer_email: string;
  vials_per_month: number;
  months_active: number;
  last_order_days_ago: number;
  risk_score: number;
  risk_reason: string;
  mrr_value: number;
  top_perfume?: string;
  s_tier?: string;
}

interface VialDistribution {
  vials: number;
  label: string;
  count: number;
  pct: number;
  mrr: number;
  avg_ltv: number;
  color: string;
  bgColor: string;
}

interface PerfumeStats {
  name: string;
  house: string;
  s_tier: string;
  total_orders: number;
  unique_subscribers: number;
  pct_of_subscribers: number;
}

interface STierDistribution {
  tier: string;
  count: number;
  pct: number;
  avg_surcharge: number;
  color: string;
}

// ---- Mock data ----
const mockMetrics: SubscriptionMetrics = {
  total_subscribers: 247,
  active_subscribers: 198,
  paused_subscribers: 22,
  cancelled_subscribers: 27,
  mrr: 34650,
  arr: 415800,
  churn_rate: 4.2,
  renewal_rate: 95.8,
  avg_lifetime_months: 8.3,
  avg_ltv: 2890,
  new_this_month: 18,
  churned_this_month: 8,
  net_growth: 10,
};

const mockAtRisk: AtRiskSubscriber[] = [
  { customer_name: 'Reem Al-Falasi', customer_email: 'reem@example.com', vials_per_month: 4, months_active: 3, last_order_days_ago: 45, risk_score: 82, risk_reason: 'No engagement in 45 days, skipped last renewal', mrr_value: 249, top_perfume: 'Baccarat Rouge 540', s_tier: 'S3' },
  { customer_name: 'Omar Khalil', customer_email: 'omar@example.com', vials_per_month: 2, months_active: 6, last_order_days_ago: 30, risk_score: 65, risk_reason: 'Downgraded from 4 vials, opened support ticket', mrr_value: 149, top_perfume: 'Oud Wood', s_tier: 'S1' },
  { customer_name: 'Layla Hassan', customer_email: 'layla@example.com', vials_per_month: 1, months_active: 2, last_order_days_ago: 38, risk_score: 71, risk_reason: 'Low engagement score, no add-on purchases', mrr_value: 89, top_perfume: 'Aventus', s_tier: 'S2' },
  { customer_name: 'Faisal Noor', customer_email: 'faisal@example.com', vials_per_month: 3, months_active: 12, last_order_days_ago: 25, risk_score: 55, risk_reason: 'Paused subscription, previously consistent', mrr_value: 199, top_perfume: 'Layton', s_tier: 'S1' },
  { customer_name: 'Nadia Youssef', customer_email: 'nadia@example.com', vials_per_month: 2, months_active: 4, last_order_days_ago: 42, risk_score: 78, risk_reason: 'Missed last 2 deliveries, no response to emails', mrr_value: 149, top_perfume: 'Lost Cherry', s_tier: 'S4' },
];

const mockVialDistribution: VialDistribution[] = [
  { vials: 4, label: '4 Vials/mo', count: 32, pct: 16.2, mrr: 7968, avg_ltv: 4800, color: 'text-gold', bgColor: 'bg-gold' },
  { vials: 3, label: '3 Vials/mo', count: 48, pct: 24.2, mrr: 9552, avg_ltv: 3600, color: 'text-amber-500', bgColor: 'bg-amber-500' },
  { vials: 2, label: '2 Vials/mo', count: 72, pct: 36.4, mrr: 10728, avg_ltv: 2400, color: 'text-info', bgColor: 'bg-info' },
  { vials: 1, label: '1 Vial/mo', count: 46, pct: 23.2, mrr: 4094, avg_ltv: 1200, color: 'text-muted-foreground', bgColor: 'bg-muted-foreground/60' },
];

const mockPerfumeStats: PerfumeStats[] = [
  { name: 'Baccarat Rouge 540', house: 'MFK', s_tier: 'S3', total_orders: 89, unique_subscribers: 67, pct_of_subscribers: 33.8 },
  { name: 'Aventus', house: 'Creed', s_tier: 'S2', total_orders: 76, unique_subscribers: 58, pct_of_subscribers: 29.3 },
  { name: 'Oud Wood', house: 'Tom Ford', s_tier: 'S1', total_orders: 65, unique_subscribers: 51, pct_of_subscribers: 25.8 },
  { name: 'Layton', house: 'PDM', s_tier: 'S1', total_orders: 54, unique_subscribers: 42, pct_of_subscribers: 21.2 },
  { name: 'Lost Cherry', house: 'Tom Ford', s_tier: 'S4', total_orders: 48, unique_subscribers: 39, pct_of_subscribers: 19.7 },
  { name: 'Nishane Hacivat', house: 'Nishane', s_tier: 'S2', total_orders: 41, unique_subscribers: 33, pct_of_subscribers: 16.7 },
  { name: 'Interlude Man', house: 'Amouage', s_tier: 'S3', total_orders: 38, unique_subscribers: 30, pct_of_subscribers: 15.2 },
  { name: 'Tobacco Vanille', house: 'Tom Ford', s_tier: 'S2', total_orders: 35, unique_subscribers: 28, pct_of_subscribers: 14.1 },
];

const mockSTierDistribution: STierDistribution[] = [
  { tier: 'S0', count: 28, pct: 8.4, avg_surcharge: 0, color: 'bg-emerald-500' },
  { tier: 'S1', count: 89, pct: 26.7, avg_surcharge: 5, color: 'bg-info' },
  { tier: 'S2', count: 112, pct: 33.6, avg_surcharge: 10, color: 'bg-amber-500' },
  { tier: 'S3', count: 68, pct: 20.4, avg_surcharge: 20, color: 'bg-gold' },
  { tier: 'S4', count: 29, pct: 8.7, avg_surcharge: 35, color: 'bg-rose-500' },
  { tier: 'S5', count: 7, pct: 2.1, avg_surcharge: 55, color: 'bg-purple-500' },
];

// ---- Retention Cohort Data ----
const retentionCohorts = [
  { month: 'Month 1', rate: 100 },
  { month: 'Month 2', rate: 92 },
  { month: 'Month 3', rate: 85 },
  { month: 'Month 4', rate: 80 },
  { month: 'Month 5', rate: 76 },
  { month: 'Month 6', rate: 73 },
  { month: 'Month 7', rate: 71 },
  { month: 'Month 8', rate: 69 },
  { month: 'Month 9', rate: 68 },
  { month: 'Month 10', rate: 67 },
  { month: 'Month 11', rate: 66 },
  { month: 'Month 12', rate: 65 },
];

export default function SubscriptionHealth() {
  const [period, setPeriod] = useState('30d');
  const metrics = mockMetrics;
  const atRisk = mockAtRisk;
  const vialDist = mockVialDistribution;
  const perfumeStats = mockPerfumeStats;
  const sTierDist = mockSTierDistribution;

  const handleExportCSV = () => {
    const headers = ['Customer', 'Email', 'Vials/mo', 'Months Active', 'Last Order (days)', 'Risk Score', 'Risk Reason', 'MRR', 'Top Perfume', 'S-Tier'];
    const rows = atRisk.map(r => [r.customer_name, r.customer_email, r.vials_per_month, r.months_active, r.last_order_days_ago, r.risk_score, `"${r.risk_reason}"`, r.mrr_value, r.top_perfume || '', r.s_tier || '']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `at-risk-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Subscription Health"
        subtitle="Vials-based subscriber analytics, perfume preferences, and S-tier distribution"
        breadcrumbs={[
          { label: 'CRM', href: '/crm/customers' },
          { label: 'Subscription Health' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportCSV} className="gap-1.5">
              <Download className="w-4 h-4" />
              Export At-Risk
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Active</p>
              <p className="text-xl font-semibold mt-0.5">{metrics.active_subscribers}</p>
              <p className="text-[10px] text-muted-foreground">of {metrics.total_subscribers}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">MRR</p>
              <p className="text-xl font-semibold mt-0.5 font-mono">AED {(metrics.mrr / 1000).toFixed(1)}K</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-info">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ARR</p>
              <p className="text-xl font-semibold mt-0.5 font-mono">AED {(metrics.arr / 1000).toFixed(0)}K</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Renewal</p>
              <p className="text-xl font-semibold mt-0.5 text-success">{metrics.renewal_rate}%</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-destructive">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Churn</p>
              <p className="text-xl font-semibold mt-0.5 text-destructive">{metrics.churn_rate}%</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-gold">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Avg LTV</p>
              <p className="text-xl font-semibold mt-0.5 font-mono">AED {metrics.avg_ltv.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">New</p>
              <p className="text-xl font-semibold mt-0.5 flex items-center gap-1">
                <UserPlus className="w-4 h-4 text-success" />
                {metrics.new_this_month}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-destructive">
            <CardContent className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Churned</p>
              <p className="text-xl font-semibold mt-0.5 flex items-center gap-1">
                <UserMinus className="w-4 h-4 text-destructive" />
                {metrics.churned_this_month}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Vial Distribution + S-Tier Distribution + Retention */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vial Distribution (replaces Tier Distribution) */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Droplets className="w-4 h-4 text-gold" />
                Vial Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              {vialDist.map(v => (
                <div key={v.vials} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        {Array.from({ length: v.vials }).map((_, i) => (
                          <Droplets key={i} className={cn('w-3 h-3', v.color)} />
                        ))}
                      </div>
                      <span className="font-medium">{v.label}</span>
                    </div>
                    <span className="font-mono">{v.count} ({v.pct}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={cn('h-2 rounded-full transition-all', v.bgColor)} style={{ width: `${v.pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>MRR: AED {v.mrr.toLocaleString()}</span>
                    <span>Avg LTV: AED {v.avg_ltv.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* S-Tier Distribution */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-info" />
                S-Tier Distribution (Perfume Selections)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
              {sTierDist.map(s => (
                <div key={s.tier} className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold w-6">{s.tier}</span>
                  <div className="flex-1 bg-muted rounded-full h-4 relative overflow-hidden">
                    <div className={cn('h-4 rounded-full transition-all', s.color)} style={{ width: `${s.pct}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
                      {s.count} ({s.pct}%)
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono w-20 text-right">
                    +AED {s.avg_surcharge}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center mt-2 italic">
                Total perfume selections across all active subscribers
              </p>
            </CardContent>
          </Card>

          {/* Retention + Growth */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-info" />
                Retention Curve
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="space-y-1.5">
                {retentionCohorts.map((c) => (
                  <div key={c.month} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-muted-foreground text-[10px]">{c.month}</span>
                    <div className="flex-1 bg-muted rounded-full h-3 relative overflow-hidden">
                      <div
                        className={cn('h-3 rounded-full transition-all',
                          c.rate >= 80 ? 'bg-success' : c.rate >= 60 ? 'bg-gold' : 'bg-warning'
                        )}
                        style={{ width: `${c.rate}%` }}
                      />
                    </div>
                    <span className={cn('font-mono w-10 text-right text-[10px] font-medium',
                      c.rate >= 80 ? 'text-success' : c.rate >= 60 ? 'text-gold' : 'text-warning'
                    )}>
                      {c.rate}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-3 italic">
                Avg lifetime: {metrics.avg_lifetime_months} months
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Most-Used Perfumes */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" />
              Most-Requested Perfumes by Subscribers
              <Badge variant="outline" className="text-[10px] ml-auto">{perfumeStats.length} tracked</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Perfume</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">House</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">S-Tier</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Total Orders</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Unique Subs</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">% of Subscribers</th>
                  </tr>
                </thead>
                <tbody>
                  {perfumeStats.map((p, idx) => (
                    <tr key={p.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium">{p.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.house}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="outline" className={cn('text-[10px] font-mono',
                          p.s_tier === 'S0' ? 'border-emerald-500/30 text-emerald-600' :
                          p.s_tier === 'S1' ? 'border-info/30 text-info' :
                          p.s_tier === 'S2' ? 'border-amber-500/30 text-amber-600' :
                          p.s_tier === 'S3' ? 'border-gold/30 text-gold' :
                          p.s_tier === 'S4' ? 'border-rose-500/30 text-rose-500' :
                          'border-purple-500/30 text-purple-500'
                        )}>
                          {p.s_tier}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{p.total_orders}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{p.unique_subscribers}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-gold transition-all" style={{ width: `${p.pct_of_subscribers}%` }} />
                          </div>
                          <span className="text-xs font-mono font-medium w-10 text-right">{p.pct_of_subscribers}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* At-Risk Subscribers (vials-based) */}
        <Card className="border-warning/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              At-Risk Subscribers
              <Badge variant="outline" className="text-[10px] border-warning/40 text-warning ml-auto">
                {atRisk.length} flagged
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Vials/mo</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Months</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Last Order</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Risk</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Top Perfume</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">S-Tier</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.sort((a, b) => b.risk_score - a.risk_score).map(sub => (
                    <tr key={sub.customer_email} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium">{sub.customer_name}</p>
                        <p className="text-[10px] text-muted-foreground">{sub.customer_email}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({ length: sub.vials_per_month }).map((_, i) => (
                            <Droplets key={i} className="w-3 h-3 text-gold" />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs">{sub.months_active}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('text-xs font-mono', sub.last_order_days_ago > 30 ? 'text-warning' : 'text-muted-foreground')}>
                          {sub.last_order_days_ago}d ago
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className={cn(
                          'inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold',
                          sub.risk_score >= 75 ? 'bg-destructive/10 text-destructive' :
                          sub.risk_score >= 50 ? 'bg-warning/10 text-warning' :
                          'bg-gold/10 text-gold'
                        )}>
                          {sub.risk_score}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{sub.top_perfume || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="outline" className="text-[10px] font-mono">{sub.s_tier || '—'}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{sub.risk_reason}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-medium text-destructive">AED {sub.mrr_value}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td colSpan={8} className="px-3 py-2 text-xs font-medium">Total MRR at Risk</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold text-destructive">
                      AED {atRisk.reduce((s, r) => s + r.mrr_value, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Growth Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Net Growth This Month</p>
              <p className={cn('text-3xl font-bold', metrics.net_growth >= 0 ? 'text-success' : 'text-destructive')}>
                {metrics.net_growth >= 0 ? '+' : ''}{metrics.net_growth}
              </p>
              <p className="text-xs text-muted-foreground mt-1">subscribers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <UserPlus className="w-6 h-6 text-success mx-auto mb-1" />
              <p className="text-2xl font-semibold text-success">{metrics.new_this_month}</p>
              <p className="text-[10px] text-muted-foreground">New Subscribers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <UserMinus className="w-6 h-6 text-destructive mx-auto mb-1" />
              <p className="text-2xl font-semibold text-destructive">{metrics.churned_this_month}</p>
              <p className="text-[10px] text-muted-foreground">Churned ({metrics.paused_subscribers} paused)</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
