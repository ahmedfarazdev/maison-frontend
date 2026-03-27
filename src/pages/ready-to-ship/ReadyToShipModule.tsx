// ============================================================
// Ready-to-Ship Products — Production Hub (Overview)
// Clean overview: KPI cards + Product Registry + Active Production
// Floating "Create Batch" button opens the BOM wizard
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Package, Plus, Search, Layers, Box, Droplets,
  ArrowRight, CheckCircle2, FlaskConical,
  Eye, Factory, QrCode,
  ChevronRight, Puzzle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  endProducts as allEndProducts,
} from '@/lib/bom-data';
import { categoryConfig } from '@/lib/product-categories';
import { mockPerfumes } from '@/lib/mock-data';
import type { EndProduct, EndProductCategory } from '@/types';

// ---- Producible categories ----
const PRODUCIBLE_CATEGORIES: EndProductCategory[] = [
  'capsule_themed_set', 'capsule_house_chapter', 'capsule_layering_set', 'capsule_scent_story',
  'whisperer_set', 'gift_set_him', 'gift_set_her', 'gift_set_seasonal',
  'single_aurakey', 'aurakey_refills',
];

// ---- Pipeline Stages (for progress dots in active production) ----
const PIPELINE_STAGES = [
  { id: 'picking', label: 'Picking', icon: Package, color: 'bg-amber-500' },
  { id: 'print_labels_prep', label: 'Print Labels & Prep', icon: QrCode, color: 'bg-blue-500' },
  { id: 'decanting', label: 'Decanting', icon: FlaskConical, color: 'bg-purple-500' },
  { id: 'assembly', label: 'Assembly', icon: Layers, color: 'bg-orange-500' },
  { id: 'qc', label: 'QC', icon: CheckCircle2, color: 'bg-teal-500' },
  { id: 'log_inventory', label: 'Log Inventory', icon: Box, color: 'bg-emerald-500' },
] as const;

type PipelineStageId = typeof PIPELINE_STAGES[number]['id'];
type BatchStatus = 'draft' | 'queued' | 'in_production' | 'completed';

interface PerfumeSelection {
  slotIndex: number;
  perfumeId: string;
  perfumeName: string;
  brand: string;
  sizeml: number;
}

interface ProductBatch {
  id: string;
  productName: string;
  productSku: string;
  category: string;
  quantity: number;
  completedQty: number;
  stage: PipelineStageId;
  status: BatchStatus;
  priority: 'urgent' | 'high' | 'normal';
  createdAt: string;
  dueDate?: string;
  perfumes: { name: string; brand: string; sizeml: number }[];
  bomRef?: string;
  assignedTeam?: string;
  totalVials?: number;
  totalMl?: number;
  notes?: string;
}

// ---- Mock Registry Products ----
const mockRegistryProducts = [
  { sku: 'EM/RTS/CTS-OUDL', name: 'Oud Legacy Collection', category: 'Capsule', stock: 142, lastProduced: '2026-02-20', status: 'in_stock' as const },
  { sku: 'EM/RTS/GSR-ROSE', name: 'Rose & Oud Discovery', category: 'Gift Set', stock: 87, lastProduced: '2026-02-18', status: 'in_stock' as const },
  { sku: 'EM/RTS/WSP-SAMP', name: 'Whisperer Sampler Set', category: 'Whisperer', stock: 12, lastProduced: '2026-02-15', status: 'low_stock' as const },
  { sku: 'EM/RTS/AKR-MAR', name: 'AuraKey Refill Packs — March', category: 'AuraKey Refill', stock: 0, lastProduced: '2026-01-28', status: 'out_of_stock' as const },
  { sku: 'EM/RTS/CLS-NICHE', name: 'Niche Legends Capsule', category: 'Capsule', stock: 240, lastProduced: '2026-02-22', status: 'in_stock' as const },
  { sku: 'EM/RTS/GSH-EID', name: 'Eid Gift Set — Him', category: 'Gift Set', stock: 55, lastProduced: '2026-02-10', status: 'in_stock' as const },
];

