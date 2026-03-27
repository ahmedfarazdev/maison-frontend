// ============================================================
// Daily Operations Report — E2 Feature
// Auto-generated daily summary page.
// Orders received, shipped, decants completed, bottles opened,
// packaging used, revenue. Exportable as PDF.
// ============================================================

import { useState, useMemo, useRef } from 'react';
import { PageHeader, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  FileText, Download, Calendar, ShoppingCart, Truck,
  FlaskConical, Package, DollarSign, Droplets, Box,
  ChevronLeft, ChevronRight, Loader2, BarChart3,
  TrendingUp, TrendingDown, Minus, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, Job, DashboardKPIs } from '@/types';

// ---- Date helpers ----
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.toDateString() === d2.toDateString();
}

// ---- Daily Summary Type ----
interface DailySummary {
  date: Date;
  ordersReceived: number;
  ordersShipped: number;
  ordersPacked: number;
  ordersProcessing: number;
  decantsCompleted: number;
  bottlesOpened: number;
  packagingUsed: number;
  revenue: number;
  subscriptionRevenue: number;
  oneTimeRevenue: number;
  fullBottleRevenue: number;
  newCustomers: number;
  avgOrderValue: number;
  topPerfumes: { name: string; count: number }[];
}

// ---- Build daily summary from orders ----
function buildDailySummary(orders: Order[], targetDate: Date): DailySummary {
  const dayOrders = orders.filter(o => isSameDay(new Date(o.created_at), targetDate));
  const shippedOrders = orders.filter(o => o.status === 'shipped' && isSameDay(new Date(o.updated_at), targetDate));
  const packedOrders = orders.filter(o => o.status === 'packed' && isSameDay(new Date(o.updated_at), targetDate));

  const revenue = dayOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const subRevenue = dayOrders.filter(o => o.type === 'subscription').reduce((sum, o) => sum + o.total_amount, 0);
  const otRevenue = dayOrders.filter(o => o.type === 'one_time').reduce((sum, o) => sum + o.total_amount, 0);

  // Count decants
  const decantItems = dayOrders.flatMap(o => o.items.filter(i => i.type === 'decant'));
  const decantCount = decantItems.reduce((sum, i) => sum + i.qty, 0);

  // Top perfumes
  const perfumeCount = new Map<string, number>();
  dayOrders.forEach(o => {
    o.items.forEach(item => {
      perfumeCount.set(item.perfume_name, (perfumeCount.get(item.perfume_name) || 0) + item.qty);
    });
  });
  const topPerfumes = Array.from(perfumeCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    date: targetDate,
    ordersReceived: dayOrders.length,
    ordersShipped: shippedOrders.length,
    ordersPacked: packedOrders.length,
    ordersProcessing: dayOrders.filter(o => !['shipped', 'cancelled'].includes(o.status)).length,
    decantsCompleted: decantCount,
    bottlesOpened: Math.ceil(decantCount / 10), // Estimate
    packagingUsed: dayOrders.length * 3, // Estimate: box + label + insert per order
    revenue,
    subscriptionRevenue: subRevenue,
    oneTimeRevenue: otRevenue,
    fullBottleRevenue: revenue - subRevenue - otRevenue,
    newCustomers: dayOrders.length, // Simplified
    avgOrderValue: dayOrders.length > 0 ? Math.round(revenue / dayOrders.length) : 0,
    topPerfumes,
  };
}

// ---- KPI Card ----
function KPICard({ icon: Icon, label, value, subValue, trend }: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs',
            trend === 'up' && 'text-emerald-600',
            trend === 'down' && 'text-red-600',
            trend === 'flat' && 'text-muted-foreground',
          )}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'flat' && <Minus className="w-3 h-3" />}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
    </div>
  );
}

