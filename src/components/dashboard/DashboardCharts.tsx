// ============================================================
// Dashboard Charts — Revenue Analytics, Order Trends, Top Perfumes
// Uses Recharts for line/bar/area charts
// ============================================================

import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Droplets, Crown, BarChart3,
} from 'lucide-react';

// ─── Seeded Random for Deterministic Mock Data ─────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Generate 30-day Revenue Data ──────────────────────────
function generateRevenueData(days: number = 30) {
  const rand = seededRandom(hashStr('revenue-chart-2026'));
  const data = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseSub = isWeekend ? 800 : 1200 + rand() * 600;
    const baseOT = isWeekend ? 400 : 600 + rand() * 800;
    const baseCapsule = rand() > 0.7 ? 300 + rand() * 500 : 50 + rand() * 150;
    data.push({
      date: dayLabel,
      subscription: Math.round(baseSub),
      oneTime: Math.round(baseOT),
      capsule: Math.round(baseCapsule),
      total: Math.round(baseSub + baseOT + baseCapsule),
    });
  }
  return data;
}

// ─── Generate Orders Per Day Data ──────────────────────────
function generateOrdersData(days: number = 14) {
  const rand = seededRandom(hashStr('orders-chart-2026'));
  const data = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayLabel = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    data.push({
      date: dayLabel,
      orders: Math.round(isWeekend ? 3 + rand() * 5 : 8 + rand() * 12),
      newSubscribers: Math.round(isWeekend ? 0 + rand() * 2 : 1 + rand() * 4),
    });
  }
  return data;
}

// ─── Top Perfumes Data ─────────────────────────────────────
function generateTopPerfumes() {
  return [
    { name: 'Baccarat Rouge 540', brand: 'MFK', orders: 47, revenue: 8460, aura: 'Mystique', color: '#d4a574' },
    { name: 'Tobacco Vanille', brand: 'Tom Ford', orders: 38, revenue: 6840, aura: 'Warmth', color: '#8b6914' },
    { name: 'Aventus', brand: 'Creed', orders: 35, revenue: 6300, aura: 'Power', color: '#2d5a27' },
    { name: 'Oud Wood', brand: 'Tom Ford', orders: 29, revenue: 5220, aura: 'Depth', color: '#5c3d2e' },
    { name: 'Delina', brand: 'Parfums de Marly', orders: 26, revenue: 4680, aura: 'Romance', color: '#c4547a' },
    { name: 'Lost Cherry', brand: 'Tom Ford', orders: 24, revenue: 4320, aura: 'Allure', color: '#8b1a1a' },
    { name: 'Layton', brand: 'Parfums de Marly', orders: 22, revenue: 3960, aura: 'Elegance', color: '#4a6fa5' },
    { name: 'Rehab', brand: 'Initio', orders: 19, revenue: 3420, aura: 'Energy', color: '#e8a838' },
  ];
}

// ─── Revenue Breakdown Pie Data ────────────────────────────
function generateRevenueBreakdown() {
  return [
    { name: 'Subscriptions', value: 42500, color: '#d4a574' },
    { name: 'One-Time Decants', value: 28300, color: '#8b6914' },
    { name: 'Capsule Drops', value: 12800, color: '#c4547a' },
    { name: 'Em Vault', value: 8400, color: '#4a6fa5' },
    { name: 'Gifting', value: 5200, color: '#2d5a27' },
  ];
}

