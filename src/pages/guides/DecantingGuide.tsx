// ============================================================
// Setup Guide — Decanting Stations
// Explains the 6-station workflow, roles, and best practices
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Factory, ClipboardList, ScanBarcode, Printer, FlaskConical,
  CheckSquare, Truck, ArrowRight, ArrowDown, CheckCircle2,
  AlertCircle, Lightbulb, ChevronDown, ChevronUp, ShoppingCart,
  RotateCcw, Users, Timer, Shield, BookOpen, Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface StationInfo {
  number: number;
  name: string;
  icon: React.ElementType;
  color: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  roles: string[];
  tips: string[];
  link: string;
}

const stations: StationInfo[] = [
  {
    number: 1, name: 'Pod Dashboard', icon: ClipboardList,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    purpose: 'Incoming orders are grouped into batches. The operator reviews orders, assigns priority, and pushes batches to Station 2.',
    inputs: ['Shopify orders (auto-synced)', 'Subscription renewal triggers', 'Manual order entry'],
    outputs: ['Batch assignment with order list', 'Priority tags (urgent, standard, bulk)', 'Batch status: Ready for Picking'],
    roles: ['Pod Senior', 'Pod Leader', 'Admin'],
    tips: [
      'Group similar order types together for efficiency (e.g., all One-Time decants in one batch)',
      'Mark VIP or time-sensitive orders as "Urgent" so they get picked first',
      'Subscription batches should be created on the 1st of each month',
      'Maximum recommended batch size: 50 orders for One-Time, 100 for Subscriptions',
    ],
    link: '/stations/1-job-board',
  },
  {
    number: 2, name: 'Picking', icon: ScanBarcode,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    purpose: 'The BOM auto-generates a picking list for the batch. The operator picks all components from inventory shelves.',
    inputs: ['Batch from Station 1', 'BOM-generated picking list', 'Inventory shelf locations'],
    outputs: ['Picked components grouped by order', 'Inventory deduction events', 'Picking confirmation scan'],
    roles: ['Pod Senior', 'Inventory Admin'],
    tips: [
      'Print the picking list or use the tablet view for hands-free operation',
      'Pick in shelf order (not order order) to minimize walking',
      'Scan barcodes to confirm each pick — prevents wrong-item errors',
      'If a component is out of stock, flag the batch and notify Procurement',
      'Variable components (perfumes) are listed as slots — the actual perfume is determined by the customer order',
    ],
    link: '/stations/2-picking',
  },
  {
    number: 3, name: 'Prep & Label', icon: Printer,
    color: 'border-purple-500 bg-purple-500/10 text-purple-500',
    purpose: 'Print labels for each vial/atomizer. Labels include perfume name, size, batch code, and customer info.',
    inputs: ['Picked components from Station 2', 'Label template data from BOM', 'Customer order details'],
    outputs: ['Printed labels applied to vials', 'Label checklist confirmed', 'Vials ready for decanting'],
    roles: ['Pod Senior', 'QC'],
    tips: [
      'Use the label checklist to verify every vial has the correct label before moving to Station 4',
      'Label printers should be calibrated daily — misaligned labels look unprofessional',
      'Include the batch code on every label for traceability',
      'For subscriptions, labels may include the customer name and subscription tier',
    ],
    link: '/stations/3-prep-label',
  },
  {
    number: 4, name: 'Batch Decanting', icon: FlaskConical,
    color: 'border-amber-500 bg-amber-500/10 text-amber-500',
    purpose: 'Decant perfume from source bottles into labeled vials using the correct syringe size. Record ml used per bottle.',
    inputs: ['Labeled vials from Station 3', 'Source bottles from Sealed Vault', 'Syringe selection from BOM'],
    outputs: ['Filled vials', 'Decanting log (ml per bottle)', 'Source bottle remaining volume update'],
    roles: ['Pod Senior'],
    tips: [
      'The system auto-suggests the correct syringe size based on the vial/atomizer in the BOM',
      'Always record the exact ml decanted — this feeds the Decanting Pool and cost calculations',
      'Work in a clean, well-lit area to avoid cross-contamination',
      'Group decanting by perfume (not by order) to minimize bottle open/close cycles',
      'If a source bottle runs low, the system will flag it and suggest opening a new one',
    ],
    link: '/stations/4-batch-decant',
  },
  {
    number: 5, name: 'Fulfillment', icon: CheckSquare,
    color: 'border-cyan-500 bg-cyan-500/10 text-cyan-500',
    purpose: 'Assemble each order box: place filled vials, inserts, accessories, and packaging per the BOM breakdown.',
    inputs: ['Filled vials from Station 4', 'BOM per-order breakdown', 'Packaging components from Station 2'],
    outputs: ['Assembled order boxes', 'QC checklist confirmed', 'Order status: Ready for Shipping'],
    roles: ['Pod Junior', 'QC'],
    tips: [
      'Use the per-order BOM breakdown to verify every item is in the box',
      'QC checkpoint: check label accuracy, vial fill level, and packaging condition',
      'Subscription boxes may have additional inserts (Perfume of the Month card, etc.)',
      'Seal boxes with branded tape and include the packing slip',
    ],
    link: '/stations/5-fulfillment',
  },
  {
    number: 6, name: 'Shipping', icon: Truck,
    color: 'border-rose-500 bg-rose-500/10 text-rose-500',
    purpose: 'Generate shipping labels, record tracking numbers, and hand off to courier. Update order status to Shipped.',
    inputs: ['Assembled boxes from Station 5', 'Customer shipping addresses', 'Courier API integration'],
    outputs: ['Shipping labels printed', 'Tracking numbers recorded', 'Customer notification sent'],
    roles: ['Pod Junior'],
    tips: [
      'Weigh each package to verify it matches the expected BOM weight',
      'Use the Shipping BOM to ensure bubble wrap, tape, and courier bags are included',
      'Generate tracking numbers in bulk for the entire batch',
      'Notify customers automatically when their order ships',
    ],
    link: '/stations/6-shipping',
  },
];

