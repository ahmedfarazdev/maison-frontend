// ============================================================
// Setup Guide — Products, BOM & Subscription Management
// Explains product setup, BOM structure, end products, capsules, vault, and gifting
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package, Puzzle, Layers, ArrowRight, ArrowDown, CheckCircle2,
  Lightbulb, ChevronDown, ChevronUp, BookOpen, Workflow,
  ShoppingBag, Gem, Gift, Calendar, Star, Tag, Box,
  DollarSign, Repeat, Sparkles,
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
    name: 'BOM Structure & Components',
    icon: Puzzle,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    description: 'The Bill of Materials (BOM) defines what goes into each product. Components include perfume vials, atomizers, boxes, inserts, labels, and shipping materials. BOMs are reusable templates linked to End Products.',
    details: [
      'Create BOM Templates — define the recipe for each product type (e.g., "3-Vial Subscription Box")',
      'Add Line Items — each component with quantity, optional flag, and condition rules',
      'Link to End Products — one BOM can serve multiple products with the same composition',
      'Shipping BOM — separate BOM for shipping materials (box, bubble wrap, tape, insert)',
      'Visual BOM Designer — drag-and-drop workflow editor for complex product structures',
      'Cost rolls up automatically — component costs aggregate to product-level COGS',
    ],
    tips: [
      'Start by creating your components in the Component Library before building BOMs',
      'Use the "optional" flag for items that vary by order (e.g., gift wrapping)',
      'Condition rules let you include items based on order properties (e.g., "if 20ml decant")',
      'Review the BOM Pricing Report to ensure margins are healthy before launching products',
    ],
    link: '/bom/guide',
  },
  {
    name: 'End Products & Pricing',
    icon: ShoppingBag,
    color: 'border-amber-500 bg-amber-500/10 text-amber-500',
    description: 'End Products are what customers buy. Each product links to a Product BOM (what\'s inside) and a Shipping BOM (how it ships). Pricing can be manual or multiplier-based.',
    details: [
      'Product categories: One-Time Decant, Subscription Box, Box Bundle, Em Set, Aura Play, Full Bottle, Custom',
      'Each product has a SKU, Shopify Product ID, and linked BOMs',
      'Fixed Price = base cost (components + labor), Variable Price = per-order adjustments',
      'Selling Price can be set manually or via a cost multiplier (e.g., 2.5x COGS)',
      'Tags for filtering and organization (seasonal, limited edition, etc.)',
      'Active/inactive toggle for product lifecycle management',
    ],
    tips: [
      'Always link both a Product BOM and Shipping BOM for accurate cost tracking',
      'Use the multiplier method for consistent margins across your catalog',
      'Review the Inventory Impact report to see how products affect stock levels',
      'Deactivate products instead of deleting — this preserves order history',
    ],
    link: '/bom/products',
  },
  {
    name: 'Subscription Management',
    icon: Repeat,
    color: 'border-violet-500 bg-violet-500/10 text-violet-500',
    description: 'Manage recurring subscription cycles. Each cycle collects orders, locks at cutoff, creates a production job, and flows through the pod pipeline. Tiers: Grand Master 1 (1 vial), Grand Master 2 (2 vials), Grand Master 3 (3 vials), Grand Master 4 (4 vials).',
    details: [
      'Cycle lifecycle: Collecting → Locked → Job Created → Processing → QC → Shipping → Completed',
      'Lock the cycle at cutoff date — no more orders can be added after locking',
      'Auto-calculates perfumes needed based on subscriber selections',
      'Creates a fulfillment job automatically when the cycle is locked',
      'Timeline configuration: set processing days per cycle (default 7 days)',
      'Subscriber management: view, pause, cancel, upgrade tier',
    ],
    tips: [
      'Lock cycles 2-3 days before the target ship date to allow production time',
      'Review "Perfumes Needed" before locking to ensure sufficient inventory',
      'First-time subscribers get a separate job tag for welcome kit inclusion',
      'Use the timeline config to adjust processing days based on order volume',
    ],
    link: '/subscriptions',
  },
  {
    name: 'Capsule Drops',
    icon: Sparkles,
    color: 'border-pink-500 bg-pink-500/10 text-pink-500',
    description: 'Limited-edition themed sets released periodically. Capsules are pre-built products that go through RTS Production — they\'re produced in advance and stored as ready-to-ship inventory.',
    details: [
      'Types: Themed Set, House Chapter, Layering Set',
      'Each drop has a launch date, end date, max allocation, and pricing',
      'Items within a drop are linked to master perfumes with specific sizes and quantities',
      'Status flow: Draft → Scheduled → Live → Sold Out → Ended',
      'Revenue tracking per drop with sold count and allocation remaining',
      'Production uses "RTS Production" job tag — Production Pod only, no Fulfillment Pod',
    ],
    tips: [
      'Create the capsule drop first, then create an RTS Production job to build the inventory',
      'Set max allocation based on available perfume inventory — check the Decanting Pool',
      'Schedule drops in advance and use the "Scheduled" status for marketing coordination',
      'Capsule production is internal — it doesn\'t need a Fulfillment Pod',
    ],
    link: '/capsules',
  },
  {
    name: 'Em Vault Exclusives',
    icon: Gem,
    color: 'border-gold bg-gold/10 text-gold',
    description: 'Monthly exclusive releases for VIP members. Access-controlled with request/approval flow. Like capsules, these are pre-built via RTS Production.',
    details: [
      'Monthly releases with theme, access code, and limited SKUs',
      'Access request flow: customers request → admin approves/denies',
      'Each release has up to 8 SKUs with individual allocation and pricing',
      'Status flow: Draft → Scheduled → Live → Ended',
      'Revenue and request tracking per release',
      'Production uses "RTS Production" job tag — same as capsules',
    ],
    tips: [
      'Use access codes to control who can purchase vault exclusives',
      'Set allocations conservatively — scarcity drives demand',
      'Review access requests promptly to maintain customer satisfaction',
      'Em Vault items are premium — price accordingly with higher margins',
    ],
    link: '/em-vault',
  },
  {
    name: 'Gifting',
    icon: Gift,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    description: 'Gift sets, gift subscriptions, gift cards, and corporate gifting. Each has its own management flow and connects to the order pipeline.',
    details: [
      'Gift Sets: Pre-built or custom sets with wrapping and personalization options',
      'Gift Subscriptions: 3, 6, or 12-month subscription gifts across all tiers',
      'Gift Cards: Digital cards with balance tracking and expiration',
      'Corporate Gifting: Inquiry → Quote → Approval → Fulfillment pipeline',
      'All gift orders flow through the standard job pipeline for production',
      'Revenue tracking per gift category',
    ],
    tips: [
      'Corporate gifting inquiries should be responded to within 24 hours',
      'Gift subscriptions create recurring orders — they flow into subscription cycles',
      'Gift cards are digital-only — no physical production needed',
      'Pre-built gift sets should be produced as RTS inventory for fast shipping',
    ],
    link: '/gifting',
  },
];

