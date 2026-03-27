// ============================================================
// Em Vault — Rotational Vault Releases
// Premium card-based layout with perfume previews
// Multiple active releases, drag-and-drop rotation order,
// master codes, Open to Everyone / Master Code access models
// ============================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Lock, Plus, Timer, Users, Eye, Droplets, Clock,
  TrendingUp, Search, Loader2, Trash2,
  RotateCcw, Calendar, BarChart3,
  Power, PowerOff, Copy, Key,
  Sparkles, RefreshCw, Edit,
  GripVertical, Globe, ShieldCheck,
  ChevronRight, EyeOff, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  live: { label: 'Live', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  scheduled: { label: 'Scheduled', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/20' },
  ended: { label: 'Ended', color: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  draft: { label: 'Draft', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
};

const ACCESS_MODELS = [
  { value: 'open', label: 'Open to Everyone', icon: Globe, desc: 'Anyone can browse and purchase from the vault' },
  { value: 'master_code', label: 'Master Code', icon: Key, desc: 'Requires a master code or custom code to access' },
];

const ROTATION_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bimonthly', label: 'Bi-Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
];

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endDate]);
  return <span className="font-mono font-bold text-gold">{timeLeft}</span>;
}

export default function EmVault() {
  const [tab, setTab] = useState('releases');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showRotationPopup, setShowRotationPopup] = useState<any>(null);

  // Rotation settings (editable)
  const [rotationFrequency, setRotationFrequency] = useState('monthly');
  const [accessModel, setAccessModel] = useState<'open' | 'master_code'>('master_code');

  // Master codes
  const [masterCode, setMasterCode] = useState('EMVAULT2026');
  const [customCodes, setCustomCodes] = useState<{ code: string; label: string; active: boolean }[]>([
    { code: 'VIP-GOLD-2026', label: 'VIP Gold Members', active: true },
    { code: 'PRESS-ACCESS', label: 'Press & Media', active: true },
  ]);
  const [newCodeForm, setNewCodeForm] = useState({ code: '', label: '' });

  // Real data
  const { data: releasesData, isLoading: loading, refetch } = useApiQuery<any>(api.emVault.listReleases);
  const { data: statsData } = useApiQuery<any>(api.emVault.stats);

  // Fetch perfume master data for selection
  const { data: perfumesData } = useApiQuery<any>(api.master.perfumes);
  const perfumes = useMemo(() => (perfumesData as any)?.data ?? [], [perfumesData]);

  const releases = (releasesData as any)?.data ?? [];
  const stats = statsData ?? { totalReleases: 0, liveReleases: 0, totalSubscribers: 0, totalAllocated: 0 };

  // Multiple active releases
  const activeReleases = releases.filter((r: any) => r.status === 'live');

  // Rotation order state (local reordering)
  const [rotationOrder, setRotationOrder] = useState<any[]>([]);
  useEffect(() => {
    if (releases.length > 0) {
      setRotationOrder([...releases].sort((a: any, b: any) => {
        const order = { live: 0, scheduled: 1, draft: 2, ended: 3 };
        return (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4);
      }));
    }
  }, [releases]);

  // Create form
  const [form, setForm] = useState({
    month: '', theme: '', description: '', startDate: '', endDate: '',
  });

  const handleCreate = useCallback(async () => {
    if (!form.theme.trim()) { toast.error('Theme is required'); return; }
    if (!form.month.trim()) { toast.error('Month is required'); return; }
    setCreating(true);
    try {
      const releaseId = `VLT-${Date.now().toString(36).toUpperCase()}`;
      await api.emVault.createRelease({ releaseId, ...form, maxSkus: 10, accessCode: '', rotationFrequency });
      toast.success(`Vault release "${form.theme}" created`);
      setShowCreate(false);
      setForm({ month: '', theme: '', description: '', startDate: '', endDate: '' });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create release');
    } finally {
      setCreating(false);
    }
  }, [form, rotationFrequency, refetch]);

  const handleDelete = useCallback(async (e: React.MouseEvent, releaseId: string, theme: string) => {
    e.stopPropagation();
    if (!confirm(`Delete vault release "${theme}"? This cannot be undone.`)) return;
    try {
      await api.emVault.deleteRelease(releaseId);
      toast.success(`Release "${theme}" deleted`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete');
    }
  }, [refetch]);

  const handleToggleActive = useCallback(async (e: React.MouseEvent | null, releaseId: string, currentStatus: string) => {
    if (e) e.stopPropagation();
    const newStatus = currentStatus === 'live' ? 'scheduled' : 'live';
    try {
      await api.emVault.updateRelease(releaseId, { status: newStatus });
      toast.success(`Release ${newStatus === 'live' ? 'activated' : 'deactivated'}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    }
  }, [refetch]);

  const handleStatusChange = useCallback(async (releaseId: string, newStatus: string) => {
    try {
      await api.emVault.updateRelease(releaseId, { status: newStatus });
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    }
  }, [refetch]);

  const handleAddCustomCode = useCallback(() => {
    if (!newCodeForm.code.trim()) { toast.error('Code is required'); return; }
    setCustomCodes(prev => [...prev, { code: newCodeForm.code.toUpperCase(), label: newCodeForm.label || 'Custom', active: true }]);
    setNewCodeForm({ code: '', label: '' });
    toast.success('Custom code added');
  }, [newCodeForm]);

  // Total subscribers across all releases
  const totalSubscribers = releases.reduce((s: number, r: any) => s + (r.subscriberCount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Em Vault Releases"
        subtitle="Rotational vault with curated rare selections — multiple active releases, flexible rotation"
        actions={
          <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> New Release
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip — Replaced Claims with Total Subscribers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { icon: Lock, label: 'Total Releases', value: stats.totalReleases || releases.length, color: 'text-gold', bg: 'bg-gold/10' },
            { icon: Power, label: 'Active Now', value: activeReleases.length, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
            { icon: Users, label: 'Total Subscribers', value: totalSubscribers || stats.totalSubscribers || 0, color: 'text-blue-600', bg: 'bg-blue-500/10' },
            { icon: Droplets, label: 'Total SKUs Curated', value: stats.totalAllocated || releases.reduce((s: number, r: any) => s + (r.totalItems ?? 0), 0), color: 'text-purple-600', bg: 'bg-purple-500/10' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}><Icon className={cn('w-4 h-4', color)} /></div>
                  <div><p className="text-xl font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="releases" className="gap-1.5"><Lock className="w-3.5 h-3.5" /> Releases ({releases.length})</TabsTrigger>
            <TabsTrigger value="rotation" className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Rotation</TabsTrigger>
            <TabsTrigger value="master_access" className="gap-1.5"><Key className="w-3.5 h-3.5" /> Master Access</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Performance</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {/* ===== RELEASES TAB — Premium Card Layout ===== */}
        {tab === 'releases' && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {releases.map((release: any) => {
              const statusConfig = STATUS_CONFIG[release.status] ?? STATUS_CONFIG.draft;
              const isActive = release.status === 'live';
              const perfumeList: any[] = release.rotation ?? release.items ?? [];

              return (
                <Card
                  key={release.releaseId}
                  className={cn(
                    'transition-all hover:shadow-lg cursor-pointer group overflow-hidden',
                    isActive && 'border-gold/30 shadow-gold/5 hover:border-gold/50',
                    release.status === 'scheduled' && 'border-blue-500/20',
                    release.status === 'ended' && 'opacity-75',
                  )}
                  onClick={() => setShowDetail(release)}
                >
                  <CardContent className="p-0">
                    {/* Status header strip */}
                    <div className={cn(
                      'px-5 py-3 border-b flex items-center justify-between',
                      isActive ? 'bg-gradient-to-r from-gold/10 via-amber-500/5 to-gold/10' : 'bg-muted/30',
                    )}>
                      <div className="flex items-center gap-2">
                        <Lock className={cn('w-4 h-4', isActive ? 'text-gold' : 'text-muted-foreground')} />
                        <span className={cn('text-xs font-bold uppercase tracking-wider', isActive ? 'text-gold' : 'text-muted-foreground')}>
                          {release.month}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', statusConfig.bg, statusConfig.color)}>
                          {statusConfig.label}
                        </Badge>
                        {release.accessModel === 'master_code' && (
                          <Key className="w-3 h-3 text-gold/60" />
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      {/* Title + description */}
                      <h3 className="text-lg font-bold mb-1 group-hover:text-gold transition-colors">
                        {release.theme || release.name}
                      </h3>
                      {release.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{release.description}</p>
                      )}

                      {/* Perfume preview chips */}
                      {perfumeList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {perfumeList.slice(0, 3).map((p: any, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gold/5 border border-gold/20 font-medium text-foreground">
                              <Droplets className="w-2.5 h-2.5 text-gold" />
                              {p.name}
                            </span>
                          ))}
                          {perfumeList.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              +{perfumeList.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Date range + countdown */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                        {release.startDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(release.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {release.endDate && ` → ${new Date(release.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                          </span>
                        )}
                        {isActive && release.endDate && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3 text-gold" />
                            <CountdownTimer endDate={release.endDate} />
                          </span>
                        )}
                      </div>

                      {/* Stats row — Subscribers instead of Claims */}
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Droplets className="w-3 h-3" /> {release.totalItems ?? perfumeList.length} SKUs
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {release.subscriberCount ?? 0} subscribers
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="px-5 py-2.5 border-t bg-muted/30 flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={(e) => { e.stopPropagation(); setShowDetail(release); }}>
                        <Eye className="w-3 h-3" /> View Details
                      </Button>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1.5 mr-1">
                          <span className="text-[10px] text-muted-foreground">{isActive ? 'Live' : 'Off'}</span>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleActive(null, release.releaseId, release.status)}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7 w-7 p-0" onClick={(e) => handleDelete(e, release.releaseId, release.theme || release.name)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {releases.length === 0 && (
              <div className="col-span-full border border-dashed border-border rounded-lg p-12 text-center">
                <Lock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">No vault releases yet</p>
                <p className="text-xs text-muted-foreground/60 mb-4">Create your first rotational vault drop with curated rare selections</p>
                <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Create First Release</Button>
              </div>
            )}
          </div>
        )}

        {/* ===== ROTATION TAB — Drag-and-Drop ===== */}
        {tab === 'rotation' && !loading && (
          <div className="space-y-4">
            {/* Editable Rotation Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="w-4 h-4 text-gold" /> Rotation Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Rotation Frequency</Label>
                    <Select value={rotationFrequency} onValueChange={v => { setRotationFrequency(v); toast.success(`Rotation frequency set to ${v}`); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROTATION_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">All active releases rotate together at this frequency</p>
                  </div>
                  <div>
                    <Label>Access Model</Label>
                    <Select value={accessModel} onValueChange={v => { setAccessModel(v as any); toast.success(`Access model set to ${v === 'open' ? 'Open to Everyone' : 'Master Code'}`); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACCESS_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {accessModel === 'open' ? 'Anyone can browse the vault' : 'Requires master code or custom code to access'}
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
                  <strong>Multiple active releases:</strong> You can have 1, 2, 3+ releases active at once. Toggle each release's active state from the Releases tab. Rotation rotates all active releases together.
                </div>
              </CardContent>
            </Card>

            {/* Rotation View — Real Drag-and-Drop */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-gold" /> Rotation Order</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Drag and drop releases to set rotation priority. Click a release to see details.</p>
                {rotationOrder.length > 0 ? (
                  <DragDropRotationList
                    items={rotationOrder}
                    onReorder={setRotationOrder}
                    onClickItem={(release) => setShowDetail(release)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No releases to show in rotation. Create your first vault release.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== MASTER ACCESS TAB ===== */}
        {tab === 'master_access' && !loading && (
          <div className="space-y-4">
            {/* Master Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Key className="w-4 h-4 text-gold" /> Master Access Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The master code grants access to the entire Em Vault. Share with VIP customers or use for internal access.
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    value={masterCode}
                    onChange={e => setMasterCode(e.target.value.toUpperCase())}
                    className="font-mono text-lg font-bold tracking-wider max-w-xs"
                  />
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => { navigator.clipboard.writeText(masterCode); toast.success('Master code copied'); }}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => { setMasterCode(`EM-${Date.now().toString(36).toUpperCase()}`); toast.success('New master code generated'); }}>
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Custom Codes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-500" /> Custom Access Codes</CardTitle>
                  <Badge variant="outline" className="text-xs">{customCodes.length} codes</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create custom codes for specific groups — non-account customers, press, corporate partners, etc.
                </p>

                {/* Add new code */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Code (e.g. VIP-2026)"
                    value={newCodeForm.code}
                    onChange={e => setNewCodeForm(f => ({ ...f, code: e.target.value }))}
                    className="font-mono max-w-[200px]"
                  />
                  <Input
                    placeholder="Label (e.g. VIP Members)"
                    value={newCodeForm.label}
                    onChange={e => setNewCodeForm(f => ({ ...f, label: e.target.value }))}
                    className="max-w-[200px]"
                  />
                  <Button size="sm" onClick={handleAddCustomCode} className="gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Code
                  </Button>
                </div>

                {/* Code list */}
                {customCodes.length > 0 ? (
                  <div className="space-y-2">
                    {customCodes.map((code, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <Key className="w-4 h-4 text-gold" />
                          <div>
                            <span className="font-mono font-bold text-sm">{code.code}</span>
                            <span className="text-xs text-muted-foreground ml-2">{code.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px]', code.active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20')}>
                            {code.active ? 'Active' : 'Disabled'}
                          </Badge>
                          <Switch
                            checked={code.active}
                            onCheckedChange={(checked) => {
                              setCustomCodes(prev => prev.map((c, j) => j === i ? { ...c, active: checked } : c));
                            }}
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { navigator.clipboard.writeText(code.code); toast.success('Code copied'); }}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setCustomCodes(prev => prev.filter((_, j) => j !== i))}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-lg p-6 text-center">
                    <Key className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No custom codes yet. Add codes for specific customer groups.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== PERFORMANCE TAB — Subscribers-focused ===== */}
        {tab === 'analytics' && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-gold/5 to-amber-500/5 border-gold/20">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-gold">{stats.totalReleases || releases.length}</p>
                  <p className="text-xs text-muted-foreground">Total Drops</p>
                </CardContent>
              </Card>
              <Card><CardContent className="p-4 text-center"><p className="text-3xl font-bold">{totalSubscribers}</p><p className="text-xs text-muted-foreground">Total Subscribers</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-3xl font-bold">{releases.reduce((s: number, r: any) => s + (r.totalItems ?? 0), 0)}</p><p className="text-xs text-muted-foreground">Total SKUs Curated</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-3xl font-bold">{activeReleases.length}</p><p className="text-xs text-muted-foreground">Active Releases</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Release Performance</CardTitle></CardHeader>
              <CardContent>
                {releases.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Release</th>
                          <th className="pb-2 font-medium text-muted-foreground">Month</th>
                          <th className="pb-2 font-medium text-muted-foreground">Status</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center">SKUs</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center">Subscribers</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {releases.map((r: any) => {
                          const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.draft;
                          return (
                            <tr key={r.releaseId} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer" onClick={() => setShowDetail(r)}>
                              <td className="py-2.5 font-medium">{r.theme || r.name}</td>
                              <td className="py-2.5 text-muted-foreground">{r.month}</td>
                              <td className="py-2.5"><Badge variant="outline" className={cn('text-[9px] uppercase', sc.bg, sc.color)}>{sc.label}</Badge></td>
                              <td className="py-2.5 text-center">{r.totalItems ?? 0}</td>
                              <td className="py-2.5 text-center">{r.subscriberCount ?? 0}</td>
                              <td className="py-2.5 text-center">
                                <Badge variant="outline" className={cn('text-[9px]', r.status === 'live' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                                  {r.status === 'live' ? 'Yes' : 'No'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No release data to analyze yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Vault Release</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Month *</Label><Input value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} placeholder="e.g. March 2026" /></div>
              <div><Label>Theme *</Label><Input value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} placeholder="e.g. Oud Royale" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="A private collection of rare oud-based fragrances..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-xs text-muted-foreground">
              <strong>Note:</strong> Multiple releases can be active simultaneously. Toggle active/visible per release from the Releases tab. Access is controlled via the Master Access tab ({accessModel === 'open' ? 'currently open to everyone' : 'currently master code required'}).
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-gold hover:bg-gold/90 text-gold-foreground" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Create Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog — Subscribers-focused (no claims) */}
      {showDetail && (
        <VaultDetailDialog
          release={showDetail}
          perfumes={perfumes}
          onClose={() => setShowDetail(null)}
          onRefresh={refetch}
          onToggleActive={(releaseId: string, status: string) => handleToggleActive(null, releaseId, status)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ---- Drag-and-Drop Rotation List ----
function DragDropRotationList({ items, onReorder, onClickItem }: {
  items: any[];
  onReorder: (items: any[]) => void;
  onClickItem: (item: any) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  };

  const handleDragLeave = () => {
    setOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const newItems = [...items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(dropIndex, 0, moved);
    onReorder(newItems);
    setDragIndex(null);
    setOverIndex(null);
    dragRef.current = null;
    toast.success('Rotation order updated');
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
    dragRef.current = null;
  };

  return (
    <div className="space-y-2">
      {items.map((release: any, i: number) => {
        const sc = STATUS_CONFIG[release.status] ?? STATUS_CONFIG.draft;
        const isActive = release.status === 'live';
        const isDragging = dragIndex === i;
        const isOver = overIndex === i;

        return (
          <div
            key={release.releaseId}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none',
              isActive ? 'border-gold/30 bg-gold/5' : 'border-border hover:bg-muted/20',
              isDragging && 'opacity-40 scale-[0.98]',
              isOver && !isDragging && 'border-gold border-dashed bg-gold/10 scale-[1.01]',
            )}
          >
            {/* Drag handle */}
            <div className="shrink-0 flex flex-col items-center">
              <GripVertical className="w-5 h-5 text-muted-foreground/40" />
              <span className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">#{i + 1}</span>
            </div>

            {/* Release info */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onClickItem(release)}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{release.theme || release.name}</span>
                <Badge variant="outline" className={cn('text-[9px] uppercase', sc.bg, sc.color)}>{sc.label}</Badge>
                {isActive && <Badge className="bg-emerald-500 text-white text-[9px]">Active</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {release.month}
                {release.startDate && ` · ${new Date(release.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                {release.endDate && ` → ${new Date(release.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                {` · ${release.totalItems ?? 0} SKUs`}
                {` · ${release.subscriberCount ?? 0} subscribers`}
              </p>
            </div>

            <Eye className="w-4 h-4 text-muted-foreground shrink-0 cursor-pointer" onClick={() => onClickItem(release)} />
          </div>
        );
      })}
    </div>
  );
}

// ---- Vault Detail Dialog (perfume grid + manage items + edit release) ----
// Claims section removed — replaced with Subscribers focus
function VaultDetailDialog({
  release,
  perfumes,
  onClose,
  onRefresh,
  onToggleActive,
  onStatusChange,
}: {
  release: any;
  perfumes: any[];
  onClose: () => void;
  onRefresh: () => void;
  onToggleActive: (releaseId: string, status: string) => void;
  onStatusChange: (releaseId: string, newStatus: string) => void;
}) {
  const [addingItem, setAddingItem] = useState(false);
  const [perfumeSearch, setPerfumeSearch] = useState('');
  const [showAddPerfume, setShowAddPerfume] = useState(false);
  const [itemForm, setItemForm] = useState({ masterId: '', perfumeName: '', brand: '', sizeMl: 8, price: '0', allocation: 50 });

  // Use rotation data from the release itself (mock data has it inline)
  const releaseItems: any[] = release.rotation ?? release.items ?? [];
  const statusConfig = STATUS_CONFIG[release.status] ?? STATUS_CONFIG.draft;
  const isActive = release.status === 'live';

  const filteredPerfumes = useMemo(() => {
    if (!perfumeSearch.trim()) return perfumes.slice(0, 20);
    const q = perfumeSearch.toLowerCase();
    return perfumes.filter((p: any) =>
      p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.masterId?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [perfumes, perfumeSearch]);

  const existingIds = useMemo(() => new Set(releaseItems.map((i: any) => i.perfumeId || i.masterId)), [releaseItems]);

  const handleSelectPerfume = (perfume: any) => {
    setItemForm({
      masterId: perfume.masterId || perfume.id?.toString() || '',
      perfumeName: perfume.name || '',
      brand: perfume.brand || '',
      sizeMl: 8,
      price: perfume.price?.toString() || '0',
      allocation: 50,
    });
  };

  const handleAddItem = async () => {
    if (!itemForm.masterId || !itemForm.perfumeName) { toast.error('Select a perfume first'); return; }
    setAddingItem(true);
    try {
      await api.emVault.addItem({ releaseId: release.releaseId, ...itemForm });
      toast.success(`${itemForm.perfumeName} added to vault`);
      setItemForm({ masterId: '', perfumeName: '', brand: '', sizeMl: 8, price: '0', allocation: 50 });
      setPerfumeSearch('');
      setShowAddPerfume(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (id: string | number, name: string) => {
    try {
      await api.emVault.removeItem(typeof id === 'number' ? id : parseInt(id) || 0);
      toast.success(`${name} removed from vault`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove');
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-gold" />
            <span className="text-xl">{release.theme || release.name}</span>
            <Badge variant="outline" className={cn('text-[10px] uppercase ml-2', statusConfig.bg, statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Release info strip — Subscribers focus, no claims */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-gold/5 border border-gold/20 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Month</p>
              <p className="text-sm font-bold">{release.month}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SKUs</p>
              <p className="text-sm font-bold">{release.totalItems ?? releaseItems.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subscribers</p>
              <p className="text-sm font-bold text-blue-600">{release.subscriberCount ?? 0}</p>
            </div>
          </div>

          {/* Description */}
          {release.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{release.description}</p>
          )}

          {/* Date range */}
          {release.startDate && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(release.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {release.endDate && ` → ${new Date(release.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </span>
              {isActive && release.endDate && (
                <span className="flex items-center gap-1 ml-auto">
                  <Timer className="w-3.5 h-3.5 text-gold" />
                  <CountdownTimer endDate={release.endDate} />
                </span>
              )}
            </div>
          )}

          {/* Curated Perfumes Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Droplets className="w-4 h-4 text-gold" /> Curated Perfumes ({releaseItems.length})
              </h4>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowAddPerfume(!showAddPerfume)}>
                {showAddPerfume ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {showAddPerfume ? 'Cancel' : 'Add Perfume'}
              </Button>
            </div>

            {releaseItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {releaseItems.map((item: any, idx: number) => (
                  <div key={item.perfumeId || item.id || idx} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gold/5 to-transparent border border-gold/15 hover:border-gold/30 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                        <Droplets className="w-4 h-4 text-gold" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.perfumeName || item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.brand}
                          {item.sizeMl && ` · ${item.sizeMl}ml`}
                          {item.price && ` · AED ${Number(item.price).toFixed(0)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.allocation && (
                        <Badge variant="outline" className="text-[9px]">{item.allocation} alloc</Badge>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        className="text-red-500 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveItem(item.id || item.perfumeId, item.perfumeName || item.name)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-lg p-6 text-center">
                <Droplets className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No perfumes curated yet — click "Add Perfume" above</p>
              </div>
            )}
          </div>

          {/* Add Perfume Section */}
          {showAddPerfume && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Perfume to Vault</h4>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search perfumes by name, brand, or master ID..." value={perfumeSearch} onChange={e => setPerfumeSearch(e.target.value)} className="pl-9" />
              </div>
              {perfumeSearch.trim() && filteredPerfumes.length > 0 && !itemForm.masterId && (
                <div className="border rounded-lg max-h-40 overflow-y-auto mb-3">
                  {filteredPerfumes.map((p: any) => {
                    const alreadyAdded = existingIds.has(p.masterId || p.id?.toString());
                    return (
                      <button
                        key={p.masterId || p.id}
                        className={cn('w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/50 last:border-0', alreadyAdded && 'opacity-50')}
                        onClick={() => !alreadyAdded && handleSelectPerfume(p)}
                        disabled={alreadyAdded}
                      >
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2">{p.brand}</span>
                        </div>
                        {alreadyAdded ? <Badge variant="outline" className="text-[9px]">Already added</Badge> : <span className="text-xs text-muted-foreground">{p.masterId}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {itemForm.masterId && (
                <div className="bg-gold/5 border border-gold/20 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{itemForm.perfumeName}</p>
                      <p className="text-xs text-muted-foreground">{itemForm.brand} · {itemForm.masterId}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setItemForm({ masterId: '', perfumeName: '', brand: '', sizeMl: 8, price: '0', allocation: 50 })}>Clear</Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Size (ml)</Label><Input type="number" value={itemForm.sizeMl} onChange={e => setItemForm(f => ({ ...f, sizeMl: Number(e.target.value) }))} className="text-xs h-8" /></div>
                    <div><Label className="text-xs">Price (AED)</Label><Input type="number" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} className="text-xs h-8" /></div>
                    <div><Label className="text-xs">Allocation</Label><Input type="number" value={itemForm.allocation} onChange={e => setItemForm(f => ({ ...f, allocation: Number(e.target.value) }))} className="text-xs h-8" /></div>
                  </div>
                  <Button size="sm" onClick={handleAddItem} disabled={addingItem} className="bg-gold hover:bg-gold/90 text-gold-foreground text-xs w-full">
                    {addingItem ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Add to Vault
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              {release.status === 'draft' && (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { onStatusChange(release.releaseId, 'scheduled'); onClose(); }}>
                  Schedule
                </Button>
              )}
              {release.status === 'ended' && (
                <Button variant="outline" size="sm" className="text-xs text-blue-600" onClick={() => { onStatusChange(release.releaseId, 'scheduled'); onClose(); }}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Re-open
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                className={cn('text-xs gap-1', isActive ? 'text-amber-600' : 'text-emerald-600')}
                onClick={() => { onToggleActive(release.releaseId, release.status); onClose(); }}
              >
                {isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                {isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
