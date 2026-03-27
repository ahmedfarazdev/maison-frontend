// ============================================================
// BOM Component Library — Master list of all BOM components
// Working Add/Edit forms, photos, auto-fetch unit cost from SKU
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, KPICard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, Plus, Edit, Package, Droplets, Layers, Tag,
  DollarSign, Hash, Box, Sparkles, Pipette, StickyNote,
  Truck, Wrench, CheckCircle2, Save, Trash2, Image, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { bomComponents as initialComponents, bomTemplates, componentCategoryLabels } from '@/lib/bom-data';
import { mockPackagingSKUs } from '@/lib/mock-data';
import type { BOMComponent, BOMComponentCategory } from '@/types';
import { DECANT_SIZES_ML } from '@/types';

const categoryConfig: Record<BOMComponentCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  perfume: { label: 'Perfumes', icon: Droplets, color: 'text-gold', bg: 'bg-gold/10' },
  atomizer: { label: 'Atomizers & Vials', icon: Pipette, color: 'text-info', bg: 'bg-info/10' },
  packaging: { label: 'Packaging', icon: Box, color: 'text-success', bg: 'bg-success/10' },
  insert: { label: 'Inserts & Cards', icon: StickyNote, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  accessory: { label: 'Accessories', icon: Wrench, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  label: { label: 'Labels', icon: Tag, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  shipping: { label: 'Shipping', icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

export default function ComponentLibrary() {
  const [components, setComponents] = useState<BOMComponent[]>(initialComponents);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<BOMComponent | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editComponent, setEditComponent] = useState<BOMComponent | null>(null);

  const filtered = useMemo(() => {
    return components.filter(c => {
      const matchesSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.component_id.toLowerCase().includes(search.toLowerCase()) ||
        (c.source_ref_id || '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
      const matchesSource = sourceFilter === 'all' || c.source === sourceFilter;
      return matchesSearch && matchesCategory && matchesSource;
    });
  }, [components, search, categoryFilter, sourceFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, BOMComponent[]>();
    for (const c of filtered) {
      if (!groups.has(c.category)) groups.set(c.category, []);
      groups.get(c.category)!.push(c);
    }
    return groups;
  }, [filtered]);

  const stats = useMemo(() => {
    const fixedComps = components.filter(c => !c.is_variable);
    const totalCost = fixedComps.reduce((s, c) => s + c.unit_cost, 0);
    return {
      total: components.length,
      fixed: fixedComps.length,
      variable: components.filter(c => c.is_variable).length,
      categories: new Set(components.map(c => c.category)).size,
      avgCost: fixedComps.length > 0 ? totalCost / fixedComps.length : 0,
    };
  }, [components]);

  const usageCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bom of bomTemplates) {
      for (const li of bom.line_items) {
        counts.set(li.component_id, (counts.get(li.component_id) || 0) + 1);
      }
    }
    return counts;
  }, []);

  const handleSaveComponent = (comp: BOMComponent) => {
    const exists = components.find(c => c.component_id === comp.component_id);
    if (exists) {
      setComponents(prev => prev.map(c => c.component_id === comp.component_id ? comp : c));
      toast.success(`Updated "${comp.name}"`);
    } else {
      setComponents(prev => [...prev, comp]);
      toast.success(`Created "${comp.name}"`);
    }
    setShowAddDialog(false);
    setEditComponent(null);
  };

  const handleDeleteComponent = (compId: string) => {
    const usage = usageCount.get(compId) || 0;
    if (usage > 0) {
      toast.error(`Cannot delete — used in ${usage} BOM(s). Remove from BOMs first.`);
      return;
    }
    setComponents(prev => prev.filter(c => c.component_id !== compId));
    toast.success('Component deleted');
    setSelectedComponent(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Component Library"
        subtitle="Master list of all BOM components — packaging, atomizers, inserts, labels, and more"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM', href: '/bom/setup' },
          { label: 'Component Library' },
        ]}
        actions={
          <Button onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Component
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard label="Total Components" value={stats.total} icon={Package} variant="default" />
          <KPICard label="Fixed" value={stats.fixed} icon={CheckCircle2} variant="success" />
          <KPICard label="Variable" value={stats.variable} icon={Sparkles} variant="gold" />
          <KPICard label="Categories" value={stats.categories} icon={Hash} variant="default" />
          <KPICard label="Avg Unit Cost" value={`AED ${stats.avgCost.toFixed(2)}`} icon={DollarSign} variant="default" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search components by name, ID, or SKU reference..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
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
          {/* Source filter removed per D1 — source is auto-determined from inventory reference */}
        </div>

        {Array.from(grouped).map(([cat, comps]) => {
          const cfg = categoryConfig[cat as BOMComponentCategory];
          const CatIcon = cfg?.icon || Package;

          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <CatIcon className={cn('w-5 h-5', cfg?.color || 'text-muted-foreground')} />
                <h3 className="font-semibold text-sm">{cfg?.label || cat}</h3>
                <Badge variant="outline" className="text-[10px]">{comps.length}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {comps.map(comp => {
                  const usage = usageCount.get(comp.component_id) || 0;

                  return (
                    <Card
                      key={comp.component_id}
                      className="hover:shadow-sm transition-all cursor-pointer border-border/60"
                      onClick={() => setSelectedComponent(comp)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {comp.image_url ? (
                            <img src={comp.image_url} alt={comp.name} className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0" />
                          ) : (
                            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', cfg?.bg || 'bg-muted/50')}>
                              <CatIcon className={cn('w-5 h-5', cfg?.color || 'text-muted-foreground')} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-medium text-sm truncate">{comp.name}</h4>
                              {comp.is_variable && <Sparkles className="w-3 h-3 text-gold shrink-0" />}
                            </div>
                            {comp.source_ref_id && (
                              <p className="text-[11px] font-mono text-muted-foreground truncate">{comp.source_ref_id}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              {!comp.is_variable ? (
                                <span className="font-medium">AED {comp.unit_cost.toFixed(2)}/{comp.unit}</span>
                              ) : (
                                <span className="text-gold font-medium">Variable cost</span>
                              )}
                              <span className="text-muted-foreground">
                                Used in {usage} BOM{usage !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState icon={Package} title="No components found" description="Try adjusting your search or filters." />
        )}

        {/* View Detail */}
        {selectedComponent && !editComponent && (
          <ComponentDetailDialog
            component={selectedComponent}
            usageCount={usageCount.get(selectedComponent.component_id) || 0}
            onClose={() => setSelectedComponent(null)}
            onEdit={() => { setEditComponent(selectedComponent); setSelectedComponent(null); }}
            onDelete={() => handleDeleteComponent(selectedComponent.component_id)}
          />
        )}

        {/* Add Component */}
        {showAddDialog && (
          <ComponentFormDialog
            onSave={handleSaveComponent}
            onClose={() => setShowAddDialog(false)}
          />
        )}

        {/* Edit Component */}
        {editComponent && (
          <ComponentFormDialog
            component={editComponent}
            onSave={handleSaveComponent}
            onClose={() => setEditComponent(null)}
          />
        )}
      </div>
    </div>
  );
}

// ---- Component Detail Dialog ----
function ComponentDetailDialog({ component, usageCount, onClose, onEdit, onDelete }: {
  component: BOMComponent;
  usageCount: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = categoryConfig[component.category];
  const CatIcon = cfg?.icon || Package;

  const usedInBOMs = bomTemplates.filter(b =>
    b.line_items.some(li => li.component_id === component.component_id)
  );

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CatIcon className={cn('w-5 h-5', cfg?.color)} />
            {component.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image */}
          {component.image_url && (
            <img src={component.image_url} alt={component.name} className="w-full h-32 rounded-lg object-cover border border-border/50" />
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Category</span>
              <p className="font-medium">{cfg?.label}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Source</span>
              <p className="font-medium capitalize">{component.source.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Unit Cost</span>
              <p className="font-medium">
                {component.is_variable ? <span className="text-gold">Variable (set at order time)</span> : `AED ${component.unit_cost.toFixed(2)}`}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Unit</span>
              <p className="font-medium">{component.unit}</p>
            </div>
            {component.source_ref_id && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">SKU / Inventory Reference</span>
                <p className="font-mono text-xs flex items-center gap-1.5">
                  <Link2 className="w-3 h-3" /> {component.source_ref_id}
                </p>
              </div>
            )}
          </div>

          {component.notes && (
            <div>
              <span className="text-sm text-muted-foreground">Notes</span>
              <p className="text-sm mt-1">{component.notes}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {component.is_variable && <Badge className="bg-gold/10 text-gold border-gold/30">Variable</Badge>}
            <Badge variant="outline">{component.source.replace('_', ' ')}</Badge>
          </div>

          {usedInBOMs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Used in {usedInBOMs.length} BOM{usedInBOMs.length !== 1 ? 's' : ''}</h4>
              <div className="space-y-1.5">
                {usedInBOMs.map(bom => {
                  const li = bom.line_items.find(l => l.component_id === component.component_id)!;
                  return (
                    <div key={bom.bom_id} className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                      <span className="font-medium">{bom.name}</span>
                      <span className="font-mono text-xs">× {li.qty} {component.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
          </Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit}>
            <Edit className="w-4 h-4 mr-1.5" /> Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Component Add/Edit Form Dialog ----
function ComponentFormDialog({ component, onSave, onClose }: {
  component?: BOMComponent;
  onSave: (comp: BOMComponent) => void;
  onClose: () => void;
}) {
  const isEdit = !!component;
  const [form, setForm] = useState<Partial<BOMComponent>>(component || {
    component_id: `comp-${Date.now()}`,
    name: '',
    category: 'packaging' as BOMComponentCategory,
    unit: 'pc',
    unit_cost: 0,
    source: 'custom' as 'packaging_sku' | 'sealed_vault' | 'custom',
    source_ref_id: '',
    image_url: '',
    is_variable: false,
    price_per_ml: undefined,
    decant_size_ml: undefined,
    notes: '',
  });
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);

  const isPerfumeVariable = form.category === 'perfume' && form.is_variable;

  // Auto-calculate unit cost for variable perfume components
  const calculatedUnitCost = useMemo(() => {
    if (!isPerfumeVariable) return form.unit_cost ?? 0;
    const ppm = form.price_per_ml ?? 0;
    const size = form.decant_size_ml ?? 0;
    return ppm * size;
  }, [isPerfumeVariable, form.price_per_ml, form.decant_size_ml, form.unit_cost]);

  // Group packaging SKUs by category for the dropdown
  const skuOptions = useMemo(() => {
    const q = skuSearch.toLowerCase();
    return mockPackagingSKUs.filter(s => s.active && (
      !q ||
      s.sku_id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    )).slice(0, 40);
  }, [skuSearch]);

  const selectedSkuItem = useMemo(() => {
    if (!form.source_ref_id) return null;
    return mockPackagingSKUs.find(s => s.sku_id === form.source_ref_id) || null;
  }, [form.source_ref_id]);

  const handleSkuSelect = (sku: typeof mockPackagingSKUs[0]) => {
    setForm(prev => ({
      ...prev,
      source_ref_id: sku.sku_id,
      name: prev.name || sku.name,
      unit: sku.unit || prev.unit,
      unit_cost: sku.unit_cost || prev.unit_cost,
    }));
    setSkuDropdownOpen(false);
    setSkuSearch('');
  };

  const handleSubmit = () => {
    if (!form.name) { toast.error('Component name is required'); return; }
    if (isPerfumeVariable && !form.decant_size_ml) { toast.error('Please select a decant size'); return; }

    const finalComp: BOMComponent = {
      component_id: form.component_id || `comp-${Date.now()}`,
      name: form.name!,
      category: (form.category || 'packaging') as BOMComponentCategory,
      unit: form.unit || 'pc',
      unit_cost: isPerfumeVariable ? calculatedUnitCost : (form.unit_cost || 0),
      source: (form.source || 'custom') as 'packaging_sku' | 'sealed_vault' | 'custom',
      source_ref_id: form.source_ref_id || undefined,
      image_url: form.image_url || undefined,
      is_variable: form.is_variable || false,
      price_per_ml: isPerfumeVariable ? (form.price_per_ml || undefined) : undefined,
      decant_size_ml: isPerfumeVariable ? (form.decant_size_ml || undefined) : undefined,
      notes: form.notes || undefined,
    };
    onSave(finalComp);
  };

  const handleSourceChange = (source: string) => {
    setForm(prev => ({ ...prev, source: source as 'packaging_sku' | 'sealed_vault' | 'custom', source_ref_id: '' }));
  };

  // When category changes to perfume, auto-set variable and source
  const handleCategoryChange = (cat: string) => {
    const isPerfume = cat === 'perfume';
    setForm(prev => ({
      ...prev,
      category: cat as BOMComponentCategory,
      is_variable: isPerfume ? true : prev.is_variable,
      source: isPerfume ? 'sealed_vault' as const : prev.source,
      unit: isPerfume ? 'ml' : prev.unit,
    }));
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Component' : 'Add New Component'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Component Name *</Label>
            <Input value={form.name || ''} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Black Mailer Box 25x20x10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category || 'packaging'} onValueChange={handleCategoryChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={form.unit || 'pc'} onValueChange={v => setForm(prev => ({ ...prev, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pc">pc (piece)</SelectItem>
                  <SelectItem value="ml">ml (milliliter)</SelectItem>
                  <SelectItem value="g">g (gram)</SelectItem>
                  <SelectItem value="m">m (meter)</SelectItem>
                  <SelectItem value="sheet">sheet</SelectItem>
                  <SelectItem value="roll">roll</SelectItem>
                  <SelectItem value="set">set</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variable Perfume Pricing Section */}
          {isPerfumeVariable && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-gold" />
                <span className="text-sm font-semibold text-gold">Variable Perfume Pricing</span>
              </div>

              <div className="space-y-2">
                <Label>Average Price per ml (AED) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price_per_ml ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, price_per_ml: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  placeholder="e.g. 5.00"
                />
                <p className="text-[10px] text-muted-foreground">Enter the average cost per ml across your perfume inventory. This is a manual estimate for margin analysis.</p>
              </div>

              <div className="space-y-2">
                <Label>Decant Size *</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {DECANT_SIZES_ML.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, decant_size_ml: size }))}
                      className={cn(
                        'py-2 px-1 rounded-lg border text-sm font-medium transition-all text-center',
                        form.decant_size_ml === size
                          ? 'border-gold bg-gold/20 text-gold shadow-sm'
                          : 'border-border/50 hover:border-gold/50 hover:bg-gold/5 text-muted-foreground'
                      )}
                    >
                      {size}ml
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-calculated unit cost */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Unit Cost</p>
                  <p className="text-lg font-bold font-mono">
                    AED {calculatedUnitCost.toFixed(2)}
                  </p>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  {(form.price_per_ml ?? 0) > 0 && (form.decant_size_ml ?? 0) > 0 ? (
                    <span>AED {(form.price_per_ml ?? 0).toFixed(2)}/ml × {form.decant_size_ml}ml</span>
                  ) : (
                    <span>Set price/ml and size above</span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-gold">This estimated cost is for margin analysis only — not used in BOM picking.</p>
            </div>
          )}

          {/* SKU / Inventory Reference — unified searchable dropdown (Source removed per D1) */}
          {!isPerfumeVariable && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-info" />
                  SKU / Inventory Reference
                </Label>
                {selectedSkuItem && !skuDropdownOpen ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-info/30 bg-info/5">
                    {(selectedSkuItem as any).image_url && (
                      <img src={(selectedSkuItem as any).image_url} alt={selectedSkuItem.name} className="w-10 h-10 rounded-lg object-cover border border-border/50 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedSkuItem.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedSkuItem.sku_id}</p>
                      <p className="text-[10px] text-muted-foreground">{selectedSkuItem.category} · {selectedSkuItem.size_spec} · {selectedSkuItem.color_variant} · Stock: {selectedSkuItem.qty_on_hand} {selectedSkuItem.unit}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSkuDropdownOpen(true); setSkuSearch(''); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setForm(prev => ({ ...prev, source_ref_id: '', image_url: '' }))}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={skuSearch}
                      onChange={e => { setSkuSearch(e.target.value); setSkuDropdownOpen(true); }}
                      onFocus={() => setSkuDropdownOpen(true)}
                      placeholder="Search packaging SKUs or sealed vault items..."
                      className="pl-9"
                    />
                    {skuDropdownOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                        {skuOptions.length === 0 ? (
                          <p className="p-3 text-sm text-muted-foreground text-center">No matching items found</p>
                        ) : (
                          skuOptions.map(sku => (
                            <button
                              key={sku.sku_id}
                              onClick={() => handleSkuSelect(sku)}
                              className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b border-border/30 last:border-0 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{sku.name}</span>
                                <Badge variant="outline" className="text-[10px] ml-2">{sku.category}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono text-muted-foreground">{sku.sku_id}</span>
                                <span className="text-[10px] text-muted-foreground">{sku.size_spec} · {sku.color_variant}</span>
                                <span className="text-[10px] text-info ml-auto">Stock: {sku.qty_on_hand}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-info">Select from Packaging & Materials or Sealed Vault inventory. Image and cost auto-fetched.</p>
              </div>

              <div className="space-y-2">
                <Label>Unit Cost (AED) {form.source_ref_id && <span className="text-[10px] text-muted-foreground ml-1">(auto-populated from inventory)</span>}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.unit_cost ?? 0}
                  onChange={e => setForm(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                  readOnly={!!form.source_ref_id}
                  className={form.source_ref_id ? 'bg-muted/50 cursor-not-allowed' : ''}
                />
              </div>
            </>
          )}

          {/* Auto-fetched image preview (no manual Image URL field per D1) */}
          {form.image_url && (
            <img src={form.image_url} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border/50" />
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} placeholder="Optional notes about this component..." />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.is_variable ?? false}
              onCheckedChange={v => {
                const isVar = !!v;
                setForm(prev => ({
                  ...prev,
                  is_variable: isVar,
                  unit_cost: isVar ? 0 : prev.unit_cost,
                  source: isVar && prev.category === 'perfume' ? 'sealed_vault' as const : prev.source,
                }));
              }}
            />
            <Label className="text-sm">Variable cost (e.g. perfume — cost depends on which one is selected)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>
            <Save className="w-4 h-4 mr-1.5" /> {isEdit ? 'Save Changes' : 'Create Component'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
