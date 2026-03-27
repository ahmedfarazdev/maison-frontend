// ============================================================
// BOMs Creation — BOM Templates + Shipping BOMs + Visual Designer
// Extracted from BOMSetup for cleaner navigation
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
import { toast } from 'sonner';
import {
  Package, Plus, Search, Edit, Copy, Archive, Eye, Layers,
  Box, Droplets, Tag, Sparkles, RotateCcw, Truck,
  DollarSign, Hash, CheckCircle2, Trash2, Save,
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
// BOM Templates Tab
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
          const serial = `BOM-${String(idx + 1).padStart(3, '0')}`;

          return (
            <Card key={bom.bom_id} className={cn('hover:shadow-md transition-all cursor-pointer border-border/60 group', bom.status === 'archived' && 'opacity-60')} onClick={() => setSelectedBOM(bom)}>
              <CardContent className="p-0">
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

                  <div className="flex flex-wrap gap-1">
                    {bom.line_items.slice(0, 4).map(li => (
                      <Badge key={li.line_id} variant="outline" className="text-[9px] gap-0.5">
                        {li.component.name} ×{li.qty}
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
// Shipping BOMs Tab
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
      const nextSerial = shippingBOMs.length + 1;
      const serialPrefix = `SHIP-${String(nextSerial).padStart(3, '0')}`;
      const newBom = { ...bom, name: bom.name.startsWith('SHIP-') ? bom.name : `${serialPrefix} · ${bom.name}` };
      setShippingBOMs(prev => [...prev, newBom]);
      toast.success(`Created "${newBom.name}"`);
    }
    setShowNew(false);
    setEditBOM(null);
  };

  const handleDuplicate = (bom: BOMTemplate) => {
    const nextSerial = shippingBOMs.length + 1;
    const serialPrefix = `SHIP-${String(nextSerial).padStart(3, '0')}`;
    const baseName = bom.name.replace(/^SHIP-\d+\s*·\s*/, '');
    const newBom: BOMTemplate = {
      ...bom,
      bom_id: `bom-ship-${Date.now()}`,
      name: `${serialPrefix} · ${baseName} (Copy)`,
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Shipping BOMs" value={stats.total} icon={Truck} variant="default" />
        <KPICard label="Active" value={stats.active} icon={CheckCircle2} variant="success" />
        <KPICard label="Avg Cost" value={`AED ${stats.avgCost.toFixed(2)}`} icon={DollarSign} variant="gold" />
        <KPICard label="Products Linked" value={stats.linkedProducts} icon={Package} variant="default" />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search shipping BOMs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
          <Plus className="w-4 h-4" /> New Shipping BOM
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(bom => {
          const linkedCount = getLinkedProductCount(bom.bom_id);
          const serial = bom.name.match(/^(SHIP-\d+)/)?.[1] || bom.bom_id;
          const displayName = bom.name.replace(/^SHIP-\d+\s*·\s*/, '');

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

                  <div className="flex flex-wrap gap-1">
                    {bom.line_items.slice(0, 5).map(li => (
                      <Badge key={li.line_id} variant="outline" className="text-[9px] gap-0.5">
                        {li.component.name} ×{li.qty}
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
// Main BOMs Creation Page
// ============================================================
export default function BOMsCreation() {
  const [products] = useState<EndProduct[]>(initialEndProducts);
  const [boms, setBoms] = useState<BOMTemplate[]>(initialBomTemplates);
  const [shippingBOMs, setShippingBOMs] = useState<BOMTemplate[]>(initialShippingBOMs);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="BOMs Creation"
        subtitle="Create and manage product BOMs, shipping BOMs, and visualize component structures"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'BOM Setup' },
          { label: 'BOMs Creation' },
        ]}
      />

      <div className="p-6">
        <Tabs defaultValue="boms" className="space-y-6">
          <TabsList>
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
