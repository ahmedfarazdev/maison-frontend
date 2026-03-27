// ============================================================
// Setup Guide — Orders & Customer Experience
// Explains order management, returns, CX tools, and the order-to-fulfillment pipeline
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart, ArrowRight, ArrowDown, CheckCircle2, Lightbulb,
  ChevronDown, ChevronUp, BookOpen, Workflow, Layers,
  Package, RotateCcw, MessageSquare, Star, Users, Clock,
  FileText, Search, Truck, AlertCircle, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface Section {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  details: string[];
  tips: string[];
  link: string;
}

const sections: Section[] = [
  {
    name: 'Order Management',
    icon: ShoppingCart,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    description: 'Central hub for all incoming orders. View, filter, and manage orders from Shopify. Orders are the starting point for the entire fulfillment pipeline — they get grouped into jobs and processed by pods.',
    details: [
      'Orders sync from Shopify automatically with product, customer, and payment data',
      'Status flow: Pending → Confirmed → Processing → Shipped → Delivered',
      'Each order links to its fulfillment job, pod assignment, and shipping tracking',
      'Filter by status, date, customer, product type, and payment status',
      'Bulk actions: confirm, cancel, assign to group, export',
      'Order detail view shows full timeline, items, BOM breakdown, and shipping info',
    ],
    tips: [
      'Use the "Pending" filter to catch orders that need attention',
      'Orders are grouped into jobs via Order Grouping — don\'t process orders individually',
      'Check the order timeline for the full audit trail of status changes',
      'Use the search bar to find orders by order number, customer name, or email',
    ],
    link: '/orders',
  },
  {
    name: 'Returns',
    icon: RotateCcw,
    color: 'border-amber-500 bg-amber-500/10 text-amber-500',
    description: 'Handle product returns with reason tracking, condition assessment, and inventory re-entry. Supports bottle returns, vial returns, and full order returns.',
    details: [
      'Initiate returns from the Returns page with item type selection (bottle, vial, decant)',
      'Return reasons: Customer Return, QC Fail, Damaged, Expired, Recall, Other',
      'Condition assessment: Good (re-sellable), Damaged, Leaked, Contaminated, Empty',
      'Returned items can be logged back into inventory if condition is "Good"',
      'Return history with full audit trail per item',
      'Vial returns use the Scan Return feature — scan barcode to log return',
    ],
    tips: [
      'Always assess condition before accepting a return — damaged items shouldn\'t re-enter inventory',
      'Use the Scan Return in Vial Inventory for quick barcode-based vial returns',
      'Returns are tracked separately from exchanges — use the correct flow',
      'Review the Returns report monthly to identify patterns (e.g., frequent QC fails)',
    ],
    link: '/orders/returns',
  },
  {
    name: 'CRM & Customer Profiles',
    icon: Users,
    color: 'border-violet-500 bg-violet-500/10 text-violet-500',
    description: 'Customer relationship management with profiles, order history, preferences, and communication logs. Located below Orders & CX in the sidebar for easy access.',
    details: [
      'Customer profiles with contact info, order history, and lifetime value',
      'Subscription status and tier tracking (Grand Master 1–4)',
      'Communication log: notes, emails, and support interactions',
      'Customer segments for targeted marketing and operations',
      'VIP flagging for priority handling in the queue system',
      'Aura preferences and fragrance profile tracking',
    ],
    tips: [
      'Check customer profile before processing returns — VIP customers may get expedited handling',
      'Use the communication log to track all customer interactions',
      'Customer segments can drive priority tags in the queue system',
      'Review lifetime value to make informed decisions on returns and exchanges',
    ],
    link: '/crm',
  },
  {
    name: 'Exchanges',
    icon: Package,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    description: 'Product exchange workflow — swap one product for another. Handles the return of the original item and creation of a new order for the replacement.',
    details: [
      'Exchange request flow: Customer requests → Admin reviews → Approve/Deny',
      'Original item is returned and assessed (same as Returns flow)',
      'Replacement order is created automatically upon approval',
      'Replacement flows through the standard job pipeline for production',
      'Exchange tracking: original order → return → replacement order',
      'Cost difference handling: refund or charge the difference',
    ],
    tips: [
      'Exchanges create a new order — the replacement goes through the normal production pipeline',
      'Track both the return and the replacement to ensure nothing falls through the cracks',
      'Use the exchange report to identify products with high exchange rates',
      'Consider offering store credit instead of exchanges for faster resolution',
    ],
    link: '/orders/exchanges',
  },
];

