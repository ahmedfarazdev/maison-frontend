// ============================================================
// Operator Performance Dashboard
// Aggregates shift handover data over time for performance reviews.
// Weekly/monthly trends, per-operator metrics, efficiency scores,
// comparison views, and filterable date ranges.
// Visible to: admin, owner, pod_leader
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, SectionCard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Clock, Award,
  Target, Zap, ArrowUpRight, ArrowDownRight, Minus, Calendar,
  ChevronDown, ChevronUp, Star, Medal, Filter, Download,
  Activity, Timer, CheckCircle2, AlertTriangle, Flame, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
interface OperatorMetrics {
  id: string;
  name: string;
  role: string;
  avatar_initials: string;
  jobs_completed: number;
  jobs_completed_prev: number;
  avg_time_per_station_min: number;
  avg_time_per_station_prev: number;
  efficiency_score: number;
  efficiency_prev: number;
  error_rate: number;
  error_rate_prev: number;
  bottles_handled: number;
  bottles_handled_prev: number;
  shifts_worked: number;
  on_time_rate: number;
  streak_days: number;
  station_breakdown: StationBreakdown[];
  weekly_trend: WeeklyDataPoint[];
}

interface StationBreakdown {
  station: string;
  jobs: number;
  avg_min: number;
  best_min: number;
}

interface WeeklyDataPoint {
  week: string;
  jobs: number;
  efficiency: number;
  errors: number;
}

interface TeamSummary {
  total_jobs: number;
  total_jobs_prev: number;
  avg_efficiency: number;
  avg_efficiency_prev: number;
  avg_time_per_job: number;
  avg_time_per_job_prev: number;
  total_errors: number;
  total_errors_prev: number;
  total_bottles: number;
  best_performer: string;
  most_improved: string;
}

