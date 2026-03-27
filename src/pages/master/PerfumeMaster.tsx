// ============================================================
// Master Data — Perfume Master
// Design: "Maison Ops" — Luxury Operations
// Enriched cards with tags, prices, inventory numbers
// Grid/Row toggle view
// ============================================================

import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Search, Plus, X, Filter, ArrowUpDown, Upload, Pipette, Download,
  LayoutGrid, List, Droplets, Package, FlaskConical, Trash2, Pencil,
} from 'lucide-react';
import DeleteConfirmDialog from '@/components/shared/DeleteConfirmDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Perfume, AuraColor, Syringe, InventoryBottle, DecantBottle } from '@/types';
import AddPerfumeForm from '@/components/master/AddPerfumeForm';
import BulkCsvUpload from '@/components/master/BulkCsvUpload';
import PricingCalculator from '@/components/master/PricingCalculator';
import { mockFamilies, mockSubFamilies, mockAuras, mockSyringes } from '@/lib/mock-data';
import { mockBrands } from '@/lib/mock-brands';

const AURA_HEX: Record<AuraColor, string> = {
  Red: '#C41E3A', Blue: '#1B6B93', Violet: '#4A0E4E',
  Green: '#2D6A4F', Yellow: '#D4A017', Orange: '#E07C24', Pink: '#D63384',
};

const HYPE_BADGE_COLORS: Record<string, string> = {
  Extreme: 'bg-red-600 text-white',
  High: 'bg-gold text-gold-foreground',
  Medium: 'bg-muted text-muted-foreground',
  Low: 'bg-muted text-muted-foreground',
  Rare: 'bg-purple-600 text-white',
  Discontinued: 'bg-zinc-800 text-zinc-200',
};