export default function DecantingGuide() {
  const [, setLocation] = useLocation();
  const [expandedStation, setExpandedStation] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Pod Operations Guide"
        subtitle="Complete walkthrough of the 6-station workflow — from order intake to shipping"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Decanting Stations' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Factory className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">The 6-Station Workflow</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Maison Em's decanting operation runs through <strong>6 sequential stations</strong>. Each station has a specific purpose,
                  inputs, outputs, and assigned roles. Orders flow from Pod Dashboard through to Station 6 (Shipping).
                  The unified station pipeline handles both <strong>One-Time Orders</strong> and <strong>Subscriptions</strong> — each job is tagged with its type so operators can process both in a single workflow.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Flow */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              Station Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 py-4">
              {stations.map((s, idx) => (
                <div key={s.number} className="flex items-center gap-2">
                  <div className={cn('border rounded-xl p-3 text-center min-w-[110px]', s.color)}>
                    <s.icon className="w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs font-semibold">S{s.number}</p>
                    <p className="text-[10px] mt-0.5 opacity-80">{s.name}</p>
                  </div>
                  {idx < stations.length - 1 && (
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

        {/* Two Tracks */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-info/30 bg-info/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-5 h-5 text-info" />
                <h4 className="font-semibold text-sm">One-Time Orders Track</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                A la carte decant orders from Shopify. Each order may contain 1–10+ different perfumes.
                Orders are batched daily and processed through all 6 stations.
              </p>
            </CardContent>
          </Card>
          <Card className="border-gold/30 bg-gold/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="w-5 h-5 text-gold" />
                <h4 className="font-semibold text-sm">Subscription Track</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Monthly subscription boxes (Grand Master 1–4 tiers). Batched at the start of each month.
                Higher volume, more standardized BOM per tier.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Station Details */}
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Station-by-Station Breakdown
          </h3>
          <div className="space-y-4">
            {stations.map(station => {
              const isExpanded = expandedStation === station.number;
              const Icon = station.icon;

              return (
                <Card key={station.number} className={cn('border-border/60 transition-all', isExpanded && 'ring-1 ring-gold/30')}>
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedStation(isExpanded ? null : station.number)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2', station.color)}>
                        <span className="text-lg font-bold">{station.number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-gold" />
                          <h3 className="font-semibold">Station {station.number}: {station.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{station.purpose}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Inputs</h5>
                            <ul className="space-y-1">
                              {station.inputs.map((input, i) => (
                                <li key={i} className="text-sm flex items-start gap-1.5">
                                  <ArrowRight className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
                                  {input}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Outputs</h5>
                            <ul className="space-y-1">
                              {station.outputs.map((output, i) => (
                                <li key={i} className="text-sm flex items-start gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                                  {output}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assigned Roles</h5>
                            <div className="flex flex-wrap gap-1.5">
                              {station.roles.map(role => (
                                <Badge key={role} variant="outline" className="text-[10px] gap-1">
                                  <Users className="w-3 h-3" /> {role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
                          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-gold" /> Best Practices
                          </h5>
                          <ul className="space-y-1.5">
                            {station.tips.map((tip, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <span className="text-gold font-bold text-xs mt-0.5">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => setLocation(station.link)} className="gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5" /> Go to Station {station.number}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Role Summary */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-5 h-5 text-info" />
              Role Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                    {stations.map(s => (
                      <th key={s.number} className="text-center py-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">S{s.number}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['Pod Senior', 'Pod Junior', 'Inventory Admin', 'QC', 'Pod Leader', 'Admin'].map(role => (
                    <tr key={role} className="border-b border-border/30">
                      <td className="py-2 px-3 font-medium">{role}</td>
                      {stations.map(s => (
                        <td key={s.number} className="text-center py-2 px-2">
                          {s.roles.includes(role) ? (
                            <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
