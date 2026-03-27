// ============================================================
// Create Products — Production Center
// Select End Product (BOM) → Select Perfumes → Set Quantity → Create Job
// Round 40: Major operations restructure
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { PageHeader, SectionCard, KPICard, EmptyState, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Package, Plus, Search, Sparkles, Layers, Box, Droplets, Tag,
  ArrowRight, CheckCircle2, AlertTriangle, FlaskConical, Beaker,
  Hash, DollarSign, Settings2, Eye, ChevronRight, Factory,
  Puzzle, RotateCcw, Gift, CreditCard, Building, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  endProducts as allEndProducts,
  bomTemplates,
} from '@/lib/bom-data';
import { categoryConfig } from '@/lib/product-categories';
import { mockPerfumes } from '@/lib/mock-data';
import type { EndProduct, BOMLineItem, BOMComponent, EndProductCategory } from '@/types';

// ---- Production Funnel Stages ----
const FUNNEL_STAGES = [
  { id: 'picking', label: 'F1 · Picking', icon: Package, color: 'bg-amber-500' },
  { id: 'prep_labels', label: 'F2 · Prep Labels', icon: Tag, color: 'bg-blue-500' },
  { id: 'print', label: 'F3 · Print', icon: Settings2, color: 'bg-indigo-500' },
  { id: 'decanting', label: 'F4 · Decanting', icon: FlaskConical, color: 'bg-purple-500' },
  { id: 'compile', label: 'F5 · Compile', icon: Layers, color: 'bg-orange-500' },
  { id: 'qc', label: 'F6 · QC', icon: CheckCircle2, color: 'bg-teal-500' },
  { id: 'log_inventory', label: 'F7 · Log Inventory', icon: Box, color: 'bg-emerald-500' },
];

// Categories that make sense for internal production
const PRODUCIBLE_CATEGORIES: EndProductCategory[] = [
  'capsule_themed_set', 'capsule_house_chapter', 'capsule_layering_set', 'capsule_scent_story',
  'whisperer_set', 'gift_set_him', 'gift_set_her', 'gift_set_seasonal',
  'single_aurakey', 'aurakey_refills',
];

interface PerfumeSelection {
  slotIndex: number;
  perfumeId: string;
  perfumeName: string;
  brand: string;
  sizeml: number;
}

interface ProductionJob {
  jobId: string;
  productId: string;
  productName: string;
  productSku: string;
  category: EndProductCategory;
  quantity: number;
  perfumes: PerfumeSelection[];
  totalVials: number;
  totalMl: number;
  status: 'draft' | 'queued' | 'in_progress' | 'completed';
  createdAt: string;
  notes: string;
}

