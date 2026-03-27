// ============================================================
// BOM Setup — End Products Registry + BOM Designer
// Tabs: Products | BOM Templates | Visual Designer | Shipping BOM
// All forms are functional (local state) — Add, View, Edit, Duplicate, Archive
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, KPICard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Package, Plus, Search, Edit, Copy, Archive, Eye, Layers,
  Box, Droplets, Tag, Sparkles, RotateCcw, ShoppingCart,
  DollarSign, Hash, CheckCircle2, AlertTriangle, Truck,
  Trash2, Settings2, Image, Save, X, ChevronDown, ChevronRight,
  GripVertical, Gift, Building2, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  endProducts as initialEndProducts,
  bomTemplates as initialBomTemplates,
  bomComponents,
  shippingBOMs as initialShippingBOMs,
  componentCategoryLabels,
} from '@/lib/bom-data';
import type {
  EndProduct, BOMTemplate, BOMLineItem, EndProductCategory,
  BOMStatus, BOMComponentCategory, BOMComponent,
} from '@/types';
import { END_PRODUCT_CATEGORY_CODES } from '@/types';
import { categoryConfig } from '@/lib/product-categories';

const bomStatusConfig: Record<BOMStatus, { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  active: { label: 'Active', variant: 'success' },
  draft: { label: 'Draft', variant: 'warning' },
  archived: { label: 'Archived', variant: 'muted' },
};

const categoryColors: Record<string, string> = {
  perfume: 'border-l-gold bg-gold/5',
  atomizer: 'border-l-info bg-info/5',
  packaging: 'border-l-success bg-success/5',
  insert: 'border-l-purple-500 bg-purple-500/5',
  accessory: 'border-l-pink-500 bg-pink-500/5',
  label: 'border-l-amber-500 bg-amber-500/5',
  shipping: 'border-l-blue-500 bg-blue-500/5',
};

