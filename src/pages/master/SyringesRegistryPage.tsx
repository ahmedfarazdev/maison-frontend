// ============================================================
// Syringes Registry — Grid/Row Toggle, Strict Perfume Assignment
// Design: "Maison Ops" — Luxury Operations
// Sizes: 5ml, 10ml, 20ml, custom. One syringe = one perfume.
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockSyringes, mockPerfumes } from '@/lib/mock-data';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import type { Syringe, SyringeStatus, SyringeSize, Perfume } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Pipette, Plus, Search, Edit2, Check, X, Download,
  Activity, AlertCircle, Trash2, RefreshCw, Sparkles,
  LayoutGrid, List, Lock, Eye, EyeOff,
} from 'lucide-react';

// ---- Constants ----
const STATUS_CONFIG: Record<SyringeStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'destructive'; icon: React.ElementType }> = {
  active: { label: 'Active', variant: 'success', icon: Activity },
  cleaning: { label: 'Cleaning', variant: 'warning', icon: RefreshCw },
  retired: { label: 'Retired', variant: 'muted', icon: AlertCircle },
  damaged: { label: 'Damaged', variant: 'destructive', icon: AlertCircle },
};

const SIZE_OPTIONS: SyringeSize[] = ['5ml', '10ml', '20ml', 'custom'];

function getSizeLabel(s: Syringe): string {
  if (s.size === 'custom' && s.custom_size_ml) return `${s.custom_size_ml}ml`;
  return s.size;
}

