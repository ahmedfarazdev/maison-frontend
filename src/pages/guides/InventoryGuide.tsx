// ============================================================
// Setup Guide — Inventory Management
// Explains the 4 inventory pools, stock flow, and reconciliation
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Package, Warehouse, Box, Droplets, PackageOpen, ArrowRight,
  ArrowDown, CheckCircle2, AlertCircle, Lightbulb, ChevronDown,
  ChevronUp, BarChart2, RefreshCcw, BookOpen, Workflow, ScanBarcode,
  TrendingDown, TrendingUp, Shield, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface PoolInfo {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  whatItTracks: string[];
  keyActions: string[];
  tips: string[];
  link: string;
}

const pools: PoolInfo[] = [
  {
    name: 'Sealed Vault (Bottle Inventory)',
    icon: Box,
    color: 'border-amber-500 bg-amber-500/10 text-amber-500',
    description: 'Tracks sealed, unopened full bottles. This is your primary asset store — bottles are purchased from suppliers and stored here until opened for decanting.',
    whatItTracks: [
      'Full bottles by perfume, brand, size, and batch',
      'Purchase cost per bottle (landed cost including shipping)',
      'Shelf location and barcode',
      'Status: Sealed, Opened, Empty, Reserved',
      'Remaining volume for opened bottles',
    ],
    keyActions: [
      'Receive new stock from Purchase Orders → bottles enter as "Sealed"',
      'Open a bottle for decanting → status changes to "Opened", volume tracking begins',
      'Record decanting volume → remaining ml decreases',
      'Mark as Empty when fully decanted → triggers reorder alert',
    ],
    tips: [
      'Always receive bottles through the Purchase Order flow so cost is tracked automatically',
      'Use barcode scanning for fast identification during decanting',
      'Set reorder points per perfume to get alerts before running out',
      'The "cost per ml" is auto-calculated from bottle cost ÷ total volume',
    ],
    link: '/inventory/sealed-vault',
  },
  {
    name: 'Decanting Pool',
    icon: Droplets,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    description: 'Tracks the ml available for decanting from opened bottles. When a bottle is opened, its volume enters the Decanting Pool. As vials are filled, the pool decreases.',
    whatItTracks: [
      'Available ml per perfume from opened bottles',
      'Source bottle reference (which bottle the ml came from)',
      'Decanting history (who decanted, when, how much)',
      'Cost per ml inherited from source bottle',
    ],
    keyActions: [
      'Auto-populated when a bottle is opened in Sealed Vault',
      'Decreases as Station 4 (Batch Decanting) records fills',
      'Manual adjustment for spillage or quality control waste',
      'Pool alerts when available ml drops below threshold',
    ],
    tips: [
      'The Decanting Pool is a virtual inventory — it represents ml available, not physical containers',
      'Always record actual ml decanted (not theoretical) for accurate cost tracking',
      'Account for ~5% waste/spillage in your planning',
      'Use the pool view to see which perfumes have enough ml for upcoming batches',
    ],
    link: '/inventory/decanting-pool',
  },
  {
    name: 'Packaging & Materials',
    icon: PackageOpen,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    description: 'Tracks all non-perfume physical items: atomizers, vials, boxes, labels, inserts, accessories, shipping materials. These are the BOM components.',
    whatItTracks: [
      'Quantity on hand per SKU',
      'Unit cost and total value',
      'Reorder point and supplier lead time',
      'Category: Atomizer, Packaging, Insert, Accessory, Label, Shipping',
      'Barcode and shelf location',
    ],
    keyActions: [
      'Receive stock from Purchase Orders → quantity increases',
      'BOM picking at Station 2 → quantity decreases',
      'Manual adjustment for damaged/lost items',
      'Reorder alerts when stock falls below reorder point',
    ],
    tips: [
      'Link Packaging SKUs to BOM Components for automatic cost sync',
      'Set realistic reorder points based on average monthly usage',
      'Group items by shelf location for efficient picking',
      'Conduct monthly spot checks on high-value items (atomizers, branded boxes)',
    ],
    link: '/inventory/packaging',
  },
  {
    name: 'Stock Registry (Station 0)',
    icon: Warehouse,
    color: 'border-purple-500 bg-purple-500/10 text-purple-500',
    description: 'The master receiving dock. All incoming shipments are first logged here before being distributed to their respective inventory pools.',
    whatItTracks: [
      'Incoming shipment records with PO reference',
      'Receiving inspection results (QC check)',
      'Distribution to Sealed Vault or Packaging & Materials',
      'Discrepancy notes (damaged, short-shipped, wrong items)',
    ],
    keyActions: [
      'Receive shipment → scan/count items against PO',
      'QC inspection → flag damaged or incorrect items',
      'Distribute → move bottles to Sealed Vault, materials to Packaging',
      'Close receiving → PO status updates to "Received"',
    ],
    tips: [
      'Always receive against a Purchase Order for audit trail',
      'Photograph any damaged items before accepting the shipment',
      'Count items before signing the courier receipt',
      'Use the barcode scanner to speed up receiving for large shipments',
    ],
    link: '/stations/0-stock-register',
  },
];

