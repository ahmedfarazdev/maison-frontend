// Maison Em OS — Brands Master Data
// Design: "Maison Ops" — Luxury Operations
// Full CRUD: list, search, add, edit, drill-down with analytics charts, CSV export
// Grid/Row view toggle + brand logo upload
import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { mockBrands, lookupBrandMadeIn } from '@/lib/mock-brands';
import { mockPerfumes, mockAuras } from '@/lib/mock-data';
import type { Brand, Perfume, AuraColor } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useFileUpload } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import {
  Building2, Plus, Search, MapPin, Edit2, Check, X, ArrowLeft,
  Package, FlaskConical, ChevronRight, SortAsc, SortDesc, Download,
  TrendingUp, BarChart3, PieChart as PieChartIcon, Eye,
  LayoutGrid, List, Upload, ImageIcon, Loader2,
} from 'lucide-react';

const AURA_HEX: Record<AuraColor, string> = {
  Red: '#C41E3A', Blue: '#1B6B93', Violet: '#4A0E4E',
  Green: '#2D6A4F', Yellow: '#D4A017', Orange: '#E07C24', Pink: '#D63384',
};

const CONC_COLORS: Record<string, string> = {
  Extrait: '#7B1FA2', EDP: '#1565C0', Parfum: '#C62828', EDT: '#2E7D32', Cologne: '#F57F17',
};

// ---- CSV Export Utility ----
function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success(`Exported ${filename}`);
}

