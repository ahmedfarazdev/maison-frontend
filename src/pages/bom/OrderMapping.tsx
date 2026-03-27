// ============================================================
// Order → BOM Resolution — Auto-resolved read-only view
// Shows how incoming orders automatically resolve to BOMs
// via End Product → BOM Template linkage (no manual mapping)
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, KPICard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Link2, ShoppingCart, Package, Layers, ArrowRight, CheckCircle2,
  AlertTriangle, Search, Settings2, Droplets, RotateCcw,
  Box, Sparkles, ClipboardList, Printer, Download, Eye,
  Info, ArrowDown, Zap, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { endProducts, bomTemplates, bomComponents, generateBOMPickList } from '@/lib/bom-data';
import type { EndProduct, BOMTemplate, BOMPickListItem, EndProductCategory } from '@/types';
import { categoryConfig } from '@/lib/product-categories';

export default function OrderMapping() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [previewProduct, setPreviewProduct] = useState<EndProduct | null>(null);
  const [pickingPreview, setPickingPreview] = useState<BOMPickListItem[] | null>(null);

  // Build resolution table from end products
  const resolutionTable = useMemo(() => {
    return endProducts.map(product => {
      const bom = product.bom_id
        ? bomTemplates.find(b => b.bom_id === product.bom_id) || null
        : null;
      return { product, bom, resolved: !!bom };
    });
  }, []);

  const filtered = useMemo(() => {
    return resolutionTable.filter(entry => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        entry.product.name.toLowerCase().includes(q) ||
        entry.product.sku.toLowerCase().includes(q) ||
        (entry.product.shopify_product_id || '').toLowerCase().includes(q) ||
        (entry.bom?.name || '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'all' || entry.product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [resolutionTable, search, categoryFilter]);

  const stats = useMemo(() => ({
    totalProducts: endProducts.length,
    resolved: resolutionTable.filter(e => e.resolved).length,
    unresolved: resolutionTable.filter(e => !e.resolved).length,
    bomTemplates: bomTemplates.filter(b => b.bom_id !== 'bom-shipping-base').length,
  }), [resolutionTable]);

  const handlePreviewPicking = (product: EndProduct) => {
    if (!product.bom_id) { toast.error('No BOM linked to this product'); return; }
    const pickList = generateBOMPickList([{ order_id: 'preview-1', type: product.category }]);
    setPickingPreview(pickList);
    setPreviewProduct(product);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Order → BOM Resolution"
        subtitle="Read-only view showing how incoming orders auto-resolve to BOM templates via End Product linkage"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM', href: '/bom/setup' },
          { label: 'Order Resolution' },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* How It Works Banner */}
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-info" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">How Order → BOM Resolution Works</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Orders are <strong>dynamic</strong> — any customer can order any combination of products. There is no need to manually map orders to BOMs.
                  Instead, each <strong>End Product</strong> is linked to a <strong>BOM Template</strong> in the Products tab. When an order arrives from Shopify/Next.js,
                  the system identifies the products in the order (via Shopify Product ID), looks up each product's BOM, and auto-generates the combined picking list.
                </p>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 bg-background/80 rounded-md px-2.5 py-1.5 border border-border/50">
                    <ShoppingCart className="w-3.5 h-3.5" /> Shopify Order
                  </div>
                  <ArrowRight className="w-4 h-4" />
                  <div className="flex items-center gap-1.5 bg-background/80 rounded-md px-2.5 py-1.5 border border-border/50">
                    <Package className="w-3.5 h-3.5" /> End Product(s)
                  </div>
                  <ArrowRight className="w-4 h-4" />
                  <div className="flex items-center gap-1.5 bg-background/80 rounded-md px-2.5 py-1.5 border border-border/50">
                    <Layers className="w-3.5 h-3.5 text-gold" /> BOM Template(s)
                  </div>
                  <ArrowRight className="w-4 h-4" />
                  <div className="flex items-center gap-1.5 bg-background/80 rounded-md px-2.5 py-1.5 border border-border/50">
                    <ClipboardList className="w-3.5 h-3.5 text-info" /> Picking List
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="End Products" value={stats.totalProducts} icon={Package} variant="default" />
          <KPICard label="BOM Resolved" value={stats.resolved} icon={CheckCircle2} variant="success" />
          <KPICard label="Unresolved" value={stats.unresolved} icon={AlertTriangle} variant={stats.unresolved > 0 ? 'warning' : 'default'} />
          <KPICard label="BOM Templates" value={stats.bomTemplates} icon={Layers} variant="gold" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search products, SKUs, Shopify IDs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resolution Table */}
        <div className="border border-border/60 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="bg-muted/30 px-4 py-3 grid grid-cols-12 gap-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div className="col-span-3">Product</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Shopify ID</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-2">BOM Template</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/30">
            {filtered.map(entry => {
              const cat = categoryConfig[entry.product.category];
              const CatIcon = cat?.icon || Package;

              return (
                <div
                  key={entry.product.product_id}
                  className={cn(
                    'px-4 py-3 grid grid-cols-12 gap-3 items-center transition-colors hover:bg-muted/20',
                    !entry.resolved && 'bg-warning/5',
                  )}
                >
                  {/* Product */}
                  <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                    {entry.product.image_url ? (
                      <img src={entry.product.image_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <CatIcon className={cn('w-4 h-4', cat?.color)} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entry.product.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{entry.product.sku}</p>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    <Badge variant="outline" className={cn('text-[10px] gap-1', cat?.color)}>
                      <CatIcon className="w-3 h-3" /> {cat?.label}
                    </Badge>
                  </div>

                  {/* Shopify ID */}
                  <div className="col-span-2">
                    {entry.product.shopify_product_id ? (
                      <span className="text-xs font-mono text-muted-foreground">{entry.product.shopify_product_id}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 italic">Not set</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex justify-center">
                    {entry.resolved ? (
                      <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center" title="BOM Resolved">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-warning/10 flex items-center justify-center" title="No BOM linked">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                      </div>
                    )}
                  </div>

                  {/* BOM Template */}
                  <div className="col-span-2 min-w-0">
                    {entry.bom ? (
                      <div>
                        <p className="text-sm font-medium truncate">{entry.bom.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {entry.bom.line_items.length} components · AED {entry.bom.total_cost.toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-warning">No BOM linked</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-1.5">
                    {entry.resolved && (
                      <Button variant="outline" size="sm" onClick={() => handlePreviewPicking(entry.product)} className="gap-1 text-xs h-7 px-2">
                        <ClipboardList className="w-3 h-3" /> Preview
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.location.href = '/bom/setup';
                        toast.info('Edit product BOM linkage in the Products tab');
                      }}
                      className="gap-1 text-xs h-7 px-2"
                    >
                      <Settings2 className="w-3 h-3" /> Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="p-8">
              <EmptyState icon={Link2} title="No products match your search" description="Try adjusting your filters." />
            </div>
          )}
        </div>

        {/* Info Footer */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>To link a product to a BOM:</strong> Go to <strong>BOM Setup → Products</strong> tab, edit the product, and select a BOM Template.</p>
                <p><strong>To set the Shopify Product ID:</strong> Edit the product and enter the Shopify/Next.js Product ID at the top of the form.</p>
                <p>When an order arrives, the system matches Shopify Product IDs to End Products, then resolves each product's BOM to generate a combined picking list.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Picking List Preview */}
        {pickingPreview && previewProduct && (
          <PickingListPreviewDialog
            product={previewProduct}
            pickingList={pickingPreview}
            onClose={() => { setPickingPreview(null); setPreviewProduct(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ---- Picking List Preview Dialog ----
function PickingListPreviewDialog({ product, pickingList, onClose }: {
  product: EndProduct;
  pickingList: BOMPickListItem[];
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, BOMPickListItem[]>();
    for (const item of pickingList) {
      const cat = item.component.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [pickingList]);

  const categoryLabels: Record<string, string> = {
    perfume: 'Perfumes', atomizer: 'Atomizers & Vials', packaging: 'Packaging',
    insert: 'Inserts & Cards', accessory: 'Accessories', label: 'Labels', shipping: 'Shipping Materials',
  };

  const handleExportCSV = () => {
    const rows = pickingList.map(item => ({
      Component: item.component.name,
      Category: item.component.category,
      Qty: item.total_qty_needed,
      Unit: item.component.unit,
      Variable: item.component.is_variable ? 'Yes' : 'No',
    }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `picking-list-${product.name.replace(/\s+/g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-info" />
            Picking List Preview — {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              Auto-generated picking list for <strong>1 unit</strong> of <strong>{product.name}</strong>.
              In production, quantities scale with order count.
            </p>
          </div>

          {Array.from(grouped).map(([cat, items]) => (
            <div key={cat} className="border border-border/50 rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                <h5 className="text-xs font-semibold uppercase tracking-wider">{categoryLabels[cat] || cat}</h5>
                <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-border/30">
                {items.map((item, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    {item.component.image_url ? (
                      <img src={item.component.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className={cn(
                        'w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0',
                        item.component.is_variable ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground',
                      )}>
                        {item.total_qty_needed}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.component.name}</span>
                      {item.component.is_variable && (
                        <Badge variant="outline" className="ml-2 text-[9px] bg-gold/10 text-gold border-gold/30">Variable</Badge>
                      )}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">× {item.total_qty_needed} {item.component.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Print
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