// ============================================================
// End Products Tab — with working Add/Edit forms
// ============================================================
function EndProductsTab({
  products, setProducts, bomTemplates, shippingBOMs,
}: {
  products: EndProduct[];
  setProducts: React.Dispatch<React.SetStateAction<EndProduct[]>>;
  bomTemplates: BOMTemplate[];
  shippingBOMs: BOMTemplate[];
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<EndProduct | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<EndProduct | null>(null);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.active).length,
    withBOM: products.filter(p => p.bom_id).length,
    categories: new Set(products.map(p => p.category)).size,
  }), [products]);

  const handleSaveProduct = (product: EndProduct) => {
    const exists = products.find(p => p.product_id === product.product_id);
    if (exists) {
      setProducts(prev => prev.map(p => p.product_id === product.product_id ? product : p));
      toast.success(`Updated "${product.name}"`);
    } else {
      setProducts(prev => [...prev, product]);
      toast.success(`Created "${product.name}"`);
    }
    setShowAddDialog(false);
    setEditProduct(null);
  };

  const handleArchiveProduct = (productId: string) => {
    setProducts(prev => prev.map(p => p.product_id === productId ? { ...p, active: false } : p));
    toast.success('Product archived');
    setSelectedProduct(null);
  };

  const handleDuplicateProduct = (product: EndProduct) => {
    const newProduct: EndProduct = {
      ...product,
      product_id: `ep-${Date.now()}`,
      name: `${product.name} (Copy)`,
      sku: `${product.sku}-COPY`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setProducts(prev => [...prev, newProduct]);
    toast.success(`Duplicated "${product.name}"`);
    setSelectedProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Products" value={stats.total} icon={Package} variant="default" />
        <KPICard label="Active" value={stats.active} icon={CheckCircle2} variant="success" />
        <KPICard label="With BOM" value={stats.withBOM} icon={Layers} variant="gold" />
        <KPICard label="Categories" value={stats.categories} icon={Tag} variant="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(product => {
          const cat = categoryConfig[product.category];
          const CatIcon = cat.icon;
          const linkedBOM = bomTemplates.find(b => b.bom_id === product.bom_id);

          return (
            <Card
              key={product.product_id}
              className="group hover:shadow-md transition-all cursor-pointer border-border/60"
              onClick={() => setSelectedProduct(product)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  {/* Product Image */}
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-14 h-14 rounded-lg object-cover border border-border/50"
                    />
                  ) : (
                    <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center bg-muted/50', cat.color)}>
                      <CatIcon className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{product.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                      </div>
                      <StatusBadge variant={product.active ? 'success' : 'muted'}>
                        {product.active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{product.description}</p>

                {/* Tags */}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {cat.label}
                    </Badge>
                    {product.fixed_price != null && (
                      <span className="text-xs font-medium text-muted-foreground">
                        AED {product.fixed_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {linkedBOM ? (
                    <div className="flex items-center gap-1 text-xs text-success">
                      <Layers className="w-3.5 h-3.5" />
                      <span className="font-medium">BOM Linked</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-medium">No BOM</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={Package} title="No products found" description="Try adjusting your search or category filter." />
      )}

      {/* View Product Detail Dialog */}
      {selectedProduct && !editProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          bomTemplates={bomTemplates}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => { setEditProduct(selectedProduct); setSelectedProduct(null); }}
          onDuplicate={() => handleDuplicateProduct(selectedProduct)}
          onArchive={() => handleArchiveProduct(selectedProduct.product_id)}
        />
      )}

      {/* Add Product Dialog */}
      {showAddDialog && (
        <ProductFormDialog
          bomTemplates={bomTemplates}
          shippingBOMs={shippingBOMs}
          onSave={handleSaveProduct}
          onClose={() => setShowAddDialog(false)}
        />
      )}

      {/* Edit Product Dialog */}
      {editProduct && (
        <ProductFormDialog
          product={editProduct}
          bomTemplates={bomTemplates}
          shippingBOMs={shippingBOMs}
          onSave={handleSaveProduct}
          onClose={() => setEditProduct(null)}
        />
      )}
    </div>
  );
}

// ---- Product Detail Dialog ----
function ProductDetailDialog({
  product, bomTemplates, onClose, onEdit, onDuplicate, onArchive,
}: {
  product: EndProduct;
  bomTemplates: BOMTemplate[];
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const linkedBOM = bomTemplates.find(b => b.bom_id === product.bom_id);
  const cat = categoryConfig[product.category];
  const CatIcon = cat.icon;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CatIcon className={cn('w-5 h-5', cat.color)} />
            {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Image + Info */}
          <div className="flex gap-4">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-24 h-24 rounded-lg object-cover border border-border/50" />
            ) : (
              <div className={cn('w-24 h-24 rounded-lg flex items-center justify-center bg-muted/50', cat.color)}>
                <CatIcon className="w-10 h-10" />
              </div>
            )}
            <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">SKU</span>
                <p className="font-mono font-medium">{product.sku}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Category</span>
                <p className="font-medium">{cat.label}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <p><StatusBadge variant={product.active ? 'success' : 'muted'}>{product.active ? 'Active' : 'Inactive'}</StatusBadge></p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Fixed Price</span>
                <p className="font-semibold">{product.fixed_price != null ? `AED ${product.fixed_price.toFixed(2)}` : 'Not set'}</p>
              </div>
            </div>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {product.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-sm text-muted-foreground">Description</span>
            <p className="text-sm mt-1">{product.description}</p>
          </div>

          {/* Shopify Link */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Shopify Product ID</span>
              <p className="font-mono text-xs">{product.shopify_product_id || 'Not linked'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Last Updated</span>
              <p className="text-xs">{new Date(product.updated_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Linked BOM */}
          {linkedBOM && (
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-gold" />
                  Linked BOM: {linkedBOM.name}
                </h4>
                <StatusBadge variant={bomStatusConfig[linkedBOM.status].variant}>
                  {bomStatusConfig[linkedBOM.status].label}
                </StatusBadge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Components</span>
                  <p className="font-semibold">{linkedBOM.line_items.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fixed Cost</span>
                  <p className="font-semibold">AED {linkedBOM.total_cost.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Version</span>
                  <p className="font-semibold">v{linkedBOM.version}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {linkedBOM.line_items.slice(0, 8).map(li => (
                  <Badge key={li.line_id} variant="outline" className="text-[10px]">
                    {li.component.name} × {li.qty}
                  </Badge>
                ))}
                {linkedBOM.line_items.length > 8 && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    +{linkedBOM.line_items.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-1.5" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={onArchive} className="text-destructive">
            <Archive className="w-4 h-4 mr-1.5" /> Archive
          </Button>
          <Button onClick={onEdit}>
            <Edit className="w-4 h-4 mr-1.5" /> Edit Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Product Add/Edit Form Dialog ----
/** Auto-generate SKU from category + product name (same pattern as Perfume Master & Packaging SKUs) */
function generateProductSku(category: EndProductCategory, name: string): string {
  const catCode = END_PRODUCT_CATEGORY_CODES[category] || 'CUS';
  const abbrev = name
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.substring(0, 4).toUpperCase())
    .join('')
    .substring(0, 12);
  return `EM/PRD/${catCode}-${abbrev || 'NEW'}`;
}

function ProductFormDialog({
  product, bomTemplates, shippingBOMs, onSave, onClose,
}: {
  product?: EndProduct;
  bomTemplates: BOMTemplate[];
  shippingBOMs: BOMTemplate[];
  onSave: (product: EndProduct) => void;
  onClose: () => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState<Partial<EndProduct>>(product || {
    product_id: `ep-${Date.now()}`,
    name: '',
    sku: '',
    category: 'one_time_decant' as EndProductCategory,
    description: '',
    image_url: '',
    bom_id: '',
    shopify_product_id: '',
    fixed_price: undefined,
    variable_price: undefined,
    selling_price: undefined,
    selling_price_method: 'manual' as const,
    selling_price_multiplier: undefined,
    tags: [],
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const [priceMethod, setPriceMethod] = useState<'manual' | 'multiplier'>(product?.selling_price_method || 'manual');
  const [multiplierValue, setMultiplierValue] = useState<number>(product?.selling_price_multiplier || 3);
  const [tagInput, setTagInput] = useState('');

  // Auto-generate SKU when name or category changes (only for new products)
  const autoSku = useMemo(() => {
    if (isEdit) return form.sku || '';
    return generateProductSku((form.category || 'custom') as EndProductCategory, form.name || '');
  }, [form.name, form.category, isEdit, form.sku]);

  const selectedBOM = bomTemplates.find(b => b.bom_id === form.bom_id);
  const selectedShippingBOM = shippingBOMs.find(b => b.bom_id === form.shipping_bom_id);

  // Computed costs from BOM
  const fixedCost = selectedBOM ? selectedBOM.total_cost : (form.fixed_price ?? 0);
  const variableCost = selectedBOM ? selectedBOM.variable_cost : (form.variable_price ?? 0);
  const shippingCost = selectedShippingBOM ? selectedShippingBOM.total_cost : (form.shipping_cost ?? 0);
  const totalBOMCost = fixedCost + variableCost + shippingCost;

  // Compute selling price from multiplier
  const computedSellingPrice = priceMethod === 'multiplier' && totalBOMCost > 0
    ? totalBOMCost * multiplierValue
    : form.selling_price ?? 0;

  const effectiveSellingPrice = priceMethod === 'multiplier' ? computedSellingPrice : (form.selling_price ?? 0);
  const grossMargin = effectiveSellingPrice > 0 ? effectiveSellingPrice - totalBOMCost : 0;
  const marginPercent = effectiveSellingPrice > 0 ? (grossMargin / effectiveSellingPrice) * 100 : 0;

  const handleSubmit = () => {
    if (!form.name) {
      toast.error('Product name is required');
      return;
    }
    const finalSku = isEdit ? (form.sku || autoSku) : autoSku;
    const finalProduct: EndProduct = {
      product_id: form.product_id || `ep-${Date.now()}`,
      name: form.name!,
      sku: finalSku,
      category: (form.category || 'custom') as EndProductCategory,
      description: form.description || '',
      image_url: form.image_url || undefined,
      bom_id: form.bom_id || undefined,
      bom: selectedBOM || undefined,
      shipping_bom_id: form.shipping_bom_id || undefined,
      shipping_bom: selectedShippingBOM || undefined,
      shopify_product_id: form.shopify_product_id || undefined,
      fixed_price: fixedCost || undefined,
      variable_price: variableCost || undefined,
      shipping_cost: shippingCost || undefined,
      selling_price: effectiveSellingPrice || undefined,
      selling_price_method: priceMethod,
      selling_price_multiplier: priceMethod === 'multiplier' ? multiplierValue : undefined,
      tags: form.tags || [],
      active: form.active ?? true,
      created_at: form.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onSave(finalProduct);
  };

  const addTag = () => {
    if (tagInput.trim() && !(form.tags || []).includes(tagInput.trim())) {
      setForm(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shopify / Next.js Product ID — prominent at top */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-info" />
              Shopify / Next.js Product ID
            </Label>
            <Input
              value={form.shopify_product_id || ''}
              onChange={e => setForm(prev => ({ ...prev, shopify_product_id: e.target.value }))}
              placeholder="e.g. gid://shopify/Product/8901234567"
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Links this product to your Shopify/Next.js storefront for order resolution</p>
          </div>

          <div className="space-y-2">
            <Label>Product Name *</Label>
            <Input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Standard Decant Order" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category || 'custom'} onValueChange={v => setForm(prev => ({ ...prev, category: v as EndProductCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SKU / Master ID</Label>
              <Input
                value={isEdit ? (form.sku || '') : autoSku}
                onChange={isEdit ? (e => setForm(prev => ({ ...prev, sku: e.target.value }))) : undefined}
                readOnly={!isEdit}
                className={cn('font-mono text-sm', !isEdit && 'bg-muted/50 cursor-default')}
              />
              {!isEdit && (
                <p className="text-[10px] text-info">Auto-generated from category + name</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={form.image_url || ''} onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value }))} placeholder="https://..." />
            {form.image_url && (
              <img src={form.image_url} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border/50" />
            )}
          </div>

          {/* BOM Linking Section */}
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> BOM Configuration
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Component BOM */}
              <div className="space-y-1.5">
                <Label className="text-xs">Component BOM Template</Label>
                <Select value={form.bom_id || 'none'} onValueChange={v => setForm(prev => ({ ...prev, bom_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Component BOM..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Component BOM</SelectItem>
                    {bomTemplates.map(b => (
                      <SelectItem key={b.bom_id} value={b.bom_id}>
                        {b.name} — AED {(b.total_cost + b.variable_cost).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBOM && (
                  <p className="text-[10px] text-muted-foreground">{selectedBOM.line_items.length} components · v{selectedBOM.version}</p>
                )}
              </div>

              {/* Shipping BOM */}
              <div className="space-y-1.5">
                <Label className="text-xs">Shipping BOM Template</Label>
                <Select value={form.shipping_bom_id || 'none'} onValueChange={v => setForm(prev => ({ ...prev, shipping_bom_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Shipping BOM..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Shipping BOM</SelectItem>
                    {shippingBOMs.filter(b => b.status === 'active').map(b => (
                      <SelectItem key={b.bom_id} value={b.bom_id}>
                        {b.name} — AED {b.total_cost.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedShippingBOM && (
                  <p className="text-[10px] text-muted-foreground">{selectedShippingBOM.line_items.length} components · v{selectedShippingBOM.version}</p>
                )}
              </div>
            </div>

            {/* Cost Breakdown */}
            {(selectedBOM || selectedShippingBOM) && (
              <div className="rounded-lg border border-border/40 bg-background p-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cost Breakdown</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Fixed</p>
                    <p className="text-sm font-mono font-semibold">AED {fixedCost.toFixed(2)}</p>
                    <p className="text-[9px] text-muted-foreground">Packaging</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gold">Variable</p>
                    <p className="text-sm font-mono font-semibold text-gold">AED {variableCost.toFixed(2)}</p>
                    <p className="text-[9px] text-muted-foreground">Perfume</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-blue-400">Shipping</p>
                    <p className="text-sm font-mono font-semibold text-blue-400">AED {shippingCost.toFixed(2)}</p>
                    <p className="text-[9px] text-muted-foreground">{selectedShippingBOM?.name.match(/^(SHIP-\d+)/)?.[1] || '—'}</p>
                  </div>
                  <div className="text-center bg-muted/30 rounded-md py-1">
                    <p className="text-[10px] text-foreground font-semibold">Total Cost</p>
                    <p className="text-sm font-mono font-bold">AED {totalBOMCost.toFixed(2)}</p>
                    <p className="text-[9px] text-muted-foreground">All layers</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selling Price with Method Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Selling Price (AED)</Label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPriceMethod('manual')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
                    priceMethod === 'manual'
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMethod('multiplier')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
                    priceMethod === 'multiplier'
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Multiplier
                </button>
              </div>
            </div>

            {priceMethod === 'manual' ? (
              <Input
                type="number"
                step="0.01"
                value={form.selling_price ?? ''}
                onChange={e => setForm(prev => ({ ...prev, selling_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="Enter retail price"
              />
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {[2, 2.5, 3, 3.5, 4, 5].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMultiplierValue(m)}
                      className={cn(
                        'flex-1 py-2 rounded-lg border text-sm font-medium transition-all text-center',
                        multiplierValue === m
                          ? 'border-gold bg-gold/20 text-gold shadow-sm'
                          : 'border-border/50 hover:border-gold/50 text-muted-foreground'
                      )}
                    >
                      {m}×
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground shrink-0">Custom:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={multiplierValue}
                    onChange={e => setMultiplierValue(parseFloat(e.target.value) || 1)}
                    className="w-24 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">× AED {totalBOMCost.toFixed(2)} =</span>
                  <span className="text-sm font-bold font-mono">AED {computedSellingPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Margin Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Selling Price</p>
              <p className="text-sm font-mono font-semibold">
                {effectiveSellingPrice > 0 ? `AED ${effectiveSellingPrice.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Gross Margin</p>
              <p className={cn('text-sm font-mono font-semibold', grossMargin > 0 ? 'text-success' : grossMargin < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {effectiveSellingPrice > 0 ? `AED ${grossMargin.toFixed(2)}` : '—'}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-[10px] text-muted-foreground">Margin %</p>
              <p className={cn('text-sm font-semibold', marginPercent >= 40 ? 'text-success' : marginPercent >= 20 ? 'text-warning' : marginPercent > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {effectiveSellingPrice > 0 ? `${marginPercent.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag and press Enter"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            {(form.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(form.tags || []).map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.active ?? true}
              onCheckedChange={v => setForm(prev => ({ ...prev, active: !!v }))}
            />
            <Label className="text-sm">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>
            <Save className="w-4 h-4 mr-1.5" /> {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// BOM Templates Tab — with working New BOM, Edit, Duplicate, Archive
// ============================================================
function BOMTemplatesTab({
  bomTemplates, setBomTemplates, products,
}: {
  bomTemplates: BOMTemplate[];
  setBomTemplates: React.Dispatch<React.SetStateAction<BOMTemplate[]>>;
  products: EndProduct[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBOM, setSelectedBOM] = useState<BOMTemplate | null>(null);
  const [showNewBOM, setShowNewBOM] = useState(false);
  const [editBOM, setEditBOM] = useState<BOMTemplate | null>(null);

  const productBoms = useMemo(() => bomTemplates, [bomTemplates]);

  const filtered = useMemo(() => {
    return productBoms.filter(b => {
      const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [productBoms, search, statusFilter]);

  const stats = useMemo(() => ({
    total: productBoms.length,
    active: productBoms.filter(b => b.status === 'active').length,
    totalComponents: productBoms.reduce((s, b) => s + b.line_items.length, 0),
    avgCost: productBoms.length > 0 ? productBoms.reduce((s, b) => s + b.total_cost, 0) / productBoms.length : 0,
  }), [productBoms]);

  const handleSaveBOM = (bom: BOMTemplate) => {
    const exists = bomTemplates.find(b => b.bom_id === bom.bom_id);
    if (exists) {
      setBomTemplates(prev => prev.map(b => b.bom_id === bom.bom_id ? bom : b));
      toast.success(`Updated "${bom.name}"`);
    } else {
      setBomTemplates(prev => [...prev, bom]);
      toast.success(`Created "${bom.name}"`);
    }
    setShowNewBOM(false);
    setEditBOM(null);
  };

  const handleDuplicate = (bom: BOMTemplate) => {
    const newBom: BOMTemplate = {
      ...bom,
      bom_id: `bom-${Date.now()}`,
      name: `${bom.name} (Copy)`,
      status: 'draft',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      line_items: bom.line_items.map(li => ({ ...li, line_id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    };
    setBomTemplates(prev => [...prev, newBom]);
    toast.success(`Duplicated "${bom.name}"`);
    setSelectedBOM(null);
  };

  const handleArchive = (bomId: string) => {
    setBomTemplates(prev => prev.map(b => b.bom_id === bomId ? { ...b, status: 'archived' as BOMStatus } : b));
    toast.success('BOM archived');
    setSelectedBOM(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Product BOMs" value={stats.total} icon={Layers} variant="default" />
        <KPICard label="Active" value={stats.active} icon={CheckCircle2} variant="success" />
        <KPICard label="Total Components" value={stats.totalComponents} icon={Hash} variant="gold" />
        <KPICard label="Avg Fixed Cost" value={`AED ${stats.avgCost.toFixed(2)}`} icon={DollarSign} variant="default" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search BOMs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowNewBOM(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> New BOM
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((bom, idx) => {
          const linkedProducts = products.filter(p => p.bom_id === bom.bom_id);
          const fixedItems = bom.line_items.filter(li => !li.component.is_variable);
          const variableItems = bom.line_items.filter(li => li.component.is_variable);
          const categoryGroups = new Map<string, BOMLineItem[]>();
          for (const li of bom.line_items) {
            const cat = li.component.category;
            if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
            categoryGroups.get(cat)!.push(li);
          }
          const serial = `BOM-${String(idx + 1).padStart(3, '0')}`;

          return (
            <Card key={bom.bom_id} className={cn('hover:shadow-md transition-all cursor-pointer border-border/60 group', bom.status === 'archived' && 'opacity-60')} onClick={() => setSelectedBOM(bom)}>
              <CardContent className="p-0">
                {/* Header strip with serial */}
                <div className="bg-gradient-to-r from-gold/10 to-transparent px-4 py-3 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gold/20 text-gold border-gold/30 font-mono text-[10px] tracking-wider">{serial}</Badge>
                    <StatusBadge variant={bomStatusConfig[bom.status].variant}>{bomStatusConfig[bom.status].label}</StatusBadge>
                    <span className="text-[10px] text-muted-foreground font-mono">v{bom.version}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{linkedProducts.length} product{linkedProducts.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gold" />
                    <h3 className="font-semibold text-sm">{bom.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bom.description}</p>
                </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Components</p>
                      <p className="text-sm font-semibold">{bom.line_items.length}</p>
                    </div>
                    <div className="bg-gold/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Fixed Cost</p>
                      <p className="text-sm font-semibold text-gold">AED {bom.total_cost.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Variable</p>
                      <p className="text-sm font-semibold text-purple-400">AED {bom.variable_cost.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Component preview chips */}
                  <div className="flex flex-wrap gap-1">
                    {bom.line_items.slice(0, 4).map(li => (
                      <Badge key={li.line_id} variant="outline" className="text-[9px] gap-0.5">
                        {li.component.name} \u00d7{li.qty}
                      </Badge>
                    ))}
                    {bom.line_items.length > 4 && (
                      <Badge variant="outline" className="text-[9px]">+{bom.line_items.length - 4} more</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && <EmptyState icon={Layers} title="No BOMs found" description="Try adjusting your search or status filter." />}

      {selectedBOM && !editBOM && (
        <BOMDetailDialog
          bom={selectedBOM}
          products={products}
          onClose={() => setSelectedBOM(null)}
          onEdit={() => { setEditBOM(selectedBOM); setSelectedBOM(null); }}
          onDuplicate={() => handleDuplicate(selectedBOM)}
          onArchive={() => handleArchive(selectedBOM.bom_id)}
        />
      )}

      {(showNewBOM || editBOM) && (
        <BOMFormDialog
          bom={editBOM || undefined}
          onSave={handleSaveBOM}
          onClose={() => { setShowNewBOM(false); setEditBOM(null); }}
        />
      )}
    </div>
  );
}

// ---- BOM Detail Dialog ----
function BOMDetailDialog({
  bom, products, onClose, onEdit, onDuplicate, onArchive,
}: {
  bom: BOMTemplate;
  products: EndProduct[];
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const linkedProducts = products.filter(p => p.bom_id === bom.bom_id);
  const categoryGroups = new Map<string, BOMLineItem[]>();
  for (const li of bom.line_items) {
    const cat = li.component.category;
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(li);
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gold" />
            {bom.name}
            <StatusBadge variant={bomStatusConfig[bom.status].variant}>{bomStatusConfig[bom.status].label}</StatusBadge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">AED {bom.total_cost.toFixed(2)}</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Fixed Cost</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">{bom.line_items.length}</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Components</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">v{bom.version}</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Version</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">{linkedProducts.length}</p>
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Products</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{bom.description}</p>

          {linkedProducts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Linked Products</h4>
              <div className="flex flex-wrap gap-2">
                {linkedProducts.map(p => {
                  const cat = categoryConfig[p.category];
                  const CatIcon = cat.icon;
                  return (
                    <Badge key={p.product_id} variant="outline" className="gap-1 py-1">
                      <CatIcon className={cn('w-3 h-3', cat.color)} />
                      {p.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Component Table */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Component Breakdown</h4>
            {Array.from(categoryGroups).map(([cat, items]) => (
              <div key={cat} className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                  <h5 className="text-xs font-semibold uppercase tracking-wider">{componentCategoryLabels[cat as BOMComponentCategory] || cat}</h5>
                  <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-border/30">
                  {items.sort((a, b) => a.sort_order - b.sort_order).map(li => (
                    <div key={li.line_id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      {li.component.image_url && (
                        <img src={li.component.image_url} alt="" className="w-8 h-8 rounded object-cover border border-border/30" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{li.component.name}</span>
                          {li.component.is_variable && (
                            <Badge variant="outline" className="text-[9px] bg-gold/10 text-gold border-gold/30">Variable</Badge>
                          )}
                          {li.is_optional && (
                            <Badge variant="outline" className="text-[9px] bg-info/10 text-info border-info/30">Optional</Badge>
                          )}
                        </div>
                        {li.component.source_ref_id && (
                          <p className="text-[10px] text-muted-foreground font-mono">{li.component.source_ref_id}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-semibold">× {li.qty}</span>
                        <span className="text-xs text-muted-foreground ml-1">{li.component.unit}</span>
                      </div>
                      {!li.component.is_variable && (
                        <div className="text-right shrink-0 w-20">
                          <span className="text-xs text-muted-foreground">AED {(li.qty * li.component.unit_cost).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Fixed Cost</span>
              <span className="text-lg font-semibold">AED {bom.total_cost.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Variable items (perfumes) are costed at order time based on actual selection.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onDuplicate}><Copy className="w-4 h-4 mr-1.5" /> Duplicate</Button>
          <Button variant="outline" size="sm" onClick={onArchive} className="text-destructive"><Archive className="w-4 h-4 mr-1.5" /> Archive</Button>
          <Button onClick={onEdit}><Edit className="w-4 h-4 mr-1.5" /> Edit BOM</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- BOM New/Edit Form Dialog ----
function BOMFormDialog({
  bom, onSave, onClose,
}: {
  bom?: BOMTemplate;
  onSave: (bom: BOMTemplate) => void;
  onClose: () => void;
}) {
  const isEdit = !!bom;
  const [name, setName] = useState(bom?.name || '');
  const [description, setDescription] = useState(bom?.description || '');
  const [status, setStatus] = useState<BOMStatus>(bom?.status || 'draft');
  const [lineItems, setLineItems] = useState<BOMLineItem[]>(bom?.line_items || []);
  const [showComponentPicker, setShowComponentPicker] = useState(false);
  const [compSearch, setCompSearch] = useState('');
  const [compCatFilter, setCompCatFilter] = useState<string>('all');

  const totalCost = lineItems.filter(li => !li.component.is_variable).reduce((s, li) => s + li.qty * li.component.unit_cost, 0);
  const variableCost = lineItems.filter(li => li.component.is_variable).reduce((s, li) => s + li.qty * li.component.unit_cost, 0);

  const filteredComponents = useMemo(() => {
    return bomComponents.filter(c => {
      const matchesSearch = !compSearch || c.name.toLowerCase().includes(compSearch.toLowerCase());
      const matchesCat = compCatFilter === 'all' || c.category === compCatFilter;
      const notAlreadyAdded = !lineItems.some(li => li.component_id === c.component_id);
      return matchesSearch && matchesCat && notAlreadyAdded;
    });
  }, [compSearch, compCatFilter, lineItems]);

  const addComponent = (comp: BOMComponent) => {
    const newLine: BOMLineItem = {
      line_id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      component_id: comp.component_id,
      component: comp,
      qty: 1,
      is_optional: false,
      sort_order: lineItems.length + 1,
    };
    setLineItems(prev => [...prev, newLine]);
    toast.success(`Added "${comp.name}"`);
  };

  const removeLineItem = (lineId: string) => {
    setLineItems(prev => prev.filter(li => li.line_id !== lineId));
  };

  const updateLineQty = (lineId: string, qty: number) => {
    setLineItems(prev => prev.map(li => li.line_id === lineId ? { ...li, qty: Math.max(1, qty) } : li));
  };

  const toggleOptional = (lineId: string) => {
    setLineItems(prev => prev.map(li => li.line_id === lineId ? { ...li, is_optional: !li.is_optional } : li));
  };

  const handleSubmit = () => {
    if (!name) { toast.error('BOM name is required'); return; }
    if (lineItems.length === 0) { toast.error('Add at least one component'); return; }

    const finalBom: BOMTemplate = {
      bom_id: bom?.bom_id || `bom-${Date.now()}`,
      name,
      description,
      status,
      version: bom ? bom.version + 1 : 1,
      line_items: lineItems,
      total_cost: totalCost,
      variable_cost: variableCost,
      created_at: bom?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: bom?.created_by || 'operator',
    };
    onSave(finalBom);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit BOM Template' : 'Create New BOM Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>BOM Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grand Master 1 Subscription Box" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as BOMStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Component List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Components ({lineItems.length})</h4>
              <Button size="sm" variant="outline" onClick={() => setShowComponentPicker(!showComponentPicker)}>
                <Plus className="w-4 h-4 mr-1" /> Add Component
              </Button>
            </div>

            {/* Component Picker */}
            {showComponentPicker && (
              <div className="border border-border rounded-lg p-3 mb-4 bg-muted/20">
                <div className="flex gap-2 mb-3">
                  <Input placeholder="Search components..." value={compSearch} onChange={e => setCompSearch(e.target.value)} className="flex-1" />
                  <Select value={compCatFilter} onValueChange={setCompCatFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {Object.entries(componentCategoryLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredComponents.map(comp => (
                    <div key={comp.component_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => addComponent(comp)}>
                      {comp.image_url && <img src={comp.image_url} alt="" className="w-6 h-6 rounded object-cover" />}
                      <span className="text-sm flex-1">{comp.name}</span>
                      <Badge variant="outline" className="text-[9px]">{comp.category}</Badge>
                      <span className="text-xs text-muted-foreground">AED {comp.unit_cost.toFixed(2)}/{comp.unit}</span>
                      <Plus className="w-4 h-4 text-success" />
                    </div>
                  ))}
                  {filteredComponents.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No matching components available</p>
                  )}
                </div>
              </div>
            )}

            {/* Line Items Table */}
            {lineItems.length > 0 ? (
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <div className="col-span-1"></div>
                  <div className="col-span-4">Component</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-1 text-center">Qty</div>
                  <div className="col-span-2 text-right">Cost</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y divide-border/30">
                  {lineItems.map(li => (
                    <div key={li.line_id} className="px-4 py-2 grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-1">
                        {li.component.image_url ? (
                          <img src={li.component.image_url} alt="" className="w-7 h-7 rounded object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-muted/50 flex items-center justify-center">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="col-span-4">
                        <span className="font-medium text-xs">{li.component.name}</span>
                        {li.component.is_variable && <Badge variant="outline" className="text-[8px] ml-1 bg-gold/10 text-gold">Var</Badge>}
                        {li.is_optional && <Badge variant="outline" className="text-[8px] ml-1 bg-info/10 text-info">Opt</Badge>}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-[9px]">{li.component.category}</Badge>
                      </div>
                      <div className="col-span-1 text-center">
                        <Input
                          type="number"
                          min={1}
                          value={li.qty}
                          onChange={e => updateLineQty(li.line_id, parseInt(e.target.value) || 1)}
                          className="w-14 h-7 text-xs text-center mx-auto"
                        />
                      </div>
                      <div className="col-span-2 text-right text-xs text-muted-foreground">
                        {li.component.is_variable ? '—' : `AED ${(li.qty * li.component.unit_cost).toFixed(2)}`}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleOptional(li.line_id)} title="Toggle optional">
                          <Tag className={cn('w-3 h-3', li.is_optional ? 'text-info' : 'text-muted-foreground')} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeLineItem(li.line_id)} title="Remove">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{lineItems.length} components</span>
                  <span className="text-sm font-semibold">Total Fixed Cost: AED {totalCost.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No components added yet. Click "Add Component" to start building.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>
            <Save className="w-4 h-4 mr-1.5" /> {isEdit ? 'Save Changes' : 'Create BOM'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Shipping BOM Tab — dedicated view for the base shipping BOM
// ============================================================
function ShippingBOMsTab({
  shippingBOMs, setShippingBOMs, products,
}: {
  shippingBOMs: BOMTemplate[];
  setShippingBOMs: React.Dispatch<React.SetStateAction<BOMTemplate[]>>;
  products: EndProduct[];
}) {
  const [search, setSearch] = useState('');
  const [selectedBOM, setSelectedBOM] = useState<BOMTemplate | null>(null);
  const [editBOM, setEditBOM] = useState<BOMTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    return shippingBOMs.filter(b => {
      const q = search.toLowerCase();
      return !q || b.name.toLowerCase().includes(q) || b.bom_id.toLowerCase().includes(q);
    });
  }, [shippingBOMs, search]);

  const stats = useMemo(() => ({
    total: shippingBOMs.length,
    active: shippingBOMs.filter(b => b.status === 'active').length,
    avgCost: shippingBOMs.length > 0 ? shippingBOMs.reduce((s, b) => s + b.total_cost, 0) / shippingBOMs.length : 0,
    linkedProducts: products.filter(p => p.shipping_bom_id).length,
  }), [shippingBOMs, products]);

  const handleSave = (bom: BOMTemplate) => {
    const exists = shippingBOMs.find(b => b.bom_id === bom.bom_id);
    if (exists) {
      setShippingBOMs(prev => prev.map(b => b.bom_id === bom.bom_id ? bom : b));
      toast.success(`Updated "${bom.name}"`);
    } else {
      // Auto-assign serial
      const nextSerial = shippingBOMs.length + 1;
      const serialPrefix = `SHIP-${String(nextSerial).padStart(3, '0')}`;
      const newBom = { ...bom, name: bom.name.startsWith('SHIP-') ? bom.name : `${serialPrefix} \u00b7 ${bom.name}` };
      setShippingBOMs(prev => [...prev, newBom]);
      toast.success(`Created "${newBom.name}"`);
    }
    setShowNew(false);
    setEditBOM(null);
  };

  const handleDuplicate = (bom: BOMTemplate) => {
    const nextSerial = shippingBOMs.length + 1;
    const serialPrefix = `SHIP-${String(nextSerial).padStart(3, '0')}`;
    const baseName = bom.name.replace(/^SHIP-\d+\s*\u00b7\s*/, '');
    const newBom: BOMTemplate = {
      ...bom,
      bom_id: `bom-ship-${Date.now()}`,
      name: `${serialPrefix} \u00b7 ${baseName} (Copy)`,
      status: 'draft',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      line_items: bom.line_items.map(li => ({ ...li, line_id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    };
    setShippingBOMs(prev => [...prev, newBom]);
    toast.success(`Duplicated as "${newBom.name}"`);
    setSelectedBOM(null);
  };

  const handleArchive = (bomId: string) => {
    setShippingBOMs(prev => prev.map(b => b.bom_id === bomId ? { ...b, status: 'archived' as BOMStatus } : b));
    toast.success('Shipping BOM archived');
    setSelectedBOM(null);
  };

  const getLinkedProductCount = (bomId: string) => products.filter(p => p.shipping_bom_id === bomId).length;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Truck className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Shipping BOM Templates</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Each shipping BOM defines a packaging configuration (bag, box, envelope, premium). When creating an End Product, you link both a <strong>Component BOM</strong> and a <strong>Shipping BOM</strong> — their costs combine into the total product cost.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Shipping BOMs" value={stats.total} icon={Truck} variant="default" />
        <KPICard label="Active" value={stats.active} icon={CheckCircle2} variant="success" />
        <KPICard label="Avg Cost" value={`AED ${stats.avgCost.toFixed(2)}`} icon={DollarSign} variant="gold" />
        <KPICard label="Products Linked" value={stats.linkedProducts} icon={Package} variant="default" />
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search shipping BOMs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
          <Plus className="w-4 h-4" /> New Shipping BOM
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(bom => {
          const linkedCount = getLinkedProductCount(bom.bom_id);
          const serial = bom.name.match(/^(SHIP-\d+)/)?.[1] || bom.bom_id;
          const displayName = bom.name.replace(/^SHIP-\d+\s*\u00b7\s*/, '');

          return (
            <Card
              key={bom.bom_id}
              className={cn(
                'border-border/60 hover:border-gold/40 transition-all cursor-pointer group',
                bom.status === 'archived' && 'opacity-60',
              )}
              onClick={() => setSelectedBOM(bom)}
            >
              <CardContent className="p-0">
                {/* Header strip with serial */}
                <div className="bg-gradient-to-r from-blue-500/10 to-transparent px-4 py-3 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-mono text-[10px] tracking-wider">
                      {serial}
                    </Badge>
                    <StatusBadge variant={bomStatusConfig[bom.status].variant}>
                      {bomStatusConfig[bom.status].label}
                    </StatusBadge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">v{bom.version}</span>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-400" />
                      {displayName}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bom.description}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Components</p>
                      <p className="text-sm font-semibold">{bom.line_items.length}</p>
                    </div>
                    <div className="bg-gold/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Fixed Cost</p>
                      <p className="text-sm font-semibold text-gold">AED {bom.total_cost.toFixed(2)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Products</p>
                      <p className="text-sm font-semibold">{linkedCount}</p>
                    </div>
                  </div>

                  {/* Component preview chips */}
                  <div className="flex flex-wrap gap-1">
                    {bom.line_items.slice(0, 5).map(li => (
                      <Badge key={li.line_id} variant="outline" className="text-[9px] gap-0.5">
                        {li.component.name} \u00d7{li.qty}
                      </Badge>
                    ))}
                    {bom.line_items.length > 5 && (
                      <Badge variant="outline" className="text-[9px]">+{bom.line_items.length - 5} more</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && <EmptyState icon={Truck} title="No shipping BOMs found" description="Create a new shipping BOM or adjust your search." />}

      {/* Detail Dialog */}
      {selectedBOM && !editBOM && (
        <BOMDetailDialog
          bom={selectedBOM}
          products={products}
          onClose={() => setSelectedBOM(null)}
          onEdit={() => { setEditBOM(selectedBOM); setSelectedBOM(null); }}
          onDuplicate={() => handleDuplicate(selectedBOM)}
          onArchive={() => handleArchive(selectedBOM.bom_id)}
        />
      )}

      {/* Edit/New Dialog */}
      {(showNew || editBOM) && (
        <BOMFormDialog
          bom={editBOM || undefined}
          onSave={handleSave}
          onClose={() => { setShowNew(false); setEditBOM(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Visual Designer Tab
// ============================================================
function BOMDesignerTab({ bomTemplates }: { bomTemplates: BOMTemplate[] }) {
  const [selectedBOM, setSelectedBOM] = useState<BOMTemplate | null>(null);
  const productBoms = bomTemplates;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select onValueChange={id => setSelectedBOM(productBoms.find(b => b.bom_id === id) || null)}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a BOM to visualize..." />
          </SelectTrigger>
          <SelectContent>
            {productBoms.map(b => (
              <SelectItem key={b.bom_id} value={b.bom_id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBOM ? (
        <BOMWorkflowView bom={selectedBOM} />
      ) : (
        <EmptyState icon={Layers} title="Select a BOM" description="Choose a BOM template above to see its visual workflow breakdown." />
      )}
    </div>
  );
}

function BOMWorkflowView({ bom }: { bom: BOMTemplate }) {
  const categoryGroups = new Map<string, BOMLineItem[]>();
  for (const li of bom.line_items) {
    const cat = li.component.category;
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(li);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="bg-card border-2 border-gold/50 rounded-xl px-6 py-4 shadow-sm text-center">
          <Package className="w-8 h-8 text-gold mx-auto mb-2" />
          <h3 className="font-semibold">{bom.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">AED {bom.total_cost.toFixed(2)} fixed cost</p>
        </div>
      </div>
      <div className="flex justify-center"><div className="w-px h-8 bg-border" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from(categoryGroups).map(([cat, items]) => (
          <Card key={cat} className={cn('border-l-[3px]', categoryColors[cat] || 'border-l-muted')}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{componentCategoryLabels[cat as BOMComponentCategory] || cat}</span>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1.5">
              {items.sort((a, b) => a.sort_order - b.sort_order).map(li => (
                <div key={li.line_id} className={cn('flex items-center gap-2 text-xs py-1.5 px-2 rounded-md', li.component.is_variable ? 'bg-gold/10 border border-gold/20' : 'bg-muted/30')}>
                  {li.component.image_url && <img src={li.component.image_url} alt="" className="w-5 h-5 rounded object-cover" />}
                  <span className="font-medium truncate flex-1">{li.component.name}</span>
                  <span className="font-mono shrink-0">×{li.qty}</span>
                  {li.component.is_variable && <Sparkles className="w-3 h-3 text-gold shrink-0" />}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main BOM Setup Page
// ============================================================
export default function BOMSetup() {
  const [products, setProducts] = useState<EndProduct[]>(initialEndProducts);
  const [boms, setBoms] = useState<BOMTemplate[]>(initialBomTemplates);
  const [shippingBOMs, setShippingBOMs] = useState<BOMTemplate[]>(initialShippingBOMs);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Bill of Materials"
        subtitle="Define end products, create BOMs, and manage shipping & product component layers"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM Setup' },
        ]}
      />

      <div className="p-6">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="w-4 h-4" /> End Products
            </TabsTrigger>
            <TabsTrigger value="boms" className="gap-1.5">
              <Layers className="w-4 h-4" /> BOM Templates
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-1.5">
              <Truck className="w-4 h-4" /> Shipping BOMs
            </TabsTrigger>
            <TabsTrigger value="designer" className="gap-1.5">
              <Eye className="w-4 h-4" /> Visual Designer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <EndProductsTab products={products} setProducts={setProducts} bomTemplates={boms} shippingBOMs={shippingBOMs} />
          </TabsContent>
          <TabsContent value="boms">
            <BOMTemplatesTab bomTemplates={boms} setBomTemplates={setBoms} products={products} />
          </TabsContent>
          <TabsContent value="shipping">
            <ShippingBOMsTab shippingBOMs={shippingBOMs} setShippingBOMs={setShippingBOMs} products={products} />
          </TabsContent>
          <TabsContent value="designer">
            <BOMDesignerTab bomTemplates={boms} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