export default function ProductsGuide() {
  const [, setLocation] = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Products, BOM & Catalog Guide"
        subtitle="How to set up products, BOMs, subscriptions, capsules, vault exclusives, and gifting"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Products & BOM' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Package className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Product Architecture</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Maison Em's product system is built on <strong>BOMs (Bills of Materials)</strong> that define what goes into each product.
                  Products connect to the <strong>Inventory</strong> system for stock tracking and to the <strong>Operations</strong> system for
                  production. Everything from a single decant to a corporate gift box follows the same BOM → Product → Order → Job pipeline.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Flow */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              Product Setup Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="border border-blue-500/30 bg-blue-500/10 rounded-xl p-3 text-center min-w-[200px]">
                <p className="font-semibold text-sm">1. Create Components</p>
                <p className="text-[10px] text-muted-foreground">Perfumes, atomizers, boxes, labels</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
              <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-3 text-center min-w-[200px]">
                <p className="font-semibold text-sm">2. Build BOM Templates</p>
                <p className="text-[10px] text-muted-foreground">Recipe: which components, how many</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
              <div className="border border-violet-500/30 bg-violet-500/10 rounded-xl p-3 text-center min-w-[200px]">
                <p className="font-semibold text-sm">3. Create End Products</p>
                <p className="text-[10px] text-muted-foreground">Link BOM + set pricing + SKU</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
              <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-3 text-center min-w-[200px]">
                <p className="font-semibold text-sm">4. Orders & Production</p>
                <p className="text-[10px] text-muted-foreground">Orders → Jobs → Pod Pipeline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gold" />
            Detailed Module Guide
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

        {/* How Modules Connect */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
              <Workflow className="w-5 h-5 text-gold" />
              How Modules Connect
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><strong>BOM → Products:</strong> BOMs define the recipe; Products use BOMs to calculate costs and drive picking lists during production.</p>
              <p><strong>Products → Orders:</strong> When a customer orders a product, the system knows exactly what components are needed via the linked BOM.</p>
              <p><strong>Orders → Jobs:</strong> Orders are grouped and converted to jobs via Order Grouping. Jobs carry the BOM requirements forward.</p>
              <p><strong>Jobs → Pods:</strong> Jobs enter the Production Queue and are picked by pods. The pod's pipeline processes each BOM step.</p>
              <p><strong>Inventory → BOM:</strong> Component stock levels in Packaging & Materials and the Decanting Pool determine what can be produced.</p>
              <p><strong>Subscriptions → Jobs:</strong> Locked subscription cycles auto-create jobs tagged "Subscription" that flow into the pod pipeline.</p>
              <p><strong>Capsules & Vault → RTS:</strong> These are pre-built via "RTS Production" jobs — produced and stored for instant fulfillment.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