export default function CreateProducts() {
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [recentJobs, setRecentJobs] = useState<ProductionJob[]>([
    {
      jobId: 'PJ-001', productId: 'ep-capsule-oud-legacy', productName: 'Oud Legacy Collection',
      productSku: 'EM/PRD/CTS-OUDL', category: 'capsule_themed_set', quantity: 25,
      perfumes: [
        { slotIndex: 0, perfumeId: 'p-oud-wood', perfumeName: 'Oud Wood', brand: 'Tom Ford', sizeml: 8 },
        { slotIndex: 1, perfumeId: 'p-oud-ispahan', perfumeName: 'Oud Ispahan', brand: 'Dior', sizeml: 8 },
        { slotIndex: 2, perfumeId: 'p-oud-satin', perfumeName: 'Oud Satin Mood', brand: 'MFK', sizeml: 8 },
      ],
      totalVials: 75, totalMl: 600, status: 'in_progress', createdAt: '2026-02-25T10:00:00Z', notes: 'Capsule drop for March cycle',
    },
    {
      jobId: 'PJ-002', productId: 'ep-gift-rose-disc', productName: 'Rose & Oud Discovery',
      productSku: 'EM/PRD/GSR-ROSE', category: 'gift_set_her', quantity: 40,
      perfumes: [
        { slotIndex: 0, perfumeId: 'p-lost-cherry', perfumeName: 'Lost Cherry', brand: 'Tom Ford', sizeml: 8 },
        { slotIndex: 1, perfumeId: 'p-delina', perfumeName: 'Delina', brand: 'PDM', sizeml: 8 },
      ],
      totalVials: 80, totalMl: 640, status: 'queued', createdAt: '2026-02-26T14:00:00Z', notes: 'Restock for March',
    },
    {
      jobId: 'PJ-003', productId: 'ep-whisper-sampler', productName: 'Whisperer Sampler Set',
      productSku: 'EM/PRD/WSP-SAMP', category: 'whisperer_set', quantity: 100,
      perfumes: [
        { slotIndex: 0, perfumeId: 'p-br540', perfumeName: 'Baccarat Rouge 540', brand: 'MFK', sizeml: 2 },
        { slotIndex: 1, perfumeId: 'p-aventus', perfumeName: 'Aventus', brand: 'Creed', sizeml: 2 },
        { slotIndex: 2, perfumeId: 'p-layton', perfumeName: 'Layton', brand: 'PDM', sizeml: 2 },
      ],
      totalVials: 300, totalMl: 600, status: 'completed', createdAt: '2026-02-20T09:00:00Z', notes: 'Whisper sampler batch',
    },
  ]);

  // Producible end products
  const producibleProducts = useMemo(() =>
    allEndProducts.filter(p => p.active && PRODUCIBLE_CATEGORIES.includes(p.category)),
    []
  );

  // Stats
  const stats = useMemo(() => ({
    totalJobs: recentJobs.length,
    inProgress: recentJobs.filter(j => j.status === 'in_progress').length,
    queued: recentJobs.filter(j => j.status === 'queued').length,
    completed: recentJobs.filter(j => j.status === 'completed').length,
    totalVials: recentJobs.reduce((sum, j) => sum + j.totalVials, 0),
  }), [recentJobs]);

  // Filter recent jobs
  const filteredJobs = useMemo(() => {
    let result = recentJobs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.productName.toLowerCase().includes(q) ||
        j.jobId.toLowerCase().includes(q) ||
        j.productSku.toLowerCase().includes(q)
      );
    }
    return result;
  }, [recentJobs, searchQuery]);

  const handleJobCreated = useCallback((job: ProductionJob) => {
    setRecentJobs(prev => [job, ...prev]);
    setShowCreate(false);
    toast.success(`Production job ${job.jobId} created — ${job.quantity} units queued`);
  }, []);

  const statusConfig: Record<string, { label: string; variant: 'muted' | 'info' | 'gold' | 'success' }> = {
    draft: { label: 'Draft', variant: 'muted' },
    queued: { label: 'Queued', variant: 'info' },
    in_progress: { label: 'In Progress', variant: 'gold' },
    completed: { label: 'Completed', variant: 'success' },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Products"
        subtitle="Select an End Product, choose perfumes, set quantity — create a production job"
        actions={
          <Button onClick={() => setShowCreate(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            <Plus className="w-4 h-4" /> New Production Job
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard label="Total Jobs" value={stats.totalJobs} icon={Factory} />
        <KPICard label="In Progress" value={stats.inProgress} icon={FlaskConical} variant={stats.inProgress > 0 ? 'default' : 'default'} />
        <KPICard label="Queued" value={stats.queued} icon={Layers} />
        <KPICard label="Completed" value={stats.completed} icon={CheckCircle2} />
        <KPICard label="Total Vials" value={stats.totalVials.toLocaleString()} icon={Droplets} />
      </div>

      {/* Production Funnel Overview */}
      <SectionCard title="Production Funnel" subtitle="7-stage process for internal product creation">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {FUNNEL_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="flex items-center">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 min-w-[130px]">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold', stage.color)}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{stage.label.split(' · ')[1]}</div>
                    <div className="text-[10px] text-muted-foreground">{stage.label.split(' · ')[0]}</div>
                  </div>
                </div>
                {i < FUNNEL_STAGES.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-0.5 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Recent Production Jobs */}
      <SectionCard
        title="Production Jobs"
        subtitle={`${filteredJobs.length} jobs`}
        headerActions={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        }
      >
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No production jobs yet"
            description="Create your first production job to start manufacturing products."
            action={<Button onClick={() => setShowCreate(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"><Plus className="w-4 h-4" /> New Production Job</Button>}
          />
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(job => {
              const cat = categoryConfig[job.category];
              const CatIcon = cat?.icon || Package;
              const sc = statusConfig[job.status];
              return (
                <Card key={job.jobId} className="hover:shadow-md transition-shadow cursor-pointer border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-muted/80 shrink-0')}>
                          <CatIcon className={cn('w-5 h-5', cat?.color || 'text-muted-foreground')} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{job.jobId}</span>
                            <StatusBadge variant={sc.variant}>{sc.label}</StatusBadge>
                          </div>
                          <h4 className="font-semibold text-sm truncate">{job.productName}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            SKU: {job.productSku} · {cat?.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div>
                          <div className="text-lg font-bold">{job.quantity}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">Units</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{job.totalVials}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">Vials</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{job.totalMl}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">ml</div>
                        </div>
                      </div>
                    </div>
                    {/* Perfume chips */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {job.perfumes.map((p, i) => (
                        <Badge key={i} variant="outline" className="text-[11px] gap-1 font-normal">
                          <Droplets className="w-3 h-3 text-purple-500" />
                          {p.perfumeName} ({p.brand}) · {p.sizeml}ml
                        </Badge>
                      ))}
                    </div>
                    {job.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">{job.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Create Production Job Dialog */}
      {showCreate && (
        <CreateProductionJobDialog
          products={producibleProducts}
          onClose={() => setShowCreate(false)}
          onCreated={handleJobCreated}
          nextJobId={`PJ-${String(recentJobs.length + 1).padStart(3, '0')}`}
        />
      )}
    </div>
  );
}

// ============================================================
// Create Production Job Dialog — Multi-step wizard
// ============================================================
function CreateProductionJobDialog({
  products, onClose, onCreated, nextJobId,
}: {
  products: EndProduct[];
  onClose: () => void;
  onCreated: (job: ProductionJob) => void;
  nextJobId: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProduct, setSelectedProduct] = useState<EndProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState('');
  const [perfumeSelections, setPerfumeSelections] = useState<PerfumeSelection[]>([]);
  const [perfumeSearch, setPerfumeSearch] = useState('');

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = products;
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }
    if (productSearch) {
      const q = productSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, categoryFilter, productSearch]);

  // Get variable (perfume) slots from BOM
  const variableSlots = useMemo(() => {
    if (!selectedProduct?.bom) return [];
    return selectedProduct.bom.line_items.filter(li => li.component.is_variable);
  }, [selectedProduct]);

  // Initialize perfume selections when product changes
  const handleSelectProduct = useCallback((product: EndProduct) => {
    setSelectedProduct(product);
    if (product.bom) {
      const slots = product.bom.line_items.filter(li => li.component.is_variable);
      setPerfumeSelections(slots.map((slot, i) => ({
        slotIndex: i,
        perfumeId: '',
        perfumeName: '',
        brand: '',
        sizeml: slot.component.decant_size_ml || 8,
      })));
    }
    setStep(2);
  }, []);

  // Available perfumes for selection
  const availablePerfumes = useMemo(() => {
    let result = mockPerfumes.filter(p => p.visibility === 'active');
    if (perfumeSearch) {
      const q = perfumeSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }
    return result;
  }, [perfumeSearch]);

  const handlePerfumeSelect = useCallback((slotIndex: number, perfumeId: string) => {
    const perfume = mockPerfumes.find(p => p.master_id === perfumeId);
    if (!perfume) return;
    setPerfumeSelections(prev => prev.map(s =>
      s.slotIndex === slotIndex
        ? { ...s, perfumeId, perfumeName: perfume.name, brand: perfume.brand }
        : s
    ));
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    const totalVials = perfumeSelections.length * quantity;
    const totalMl = perfumeSelections.reduce((sum, p) => sum + p.sizeml * quantity, 0);
    const fixedCost = (selectedProduct?.fixed_price || 0) * quantity;
    const variableCost = (selectedProduct?.variable_price || 0) * quantity;
    return { totalVials, totalMl, fixedCost, variableCost, totalCost: fixedCost + variableCost };
  }, [perfumeSelections, quantity, selectedProduct]);

  const allPerfumesSelected = perfumeSelections.every(s => s.perfumeId);

  const handleCreate = useCallback(() => {
    if (!selectedProduct || !allPerfumesSelected) return;
    const job: ProductionJob = {
      jobId: nextJobId,
      productId: selectedProduct.product_id,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      category: selectedProduct.category,
      quantity,
      perfumes: perfumeSelections,
      totalVials: totals.totalVials,
      totalMl: totals.totalMl,
      status: 'queued',
      createdAt: new Date().toISOString(),
      notes,
    };
    onCreated(job);
  }, [selectedProduct, allPerfumesSelected, quantity, perfumeSelections, totals, notes, nextJobId, onCreated]);

  // Unique categories for filter
  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return cats.sort();
  }, [products]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-gold" />
            Create Production Job
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Step 1 of 3 — Select an End Product from the BOM catalog'}
            {step === 2 && 'Step 2 of 3 — Select perfumes for variable slots and set quantity'}
            {step === 3 && 'Step 3 of 3 — Review and confirm production job'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                s === step ? 'bg-gold text-gold-foreground' :
                s < step ? 'bg-emerald-500 text-white' :
                'bg-muted text-muted-foreground'
              )}>
                {s < step ? '✓' : s}
              </div>
              <span className={cn('text-sm', s === step ? 'font-medium' : 'text-muted-foreground')}>
                {s === 1 ? 'Product' : s === 2 ? 'Perfumes' : 'Review'}
              </span>
              {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Product */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(cat => {
                    const conf = categoryConfig[cat];
                    return <SelectItem key={cat} value={cat}>{conf?.label || String(cat)}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredProducts.map(product => {
                const cat = categoryConfig[product.category];
                const CatIcon = cat?.icon || Package;
                const isSelected = selectedProduct?.product_id === product.product_id;
                const variableCount = product.bom?.line_items.filter(li => li.component.is_variable).length || 0;
                const fixedCount = product.bom?.line_items.filter(li => !li.component.is_variable).length || 0;
                return (
                  <button
                    key={product.product_id}
                    onClick={() => handleSelectProduct(product)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm',
                      isSelected ? 'border-gold bg-gold/5' : 'border-border/60 hover:border-border'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                        <CatIcon className={cn('w-4.5 h-4.5', cat?.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{product.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{cat?.label}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          SKU: {product.sku} · {fixedCount} fixed + {variableCount} variable components
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No producible products found. Check BOM & Products to create end products first.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Perfumes + Quantity */}
        {step === 2 && selectedProduct && (
          <div className="space-y-5">
            {/* Selected product summary */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm">{selectedProduct.name}</span>
                <Badge variant="outline" className="text-[10px]">{selectedProduct.sku}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{selectedProduct.description}</p>
            </div>

            {/* BOM Components (fixed) */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Puzzle className="w-4 h-4 text-muted-foreground" />
                Fixed Components (auto-included)
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedProduct.bom?.line_items
                  .filter(li => !li.component.is_variable)
                  .map(li => (
                    <Badge key={li.line_id} variant="secondary" className="text-[11px] gap-1">
                      {li.component.name} ×{li.qty}
                    </Badge>
                  ))
                }
              </div>
            </div>

            {/* Variable (Perfume) Slots */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-purple-500" />
                Perfume Slots ({variableSlots.length} to fill)
              </h4>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search perfumes..."
                  value={perfumeSearch}
                  onChange={e => setPerfumeSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="space-y-3">
                {perfumeSelections.map((slot, i) => {
                  const varSlot = variableSlots[i];
                  return (
                    <div key={i} className="p-3 rounded-lg border border-border/60 bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-purple-600">{i + 1}</span>
                        </div>
                        <span className="text-sm font-medium">
                          {varSlot?.component.name || `Perfume Slot ${i + 1}`}
                        </span>
                        <span className="text-xs text-muted-foreground">({slot.sizeml}ml)</span>
                      </div>
                      <Select
                        value={slot.perfumeId || undefined}
                        onValueChange={val => handlePerfumeSelect(i, val)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select a perfume..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {availablePerfumes.map(p => (
                            <SelectItem key={p.master_id} value={p.master_id}>
                              {p.name} — {p.brand} ({p.concentration})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {slot.perfumeId && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">
                            {slot.perfumeName} ({slot.brand})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Production Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1.5"
                />
                <p className="text-[11px] text-muted-foreground mt-1">How many units to produce</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g., March capsule drop, restock for Eid..."
                  className="mt-1.5 h-[76px] resize-none"
                />
              </div>
            </div>

            {/* Auto-calculated totals */}
            <div className="grid grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-center">
                <div className="text-lg font-bold">{totals.totalVials}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Total Vials</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{totals.totalMl.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Total ml</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">AED {totals.fixedCost.toFixed(0)}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Fixed Cost</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gold">AED {totals.totalCost.toFixed(0)}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Est. Total</div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!allPerfumesSelected}
                className="bg-gold hover:bg-gold/90 text-gold-foreground"
              >
                Review → 
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && selectedProduct && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-gold/30 bg-gold/5">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-gold" /> Production Job Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Job ID:</span>{' '}
                  <span className="font-mono font-medium">{nextJobId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Product:</span>{' '}
                  <span className="font-medium">{selectedProduct.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SKU:</span>{' '}
                  <span className="font-mono">{selectedProduct.sku}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>{' '}
                  <span>{categoryConfig[selectedProduct.category]?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantity:</span>{' '}
                  <span className="font-bold">{quantity} units</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Vials:</span>{' '}
                  <span className="font-bold">{totals.totalVials}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Liquid:</span>{' '}
                  <span className="font-bold">{totals.totalMl.toLocaleString()} ml</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Cost:</span>{' '}
                  <span className="font-bold text-gold">AED {totals.totalCost.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Perfume selections */}
            <div>
              <h4 className="text-sm font-medium mb-2">Selected Perfumes</h4>
              <div className="space-y-1.5">
                {perfumeSelections.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border/40">
                    <div className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-purple-600">{i + 1}</span>
                    </div>
                    <Droplets className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-sm font-medium">{p.perfumeName}</span>
                    <span className="text-xs text-muted-foreground">({p.brand})</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.sizeml}ml × {quantity} = {p.sizeml * quantity}ml</span>
                  </div>
                ))}
              </div>
            </div>

            {notes && (
              <div className="p-2 rounded bg-muted/20 border border-border/40">
                <span className="text-xs text-muted-foreground">Notes:</span>{' '}
                <span className="text-sm">{notes}</span>
              </div>
            )}

            {/* Funnel preview */}
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Production Funnel</h4>
              <div className="flex items-center gap-1 flex-wrap">
                {FUNNEL_STAGES.map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <div className={cn('w-2 h-2 rounded-full', stage.color)} />
                      {stage.label.split(' · ')[1]}
                    </Badge>
                    {i < FUNNEL_STAGES.length - 1 && <span className="text-muted-foreground/30">→</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button
                onClick={handleCreate}
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              >
                <Factory className="w-4 h-4" /> Create Production Job
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
