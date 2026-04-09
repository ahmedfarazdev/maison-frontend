// ============================================================
// Maison Em — Add Perfume Form
// Multi-step wizard with live Master ID generation
// Pricing from WHOLESALE, auto S0-S5 surcharge, dynamic decant pricing
// Multi-image drag-and-drop, aura auto-select from color
// Currency: AED only
// ============================================================

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  generateMasterId,
  AURA_COLORS,
  CONCENTRATIONS,
  HYPE_LEVELS,
  SCENT_TYPES,
  GENDERS,
  SEASONS,
  OCCASIONS,
  PERSONALITIES,
} from '@/lib/master-id-generator';
import {
  DECANT_SIZES,
  calcPricePerMl,
  determineSurchargeTier,
  calcAllDecantPrices,
  calcFullPricing,
  DEFAULT_SURCHARGES,
  DEFAULT_SUB_HYPE_MULT,
  DEFAULT_ML_DISCOUNTS,
  DEFAULT_ALACARTE_MULT,
} from '@/lib/pricing-engine';
import type { AuraColor, Concentration, HypeLevel, ScentType, DecantPricing, Perfume, Brand } from '@/types';
import {
  X, ChevronRight, ChevronLeft, Check, Copy, Sparkles,
  Droplets, Tag, BookOpen, DollarSign, FileText, Search, MapPin,
  Upload, Image as ImageIcon, Trash2, GripVertical, Calculator, Loader2
} from 'lucide-react';
import { MultiImageUpload } from '@/components/shared/MultiImageUpload';
import NoteMultiSelect from '@/components/master/NoteMultiSelect';
import { useApiQuery } from '@/hooks/useApiQuery';
import { usePricingRules } from '@/hooks/usePricingRules';
import { api } from '@/lib/api-client';

// ---- Aura color map for visual indicators ----
const AURA_HEX: Record<AuraColor, string> = {
  Red: '#C41E3A',
  Blue: '#1B6B93',
  Violet: '#4A0E4E',
  Green: '#2D6A4F',
  Yellow: '#D4A017',
  Orange: '#E07C24',
  Pink: '#D63384',
};

// ---- Step definitions ----
const STEPS = [
  { id: 0, label: 'Identity', icon: Tag, description: 'Brand, name, and classification' },
  { id: 1, label: 'Aura & Profile', icon: Sparkles, description: 'Aura color, scent type, and tags' },
  { id: 2, label: 'Notes Pyramid', icon: Droplets, description: 'Top, heart, and base notes' },
  { id: 3, label: 'Pricing', icon: DollarSign, description: 'Wholesale pricing, surcharge, and decant sizes' },
  { id: 4, label: 'Story & Content', icon: BookOpen, description: 'Scent signature, verse, and story' },
  { id: 5, label: 'Review', icon: FileText, description: 'Review and confirm' },
];

// ---- Form state type ----
interface FormState {
  brand: string;
  name: string;
  concentration: Concentration | '';
  gender_target: 'masculine' | 'feminine' | 'unisex' | '';
  main_family_id: string;
  sub_family_id: string;
  aura_color: AuraColor | '';
  aura_id: string;
  hype_level: HypeLevel | '';
  scent_type: ScentType | '';
  season: string[];
  occasion: string[];
  personality: string[];
  notes_top: string;
  notes_heart: string;
  notes_base: string;
  proposed_vault: string;
  scent_signature: string;
  aura_verse: string;
  scent_prose: string;
  scent_story: string;
  made_in: string;
  retail_price: string;
  wholesale_price: string;
  reference_size_ml: string;
  price_per_ml: string;
  price_multiplier: string;
  surcharge: string;
  surcharge_category: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | '';
  decant_pricing: Record<number, string>;
  in_stock: boolean;
  bottle_image_url: string;
  bottle_images: string[];
}

const INITIAL_STATE: FormState = {
  brand: '',
  name: '',
  concentration: '',
  gender_target: '',
  main_family_id: '',
  sub_family_id: '',
  aura_color: '',
  aura_id: '',
  hype_level: '',
  scent_type: '',
  season: [],
  occasion: [],
  personality: [],
  notes_top: '',
  notes_heart: '',
  notes_base: '',
  proposed_vault: '',
  scent_signature: '',
  aura_verse: '',
  scent_prose: '',
  scent_story: '',
  made_in: '',
  retail_price: '',
  wholesale_price: '',
  reference_size_ml: '',
  price_per_ml: '',
  price_multiplier: '',
  surcharge: '',
  surcharge_category: '',
  decant_pricing: Object.fromEntries(DECANT_SIZES.map(s => [s, ''])),
  in_stock: true,
  bottle_image_url: '',
  bottle_images: [],
};

interface AddPerfumeFormProps {
  onClose: () => void;
  onSubmit: (perfume: Perfume) => void;
  isPending?: boolean;
  families: { main_family_id: string; name: string }[];
  subFamilies: { sub_family_id: string; main_family_id: string; name: string }[];
  auras: { aura_id: string; name: string; color_hex: string }[];
  brands: Brand[];
  editPerfume?: Perfume;
}