export default function OrdersGuide() {
  const [, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Orders & Customer Experience Guide"
        subtitle="How to manage orders, returns, exchanges, and customer relationships"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Orders & CX' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Order-to-Fulfillment Pipeline</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Orders are the entry point for Maison Em's operations. Every customer purchase flows through a structured pipeline:
                  <strong> Order → Grouping → Job → Pod → Ship</strong>. The Orders & CX module manages the customer-facing side of this
                  pipeline, while Operations handles the production side.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Flow */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              Order Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-4">
              {[
                { label: 'Order Received', sub: 'Shopify sync → Pending status', color: 'border-blue-500/30 bg-blue-500/10' },
                { label: 'Order Confirmed', sub: 'Payment verified → Ready for grouping', color: 'border-violet-500/30 bg-violet-500/10' },
                { label: 'Grouped into Job', sub: 'Order Grouping → Job created with tag', color: 'border-pink-500/30 bg-pink-500/10' },
                { label: 'Processing', sub: 'Pod picks job → Pipeline stages', color: 'border-amber-500/30 bg-amber-500/10' },
                { label: 'Shipped', sub: 'AWB generated → Courier pickup', color: 'border-emerald-500/30 bg-emerald-500/10' },
                { label: 'Delivered', sub: 'Tracking confirmed → Complete', color: 'border-slate-500/30 bg-slate-500/10' },
              ].map((step, i) => (
                <div key={step.label}>
                  <div className={cn('border rounded-xl p-3 text-center min-w-[220px]', step.color)}>
                    <p className="font-semibold text-sm">{step.label}</p>
                    <p className="text-[10px] text-muted-foreground">{step.sub}</p>
                  </div>
                  {i < 5 && <ArrowDown className="w-5 h-5 text-muted-foreground mx-auto mt-3" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold" />
            Module Guide
          </h3>

          {sections.map((sec) => {
            const isExpanded = expandedSection === sec.name;
            const Icon = sec.icon;
            return (
              <Card key={sec.name} className={cn('border-border/40 transition-all', isExpanded && 'ring-1 ring-gold/30')}>
                <button
                  className="w-full text-left p-5 flex items-center gap-4"
                  onClick={() => setExpandedSection(isExpanded ? null : sec.name)}
                >
                  <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center shrink-0', sec.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{sec.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{sec.description}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && (
                  <CardContent className="px-5 pb-5 pt-0 space-y-5">
                    <div className="border-t border-border/30 pt-4" />

                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Details
                      </h5>
                      <ul className="space-y-2">
                        {sec.details.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-gold/5 border border-gold/20 rounded-lg p-4">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-gold mb-3 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" /> Pro Tips
                      </h5>
                      <ul className="space-y-2">
                        {sec.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gold/30 text-gold hover:bg-gold/10"
                      onClick={() => setLocation(sec.link)}
                    >
                      Open {sec.name} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Quick Reference */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-gold" />
              Common Workflows
            </h3>
            <div className="space-y-4">
              {[
                {
                  title: 'Process a Return',
                  steps: ['Go to Returns page', 'Click "Initiate Return"', 'Select item type (bottle/vial/decant)', 'Choose return reason', 'Assess condition', 'Confirm return → updates inventory'],
                },
                {
                  title: 'Handle an Exchange',
                  steps: ['Go to Exchanges tab', 'Create exchange request', 'Process return of original item', 'System creates replacement order', 'Replacement flows through job pipeline', 'Ship replacement to customer'],
                },
                {
                  title: 'Escalate a VIP Order',
                  steps: ['Find the order in Order Management', 'Check customer profile for VIP status', 'Find the job in Production Queue', 'Change priority tag to "VIP"', 'Pod picks VIP job first', 'Track through pipeline to shipping'],
                },
              ].map((wf) => (
                <div key={wf.title} className="border border-border/30 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-3">{wf.title}</h4>
                  <div className="flex flex-wrap items-center gap-1">
                    {wf.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">{step}</Badge>
                        {i < wf.steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