// ---- CSV Export ----
function exportSyringesCsv(syringes: Syringe[]) {
  const headers = ['Syringe ID', 'Size', 'Status', 'Assigned Perfume', 'Master ID', 'Use Count', 'Last Used', 'Notes', 'Created'];
  const rows = syringes.map(s => [
    s.syringe_id, getSizeLabel(s), s.status,
    s.dedicated_perfume_name || 'Unassigned', s.assigned_master_id || '',
    String(s.use_count), s.last_used || '', s.notes, s.created_at,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `syringes-registry-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success('Syringes exported');
}

// ---- Add/Edit Syringe Dialog ----
function SyringeFormDialog({ syringe, nextSeq, perfumes, existingAssignments, onSave, onClose }: {
  syringe?: Syringe;
  nextSeq: number;
  perfumes: Perfume[];
  existingAssignments: Set<string>;
  onSave: (s: Syringe) => void;
  onClose: () => void;
}) {
  const isEdit = !!syringe;
  const [form, setForm] = useState<Partial<Syringe>>(syringe || {
    size: '5ml',
    status: 'active',
    notes: '',
    use_count: 0,
    active: true,
  });
  const [customMl, setCustomMl] = useState<string>(syringe?.custom_size_ml?.toString() || '');
  const [perfumeSearch, setPerfumeSearch] = useState('');
  const [selectedPerfume, setSelectedPerfume] = useState<Perfume | null>(
    syringe?.assigned_master_id ? perfumes.find(p => p.master_id === syringe.assigned_master_id) || null : null
  );

  // Only show perfumes that are NOT already assigned to another syringe
  const availablePerfumes = useMemo(() => {
    return perfumes.filter(p => {
      // If editing and this syringe already has this perfume, allow it
      if (syringe?.assigned_master_id === p.master_id) return true;
      // Otherwise, exclude already-assigned perfumes
      return !existingAssignments.has(p.master_id);
    });
  }, [perfumes, existingAssignments, syringe]);

  const filteredPerfumes = availablePerfumes.filter(p =>
    p.name.toLowerCase().includes(perfumeSearch.toLowerCase()) ||
    p.brand.toLowerCase().includes(perfumeSearch.toLowerCase()) ||
    p.master_id.toLowerCase().includes(perfumeSearch.toLowerCase())
  ).slice(0, 8);

  const updateField = (field: keyof Syringe, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!selectedPerfume) {
      toast.error('A syringe must be assigned to a perfume. One syringe = one perfume.');
      return;
    }
    const parsedCustomMl = form.size === 'custom' ? parseFloat(customMl) : undefined;
    if (form.size === 'custom' && (!parsedCustomMl || parsedCustomMl <= 0)) {
      toast.error('Please enter a valid custom size in ml');
      return;
    }
    const saved: Syringe = {
      syringe_id: syringe?.syringe_id || `S/${nextSeq}`,
      assigned_master_id: selectedPerfume.master_id,
      dedicated_perfume_name: `${selectedPerfume.brand} ${selectedPerfume.name}`,
      dedicated_perfume_id: selectedPerfume.master_id,
      sequence_number: syringe?.sequence_number || nextSeq,
      size: (form.size as SyringeSize) || '5ml',
      custom_size_ml: parsedCustomMl,
      status: (form.status as SyringeStatus) || 'active',
      last_used: form.last_used,
      use_count: form.use_count || 0,
      active: form.status !== 'retired' && form.status !== 'damaged',
      notes: form.notes || '',
      created_at: syringe?.created_at || new Date().toISOString(),
    };
    onSave(saved);
    onClose();
    toast.success(isEdit ? `Syringe ${saved.syringe_id} updated` : `Syringe ${saved.syringe_id} created`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="text-base font-bold">{isEdit ? 'Edit Syringe' : 'Add Syringe'}</h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{isEdit ? syringe.syringe_id : `S/${nextSeq}`}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* ID Preview */}
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Syringe ID</p>
            <p className="text-2xl font-mono font-bold text-gold mt-1">{isEdit ? syringe.syringe_id : `S/${nextSeq}`}</p>
          </div>

          {/* Strict Assignment Notice */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Strict Assignment</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                Each syringe is dedicated to one perfume only. It cannot be used with any other perfume.
              </p>
            </div>
          </div>

          {/* Assign Perfume — REQUIRED */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">
              Assigned Perfume <span className="text-destructive">*</span>
            </label>
            {selectedPerfume ? (
              <div className="flex items-center gap-3 bg-gold/5 border border-gold/20 rounded-lg p-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-gold" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{selectedPerfume.brand} — {selectedPerfume.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{selectedPerfume.master_id}</p>
                </div>
                <button onClick={() => setSelectedPerfume(null)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={perfumeSearch} onChange={e => setPerfumeSearch(e.target.value)}
                    placeholder="Search perfume to assign..." className="pl-9" />
                </div>
                {perfumeSearch && (
                  <div className="mt-1 max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-1">
                    {filteredPerfumes.map(p => {
                      const isAssigned = existingAssignments.has(p.master_id) && syringe?.assigned_master_id !== p.master_id;
                      return (
                        <button key={p.master_id} onClick={() => { if (!isAssigned) { setSelectedPerfume(p); setPerfumeSearch(''); } }}
                          disabled={isAssigned}
                          className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                            isAssigned ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted/50')}>
                          <p className="font-medium text-xs">{p.brand} — {p.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {p.master_id} {isAssigned && '(already assigned)'}
                          </p>
                        </button>
                      );
                    })}
                    {filteredPerfumes.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No available perfumes</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Size */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Size</label>
            <div className="flex gap-2">
              {SIZE_OPTIONS.map(s => (
                <button key={s} onClick={() => updateField('size', s)}
                  className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-all',
                    form.size === s ? 'bg-gold/10 border-gold text-gold' : 'border-border hover:bg-muted/50')}>
                  {s === 'custom' ? 'Custom' : s}
                </button>
              ))}
            </div>
            {form.size === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <Input value={customMl} onChange={e => setCustomMl(e.target.value)}
                  type="number" min="1" step="0.5" placeholder="Enter ml..." className="flex-1" />
                <span className="text-xs text-muted-foreground font-mono">ml</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Status</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(STATUS_CONFIG) as [SyringeStatus, typeof STATUS_CONFIG[SyringeStatus]][]).map(([val, meta]) => {
                const Icon = meta.icon;
                return (
                  <button key={val} onClick={() => updateField('status', val)}
                    className={cn('flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium border transition-all',
                      form.status === val ? 'bg-gold/10 border-gold text-gold' : 'border-border hover:bg-muted/50')}>
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Notes</label>
            <textarea value={form.notes || ''} onChange={e => updateField('notes', e.target.value)} rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" placeholder="Internal notes..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleSubmit}>
            <Check className="w-3.5 h-3.5" /> {isEdit ? 'Save Changes' : 'Create Syringe'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----
export default function SyringesRegistryPage() {
  const [syringes, setSyringes] = useState<Syringe[]>([...mockSyringes]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'row'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingSyringe, setEditingSyringe] = useState<Syringe | undefined>(undefined);

  // Load perfumes from API for assignment
  const { data: perfumesData } = useApiQuery(() => api.master.perfumes());
  const perfumes: Perfume[] = (perfumesData as any)?.data || mockPerfumes;

  // Track which master_ids are already assigned
  const existingAssignments = useMemo(() => {
    const set = new Set<string>();
    syringes.forEach(s => {
      if (s.assigned_master_id) set.add(s.assigned_master_id);
    });
    return set;
  }, [syringes]);

  const filtered = useMemo(() => {
    return syringes.filter(s => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (filterSize !== 'all' && s.size !== filterSize) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return s.syringe_id.toLowerCase().includes(q) ||
          (s.dedicated_perfume_name || '').toLowerCase().includes(q) ||
          (s.assigned_master_id || '').toLowerCase().includes(q) ||
          s.notes.toLowerCase().includes(q);
      }
      return true;
    });
  }, [syringes, filterStatus, filterSize, searchTerm]);

  // Stats
  const activeCount = syringes.filter(s => s.status === 'active').length;
  const cleaningCount = syringes.filter(s => s.status === 'cleaning').length;
  const retiredCount = syringes.filter(s => s.status === 'retired').length;
  const assignedCount = syringes.filter(s => s.assigned_master_id).length;
  const totalUses = syringes.reduce((sum, s) => sum + s.use_count, 0);
  const nextSeq = syringes.length > 0 ? Math.max(...syringes.map(s => s.sequence_number)) + 1 : 1;

  const handleSaveSyringe = useCallback((s: Syringe) => {
    setSyringes(prev => {
      const idx = prev.findIndex(p => p.syringe_id === s.syringe_id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = s;
        return updated;
      }
      return [...prev, s];
    });
  }, []);

  const handleDeleteSyringe = useCallback((id: string) => {
    if (!confirm(`Delete syringe ${id}? This action cannot be undone.`)) return;
    setSyringes(prev => prev.filter(s => s.syringe_id !== id));
    toast.success(`Syringe ${id} deleted`);
  }, []);

  return (
    <div>
      <PageHeader
        title="Syringes Registry"
        subtitle={`${syringes.length} syringes · ${activeCount} active · ${assignedCount} assigned`}
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Syringes Registry' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportSyringesCsv(syringes)}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:bg-muted/50')}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('row')} className={cn('p-1.5 transition-colors', viewMode === 'row' ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:bg-muted/50')}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              onClick={() => { setEditingSyringe(undefined); setShowForm(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add Syringe
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Info Banner */}
        <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gold">Strict Perfume Assignment</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each syringe is permanently dedicated to one perfume. No syringe can be used with any other perfume except the assigned one.
              Sizes: 5ml, 10ml, 20ml, or custom.
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-emerald-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active</p>
            <p className="text-xl font-mono font-bold mt-1">{activeCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-amber-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cleaning</p>
            <p className="text-xl font-mono font-bold mt-1">{cleaningCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-zinc-400">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Retired</p>
            <p className="text-xl font-mono font-bold mt-1">{retiredCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-blue-500">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assigned</p>
            <p className="text-xl font-mono font-bold mt-1">{assignedCount}<span className="text-sm text-muted-foreground font-normal">/{syringes.length}</span></p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 border-l-[3px] border-l-gold">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Uses</p>
            <p className="text-xl font-mono font-bold mt-1">{totalUses.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search syringe ID, perfume, notes..." className="pl-9" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status:</span>
            {['all', ...Object.keys(STATUS_CONFIG)].map(v => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                  filterStatus === v ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Size:</span>
            {['all', ...SIZE_OPTIONS].map(v => (
              <button key={v} onClick={() => setFilterSize(v)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all',
                  filterSize === v ? 'bg-gold/10 text-gold border border-gold/30' : 'text-muted-foreground hover:bg-muted/50 border border-transparent')}>
                {v === 'all' ? 'All' : v === 'custom' ? 'Custom' : v}
              </button>
            ))}
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(s => {
              const statusConf = STATUS_CONFIG[s.status];
              const StatusIcon = statusConf.icon;
              return (
                <div key={s.syringe_id}
                  className="bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-gold/30 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                        <Pipette className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <h3 className="text-lg font-mono font-bold">{s.syringe_id}</h3>
                        <p className="text-[10px] font-mono text-muted-foreground">{getSizeLabel(s)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingSyringe(s); setShowForm(true); }}
                        className="text-muted-foreground hover:text-gold p-1">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSyringe(s.syringe_id)}
                        className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Assignment — always shown */}
                  {s.assigned_master_id ? (
                    <div className="bg-muted/30 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Lock className="w-3 h-3 text-gold" />
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dedicated To</p>
                      </div>
                      <p className="text-xs font-semibold">{s.dedicated_perfume_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{s.assigned_master_id}</p>
                    </div>
                  ) : (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-3">
                      <p className="text-[10px] text-destructive font-semibold text-center">⚠ Unassigned — must assign a perfume</p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-center mb-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Uses</p>
                      <p className="text-sm font-mono font-bold">{s.use_count}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Last Used</p>
                      <p className="text-sm font-mono font-bold">
                        {s.last_used ? new Date(s.last_used).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-between">
                    <StatusBadge variant={statusConf.variant}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConf.label}
                    </StatusBadge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Row View */
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Syringe</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Size</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Assigned Perfume</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Uses</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Last Used</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Status</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const statusConf = STATUS_CONFIG[s.status];
                  const StatusIcon = statusConf.icon;
                  return (
                    <tr key={s.syringe_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                            <Pipette className="w-4 h-4 text-gold" />
                          </div>
                          <div>
                            <p className="text-sm font-mono font-bold">{s.syringe_id}</p>
                            <p className="text-[10px] text-muted-foreground">Seq #{s.sequence_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-bold">{getSizeLabel(s)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.assigned_master_id ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <Lock className="w-3 h-3 text-gold" />
                              <p className="text-xs font-semibold">{s.dedicated_perfume_name}</p>
                            </div>
                            <p className="text-[10px] font-mono text-muted-foreground">{s.assigned_master_id}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-destructive font-semibold">⚠ Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-mono font-bold">{s.use_count}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-muted-foreground">
                          {s.last_used ? new Date(s.last_used).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge variant={statusConf.variant}>
                          <StatusIcon className="w-3 h-3 mr-1" />{statusConf.label}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingSyringe(s); setShowForm(true); }}
                            className="text-muted-foreground hover:text-gold p-1.5 rounded-md hover:bg-muted/50">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteSyringe(s.syringe_id)}
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted/50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Pipette className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No syringes match your filters</p>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <SyringeFormDialog
          syringe={editingSyringe}
          nextSeq={nextSeq}
          perfumes={perfumes}
          existingAssignments={existingAssignments}
          onSave={handleSaveSyringe}
          onClose={() => { setShowForm(false); setEditingSyringe(undefined); }}
        />
      )}
    </div>
  );
}