// ---- Main Page ----
export default function DailyOpsReport() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: ordersData, isLoading } = useApiQuery(() => api.orders.list());

  const orders = useMemo(() => {
    const raw = (ordersData as any)?.data || ordersData || [];
    return Array.isArray(raw) ? raw as Order[] : [];
  }, [ordersData]);

  const summary = useMemo(() => buildDailySummary(orders, selectedDate), [orders, selectedDate]);

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    if (d <= new Date()) setSelectedDate(d);
  };

  const handleExportPDF = () => {
    // Generate a printable view
    if (reportRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
          <head>
            <title>Daily Operations Report — ${formatDate(selectedDate)}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 2rem; color: #1a1a1a; }
              h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
              h2 { font-size: 1.1rem; color: #666; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
              .subtitle { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
              .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
              .kpi { border: 1px solid #ddd; border-radius: 0.5rem; padding: 1rem; }
              .kpi-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
              .kpi-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
              .kpi-sub { font-size: 0.75rem; color: #888; margin-top: 0.125rem; }
              table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
              th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; font-size: 0.875rem; }
              th { font-weight: 600; color: #666; font-size: 0.75rem; text-transform: uppercase; }
              .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.75rem; color: #999; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <h1>Daily Operations Report</h1>
            <p class="subtitle">${formatDate(selectedDate)} — Maison Em Vault Operations</p>

            <div class="kpi-grid">
              <div class="kpi"><div class="kpi-label">Orders Received</div><div class="kpi-value">${summary.ordersReceived}</div></div>
              <div class="kpi"><div class="kpi-label">Orders Shipped</div><div class="kpi-value">${summary.ordersShipped}</div></div>
              <div class="kpi"><div class="kpi-label">Decants Completed</div><div class="kpi-value">${summary.decantsCompleted}</div></div>
              <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">AED ${summary.revenue.toLocaleString()}</div></div>
            </div>

            <h2>Revenue Breakdown</h2>
            <table>
              <tr><th>Category</th><th>Amount</th></tr>
              <tr><td>Subscription</td><td>AED ${summary.subscriptionRevenue.toLocaleString()}</td></tr>
              <tr><td>One-Time</td><td>AED ${summary.oneTimeRevenue.toLocaleString()}</td></tr>
              <tr><td>Full Bottles</td><td>AED ${summary.fullBottleRevenue.toLocaleString()}</td></tr>
              <tr><td><strong>Total</strong></td><td><strong>AED ${summary.revenue.toLocaleString()}</strong></td></tr>
            </table>

            <h2>Operations Summary</h2>
            <table>
              <tr><th>Metric</th><th>Count</th></tr>
              <tr><td>Orders Processing</td><td>${summary.ordersProcessing}</td></tr>
              <tr><td>Orders Packed</td><td>${summary.ordersPacked}</td></tr>
              <tr><td>Bottles Opened</td><td>${summary.bottlesOpened}</td></tr>
              <tr><td>Packaging Used</td><td>${summary.packagingUsed} units</td></tr>
              <tr><td>Average Order Value</td><td>AED ${summary.avgOrderValue}</td></tr>
            </table>

            ${summary.topPerfumes.length > 0 ? `
            <h2>Top Perfumes</h2>
            <table>
              <tr><th>#</th><th>Perfume</th><th>Units</th></tr>
              ${summary.topPerfumes.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.count}</td></tr>`).join('')}
            </table>
            ` : ''}

            <div class="footer">
              Generated by Maison Em Vault Operations Console · ${new Date().toLocaleString()}
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      <PageHeader
        title="Daily Operations Report"
        subtitle="Auto-generated daily summary of all vault operations"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        }
      />

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="sm" onClick={prevDay}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{formatDate(selectedDate)}</span>
          {isSameDay(selectedDate, new Date()) && (
            <Badge variant="secondary" className="text-[10px]">Today</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={nextDay}
          disabled={isSameDay(selectedDate, new Date())}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={ShoppingCart} label="Orders Received" value={String(summary.ordersReceived)} trend="flat" />
            <KPICard icon={Truck} label="Orders Shipped" value={String(summary.ordersShipped)} trend="flat" />
            <KPICard icon={FlaskConical} label="Decants Completed" value={String(summary.decantsCompleted)} trend="flat" />
            <KPICard icon={DollarSign} label="Revenue" value={`AED ${summary.revenue.toLocaleString()}`} subValue={`Avg: AED ${summary.avgOrderValue}`} trend="flat" />
          </div>

          {/* Revenue Breakdown */}
          <SectionCard title="Revenue Breakdown">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground uppercase mb-1">Subscription</p>
                <p className="text-xl font-bold">AED {summary.subscriptionRevenue.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground uppercase mb-1">One-Time</p>
                <p className="text-xl font-bold">AED {summary.oneTimeRevenue.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground uppercase mb-1">Full Bottles</p>
                <p className="text-xl font-bold">AED {summary.fullBottleRevenue.toLocaleString()}</p>
              </div>
            </div>
          </SectionCard>

          {/* Operations Summary */}
          <SectionCard title="Operations Summary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold">{summary.ordersProcessing}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Processing</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Package className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold">{summary.ordersPacked}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Packed</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Droplets className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-lg font-bold">{summary.bottlesOpened}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Bottles Opened</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Box className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold">{summary.packagingUsed}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Packaging Used</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Top Perfumes */}
          {summary.topPerfumes.length > 0 && (
            <SectionCard title="Top Perfumes Today">
              <div className="space-y-2">
                {summary.topPerfumes.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <Badge variant="secondary" className="text-xs">{p.count} units</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