// ---- Mock Active Batches ----
const mockBatches: ProductBatch[] = [
  {
    id: 'RTS-B001', productName: 'Capsule Drop — House of Oud Chapter', productSku: 'EM/RTS/CTS-OUDL',
    category: 'Capsule', quantity: 600, completedQty: 340, stage: 'assembly', status: 'in_production',
    priority: 'high', createdAt: '2026-02-25', dueDate: '2026-03-05',
    perfumes: [{ name: 'Oud Ispahan', brand: 'Dior', sizeml: 8 }, { name: 'Oud Wood', brand: 'Tom Ford', sizeml: 8 }],
    bomRef: 'BOM-CAP-001', assignedTeam: 'Team Alpha',
    totalVials: 1200, totalMl: 9600, notes: 'March capsule drop',
  },
  {
    id: 'RTS-B002', productName: 'Gift Set — Discovery Collection', productSku: 'EM/RTS/GSR-DISC',
    category: 'Gift Set', quantity: 500, completedQty: 0, stage: 'picking', status: 'queued',
    priority: 'normal', createdAt: '2026-02-27', dueDate: '2026-03-10',
    perfumes: [{ name: 'Aventus', brand: 'Creed', sizeml: 8 }, { name: 'Bleu de Chanel', brand: 'Chanel', sizeml: 8 }],
    bomRef: 'BOM-GS-012',
    totalVials: 1000, totalMl: 8000, notes: 'Restock for March',
  },
  {
    id: 'RTS-B003', productName: 'AuraKey Refill Packs — March Stock', productSku: 'EM/RTS/AKR-MAR',
    category: 'AuraKey Refill', quantity: 1600, completedQty: 1200, stage: 'qc', status: 'in_production',
    priority: 'urgent', createdAt: '2026-02-20', dueDate: '2026-03-01',
    perfumes: [{ name: 'Aventus', brand: 'Creed', sizeml: 8 }, { name: 'Green Irish Tweed', brand: 'Creed', sizeml: 8 }],
    bomRef: 'BOM-AKR-003', assignedTeam: 'Team Bravo',
    totalVials: 3200, totalMl: 25600, notes: 'Urgent restock — low inventory',
  },
  {
    id: 'RTS-B004', productName: 'Niche Legends Capsule', productSku: 'EM/RTS/CLS-NICHE',
    category: 'Capsule', quantity: 240, completedQty: 240, stage: 'log_inventory', status: 'completed',
    priority: 'normal', createdAt: '2026-02-15',
    perfumes: [{ name: 'Baccarat Rouge 540', brand: 'MFK', sizeml: 8 }, { name: 'Layton', brand: 'PDM', sizeml: 8 }],
    totalVials: 480, totalMl: 3840,
  },
];

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  high: { label: 'High', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  queued: { label: 'Queued', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'In Production', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
};

const STOCK_CONFIG = {
  in_stock: { label: 'In Stock', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  low_stock: { label: 'Low Stock', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function ReadyToShipModule() {
  const [registrySearch, setRegistrySearch] = useState('');
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [batches, setBatches] = useState(mockBatches);

  // Producible end products for the wizard
  const producibleProducts = useMemo(() =>
    allEndProducts.filter(p => p.active && PRODUCIBLE_CATEGORIES.includes(p.category)),
    []
  );

  // Stats
  const stats = useMemo(() => ({
    totalProducts: mockRegistryProducts.length,
    inStock: mockRegistryProducts.filter(p => p.status === 'in_stock').length,
    lowStock: mockRegistryProducts.filter(p => p.status === 'low_stock').length,
    outOfStock: mockRegistryProducts.filter(p => p.status === 'out_of_stock').length,
    activeBatches: batches.filter(b => b.status === 'in_production').length,
    queuedBatches: batches.filter(b => b.status === 'queued').length,
    completedBatches: batches.filter(b => b.status === 'completed').length,
    totalUnitsInProd: batches.filter(b => b.status !== 'completed').reduce((s, b) => s + b.quantity, 0),
  }), [batches]);

  const filteredRegistry = useMemo(() => {
    if (!registrySearch) return mockRegistryProducts;
    const q = registrySearch.toLowerCase();
    return mockRegistryProducts.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [registrySearch]);

  const handleJobCreated = useCallback((batch: ProductBatch) => {
    setBatches(prev => [batch, ...prev]);
    setShowCreateJob(false);
    toast.success(`Production batch ${batch.id} created — ${batch.quantity} units queued`);
  }, []);

  return (
    <div className="space-y-6 relative">
      <PageHeader
        title="Production Hub"
        subtitle="Overview of ready-to-ship product inventory and active production"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Products</div>
            <div className="text-2xl font-bold mt-1">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Stock</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.inStock}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Low Stock</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.lowStock}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.outOfStock}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Production</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">{stats.activeBatches}</div>
            <div className="text-[10px] text-muted-foreground">{stats.totalUnitsInProd.toLocaleString()} units</div>
          </CardContent>
        </Card>
      </div>

      {/* Product Registry Table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-border/60">
            <div>
              <h3 className="text-sm font-semibold">Product Registry</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{filteredRegistry.length} registered products</p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={registrySearch}
                onChange={e => setRegistrySearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Produced</th>
                  <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistry.map(product => {
                  const sc = STOCK_CONFIG[product.status];
                  return (
                    <tr key={product.sku} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">{product.sku}</td>
                      <td className="py-2.5 px-4 font-medium">{product.name}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold tabular-nums">{product.stock}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className={cn('text-[10px] gap-1', sc.color)}>
                          <div className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
                          {sc.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {new Date(product.lastProduced).toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {(product.status === 'out_of_stock' || product.status === 'low_stock') && (
                          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowCreateJob(true)}>
                            Reorder
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Active Production Summary */}
      {batches.filter(b => b.status !== 'completed').length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div>
                <h3 className="text-sm font-semibold">Active Production</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{stats.activeBatches} in production, {stats.queuedBatches} queued</p>
              </div>
            </div>
            <div className="divide-y divide-border/30">
              {batches.filter(b => b.status !== 'completed').map(batch => {
                const progress = batch.quantity > 0 ? Math.round((batch.completedQty / batch.quantity) * 100) : 0;
                const stage = PIPELINE_STAGES.find(s => s.id === batch.stage);
                const stageIdx = PIPELINE_STAGES.findIndex(s => s.id === batch.stage);
                return (
                  <div key={batch.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn('w-2 h-8 rounded-full', PRIORITY_CONFIG[batch.priority].dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{batch.id}</span>
                          <Badge variant="outline" className={cn('text-[10px]', STATUS_CONFIG[batch.status].color)}>
                            {STATUS_CONFIG[batch.status].label}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px]', PRIORITY_CONFIG[batch.priority].color)}>
                            {PRIORITY_CONFIG[batch.priority].label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{batch.productName}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {stage && <stage.icon className="w-2.5 h-2.5" />}
                          {stage?.label}
                        </Badge>
                        <div className="w-20">
                          <Progress value={progress} className="h-1.5" />
                        </div>
                        <span className="text-xs font-medium tabular-nums w-16 text-right">{batch.completedQty}/{batch.quantity}</span>

                      </div>
                    </div>
                    {/* Mini pipeline progress dots */}
                    <div className="flex items-center gap-0.5 mt-2 ml-6">
                      {PIPELINE_STAGES.map((s, i) => {
                        const isComplete = i < stageIdx;
                        const isCurrent = s.id === batch.stage;
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-colors',
                              isComplete ? s.color :
                              isCurrent ? `${s.color} animate-pulse` :
                              'bg-muted'
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently Completed */}
      {stats.completedBatches > 0 && (
        <Card className="border-emerald-200/60">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4 border-b border-emerald-200/40 bg-emerald-50/30">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500 text-white">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-emerald-800">Recently Completed</h3>
                <p className="text-xs text-emerald-600/70">Products logged to inventory</p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                {stats.completedBatches}
              </Badge>
            </div>
            <div className="divide-y divide-emerald-100">
              {batches.filter(b => b.status === 'completed').map(batch => (
                <div key={batch.id} className="flex items-center gap-4 px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{batch.productName}</p>
                    <p className="text-[10px] text-muted-foreground">{batch.id} · {batch.quantity} units</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1 border-emerald-200 text-emerald-600">
                    <QrCode className="w-2.5 h-2.5" /> SKU Label Generated
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {batches.length === 0 && (
        <EmptyState icon={Factory} title="No production data" description="Create a new batch to start producing ready-to-ship products." />
      )}

      {/* Floating Create Batch Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button
          onClick={() => setShowCreateJob(true)}
          className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2 shadow-lg shadow-gold/20 h-12 px-6 rounded-full text-sm font-semibold"
        >
          <Plus className="w-5 h-5" /> Create Batch
        </Button>
      </div>

      {/* Create Job Dialog — BOM Wizard */}
      {showCreateJob && (
        <CreateJobWizard
          products={producibleProducts}
          onClose={() => setShowCreateJob(false)}
          onCreated={handleJobCreated}
          nextId={`RTS-B${String(batches.length + 1).padStart(3, '0')}`}
        />
      )}
    </div>
  );
}

// ============================================================
// Create Job Wizard — 3-step BOM-based creation
// ============================================================
function CreateJobWizard({
  products, onClose, onCreated, nextId,
}: {
  products: EndProduct[];
  onClose: () => void;
  onCreated: (batch: ProductBatch) => void;
  nextId: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProduct, setSelectedProduct] = useState<EndProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal'>('normal');
  const [dueDate, setDueDate] = useState('');
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

  // Unique categories for filter
  const uniqueCategories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category)));
    return cats.sort();
  }, [products]);

  const handleCreate = useCallback(() => {
    if (!selectedProduct) return;
    const batch: ProductBatch = {
      id: nextId,
      productName: selectedProduct.name,
      productSku: selectedProduct.sku,
      category: categoryConfig[selectedProduct.category]?.label || selectedProduct.category,
      quantity,
      completedQty: 0,
      stage: 'picking',
      status: 'queued',
      priority,
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: dueDate || undefined,
      perfumes: perfumeSelections.map(p => ({ name: p.perfumeName, brand: p.brand, sizeml: p.sizeml })),
      bomRef: selectedProduct.bom?.bom_id,
      totalVials: totals.totalVials,
      totalMl: totals.totalMl,
      notes,
    };
    onCreated(batch);
  }, [selectedProduct, quantity, priority, dueDate, perfumeSelections, totals, notes, nextId, onCreated]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-gold" />
            Create Production Batch
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Step 1 of 3 — Select an End Product from the BOM catalog'}
            {step === 2 && 'Step 2 of 3 — Select perfumes for variable slots and set quantity'}
            {step === 3 && 'Step 3 of 3 — Review and confirm production batch'}
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
                const variableCount = product.bom?.line_items.filter(li => li.component.is_variable).length || 0;
                const fixedCount = product.bom?.line_items.filter(li => !li.component.is_variable).length || 0;
                return (
                  <button
                    key={product.product_id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full text-left p-3 rounded-lg border border-border/60 transition-all hover:shadow-sm hover:border-border"
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

            {/* Quantity + Priority + Due Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Production Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1.5"
                />
                <p className="text-[11px] text-muted-foreground mt-1">How many units to produce</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Priority</Label>
                <Select value={priority} onValueChange={v => setPriority(v as any)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Due Date (optional)</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-medium">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g., March capsule drop, restock for Eid..."
                className="mt-1.5 h-[60px] resize-none"
              />
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
                <Eye className="w-4 h-4 text-gold" /> Production Batch Summary
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Batch ID:</span>{' '}
                  <span className="font-mono font-medium">{nextId}</span>
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
                  <span className="text-muted-foreground">Priority:</span>{' '}
                  <Badge variant="outline" className={cn('text-[10px]', PRIORITY_CONFIG[priority].color)}>
                    {PRIORITY_CONFIG[priority].label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Vials:</span>{' '}
                  <span className="font-bold">{totals.totalVials}</span>
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

            {/* Pipeline preview */}
            <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
              <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Production Pipeline</h4>
              <div className="flex items-center gap-1 flex-wrap">
                {PIPELINE_STAGES.map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <div className={cn('w-1.5 h-1.5 rounded-full', stage.color)} />
                      {stage.label}
                    </Badge>
                    {i < PIPELINE_STAGES.length - 1 && <span className="text-muted-foreground/30">→</span>}
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
                <Factory className="w-4 h-4" /> Create Batch
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
