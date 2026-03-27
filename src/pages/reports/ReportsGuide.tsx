// Reports Guide — Maison Em OS
// Explains each report's purpose, what to learn, and how to read it

import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList, DollarSign, Layers, TrendingUp, Percent, Heart,
  FileText, BookOpen, Target, Lightbulb, ArrowRight, BarChart3,
  Eye, CheckCircle2, AlertTriangle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

// ─── Report Definitions ──────────────────────────────────────
interface ReportDef {
  id: string;
  name: string;
  path: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  category: 'operational' | 'financial' | 'strategic';
  frequency: string;
  audience: string[];
  purpose: string;
  whatYouLearn: string[];
  howToRead: string[];
  keyMetrics: string[];
  actionableInsights: string[];
}

const REPORTS: ReportDef[] = [
  {
    id: 'revenue-comparison',
    name: 'Revenue Comparison',
    path: '/reports/revenue-comparison',
    icon: BarChart3,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    category: 'strategic',
    frequency: 'Weekly / Monthly',
    audience: ['Owner', 'Admin'],
    purpose: 'Compares revenue, margins, and cost structure between subscription and one-time order streams. Helps you understand which revenue channel is more profitable and where to invest.',
    whatYouLearn: [
      'Revenue split between subscription and one-time orders',
      'Margin comparison across order types',
      'Cost structure differences (perfume, packaging, labor)',
      'Monthly trends for each revenue stream',
      'Subscription tier breakdown and performance',
    ],
    howToRead: [
      'Start with the KPI row to see total revenue and which stream has higher margins',
      'Use the comparison bars to see side-by-side cost breakdowns',
      'Switch to Detailed view for the full comparison table and tier analysis',
      'Filter by date range to compare specific periods',
    ],
    keyMetrics: ['Revenue by stream', 'Margin %', 'Avg order value', 'Cost per order', 'Subscription tier revenue'],
    actionableInsights: [
      'If subscription margins are higher, invest in subscriber acquisition and retention',
      'If one-time AOV is significantly higher, consider upsell strategies for subscribers',
      'Compare cost structures to identify optimization opportunities per channel',
    ],
  },
  {
    id: 'daily-ops',
    name: 'Daily Ops Report',
    path: '/reports/daily-ops',
    icon: ClipboardList,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    category: 'operational',
    frequency: 'Daily',
    audience: ['Owner', 'Admin', 'Full Ops'],
    purpose: 'Provides a snapshot of daily operational activity — orders processed, batches completed, pod throughput, and any bottlenecks. This is your morning briefing to understand what happened yesterday and what needs attention today.',
    whatYouLearn: [
      'How many orders were processed through each pod',
      'Which pods have backlogs or idle capacity',
      'Batch completion rates and decanting efficiency',
      'Shipping readiness and courier pickup status',
      'Team productivity across shifts',
    ],
    howToRead: [
      'Start with the summary KPIs at the top — these show the day\'s totals',
      'Check the pod-by-pod breakdown for bottlenecks (high "pending" counts)',
      'Review the timeline chart to see when peak activity occurred',
      'Look at the "Alerts" section for any items requiring immediate attention',
    ],
    keyMetrics: ['Orders processed', 'Pod throughput', 'Batch completion rate', 'Average processing time', 'Shipping readiness'],
    actionableInsights: [
      'If the Decanting stage has high pending counts, consider adding a second decanting pod',
      'If shipping readiness drops below 90%, investigate packing bottlenecks',
      'Use the trend line to identify your peak hours and staff accordingly',
    ],
  },
  {
    id: 'cost',
    name: 'Inventory Cost Report',
    path: '/reports/cost',
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    category: 'financial',
    frequency: 'Weekly / Monthly',
    audience: ['Owner', 'Admin', 'Inventory Admin'],
    purpose: 'Tracks the total value of your inventory across all categories — sealed bottles, open decanting pool, and packaging materials. Helps you understand how much capital is tied up in stock and where it\'s allocated.',
    whatYouLearn: [
      'Total inventory valuation across all categories',
      'Cost distribution between perfumes, packaging, and materials',
      'Inventory turnover rates and aging analysis',
      'Which items are tying up the most capital',
      'Shrinkage and loss trends over time',
    ],
    howToRead: [
      'The top summary shows total inventory value — compare with previous periods',
      'The category breakdown shows where your capital is allocated',
      'Check the "Aging" section — items sitting too long may need clearance',
      'The "Top 10 by Value" list shows your highest-value stock items',
    ],
    keyMetrics: ['Total inventory value (AED)', 'Category breakdown', 'Turnover rate', 'Aging distribution', 'Shrinkage rate'],
    actionableInsights: [
      'If perfume inventory exceeds 60% of total value, you may be over-stocked on raw materials',
      'Items aging beyond 90 days should be reviewed for clearance or promotion',
      'Rising shrinkage rates indicate process issues in decanting or handling',
    ],
  },
  {
    id: 'supplier-analytics',
    name: 'Supplier Analytics',
    path: '/reports/supplier-analytics',
    icon: Layers,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    category: 'strategic',
    frequency: 'Monthly / Quarterly',
    audience: ['Owner', 'Admin'],
    purpose: 'Evaluates supplier performance across delivery reliability, pricing consistency, quality scores, and lead times. Helps you make informed decisions about supplier relationships and negotiate better terms.',
    whatYouLearn: [
      'Which suppliers deliver on time consistently',
      'Price trends and cost changes per supplier',
      'Quality acceptance rates from QC inspections',
      'Average lead times and reliability scores',
      'Spend concentration and dependency risks',
    ],
    howToRead: [
      'The scorecard ranks suppliers by overall performance (delivery + quality + price)',
      'Check the "On-Time Delivery" percentage — below 85% is a red flag',
      'Review price trend charts for unexpected cost increases',
      'The "Spend Concentration" chart shows if you\'re too dependent on one supplier',
    ],
    keyMetrics: ['On-time delivery %', 'Quality acceptance rate', 'Average lead time', 'Price variance', 'Spend concentration'],
    actionableInsights: [
      'Suppliers below 80% on-time should receive formal improvement notices',
      'If one supplier accounts for >40% of spend, develop backup sources',
      'Use quality data to negotiate better terms with high-performing suppliers',
    ],
  },
  {
    id: 'procurement',
    name: 'Procurement COGS',
    path: '/reports/procurement',
    icon: TrendingUp,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    category: 'financial',
    frequency: 'Monthly',
    audience: ['Owner', 'Admin'],
    purpose: 'Tracks your Cost of Goods Sold through the procurement lens — what you\'re spending to acquire raw materials and how those costs translate into your product COGS. Essential for pricing decisions.',
    whatYouLearn: [
      'Total procurement spend by category and period',
      'Cost per ml of perfume across different sources',
      'Packaging cost trends and bulk discount effectiveness',
      'COGS breakdown per product type (decant vs full bottle)',
      'Budget vs actual spending analysis',
    ],
    howToRead: [
      'Start with the total COGS summary — this is your baseline cost',
      'The "Cost per ML" chart shows your effective perfume acquisition cost',
      'Compare "Budget vs Actual" to identify overspending categories',
      'The trend line shows if your COGS is increasing or decreasing over time',
    ],
    keyMetrics: ['Total COGS', 'Cost per ml', 'Packaging cost per unit', 'Budget variance', 'COGS trend'],
    actionableInsights: [
      'If cost per ml is rising, negotiate volume discounts or find alternative suppliers',
      'Packaging costs above 15% of total COGS suggest optimization opportunities',
      'Use COGS data to validate your selling price multipliers in BOM Pricing',
    ],
  },
  {
    id: 'margin-analysis',
    name: 'Margin Analysis',
    path: '/reports/margin-analysis',
    icon: Percent,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    category: 'financial',
    frequency: 'Weekly / Monthly',
    audience: ['Owner'],
    purpose: 'The most critical financial report — shows your actual profit margins across all product lines. Compares selling prices against all costs (materials, packaging, labor, shipping) to reveal true profitability.',
    whatYouLearn: [
      'Gross margin per product and product category',
      'Which products are most and least profitable',
      'Margin trends over time (improving or declining)',
      'Impact of discounts and promotions on margins',
      'Break-even analysis per product line',
    ],
    howToRead: [
      'The summary shows overall gross margin — target is typically 60-70% for luxury decants',
      'Sort by margin % to quickly find underperforming products',
      'Red-flagged items have margins below your minimum threshold',
      'The trend chart shows if margins are stable, improving, or declining',
    ],
    keyMetrics: ['Gross margin %', 'Margin per unit', 'Margin trend', 'Below-threshold count', 'Average selling price'],
    actionableInsights: [
      'Products with margins below 40% should be repriced or discontinued',
      'If overall margin is declining, check if COGS is rising or if you\'re over-discounting',
      'Use this data to set minimum price floors in your Shopify store',
    ],
  },
  {
    id: 'product-pnl',
    name: 'Product P&L',
    path: '/reports/product-pnl',
    icon: DollarSign,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    category: 'financial',
    frequency: 'Monthly',
    audience: ['Owner', 'Admin'],
    purpose: 'Profit and Loss statement at the individual product level. Shows revenue, all cost components, and net profit for each product — the most granular view of product-level financial performance.',
    whatYouLearn: [
      'Revenue generated per product',
      'Full cost breakdown: materials + packaging + labor + shipping',
      'Net profit per unit and per product line',
      'Which products drive the most revenue vs most profit',
      'Contribution margin for portfolio decisions',
    ],
    howToRead: [
      'Each row is a product with its complete P&L breakdown',
      'Revenue minus all costs gives you the net profit column',
      'Sort by "Net Profit" to see your top earners',
      'The "Contribution %" shows how much each product contributes to total profit',
    ],
    keyMetrics: ['Revenue per product', 'Full cost breakdown', 'Net profit', 'Contribution %', 'Units sold'],
    actionableInsights: [
      'Products with high revenue but low profit may need cost optimization',
      'Low-volume high-margin products are candidates for promotion',
      'Use contribution % to decide which products to feature in marketing',
    ],
  },
  {
    id: 'invoices',
    name: 'Tax & Invoices',
    path: '/reports/invoices',
    icon: FileText,
    color: 'text-zinc-600',
    bgColor: 'bg-zinc-50 dark:bg-zinc-900/30',
    category: 'financial',
    frequency: 'As needed / Monthly',
    audience: ['Owner', 'Admin'],
    purpose: 'Generates tax-compliant invoices and tracks VAT obligations. Essential for accounting, tax filing, and maintaining proper financial records for the business.',
    whatYouLearn: [
      'Total invoiced amounts and VAT collected',
      'Invoice status (paid, pending, overdue)',
      'Customer billing history',
      'Tax liability for the period',
      'Export-ready data for accountants',
    ],
    howToRead: [
      'The summary shows total invoiced, collected, and outstanding amounts',
      'Filter by date range to match your tax filing period',
      'Overdue invoices are highlighted in red — follow up immediately',
      'Use the export function to send data to your accountant',
    ],
    keyMetrics: ['Total invoiced', 'VAT collected', 'Outstanding amount', 'Overdue count', 'Collection rate'],
    actionableInsights: [
      'Overdue invoices beyond 30 days should trigger automated reminders',
      'Track VAT collected vs VAT owed to avoid surprises at filing time',
      'Monthly reconciliation prevents year-end accounting headaches',
    ],
  },
  {
    id: 'subscription-health',
    name: 'Subscription Health',
    path: '/reports/subscription-health',
    icon: Heart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    category: 'strategic',
    frequency: 'Weekly / Monthly',
    audience: ['Owner', 'Admin'],
    purpose: 'Monitors the health of your subscription business — the Aura Key Ecosystem. Tracks subscriber growth, churn, retention, and lifetime value to ensure sustainable recurring revenue.',
    whatYouLearn: [
      'Active subscriber count and growth rate',
      'Churn rate and reasons for cancellation',
      'Average subscriber lifetime and LTV',
      'Renewal rates by subscription tier',
      'Revenue predictability and MRR trends',
    ],
    howToRead: [
      'The health score at the top is a composite metric (green = healthy, yellow = watch, red = action needed)',
      'Check churn rate — above 5% monthly is a warning sign for luxury subscriptions',
      'The cohort analysis shows how different subscriber groups retain over time',
      'MRR trend should be consistently upward — flat or declining needs investigation',
    ],
    keyMetrics: ['Active subscribers', 'Monthly churn rate', 'LTV', 'MRR', 'Renewal rate'],
    actionableInsights: [
      'If churn spikes after month 3, review the subscription experience at that stage',
      'High LTV subscribers should receive exclusive perks to maintain loyalty',
      'Use renewal rate data to time your re-engagement campaigns',
    ],
  },
  {
    id: 'bom-pricing',
    name: 'BOM Pricing & Margin',
    path: '/reports/bom-pricing',
    icon: Percent,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
    category: 'strategic',
    frequency: 'When BOMs change / Monthly',
    audience: ['Owner', 'System Architect'],
    purpose: 'Connects your BOM cost structures to selling prices and analyzes the resulting margins. Shows fixed costs (packaging, labels), variable costs (perfume per ml), shipping costs, and how they compare to your selling price multipliers.',
    whatYouLearn: [
      'Fixed vs variable vs shipping cost breakdown per product',
      'Total BOM cost compared to selling price',
      'Margin % and multiplier for each end product',
      'Which products have healthy vs thin margins',
      'Impact of BOM changes on profitability',
    ],
    howToRead: [
      'Each row shows an end product with its full cost breakdown',
      'Fixed = packaging + labels + materials; Variable = perfume cost; Shipping = shipping BOM',
      'The multiplier column shows selling price / total cost — target 2.5x–4x for luxury',
      'Red-highlighted margins indicate products below your minimum threshold',
      'Use the summary cards at the top for portfolio-level health',
    ],
    keyMetrics: ['Fixed cost', 'Variable cost', 'Shipping cost', 'Total BOM cost', 'Selling price', 'Margin %', 'Multiplier'],
    actionableInsights: [
      'Products with multiplier below 2x need immediate repricing or BOM optimization',
      'If variable costs dominate, negotiate better per-ml rates with suppliers',
      'Shipping cost optimization (switching from box to bag where possible) can improve margins by 5-10%',
    ],
  },
];