// ---- Brand Logo Upload Component ----
function BrandLogoUpload({ currentUrl, onUpload }: { currentUrl?: string; onUpload: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useFileUpload({
    folder: 'brand-logos',
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    onSuccess: (result) => {
      onUpload(result.url);
      toast.success('Logo uploaded');
    },
    onError: (err) => toast.error(err),
  });

  const handleClick = () => fileRef.current?.click();
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await upload(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="relative group">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      {currentUrl ? (
        <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-white dark:bg-zinc-900 cursor-pointer"
          onClick={handleClick}>
          <img src={currentUrl} alt="Brand logo" className="w-full h-full object-contain p-1" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
            {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
          </div>
        </div>
      ) : (
        <button onClick={handleClick} disabled={uploading}
          className="w-16 h-16 rounded-xl border-2 border-dashed border-border hover:border-gold/50 bg-muted/30 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer">
          {uploading ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /> : (
            <>
              <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
              <span className="text-[8px] uppercase text-muted-foreground/50 font-semibold">Logo</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ---- Brand Detail with Analytics ----
function BrandDetail({ brand, perfumes, onBack, onEdit }: {
  brand: Brand;
  perfumes: Perfume[];
  onBack: () => void;
  onEdit: (b: Brand) => void;
}) {
  const brandPerfumes = perfumes.filter(p => p.brand.toLowerCase() === brand.name.toLowerCase());
  const inStock = brandPerfumes.filter(p => p.in_stock).length;
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(brand.name);
  const [editMadeIn, setEditMadeIn] = useState(brand.made_in);
  const [editNotes, setEditNotes] = useState(brand.notes || '');
  const [editLogoUrl, setEditLogoUrl] = useState(brand.logo_url || '');
  const [showAnalytics, setShowAnalytics] = useState(true);

  const handleSave = () => {
    onEdit({ ...brand, name: editName, made_in: editMadeIn, notes: editNotes, logo_url: editLogoUrl || undefined });
    setEditing(false);
    toast.success('Brand updated');
  };

  // Analytics data
  const concentrationData = useMemo(() => {
    const counts: Record<string, number> = {};
    brandPerfumes.forEach(p => { counts[p.concentration] = (counts[p.concentration] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: CONC_COLORS[name] || '#888' }));
  }, [brandPerfumes]);

  const auraData = useMemo(() => {
    const counts: Record<string, number> = {};
    brandPerfumes.forEach(p => { if (p.aura_color) counts[p.aura_color] = (counts[p.aura_color] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, fill: AURA_HEX[name as AuraColor] || '#888' }));
  }, [brandPerfumes]);

  const hypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    brandPerfumes.forEach(p => { counts[p.hype_level || 'Medium'] = (counts[p.hype_level || 'Medium'] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [brandPerfumes]);

  const priceData = useMemo(() => {
    return brandPerfumes
      .filter(p => p.price_per_ml > 0)
      .sort((a, b) => b.price_per_ml - a.price_per_ml)
      .slice(0, 10)
      .map(p => ({
        name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
        price_per_ml: Math.round(p.price_per_ml * 100) / 100,
        retail: p.retail_price,
      }));
  }, [brandPerfumes]);

  const avgPrice = brandPerfumes.length > 0
    ? Math.round(brandPerfumes.reduce((s, p) => s + p.price_per_ml, 0) / brandPerfumes.length * 100) / 100
    : 0;

  const totalRetail = brandPerfumes.reduce((s, p) => s + p.retail_price, 0);

  // Export brand perfumes
  const handleExportPerfumes = () => {
    const headers = ['Master ID', 'Name', 'Brand', 'Concentration', 'Aura Color', 'Hype Level', 'Retail Price AED', 'Price/ml', 'In Stock'];
    const rows = brandPerfumes.map(p => [
      p.master_id, p.name, p.brand, p.concentration, p.aura_color || '', p.hype_level || '', String(p.retail_price), String(p.price_per_ml), p.in_stock ? 'Yes' : 'No',
    ]);
    exportToCsv(`${brand.name.replace(/\s+/g, '_')}_perfumes.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Brands
      </button>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            {editing ? (
              <BrandLogoUpload currentUrl={editLogoUrl || undefined} onUpload={setEditLogoUrl} />
            ) : brand.logo_url ? (
              <div className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-white dark:bg-zinc-900">
                <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 border border-amber-200/50 dark:border-amber-700/30 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-amber-700 dark:text-amber-400" />
              </div>
            )}
            <div>
              {editing ? (
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-xl font-semibold mb-1" />
              ) : (
                <h2 className="text-xl font-semibold">{brand.name}</h2>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {editing ? (
                  <Input value={editMadeIn} onChange={e => setEditMadeIn(e.target.value)} className="h-7 text-sm w-40" />
                ) : (
                  <span>{brand.made_in || 'Unknown'}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-4 h-4" /></Button>
                <Button size="sm" onClick={handleSave}><Check className="w-4 h-4 mr-1" /> Save</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={handleExportPerfumes}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Brand notes..." className="mt-1" />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mt-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{brandPerfumes.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Perfumes</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{inStock}</div>
            <div className="text-xs text-muted-foreground mt-1">In Stock</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{brandPerfumes.length - inStock}</div>
            <div className="text-xs text-muted-foreground mt-1">Out of Stock</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold font-mono">AED {avgPrice.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-1">Avg Price/ml</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold font-mono">AED {totalRetail.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Retail Value</div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
        >
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" /> Brand Analytics
          </h3>
          <Eye className={`w-4 h-4 text-muted-foreground transition-transform ${showAnalytics ? '' : 'rotate-180'}`} />
        </button>

        {showAnalytics && brandPerfumes.length > 0 && (
          <div className="px-6 pb-6 space-y-6">
            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6">
              {/* Concentration Distribution */}
              {concentrationData.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">By Concentration</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={concentrationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={2} stroke="var(--background)">
                          {concentrationData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {/* Aura Distribution */}
              {auraData.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">By Aura Color</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={auraData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} strokeWidth={2} stroke="var(--background)">
                          {auraData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Price per ml bar chart */}
            {priceData.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Top 10 — Price per ml (AED)</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceData} layout="vertical" margin={{ left: 80 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                      <Bar dataKey="price_per_ml" fill="#D4A017" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Hype Distribution */}
            {hypeData.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">By Hype Level</h4>
                <div className="flex gap-3">
                  {hypeData.map(h => (
                    <div key={h.name} className="bg-muted/50 rounded-lg px-4 py-2 text-center">
                      <div className="text-lg font-bold">{h.value}</div>
                      <div className="text-[10px] text-muted-foreground">{h.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Perfumes List */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-600" /> Perfumes ({brandPerfumes.length})
        </h3>
        {brandPerfumes.length === 0 ? (
          <div className="bg-muted/30 rounded-lg p-8 text-center text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No perfumes registered for this brand yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {brandPerfumes.map(p => (
              <div key={p.master_id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-amber-300/50 dark:hover:border-amber-600/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-muted">
                    {p.bottle_image_url ? <img src={p.bottle_image_url} alt="" className="w-full h-full object-cover" /> : null}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.master_id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">AED {p.price_per_ml.toFixed(2)}/ml</span>
                  <Badge variant="outline" className="text-xs">{p.concentration}</Badge>
                  {p.aura_color && (
                    <span className="w-4 h-4 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" style={{ background: AURA_HEX[p.aura_color as AuraColor] || '#888' }} />
                  )}
                  <Badge variant={p.in_stock ? 'default' : 'outline'} className={`text-xs ${p.in_stock ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-700/30' : 'text-muted-foreground'}`}>
                    {p.in_stock ? 'In Stock' : 'Out'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Add Brand Dialog ----
function AddBrandForm({ onAdd, onCancel }: { onAdd: (b: Brand) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [madeIn, setMadeIn] = useState('');
  const [notes, setNotes] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Brand name is required'); return; }
    const newBrand: Brand = {
      brand_id: `br_${Date.now()}`,
      name: name.trim(),
      made_in: madeIn.trim(),
      logo_url: logoUrl || undefined,
      notes: notes.trim() || undefined,
      active: true,
      created_at: new Date().toISOString(),
    };
    onAdd(newBrand);
    toast.success(`Brand "${newBrand.name}" added`);
  };

  return (
    <div className="bg-card border border-amber-200/50 dark:border-amber-700/30 rounded-lg p-6 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Plus className="w-4 h-4" /> Add New Brand
      </h3>
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Logo</label>
          <BrandLogoUpload currentUrl={logoUrl || undefined} onUpload={setLogoUrl} />
        </div>
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Brand Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maison Francis Kurkdjian" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Made In</label>
              <Input value={madeIn} onChange={e => setMadeIn(e.target.value)} placeholder="e.g. France" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className="mt-1" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Brand
        </Button>
      </div>
    </div>
  );
}

// ---- Main Page ----
type SortField = 'name' | 'made_in' | 'perfumes' | 'in_stock';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'row';

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(mockBrands);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const countries = useMemo(() => {
    const set = new Set(brands.map(b => b.made_in).filter(Boolean));
    return Array.from(set).sort();
  }, [brands]);

  const brandStats = useMemo(() => {
    const map: Record<string, { total: number; in_stock: number }> = {};
    for (const b of brands) {
      const matching = mockPerfumes.filter(p => p.brand.toLowerCase() === b.name.toLowerCase());
      map[b.brand_id] = { total: matching.length, in_stock: matching.filter(p => p.in_stock).length };
    }
    return map;
  }, [brands]);

  const filtered = useMemo(() => {
    let list = brands.filter(b => b.active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q) || b.made_in.toLowerCase().includes(q));
    }
    if (countryFilter) list = list.filter(b => b.made_in === countryFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'made_in') cmp = a.made_in.localeCompare(b.made_in);
      else if (sortField === 'perfumes') cmp = (brandStats[a.brand_id]?.total || 0) - (brandStats[b.brand_id]?.total || 0);
      else if (sortField === 'in_stock') cmp = (brandStats[a.brand_id]?.in_stock || 0) - (brandStats[b.brand_id]?.in_stock || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [brands, search, countryFilter, sortField, sortDir, brandStats]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }, [sortField]);

  const handleAddBrand = useCallback((b: Brand) => {
    setBrands(prev => [...prev, b]);
    setShowAdd(false);
  }, []);

  const handleEditBrand = useCallback((updated: Brand) => {
    setBrands(prev => prev.map(b => b.brand_id === updated.brand_id ? updated : b));
    setSelectedBrand(updated);
  }, []);

  const handleDeleteBrand = useCallback((id: string) => {
    setBrands(prev => prev.map(b => b.brand_id === id ? { ...b, active: false } : b));
    toast.success('Brand archived');
  }, []);

  // CSV Export for all brands
  const handleExportAllBrands = () => {
    const headers = ['Brand ID', 'Name', 'Made In', 'Logo URL', 'Notes', 'Active', 'Total Perfumes', 'In Stock'];
    const rows = brands.filter(b => b.active).map(b => {
      const stats = brandStats[b.brand_id] || { total: 0, in_stock: 0 };
      return [b.brand_id, b.name, b.made_in, b.logo_url || '', b.notes || '', 'Yes', String(stats.total), String(stats.in_stock)];
    });
    exportToCsv('maison_em_brands.csv', headers, rows);
  };

  const SortIcon = sortDir === 'asc' ? SortAsc : SortDesc;

  if (selectedBrand) {
    return (
      <div className="p-6 max-w-5xl">
        <BrandDetail brand={selectedBrand} perfumes={mockPerfumes} onBack={() => setSelectedBrand(null)} onEdit={handleEditBrand} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Brands"
        subtitle={`${brands.filter(b => b.active).length} brands registered · ${countries.length} countries`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportAllBrands}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Brand
            </Button>
          </div>
        }
      />

      {showAdd && <AddBrandForm onAdd={handleAddBrand} onCancel={() => setShowAdd(false)} />}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brands..." className="pl-9" />
        </div>
        <select
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* View toggle */}
        <div className="flex border border-input rounded-md overflow-hidden ml-auto">
          <button onClick={() => setViewMode('grid')}
            className={cn('flex items-center gap-1 px-2.5 h-8 text-xs font-medium transition-all',
              viewMode === 'grid' ? 'bg-foreground text-background' : 'hover:bg-muted')}>
            <LayoutGrid className="w-3.5 h-3.5" /> Grid
          </button>
          <button onClick={() => setViewMode('row')}
            className={cn('flex items-center gap-1 px-2.5 h-8 text-xs font-medium transition-all border-l border-input',
              viewMode === 'row' ? 'bg-foreground text-background' : 'hover:bg-muted')}>
            <List className="w-3.5 h-3.5" /> Rows
          </button>
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} brand{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Country Summary Bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'France', emoji: '🇫🇷' },
          { label: 'Italy', emoji: '🇮🇹' },
          { label: 'U.K.', emoji: '🇬🇧' },
          { label: 'United States', emoji: '🇺🇸' },
          { label: 'UAE', emoji: '🇦🇪' },
        ].map(({ label, emoji }) => {
          const count = brands.filter(b => b.active && b.made_in === label).length;
          return (
            <button
              key={label}
              onClick={() => setCountryFilter(countryFilter === label ? '' : label)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                countryFilter === label
                  ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600/50 text-amber-800 dark:text-amber-300'
                  : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <span>{emoji}</span> {label} <span className="font-bold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ===== GRID VIEW ===== */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(brand => {
            const stats = brandStats[brand.brand_id] || { total: 0, in_stock: 0 };
            return (
              <div key={brand.brand_id}
                onClick={() => setSelectedBrand(brand)}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-gold/30 transition-all cursor-pointer group">
                <div className="flex flex-col items-center text-center">
                  {/* Logo */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-white dark:bg-zinc-900 mb-3 group-hover:scale-105 transition-transform">
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 flex items-center justify-center">
                        <span className="text-xl font-bold text-amber-700 dark:text-amber-400">{brand.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  {/* Name */}
                  <h3 className="text-sm font-semibold truncate w-full">{brand.name}</h3>
                  {/* Country */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{brand.made_in || '—'}</span>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50 w-full justify-center">
                    <div className="text-center">
                      <p className="text-sm font-bold">{stats.total}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Perfumes</p>
                    </div>
                    <div className="w-px h-6 bg-border" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-600">{stats.in_stock}</p>
                      <p className="text-[9px] text-muted-foreground uppercase">In Stock</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===== ROW VIEW ===== */
        <>
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_140px_80px_80px_60px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Brand {sortField === 'name' && <SortIcon className="w-3 h-3" />}
            </button>
            <button onClick={() => toggleSort('made_in')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Made In {sortField === 'made_in' && <SortIcon className="w-3 h-3" />}
            </button>
            <button onClick={() => toggleSort('perfumes')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              Perfumes {sortField === 'perfumes' && <SortIcon className="w-3 h-3" />}
            </button>
            <button onClick={() => toggleSort('in_stock')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
              In Stock {sortField === 'in_stock' && <SortIcon className="w-3 h-3" />}
            </button>
            <span></span>
          </div>

          {/* Brand Rows */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-1">
              {filtered.map(brand => {
                const stats = brandStats[brand.brand_id] || { total: 0, in_stock: 0 };
                return (
                  <div
                    key={brand.brand_id}
                    onClick={() => setSelectedBrand(brand)}
                    className="grid grid-cols-[1fr_140px_80px_80px_60px] gap-4 px-4 py-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md overflow-hidden border border-border bg-white dark:bg-zinc-900 shrink-0">
                        {brand.logo_url ? (
                          <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{brand.name.charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-sm truncate">{brand.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{brand.made_in || '—'}</span>
                    </div>
                    <div className="text-sm font-medium">
                      {stats.total > 0 ? stats.total : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-sm">
                      {stats.in_stock > 0 ? (
                        <span className="text-green-600 font-medium">{stats.in_stock}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
