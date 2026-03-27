// ============================================================
// End Products — Standalone page for managing end products
// Extracted from BOMSetup for cleaner navigation
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, KPICard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Settings2, Save, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  endProducts as initialEndProducts,
  bomTemplates as initialBomTemplates,
  shippingBOMs as initialShippingBOMs,
  componentCategoryLabels,
} from '@/lib/bom-data';
import type {
  EndProduct, BOMTemplate, BOMLineItem, EndProductCategory,
  BOMStatus, BOMComponentCategory,
} from '@/types';
import { END_PRODUCT_CATEGORY_CODES } from '@/types';
import { categoryConfig } from '@/lib/product-categories';

const bomStatusConfig: Record<BOMStatus, { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  active: { label: 'Active', variant: 'success' },
  draft: { label: 'Draft', variant: 'warning' },
  archived: { label: 'Archived', variant: 'muted' },
};

/** Auto-generate SKU from category + product name */
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
function ProductFormDialog({
  product, bomTemplates, shippingBOMs, onSave, onClose, allTags = [],
}: {
  product?: EndProduct;
  bomTemplates: BOMTemplate[];
  shippingBOMs: BOMTemplate[];
  onSave: (product: EndProduct) => void;
  onClose: () => void;
  allTags?: string[];
}) {
  const isEdit = !!product;
  const [form, setForm] = useState<Partial<EndProduct>>(product || {
    product_id: `ep-${Date.now()}`,
    name: '',
    sku: '',
    category: 'single_aurakey' as EndProductCategory,
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

  const autoSku = useMemo(() => {
    if (isEdit) return form.sku || '';
    return generateProductSku((form.category || 'custom') as EndProductCategory, form.name || '');
  }, [form.name, form.category, isEdit, form.sku]);

  const selectedBOM = bomTemplates.find(b => b.bom_id === form.bom_id);
  const selectedShippingBOM = shippingBOMs.find(b => b.bom_id === form.shipping_bom_id);

  const fixedCost = selectedBOM ? selectedBOM.total_cost : (form.fixed_price ?? 0);
  const variableCost = selectedBOM ? selectedBOM.variable_cost : (form.variable_price ?? 0);
  const shippingCost = selectedShippingBOM ? selectedShippingBOM.total_cost : (form.shipping_cost ?? 0);
  const totalBOMCost = fixedCost + variableCost + shippingCost;

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
          {/* Shopify / Next.js Product ID */}
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

          {/* Tags with autocomplete (D4) */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag and press Enter"
                />
                {tagInput.length > 0 && allTags.filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !(form.tags || []).includes(t)).length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-32 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {allTags
                      .filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !(form.tags || []).includes(t))
                      .map(t => (
                        <button
                          key={t}
                          onClick={() => { setForm(prev => ({ ...prev, tags: [...(prev.tags || []), t] })); setTagInput(''); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                  </div>
                )}
              </div>
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
// Main End Products Page
// ============================================================
export default function EndProducts() {
  const [products, setProducts] = useState<EndProduct[]>(initialEndProducts);
  const [bomTemplates] = useState<BOMTemplate[]>(initialBomTemplates);
  const [shippingBOMs] = useState<BOMTemplate[]>(initialShippingBOMs);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<EndProduct | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<EndProduct | null>(null);

  // D4: Collect all unique tags across all products for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    products.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [products]);

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
    <div className="min-h-screen bg-background">
      <PageHeader
        title="End Products"
        subtitle="Define and manage your product catalog — link each product to its Component BOM and Shipping BOM"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM Setup' },
          { label: 'End Products' },
        ]}
      />

      <div className="p-6 space-y-6">
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
            allTags={allTags}
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
            allTags={allTags}
            onSave={handleSaveProduct}
            onClose={() => setEditProduct(null)}
          />
        )}
      </div>
    </div>
  );
}