// ---- Mock Data ----
const MOCK_OPERATORS: OperatorMetrics[] = [
  {
    id: 'OP-001', name: 'Ahmed K.', role: 'pod_senior', avatar_initials: 'AK',
    jobs_completed: 47, jobs_completed_prev: 42,
    avg_time_per_station_min: 12.3, avg_time_per_station_prev: 13.1,
    efficiency_score: 94.2, efficiency_prev: 91.8,
    error_rate: 1.2, error_rate_prev: 1.8,
    bottles_handled: 156, bottles_handled_prev: 138,
    shifts_worked: 12, on_time_rate: 98.5, streak_days: 8,
    station_breakdown: [
      { station: 'Job Creation', jobs: 12, avg_min: 8.2, best_min: 5.1 },
      { station: 'Picking', jobs: 15, avg_min: 14.5, best_min: 9.3 },
      { station: 'Labeling', jobs: 10, avg_min: 11.0, best_min: 7.8 },
      { station: 'Decanting', jobs: 10, avg_min: 15.5, best_min: 11.2 },
    ],
    weekly_trend: [
      { week: 'W1', jobs: 10, efficiency: 89, errors: 2 },
      { week: 'W2', jobs: 11, efficiency: 91, errors: 1 },
      { week: 'W3', jobs: 12, efficiency: 93, errors: 1 },
      { week: 'W4', jobs: 14, efficiency: 94, errors: 0 },
    ],
  },
  {
    id: 'OP-002', name: 'Sara M.', role: 'pod_senior', avatar_initials: 'SM',
    jobs_completed: 52, jobs_completed_prev: 45,
    avg_time_per_station_min: 11.1, avg_time_per_station_prev: 12.4,
    efficiency_score: 96.8, efficiency_prev: 93.5,
    error_rate: 0.5, error_rate_prev: 1.1,
    bottles_handled: 178, bottles_handled_prev: 152,
    shifts_worked: 14, on_time_rate: 100, streak_days: 14,
    station_breakdown: [
      { station: 'Job Creation', jobs: 14, avg_min: 7.5, best_min: 4.8 },
      { station: 'Picking', jobs: 16, avg_min: 12.8, best_min: 8.1 },
      { station: 'Labeling', jobs: 12, avg_min: 10.2, best_min: 6.9 },
      { station: 'Decanting', jobs: 10, avg_min: 13.9, best_min: 10.0 },
    ],
    weekly_trend: [
      { week: 'W1', jobs: 11, efficiency: 92, errors: 1 },
      { week: 'W2', jobs: 13, efficiency: 94, errors: 0 },
      { week: 'W3', jobs: 14, efficiency: 96, errors: 0 },
      { week: 'W4', jobs: 14, efficiency: 97, errors: 0 },
    ],
  },
  {
    id: 'OP-003', name: 'Khalid R.', role: 'pod_junior', avatar_initials: 'KR',
    jobs_completed: 38, jobs_completed_prev: 35,
    avg_time_per_station_min: 14.7, avg_time_per_station_prev: 15.2,
    efficiency_score: 88.5, efficiency_prev: 86.1,
    error_rate: 2.8, error_rate_prev: 3.5,
    bottles_handled: 98, bottles_handled_prev: 89,
    shifts_worked: 11, on_time_rate: 95.2, streak_days: 3,
    station_breakdown: [
      { station: 'Per-Order QC', jobs: 20, avg_min: 16.2, best_min: 11.5 },
      { station: 'Shipping', jobs: 18, avg_min: 13.1, best_min: 8.8 },
    ],
    weekly_trend: [
      { week: 'W1', jobs: 8, efficiency: 84, errors: 3 },
      { week: 'W2', jobs: 9, efficiency: 86, errors: 2 },
      { week: 'W3', jobs: 10, efficiency: 89, errors: 1 },
      { week: 'W4', jobs: 11, efficiency: 91, errors: 1 },
    ],
  },
  {
    id: 'OP-004', name: 'Fatima A.', role: 'pod_senior', avatar_initials: 'FA',
    jobs_completed: 41, jobs_completed_prev: 39,
    avg_time_per_station_min: 13.5, avg_time_per_station_prev: 14.0,
    efficiency_score: 91.0, efficiency_prev: 89.2,
    error_rate: 1.8, error_rate_prev: 2.2,
    bottles_handled: 134, bottles_handled_prev: 125,
    shifts_worked: 12, on_time_rate: 97.0, streak_days: 5,
    station_breakdown: [
      { station: 'Job Creation', jobs: 10, avg_min: 9.0, best_min: 6.2 },
      { station: 'Picking', jobs: 12, avg_min: 15.2, best_min: 10.1 },
      { station: 'Labeling', jobs: 10, avg_min: 12.5, best_min: 8.5 },
      { station: 'Decanting', jobs: 9, avg_min: 17.3, best_min: 12.8 },
    ],
    weekly_trend: [
      { week: 'W1', jobs: 9, efficiency: 87, errors: 2 },
      { week: 'W2', jobs: 10, efficiency: 89, errors: 1 },
      { week: 'W3', jobs: 11, efficiency: 91, errors: 1 },
      { week: 'W4', jobs: 11, efficiency: 93, errors: 0 },
    ],
  },
  {
    id: 'OP-005', name: 'Omar H.', role: 'pod_junior', avatar_initials: 'OH',
    jobs_completed: 35, jobs_completed_prev: 30,
    avg_time_per_station_min: 15.8, avg_time_per_station_prev: 17.1,
    efficiency_score: 85.3, efficiency_prev: 80.5,
    error_rate: 3.2, error_rate_prev: 4.5,
    bottles_handled: 87, bottles_handled_prev: 72,
    shifts_worked: 10, on_time_rate: 92.0, streak_days: 2,
    station_breakdown: [
      { station: 'Per-Order QC', jobs: 18, avg_min: 17.5, best_min: 12.0 },
      { station: 'Shipping', jobs: 17, avg_min: 14.0, best_min: 9.5 },
    ],
    weekly_trend: [
      { week: 'W1', jobs: 7, efficiency: 78, errors: 4 },
      { week: 'W2', jobs: 8, efficiency: 82, errors: 3 },
      { week: 'W3', jobs: 9, efficiency: 86, errors: 2 },
      { week: 'W4', jobs: 11, efficiency: 90, errors: 1 },
    ],
  },
];

const MOCK_TEAM_SUMMARY: TeamSummary = {
  total_jobs: 213, total_jobs_prev: 191,
  avg_efficiency: 91.2, avg_efficiency_prev: 88.2,
  avg_time_per_job: 13.5, avg_time_per_job_prev: 14.4,
  total_errors: 14, total_errors_prev: 22,
  total_bottles: 653,
  best_performer: 'Sara M.',
  most_improved: 'Omar H.',
};