const CATEGORY_CONFIG = {
  operational: { label: 'Operational', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200' },
  financial: { label: 'Financial', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200' },
  strategic: { label: 'Strategic', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200' },
};

// ─── Report Card ─────────────────────────────────────────────
function ReportCard({ report }: { report: ReportDef }) {
  const Icon = report.icon;
  const cat = CATEGORY_CONFIG[report.category];

  return (
    <Card className="border hover:shadow-md transition-all group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', report.bgColor)}>
              <Icon className={cn('w-5 h-5', report.color)} />
            </div>
            <div>
              <CardTitle className="text-base">{report.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn('text-[9px]', cat.color, cat.border)}>{cat.label}</Badge>
                <span className="text-[10px] text-muted-foreground">{report.frequency}</span>
              </div>
            </div>
          </div>
          <Link href={report.path}>
            <Button variant="ghost" size="sm" className="text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Purpose */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purpose</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{report.purpose}</p>
        </div>

        {/* What You Learn */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">What You Learn</span>
          </div>
          <ul className="space-y-1">
            {report.whatYouLearn.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* How to Read */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">How to Read</span>
          </div>
          <ol className="space-y-1">
            {report.howToRead.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 text-[9px] font-bold text-blue-600">{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Key Metrics */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Key Metrics</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.keyMetrics.map(metric => (
              <Badge key={metric} variant="outline" className="text-[10px] font-normal">{metric}</Badge>
            ))}
          </div>
        </div>

        {/* Actionable Insights */}
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gold">Actionable Insights</span>
          </div>
          <ul className="space-y-1.5">
            {report.actionableInsights.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-gold" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Audience */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground/60">Audience:</span>
          {report.audience.map(role => (
            <Badge key={role} variant="secondary" className="text-[9px]">{role}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function ReportsGuide() {
  const operational = REPORTS.filter(r => r.category === 'operational');
  const financial = REPORTS.filter(r => r.category === 'financial');
  const strategic = REPORTS.filter(r => r.category === 'strategic');

  return (
    <div>
      <PageHeader
        title="Reports Guide"
        subtitle="Understand each report — what it measures, how to read it, and what actions to take"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/reports/guide' },
          { label: 'Reports Guide' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="py-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">How to Use Reports in Maison Em OS</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Maison Em OS provides <strong>{REPORTS.length} reports</strong> organized into three categories:
                  <strong className="text-blue-600"> Operational</strong> (daily workflows),
                  <strong className="text-emerald-600"> Financial</strong> (costs, margins, P&L), and
                  <strong className="text-purple-600"> Strategic</strong> (supplier relationships, subscriptions, BOM optimization).
                  Each report is designed to answer specific questions and drive specific actions. Read this guide to understand
                  what each report tells you and how to act on the data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              Quick Reference — Report Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { cat: 'operational', title: 'Operational Reports', desc: 'Day-to-day workflow monitoring. Check these daily to ensure smooth operations and catch bottlenecks early.', count: operational.length },
                { cat: 'financial', title: 'Financial Reports', desc: 'Cost tracking, margins, and profitability. Review weekly/monthly to maintain healthy finances and optimize pricing.', count: financial.length },
                { cat: 'strategic', title: 'Strategic Reports', desc: 'Long-term business health. Analyze monthly/quarterly to make informed decisions about suppliers, products, and growth.', count: strategic.length },
              ].map(item => {
                const config = CATEGORY_CONFIG[item.cat as keyof typeof CATEGORY_CONFIG];
                return (
                  <div key={item.cat} className={cn('rounded-lg border p-4', config.border)}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn('text-[10px]', config.bg, config.color)}>{item.count} reports</Badge>
                      <h4 className={cn('font-semibold text-sm', config.color)}>{item.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Operational Reports */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Operational Reports
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {operational.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        </div>

        {/* Financial Reports */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Financial Reports
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {financial.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        </div>

        {/* Strategic Reports */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            Strategic Reports
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {strategic.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