export default function InventoryGuide() {
  const [, setLocation] = useLocation();
  const [expandedPool, setExpandedPool] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Inventory Management Guide"
        subtitle="Understanding the 4 inventory pools, stock flow, and reconciliation process"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Inventory' },
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
                <h2 className="text-xl font-bold mb-2">Inventory Architecture</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Maison Em's inventory is organized into <strong>4 distinct pools</strong>, each tracking a different type of asset.
                  Stock flows from suppliers through the Stock Registry, into the Sealed Vault and Packaging pools,
                  and eventually through the decanting stations as orders are fulfilled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flow Diagram */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="w-5 h-5 text-info" />
              Stock Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="border border-purple-500/30 bg-purple-500/10 rounded-xl p-4 text-center min-w-[200px]">
                <Warehouse className="w-8 h-8 mx-auto mb-1 text-purple-500" />
                <p className="font-semibold text-sm">Stock Registry</p>
                <p className="text-[10px] text-muted-foreground">Receiving & QC</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl p-4 text-center min-w-[180px]">
                  <Box className="w-7 h-7 mx-auto mb-1 text-amber-500" />
                  <p className="font-semibold text-sm">Sealed Vault</p>
                  <p className="text-[10px] text-muted-foreground">Full bottles</p>
                </div>
                <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 text-center min-w-[180px]">
                  <PackageOpen className="w-7 h-7 mx-auto mb-1 text-emerald-500" />
                  <p className="font-semibold text-sm">Packaging & Materials</p>
                  <p className="text-[10px] text-muted-foreground">Atomizers, boxes, labels...</p>
                </div>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
              <div className="border border-blue-500/30 bg-blue-500/10 rounded-xl p-4 text-center min-w-[200px]">
                <Droplets className="w-8 h-8 mx-auto mb-1 text-blue-500" />
                <p className="font-semibold text-sm">Decanting Pool</p>
                <p className="text-[10px] text-muted-foreground">Available ml from opened bottles</p>
              </div>
              <ArrowDown className="w-5 h-5 text-muted-foreground" />
              <div className="border border-gold/30 bg-gold/10 rounded-xl p-4 text-center min-w-[200px]">
                <ScanBarcode className="w-8 h-8 mx-auto mb-1 text-gold" />
                <p className="font-semibold text-sm">Decanting Stations</p>
                <p className="text-[10px] text-muted-foreground">Orders fulfilled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pool Details */}
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Inventory Pools
          </h3>
          <div className="space-y-4">
            {pools.map(pool => {
              const isExpanded = expandedPool === pool.name;
              const Icon = pool.icon;

              return (
                <Card key={pool.name} className={cn('border-border/60 transition-all', isExpanded && 'ring-1 ring-gold/30')}>
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedPool(isExpanded ? null : pool.name)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border', pool.color)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{pool.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{pool.description}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What It Tracks</h5>
                            <ul className="space-y-1">
                              {pool.whatItTracks.map((item, i) => (
                                <li key={i} className="text-sm flex items-start gap-1.5">
                                  <BarChart2 className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Actions</h5>
                            <ul className="space-y-1">
                              {pool.keyActions.map((action, i) => (
                                <li key={i} className="text-sm flex items-start gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
                          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-gold" /> Best Practices
                          </h5>
                          <ul className="space-y-1.5">
                            {pool.tips.map((tip, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <span className="text-gold font-bold text-xs mt-0.5">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => setLocation(pool.link)} className="gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5" /> Go to {pool.name.split('(')[0].trim()}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Reconciliation */}
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <RefreshCcw className="w-6 h-6 text-info shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">Stock Reconciliation</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Periodic reconciliation ensures your system inventory matches physical counts. Run reconciliation monthly for
                  high-value items (perfume bottles) and quarterly for packaging materials.
                </p>
                <Button variant="outline" size="sm" onClick={() => setLocation('/inventory/reconciliation')} className="gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5" /> Go to Stock Reconciliation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
