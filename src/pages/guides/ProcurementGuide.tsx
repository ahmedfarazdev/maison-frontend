// ============================================================
// Setup Guide — Procurement
// Explains the PO lifecycle, supplier management, and cost tracking
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck, ClipboardList, Users, ArrowRight, ArrowDown,
  CheckCircle2, Lightbulb, ChevronDown, ChevronUp,
  DollarSign, FileText, Package, Warehouse, BookOpen,
  Workflow, AlertCircle, Shield, Timer, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface POStage {
  stage: string;
  icon: React.ElementType;
  color: string;
  description: string;
  details: string[];
}

const poLifecycle: POStage[] = [
  {
    stage: 'Draft',
    icon: FileText,
    color: 'border-slate-400 bg-slate-400/10 text-slate-400',
    description: 'PO is created with supplier, items, quantities, and expected costs. Not yet sent to supplier.',
    details: [
      'Select supplier from the Suppliers directory',
      'Add line items: perfume bottles, packaging materials, or accessories',
      'Enter expected unit cost and quantity for each item',
      'System auto-calculates total PO value',
      'Add notes or special instructions for the supplier',
    ],
  },
  {
    stage: 'Sent / Confirmed',
    icon: Truck,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    description: 'PO has been sent to the supplier. Awaiting shipment confirmation and tracking details.',
    details: [
      'Mark PO as "Sent" after emailing or sharing with supplier',
      'Record supplier confirmation date and expected delivery date',
      'Add tracking number when shipment is dispatched',
      'Monitor delivery timeline against lead time estimates',
    ],
  },
  {
    stage: 'Received',
    icon: Warehouse,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    description: 'Shipment has arrived. Items are counted, inspected, and distributed to inventory pools.',
    details: [
      'Receive at Stock Registry (Station 0) — count items against PO',
      'QC inspection: check for damage, wrong items, short shipments',
      'Record actual quantities received (may differ from ordered)',
      'Distribute: bottles → Sealed Vault, materials → Packaging & Materials',
      'Record actual landed cost (including shipping, duties, etc.)',
    ],
  },
  {
    stage: 'Closed',
    icon: CheckCircle2,
    color: 'border-gold bg-gold/10 text-gold',
    description: 'PO is fully received and reconciled. Cost data flows into inventory and COGS reports.',
    details: [
      'All items received and distributed to inventory',
      'Actual cost recorded and compared to expected cost',
      'Variance notes added for any discrepancies',
      'PO data feeds into Procurement COGS and Supplier Analytics reports',
    ],
  },
];

export default function ProcurementGuide() {
  const [, setLocation] = useLocation();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Procurement Guide"
        subtitle="Purchase order lifecycle, supplier management, and cost tracking best practices"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Procurement' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Truck className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Procurement Workflow</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Procurement manages the flow of goods from suppliers into your inventory. Every purchase goes through a
                  <strong> Purchase Order (PO)</strong> lifecycle: Draft → Sent → Received → Closed. This ensures full traceability
                  of costs, quantities, and supplier performance.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PO Lifecycle Flow */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              Purchase Order Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 py-4">
              {poLifecycle.map((stage, idx) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div className={cn('border rounded-xl p-4 text-center min-w-[130px]', stage.color)}>
                    <stage.icon className="w-7 h-7 mx-auto mb-1" />
                    <p className="font-semibold text-sm">{stage.stage}</p>
                  </div>
                  {idx < poLifecycle.length - 1 && (
                    <>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 hidden md:block" />
                      <ArrowDown className="w-4 h-4 text-muted-foreground shrink-0 md:hidden" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stage Details */}
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            PO Stages in Detail
          </h3>
          <div className="space-y-3">
            {poLifecycle.map(stage => {
              const isExpanded = expandedStage === stage.stage;
              const Icon = stage.icon;

              return (
                <Card key={stage.stage} className="border-border/60">
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedStage(isExpanded ? null : stage.stage)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', stage.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{stage.stage}</h4>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/30 pt-3">
                        <ul className="space-y-1.5">
                          {stage.details.map((d, i) => (
                            <li key={i} className="text-sm flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Supplier Management */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-5 h-5 text-info" />
              Supplier Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Maintain a directory of all suppliers with contact info, lead times, payment terms, and performance metrics.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <h5 className="text-xs font-semibold mb-2">What to Track per Supplier</h5>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Company name, contact person, email, phone</li>
                  <li>• Product categories they supply (bottles, packaging, etc.)</li>
                  <li>• Average lead time (days from order to delivery)</li>
                  <li>• Payment terms (Net 30, COD, prepaid, etc.)</li>
                  <li>• Currency and any minimum order quantities</li>
                </ul>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <h5 className="text-xs font-semibold mb-2">Performance Metrics</h5>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• On-time delivery rate</li>
                  <li>• Order accuracy (correct items & quantities)</li>
                  <li>• Quality score (damage/defect rate)</li>
                  <li>• Price competitiveness vs. alternatives</li>
                  <li>• Responsiveness (communication speed)</li>
                </ul>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLocation('/master/suppliers')} className="gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> Go to Suppliers
            </Button>
          </CardContent>
        </Card>

        {/* Cost Tracking */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gold" />
              Cost Tracking & COGS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Every PO feeds cost data into the system. Understanding your cost structure is critical for pricing and margin analysis.
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { label: 'Purchase Cost', desc: 'What you pay the supplier per unit', icon: DollarSign, color: 'text-emerald-500' },
                { label: 'Landed Cost', desc: 'Purchase cost + shipping + duties + handling', icon: Truck, color: 'text-blue-500' },
                { label: 'COGS', desc: 'Total cost of goods sold per order/product', icon: TrendingUp, color: 'text-gold' },
              ].map(item => (
                <div key={item.label} className="border border-border/50 rounded-lg p-3">
                  <item.icon className={cn('w-5 h-5 mb-1.5', item.color)} />
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card className="border-gold/20 bg-gold/5">
          <CardContent className="p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-gold" />
              Procurement Best Practices
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                'Always create a PO before ordering — never receive stock without a PO reference',
                'Record actual landed cost (not just invoice cost) for accurate COGS',
                'Maintain at least 2 suppliers per critical item category for backup',
                'Review Supplier Analytics monthly to identify underperformers',
                'Set reorder points in inventory to trigger PO creation proactively',
                'Keep payment terms consistent and documented per supplier',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  {tip}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setLocation('/procurement/purchase-orders')} className="gap-1.5">
            <ClipboardList className="w-4 h-4" /> Purchase Orders
          </Button>
          <Button variant="outline" onClick={() => setLocation('/master/suppliers')} className="gap-1.5">
            <Users className="w-4 h-4" /> Suppliers
          </Button>
          <Button variant="outline" onClick={() => setLocation('/reports/procurement')} className="gap-1.5">
            <TrendingUp className="w-4 h-4" /> Procurement COGS Report
          </Button>
          <Button variant="outline" onClick={() => setLocation('/reports/supplier-analytics')} className="gap-1.5">
            <DollarSign className="w-4 h-4" /> Supplier Analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
