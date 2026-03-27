// ============================================================
// BOM Setup Guide — Explains the BOM structure, workflow, and how
// everything connects: End Products → BOM Templates → Components → Orders → Stations
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package, Layers, Puzzle, Link2, ArrowRight, ArrowDown,
  ShoppingCart, ClipboardList, Droplets, Box, Pipette, StickyNote,
  Tag, Truck, Wrench, CheckCircle2, AlertCircle, Sparkles,
  RotateCcw, Settings2, BookOpen, Lightbulb, Workflow,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface StepProps {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  details: string[];
  link?: { label: string; href: string };
}

function StepCard({ step, isLast }: { step: StepProps; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = step.icon;

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-6 top-[72px] bottom-0 w-0.5 bg-border/50 z-0" />
      )}

      <div className="relative z-10 flex gap-4">
        {/* Step number circle */}
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2',
          step.color,
        )}>
          <span className="text-lg font-bold">{step.number}</span>
        </div>

        {/* Content */}
        <Card className="flex-1 border-border/60">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-5 h-5 text-gold" />
                <h3 className="font-semibold">{step.title}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="h-7 w-7 p-0">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{step.description}</p>

            {expanded && (
              <div className="mt-3 space-y-2">
                {step.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </div>
                ))}
                {step.link && (
                  <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => window.location.href = step.link!.href}>
                    <ArrowRight className="w-3.5 h-3.5" /> {step.link.label}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SetupGuide() {
  const [, setLocation] = useLocation();

  const steps: StepProps[] = [
    {
      number: 1,
      title: 'Register Components in the Component Library',
      description: 'Add every physical item that goes into your products — perfumes, atomizers, boxes, labels, inserts, shipping materials.',
      icon: Puzzle,
      color: 'border-blue-500 bg-blue-500/10 text-blue-500',
      details: [
        'Go to BOM → Component Library and click "Add Component"',
        'Set the category (Perfume, Atomizer, Packaging, Insert, Accessory, Label, Shipping)',
        'Enter the unit cost — this auto-fetches from your inventory SKU if linked',
        'Mark components as "Variable" if they change per order (e.g., customer-selected perfumes)',
        'Add photos for visual identification during picking',
        'Components are shared across all BOM templates — add once, reuse everywhere',
      ],
      link: { label: 'Go to Component Library', href: '/bom/components' },
    },
    {
      number: 2,
      title: 'Create BOM Templates',
      description: 'A BOM template defines the exact recipe for building one product — which components, how many of each, and the total cost.',
      icon: Layers,
      color: 'border-gold bg-gold/10 text-gold',
      details: [
        'Go to BOM → End Products & BOMs → BOM Templates tab',
        'Click "New BOM" and give it a descriptive name (e.g., "Grand Master 1 Subscription Box BOM")',
        'Add components from the library — set quantity per unit for each',
        'The system auto-calculates total BOM cost from component unit costs × quantities',
        'Create separate BOMs for each product type: One-Time, Grand Master 1–4, Em Sets, etc.',
        'You can also create a "Shipping BOM" for shipping materials that apply to all orders',
      ],
      link: { label: 'Go to BOM Templates', href: '/bom/setup' },
    },
    {
      number: 3,
      title: 'Register End Products',
      description: 'End Products are the finished items your customers buy — each links to a BOM template that defines how to build it.',
      icon: Package,
      color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
      details: [
        'Go to BOM → End Products & BOMs → End Products tab',
        'Click "Add Product" — enter name, SKU, category, and fixed selling price',
        'Add tags for filtering (e.g., "subscription", "one-time", "bundle")',
        'Link the product to a BOM template — this tells the system what components to pick',
        'Categories: One-Time Decant, Subscription Box, Box Bundle, Em Set, Aura Play, Full Bottle, Custom',
        'The margin is auto-calculated: Fixed Price − BOM Cost = Gross Margin',
      ],
      link: { label: 'Go to End Products', href: '/bom/setup' },
    },
    {
      number: 4,
      title: 'Verify Order → BOM Resolution',
      description: 'Orders are dynamic — the system auto-resolves each product in an order to its BOM. No manual mapping needed.',
      icon: Link2,
      color: 'border-purple-500 bg-purple-500/10 text-purple-500',
      details: [
        'Go to BOM → Order Resolution to see the auto-resolved table',
        'Each End Product shows its linked BOM Template and resolution status',
        'Green checkmark = product has a BOM linked and will auto-resolve',
        'Yellow warning = product has no BOM — link one in the Products tab',
        'When an order arrives from Shopify, the system identifies products by Shopify Product ID',
        'It then looks up each product\'s BOM and auto-generates a combined picking list',
        'Preview the picking list for any product to verify correctness',
      ],
      link: { label: 'Go to Order Resolution', href: '/bom/order-mapping' },
    },
    {
      number: 5,
      title: 'Simulate Inventory Impact',
      description: 'Before processing a batch, run a simulation to see if you have enough stock and identify shortages.',
      icon: Settings2,
      color: 'border-orange-500 bg-orange-500/10 text-orange-500',
      details: [
        'Go to BOM → Inventory Impact',
        'Select a BOM template and enter the number of orders you expect',
        'Click "Run Simulation" to see component-by-component impact',
        'The system shows: total needed, current stock, remaining after deduction, and shortages',
        'Ledger Events tab previews what will be recorded when the batch is confirmed',
        'Reorder Suggestions tab shows which components need restocking with suggested quantities',
      ],
      link: { label: 'Go to Inventory Impact', href: '/bom/inventory-impact' },
    },
    {
      number: 6,
      title: 'Process Orders Through Stations',
      description: 'When orders arrive, the BOM auto-generates picking lists for Station 2, and each station uses the BOM data.',
      icon: ClipboardList,
      color: 'border-cyan-500 bg-cyan-500/10 text-cyan-500',
      details: [
        'Queue (Pod Dashboard): Orders are assigned to batches — the BOM is resolved per order',
        'Station 2 (Picking): The BOM picking list shows all components needed across the batch',
        'Station 3 (Labels): Per-perfume label checklist generated from BOM perfume components',
        'Station 4 (Decanting): Syringe auto-selected based on BOM atomizer sizes',
        'Station 5 (Fulfillment): Per-order BOM breakdown shows which items go in each box',
        'Station 6 (Shipping): Shipping BOM components (bubble wrap, tape, etc.) are included',
      ],
    },
  ];

  const conceptCards = [
    {
      title: 'Master BOM (Umbrella)',
      icon: Layers,
      color: 'text-gold',
      description: 'When an order contains multiple products (e.g., 2 Em Sets + 1 One-Time), the system compiles a Master BOM that merges all product BOMs and deduplicates common items. Instead of picking 3 separate boxes, it picks 1 combined set with shared packaging consolidated.',
    },
    {
      title: 'Shipping BOM',
      icon: Truck,
      color: 'text-info',
      description: 'A special BOM template for shipping materials (bubble wrap, tape, courier bags). This is automatically appended to every order\'s Master BOM regardless of product type, ensuring shipping materials are always included in the picking list.',
    },
    {
      title: 'Variable Components',
      icon: Sparkles,
      color: 'text-purple-500',
      description: 'Components marked as "Variable" change per order based on customer selection (e.g., which perfumes they chose). The BOM template defines the slot (e.g., "3× Perfume Decant 5ml"), and the actual perfume is resolved at order time from the customer\'s choices.',
    },
    {
      title: 'Cost Rollup',
      icon: Package,
      color: 'text-emerald-500',
      description: 'Each BOM template auto-calculates its total cost by summing (component unit cost × quantity) for all line items. When you update a component\'s unit cost in the library, all BOMs using that component automatically reflect the new cost.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="BOM Setup Guide"
        subtitle="Step-by-step guide to setting up your Bill of Materials — from components to order processing"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM', href: '/bom/setup' },
          { label: 'Setup Guide' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview Banner */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">How the BOM System Works</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The Bill of Materials (BOM) system connects your product catalog to your inventory and station workflow.
                  It answers the question: <strong>"When a customer orders Product X, what exactly do we need to pick, prepare, and pack?"</strong>
                </p>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <Badge variant="outline" className="gap-1"><Puzzle className="w-3 h-3" /> Components</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Layers className="w-3 h-3" /> BOM Templates</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Package className="w-3 h-3" /> End Products</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><Link2 className="w-3 h-3" /> Order Resolution</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <Badge variant="outline" className="gap-1"><ClipboardList className="w-3 h-3" /> Picking Lists</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visual Flow Diagram */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              BOM Data Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 py-4">
              {[
                { icon: Puzzle, label: 'Components', sub: 'Perfumes, Atomizers, Boxes...', color: 'bg-blue-500/10 border-blue-500/30 text-blue-500' },
                { icon: Layers, label: 'BOM Templates', sub: 'Recipe for each product', color: 'bg-gold/10 border-gold/30 text-gold' },
                { icon: Package, label: 'End Products', sub: 'What customers buy', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' },
                { icon: ShoppingCart, label: 'Orders', sub: 'Shopify / Manual', color: 'bg-purple-500/10 border-purple-500/30 text-purple-500' },
                { icon: ClipboardList, label: 'Picking Lists', sub: 'Station 2 workflow', color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500' },
              ].map((item, idx, arr) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={cn('border rounded-xl p-4 text-center min-w-[140px]', item.color)}>
                    <item.icon className="w-8 h-8 mx-auto mb-2" />
                    <p className="font-semibold text-sm">{item.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{item.sub}</p>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 hidden md:block" />
                  )}
                  {idx < arr.length - 1 && (
                    <ArrowDown className="w-5 h-5 text-muted-foreground shrink-0 md:hidden" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key Concepts */}
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-gold" />
            Key Concepts
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {conceptCards.map(card => (
              <Card key={card.title} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className={cn('w-5 h-5', card.color)} />
                    <h4 className="font-semibold text-sm">{card.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Step-by-Step Setup */}
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Step-by-Step Setup
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Follow these 6 steps in order. Click each step to expand for detailed instructions and a direct link to the relevant page.
          </p>
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <StepCard key={step.number} step={step} isLast={idx === steps.length - 1} />
            ))}
          </div>
        </div>

        {/* Component Categories Reference */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Puzzle className="w-5 h-5 text-info" />
              Component Categories Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { icon: Droplets, label: 'Perfume', desc: 'Fragrance oils & bottles', color: 'text-amber-600' },
                { icon: Pipette, label: 'Atomizer', desc: 'Vials, sprayers, caps', color: 'text-blue-500' },
                { icon: Box, label: 'Packaging', desc: 'Boxes, bags, wraps', color: 'text-emerald-500' },
                { icon: StickyNote, label: 'Insert', desc: 'Cards, booklets, notes', color: 'text-purple-500' },
                { icon: Wrench, label: 'Accessory', desc: 'Funnels, tools, extras', color: 'text-orange-500' },
                { icon: Tag, label: 'Label', desc: 'Product & brand labels', color: 'text-pink-500' },
                { icon: Truck, label: 'Shipping', desc: 'Bubble wrap, tape, bags', color: 'text-cyan-500' },
              ].map(cat => (
                <div key={cat.label} className="border border-border/50 rounded-lg p-3 text-center">
                  <cat.icon className={cn('w-6 h-6 mx-auto mb-1.5', cat.color)} />
                  <p className="text-xs font-semibold">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cat.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-gold/20 bg-gold/5">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Ready to Get Started?</h3>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setLocation('/bom/components')} className="gap-1.5">
                <Puzzle className="w-4 h-4" /> Start with Components
              </Button>
              <Button variant="outline" onClick={() => setLocation('/bom/setup')} className="gap-1.5">
                <Layers className="w-4 h-4" /> Create BOM Templates
              </Button>
              <Button variant="outline" onClick={() => setLocation('/bom/order-mapping')} className="gap-1.5">
                <Link2 className="w-4 h-4" /> View Order Resolution
              </Button>
              <Button variant="outline" onClick={() => setLocation('/bom/inventory-impact')} className="gap-1.5">
                <RotateCcw className="w-4 h-4" /> Run Simulation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
