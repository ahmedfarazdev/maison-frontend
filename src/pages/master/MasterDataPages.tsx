// ============================================================
// Master Data Pages — Fragrance Families, Aura Definitions,
// Filters/Tags, Pricing Rules, Locations, Suppliers, Syringes, Packaging
// ALL pages are now fully editable with inline editing
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { PageHeader, SectionCard, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useTaxonomies } from '@/hooks/useTaxonomies';
import { useTags } from '@/hooks/useTags';
import { useLocations } from '@/hooks/useLocations';
import { api } from '@/lib/api-client';
import { mockFilterConfig } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Droplets,
  Edit,
  Eye,
  Flame,
  Flower2,
  Heart,
  Layers,
  Leaf,
  Loader2,
  Lock,
  MapPin,
  Moon,
  Music,
  PackageOpen,
  Percent,
  Pipette,
  Plus,
  Save,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TreePine,
  TrendingUp,
  Users,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import type {
  AlaCartePricingMultiplier,
  AuraColor,
  AuraDefinition,
  Family,
  MlDiscount,
  PackagingSKU,
  PricingRuleSet,
  SubFamily,
  Supplier,
  SurchargeTier,
  SubscriptionHypeMultiplier,
  Syringe,
  TwoMlTier,
  VaultLocation,
} from '@/types';

// ---- Color Helpers ----
const AURA_HEX: Record<AuraColor, string> = {
  Red: '#E53935', Orange: '#FB8C00', Yellow: '#FDD835',
  Green: '#43A047', Blue: '#1E88E5', Pink: '#EC407A', Violet: '#7B1FA2',
};

const AURA_BG: Record<AuraColor, string> = {
  Red: 'bg-red-50 dark:bg-red-950/30', Orange: 'bg-orange-50 dark:bg-orange-950/30',
  Yellow: 'bg-yellow-50 dark:bg-yellow-950/30', Green: 'bg-emerald-50 dark:bg-emerald-950/30',
  Blue: 'bg-blue-50 dark:bg-blue-950/30', Pink: 'bg-pink-50 dark:bg-pink-950/30',
  Violet: 'bg-violet-50 dark:bg-violet-950/30',
};

const AURA_BORDER: Record<AuraColor, string> = {
  Red: 'border-red-200 dark:border-red-800', Orange: 'border-orange-200 dark:border-orange-800',
  Yellow: 'border-yellow-200 dark:border-yellow-800', Green: 'border-emerald-200 dark:border-emerald-800',
  Blue: 'border-blue-200 dark:border-blue-800', Pink: 'border-pink-200 dark:border-pink-800',
  Violet: 'border-violet-200 dark:border-violet-800',
};

