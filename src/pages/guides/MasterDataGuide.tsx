// ============================================================
// Setup Guide — Master Data
// Explains the master data entities, relationships, and setup order
// ============================================================

import { useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Database, BookOpen, Building2, Layers, Tag, Shield, MapPin,
  Pipette, PackageOpen, ArrowRight, ArrowDown, CheckCircle2,
  Lightbulb, ChevronDown, ChevronUp, Workflow, AlertCircle,
  Droplets, Users, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface MasterEntity {
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  fields: string[];
  setupOrder: number;
  dependencies: string[];
  link: string;
}

const entities: MasterEntity[] = [
  {
    name: 'Brands',
    icon: Building2,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    description: 'Perfume houses and manufacturers. Every perfume belongs to a brand.',
    fields: ['Brand name', 'Country of origin', 'Logo/image', 'Description', 'Active status'],
    setupOrder: 1,
    dependencies: [],
    link: '/master/brands',
  },
  {
    name: 'Fragrance Families',
    icon: Tag,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    description: 'Classification system for perfumes (e.g., Woody, Floral, Oriental, Fresh). Used for filtering and discovery.',
    fields: ['Family name', 'Description', 'Icon/color', 'Parent family (optional)'],
    setupOrder: 2,
    dependencies: [],
    link: '/master/families',
  },
  {
    name: 'Aura Definitions',
    icon: Layers,
    color: 'border-gold bg-gold/10 text-gold',
    description: 'The 7 Auras — Maison Em\'s proprietary mood/energy framework. Each perfume maps to one or more auras.',
    fields: ['Aura name', 'Color code', 'Description', 'Mood keywords', 'Icon'],
    setupOrder: 3,
    dependencies: [],
    link: '/master/auras',
  },
  {
    name: 'Colors',
    icon: Layers,
    color: 'border-rose-500 bg-rose-500/10 text-rose-500',
    description: 'Central color palette used by Aura Definitions and perfume aura selection inputs.',
    fields: ['Color name', 'Hex code'],
    setupOrder: 4,
    dependencies: [],
    link: '/master/colors',
  },
  {
    name: 'Filters & Tags',
    icon: Shield,
    color: 'border-purple-500 bg-purple-500/10 text-purple-500',
    description: 'Custom filters for perfume discovery: season, occasion, intensity, gender, notes, etc.',
    fields: ['Filter group name', 'Filter values', 'Display order', 'Active status'],
    setupOrder: 5,
    dependencies: [],
    link: '/master/filters',
  },
  {
    name: 'Perfume Master',
    icon: Droplets,
    color: 'border-amber-600 bg-amber-600/10 text-amber-600',
    description: 'The central perfume database. Each entry represents a unique perfume with all its metadata, pricing, and classification.',
    fields: [
      'Perfume Master ID (auto-generated)', 'Name', 'Brand (from Brands)', 'Concentration (EDP, EDT, etc.)',
      'Fragrance family', 'Aura mapping', 'Notes (top, heart, base)', 'Filters & tags',
      'Cost per ml', 'Retail price', 'Available sizes', 'Image', 'Description',
    ],
    setupOrder: 6,
    dependencies: ['Brands', 'Fragrance Families', 'Aura Definitions', 'Filters & Tags'],
    link: '/master/perfumes',
  },
  {
    name: 'Vault Locations',
    icon: MapPin,
    color: 'border-cyan-500 bg-cyan-500/10 text-cyan-500',
    description: 'Physical shelf/rack locations in your vault. Used for inventory placement and picking routes.',
    fields: ['Location code (e.g., A1-S3)', 'Zone', 'Shelf', 'Capacity', 'Type (bottles, packaging, etc.)'],
    setupOrder: 7,
    dependencies: [],
    link: '/master/locations',
  },
  {
    name: 'Syringes Registry',
    icon: Pipette,
    color: 'border-pink-500 bg-pink-500/10 text-pink-500',
    description: 'Syringe sizes used for decanting. The BOM auto-selects the correct syringe based on vial size.',
    fields: ['Syringe size (ml)', 'Compatible vial sizes', 'Needle type', 'Active status'],
    setupOrder: 8,
    dependencies: [],
    link: '/master/syringes',
  },
  {
    name: 'Packaging SKUs',
    icon: PackageOpen,
    color: 'border-teal-500 bg-teal-500/10 text-teal-500',
    description: 'Master list of all packaging and material SKUs. Links to BOM components and inventory tracking.',
    fields: [
      'SKU ID (auto-generated)', 'Name', 'Category', 'Size spec', 'Color variant',
      'Unit', 'Unit cost', 'Supplier', 'Reorder point', 'Active status',
    ],
    setupOrder: 9,
    dependencies: ['Vault Locations'],
    link: '/master/packaging-skus',
  },
  {
    name: 'Pricing Rules',
    icon: DollarSign,
    color: 'border-rose-500 bg-rose-500/10 text-rose-500',
    description: 'Pricing tiers and rules for different product types, sizes, and customer segments.',
    fields: ['Rule name', 'Product category', 'Size', 'Base price', 'Multiplier', 'Effective date'],
    setupOrder: 10,
    dependencies: ['Perfume Master', 'Packaging SKUs'],
    link: '/master/pricing',
  },
  {
    name: 'Suppliers',
    icon: Users,
    color: 'border-indigo-500 bg-indigo-500/10 text-indigo-500',
    description: 'Supplier directory for procurement. Each supplier has contact info, lead times, and payment terms.',
    fields: ['Company name', 'Contact person', 'Email', 'Phone', 'Categories supplied', 'Lead time', 'Payment terms', 'Currency'],
    setupOrder: 11,
    dependencies: [],
    link: '/master/suppliers',
  },
];

export default function MasterDataGuide() {
  const [, setLocation] = useLocation();
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  const sorted = [...entities].sort((a, b) => a.setupOrder - b.setupOrder);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Master Data Guide"
        subtitle="Understanding the master data entities, their relationships, and the recommended setup order"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Setup Guides' },
          { label: 'Master Data' },
        ]}
      />

      <div className="p-6 space-y-8">
        {/* Overview */}
        <Card className="border-gold/20 bg-gradient-to-r from-gold/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                <Database className="w-7 h-7 text-gold" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Master Data Architecture</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Master Data is the foundation of the entire system. It defines <strong>what you sell</strong> (perfumes, products),
                  <strong> what you use</strong> (packaging, syringes), <strong>where things are</strong> (locations),
                  and <strong>who you buy from</strong> (suppliers). Set up master data first — everything else depends on it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Setup Order */}
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-info shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm mb-1">Recommended Setup Order</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Some entities depend on others. Follow this order to avoid missing references:
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {sorted.map((e, idx) => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <Badge variant="outline" className={cn('text-[10px] gap-1', e.color.split(' ').find(c => c.startsWith('text-')))}>
                        <span className="font-bold">{e.setupOrder}.</span> {e.name}
                      </Badge>
                      {idx < sorted.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entity Cards */}
        <div>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Master Data Entities
          </h3>
          <div className="space-y-3">
            {sorted.map(entity => {
              const isExpanded = expandedEntity === entity.name;
              const Icon = entity.icon;

              return (
                <Card key={entity.name} className={cn('border-border/60 transition-all', isExpanded && 'ring-1 ring-gold/30')}>
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpandedEntity(isExpanded ? null : entity.name)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
                    >
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border', entity.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{entity.name}</h4>
                          <Badge variant="outline" className="text-[9px]">Step {entity.setupOrder}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{entity.description}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                        <div>
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Fields</h5>
                          <div className="flex flex-wrap gap-1.5">
                            {entity.fields.map(field => (
                              <Badge key={field} variant="outline" className="text-[10px]">{field}</Badge>
                            ))}
                          </div>
                        </div>

                        {entity.dependencies.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Depends On</h5>
                            <div className="flex flex-wrap gap-1.5">
                              {entity.dependencies.map(dep => (
                                <Badge key={dep} variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">{dep}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button variant="outline" size="sm" onClick={() => setLocation(entity.link)} className="gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5" /> Go to {entity.name}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Best Practices */}
        <Card className="border-gold/20 bg-gold/5">
          <CardContent className="p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-gold" />
              Master Data Best Practices
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                'Set up Brands, Families, and Auras before adding perfumes — they are referenced fields',
                'Use consistent naming conventions (e.g., "Maison Francis Kurkdjian" not "MFK")',
                'Keep Packaging SKUs in sync with BOM Components for accurate cost tracking',
                'Review and update pricing rules quarterly as supplier costs change',
                'Maintain vault locations to match your physical shelf layout',
                'Add images to perfumes and packaging for visual identification during operations',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  {tip}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