// Tag color classes for different tag categories
const TAG_COLORS = {
  scent_type: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  season: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  occasion: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  personality: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

type ViewMode = 'grid' | 'row';

// ---- Inventory helpers ----
interface PerfumeInventoryStats {
  sealed_count: number;
  decanting_ml_remaining: number;
}

function computeInventoryStats(
  bottles: InventoryBottle[],
  decantBottles: DecantBottle[],
  masterId: string,
): PerfumeInventoryStats {
  // Sealed bottles: count of sealed bottles that are available (not sold)
  const sealed_count = bottles.filter(
    b => b.master_id === masterId && b.bottle_type === 'sealed' && b.status !== 'sold'
  ).length;

  // Decanting ML: sum current_ml from decant bottles for this master_id
  const decantMl = decantBottles
    .filter(d => d.master_id === masterId)
    .reduce((sum, d) => sum + d.current_ml, 0);

  // Also add open/tester bottles that are allocated or in_decanting
  const openMl = bottles
    .filter(b => b.master_id === masterId && (b.bottle_type === 'open' || b.bottle_type === 'tester') && b.current_ml)
    .reduce((sum, b) => sum + (b.current_ml || 0), 0);

  return {
    sealed_count,
    decanting_ml_remaining: decantMl + openMl,
  };
}

// Reusable filter chip with remove button
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-gold/10 text-gold border border-gold/20">
      {label}
      <button onClick={onRemove} className="hover:text-destructive transition-colors">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

export default function PerfumeMaster() {
  const { data: perfumesRes } = useApiQuery(() => api.master.perfumes(), []);
  const { data: bottlesRes } = useApiQuery(() => api.inventory.sealedBottles(), []);
  const { data: decantRes } = useApiQuery(() => api.inventory.decantBottles(), []);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [syringes, setSyringes] = useState<Syringe[]>([...mockSyringes]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Perfume | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [filterAura, setFilterAura] = useState<AuraColor | ''>('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterConcentration, setFilterConcentration] = useState('');
  const [filterHype, setFilterHype] = useState('');
  const [filterScent, setFilterScent] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterOccasion, setFilterOccasion] = useState('');
  const [filterPersonality, setFilterPersonality] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('');
  const [filterStock, setFilterStock] = useState<'' | 'in_stock' | 'out_of_stock'>('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'brand' | 'price'>('brand');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteTarget, setDeleteTarget] = useState<Perfume | null>(null);
  const [editTarget, setEditTarget] = useState<Perfume | null>(null);

  const bottles = (bottlesRes?.data || []) as InventoryBottle[];
  const decantBottles = (decantRes?.data || []) as DecantBottle[];

  // Merge API data with locally added perfumes
  const allPerfumes = [...((perfumesRes?.data || []) as Perfume[]), ...perfumes];

  // Pre-compute inventory stats for all perfumes
  const inventoryMap = useMemo(() => {
    const map: Record<string, PerfumeInventoryStats> = {};
    allPerfumes.forEach(p => {
      map[p.master_id] = computeInventoryStats(bottles, decantBottles, p.master_id);
    });
    return map;
  }, [allPerfumes, bottles, decantBottles]);

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const brands = Array.from(new Set(allPerfumes.map(p => p.brand).filter(Boolean))).sort();
    const concentrations = Array.from(new Set(allPerfumes.map(p => p.concentration).filter(Boolean))).sort();
    const hypes = Array.from(new Set(allPerfumes.map(p => p.hype_level).filter(Boolean))).sort() as string[];
    const scents = Array.from(new Set(allPerfumes.map(p => p.scent_type).filter(Boolean))).sort() as string[];
    const genders = Array.from(new Set(allPerfumes.map(p => p.gender_target).filter(Boolean))).sort() as string[];
    const seasons = Array.from(new Set(allPerfumes.flatMap(p => p.season || []).filter(Boolean))).sort();
    const occasions = Array.from(new Set(allPerfumes.flatMap(p => p.occasion || []).filter(Boolean))).sort();
    const personalities = Array.from(new Set(allPerfumes.flatMap(p => p.personality || []).filter(Boolean))).sort();
    return { brands, concentrations, hypes, scents, genders, seasons, occasions, personalities };
  }, [allPerfumes]);

  const activeFilterCount = [filterAura, filterBrand, filterConcentration, filterHype, filterScent, filterGender, filterSeason, filterOccasion, filterPersonality, filterVisibility, filterStock].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterAura(''); setFilterBrand(''); setFilterConcentration(''); setFilterHype('');
    setFilterScent(''); setFilterGender(''); setFilterSeason(''); setFilterOccasion('');
    setFilterPersonality(''); setFilterVisibility(''); setFilterStock('');
  };

  const filtered = allPerfumes.filter(p => {
    if (filterAura && p.aura_color !== filterAura) return false;
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterConcentration && p.concentration !== filterConcentration) return false;
    if (filterHype && p.hype_level !== filterHype) return false;
    if (filterScent && p.scent_type !== filterScent) return false;
    if (filterGender && p.gender_target !== filterGender) return false;
    if (filterSeason && !(p.season || []).includes(filterSeason)) return false;
    if (filterOccasion && !(p.occasion || []).includes(filterOccasion)) return false;
    if (filterPersonality && !(p.personality || []).includes(filterPersonality)) return false;
    if (filterVisibility && p.visibility !== filterVisibility) return false;
    if (filterStock === 'in_stock' && !p.in_stock) return false;
    if (filterStock === 'out_of_stock' && p.in_stock) return false;
    if (!search) return true;
    return `${p.brand} ${p.name} ${p.master_id} ${p.concentration} ${p.aura_color}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'brand') return a.brand.localeCompare(b.brand);
    return b.retail_price - a.retail_price;
  });

  const handleAddPerfume = async (perfume: Perfume) => {
    try {
      // Persist perfume to database — master data only, no stock creation.
      // To add stock, use Station 0 → Stock Register.
      await api.mutations.perfumes.create({
        masterId: perfume.master_id,
        brand: perfume.brand,
        name: perfume.name,
        concentration: perfume.concentration,
        genderTarget: perfume.gender_target,
        visibility: perfume.visibility,
        mainFamilyId: perfume.main_family_id || null,
        subFamilyId: perfume.sub_family_id || null,
        auraId: perfume.aura_id || null,
        auraColor: perfume.aura_color || null,
        hypeLevel: perfume.hype_level || null,
        scentType: perfume.scent_type || null,
        season: perfume.season || [],
        occasion: perfume.occasion || [],
        personality: perfume.personality || [],
        notesTop: perfume.notes_top || [],
        notesHeart: perfume.notes_heart || [],
        notesBase: perfume.notes_base || [],
        proposedVault: perfume.proposed_vault || null,
        scentSignature: perfume.scent_signature || null,
        auraVerse: perfume.aura_verse || null,
        scentProse: perfume.scent_prose || null,
        scentStory: perfume.scent_story || null,
        madeIn: perfume.made_in || null,
        retailPrice: String(perfume.retail_price || 0),
        wholesalePrice: String(perfume.wholesale_price || 0),
        referenceSizeMl: perfume.reference_size_ml || 100,
        pricePerMl: String(perfume.price_per_ml || 0),
        priceMultiplier: String(perfume.price_multiplier || 1),
        surcharge: String(perfume.surcharge || 0),
        surchargeCategory: perfume.surcharge_category || 'S0',
        decantPricing: perfume.decant_pricing || [],
        inStock: perfume.in_stock ?? true,
        bottleImageUrl: perfume.bottle_image_url || null,
        bottleImages: perfume.bottle_images || [],
        brandImageUrl: perfume.brand_image_url || null,
      });

      // Also create a syringe for this perfume
      const nextSeq = syringes.length + 1;
      const syringeId = `S/${nextSeq}`;
      await api.mutations.syringes.create({
        syringeId,
        assignedMasterId: perfume.master_id,
        dedicatedPerfumeName: `${perfume.brand} ${perfume.name}`,
        dedicatedPerfumeId: perfume.master_id,
        sequenceNumber: nextSeq,
        size: '5ml',
        status: 'active',
        useCount: 0,
        active: true,
        notes: 'Auto-created with perfume',
      });

      toast.success(`Perfume "${perfume.brand} — ${perfume.name}" added to Master Data`);
      toast.success(`Syringe ${syringeId} auto-created`);
      toast.info('To add stock, go to Station 0 → Stock Register', { duration: 5000 });

      // Force re-fetch by reloading the page data
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to save perfume:', err);
      toast.error(`Failed to save: ${err.message}`);
      // Still add locally as fallback
      setPerfumes(prev => [...prev, perfume]);
    }
  };

  const handleEditPerfume = async (perfume: Perfume) => {
    try {
      await api.mutations.perfumes.update(perfume.master_id, {
        brand: perfume.brand,
        name: perfume.name,
        concentration: perfume.concentration,
        genderTarget: perfume.gender_target,
        visibility: perfume.visibility,
        mainFamilyId: perfume.main_family_id || null,
        subFamilyId: perfume.sub_family_id || null,
        auraId: perfume.aura_id || null,
        auraColor: perfume.aura_color || null,
        hypeLevel: perfume.hype_level || null,
        scentType: perfume.scent_type || null,
        season: perfume.season || [],
        occasion: perfume.occasion || [],
        personality: perfume.personality || [],
        notesTop: perfume.notes_top || [],
        notesHeart: perfume.notes_heart || [],
        notesBase: perfume.notes_base || [],
        proposedVault: perfume.proposed_vault || null,
        scentSignature: perfume.scent_signature || null,
        auraVerse: perfume.aura_verse || null,
        scentProse: perfume.scent_prose || null,
        scentStory: perfume.scent_story || null,
        madeIn: perfume.made_in || null,
        retailPrice: String(perfume.retail_price || 0),
        wholesalePrice: String(perfume.wholesale_price || 0),
        referenceSizeMl: perfume.reference_size_ml || 100,
        pricePerMl: String(perfume.price_per_ml || 0),
        priceMultiplier: String(perfume.price_multiplier || 1),
        surcharge: String(perfume.surcharge || 0),
        surchargeCategory: perfume.surcharge_category || 'S0',
        decantPricing: perfume.decant_pricing || [],
        inStock: perfume.in_stock ?? true,
        bottleImageUrl: perfume.bottle_image_url || null,
        bottleImages: perfume.bottle_images || [],
        brandImageUrl: perfume.brand_image_url || null,
      });

      toast.success(`Perfume "${perfume.brand} — ${perfume.name}" updated`);
      setEditTarget(null);
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to update perfume:', err);
      toast.error(`Failed to update: ${err.message}`);
    }
  };

  const handleBulkImport = (importedPerfumes: Perfume[], importedSyringes: Syringe[]) => {
    setPerfumes(prev => [...prev, ...importedPerfumes]);
    setSyringes(prev => [...prev, ...importedSyringes]);
    setShowBulkUpload(false);
  };

  const getSyringeForPerfume = (masterId: string) => {
    return syringes.find(s => s.assigned_master_id === masterId);
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['Master ID', 'Brand', 'Name', 'Concentration', 'Gender', 'Aura Color', 'Hype Level', 'Scent Type', 'Retail Price', 'Wholesale Price', 'Ref Size ml', 'Price/ml', 'Surcharge Category', 'Made In', 'Proposed Vault', 'In Stock', 'Syringe ID', 'Season', 'Occasion', 'Personality', 'Top Notes', 'Heart Notes', 'Base Notes', 'Scent Signature', 'Aura Verse', 'Scent Prose', 'Scent Story'];
    const rows = allPerfumes.map(p => {
      const syr = getSyringeForPerfume(p.master_id);
      return [
        p.master_id, p.brand, p.name, p.concentration, p.gender_target, p.aura_color || '', p.hype_level || '', p.scent_type || '',
        String(p.retail_price), String(p.wholesale_price || ''), String(p.reference_size_ml), String(p.price_per_ml), String(p.surcharge || 0), p.surcharge_category || '',
        p.made_in || '', p.proposed_vault || '', p.in_stock ? 'Yes' : 'No', syr?.syringe_id || '',
        (p.season || []).join('; '), (p.occasion || []).join('; '), (p.personality || []).join('; '),
        (p.notes_top || []).join('; '), (p.notes_heart || []).join('; '), (p.notes_base || []).join('; '),
        p.scent_signature || '', p.aura_verse || '', p.scent_prose || '', p.scent_story || '',
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'maison_em_perfumes.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Exported ${allPerfumes.length} perfumes to CSV`);
  };

  // Collect all tags for a perfume
  const collectTags = (p: Perfume) => {
    const tags: { label: string; category: keyof typeof TAG_COLORS }[] = [];
    if (p.scent_type) tags.push({ label: p.scent_type, category: 'scent_type' });
    p.season?.forEach(s => tags.push({ label: s, category: 'season' }));
    p.occasion?.forEach(o => tags.push({ label: o, category: 'occasion' }));
    p.personality?.forEach(pr => tags.push({ label: pr, category: 'personality' }));
    return tags;
  };

  return (
    <div>
      <PageHeader
        title="Perfume Master"
        subtitle={`${allPerfumes.length} perfumes · ${syringes.length} syringes`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Perfume Master' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={handleExportCsv}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => setShowBulkUpload(true)}>
              <Upload className="w-3.5 h-3.5" /> Bulk CSV Import
            </Button>
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              onClick={() => setShowAddForm(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Perfume
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Search bar + quick controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by brand, name, ID, or aura..."
              className="w-full h-9 pl-10 pr-4 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30" />
          </div>

          {/* Aura color quick filter */}
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterAura('')}
              className={cn(
                'px-2 h-7 text-[10px] font-medium rounded-md border transition-all',
                !filterAura ? 'bg-foreground text-background border-foreground' : 'border-input hover:border-foreground/40'
              )}>
              All
            </button>
            {(Object.keys(AURA_HEX) as AuraColor[]).map(color => (
              <button key={color} onClick={() => setFilterAura(filterAura === color ? '' : color)}
                className={cn(
                  'w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center',
                  filterAura === color ? 'border-foreground scale-110' : 'border-transparent hover:border-border'
                )}>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: AURA_HEX[color] }} />
              </button>
            ))}
          </div>

          {/* Toggle full filters */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 text-[10px] font-medium rounded-md border transition-all',
              showFilters || activeFilterCount > 0
                ? 'bg-gold/10 text-gold border-gold/30'
                : 'border-input hover:border-foreground/40'
            )}>
            <Filter className="w-3 h-3" />
            Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>

          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters}
              className="flex items-center gap-1 h-7 px-2 text-[10px] font-medium text-destructive hover:text-destructive/80 transition-colors">
              <X className="w-3 h-3" /> Clear All
            </button>
          )}

          {/* Sort */}
          <button onClick={() => setSortBy(sortBy === 'brand' ? 'name' : sortBy === 'name' ? 'price' : 'brand')}
            className="flex items-center gap-1.5 h-7 px-2.5 text-[10px] font-medium rounded-md border border-input hover:border-foreground/40 transition-all">
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'brand' ? 'Brand' : sortBy === 'name' ? 'Name' : 'Price'}
          </button>

          {/* View toggle */}
          <div className="flex border border-input rounded-md overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1 px-2.5 h-7 text-[10px] font-medium transition-all',
                viewMode === 'grid' ? 'bg-foreground text-background' : 'hover:bg-muted'
              )}>
              <LayoutGrid className="w-3 h-3" /> Grid
            </button>
            <button
              onClick={() => setViewMode('row')}
              className={cn(
                'flex items-center gap-1 px-2.5 h-7 text-[10px] font-medium transition-all border-l border-input',
                viewMode === 'row' ? 'bg-foreground text-background' : 'hover:bg-muted'
              )}>
              <List className="w-3 h-3" /> Rows
            </button>
          </div>
        </div>

        {/* ===== COMPREHENSIVE FILTER PANEL ===== */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Filters</h3>
              <p className="text-[10px] text-muted-foreground">{filtered.length} of {allPerfumes.length} perfumes</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {/* Brand */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Brand</label>
                <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All Brands</option>
                  {filterOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {/* Concentration */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Concentration</label>
                <select value={filterConcentration} onChange={e => setFilterConcentration(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.concentrations.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Gender */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Gender</label>
                <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.genders.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {/* Hype Level */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Hype Level</label>
                <select value={filterHype} onChange={e => setFilterHype(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.hypes.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              {/* Scent Type */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Scent Type</label>
                <select value={filterScent} onChange={e => setFilterScent(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.scents.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Season */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Season</label>
                <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Occasion */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Occasion</label>
                <select value={filterOccasion} onChange={e => setFilterOccasion(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.occasions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {/* Personality */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Personality</label>
                <select value={filterPersonality} onChange={e => setFilterPersonality(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  {filterOptions.personalities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {/* Visibility */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Visibility</label>
                <select value={filterVisibility} onChange={e => setFilterVisibility(e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {/* Stock Status */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">Stock</label>
                <select value={filterStock} onChange={e => setFilterStock(e.target.value as '' | 'in_stock' | 'out_of_stock')}
                  className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-gold/30">
                  <option value="">All</option>
                  <option value="in_stock">In Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>
            </div>
            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                {filterBrand && <FilterChip label={`Brand: ${filterBrand}`} onRemove={() => setFilterBrand('')} />}
                {filterConcentration && <FilterChip label={`Conc: ${filterConcentration}`} onRemove={() => setFilterConcentration('')} />}
                {filterGender && <FilterChip label={`Gender: ${filterGender}`} onRemove={() => setFilterGender('')} />}
                {filterHype && <FilterChip label={`Hype: ${filterHype}`} onRemove={() => setFilterHype('')} />}
                {filterScent && <FilterChip label={`Scent: ${filterScent}`} onRemove={() => setFilterScent('')} />}
                {filterSeason && <FilterChip label={`Season: ${filterSeason}`} onRemove={() => setFilterSeason('')} />}
                {filterOccasion && <FilterChip label={`Occasion: ${filterOccasion}`} onRemove={() => setFilterOccasion('')} />}
                {filterPersonality && <FilterChip label={`Personality: ${filterPersonality}`} onRemove={() => setFilterPersonality('')} />}
                {filterVisibility && <FilterChip label={`Visibility: ${filterVisibility}`} onRemove={() => setFilterVisibility('')} />}
                {filterStock && <FilterChip label={`Stock: ${filterStock === 'in_stock' ? 'In Stock' : 'Out of Stock'}`} onRemove={() => setFilterStock('')} />}
              </div>
            )}
          </div>
        )}

        {/* ===== GRID VIEW ===== */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => {
              const syringe = getSyringeForPerfume(p.master_id);
              const inv = inventoryMap[p.master_id] || { sealed_count: 0, decanting_ml_remaining: 0 };
              const tags = collectTags(p);
              return (
                <div key={p.master_id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md hover:border-gold/30 transition-all cursor-pointer group"
                  onClick={() => setSelected(p)}>
                  {/* Image */}
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {p.bottle_image_url ? <img src={p.bottle_image_url} alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full bg-muted" />}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {p.aura_color && (
                        <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                          style={{ backgroundColor: AURA_HEX[p.aura_color] }} />
                      )}
                      <StatusBadge variant={p.visibility === 'active' ? 'success' : p.visibility === 'draft' ? 'gold' : 'muted'}>
                        {p.visibility}
                      </StatusBadge>
                    </div>
                    {p.hype_level && p.hype_level !== 'Medium' && p.hype_level !== 'Low' && (
                      <div className="absolute top-2 left-2">
                        <span className={cn(
                          'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                          HYPE_BADGE_COLORS[p.hype_level] || 'bg-muted text-muted-foreground'
                        )}>
                          {p.hype_level}
                        </span>
                      </div>
                    )}
                    {syringe && (
                      <div className="absolute bottom-2 left-2">
                        <span className="text-[9px] font-mono bg-gold/90 text-gold-foreground px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Pipette className="w-2.5 h-2.5" /> {syringe.syringe_id}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-3 space-y-2">
                    {/* Brand & Name + Delete */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.brand}</p>
                        <p className="text-sm font-semibold mt-0.5 truncate">{p.name}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                        title="Delete perfume"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Master ID + Concentration */}
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[180px]">{p.master_id}</span>
                      <span className="text-[10px] text-muted-foreground">{p.concentration}</span>
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 6).map((t, i) => (
                          <span key={`${t.label}-${i}`} className={cn(
                            'text-[8px] font-medium px-1.5 py-0.5 rounded-full border',
                            TAG_COLORS[t.category]
                          )}>
                            {t.label}
                          </span>
                        ))}
                        {tags.length > 6 && (
                          <span className="text-[8px] text-muted-foreground px-1 py-0.5">+{tags.length - 6}</span>
                        )}
                      </div>
                    )}

                    {/* Prices */}
                    <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase block">Wholesale</span>
                        <span className="text-xs font-semibold font-mono">AED {p.wholesale_price || '—'}</span>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div>
                        <span className="text-[8px] text-muted-foreground uppercase block">Retail</span>
                        <span className="text-xs font-semibold font-mono">AED {p.retail_price}</span>
                      </div>
                    </div>

                    {/* Inventory stats */}
                    <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        <div>
                          <span className="text-[8px] text-muted-foreground block">Sealed</span>
                          <span className={cn(
                            'text-xs font-bold font-mono',
                            inv.sealed_count > 0 ? 'text-foreground' : 'text-muted-foreground'
                          )}>
                            {inv.sealed_count}
                          </span>
                        </div>
                      </div>
                      <div className="w-px h-6 bg-border" />
                      <div className="flex items-center gap-1.5">
                        <Droplets className="w-3 h-3 text-muted-foreground" />
                        <div>
                          <span className="text-[8px] text-muted-foreground block">Decant ML</span>
                          <span className={cn(
                            'text-xs font-bold font-mono',
                            inv.decanting_ml_remaining > 0 ? 'text-foreground' : 'text-muted-foreground'
                          )}>
                            {inv.decanting_ml_remaining > 0 ? `${inv.decanting_ml_remaining.toFixed(1)}ml` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== ROW VIEW ===== */}
        {viewMode === 'row' && (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[48px_1fr_120px_140px_100px_100px_80px_80px] gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span />
              <span>Perfume</span>
              <span>Concentration</span>
              <span>Tags</span>
              <span className="text-right">Wholesale</span>
              <span className="text-right">Retail</span>
              <span className="text-center">Sealed</span>
              <span className="text-center">Decant ML</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-border">
              {filtered.map(p => {
                const syringe = getSyringeForPerfume(p.master_id);
                const inv = inventoryMap[p.master_id] || { sealed_count: 0, decanting_ml_remaining: 0 };
                const tags = collectTags(p);
                return (
                  <div
                    key={p.master_id}
                    onClick={() => setSelected(p)}
                    className="grid grid-cols-[48px_1fr_120px_140px_100px_100px_80px_80px] gap-3 px-4 py-3 items-center hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    {/* Photo */}
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0 relative">
                      {p.bottle_image_url ? (
                        <img src={p.bottle_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <FlaskConical className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                      {p.aura_color && (
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-card"
                          style={{ backgroundColor: AURA_HEX[p.aura_color] }} />
                      )}
                    </div>

                    {/* Name + Brand + Master ID + Syringe */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                        {p.hype_level && p.hype_level !== 'Medium' && p.hype_level !== 'Low' && (
                          <span className={cn(
                            'text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded shrink-0',
                            HYPE_BADGE_COLORS[p.hype_level] || 'bg-muted text-muted-foreground'
                          )}>
                            {p.hype_level}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{p.brand}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[9px] font-mono text-muted-foreground truncate">{p.master_id}</span>
                        {syringe && (
                          <>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[9px] font-mono text-gold flex items-center gap-0.5">
                              <Pipette className="w-2.5 h-2.5" /> {syringe.syringe_id}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Concentration + Gender */}
                    <div>
                      <span className="text-xs font-medium">{p.concentration}</span>
                      <span className="text-[10px] text-muted-foreground block capitalize">{p.gender_target}</span>
                    </div>

                    {/* Tags (compact) */}
                    <div className="flex flex-wrap gap-0.5">
                      {tags.slice(0, 3).map((t, i) => (
                        <span key={`${t.label}-${i}`} className={cn(
                          'text-[7px] font-medium px-1 py-0.5 rounded-full border',
                          TAG_COLORS[t.category]
                        )}>
                          {t.label}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[7px] text-muted-foreground px-0.5">+{tags.length - 3}</span>
                      )}
                    </div>

                    {/* Wholesale */}
                    <span className="text-xs font-mono font-medium text-right">
                      {p.wholesale_price ? `AED ${p.wholesale_price}` : '—'}
                    </span>

                    {/* Retail */}
                    <span className="text-xs font-mono font-medium text-right">
                      AED {p.retail_price}
                    </span>

                    {/* Sealed count */}
                    <div className="text-center">
                      <span className={cn(
                        'text-xs font-bold font-mono inline-flex items-center gap-1 justify-center',
                        inv.sealed_count > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                      )}>
                        <Package className="w-3 h-3" /> {inv.sealed_count}
                      </span>
                    </div>

                    {/* Decant ML */}
                    <div className="text-center">
                      <span className={cn(
                        'text-xs font-bold font-mono inline-flex items-center gap-1 justify-center',
                        inv.decanting_ml_remaining > 0 ? 'text-foreground' : 'text-muted-foreground/50'
                      )}>
                        <Droplets className="w-3 h-3" />
                        {inv.decanting_ml_remaining > 0 ? `${inv.decanting_ml_remaining.toFixed(1)}` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div className="px-4 py-2 bg-muted/30 border-t border-border text-[10px] text-muted-foreground">
              {filtered.length} of {allPerfumes.length} perfumes
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No perfumes match your search</p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-[560px] bg-card border-l border-border z-50 overflow-y-auto shadow-xl">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selected.aura_color && (
                    <div className="w-8 h-8 rounded-full border-2 border-border"
                      style={{ backgroundColor: AURA_HEX[selected.aura_color] }} />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">{selected.brand}</p>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="text-gold hover:bg-gold/10" onClick={() => { setEditTarget(selected); setSelected(null); }} title="Edit perfume">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => { setSelected(null); setDeleteTarget(selected); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Master ID + Syringe ID */}
              <div className="flex gap-3">
                <div className="flex-1 bg-muted/50 border border-border rounded-lg px-4 py-3">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Vault Master ID</span>
                  <p className="font-mono text-sm font-semibold mt-0.5">{selected.master_id}</p>
                </div>
                {getSyringeForPerfume(selected.master_id) && (
                  <div className="bg-gold/10 border border-gold/30 rounded-lg px-4 py-3">
                    <span className="text-[10px] uppercase tracking-wider text-gold font-medium flex items-center gap-1">
                      <Pipette className="w-3 h-3" /> Syringe
                    </span>
                    <p className="font-mono text-sm font-bold text-gold mt-0.5">
                      {getSyringeForPerfume(selected.master_id)!.syringe_id}
                    </p>
                  </div>
                )}
              </div>

              {selected.bottle_image_url ? <img src={selected.bottle_image_url} alt="" className="w-full h-64 object-cover rounded-lg bg-muted" /> : <div className="w-full h-64 rounded-lg bg-muted" />}

              {/* Inventory Stats */}
              {(() => {
                const inv = inventoryMap[selected.master_id] || { sealed_count: 0, decanting_ml_remaining: 0 };
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Sealed Bottles</span>
                        <span className="text-lg font-bold font-mono">{inv.sealed_count}</span>
                      </div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center">
                        <Droplets className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Decanting ML</span>
                        <span className="text-lg font-bold font-mono">
                          {inv.decanting_ml_remaining > 0 ? `${inv.decanting_ml_remaining.toFixed(1)}ml` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Classification grid */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">Concentration</span>
                  <span className="font-medium">{selected.concentration}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">Gender</span>
                  <span className="font-medium capitalize">{selected.gender_target}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">Aura</span>
                  <span className="font-medium">{selected.aura_color || selected.aura_id}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">Hype</span>
                  <span className={cn('font-medium inline-flex items-center gap-1', selected.hype_level === 'Extreme' && 'text-red-600', selected.hype_level === 'Rare' && 'text-purple-600')}>
                    {selected.hype_level || '—'}
                  </span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">Scent Type</span>
                  <span className="font-medium">{selected.scent_type || '—'}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <span className="text-[10px] text-muted-foreground block">Surcharge</span>
                  <span className="font-medium">{selected.surcharge_category || '—'}</span>
                </div>
              </div>

              {/* Vault & Origin */}
              {(selected.proposed_vault || selected.made_in) && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Vault & Origin</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selected.proposed_vault && (
                      <div><span className="text-muted-foreground">Proposed Vault:</span> <span className="font-medium">{selected.proposed_vault}</span></div>
                    )}
                    {selected.made_in && (
                      <div><span className="text-muted-foreground">Made In:</span> <span className="font-medium">{selected.made_in}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing */}
              <div className="border-t border-border pt-4">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Pricing</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Wholesale:</span> <span className="font-medium">AED {selected.wholesale_price?.toFixed(2) || '—'}</span></div>
                  <div><span className="text-muted-foreground">Retail:</span> <span className="font-medium">AED {selected.retail_price.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Ref Size:</span> <span className="font-medium">{selected.reference_size_ml}ml</span></div>
                  <div><span className="text-muted-foreground">Price/ml:</span> <span className="font-medium">AED {selected.price_per_ml.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Surcharge:</span> <span className="font-medium">{selected.surcharge_category || '—'} (+AED {selected.surcharge || 0})</span></div>
                </div>
              </div>

              {/* Decant pricing */}
              {selected.decant_pricing && selected.decant_pricing.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Decant Pricing</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.decant_pricing.map(dp => (
                      <div key={dp.size_ml} className="bg-muted/30 rounded-lg px-3 py-2 text-center min-w-[60px]">
                        <p className="text-[10px] text-muted-foreground">{dp.size_ml}ml</p>
                        <p className="text-sm font-medium">AED {dp.price}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing Calculator */}
              <PricingCalculator perfume={selected} />

              {/* Tags */}
              {(selected.season.length > 0 || selected.occasion.length > 0 || selected.personality.length > 0) && (
                <div className="border-t border-border pt-4 space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Tags</h3>
                  {selected.scent_type && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-muted-foreground w-16">Scent:</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', TAG_COLORS.scent_type)}>{selected.scent_type}</span>
                    </div>
                  )}
                  {selected.season.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-muted-foreground w-16">Season:</span>
                      {selected.season.map(s => <span key={s} className={cn('text-[10px] px-2 py-0.5 rounded-full border', TAG_COLORS.season)}>{s}</span>)}
                    </div>
                  )}
                  {selected.occasion.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-muted-foreground w-16">Occasion:</span>
                      {selected.occasion.map(o => <span key={o} className={cn('text-[10px] px-2 py-0.5 rounded-full border', TAG_COLORS.occasion)}>{o}</span>)}
                    </div>
                  )}
                  {selected.personality.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-muted-foreground w-16">Personality:</span>
                      {selected.personality.map(p => <span key={p} className={cn('text-[10px] px-2 py-0.5 rounded-full border', TAG_COLORS.personality)}>{p}</span>)}
                    </div>
                  )}
                </div>
              )}

              {/* Notes Pyramid */}
              <div className="border-t border-border pt-4">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Notes Pyramid</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Top:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selected.notes_top.map(n => <span key={n} className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800 px-2 py-0.5 rounded-full">{n}</span>)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Heart:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selected.notes_heart.map(n => <span key={n} className="text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800 px-2 py-0.5 rounded-full">{n}</span>)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-700" /> Base:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selected.notes_base.map(n => <span key={n} className="text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 px-2 py-0.5 rounded-full">{n}</span>)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scent Signature */}
              <div className="border-t border-border pt-4">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Scent Signature</h3>
                <p className="text-sm italic text-muted-foreground">{selected.scent_signature}</p>
              </div>

              {selected.aura_verse && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Aura Verse</h3>
                  <p className="text-sm">{selected.aura_verse}</p>
                </div>
              )}

              {selected.scent_prose && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Scent Prose</h3>
                  <p className="text-sm text-muted-foreground">{selected.scent_prose}</p>
                </div>
              )}

              {selected.scent_story && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Scent Story</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.scent_story}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add Perfume Form */}
      {showAddForm && (
        <AddPerfumeForm
          onClose={() => setShowAddForm(false)}
          onSubmit={handleAddPerfume}
          families={mockFamilies}
          subFamilies={mockSubFamilies}
          auras={mockAuras}
          brands={mockBrands}
        />
      )}

      {/* Edit Perfume Form */}
      {editTarget && (
        <AddPerfumeForm
          onClose={() => setEditTarget(null)}
          onSubmit={handleEditPerfume}
          families={mockFamilies}
          subFamilies={mockSubFamilies}
          auras={mockAuras}
          brands={mockBrands}
          editPerfume={editTarget}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Perfume"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.brand} — ${deleteTarget.name}" (${deleteTarget.master_id})? This action cannot be undone.` : ''}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await api.mutations.perfumes.delete(deleteTarget.master_id);
            toast.success(`Deleted ${deleteTarget.name}`);
            window.location.reload();
          } catch (err: any) {
            toast.error(`Failed to delete: ${err.message}`);
            throw err;
          }
        }}
      />

      {/* Bulk CSV Upload */}
      {showBulkUpload && (
        <BulkCsvUpload
          onImport={handleBulkImport}
          onClose={() => setShowBulkUpload(false)}
          existingPerfumeCount={allPerfumes.length}
          brands={mockBrands}
        />
      )}
    </div>
  );
}