const makeUniqueId = (name: string, existing: string[]) => {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!base) return `item-${Date.now()}`;
  let candidate = base;
  let i = 2;
  while (existing.includes(candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
};

// ---- Shared Inline Edit Input ----
function InlineInput({ value, onChange, className, type = 'text', placeholder }: {
  value: string | number; onChange: (v: string) => void; className?: string; type?: string; placeholder?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={cn('bg-background border border-input rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 w-full', className)} />
  );
}

function InlineTextarea({ value, onChange, className, rows = 2 }: {
  value: string; onChange: (v: string) => void; className?: string; rows?: number;
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className={cn('bg-background border border-input rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 w-full resize-none', className)} />
  );
}

// ---- Aura Definitions (Editable) ----
export function AuraDefinitions() {
  const { aurasQuery, createAura, updateAura, deleteAura } = useTaxonomies();
  const [localAuras, setLocalAuras] = useState<AuraDefinition[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AuraDefinition>>({});

  useEffect(() => {
    if (aurasQuery.data) setLocalAuras(aurasQuery.data as AuraDefinition[]);
  }, [aurasQuery.data]);

  const allAuras = localAuras.length ? localAuras : (aurasQuery.data as AuraDefinition[] || []);
  const isLoading = aurasQuery.isLoading;
  const hasError = Boolean(aurasQuery.error);
  const isPending =
    createAura.isPending ||
    updateAura.isPending ||
    deleteAura.isPending;

  const startEdit = (a: AuraDefinition) => {
    setEditingId(a.aura_id);
    setEditForm({ ...a });
    setExpanded(a.aura_id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const updateField = (field: keyof AuraDefinition, value: unknown) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const addAura = () => {
    const newAura: AuraDefinition = {
      aura_id: `aura-new-${Date.now()}`,
      name: 'New Aura',
      color: 'Red' as AuraColor,
      color_hex: '#888888',
      element: '',
      keywords: [],
      persona: '',
      tagline: '',
      description: '',
      core_drive: '',
      balance_aura: '',
    };
    setLocalAuras([...allAuras, newAura]);
    startEdit(newAura);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const current = allAuras.find(a => a.aura_id === editingId);
    if (!current) return;

    const merged = { ...current, ...editForm } as AuraDefinition;
    const isNew = !current.id && current.aura_id.startsWith('aura-new-');
    const auraId = isNew
      ? makeUniqueId(merged.name || 'aura', allAuras.map(a => a.aura_id))
      : merged.aura_id;
    const payload = {
      aura_id: auraId,
      name: merged.name || 'New Aura',
      color: merged.color || 'Red',
      color_hex: merged.color_hex || '#888888',
      element: merged.element || '',
      keywords: merged.keywords || [],
      persona: merged.persona || '',
      tagline: merged.tagline || '',
      description: merged.description || '',
      core_drive: merged.core_drive || '',
      balance_aura: merged.balance_aura || '',
    };
    const options = {
      onSuccess: () => {
        setLocalAuras(prev => prev.map(a => a.aura_id === current.aura_id
          ? { ...a, ...merged, aura_id: auraId }
          : a));
        setEditingId(null);
        setEditForm({});
        setExpanded(auraId);
      },
    };

    if (isNew) {
      createAura.mutate(payload, options);
      return;
    }

    if (current.id) {
      updateAura.mutate({ id: current.id, data: payload }, options);
    }
  };

  const handleDelete = (target: AuraDefinition) => {
    if (!target.id) {
      setLocalAuras(prev => prev.filter(a => a.aura_id !== target.aura_id));
      setEditingId(null);
      setEditForm({});
      return;
    }
    deleteAura.mutate(target.id, {
      onSuccess: () => {
        setEditingId(null);
        setEditForm({});
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Aura Definitions"
        subtitle={`${allAuras.length} auras — The 7 Aura Framework`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Aura Definitions' }]}
        actions={
          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            onClick={addAura}
            disabled={isPending || isLoading}>
            <Plus className="w-3.5 h-3.5" /> Add Aura
          </Button>
        }
      />
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-card/30 animate-pulse" />
            ))}
          </div>
        ) : hasError ? (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            Unable to load aura definitions right now.
          </div>
        ) : allAuras.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No auras yet. Add your first aura to get started.
          </div>
        ) : (
          <>
            {/* Aura Wheel Overview */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {allAuras.map(a => (
                  <button key={a.aura_id}
                    onClick={() => setExpanded(expanded === a.aura_id ? null : a.aura_id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border-2 transition-all duration-200 ${
                      expanded === a.aura_id ? 'shadow-lg scale-105' : 'hover:shadow-md hover:scale-[1.02]'
                    }`}
                    style={{ borderColor: a.color_hex, backgroundColor: expanded === a.aura_id ? `${a.color_hex}15` : 'transparent' }}>
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: a.color_hex }} />
                    <span className="text-sm font-semibold">{a.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{a.color}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aura Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {allAuras.map(a => {
                const isOpen = expanded === a.aura_id;
                const isEditing = editingId === a.aura_id;
                const data = isEditing ? { ...a, ...editForm } as AuraDefinition : a;

                return (
                  <div key={a.aura_id}
                    className={cn(
                      'bg-card border rounded-xl overflow-hidden transition-all duration-300',
                      isOpen ? 'ring-2 shadow-lg col-span-1 lg:col-span-2' : 'hover:shadow-md cursor-pointer',
                      AURA_BORDER[a.color]
                    )}
                    onClick={() => !isEditing && setExpanded(isOpen ? null : a.aura_id)}>
                    {/* Header bar */}
                    <div className="flex items-center gap-4 p-5" style={{ borderBottom: `3px solid ${data.color_hex}` }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${data.color_hex}20` }}>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: data.color_hex }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold">{data.name}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{data.color}</span>
                        </div>
                        <p className="text-sm text-muted-foreground italic mt-0.5">"{data.tagline}"</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditing && isOpen && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
                            onClick={e => { e.stopPropagation(); startEdit(a); }}
                            disabled={isPending}>
                            <Edit className="w-3 h-3" /> Edit
                          </Button>
                        )}
                        <div className="text-muted-foreground">
                          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Collapsed summary */}
                    {!isOpen && (
                      <div className="px-5 py-3">
                        <p className="text-xs text-muted-foreground">{a.persona}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(Array.isArray(a.keywords) ? a.keywords : []).map(k => (
                            <span key={k} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: `${a.color_hex}15`, color: a.color_hex }}>{k}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expanded detail (editable) */}
                    {isOpen && (
                      <div className={cn('p-5 space-y-5', AURA_BG[a.color])} onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Name</label>
                              {isEditing ? <InlineInput value={editForm.name || ''} onChange={v => updateField('name', v)} />
                                : <p className="text-sm mt-1 font-medium">{data.name}</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tagline</label>
                              {isEditing ? <InlineInput value={editForm.tagline || ''} onChange={v => updateField('tagline', v)} />
                                : <p className="text-sm mt-1 italic">"{data.tagline}"</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Persona</label>
                              {isEditing ? <InlineInput value={editForm.persona || ''} onChange={v => updateField('persona', v)} />
                                : <p className="text-sm mt-1 font-medium">{data.persona}</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Element</label>
                              {isEditing ? <InlineInput value={editForm.element || ''} onChange={v => updateField('element', v)} />
                                : <p className="text-sm mt-1">{data.element}</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Keywords (comma-separated)</label>
                              {isEditing ? <InlineInput value={(editForm.keywords || []).join(', ')} onChange={v => updateField('keywords', v.split(',').map(s => s.trim()).filter(Boolean))} />
                                : <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {(Array.isArray(data.keywords) ? data.keywords : []).map(k => (
                                      <span key={k} className="text-xs px-2.5 py-1 rounded-full font-medium border"
                                        style={{ borderColor: `${data.color_hex}40`, color: data.color_hex }}>{k}</span>
                                    ))}
                                  </div>}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
                              {isEditing ? <InlineTextarea value={editForm.description || ''} onChange={v => updateField('description', v)} rows={3} />
                                : <p className="text-sm mt-1 leading-relaxed">{data.description}</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Core Drive</label>
                              {isEditing ? <InlineInput value={editForm.core_drive || ''} onChange={v => updateField('core_drive', v)} />
                                : <p className="text-sm mt-1">{data.core_drive}</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Balance Aura</label>
                              {isEditing ? <InlineInput value={editForm.balance_aura || ''} onChange={v => updateField('balance_aura', v)} />
                                : <p className="text-sm mt-1">{data.balance_aura}</p>}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Color Hex</label>
                              {isEditing ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <input type="color" value={editForm.color_hex || data.color_hex}
                                    onChange={e => updateField('color_hex', e.target.value)}
                                    className="w-8 h-8 rounded border border-border cursor-pointer" />
                                  <InlineInput value={editForm.color_hex || ''} onChange={v => updateField('color_hex', v)} className="max-w-[120px] font-mono" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: data.color_hex }} />
                                  <span className="text-sm font-mono">{data.color_hex}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {isEditing && (
                          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="gap-1.5 mr-auto" disabled={isPending}>
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {data.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone. This taxonomy might be referenced by several products.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={deleteAura.isPending}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(data)}
                                    className="bg-destructive hover:bg-destructive/90 text-white"
                                    disabled={deleteAura.isPending}
                                  >
                                    {deleteAura.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Yes, Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button size="sm" variant="outline" onClick={cancelEdit} className="gap-1.5" disabled={isPending}>
                              <X className="w-3.5 h-3.5" /> Cancel
                            </Button>
                            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={saveEdit} disabled={isPending}>
                              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                              Save Changes
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Fragrance Families (Editable) ----
export function FragranceFamilies() {
  const {
    familiesQuery,
    subFamiliesQuery,
    createFamily,
    updateFamily,
    deleteFamily,
    createSubFamily,
    updateSubFamily,
    deleteSubFamily,
  } = useTaxonomies();
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [editingSub, setEditingSub] = useState<SubFamily | null>(null);
  const [familyForm, setFamilyForm] = useState<Partial<Family>>({});
  const [subForm, setSubForm] = useState<Partial<SubFamily>>({});
  const [deleteFamilyTarget, setDeleteFamilyTarget] = useState<Family | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<SubFamily | null>(null);

  const [localFamilies, setLocalFamilies] = useState<Family[]>([]);
  const [localSubs, setLocalSubs] = useState<SubFamily[]>([]);

  useEffect(() => {
    if (familiesQuery.data) setLocalFamilies(familiesQuery.data as Family[]);
  }, [familiesQuery.data]);

  useEffect(() => {
    if (subFamiliesQuery.data) setLocalSubs(subFamiliesQuery.data as SubFamily[]);
  }, [subFamiliesQuery.data]);

  const families = localFamilies;
  const subs = localSubs;

  const isLoading = familiesQuery.isLoading || subFamiliesQuery.isLoading;
  const hasError = Boolean(familiesQuery.error || subFamiliesQuery.error);
  const isSaving =
    createFamily.isPending ||
    updateFamily.isPending ||
    deleteFamily.isPending ||
    createSubFamily.isPending ||
    updateSubFamily.isPending ||
    deleteSubFamily.isPending;

  const FAMILY_ICONS: Record<string, React.ReactNode> = {
    FRESH: <Wind className="w-5 h-5" />, FLORAL: <Flower2 className="w-5 h-5" />,
    ORIENTAL: <Flame className="w-5 h-5" />, WOODY: <TreePine className="w-5 h-5" />,
    MODERN: <Zap className="w-5 h-5" />,
  };
  const FAMILY_COLORS: Record<string, string> = {
    FRESH: '#43A047', FLORAL: '#EC407A', ORIENTAL: '#FB8C00', WOODY: '#795548', MODERN: '#7B1FA2',
  };

  const startEditFamily = (f: Family) => {
    setEditingFamily(f);
    setFamilyForm({ ...f });
    setExpandedFamily(f.main_family_id);
  };

  const saveFamilyEdit = async () => {
    if (!editingFamily || !familyForm.name) return;
    const isNew = !editingFamily.id && editingFamily.main_family_id.startsWith('fam-new-');
    const familyId = isNew
      ? makeUniqueId(familyForm.name, families.map(f => f.main_family_id))
      : editingFamily.main_family_id;
    const payload = {
      main_family_id: familyId,
      name: familyForm.name,
      tagline: familyForm.tagline,
      description: familyForm.description,
      display_order: familyForm.display_order ?? families.length + 1,
    };
    const options = {
      onSuccess: () => {
        setEditingFamily(null);
        setFamilyForm({});
      },
    };

    if (isNew) {
      createFamily.mutate(payload, options);
      return;
    }

    if (editingFamily.id) {
      updateFamily.mutate({ id: editingFamily.id, data: payload }, options);
    }
  };

  const startEditSub = (s: SubFamily) => {
    setEditingSub(s);
    setSubForm({ ...s });
    setExpandedSub(s.sub_family_id);
  };

  const saveSubEdit = async () => {
    if (!editingSub || !subForm.name) return;
    const isNew = !editingSub.id && editingSub.sub_family_id.startsWith('sub-new-');
    const subFamilyId = isNew
      ? makeUniqueId(subForm.name, subs.map(s => s.sub_family_id))
      : editingSub.sub_family_id;
    const payload = {
      sub_family_id: subFamilyId,
      ff_code: subForm.ff_code || editingSub.ff_code,
      main_family_id: subForm.main_family_id || editingSub.main_family_id,
      name: subForm.name,
      scent_dna: subForm.scent_dna,
      ritual_name: subForm.ritual_name,
      ritual_occasions: subForm.ritual_occasions,
      aura_color: subForm.aura_color,
      aura_name: subForm.aura_name,
      key_notes: subForm.key_notes,
      mood_tags: subForm.mood_tags,
      description: subForm.description,
      scent_story: subForm.scent_story,
    };
    const options = {
      onSuccess: () => {
        setEditingSub(null);
        setSubForm({});
      },
    };

    if (isNew) {
      createSubFamily.mutate(payload, options);
      return;
    }

    if (editingSub.id) {
      const { sub_family_id: _ignored, ...updatePayload } = payload;
      updateSubFamily.mutate({ id: editingSub.id, data: updatePayload }, options);
    }
  };

  const addFamily = () => {
    const newF: Family = {
      main_family_id: `fam-new-${Date.now()}`, name: 'NEW FAMILY', tagline: 'Enter tagline',
      description: '', display_order: families.length + 1, sub_families: [],
    };
    setLocalFamilies([...families, newF]);
    startEditFamily(newF);
  };

  const addSubFamily = () => {
    const parentId = expandedFamily || families[0]?.main_family_id || '';
    const newS: SubFamily = {
      sub_family_id: `sub-new-${Date.now()}`, main_family_id: parentId, main_family_name: '',
      ff_code: 'FF-NEW', name: 'New Sub-Family', scent_dna: '', ritual_name: '', ritual_occasions: '',
      aura_name: 'Red', aura_color: 'Red', key_notes: [], mood_tags: [],
      description: '', scent_story: '',
    };
    setLocalSubs([...subs, newS]);
    startEditSub(newS);
  };

  const requestDeleteFamily = (family: Family) => {
    setDeleteFamilyTarget(family);
  };

  const requestDeleteSub = (sub: SubFamily) => {
    setDeleteSubTarget(sub);
  };

  const confirmDeleteFamily = () => {
    if (!deleteFamilyTarget) return;
    if (!deleteFamilyTarget.id) {
      setLocalFamilies(families.filter(f => f.main_family_id !== deleteFamilyTarget.main_family_id));
      setLocalSubs(subs.filter(s => s.main_family_id !== deleteFamilyTarget.main_family_id));
      setDeleteFamilyTarget(null);
      return;
    }
    deleteFamily.mutate(deleteFamilyTarget.id, {
      onSuccess: () => setDeleteFamilyTarget(null),
    });
  };

  const confirmDeleteSub = () => {
    if (!deleteSubTarget) return;
    if (!deleteSubTarget.id) {
      setLocalSubs(subs.filter(s => s.sub_family_id !== deleteSubTarget.sub_family_id));
      setDeleteSubTarget(null);
      return;
    }
    deleteSubFamily.mutate(deleteSubTarget.id, {
      onSuccess: () => setDeleteSubTarget(null),
    });
  };

  return (
    <div>
      <PageHeader
        title="Fragrance Families"
        subtitle={`${families.length} main families · ${subs.length} sub-families`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Fragrance Families' }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={addSubFamily} disabled={isSaving || isLoading}>
              <Plus className="w-3.5 h-3.5" /> Add Sub-Family
            </Button>
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={addFamily} disabled={isSaving || isLoading}>
              <Plus className="w-3.5 h-3.5" /> Add Family
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-5">
        {families.sort((a, b) => a.display_order - b.display_order).map(f => {
          const familySubs = subs.filter(s => s.main_family_id === f.main_family_id);
          const isOpen = expandedFamily === f.main_family_id;
          const isEditingF = editingFamily?.main_family_id === f.main_family_id;
          const color = FAMILY_COLORS[f.name] || '#888';

          return (
            <div key={f.main_family_id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedFamily(isOpen ? null : f.main_family_id)}>
                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}15`, color }}>
                  {FAMILY_ICONS[f.name] || <Layers className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold tracking-wide">{f.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {familySubs.length} sub-families
                    </span>
                  </div>
                  <p className="text-sm italic mt-0.5" style={{ color }}>"{f.tagline}"</p>
                </div>
                <div className="flex items-center gap-2">
                  {isOpen && !isEditingF && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7"
                        onClick={e => { e.stopPropagation(); startEditFamily(f); }}>
                        <Edit className="w-3 h-3" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 text-destructive hover:text-destructive"
                        onClick={e => { e.stopPropagation(); requestDeleteFamily(f); }}
                        disabled={isSaving}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  <div className="text-muted-foreground">
                    {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  <div className="px-5 py-4 bg-muted/20" onClick={e => e.stopPropagation()}>
                    {isEditingF ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Name</label>
                            <InlineInput value={familyForm.name || ''} onChange={v => setFamilyForm(p => ({ ...p, name: v }))} />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tagline</label>
                            <InlineInput value={familyForm.tagline || ''} onChange={v => setFamilyForm(p => ({ ...p, tagline: v }))} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
                          <InlineTextarea value={familyForm.description || ''} onChange={v => setFamilyForm(p => ({ ...p, description: v }))} rows={3} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingFamily(null)} className="gap-1.5" disabled={isSaving}>
                            <X className="w-3.5 h-3.5" /> Cancel
                          </Button>
                          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={saveFamilyEdit} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                    )}
                  </div>

                  <div className="divide-y divide-border/50">
                    {familySubs.map(sub => {
                      const subOpen = expandedSub === sub.sub_family_id;
                      const isEditingS = editingSub?.sub_family_id === sub.sub_family_id;
                      const auraHex = AURA_HEX[sub.aura_color] || '#888';

                      return (
                        <div key={sub.sub_family_id}>
                          <button
                            className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/20 transition-colors"
                            onClick={() => setExpandedSub(subOpen ? null : sub.sub_family_id)}>
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: auraHex }} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">{sub.ff_code}</span>
                                <h4 className="text-sm font-semibold">{sub.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{sub.scent_dna}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: `${auraHex}15`, color: auraHex }}>{sub.aura_name}</span>
                              {subOpen && !isEditingS && (
                                <>
                                  <Button size="sm" variant="outline" className="gap-1 text-xs h-6 px-2"
                                    onClick={e => { e.stopPropagation(); startEditSub(sub); }}>
                                    <Edit className="w-2.5 h-2.5" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="gap-1 text-xs h-6 px-2 text-destructive hover:text-destructive"
                                    onClick={e => { e.stopPropagation(); requestDeleteSub(sub); }}
                                    disabled={isSaving}>
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </Button>
                                </>
                              )}
                              <div className="text-muted-foreground">
                                {subOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </div>
                            </div>
                          </button>

                          {subOpen && (
                            <div className="px-5 pb-4 pt-1 ml-6 border-l-2" style={{ borderColor: `${auraHex}40` }}
                              onClick={e => e.stopPropagation()}>
                              {isEditingS ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Name</label>
                                      <InlineInput value={subForm.name || ''} onChange={v => setSubForm(p => ({ ...p, name: v }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">FF Code</label>
                                      <InlineInput value={subForm.ff_code || ''} onChange={v => setSubForm(p => ({ ...p, ff_code: v }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Scent DNA</label>
                                      <InlineInput value={subForm.scent_dna || ''} onChange={v => setSubForm(p => ({ ...p, scent_dna: v }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ritual Name</label>
                                      <InlineInput value={subForm.ritual_name || ''} onChange={v => setSubForm(p => ({ ...p, ritual_name: v }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ritual Occasions</label>
                                      <InlineInput value={subForm.ritual_occasions || ''} onChange={v => setSubForm(p => ({ ...p, ritual_occasions: v }))} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Aura Color</label>
                                      <select value={subForm.aura_color || 'Red'}
                                        onChange={e => setSubForm(p => ({ ...p, aura_color: e.target.value as AuraColor, aura_name: e.target.value }))}
                                        className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-sm">
                                        {(['Red','Orange','Yellow','Green','Blue','Pink','Violet'] as AuraColor[]).map(c => (
                                          <option key={c} value={c}>{c}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Key Notes (comma-separated)</label>
                                    <InlineInput value={(subForm.key_notes || []).join(', ')} onChange={v => setSubForm(p => ({ ...p, key_notes: v.split(',').map(s => s.trim()).filter(Boolean) }))} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mood Tags (comma-separated)</label>
                                    <InlineInput value={(subForm.mood_tags || []).join(', ')} onChange={v => setSubForm(p => ({ ...p, mood_tags: v.split(',').map(s => s.trim()).filter(Boolean) }))} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
                                    <InlineTextarea value={subForm.description || ''} onChange={v => setSubForm(p => ({ ...p, description: v }))} />
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Scent Story</label>
                                    <InlineTextarea value={subForm.scent_story || ''} onChange={v => setSubForm(p => ({ ...p, scent_story: v }))} rows={3} />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setEditingSub(null)} className="gap-1.5" disabled={isSaving}>
                                      <X className="w-3.5 h-3.5" /> Cancel
                                    </Button>
                                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={saveSubEdit} disabled={isSaving}>
                                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ritual Name</label>
                                      <p className="text-sm mt-0.5 font-medium">{sub.ritual_name}</p>
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ritual Occasions</label>
                                      <p className="text-sm mt-0.5">{sub.ritual_occasions}</p>
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</label>
                                      <p className="text-sm mt-0.5 leading-relaxed">{sub.description}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Scent Story</label>
                                      <p className="text-sm mt-0.5 leading-relaxed italic text-muted-foreground">"{sub.scent_story}"</p>
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Key Notes</label>
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {sub.key_notes.map(n => (
                                          <span key={n} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">{n}</span>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mood Tags</label>
                                      <div className="flex gap-1.5 mt-1">
                                        {sub.mood_tags.map(t => (
                                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                            style={{ backgroundColor: `${auraHex}15`, color: auraHex }}>{t}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AlertDialog open={!!deleteFamilyTarget} onOpenChange={(open) => { if (!open && !deleteFamily.isPending) setDeleteFamilyTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteFamilyTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the family and its sub-families. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFamily.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFamily}
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleteFamily.isPending}
            >
              {deleteFamily.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteSubTarget} onOpenChange={(open) => { if (!open && !deleteSubFamily.isPending) setDeleteSubTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteSubTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This sub-family will be removed from the taxonomy. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubFamily.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSub}
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleteSubFamily.isPending}
            >
              {deleteSubFamily.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Filters & Tags (Editable — DB-backed) ----
export function FiltersAndTags() {
  const [filters, setFilters] = useState({ ...mockFilterConfig });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load filter tags from DB on mount
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const res = await api.master.filterTags();
        if (res.data.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const tag of res.data as any[]) {
            const cat = tag.category || tag.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(tag.value || tag.label);
          }
          setFilters(prev => {
            const updated = { ...prev };
            for (const [key, vals] of Object.entries(grouped)) {
              if (key in updated) (updated as any)[key] = vals;
            }
            return updated;
          });
        }
      } catch (e) {
        console.warn('[Filters] Failed to load from DB, using defaults', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const sections: { title: string; key: keyof typeof filters; icon: React.ReactNode; colorFn?: (v: string) => string }[] = [
    { title: 'Aura Colors', key: 'aura_colors', icon: <Sparkles className="w-4 h-4" />, colorFn: (v) => AURA_HEX[v as AuraColor] || '#888' },
    { title: 'Scent Types', key: 'scent_types', icon: <Wind className="w-4 h-4" /> },
    { title: 'Seasons', key: 'seasons', icon: <Sun className="w-4 h-4" /> },
    { title: 'Occasions', key: 'occasions', icon: <Heart className="w-4 h-4" /> },
    { title: 'Concentrations', key: 'concentrations', icon: <Droplets className="w-4 h-4" /> },
    { title: 'Genders', key: 'genders', icon: <Users className="w-4 h-4" /> },
    { title: 'Personalities', key: 'personalities', icon: <Zap className="w-4 h-4" /> },
    { title: 'Main Families', key: 'main_families', icon: <Layers className="w-4 h-4" /> },
    { title: 'Sub-Families', key: 'sub_families', icon: <Tag className="w-4 h-4" /> },
  ];

  const startEditSection = (key: string) => {
    setEditingKey(key);
    setEditValues([...(filters[key as keyof typeof filters] as string[])]);
    setNewTagInput('');
  };

  const addTag = () => {
    if (!newTagInput.trim() || isSaving) return;
    setEditValues(prev => [...prev, newTagInput.trim()]);
    setNewTagInput('');
  };

  const removeTag = (idx: number) => {
    setEditValues(prev => prev.filter((_, i) => i !== idx));
  };

  const saveSection = async () => {
    if (!editingKey) return;
    try {
      setIsSaving(true);
      // Delete existing tags for this category, then re-create
      const existingRes = await api.master.filterTags(editingKey);
      for (const tag of (existingRes.data as any[])) {
        if (tag.id) await api.mutations.filterTags.delete(tag.id);
      }
      // Create new tags
      for (let i = 0; i < editValues.length; i++) {
        await api.mutations.filterTags.create({
          category: editingKey,
          value: editValues[i],
          label: editValues[i],
          sortOrder: i,
        });
      }
      setFilters(prev => ({ ...prev, [editingKey!]: editValues }));
      setEditingKey(null);
      toast.success('Tags saved to database');
    } catch (e) {
      console.error('[Filters] Save failed:', e);
      toast.error('Failed to save tags');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Filters & Tags"
        subtitle="Master tag sets used across perfume metadata, search, and filtering"
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Filters & Tags' }]}
      />
      <div className="p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-card/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sections.map(sec => {
                const isEditing = editingKey === sec.key;
                const values = isEditing ? editValues : (filters[sec.key] as string[]);

                return (
                  <div key={sec.key} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/20">
                      <span className="text-muted-foreground">{sec.icon}</span>
                      <h3 className="text-sm font-semibold">{sec.title}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground ml-auto">{values.length} items</span>
                      {!isEditing ? (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => startEditSection(sec.key)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingKey(null)} disabled={isSaving}>
                            <X className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gold" onClick={saveSection} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {values.map((v, idx) => {
                          const tagColor = sec.colorFn?.(v);
                          return (
                            <span key={`${v}-${idx}`} className={cn(
                              'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border border-border bg-muted/30 transition-colors',
                              isEditing ? 'pr-1.5' : 'cursor-default'
                            )}>
                              {tagColor && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tagColor }} />}
                              {v}
                              {isEditing && (
                                <button onClick={() => removeTag(idx)}
                                  className="w-4 h-4 rounded-full bg-destructive/20 text-destructive flex items-center justify-center hover:bg-destructive/40 ml-1"
                                  disabled={isSaving}>
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      {isEditing && (
                        <div className="flex items-center gap-2 mt-3">
                          <input type="text" value={newTagInput} onChange={e => setNewTagInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTag()}
                            placeholder="Add new tag..."
                            className="flex-1 bg-background border border-input rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                            disabled={isSaving} />
                          <Button size="sm" variant="outline" onClick={addTag} className="gap-1 h-8" disabled={isSaving}>
                            <Plus className="w-3 h-3" /> Add
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 bg-muted/30 border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">Tag Coverage Summary</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
                {sections.map(sec => (
                  <div key={sec.key} className="text-center">
                    <div className="text-lg font-bold font-mono">{(filters[sec.key] as string[]).length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{sec.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Pricing Rules (Full Editable Schema — DB-backed, Tabbed) ----
type PricingTab = 'surcharge' | 'hype' | 'mldiscount' | 'alacarte' | '2ml';

export function PricingRules() {
  const [activeTab, setActiveTab] = useState<PricingTab>('surcharge');
  const [surcharges, setSurcharges] = useState<SurchargeTier[]>([]);
  const [subHypeMultipliers, setSubHypeMultipliers] = useState<SubscriptionHypeMultiplier[]>([]);
  const [mlDiscounts, setMlDiscounts] = useState<MlDiscount[]>([]);
  const [alacarteMultipliers, setAlacarteMultipliers] = useState<AlaCartePricingMultiplier[]>([]);
  const [twoMlTiers, setTwoMlTiers] = useState<TwoMlTier[]>([]);

  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load all pricing rules from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const [s, h, m, a, t] = await Promise.all([
          api.master.pricingRules.surcharges(),
          api.master.pricingRules.subHypeMultipliers(),
          api.master.pricingRules.mlDiscounts(),
          api.master.pricingRules.alacarteMultipliers(),
          api.master.pricingRules.twoMlTiers(),
        ]);
        if (s.length) setSurcharges(s);
        if (h.length) setSubHypeMultipliers(h);
        if (m.length) setMlDiscounts(m);
        if (a.length) setAlacarteMultipliers(a);
        if (t.length) setTwoMlTiers(t);
      } catch (e) {
        console.warn('[Pricing] Failed to load from DB, using defaults', e);
      }
      setLoaded(true);
    })();
  }, []);

  const updateSurcharge = (idx: number, field: keyof SurchargeTier, val: string) => {
    setSurcharges(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 's_category' ? val : (val === '' ? null : Number(val)) } : s));
  };

  const addSurcharge = () => {
    const last = surcharges[surcharges.length - 1];
    setSurcharges([...surcharges, {
      from_price_per_ml: last ? (last.to_price_per_ml || last.from_price_per_ml + 3) : 0,
      to_price_per_ml: null,
      s_category: `S${surcharges.length}`,
      s_price: 0,
    }]);
  };

  const removeSurcharge = (idx: number) => setSurcharges(prev => prev.filter((_, i) => i !== idx));

  const updateSubHype = (idx: number, field: keyof SubscriptionHypeMultiplier, val: string) => {
    setSubHypeMultipliers(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'hype' ? val : Number(val) } : s));
  };

  const updateMlDiscount = (idx: number, field: keyof MlDiscount, val: string) => {
    setMlDiscounts(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'label' ? val : Number(val) } : s));
  };

  const addMlDiscount = () => {
    setMlDiscounts([...mlDiscounts, { label: 'Discount', ml_size: 0, discount_factor: 0 }]);
  };

  const removeMlDiscount = (idx: number) => setMlDiscounts(prev => prev.filter((_, i) => i !== idx));

  const updateAlacarte = (idx: number, field: keyof AlaCartePricingMultiplier, val: string) => {
    setAlacarteMultipliers(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'hype' ? val : Number(val) } : s));
  };

  // 2ml Pricing helpers
  const update2ml = (idx: number, field: keyof TwoMlTier, val: string) => {
    setTwoMlTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: field === 's_category' ? val : Number(val) } : t));
  };

  const add2ml = () => {
    setTwoMlTiers([...twoMlTiers, { s_category: `S${twoMlTiers.length}`, price: 0 }]);
  };

  const remove2ml = (idx: number) => setTwoMlTiers(prev => prev.filter((_, i) => i !== idx));

  const saveTable = async (name: string) => {
    setSaving(true);
    try {
      if (name === 'Surcharge Tiers') {
        await api.mutations.pricing.saveSurcharges(
          surcharges.map((s, i) => ({
            fromPricePerMl: s.from_price_per_ml,
            toPricePerMl: s.to_price_per_ml ?? null,
            sCategory: s.s_category,
            sPrice: s.s_price,
            sortOrder: i,
          }))
        );
      } else if (name === 'Hype Multipliers') {
        await api.mutations.pricing.saveSubHypeMultipliers(
          subHypeMultipliers.map((s, i) => ({
            hype: s.hype,
            multiplier: s.multiplier,
            sortOrder: i,
          }))
        );
      } else if (name === 'ML Discounts') {
        await api.mutations.pricing.saveMlDiscounts(
          mlDiscounts.map((d, i) => ({
            label: d.label,
            mlSize: d.ml_size,
            discountFactor: d.discount_factor,
            sortOrder: i,
          }))
        );
      } else if (name === 'One-Time Perfume (ml) Multiplier') {
        await api.mutations.pricing.saveAlacarteMultipliers(
          alacarteMultipliers.map((a, i) => ({
            hype: a.hype,
            multiplier: a.multiplier,
            sortOrder: i,
          }))
        );
      } else if (name === '2ml Pricing') {
        await api.mutations.pricing.save2mlTiers(
          twoMlTiers.map((t, i) => ({
            sCategory: t.s_category,
            price: t.price,
            sortOrder: i,
          }))
        );
      }
      setEditingTable(null);
      toast.success(`${name} saved to database`);
    } catch (e) {
      console.error('[Pricing] Save failed:', e);
      toast.error(`Failed to save ${name}`);
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: PricingTab; label: string; icon: typeof DollarSign; count?: number }[] = [
    { id: 'surcharge', label: 'Surcharge Tiers', icon: DollarSign, count: surcharges.length },
    { id: '2ml', label: '2ml Pricing', icon: Droplets, count: twoMlTiers.length },
    { id: 'hype', label: 'Hype Multiplier', icon: TrendingUp, count: subHypeMultipliers.length },
    { id: 'mldiscount', label: 'ml Discount', icon: Percent, count: mlDiscounts.length },
    { id: 'alacarte', label: 'One-Time Perfume (ml) Multiplier', icon: BarChart3, count: alacarteMultipliers.length },
  ];

  return (
    <div>
      <PageHeader title="Pricing Rules"
        subtitle="Manage surcharge tiers, 2ml pricing, hype multipliers, and discount factors"
        breadcrumbs={[{ label: 'System Setup' }, { label: 'Pricing Rules' }]} />

      <div className="p-6">
        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditingTable(null); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                  isActive
                    ? 'border-gold text-gold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-mono',
                    isActive ? 'bg-gold/15 text-gold' : 'bg-muted text-muted-foreground'
                  )}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">

          {/* ===== Surcharge Tiers ===== */}
          {activeTab === 'surcharge' && (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <DollarSign className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">Surcharge Tiers (S0–S5)</h3>
                  <p className="text-[10px] text-muted-foreground">Values synced from <span className="font-semibold text-gold">Subscription Pricing & Setup</span> — single source of truth for all pricing</p>
                </div>
                {editingTable !== 'surcharge' ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditingTable('surcharge')}>
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingTable(null)} className="gap-1.5 text-xs">
                      <X className="w-3 h-3" /> Cancel
                    </Button>
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs" onClick={() => saveTable('Surcharge Tiers')} disabled={saving}>
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">From (price/ml)</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">To</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">S Category</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Surcharge (AED) <span className="text-[9px] text-gold">auto</span></th>
                      {editingTable === 'surcharge' && <th className="w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {surcharges.map((s, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          {editingTable === 'surcharge' ? (
                            <input type="number" step="0.01" value={s.from_price_per_ml} onChange={e => updateSurcharge(idx, 'from_price_per_ml', e.target.value)}
                              className="w-24 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono">{s.from_price_per_ml.toFixed(2)}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === 'surcharge' ? (
                            <input type="number" step="0.01" value={s.to_price_per_ml ?? ''} onChange={e => updateSurcharge(idx, 'to_price_per_ml', e.target.value)}
                              placeholder="∞" className="w-24 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono">{s.to_price_per_ml?.toFixed(2) ?? '∞'}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === 'surcharge' ? (
                            <input type="text" value={s.s_category} onChange={e => updateSurcharge(idx, 's_category', e.target.value)}
                              className="w-20 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono font-semibold">{s.s_category}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono text-gold font-semibold">+AED {s.s_price.toFixed(0)}</span>
                            <Lock className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                          <span className="text-[10px] text-muted-foreground">from Subscription Setup</span>
                        </td>
                        {editingTable === 'surcharge' && (
                          <td className="px-2">
                            <button onClick={() => removeSurcharge(idx)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingTable === 'surcharge' && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={addSurcharge} className="gap-1.5 text-xs">
                      <Plus className="w-3 h-3" /> Add Tier
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== 2ml Pricing ===== */}
          {activeTab === '2ml' && (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950/30 flex items-center justify-center">
                  <Droplets className="w-4.5 h-4.5 text-sky-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">2ml Pricing</h3>
                  <p className="text-[10px] text-muted-foreground">Fixed 2ml decant price per surcharge category (S0–S5)</p>
                </div>
                {editingTable !== '2ml' ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditingTable('2ml')}>
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingTable(null)} className="gap-1.5 text-xs">
                      <X className="w-3 h-3" /> Cancel
                    </Button>
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs" onClick={() => saveTable('2ml Pricing')} disabled={saving}>
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3 w-1/2">Category</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3 w-1/2">Price (AED)</th>
                      {editingTable === '2ml' && <th className="w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {twoMlTiers.map((t, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          {editingTable === '2ml' ? (
                            <input type="text" value={t.s_category} onChange={e => update2ml(idx, 's_category', e.target.value)}
                              className="w-24 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono font-semibold">{t.s_category}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === '2ml' ? (
                            <input type="number" step="1" value={t.price} onChange={e => update2ml(idx, 'price', e.target.value)}
                              className="w-28 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono text-gold font-semibold">AED {t.price.toFixed(2)}</span>}
                        </td>
                        {editingTable === '2ml' && (
                          <td className="px-2">
                            <button onClick={() => remove2ml(idx)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {twoMlTiers.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">No 2ml pricing tiers yet. Click Edit to add.</td></tr>
                    )}
                  </tbody>
                </table>
                {editingTable === '2ml' && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={add2ml} className="gap-1.5 text-xs">
                      <Plus className="w-3 h-3" /> Add Tier
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== Hype Multiplier ===== */}
          {activeTab === 'hype' && (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
                  <TrendingUp className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">Hype Multiplier</h3>
                  <p className="text-[10px] text-muted-foreground">Applied to pricing based on perfume hype level</p>
                </div>
                {editingTable !== 'subhype' ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditingTable('subhype')}>
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingTable(null)} className="gap-1.5 text-xs"><X className="w-3 h-3" /> Cancel</Button>
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs" onClick={() => saveTable('Hype Multipliers')} disabled={saving}>
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Hype Level</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Hype Mult</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subHypeMultipliers.map((s, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          {editingTable === 'subhype' ? (
                            <input type="text" value={s.hype} onChange={e => updateSubHype(idx, 'hype', e.target.value)}
                              className="w-32 bg-background border border-input rounded px-2 py-1 text-sm" />
                          ) : <span className="text-sm font-medium">{s.hype}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === 'subhype' ? (
                            <input type="number" step="0.1" value={s.multiplier} onChange={e => updateSubHype(idx, 'multiplier', e.target.value)}
                              className="w-24 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono font-semibold">{s.multiplier}x</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ===== ML Discount ===== */}
          {activeTab === 'mldiscount' && (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                  <Percent className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">ml Discount (One-Time Perfume)</h3>
                  <p className="text-[10px] text-muted-foreground">Used only for one-time decant orders (Shopify / à-la-carte sales)</p>
                </div>
                {editingTable !== 'mldiscount' ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditingTable('mldiscount')}>
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingTable(null)} className="gap-1.5 text-xs"><X className="w-3 h-3" /> Cancel</Button>
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs" onClick={() => saveTable('ML Discounts')} disabled={saving}>
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Label</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">ml Size</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Discount Factor</th>
                      {editingTable === 'mldiscount' && <th className="w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {mlDiscounts.map((d, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          {editingTable === 'mldiscount' ? (
                            <select value={d.label} onChange={e => updateMlDiscount(idx, 'label', e.target.value)}
                              className="bg-background border border-input rounded px-2 py-1 text-sm">
                              <option value="Premium">Premium</option>
                              <option value="Discount">Discount</option>
                            </select>
                          ) : <StatusBadge variant={d.label === 'Premium' ? 'gold' : 'muted'}>{d.label}</StatusBadge>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === 'mldiscount' ? (
                            <input type="number" step="1" value={d.ml_size} onChange={e => updateMlDiscount(idx, 'ml_size', e.target.value)}
                              className="w-20 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono font-semibold">{d.ml_size}ml</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === 'mldiscount' ? (
                            <input type="number" step="0.01" value={d.discount_factor} onChange={e => updateMlDiscount(idx, 'discount_factor', e.target.value)}
                              className="w-24 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono">{(d.discount_factor * 100).toFixed(1)}%</span>}
                        </td>
                        {editingTable === 'mldiscount' && (
                          <td className="px-2">
                            <button onClick={() => removeMlDiscount(idx)} className="text-destructive hover:text-destructive/80">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingTable === 'mldiscount' && (
                  <div className="px-4 py-3 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={addMlDiscount} className="gap-1.5 text-xs">
                      <Plus className="w-3 h-3" /> Add Size
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== One-Time Perfume (ml) Multiplier ===== */}
          {activeTab === 'alacarte' && (
            <>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold">One-Time Perfume (ml) Multiplier</h3>
                  <p className="text-[10px] text-muted-foreground">Hype-based pricing multiplier for one-time decant orders</p>
                </div>
                {editingTable !== 'alacarte' ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditingTable('alacarte')}>
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingTable(null)} className="gap-1.5 text-xs"><X className="w-3 h-3" /> Cancel</Button>
                    <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 text-xs" onClick={() => saveTable('One-Time Perfume (ml) Multiplier')} disabled={saving}>
                      <Save className="w-3 h-3" /> Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Hype Level</th>
                      <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alacarteMultipliers.map((a, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          {editingTable === 'alacarte' ? (
                            <input type="text" value={a.hype} onChange={e => updateAlacarte(idx, 'hype', e.target.value)}
                              className="w-32 bg-background border border-input rounded px-2 py-1 text-sm" />
                          ) : <span className="text-sm font-medium">{a.hype}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {editingTable === 'alacarte' ? (
                            <input type="number" step="0.25" value={a.multiplier} onChange={e => updateAlacarte(idx, 'multiplier', e.target.value)}
                              className="w-24 bg-background border border-input rounded px-2 py-1 text-sm font-mono" />
                          ) : <span className="text-sm font-mono font-bold">{a.multiplier}x</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

// ---- Vault Locations ----
export function VaultLocations() {
  const { data: locRes } = useApiQuery(() => api.master.locations(), []);
  const locations = (locRes || []) as VaultLocation[];

  return (
    <div>
      <PageHeader title="Vault Locations" subtitle={`${locations.length} locations`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Vault Locations' }]}
        actions={<Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => toast.info('Feature coming soon')}><Plus className="w-3.5 h-3.5" /> Add Location</Button>} />
      <div className="p-6">
        <SectionCard title="">
          <div className="overflow-x-auto -m-4">
            <table className="w-full ops-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Code</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Zone</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Shelf</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Slot</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Type</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Occupied</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(l => (
                  <tr key={l.location_code} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 text-sm font-mono font-medium">{l.location_code}</td>
                    <td className="px-4 py-2 text-sm">{l.zone}</td>
                    <td className="px-4 py-2 text-sm font-mono">{l.shelf}</td>
                    <td className="px-4 py-2 text-sm font-mono">{l.slot}</td>
                    <td className="px-4 py-2"><StatusBadge variant={l.type === 'sealed' ? 'success' : 'info'}>{l.type}</StatusBadge></td>
                    <td className="px-4 py-2"><StatusBadge variant={l.occupied ? 'warning' : 'muted'}>{l.occupied ? 'Yes' : 'No'}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ---- Suppliers ----
export function SuppliersPage() {
  const { data: supRes } = useApiQuery(() => api.master.suppliers(), []);
  const suppliers = (supRes || []) as Supplier[];

  return (
    <div>
      <PageHeader title="Suppliers" subtitle={`${suppliers.length} suppliers`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Suppliers' }]}
        actions={<Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => toast.info('Feature coming soon')}><Plus className="w-3.5 h-3.5" /> Add Supplier</Button>} />
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <div key={s.supplier_id} className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold">{s.name}</h3>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{s.supplier_id}</p>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{s.contact_email}</p>
                {s.contact_phone && <p>{s.contact_phone}</p>}
                <p>{s.country}</p>
              </div>
              <div className="mt-2">
                <StatusBadge variant={s.active ? 'success' : 'muted'}>{s.active ? 'Active' : 'Inactive'}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Syringes Registry ----
export function SyringesRegistry() {
  const { data: syrRes } = useApiQuery(() => api.master.syringes(), []);
  const syringes = (syrRes || []) as Syringe[];

  return (
    <div>
      <PageHeader title="Syringes Registry" subtitle={`${syringes.length} syringes`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Syringes Registry' }]}
        actions={<Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => toast.info('Syringes are auto-created when perfumes are added')}><Plus className="w-3.5 h-3.5" /> Add Syringe</Button>} />
      <div className="p-6">
        <div className="mb-4 bg-gold/5 border border-gold/20 rounded-lg px-4 py-3">
          <p className="text-xs text-gold">
            <strong>Auto-generation:</strong> Syringes are automatically created with sequential IDs (S/1, S/2, S/3...) when new perfumes are added to the system. Each syringe is permanently linked to its master perfume.
          </p>
        </div>
        <SectionCard title="">
          <table className="w-full ops-table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Syringe ID</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Seq #</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Dedicated Perfume</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Master ID</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Notes</th>
                <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {syringes.map(s => (
                <tr key={s.syringe_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2 text-sm font-mono font-bold">{s.syringe_id}</td>
                  <td className="px-3 py-2 text-sm font-mono text-muted-foreground">{s.sequence_number}</td>
                  <td className="px-3 py-2 text-sm">{s.dedicated_perfume_name || '—'}</td>
                  <td className="px-3 py-2 text-[11px] font-mono text-muted-foreground">{s.assigned_master_id || '—'}</td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">{s.notes}</td>
                  <td className="px-3 py-2"><StatusBadge variant={s.active ? 'success' : 'muted'}>{s.active ? 'Active' : 'Inactive'}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}

// ---- Packaging SKUs ----
export function PackagingSKUs() {
  const { data: skusRes } = useApiQuery(() => api.master.packagingSKUs(), []);
  const skus = (skusRes || []) as PackagingSKU[];

  return (
    <div>
      <PageHeader title="Packaging & Materials Components" subtitle={`${skus.length} components`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Packaging & Materials' }]}
        actions={<Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => toast.info('Feature coming soon')}><Plus className="w-3.5 h-3.5" /> Add Component</Button>} />
      <div className="p-6">
        <SectionCard title="">
          <div className="overflow-x-auto -m-4">
            <table className="w-full ops-table">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">SKU ID</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Name</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Type</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-3">Size</th>
                </tr>
              </thead>
              <tbody>
                {skus.map(s => (
                  <tr key={s.sku_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 text-sm font-mono font-medium">{s.sku_id}</td>
                    <td className="px-4 py-2 text-sm">{s.name}</td>
                    <td className="px-4 py-2"><StatusBadge variant="muted">{s.type}</StatusBadge></td>
                    <td className="px-4 py-2 text-sm font-mono">{s.size_spec || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