// ---- Helpers ----
const pctChange = (curr: number, prev: number) => {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
};

const TrendBadge = ({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) => {
  const change = pctChange(current, previous);
  const isPositive = invert ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 0.5;

  if (isNeutral) return <Badge variant="outline" className="text-xs gap-0.5 text-muted-foreground"><Minus className="w-3 h-3" /> 0%</Badge>;
  return (
    <Badge variant="outline" className={cn('text-xs gap-0.5', isPositive ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-red-600 border-red-200 bg-red-50')}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </Badge>
  );
};

const EfficiencyBar = ({ score }: { score: number }) => {
  const color = score >= 95 ? 'bg-emerald-500' : score >= 90 ? 'bg-blue-500' : score >= 85 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{score.toFixed(1)}%</span>
    </div>
  );
};

const MiniSparkline = ({ data, color = 'text-indigo-500' }: { data: number[]; color?: string }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className={cn('inline-block', color)}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const RankMedal = ({ rank }: { rank: number }) => {
  if (rank === 1) return <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">1</div>;
  if (rank === 2) return <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">2</div>;
  if (rank === 3) return <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">3</div>;
  return <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">{rank}</div>;
};

export default function OperatorPerformance() {
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'efficiency' | 'jobs' | 'time' | 'errors'>('efficiency');
  const [expandedOperator, setExpandedOperator] = useState<string | null>(null);

  const team = MOCK_TEAM_SUMMARY;

  // Filtered and sorted operators
  const operators = useMemo(() => {
    let ops = [...MOCK_OPERATORS];
    if (roleFilter !== 'all') {
      ops = ops.filter(o => o.role === roleFilter);
    }
    ops.sort((a, b) => {
      switch (sortBy) {
        case 'efficiency': return b.efficiency_score - a.efficiency_score;
        case 'jobs': return b.jobs_completed - a.jobs_completed;
        case 'time': return a.avg_time_per_station_min - b.avg_time_per_station_min;
        case 'errors': return a.error_rate - b.error_rate;
        default: return 0;
      }
    });
    return ops;
  }, [roleFilter, sortBy]);

  // Rank map based on efficiency
  const rankMap = useMemo(() => {
    const sorted = [...MOCK_OPERATORS].sort((a, b) => b.efficiency_score - a.efficiency_score);
    return new Map(sorted.map((op, i) => [op.id, i + 1]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Operator Performance Report"
        subtitle="Weekly/monthly trends · Efficiency scores · Performance reviews"
        breadcrumbs={[
          { label: 'Reports' },
          { label: 'Operator Performance' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[130px]">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">

      {/* Team KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Jobs', value: team.total_jobs, prev: team.total_jobs_prev, icon: CheckCircle2, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', format: (v: number) => v.toString() },
          { label: 'Avg Efficiency', value: team.avg_efficiency, prev: team.avg_efficiency_prev, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', format: (v: number) => `${v.toFixed(1)}%` },
          { label: 'Avg Time/Job', value: team.avg_time_per_job, prev: team.avg_time_per_job_prev, icon: Timer, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', format: (v: number) => `${v.toFixed(1)}m`, invert: true },
          { label: 'Total Errors', value: team.total_errors, prev: team.total_errors_prev, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', format: (v: number) => v.toString(), invert: true },
          { label: 'Best Performer', value: 0, prev: 0, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', format: () => team.best_performer, noTrend: true },
          { label: 'Most Improved', value: 0, prev: 0, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', format: () => team.most_improved, noTrend: true },
        ].map(kpi => (
          <Card key={kpi.label} className={cn('border-0 shadow-sm', kpi.bg)}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <kpi.icon className={cn('w-4 h-4', kpi.color)} />
                {!('noTrend' in kpi && kpi.noTrend) && (
                  <TrendBadge current={kpi.value} previous={kpi.prev} invert={'invert' in kpi && !!kpi.invert} />
                )}
              </div>
              <div className="text-xl font-bold text-foreground">{kpi.format(kpi.value)}</div>
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5">
              <Medal className="w-3.5 h-3.5" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Trends
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Comparison
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="pod_senior">Pod Senior</SelectItem>
                <SelectItem value="pod_junior">Pod Junior</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efficiency">By Efficiency</SelectItem>
                <SelectItem value="jobs">By Jobs Done</SelectItem>
                <SelectItem value="time">By Speed</SelectItem>
                <SelectItem value="errors">By Error Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Overview Tab — Operator Cards */}
        <TabsContent value="overview" className="mt-4 space-y-3">
          {operators.map(op => {
            const rank = rankMap.get(op.id) || 0;
            const isExpanded = expandedOperator === op.id;
            const jobsChange = pctChange(op.jobs_completed, op.jobs_completed_prev);
            const effChange = pctChange(op.efficiency_score, op.efficiency_prev);

            return (
              <Card key={op.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Main Row */}
                  <div className="flex items-center gap-4">
                    <RankMedal rank={rank} />
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center text-sm font-bold text-indigo-700 dark:text-indigo-300">
                      {op.avatar_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{op.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">{op.role.replace(/_/g, ' ')}</Badge>
                        {op.streak_days >= 7 && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs gap-0.5">
                            <Flame className="w-3 h-3" /> {op.streak_days}d streak
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{op.shifts_worked} shifts</span>
                        <span>·</span>
                        <span>{op.on_time_rate}% on-time</span>
                        <span>·</span>
                        <span>{op.bottles_handled} bottles handled</span>
                      </div>
                    </div>

                    {/* Metrics Strip */}
                    <div className="hidden md:flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{op.jobs_completed}</div>
                        <div className="text-xs text-muted-foreground">Jobs</div>
                        <TrendBadge current={op.jobs_completed} previous={op.jobs_completed_prev} />
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{op.avg_time_per_station_min.toFixed(1)}m</div>
                        <div className="text-xs text-muted-foreground">Avg Time</div>
                        <TrendBadge current={op.avg_time_per_station_min} previous={op.avg_time_per_station_prev} invert />
                      </div>
                      <div className="text-center w-24">
                        <div className="text-lg font-bold text-foreground">{op.efficiency_score.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Efficiency</div>
                        <EfficiencyBar score={op.efficiency_score} />
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{op.error_rate.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Errors</div>
                        <TrendBadge current={op.error_rate} previous={op.error_rate_prev} invert />
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div className="hidden lg:block">
                      <MiniSparkline data={op.weekly_trend.map(w => w.efficiency)} />
                      <div className="text-xs text-muted-foreground text-center mt-0.5">4-week trend</div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedOperator(isExpanded ? null : op.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>

                  {/* Expanded Station Breakdown */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Mobile metrics (shown on small screens) */}
                      <div className="grid grid-cols-2 md:hidden gap-3">
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-lg font-bold">{op.jobs_completed}</div>
                          <div className="text-xs text-muted-foreground">Jobs Completed</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-lg font-bold">{op.efficiency_score.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">Efficiency</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-lg font-bold">{op.avg_time_per_station_min.toFixed(1)}m</div>
                          <div className="text-xs text-muted-foreground">Avg Time</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-lg font-bold">{op.error_rate.toFixed(1)}%</div>
                          <div className="text-xs text-muted-foreground">Error Rate</div>
                        </div>
                      </div>

                      {/* Station breakdown table */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Station Breakdown</h4>
                        <div className="rounded-lg border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 text-muted-foreground">
                                <th className="text-left p-2.5 font-medium">Station</th>
                                <th className="text-right p-2.5 font-medium">Jobs</th>
                                <th className="text-right p-2.5 font-medium">Avg Time</th>
                                <th className="text-right p-2.5 font-medium">Best Time</th>
                                <th className="text-left p-2.5 font-medium w-32">Performance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {op.station_breakdown.map(sb => {
                                const perfPct = Math.min(100, (sb.best_min / sb.avg_min) * 100);
                                return (
                                  <tr key={sb.station} className="border-t hover:bg-muted/30">
                                    <td className="p-2.5 font-medium text-foreground">{sb.station}</td>
                                    <td className="p-2.5 text-right">{sb.jobs}</td>
                                    <td className="p-2.5 text-right font-mono">{sb.avg_min.toFixed(1)}m</td>
                                    <td className="p-2.5 text-right font-mono text-emerald-600">{sb.best_min.toFixed(1)}m</td>
                                    <td className="p-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${perfPct}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground">{perfPct.toFixed(0)}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Weekly trend table */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Weekly Trend</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {op.weekly_trend.map((w, i) => {
                            const prevEff = i > 0 ? op.weekly_trend[i - 1].efficiency : w.efficiency;
                            const improving = w.efficiency > prevEff;
                            return (
                              <div key={w.week} className="p-2.5 rounded-lg bg-muted/50 text-center">
                                <div className="text-xs font-medium text-muted-foreground mb-1">{w.week}</div>
                                <div className="text-sm font-bold text-foreground">{w.jobs} jobs</div>
                                <div className={cn('text-xs font-medium', w.efficiency >= 90 ? 'text-emerald-600' : w.efficiency >= 85 ? 'text-amber-600' : 'text-red-600')}>
                                  {w.efficiency}% eff.
                                </div>
                                {w.errors > 0 && (
                                  <div className="text-xs text-red-500 mt-0.5">{w.errors} error{w.errors > 1 ? 's' : ''}</div>
                                )}
                                {i > 0 && (
                                  <div className={cn('text-xs mt-0.5', improving ? 'text-emerald-500' : 'text-red-500')}>
                                    {improving ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="mt-4 space-y-4">
          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-4">
            {[...MOCK_OPERATORS].sort((a, b) => b.efficiency_score - a.efficiency_score).slice(0, 3).map((op, i) => {
              const medals = ['from-amber-300 to-amber-500', 'from-gray-300 to-gray-400', 'from-amber-600 to-amber-700'];
              const labels = ['Gold', 'Silver', 'Bronze'];
              const sizes = ['p-6', 'p-5', 'p-5'];
              return (
                <Card key={op.id} className={cn('text-center border-0 shadow-md', i === 0 && 'ring-2 ring-amber-300')}>
                  <CardContent className={sizes[i]}>
                    <div className={cn('w-14 h-14 rounded-full bg-gradient-to-br mx-auto mb-3 flex items-center justify-center text-white text-lg font-bold', medals[i])}>
                      {i + 1}
                    </div>
                    <div className="text-lg font-bold text-foreground">{op.name}</div>
                    <Badge variant="outline" className="text-xs capitalize mt-1">{op.role.replace(/_/g, ' ')}</Badge>
                    <div className="mt-3 space-y-1">
                      <div className="text-2xl font-bold text-foreground">{op.efficiency_score.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Efficiency Score</div>
                      <EfficiencyBar score={op.efficiency_score} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-1.5 rounded bg-muted/50">
                        <div className="font-bold text-foreground">{op.jobs_completed}</div>
                        <div className="text-muted-foreground">Jobs</div>
                      </div>
                      <div className="p-1.5 rounded bg-muted/50">
                        <div className="font-bold text-foreground">{op.error_rate.toFixed(1)}%</div>
                        <div className="text-muted-foreground">Errors</div>
                      </div>
                    </div>
                    <Badge className={cn('mt-2 text-xs', i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-600')}>
                      <Star className="w-3 h-3 mr-0.5" /> {labels[i]}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Full Rankings Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Full Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left p-3 font-medium w-12">#</th>
                      <th className="text-left p-3 font-medium">Operator</th>
                      <th className="text-right p-3 font-medium">Jobs</th>
                      <th className="text-right p-3 font-medium">Avg Time</th>
                      <th className="text-right p-3 font-medium">Efficiency</th>
                      <th className="text-right p-3 font-medium">Error Rate</th>
                      <th className="text-right p-3 font-medium">Bottles</th>
                      <th className="text-right p-3 font-medium">Streak</th>
                      <th className="text-left p-3 font-medium w-16">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...MOCK_OPERATORS].sort((a, b) => b.efficiency_score - a.efficiency_score).map((op, i) => (
                      <tr key={op.id} className={cn('border-t hover:bg-muted/30 transition-colors', i < 3 && 'bg-amber-50/30 dark:bg-amber-900/5')}>
                        <td className="p-3"><RankMedal rank={i + 1} /></td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                              {op.avatar_initials}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{op.name}</div>
                              <div className="text-xs text-muted-foreground capitalize">{op.role.replace(/_/g, ' ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {op.jobs_completed}
                          <TrendBadge current={op.jobs_completed} previous={op.jobs_completed_prev} />
                        </td>
                        <td className="p-3 text-right font-mono">{op.avg_time_per_station_min.toFixed(1)}m</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono font-bold">{op.efficiency_score.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className={cn('font-mono', op.error_rate <= 1 ? 'text-emerald-600' : op.error_rate <= 2 ? 'text-amber-600' : 'text-red-600')}>
                            {op.error_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">{op.bottles_handled}</td>
                        <td className="p-3 text-right">
                          {op.streak_days >= 7 ? (
                            <Badge className="bg-amber-100 text-amber-700 text-xs gap-0.5"><Flame className="w-3 h-3" /> {op.streak_days}d</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{op.streak_days}d</span>
                          )}
                        </td>
                        <td className="p-3">
                          <MiniSparkline data={op.weekly_trend.map(w => w.efficiency)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Jobs Completed Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" /> Jobs Completed — Weekly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['W1', 'W2', 'W3', 'W4'].map(week => {
                    const weekData = MOCK_OPERATORS.map(op => ({
                      name: op.name,
                      initials: op.avatar_initials,
                      jobs: op.weekly_trend.find(w => w.week === week)?.jobs || 0,
                    }));
                    const totalJobs = weekData.reduce((s, d) => s + d.jobs, 0);
                    const maxJobs = Math.max(...weekData.map(d => d.jobs));
                    return (
                      <div key={week}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">{week}</span>
                          <span className="text-xs font-mono text-foreground">{totalJobs} total</span>
                        </div>
                        <div className="flex gap-1">
                          {weekData.map(d => (
                            <div
                              key={d.name}
                              className="h-6 rounded bg-indigo-500/80 hover:bg-indigo-600 transition-colors relative group"
                              style={{ flex: d.jobs }}
                              title={`${d.name}: ${d.jobs} jobs`}
                            >
                              {d.jobs >= 3 && (
                                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                                  {d.initials}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {MOCK_OPERATORS.map(op => (
                      <div key={op.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="w-3 h-3 rounded bg-indigo-500/80" />
                        {op.avatar_initials} — {op.name}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Efficiency Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" /> Efficiency Score — Weekly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {MOCK_OPERATORS.map(op => (
                    <div key={op.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                        {op.avatar_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-foreground">{op.name}</span>
                          <span className="text-xs font-mono text-foreground">{op.efficiency_score.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {op.weekly_trend.map((w, i) => {
                            const color = w.efficiency >= 95 ? 'bg-emerald-500' : w.efficiency >= 90 ? 'bg-blue-500' : w.efficiency >= 85 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={w.week} className="flex-1 group relative">
                                <div className="h-3 rounded-sm overflow-hidden bg-muted">
                                  <div className={cn('h-full rounded-sm', color)} style={{ width: `${w.efficiency}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground text-center block mt-0.5">{w.week}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <MiniSparkline data={op.weekly_trend.map(w => w.efficiency)} color={op.efficiency_score >= 90 ? 'text-emerald-500' : 'text-amber-500'} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Error Rate Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Error Rate — Weekly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {MOCK_OPERATORS.map(op => (
                    <div key={op.id} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-foreground w-20 truncate">{op.name}</span>
                      <div className="flex-1 flex items-center gap-1">
                        {op.weekly_trend.map(w => {
                          const color = w.errors === 0 ? 'bg-emerald-500' : w.errors <= 1 ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <div key={w.week} className="flex-1 text-center">
                              <div className={cn('h-6 rounded-sm flex items-center justify-center text-white text-xs font-medium', color)}>
                                {w.errors}
                              </div>
                              <span className="text-xs text-muted-foreground">{w.week}</span>
                            </div>
                          );
                        })}
                      </div>
                      <TrendBadge current={op.error_rate} previous={op.error_rate_prev} invert />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bottles Handled Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-500" /> Bottles Handled — Period Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {MOCK_OPERATORS.map(op => {
                    const maxBottles = Math.max(...MOCK_OPERATORS.map(o => o.bottles_handled));
                    return (
                      <div key={op.id} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-20 truncate">{op.name}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 mb-0.5">
                            <div className="h-3 rounded-full bg-purple-500" style={{ width: `${(op.bottles_handled / maxBottles) * 100}%` }} />
                            <span className="text-xs font-mono">{op.bottles_handled}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-2 rounded-full bg-purple-200 dark:bg-purple-800" style={{ width: `${(op.bottles_handled_prev / maxBottles) * 100}%` }} />
                            <span className="text-xs font-mono text-muted-foreground">{op.bottles_handled_prev}</span>
                          </div>
                        </div>
                        <TrendBadge current={op.bottles_handled} previous={op.bottles_handled_prev} />
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-purple-500" /> Current</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-purple-200 dark:bg-purple-800" /> Previous</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Operator Comparison Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="text-left p-3 font-medium sticky left-0 bg-muted/50 z-10">Metric</th>
                      {MOCK_OPERATORS.map(op => (
                        <th key={op.id} className="text-center p-3 font-medium min-w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                              {op.avatar_initials}
                            </div>
                            {op.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Jobs Completed', key: 'jobs_completed', format: (v: number) => v.toString(), best: 'max' },
                      { label: 'Avg Time/Station', key: 'avg_time_per_station_min', format: (v: number) => `${v.toFixed(1)}m`, best: 'min' },
                      { label: 'Efficiency Score', key: 'efficiency_score', format: (v: number) => `${v.toFixed(1)}%`, best: 'max' },
                      { label: 'Error Rate', key: 'error_rate', format: (v: number) => `${v.toFixed(1)}%`, best: 'min' },
                      { label: 'Bottles Handled', key: 'bottles_handled', format: (v: number) => v.toString(), best: 'max' },
                      { label: 'Shifts Worked', key: 'shifts_worked', format: (v: number) => v.toString(), best: 'max' },
                      { label: 'On-Time Rate', key: 'on_time_rate', format: (v: number) => `${v.toFixed(1)}%`, best: 'max' },
                      { label: 'Streak Days', key: 'streak_days', format: (v: number) => `${v}d`, best: 'max' },
                    ].map(metric => {
                      const values = MOCK_OPERATORS.map(op => (op as any)[metric.key] as number);
                      const bestVal = metric.best === 'max' ? Math.max(...values) : Math.min(...values);
                      return (
                        <tr key={metric.key} className="border-t hover:bg-muted/30">
                          <td className="p-3 font-medium text-foreground sticky left-0 bg-background z-10">{metric.label}</td>
                          {MOCK_OPERATORS.map(op => {
                            const val = (op as any)[metric.key] as number;
                            const isBest = val === bestVal;
                            return (
                              <td key={op.id} className={cn('p-3 text-center font-mono', isBest && 'bg-emerald-50 dark:bg-emerald-900/10')}>
                                <span className={cn(isBest && 'font-bold text-emerald-600')}>
                                  {metric.format(val)}
                                </span>
                                {isBest && <Award className="w-3 h-3 text-amber-500 inline ml-1" />}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Role-based comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['pod_senior', 'pod_junior'].map(role => {
              const roleOps = MOCK_OPERATORS.filter(o => o.role === role);
              const avgEff = roleOps.reduce((s, o) => s + o.efficiency_score, 0) / roleOps.length;
              const avgJobs = roleOps.reduce((s, o) => s + o.jobs_completed, 0) / roleOps.length;
              const avgTime = roleOps.reduce((s, o) => s + o.avg_time_per_station_min, 0) / roleOps.length;
              return (
                <Card key={role}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 capitalize">
                      <Users className="w-4 h-4" /> {role.replace(/_/g, ' ')}s ({roleOps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{avgEff.toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Avg Efficiency</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{avgJobs.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">Avg Jobs</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{avgTime.toFixed(1)}m</div>
                        <div className="text-xs text-muted-foreground">Avg Time</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {roleOps.map(op => (
                        <div key={op.id} className="flex items-center gap-2">
                          <span className="text-xs font-medium w-20 truncate">{op.name}</span>
                          <EfficiencyBar score={op.efficiency_score} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