// ─── Custom Tooltip ────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold">
            {entry.name.includes('AED') || entry.dataKey === 'total' || entry.dataKey === 'subscription' || entry.dataKey === 'oneTime' || entry.dataKey === 'capsule'
              ? `AED ${entry.value.toLocaleString()}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Revenue Trend Chart ───────────────────────────────────
export function RevenueChart() {
  const data = useMemo(() => generateRevenueData(30), []);
  const totalRevenue = data.reduce((sum, d) => sum + d.total, 0);
  const avgDaily = Math.round(totalRevenue / data.length);
  const lastWeek = data.slice(-7).reduce((sum, d) => sum + d.total, 0);
  const prevWeek = data.slice(-14, -7).reduce((sum, d) => sum + d.total, 0);
  const weekTrend = prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek * 100).toFixed(1) : '0';
  const isUp = lastWeek >= prevWeek;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gold" />
              Revenue Trend (30 Days)
            </CardTitle>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-bold font-mono">AED {(totalRevenue / 1000).toFixed(1)}K</span>
              <Badge variant={isUp ? 'default' : 'destructive'} className={cn('text-[10px] gap-0.5', isUp ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : '')}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {weekTrend}% vs prev week
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Avg daily: AED {avgDaily.toLocaleString()}</p>
          </div>
          <div className="flex gap-3 text-[10px]">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#d4a574]" /> Subscription</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#8b6914]" /> One-Time</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#c4547a]" /> Capsule</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a574" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d4a574" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b6914" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b6914" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c4547a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#c4547a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="subscription" name="Subscription" stroke="#d4a574" fill="url(#gradSub)" strokeWidth={2} />
            <Area type="monotone" dataKey="oneTime" name="One-Time" stroke="#8b6914" fill="url(#gradOT)" strokeWidth={2} />
            <Area type="monotone" dataKey="capsule" name="Capsule" stroke="#c4547a" fill="url(#gradCap)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Orders & Subscribers Daily Chart ──────────────────────
export function OrdersChart() {
  const data = useMemo(() => generateOrdersData(14), []);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
  const totalNewSubs = data.reduce((sum, d) => sum + d.newSubscribers, 0);
  const avgOrders = (totalOrders / data.length).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              Orders & New Subscribers (14 Days)
            </CardTitle>
            <div className="flex items-center gap-4 mt-1">
              <div>
                <span className="text-xl font-bold font-mono">{totalOrders}</span>
                <span className="text-[10px] text-muted-foreground ml-1">orders</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div>
                <span className="text-xl font-bold font-mono text-emerald-600">{totalNewSubs}</span>
                <span className="text-[10px] text-muted-foreground ml-1">new subscribers</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Avg {avgOrders} orders/day</p>
          </div>
          <div className="flex gap-3 text-[10px]">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Orders</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> New Subs</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={18} />
            <Bar dataKey="newSubscribers" name="New Subscribers" fill="#10b981" radius={[3, 3, 0, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Revenue Breakdown Pie ─────────────────────────────────
export function RevenueBreakdown() {
  const data = useMemo(() => generateRevenueBreakdown(), []);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-500" />
          Revenue Breakdown
        </CardTitle>
        <p className="text-2xl font-bold font-mono mt-1">AED {(total / 1000).toFixed(1)}K</p>
        <p className="text-[10px] text-muted-foreground">This month total</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`AED ${value.toLocaleString()}`, name]}
              contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-[10px]">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground truncate">{item.name}</span>
              <span className="font-mono font-semibold ml-auto">{((item.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Top Perfumes Chart ────────────────────────────────────
export function TopPerfumesChart() {
  const perfumes = useMemo(() => generateTopPerfumes(), []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Crown className="w-4 h-4 text-gold" />
              Top Perfumes by Orders
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">This month's most ordered fragrances</p>
          </div>
          <Badge variant="outline" className="text-[10px]">{perfumes.length} perfumes</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {perfumes.map((p, i) => {
            const maxOrders = perfumes[0].orders;
            const pct = (p.orders / maxOrders) * 100;
            return (
              <div key={p.name} className="group">
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                    i === 0 ? 'bg-gold/20 text-gold' : i === 1 ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' : i === 2 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' : 'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium truncate">{p.name}</span>
                        <span className="text-[9px] text-muted-foreground">{p.brand}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono font-semibold">{p.orders} orders</span>
                        <span className="text-[9px] text-muted-foreground font-mono">AED {(p.revenue / 1000).toFixed(1)}K</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: p.color }}
                      />
                    </div>
                  </div>
                </div>
                <div className="ml-7.5 mt-0.5">
                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-gold/20 text-gold/80">{p.aura}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
