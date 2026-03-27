// ============================================================
// Em Vault Access — Vault-level access management
// Simple CRM of people requesting vault access (not per-release)
// Approve → send approval email with their code
// Master access + custom access codes
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApiQuery';
import { api } from '@/lib/api-client';
import {
  Shield, UserCheck, UserX, Users, Clock, Search, Loader2,
  CheckCircle2, XCircle, Mail, Calendar, Key, Copy,
  Plus, RefreshCw, Trash2, Send, ShieldCheck, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  approved: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  denied: { label: 'Denied', color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20', icon: XCircle },
};

export default function EmVaultAccess() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'requests' | 'codes'>('requests');
  const [showApproveDialog, setShowApproveDialog] = useState<any>(null);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Master & custom codes (same as EmVault Releases page — shared state in production)
  const [masterCode, setMasterCode] = useState('EMVAULT2026');
  const [customCodes, setCustomCodes] = useState<{ code: string; label: string; active: boolean; usedBy: number }[]>([
    { code: 'VIP-GOLD-2026', label: 'VIP Gold Members', active: true, usedBy: 12 },
    { code: 'PRESS-ACCESS', label: 'Press & Media', active: true, usedBy: 5 },
    { code: 'INFLUENCER-Q1', label: 'Q1 Influencer Campaign', active: false, usedBy: 8 },
  ]);
  const [newCodeForm, setNewCodeForm] = useState({ code: '', label: '' });

  // Fetch access requests (vault-level, not per-release)
  const { data: requestsData, isLoading: loading, refetch } = useApiQuery<any>(api.emVault.listAccessRequests);
  const accessRequests = (requestsData as any)?.data ?? [];

  // Filter and search
  const filteredRequests = useMemo(() => {
    let list = accessRequests;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r: any) =>
        r.customerName?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.accessCode?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [accessRequests, search]);

  const pendingCount = accessRequests.filter((r: any) => r.status === 'pending').length;
  const approvedCount = accessRequests.filter((r: any) => r.status === 'approved').length;
  const deniedCount = accessRequests.filter((r: any) => r.status === 'denied').length;

  // Approve → open dialog to send approval email with code
  const handleApproveClick = useCallback((request: any) => {
    const code = `EM-${request.customerName?.split(' ')[0]?.toUpperCase() ?? 'USER'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setApprovalMessage(`Dear ${request.customerName},\n\nWelcome to the Em Vault — your exclusive access to our curated rotational collection of rare fragrances.\n\nYour personal vault access code is: ${code}\n\nUse this code to unlock the vault on our website. New selections rotate monthly.\n\nWith warmth,\nMaison Em`);
    setShowApproveDialog({ ...request, generatedCode: code });
  }, []);

  const handleSendApproval = useCallback(async () => {
    if (!showApproveDialog) return;
    setSending(true);
    try {
      await api.emVault.resolveAccessRequest(showApproveDialog.requestId, 'approved', showApproveDialog.customerName);
      toast.success(`Access approved for ${showApproveDialog.customerName} — approval email sent`);
      setShowApproveDialog(null);
      setApprovalMessage('');
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to approve');
    } finally {
      setSending(false);
    }
  }, [showApproveDialog, refetch]);

  const handleDeny = useCallback(async (requestId: string, name: string) => {
    try {
      await api.emVault.resolveAccessRequest(requestId, 'denied', name);
      toast.success(`Access denied for ${name}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to deny');
    }
  }, [refetch]);

  const handleAddCustomCode = useCallback(() => {
    if (!newCodeForm.code.trim()) { toast.error('Code is required'); return; }
    setCustomCodes(prev => [...prev, { code: newCodeForm.code.toUpperCase(), label: newCodeForm.label || 'Custom', active: true, usedBy: 0 }]);
    setNewCodeForm({ code: '', label: '' });
    toast.success('Custom code added');
  }, [newCodeForm]);

  return (
    <div>
      <PageHeader
        title="Em Vault Access"
        subtitle="Manage vault access requests and access codes — approve to send email with personal code"
      />

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
                <div><p className="text-xl font-bold">{pendingCount}</p><p className="text-[10px] text-muted-foreground">Pending Review</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                <div><p className="text-xl font-bold">{approvedCount}</p><p className="text-[10px] text-muted-foreground">Approved</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div>
                <div><p className="text-xl font-bold">{accessRequests.length}</p><p className="text-[10px] text-muted-foreground">Total Requests</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center"><Key className="w-4 h-4 text-gold" /></div>
                <div><p className="text-xl font-bold">{customCodes.length + 1}</p><p className="text-[10px] text-muted-foreground">Active Codes</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="requests" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Access Requests ({accessRequests.length})</TabsTrigger>
            <TabsTrigger value="codes" className="gap-1.5"><Key className="w-3.5 h-3.5" /> Access Codes ({customCodes.length + 1})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

        {/* ===== ACCESS REQUESTS TAB ===== */}
        {tab === 'requests' && !loading && (
          <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name, email, or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">{pendingCount} pending</Badge>
            </div>

            {/* Requests List — Simple CRM */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Vault Access Requests</CardTitle>
                  <p className="text-xs text-muted-foreground">People requesting access to the Em Vault</p>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRequests.length > 0 ? (
                  <div className="space-y-2">
                    {/* Sort: pending first, then approved, then denied */}
                    {[...filteredRequests].sort((a: any, b: any) => {
                      const order = { pending: 0, approved: 1, denied: 2 };
                      return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
                    }).map((req: any) => {
                      const sc = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                      const StatusIcon = sc.icon;
                      return (
                        <div key={req.requestId} className={cn(
                          'flex items-center justify-between py-3 px-4 rounded-lg border transition-colors',
                          req.status === 'pending' ? 'border-amber-500/20 bg-amber-500/5' : 'border-border hover:bg-muted/20'
                        )}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-xs font-bold text-gold">
                              {req.customerName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{req.customerName}</p>
                                {req.isSubscriber && <Badge variant="outline" className="text-[9px] bg-gold/10 text-gold border-gold/20">Subscriber</Badge>}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" /> {req.email}
                                {req.createdAt && (
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {req.accessCode && (
                              <button
                                className="flex items-center gap-1 text-xs font-mono text-gold/70 hover:text-gold transition-colors"
                                onClick={() => { navigator.clipboard.writeText(req.accessCode); toast.success('Code copied'); }}
                              >
                                <Key className="w-3 h-3" /> {req.accessCode}
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                            <Badge variant="outline" className={cn('text-[10px] font-bold uppercase gap-1', sc.bg, sc.color)}>
                              <StatusIcon className="w-3 h-3" /> {sc.label}
                            </Badge>
                            {req.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline" size="sm"
                                  className="text-xs text-emerald-600 border-emerald-500/30 gap-1 h-7"
                                  onClick={() => handleApproveClick(req)}
                                >
                                  <Send className="w-3 h-3" /> Approve & Email
                                </Button>
                                <Button
                                  variant="outline" size="sm"
                                  className="text-xs text-red-500 border-red-500/30 gap-1 h-7"
                                  onClick={() => handleDeny(req.requestId, req.customerName)}
                                >
                                  <XCircle className="w-3 h-3" /> Deny
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Shield className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">No vault access requests yet</p>
                    <p className="text-xs text-muted-foreground/60">When customers request access to the Em Vault, they'll appear here for review.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== ACCESS CODES TAB ===== */}
        {tab === 'codes' && !loading && (
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
                  Create custom codes for specific groups — non-account customers, press, corporate partners, influencers, etc.
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium text-muted-foreground">Code</th>
                          <th className="pb-2 font-medium text-muted-foreground">Label</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center">Used By</th>
                          <th className="pb-2 font-medium text-muted-foreground text-center">Status</th>
                          <th className="pb-2 font-medium text-muted-foreground text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customCodes.map((code, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="py-2.5">
                              <span className="font-mono font-bold text-sm">{code.code}</span>
                            </td>
                            <td className="py-2.5 text-muted-foreground">{code.label}</td>
                            <td className="py-2.5 text-center">{code.usedBy}</td>
                            <td className="py-2.5 text-center">
                              <Badge variant="outline" className={cn('text-[10px]', code.active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20')}>
                                {code.active ? 'Active' : 'Disabled'}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-right">
                              <div className="flex items-center gap-1 justify-end">
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
      </div>

      {/* Approval Email Dialog */}
      {showApproveDialog && (
        <Dialog open onOpenChange={() => setShowApproveDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" /> Approve & Send Email
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="font-medium">{showApproveDialog.customerName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-medium">{showApproveDialog.email}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Generated Access Code</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={showApproveDialog.generatedCode} readOnly className="font-mono font-bold" />
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(showApproveDialog.generatedCode); toast.success('Code copied'); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Approval Email Preview</Label>
                <Textarea
                  value={approvalMessage}
                  onChange={e => setApprovalMessage(e.target.value)}
                  rows={8}
                  className="mt-1 text-sm font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(null)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={handleSendApproval} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Approve & Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