export default function AddPerfumeForm({ onClose, onSubmit, isPending, families, subFamilies, auras, brands, editPerfume }: AddPerfumeFormProps) {
  const isEditMode = !!editPerfume;

  // Fetch notes library for linked dropdowns
  const { data: notesRes, isLoading: notesLoading } = useApiQuery(
    () => api.notes.list(),
    [],
  );
  const noteOptions = useMemo(() => {
    const items = (notesRes as any) ?? [];
    return items.map((n: any) => ({
      noteId: n.noteId,
      name: n.name,
      category: n.category,
      imageUrl: n.imageUrl,
    }));
  }, [notesRes]);

  const { data: pricingRules } = usePricingRules();
  const surchargeTiers = pricingRules?.surcharges ?? DEFAULT_SURCHARGES;
  const subHypeMultipliers = pricingRules?.subHypeMultipliers ?? DEFAULT_SUB_HYPE_MULT;
  const mlDiscounts = pricingRules?.mlDiscounts ?? DEFAULT_ML_DISCOUNTS;
  const alacarteMultipliers = pricingRules?.alacarteMultipliers ?? DEFAULT_ALACARTE_MULT;

  // Build initial state from editPerfume if provided
  const editInitialState: FormState | null = editPerfume ? {
    brand: editPerfume.brand || '',
    name: editPerfume.name || '',
    concentration: (editPerfume.concentration || '') as FormState['concentration'],
    gender_target: (editPerfume.gender_target || '') as FormState['gender_target'],
    main_family_id: editPerfume.main_family_id || '',
    sub_family_id: editPerfume.sub_family_id || '',
    aura_color: (editPerfume.aura_color || '') as FormState['aura_color'],
    aura_id: editPerfume.aura_id || '',
    hype_level: (editPerfume.hype_level || '') as FormState['hype_level'],
    scent_type: (editPerfume.scent_type || '') as FormState['scent_type'],
    season: editPerfume.season || [],
    occasion: editPerfume.occasion || [],
    personality: editPerfume.personality || [],
    notes_top: (editPerfume.notes_top || []).join(', '),
    notes_heart: (editPerfume.notes_heart || []).join(', '),
    notes_base: (editPerfume.notes_base || []).join(', '),
    proposed_vault: editPerfume.proposed_vault || '',
    scent_signature: editPerfume.scent_signature || '',
    aura_verse: editPerfume.aura_verse || '',
    scent_prose: editPerfume.scent_prose || '',
    scent_story: editPerfume.scent_story || '',
    made_in: editPerfume.made_in || '',
    retail_price: editPerfume.retail_price ? String(editPerfume.retail_price) : '',
    wholesale_price: editPerfume.wholesale_price ? String(editPerfume.wholesale_price) : '',
    reference_size_ml: editPerfume.reference_size_ml ? String(editPerfume.reference_size_ml) : '',
    price_per_ml: editPerfume.price_per_ml ? String(editPerfume.price_per_ml) : '',
    price_multiplier: editPerfume.price_multiplier ? String(editPerfume.price_multiplier) : '',
    surcharge: editPerfume.surcharge ? String(editPerfume.surcharge) : '',
    surcharge_category: (editPerfume.surcharge_category || '') as FormState['surcharge_category'],
    decant_pricing: Object.fromEntries(
      DECANT_SIZES.map(s => [
        s,
        editPerfume.decant_pricing?.find(d => d.size_ml === s)?.price?.toString() || '',
      ])
    ),
    in_stock: editPerfume.in_stock ?? true,
    bottle_image_url: editPerfume.bottle_image_url || '',
    bottle_images: editPerfume.bottle_images || [],
  } : null;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(editInitialState || INITIAL_STATE);
  const [brandSearch, setBrandSearch] = useState(editPerfume?.brand || '');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  // isDragging and fileInputRef removed — now handled by MultiImageUpload

  // Live Master ID — fixed in edit mode
  const masterId = useMemo(
    () => isEditMode ? editPerfume!.master_id : generateMasterId(form.aura_color, form.brand, form.name, form.concentration),
    [isEditMode, editPerfume, form.aura_color, form.brand, form.name, form.concentration]
  );

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayItem = useCallback((key: 'season' | 'occasion' | 'personality', item: string) => {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter(i => i !== item) : [...prev[key], item],
    }));
  }, []);

  // ---- Auto-calculate price/ml from WHOLESALE price ----
  const autoCalcPricePerMl = useMemo(() => {
    const wholesale = parseFloat(form.wholesale_price);
    const size = parseFloat(form.reference_size_ml);
    if (wholesale > 0 && size > 0) return calcPricePerMl(wholesale, size).toFixed(2);
    return '';
  }, [form.wholesale_price, form.reference_size_ml]);

  // ---- Auto-determine surcharge tier ----
  const autoSurchargeTier = useMemo(() => {
    const ppm = parseFloat(form.price_per_ml || autoCalcPricePerMl);
    if (ppm > 0 && form.hype_level) {
      return determineSurchargeTier(
        ppm,
        form.hype_level as HypeLevel,
        surchargeTiers,
        subHypeMultipliers,
      );
    }
    return null;
  }, [form.price_per_ml, autoCalcPricePerMl, form.hype_level, surchargeTiers, subHypeMultipliers]);

  // Auto-set surcharge_category when tier is determined
  useEffect(() => {
    if (autoSurchargeTier && !form.surcharge_category) {
      setForm(prev => ({
        ...prev,
        surcharge_category: autoSurchargeTier.s_category as FormState['surcharge_category'],
        surcharge: autoSurchargeTier.s_price.toString(),
      }));
    }
  }, [autoSurchargeTier, form.surcharge_category]);

  // ---- Auto-calculate decant prices ----
  const autoDecantPrices = useMemo(() => {
    const ppm = parseFloat(form.price_per_ml || autoCalcPricePerMl);
    if (ppm > 0 && form.hype_level) {
      return calcAllDecantPrices(
        ppm,
        form.hype_level as HypeLevel,
        mlDiscounts,
        alacarteMultipliers,
      );
    }
    return null;
  }, [form.price_per_ml, autoCalcPricePerMl, form.hype_level, mlDiscounts, alacarteMultipliers]);

  // ---- Auto-detect price multiplier from hype level ----
  const autoMultiplier = useMemo(() => {
    if (!form.hype_level) return '';
    const pricing = calcFullPricing(
      parseFloat(form.wholesale_price) || 0,
      parseFloat(form.reference_size_ml) || 100,
      form.hype_level as HypeLevel,
      surchargeTiers,
      subHypeMultipliers,
      mlDiscounts,
      alacarteMultipliers,
    );
    return pricing.alacarte_multiplier.toString();
  }, [form.hype_level, form.wholesale_price, form.reference_size_ml, surchargeTiers, subHypeMultipliers, mlDiscounts, alacarteMultipliers]);

  // ---- Auto-select aura_id when aura_color changes ----
  useEffect(() => {
    if (form.aura_color) {
      // Find the aura definition that matches this color
      const matchingAura = auras.find(a => {
        const colorMap: Record<string, AuraColor> = {
          '#E53935': 'Red', '#FB8C00': 'Orange', '#FDD835': 'Yellow',
          '#43A047': 'Green', '#1E88E5': 'Blue', '#EC407A': 'Pink', '#7B1FA2': 'Violet',
        };
        return colorMap[a.color_hex] === form.aura_color;
      });
      if (matchingAura && form.aura_id !== matchingAura.aura_id) {
        setForm(prev => ({ ...prev, aura_id: matchingAura.aura_id }));
      }
    }
  }, [form.aura_color, auras, form.aura_id]);

  // Brand search filtering
  const filteredBrands = useMemo(() => {
    if (!brandSearch) return brands.filter(b => b.active);
    const q = brandSearch.toLowerCase();
    return brands.filter(b => b.active && b.name.toLowerCase().includes(q));
  }, [brands, brandSearch]);

  // Select brand and auto-detect Made In
  const selectBrand = useCallback((brand: Brand) => {
    setForm(prev => ({
      ...prev,
      brand: brand.name,
      made_in: brand.made_in || prev.made_in,
    }));
    setBrandSearch(brand.name);
    setShowBrandDropdown(false);
  }, []);

  // Step validation
  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return !!form.brand && !!form.name && !!form.concentration && !!form.gender_target;
      case 1: return !!form.aura_color && !!form.hype_level && !!form.scent_type;
      case 2: return !!form.notes_top && !!form.notes_heart && !!form.notes_base;
      case 3: return !!form.wholesale_price && !!form.reference_size_ml;
      case 4: return !!form.scent_signature;
      default: return true;
    }
  }, [step, form]);

  // Image upload handled by MultiImageUpload component (S3-backed)

  // Auto-fill decant prices when auto-calc is available
  const applyAutoDecantPrices = useCallback(() => {
    if (!autoDecantPrices) return;
    const newPricing: Record<number, string> = {};
    autoDecantPrices.forEach(dp => {
      newPricing[dp.size_ml] = dp.price.toString();
    });
    setForm(prev => ({ ...prev, decant_pricing: newPricing }));
    toast.success('Decant prices auto-calculated');
  }, [autoDecantPrices]);

  // Auto-fill surcharge
  const applyAutoSurcharge = useCallback(() => {
    if (!autoSurchargeTier) return;
    setForm(prev => ({
      ...prev,
      surcharge_category: autoSurchargeTier.s_category as FormState['surcharge_category'],
      surcharge: autoSurchargeTier.s_price.toString(),
    }));
    toast.success(`Surcharge set to ${autoSurchargeTier.s_category} (AED ${autoSurchargeTier.s_price})`);
  }, [autoSurchargeTier]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    const ppm = parseFloat(form.price_per_ml || autoCalcPricePerMl) || 0;
    const decantPricing: DecantPricing[] = DECANT_SIZES.map(size => ({
      size_ml: size,
      price: parseFloat(form.decant_pricing[size]) || (autoDecantPrices?.find(d => d.size_ml === size)?.price || 0),
    }));

    const perfume: Perfume = {
      master_id: masterId,
      brand: form.brand,
      name: form.name,
      concentration: form.concentration as Concentration,
      gender_target: form.gender_target as 'masculine' | 'feminine' | 'unisex',
      visibility: 'active',
      main_family_id: form.main_family_id,
      sub_family_id: form.sub_family_id,
      aura_id: form.aura_id,
      aura_color: form.aura_color as AuraColor,
      hype_level: form.hype_level as HypeLevel,
      scent_type: form.scent_type as ScentType,
      season: form.season,
      occasion: form.occasion,
      personality: form.personality,
      notes_top: form.notes_top.split(/[•,;]/).map(n => n.trim()).filter(Boolean),
      notes_heart: form.notes_heart.split(/[•,;]/).map(n => n.trim()).filter(Boolean),
      notes_base: form.notes_base.split(/[•,;]/).map(n => n.trim()).filter(Boolean),
      proposed_vault: form.proposed_vault,
      scent_signature: form.scent_signature,
      aura_verse: form.aura_verse,
      scent_prose: form.scent_prose,
      scent_story: form.scent_story,
      made_in: form.made_in,
      retail_price: parseFloat(form.retail_price) || 0,
      wholesale_price: parseFloat(form.wholesale_price) || 0,
      reference_size_ml: parseFloat(form.reference_size_ml) || 0,
      price_per_ml: ppm,
      price_multiplier: parseFloat(form.price_multiplier || autoMultiplier) || 1.0,
      surcharge: parseFloat(form.surcharge) || (autoSurchargeTier?.s_price || 0),
      surcharge_category: (form.surcharge_category || autoSurchargeTier?.s_category || 'S0') as Perfume['surcharge_category'],
      decant_pricing: decantPricing,
      in_stock: form.in_stock,
      bottle_image_url: form.bottle_image_url || form.bottle_images[0] || 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=200',
      bottle_images: form.bottle_images,
      brand_image_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSubmit(perfume);
  }, [form, masterId, isEditMode, autoCalcPricePerMl, autoDecantPrices, autoMultiplier, autoSurchargeTier, onSubmit]);

  // ---- Shared styles ----
  const labelCls = 'text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block';
  const inputCls = 'w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors';
  const selectCls = cn(inputCls, 'appearance-none cursor-pointer');

  // Get aura name for display
  const selectedAura = auras.find(a => a.aura_id === form.aura_id);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{isEditMode ? 'Edit Perfume' : 'Add New Perfume'}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Master ID: <span className="font-mono text-gold">{masterId || '—'}</span></p>
            </div>
            <div className="flex items-center gap-2">
              {masterId && (
                <button onClick={() => { navigator.clipboard.writeText(masterId); toast.success('Copied'); }}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Copy Master ID">
                  <Copy className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-4">
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => setStep(i)}
                className={cn(
                  'flex-1 h-1.5 rounded-full transition-all',
                  i < step ? 'bg-gold' : i === step ? 'bg-gold/70' : 'bg-muted'
                )} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="w-4 h-4 text-gold" />; })()}
            <span className="text-sm font-medium">{STEPS[step].label}</span>
            <span className="text-xs text-muted-foreground">— {STEPS[step].description}</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 0: Identity */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-1">Perfume Identity</h3>
                <p className="text-xs text-muted-foreground">Core identification fields that generate the Master ID</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Brand — Searchable Dropdown */}
                <div className="col-span-2 relative">
                  <label className={labelCls}>Brand Name *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={brandSearch || form.brand}
                      onChange={e => {
                        setBrandSearch(e.target.value);
                        update('brand', e.target.value);
                        update('made_in', '');
                        setShowBrandDropdown(true);
                      }}
                      onFocus={() => setShowBrandDropdown(true)}
                      placeholder="Search or type brand name..."
                      className={cn(inputCls, 'pl-9')}
                    />
                  </div>
                  {form.made_in && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <MapPin className="w-3 h-3 text-gold" />
                      <span className="text-xs text-muted-foreground">Made in: <span className="font-medium text-foreground">{form.made_in}</span></span>
                      <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full">auto-detected</span>
                    </div>
                  )}
                  {showBrandDropdown && filteredBrands.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredBrands.slice(0, 20).map(b => (
                        <button
                          key={b.brand_id}
                          onClick={() => selectBrand(b)}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between',
                            form.brand === b.name && 'bg-gold/5'
                          )}
                        >
                          <span className="font-medium">{b.name}</span>
                          {b.made_in && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {b.made_in}
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredBrands.length > 20 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                          +{filteredBrands.length - 20} more — keep typing to narrow
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <label className={labelCls}>Perfume Name *</label>
                  <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                    onFocus={() => setShowBrandDropdown(false)}
                    placeholder="e.g., Interlude 53" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Concentration *</label>
                  <select value={form.concentration} onChange={e => update('concentration', e.target.value as Concentration)}
                    onFocus={() => setShowBrandDropdown(false)}
                    className={selectCls}>
                    <option value="">Select...</option>
                    {CONCENTRATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Gender Target *</label>
                  <select value={form.gender_target} onChange={e => update('gender_target', e.target.value as 'masculine' | 'feminine' | 'unisex')}
                    onFocus={() => setShowBrandDropdown(false)}
                    className={selectCls}>
                    <option value="">Select...</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Main Family</label>
                  <select value={form.main_family_id} onChange={e => update('main_family_id', e.target.value)}
                    onFocus={() => setShowBrandDropdown(false)}
                    className={selectCls}>
                    <option value="">Select...</option>
                    {families.map(f => <option key={f.main_family_id} value={f.main_family_id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sub-Family</label>
                  <select value={form.sub_family_id} onChange={e => update('sub_family_id', e.target.value)}
                    onFocus={() => setShowBrandDropdown(false)}
                    className={selectCls}>
                    <option value="">Select...</option>
                    {subFamilies
                      .filter(sf => !form.main_family_id || sf.main_family_id === form.main_family_id)
                      .map(sf => <option key={sf.sub_family_id} value={sf.sub_family_id}>{sf.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Proposed Vault</label>
                  <select value={form.proposed_vault} onChange={e => update('proposed_vault', e.target.value)}
                    onFocus={() => setShowBrandDropdown(false)}
                    className={selectCls}>
                    <option value="">Select...</option>
                    <option value="Signature Vault">Signature Vault</option>
                    <option value="Discovery Vault">Discovery Vault</option>
                    <option value="Collector Vault">Collector Vault</option>
                    <option value="Exclusive Vault">Exclusive Vault</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Made In</label>
                  <div className="relative">
                    <input type="text" value={form.made_in} onChange={e => update('made_in', e.target.value)}
                      onFocus={() => setShowBrandDropdown(false)}
                      placeholder="Auto-detected from brand" className={cn(inputCls, form.made_in ? 'border-gold/30' : '')} />
                    {form.made_in && (
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gold" />
                    )}
                  </div>
                </div>

                {/* Bottle Images — S3 Upload */}
                <div className="col-span-2" onClick={() => setShowBrandDropdown(false)}>
                  <label className={labelCls}>Bottle Images</label>
                  <MultiImageUpload
                    images={form.bottle_images}
                    onChange={(urls) => {
                      setForm(prev => ({
                        ...prev,
                        bottle_images: urls,
                        bottle_image_url: urls[0] || '',
                      }));
                    }}
                    folder="perfume-bottles"
                    maxImages={8}
                    maxSizeMB={10}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Aura & Profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-1">Aura & Scent Profile</h3>
                <p className="text-xs text-muted-foreground">Aura classification, scent type, and lifestyle tags</p>
              </div>

              <div>
                <label className={labelCls}>Aura Color *</label>
                <div className="grid grid-cols-7 gap-2 mt-1">
                  {AURA_COLORS.map(color => (
                    <button key={color} onClick={() => update('aura_color', color)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all',
                        form.aura_color === color
                          ? 'border-foreground shadow-md scale-105'
                          : 'border-transparent hover:border-border'
                      )}>
                      <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: AURA_HEX[color] }} />
                      <span className="text-[10px] font-medium">{color}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Aura Definition</label>
                <div className="flex items-center gap-2">
                  <select value={form.aura_id} onChange={e => update('aura_id', e.target.value)} className={cn(selectCls, 'flex-1')}>
                    <option value="">Select aura...</option>
                    {auras.map(a => <option key={a.aura_id} value={a.aura_id}>{a.name}</option>)}
                  </select>
                  {selectedAura && (
                    <span className="text-[10px] bg-gold/10 text-gold px-2 py-1 rounded-full whitespace-nowrap">
                      auto-selected
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>Hype Level *</label>
                <div className="grid grid-cols-6 gap-2 mt-1">
                  {HYPE_LEVELS.map(h => (
                    <button key={h} onClick={() => update('hype_level', h)}
                      className={cn(
                        'h-9 rounded-lg border-2 text-xs font-medium transition-all',
                        form.hype_level === h
                          ? h === 'Extreme' ? 'border-red-500 bg-red-50 text-red-700' :
                            h === 'High' ? 'border-orange-500 bg-orange-50 text-orange-700' :
                            h === 'Medium' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                            h === 'Low' ? 'border-green-500 bg-green-50 text-green-700' :
                            h === 'Rare' ? 'border-purple-500 bg-purple-50 text-purple-700' :
                            'border-gray-500 bg-gray-50 text-gray-700'
                          : 'border-input hover:border-muted-foreground/30'
                      )}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Scent Type *</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SCENT_TYPES.map(t => (
                    <button key={t} onClick={() => update('scent_type', t)}
                      className={cn(
                        'px-3 h-8 rounded-full text-xs font-medium border transition-all',
                        form.scent_type === t
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-input hover:border-gold/40'
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Season</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SEASONS.map(s => (
                    <button key={s} onClick={() => toggleArrayItem('season', s)}
                      className={cn(
                        'px-3 h-8 rounded-full text-xs font-medium border transition-all',
                        form.season.includes(s)
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-input hover:border-blue-300'
                      )}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Occasion</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {OCCASIONS.map(o => (
                    <button key={o} onClick={() => toggleArrayItem('occasion', o)}
                      className={cn(
                        'px-3 h-8 rounded-full text-xs font-medium border transition-all',
                        form.occasion.includes(o)
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-input hover:border-amber-300'
                      )}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Personality</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PERSONALITIES.map(p => (
                    <button key={p} onClick={() => toggleArrayItem('personality', p)}
                      className={cn(
                        'px-3 h-8 rounded-full text-xs font-medium border transition-all',
                        form.personality.includes(p)
                          ? 'border-pink-400 bg-pink-50 text-pink-700'
                          : 'border-input hover:border-pink-300'
                      )}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Notes Pyramid — Linked to Notes Library */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-1">Notes Pyramid</h3>
                <p className="text-xs text-muted-foreground">
                  Select notes from the Notes Library. Type to search — e.g., "BE" → Bergamot, Benzoin.
                  {noteOptions.length === 0 && !notesLoading && (
                    <span className="text-gold ml-1">Add notes in System Setup → Notes Library first, or type custom names.</span>
                  )}
                </p>
              </div>

              <div className="space-y-4">
                <NoteMultiSelect
                  options={noteOptions}
                  selected={form.notes_top.split(/[•,;]/).map(n => n.trim()).filter(Boolean)}
                  onChange={(sel) => update('notes_top', sel.join(', '))}
                  label="Top Notes"
                  position="top"
                  required
                  loading={notesLoading}
                  placeholder="Search top notes... (e.g., Bergamot, Saffron)"
                />
                <NoteMultiSelect
                  options={noteOptions}
                  selected={form.notes_heart.split(/[•,;]/).map(n => n.trim()).filter(Boolean)}
                  onChange={(sel) => update('notes_heart', sel.join(', '))}
                  label="Heart Notes"
                  position="heart"
                  required
                  loading={notesLoading}
                  placeholder="Search heart notes... (e.g., Jasmine, Rose)"
                />
                <NoteMultiSelect
                  options={noteOptions}
                  selected={form.notes_base.split(/[•,;]/).map(n => n.trim()).filter(Boolean)}
                  onChange={(sel) => update('notes_base', sel.join(', '))}
                  label="Base Notes"
                  position="base"
                  required
                  loading={notesLoading}
                  placeholder="Search base notes... (e.g., Oud, Amber, Musk)"
                />
              </div>

              {/* Live preview */}
              {(form.notes_top || form.notes_heart || form.notes_base) && (
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Notes Pyramid Preview</p>
                  {form.notes_top && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground w-10">Top:</span>
                      {form.notes_top.split(/[•,;]/).map(n => n.trim()).filter(Boolean).map(n => (
                        <span key={n} className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                  {form.notes_heart && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground w-10">Heart:</span>
                      {form.notes_heart.split(/[•,;]/).map(n => n.trim()).filter(Boolean).map(n => (
                        <span key={n} className="text-[10px] bg-pink-50 text-pink-800 border border-pink-200 px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                  {form.notes_base && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground w-10">Base:</span>
                      {form.notes_base.split(/[•,;]/).map(n => n.trim()).filter(Boolean).map(n => (
                        <span key={n} className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Pricing */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-1">Pricing & Surcharge</h3>
                <p className="text-xs text-muted-foreground">Wholesale-based pricing, auto-calculated surcharge (S0–S5), and decant sizes</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Wholesale Price (AED) *</label>
                  <input type="number" value={form.wholesale_price} onChange={e => update('wholesale_price', e.target.value)}
                    placeholder="195" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Retail Price (AED)</label>
                  <input type="number" value={form.retail_price} onChange={e => update('retail_price', e.target.value)}
                    placeholder="325" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Reference Size (ml) *</label>
                  <input type="number" value={form.reference_size_ml} onChange={e => update('reference_size_ml', e.target.value)}
                    placeholder="100" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Price / ml (from wholesale)</label>
                  <div className="relative">
                    <input type="text" value={form.price_per_ml || autoCalcPricePerMl}
                      onChange={e => update('price_per_ml', e.target.value)}
                      placeholder="Auto-calculated" className={cn(inputCls, 'bg-muted/30 pr-20')} readOnly={!form.price_per_ml} />
                    {autoCalcPricePerMl && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">
                        auto
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Surcharge auto-calculation */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-gold" />
                    <span className="text-sm font-semibold">Surcharge Category</span>
                  </div>
                  {autoSurchargeTier && (
                    <button onClick={applyAutoSurcharge}
                      className="text-[10px] bg-gold/10 text-gold px-2 py-1 rounded-full hover:bg-gold/20 transition-colors">
                      Auto-detect: {autoSurchargeTier.s_category} (AED {autoSurchargeTier.s_price})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {(['S0', 'S1', 'S2', 'S3', 'S4', 'S5'] as const).map(s => {
                    const isAuto = autoSurchargeTier?.s_category === s;
                    const prices: Record<string, number> = { S0: 0, S1: 25, S2: 50, S3: 75, S4: 100, S5: 125 };
                    return (
                      <button key={s} onClick={() => {
                        update('surcharge_category', s);
                        update('surcharge', prices[s].toString());
                      }}
                        className={cn(
                          'relative h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center',
                          form.surcharge_category === s
                            ? 'border-gold bg-gold/5 shadow-sm'
                            : isAuto
                            ? 'border-gold/30 bg-gold/5'
                            : 'border-input hover:border-gold/40'
                        )}>
                        {isAuto && !form.surcharge_category && (
                          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-gold rounded-full animate-pulse" />
                        )}
                        <span className="text-sm font-bold">{s}</span>
                        <span className="text-[10px] text-muted-foreground">AED {prices[s]}</span>
                      </button>
                    );
                  })}
                </div>
                {autoSurchargeTier && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Formula: price/ml ({form.price_per_ml || autoCalcPricePerMl}) × hype mult → {autoSurchargeTier.s_category}
                  </p>
                )}
              </div>

              {/* Price Multiplier (auto-detected) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Price Multiplier (A La Carte)</label>
                  <div className="relative">
                    <input type="number" step="0.1" value={form.price_multiplier || autoMultiplier}
                      onChange={e => update('price_multiplier', e.target.value)}
                      className={cn(inputCls, 'pr-20')} />
                    {autoMultiplier && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">
                        {autoMultiplier}x auto
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Surcharge Amount (AED)</label>
                  <input type="number" value={form.surcharge} onChange={e => update('surcharge', e.target.value)}
                    className={cn(inputCls, 'bg-muted/30')} readOnly />
                </div>
              </div>

              {/* Decant Size Pricing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Decant Size Pricing (AED)</label>
                  {autoDecantPrices && (
                    <button onClick={applyAutoDecantPrices}
                      className="text-[10px] bg-gold/10 text-gold px-2 py-1 rounded-full hover:bg-gold/20 transition-colors flex items-center gap-1">
                      <Calculator className="w-3 h-3" /> Auto-calculate all
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {DECANT_SIZES.map(size => {
                    const autoPrice = autoDecantPrices?.find(d => d.size_ml === size);
                    return (
                      <div key={size} className="relative">
                        <span className="text-[10px] text-muted-foreground block mb-1">{size}ml</span>
                        <input type="number" value={form.decant_pricing[size]}
                          onChange={e => setForm(prev => ({
                            ...prev,
                            decant_pricing: { ...prev.decant_pricing, [size]: e.target.value },
                          }))}
                          placeholder={autoPrice ? `≈${autoPrice.price}` : '—'}
                          className={cn(inputCls, 'text-center')} />
                        {autoPrice && !form.decant_pricing[size] && (
                          <span className="absolute right-1 bottom-1 text-[8px] text-muted-foreground">
                            ≈{autoPrice.price}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => update('in_stock', !form.in_stock)}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    form.in_stock ? 'bg-success' : 'bg-muted'
                  )}>
                  <div className={cn(
                    'w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                    form.in_stock ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
                <span className="text-sm">In Stock</span>
              </div>
            </div>
          )}

          {/* Step 4: Story & Content */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-1">Story & Content</h3>
                <p className="text-xs text-muted-foreground">The narrative that brings this perfume to life</p>
              </div>

              <div>
                <label className={labelCls}>Scent Signature *</label>
                <textarea value={form.scent_signature} onChange={e => update('scent_signature', e.target.value)}
                  placeholder="A one-line poetic description of the scent..."
                  className={cn(inputCls, 'h-16 py-2 resize-none')} />
              </div>
              <div>
                <label className={labelCls}>Aura Verse</label>
                <textarea value={form.aura_verse} onChange={e => update('aura_verse', e.target.value)}
                  placeholder="A short verse or tagline..."
                  className={cn(inputCls, 'h-16 py-2 resize-none')} />
              </div>
              <div>
                <label className={labelCls}>Scent Prose</label>
                <textarea value={form.scent_prose} onChange={e => update('scent_prose', e.target.value)}
                  placeholder="Detailed scent description..."
                  className={cn(inputCls, 'h-24 py-2 resize-none')} />
              </div>
              <div>
                <label className={labelCls}>Scent Story</label>
                <textarea value={form.scent_story} onChange={e => update('scent_story', e.target.value)}
                  placeholder="The story behind this fragrance..."
                  className={cn(inputCls, 'h-24 py-2 resize-none')} />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-1">Review & Confirm</h3>
                <p className="text-xs text-muted-foreground">Verify all details before creating the perfume entry</p>
              </div>

              {/* Master ID banner */}
              <div className="bg-gradient-to-r from-gold/10 to-gold/5 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Master ID</p>
                  <p className="text-lg font-mono font-bold text-gold">{masterId}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(masterId); toast.success('Copied'); }}
                  className="p-2 rounded-lg hover:bg-gold/10 transition-colors">
                  <Copy className="w-4 h-4 text-gold" />
                </button>
              </div>

              {/* Identity summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Brand</p>
                  <p className="font-medium text-sm">{form.brand || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Name</p>
                  <p className="font-medium text-sm">{form.name || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Concentration</p>
                  <p className="font-medium text-sm">{form.concentration || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Aura</p>
                  <div className="flex items-center gap-1.5">
                    {form.aura_color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: AURA_HEX[form.aura_color] }} />}
                    <p className="font-medium text-sm">{form.aura_color || '—'}</p>
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Hype</p>
                  <p className="font-medium text-sm">{form.hype_level || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Scent Type</p>
                  <p className="font-medium text-sm">{form.scent_type || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Surcharge</p>
                  <p className="font-medium text-sm">{form.surcharge_category || autoSurchargeTier?.s_category || '—'}</p>
                </div>
              </div>

              {/* Pricing summary */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Pricing Summary</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Wholesale</p>
                    <p className="text-sm font-semibold">AED {form.wholesale_price || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Retail</p>
                    <p className="text-sm font-semibold">AED {form.retail_price || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Price/ml</p>
                    <p className="text-sm font-semibold">AED {form.price_per_ml || autoCalcPricePerMl || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Surcharge</p>
                    <p className="text-sm font-semibold">AED {form.surcharge || autoSurchargeTier?.s_price || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {(form.notes_top || form.notes_heart || form.notes_base) && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Notes Pyramid</p>
                  {form.notes_top && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground w-10">Top:</span>
                      {form.notes_top.split(/[•,;]/).map(n => n.trim()).filter(Boolean).map(n => (
                        <span key={n} className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                  {form.notes_heart && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground w-10">Heart:</span>
                      {form.notes_heart.split(/[•,;]/).map(n => n.trim()).filter(Boolean).map(n => (
                        <span key={n} className="text-[10px] bg-pink-50 text-pink-800 border border-pink-200 px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                  {form.notes_base && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground w-10">Base:</span>
                      {form.notes_base.split(/[•,;]/).map(n => n.trim()).filter(Boolean).map(n => (
                        <span key={n} className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Decant pricing */}
              {(Object.values(form.decant_pricing).some(v => v && parseFloat(v) > 0) || autoDecantPrices) && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Decant Pricing</p>
                  <div className="flex flex-wrap gap-2">
                    {DECANT_SIZES.map(s => {
                      const price = form.decant_pricing[s] ? parseFloat(form.decant_pricing[s]) : autoDecantPrices?.find(d => d.size_ml === s)?.price;
                      if (!price || price <= 0) return null;
                      return (
                        <div key={s} className="bg-muted/30 rounded-lg px-3 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground">{s}ml</p>
                          <p className="text-sm font-medium">AED {price}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Images */}
              {(form.bottle_image_url || form.bottle_images.length > 0) && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Bottle Images</p>
                  <div className="flex flex-wrap gap-2">
                    {form.bottle_image_url && (
                      <img src={form.bottle_image_url} alt="URL" className="w-16 h-16 object-cover rounded-lg border border-border" />
                    )}
                    {form.bottle_images.map((img, i) => (
                      <img key={i} src={img} alt={`Image ${i+1}`} className="w-16 h-16 object-cover rounded-lg border border-border" />
                    ))}
                  </div>
                </div>
              )}

              {form.scent_signature && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Scent Signature</p>
                  <p className="text-sm italic">{form.scent_signature}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="border-t border-border px-6 py-4 shrink-0 flex items-center justify-between">
          <div>
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1.5">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}
                disabled={!stepValid || isPending}
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit}
                disabled={isPending}
                className="bg-success hover:bg-success/90 text-success-foreground gap-1.5">
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> {isEditMode ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> {isEditMode ? 'Save Changes' : 'Create Perfume'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
