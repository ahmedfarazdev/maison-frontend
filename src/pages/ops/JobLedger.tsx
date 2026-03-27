// ============================================================
// Job Ledger — Operations Center
// Historical log of all jobs: ID, Type, Pod, Start/End Time, Order Count, Metrics
// Enables operational analytics
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard, KPICard, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Search, Download, Filter, Clock, CheckCircle2,
  Package, Timer, BarChart3, TrendingUp, RefreshCw, Zap, Box,
  Users, Eye, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Types ----
interface LedgerEntry {
  id: string;
  title: string;
  type: 'Subscription' | 'On-Demand' | 'Internal Production' | 'Fulfillment';
  pod: string;
  startTime: string;
  endTime: string;
  duration: string;
  orderCount: number;
  vialCount: number;
  avgTimePerOrder: string;
  date: string;
}

// ---- Mock Data ----
const MOCK_LEDGER: LedgerEntry[] = [
  { id: 'JOB-120', title: 'Feb Subscription Final', type: 'Subscription', pod: 'PP-01', startTime: '07:00', endTime: '12:30', duration: '5h 30m', orderCount: 150, vialCount: 450, avgTimePerOrder: '2.2m', date: '2026-03-04' },
  { id: 'JOB-119', title: 'Whisperer Vial Batch', type: 'Internal Production', pod: 'PP-03', startTime: '08:00', endTime: '11:45', duration: '3h 45m', orderCount: 100, vialCount: 100, avgTimePerOrder: '2.3m', date: '2026-03-04' },
  { id: 'JOB-118', title: 'Daily On-Demand — PM', type: 'On-Demand', pod: 'PP-02', startTime: '13:00', endTime: '15:30', duration: '2h 30m', orderCount: 38, vialCount: 114, avgTimePerOrder: '3.9m', date: '2026-03-03' },
  { id: 'JOB-117', title: 'Shipping Batch — Full Day', type: 'Fulfillment', pod: 'FP-01', startTime: '07:00', endTime: '17:00', duration: '10h 00m', orderCount: 210, vialCount: 0, avgTimePerOrder: '2.9m', date: '2026-03-03' },
  { id: 'JOB-116', title: 'March Sub Batch — Pilot', type: 'Subscription', pod: 'PP-01', startTime: '08:00', endTime: '14:00', duration: '6h 00m', orderCount: 180, vialCount: 540, avgTimePerOrder: '2.0m', date: '2026-03-03' },
  { id: 'JOB-115', title: 'Capsule Drop — Nishane', type: 'On-Demand', pod: 'PP-02', startTime: '09:00', endTime: '11:00', duration: '2h 00m', orderCount: 25, vialCount: 75, avgTimePerOrder: '4.8m', date: '2026-03-02' },
  { id: 'JOB-114', title: 'Feb Sub Batch C', type: 'Subscription', pod: 'PP-03', startTime: '07:30', endTime: '13:00', duration: '5h 30m', orderCount: 140, vialCount: 420, avgTimePerOrder: '2.4m', date: '2026-03-02' },
  { id: 'JOB-113', title: 'Shipping Batch — Morning', type: 'Fulfillment', pod: 'FP-01', startTime: '07:00', endTime: '12:00', duration: '5h 00m', orderCount: 120, vialCount: 0, avgTimePerOrder: '2.5m', date: '2026-03-02' },
];

const TYPE_COLORS: Record<string, string> = {
  'Subscription': 'bg-blue-100 text-blue-700',
  'On-Demand': 'bg-purple-100 text-purple-700',
  'Internal Production': 'bg-amber-100 text-amber-700',
  'Fulfillment': 'bg-emerald-100 text-emerald-700',
};

export default function JobLedger() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const uniqueDates = useMemo(() => Array.from(new Set(MOCK_LEDGER.map(e => e.date))).sort().reverse(), []);

  const filtered = useMemo(() => {
    return MOCK_LEDGER.filter(e => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.id.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (dateFilter !== 'all' && e.date !== dateFilter) return false;
      return true;
    });
  }, [search, typeFilter, dateFilter]);

  const totalJobs = MOCK_LEDGER.length;
  const totalOrders = MOCK_LEDGER.reduce((s, e) => s + e.orderCount, 0);
  const totalVials = MOCK_LEDGER.reduce((s, e) => s + e.vialCount, 0);

  const handleExport = () => {
    const csv = [
      'Job ID,Title,Type,Pod,Date,Start,End,Duration,Orders,Vials,Avg Time/Order',
      ...MOCK_LEDGER.map(e => `${e.id},${e.title},${e.type},${e.pod},${e.date},${e.startTime},${e.endTime},${e.duration},${e.orderCount},${e.vialCount},${e.avgTimePerOrder}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Job ledger exported');
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Job Ledger"
        subtitle="Historical log of all production and fulfillment jobs"
        breadcrumbs={[
          { label: 'Operations', href: '/ops/pod-dashboard' },
          { label: 'Job Ledger' },
        ]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Jobs" value={totalJobs} sublabel="All time" icon={BookOpen} variant="gold" />
          <KPICard label="Total Orders" value={totalOrders} sublabel="Processed" icon={Package} variant="success" />
          <KPICard label="Total Vials" value={totalVials} sublabel="Produced" icon={Box} />
          <KPICard label="Avg Duration" value="4h 17m" sublabel="Per job" icon={Timer} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Subscription">Subscription</SelectItem>
              <SelectItem value="On-Demand">On-Demand</SelectItem>
              <SelectItem value="Internal Production">Internal Production</SelectItem>
              <SelectItem value="Fulfillment">Fulfillment</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All Dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              {uniqueDates.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ledger Table */}
        <SectionCard title="Job History" subtitle={`${filtered.length} entries`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Job ID</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Title</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pod</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Time</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Duration</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Orders</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vials</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg/Order</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{entry.id}</td>
                    <td className="py-2.5 px-3 font-medium text-[13px]">{entry.title}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full', TYPE_COLORS[entry.type])}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs">{entry.pod}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.date}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{entry.startTime} → {entry.endTime}</td>
                    <td className="py-2.5 px-3 text-xs font-mono">{entry.duration}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">{entry.orderCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">{entry.vialCount || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs">{entry.avgTimePerOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <EmptyState icon={BookOpen} title="No Entries Found" description="No ledger entries match your filters." />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
