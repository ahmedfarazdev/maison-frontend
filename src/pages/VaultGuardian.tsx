// ============================================================
// Vault Guardian — Bottle Checkout/Check-in, Ledger, Requests
// Design: Enterprise report-style interface consistent with other pages.
// Features: USB HID barcode scanner, camera-based scanning,
// operator-batched requests, return flow with notes.
// ============================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { PageHeader, SectionCard, EmptyState, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Shield, ScanBarcode, ArrowUpFromLine, ArrowDownToLine, AlertTriangle,
  Clock, CheckCircle2, XCircle, Search, Package, User, Calendar,
  BookOpen, Filter, RotateCcw, Trash2, Eye, Wifi, WifiOff, Volume2,
  VolumeX, History, Zap, Radio, Camera, CameraOff, Users, ChevronDown,
  ChevronUp, Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useBarcodeScanner, type ScanEntry } from '@/hooks/useBarcodeScanner';
import { useCameraScanner } from '@/hooks/useCameraScanner';

// ---- Types ----
type BottleMovementType = 'checkout' | 'checkin' | 'empty' | 'broken';
type MovementStatus = 'pending' | 'out' | 'returned' | 'empty' | 'broken';

interface BottleRequest {
  id: string;
  bottle_id: string;
  bottle_name: string;
  bottle_barcode: string;
  brand: string;
  size_ml: number;
  requested_by: string;
  operator_name: string;
  station: string;
  job_id: string;
  job_code: string;
  requested_at: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  source: 'auto_picking' | 'manual_decant' | 'manual';
}

interface LedgerEntry {
  id: string;
  bottle_id: string;
  bottle_name: string;
  bottle_barcode: string;
  brand: string;
  size_ml: number;
  movement_type: BottleMovementType;
  status: MovementStatus;
  checked_out_at?: string;
  checked_in_at?: string;
  operator_id: string;
  operator_name: string;
  station: string;
  job_id?: string;
  job_code?: string;
  notes?: string;
  vault_location?: string;
}

// ---- Mock Data ----
const MOCK_REQUESTS: BottleRequest[] = [
  { id: 'REQ-001', bottle_id: 'BTL-0042', bottle_name: 'Aventus', bottle_barcode: 'AV-100ML-042', brand: 'Creed', size_ml: 100, requested_by: 'OP-001', operator_name: 'Ahmed K.', station: 'Picking', job_id: 'JOB-OT-001', job_code: 'JOB-OT-MLMQSY5E', requested_at: '2026-02-15T08:30:00Z', status: 'pending', source: 'auto_picking' },
  { id: 'REQ-002', bottle_id: 'BTL-0087', bottle_name: 'Baccarat Rouge 540', bottle_barcode: 'BR540-70ML-087', brand: 'MFK', size_ml: 70, requested_by: 'OP-001', operator_name: 'Ahmed K.', station: 'Picking', job_id: 'JOB-OT-001', job_code: 'JOB-OT-MLMQSY5E', requested_at: '2026-02-15T08:30:00Z', status: 'pending', source: 'auto_picking' },
  { id: 'REQ-003', bottle_id: 'BTL-0156', bottle_name: 'Oud Wood', bottle_barcode: 'OW-50ML-156', brand: 'Tom Ford', size_ml: 50, requested_by: 'OP-002', operator_name: 'Sara M.', station: 'Picking', job_id: 'JOB-SUB-001', job_code: 'JOB-SUB-CYC04A', requested_at: '2026-02-15T08:45:00Z', status: 'pending', source: 'auto_picking' },
  { id: 'REQ-004', bottle_id: 'BTL-0023', bottle_name: 'Tobacco Vanille', bottle_barcode: 'TV-100ML-023', brand: 'Tom Ford', size_ml: 100, requested_by: 'OP-003', operator_name: 'Khalid R.', station: 'Manual Decant', job_id: '', job_code: '', requested_at: '2026-02-15T09:00:00Z', status: 'pending', source: 'manual_decant' },
  { id: 'REQ-005', bottle_id: 'BTL-0201', bottle_name: 'Layton', bottle_barcode: 'LAY-125ML-201', brand: 'PDM', size_ml: 125, requested_by: 'OP-001', operator_name: 'Ahmed K.', station: 'Picking', job_id: 'JOB-OT-001', job_code: 'JOB-OT-MLMQSY5E', requested_at: '2026-02-15T08:30:00Z', status: 'fulfilled', source: 'auto_picking' },
  { id: 'REQ-006', bottle_id: 'BTL-0312', bottle_name: 'Ani', bottle_barcode: 'ANI-100ML-312', brand: 'Nishane', size_ml: 100, requested_by: 'OP-002', operator_name: 'Sara M.', station: 'Decanting', job_id: 'JOB-SUB-001', job_code: 'JOB-SUB-CYC04A', requested_at: '2026-02-15T09:15:00Z', status: 'pending', source: 'auto_picking' },
];

const MOCK_LEDGER: LedgerEntry[] = [
  { id: 'LED-001', bottle_id: 'BTL-0201', bottle_name: 'Layton', bottle_barcode: 'LAY-125ML-201', brand: 'PDM', size_ml: 125, movement_type: 'checkout', status: 'out', checked_out_at: '2026-02-15T08:35:00Z', operator_id: 'OP-001', operator_name: 'Ahmed K.', station: 'Picking', job_id: 'JOB-OT-001', job_code: 'JOB-OT-MLMQSY5E', vault_location: 'Vault A · Shelf 3 · Slot 12' },
  { id: 'LED-002', bottle_id: 'BTL-0099', bottle_name: 'Interlude Man', bottle_barcode: 'IM-100ML-099', brand: 'Amouage', size_ml: 100, movement_type: 'checkout', status: 'returned', checked_out_at: '2026-02-15T07:15:00Z', checked_in_at: '2026-02-15T09:30:00Z', operator_id: 'OP-002', operator_name: 'Sara M.', station: 'Picking', job_id: 'JOB-SUB-001', job_code: 'JOB-SUB-CYC04A', vault_location: 'Vault A · Shelf 1 · Slot 5' },
  { id: 'LED-003', bottle_id: 'BTL-0145', bottle_name: 'Reflection Man', bottle_barcode: 'RM-100ML-145', brand: 'Amouage', size_ml: 100, movement_type: 'empty', status: 'empty', checked_out_at: '2026-02-14T10:00:00Z', checked_in_at: '2026-02-14T14:20:00Z', operator_id: 'OP-001', operator_name: 'Ahmed K.', station: 'Decanting', notes: 'Fully decanted — 0ml remaining', vault_location: 'Vault B · Shelf 2 · Slot 8' },
  { id: 'LED-004', bottle_id: 'BTL-0078', bottle_name: 'Rehab', bottle_barcode: 'RH-100ML-078', brand: 'Initio', size_ml: 100, movement_type: 'broken', status: 'broken', checked_out_at: '2026-02-14T08:45:00Z', checked_in_at: '2026-02-14T09:10:00Z', operator_id: 'OP-003', operator_name: 'Khalid R.', station: 'Picking', notes: 'Dropped during transfer — cap cracked, leaking', vault_location: 'Vault A · Shelf 4 · Slot 2' },
  { id: 'LED-005', bottle_id: 'BTL-0310', bottle_name: 'Hacivat', bottle_barcode: 'HAC-50ML-310', brand: 'Nishane', size_ml: 50, movement_type: 'checkout', status: 'out', checked_out_at: '2026-02-15T09:10:00Z', operator_id: 'OP-002', operator_name: 'Sara M.', station: 'Decanting', job_id: 'JOB-SUB-001', job_code: 'JOB-SUB-CYC04A', vault_location: 'Vault B · Shelf 1 · Slot 3' },
  { id: 'LED-006', bottle_id: 'BTL-0055', bottle_name: 'Ombre Leather', bottle_barcode: 'OL-100ML-055', brand: 'Tom Ford', size_ml: 100, movement_type: 'checkout', status: 'returned', checked_out_at: '2026-02-14T11:00:00Z', checked_in_at: '2026-02-14T16:00:00Z', operator_id: 'OP-001', operator_name: 'Ahmed K.', station: 'Picking', vault_location: 'Vault A · Shelf 2 · Slot 7' },
];

// ---- Helpers ----
function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_COLORS: Record<MovementStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  out: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  returned: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  empty: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  broken: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_ICONS: Record<MovementStatus, typeof Clock> = {
  pending: Clock,
  out: ArrowUpFromLine,
  returned: ArrowDownToLine,
  empty: Package,
  broken: XCircle,
};

export default function VaultGuardian() {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [ledger, setLedger] = useState(MOCK_LEDGER);
  const [manualInput, setManualInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<string>('all');
  const [scanMode, setScanMode] = useState<'checkout' | 'checkin'>('checkout');
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnEntry, setReturnEntry] = useState<LedgerEntry | null>(null);
  const [returnStatus, setReturnStatus] = useState<'returned' | 'empty' | 'broken'>('returned');
  const [returnNotes, setReturnNotes] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(new Set(['OP-001', 'OP-002', 'OP-003']));
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const pendingRequests = requests.filter(r => r.status === 'pending').length;
  const bottlesOut = ledger.filter(e => e.status === 'out').length;
  const returnedToday = ledger.filter(e => e.status === 'returned' && e.checked_in_at?.startsWith('2026-02-15')).length;
  const emptyToday = ledger.filter(e => e.status === 'empty' && e.checked_in_at?.startsWith('2026-02-15')).length;
  const brokenTotal = ledger.filter(e => e.status === 'broken').length;

  // Group pending requests by operator
  const requestsByOperator = useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending');
    const groups = new Map<string, { name: string; id: string; requests: BottleRequest[] }>();
    for (const req of pending) {
      if (!groups.has(req.requested_by)) {
        groups.set(req.requested_by, { name: req.operator_name, id: req.requested_by, requests: [] });
      }
      groups.get(req.requested_by)!.requests.push(req);
    }
    return Array.from(groups.values());
  }, [requests]);

  // Filtered ledger
  const filteredLedger = useMemo(() => {
    let items = [...ledger];
    if (ledgerFilter !== 'all') {
      items = items.filter(e => e.status === ledgerFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(e =>
        e.bottle_name.toLowerCase().includes(q) ||
        e.bottle_barcode.toLowerCase().includes(q) ||
        e.operator_name.toLowerCase().includes(q) ||
        e.brand.toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => new Date(b.checked_out_at || '').getTime() - new Date(a.checked_out_at || '').getTime());
  }, [ledger, ledgerFilter, searchQuery]);

  // Fulfill a request (scan out)
  const fulfillRequest = (req: BottleRequest) => {
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'fulfilled' as const } : r));
    const newEntry: LedgerEntry = {
      id: `LED-${Date.now()}`,
      bottle_id: req.bottle_id,
      bottle_name: req.bottle_name,
      bottle_barcode: req.bottle_barcode,
      brand: req.brand,
      size_ml: req.size_ml,
      movement_type: 'checkout',
      status: 'out',
      checked_out_at: new Date().toISOString(),
      operator_id: req.requested_by,
      operator_name: req.operator_name,
      station: req.station,
      job_id: req.job_id,
      job_code: req.job_code,
      vault_location: 'Vault A · Shelf ' + Math.ceil(Math.random() * 5) + ' · Slot ' + Math.ceil(Math.random() * 20),
    };
    setLedger(prev => [newEntry, ...prev]);
    toast.success(`Checked out: ${req.bottle_name}`, { description: `Given to ${req.operator_name} for ${req.station}` });
  };

  // Fulfill all requests for an operator batch
  const fulfillOperatorBatch = (operatorId: string) => {
    const pending = requests.filter(r => r.requested_by === operatorId && r.status === 'pending');
    if (pending.length === 0) return;
    pending.forEach(req => fulfillRequest(req));
    toast.success(`Batch fulfilled: ${pending.length} bottles`, { description: `All bottles given to ${pending[0].operator_name}` });
  };

  // Return a bottle
  const handleReturn = () => {
    if (!returnEntry) return;
    setLedger(prev => prev.map(e =>
      e.id === returnEntry.id
        ? { ...e, status: returnStatus, movement_type: returnStatus === 'returned' ? 'checkin' : returnStatus as BottleMovementType, checked_in_at: new Date().toISOString(), notes: returnNotes || e.notes }
        : e
    ));
    const label = returnStatus === 'returned' ? 'Returned' : returnStatus === 'empty' ? 'Logged Empty' : 'Logged Broken';
    toast.success(`${label}: ${returnEntry.bottle_name}`);
    setShowReturnDialog(false);
    setReturnEntry(null);
    setReturnNotes('');
    setReturnStatus('returned');
  };

  // Handle barcode scan (from scanner, manual, or camera)
  const handleBarcodeScan = (barcode: string, source: 'scanner' | 'manual') => {
    setScanPulse(true);
    setTimeout(() => setScanPulse(false), 600);

    if (scanMode === 'checkout') {
      const req = requests.find(r => r.bottle_barcode === barcode && r.status === 'pending');
      if (req) {
        fulfillRequest(req);
        toast.success(`Scanned Out: ${req.bottle_name}`, {
          description: `${source === 'scanner' ? 'Scanner' : 'Manual'} · Given to ${req.operator_name}`,
          icon: <ScanBarcode className="w-4 h-4" />,
        });
      } else {
        toast.error('No pending request for this barcode', {
          description: `${barcode} — try switching to Check In mode`,
        });
      }
    } else {
      const entry = ledger.find(e => e.bottle_barcode === barcode && e.status === 'out');
      if (entry) {
        setReturnEntry(entry);
        setShowReturnDialog(true);
      } else {
        toast.error('No checked-out bottle with this barcode', {
          description: `${barcode} — try switching to Check Out mode`,
        });
      }
    }
    setManualInput('');
  };

  // Handle camera scan
  const handleCameraScan = (barcode: string) => {
    handleBarcodeScan(barcode, 'scanner');
    toast.info(`Camera scanned: ${barcode}`, { icon: <Camera className="w-4 h-4" /> });
  };

  // Barcode scanner hook (USB HID)
  const scanner = useBarcodeScanner({
    onScan: handleBarcodeScan,
    scanThreshold: 50,
    minLength: 3,
    enabled: true,
    audioFeedback: audioEnabled,
    maxHistory: 100,
  });

  // Camera scanner hook
  const cameraScanner = useCameraScanner({
    onScan: handleCameraScan,
    preferRearCamera: true,
  });

  // Auto-focus scan input on mount
  useEffect(() => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, []);

  // Manual submit handler
  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    scanner.submitManual(manualInput.trim());
    setManualInput('');
  };

  // Toggle operator expansion
  const toggleOperator = (id: string) => {
    setExpandedOperators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle camera scanner
  const toggleCamera = async () => {
    if (cameraScanner.isActive) {
      cameraScanner.stop();
      setShowCameraScanner(false);
    } else {
      setShowCameraScanner(true);
      await cameraScanner.start();
    }
  };

  // Scanner status display
  const scannerStatusConfig = {
    idle: { label: 'Scanner Idle', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: WifiOff, dot: 'bg-gray-400' },
    detecting: { label: 'Detecting...', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: Radio, dot: 'bg-amber-500 animate-pulse' },
    ready: { label: 'Scanner Ready', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Wifi, dot: 'bg-emerald-500' },
  };
  const scannerStatus = scannerStatusConfig[scanner.status];

  return (
    <div>
      <PageHeader
        title="Vault Guardian"
        subtitle="Bottle checkout/check-in · Barcode scanner · Movement ledger"
        breadcrumbs={[
          { label: 'Job Management' },
          { label: 'Vault Guardian' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <ArrowUpFromLine className="w-3 h-3" /> {bottlesOut} out
            </Badge>
            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <Clock className="w-3 h-3" /> {pendingRequests} pending
            </Badge>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Scanner Control Panel */}
        <SectionCard
          title="Scan Station"
          subtitle="USB HID scanner or camera-based barcode reading"
          headerActions={
            <div className="flex items-center gap-1">
              <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium', scannerStatus.bg, scannerStatus.color)}>
                <span className={cn('w-2 h-2 rounded-full', scannerStatus.dot)} />
                <scannerStatus.icon className="w-3.5 h-3.5" />
                {scannerStatus.label}
              </div>
              {scanner.totalScans > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  {scanner.totalScans} scan{scanner.totalScans !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-3">
            {/* Scan Input Row */}
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg transition-all',
                scanPulse ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-indigo-100 dark:bg-indigo-900/50'
              )}>
                <ScanBarcode className={cn(
                  'w-5 h-5 transition-colors',
                  scanPulse ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-600 dark:text-indigo-400'
                )} />
              </div>
              <Select value={scanMode} onValueChange={(v: 'checkout' | 'checkin') => setScanMode(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkout">
                    <span className="flex items-center gap-1.5"><ArrowUpFromLine className="w-3.5 h-3.5" /> Check Out</span>
                  </SelectItem>
                  <SelectItem value="checkin">
                    <span className="flex items-center gap-1.5"><ArrowDownToLine className="w-3.5 h-3.5" /> Check In</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Input
                  ref={scanInputRef}
                  data-scanner-input="true"
                  placeholder={scanner.isDetecting ? 'Receiving scan...' : 'Scan barcode or type manually...'}
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                  className={cn(
                    'font-mono text-sm transition-all',
                    scanner.isDetecting && 'ring-2 ring-amber-400 border-amber-400',
                    scanPulse && 'ring-2 ring-emerald-400 border-emerald-400'
                  )}
                />
                {scanner.isDetecting && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={handleManualSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                {scanMode === 'checkout' ? 'Scan Out' : 'Scan In'}
              </Button>
              <Button
                variant={cameraScanner.isActive ? 'default' : 'outline'}
                onClick={toggleCamera}
                className={cn('gap-1.5', cameraScanner.isActive && 'bg-purple-600 hover:bg-purple-700 text-white')}
                title="Camera barcode scanner (for mobile/tablet)"
              >
                {cameraScanner.isActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{cameraScanner.isActive ? 'Stop Camera' : 'Camera'}</span>
              </Button>
            </div>

            {/* Camera Scanner View */}
            {showCameraScanner && (
              <div className="rounded-lg border-2 border-purple-200 dark:border-purple-800 overflow-hidden bg-black relative">
                <video
                  ref={cameraScanner.videoRef}
                  className="w-full max-h-64 object-cover"
                  playsInline
                  muted
                />
                {cameraScanner.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-white text-sm flex items-center gap-2">
                      <Smartphone className="w-4 h-4 animate-pulse" /> Initializing camera...
                    </div>
                  </div>
                )}
                {cameraScanner.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center p-4">
                      <CameraOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-red-400 text-sm">{cameraScanner.error}</p>
                      <Button size="sm" variant="outline" onClick={() => cameraScanner.start()} className="mt-2 text-white border-white/30">
                        Retry
                      </Button>
                    </div>
                  </div>
                )}
                {cameraScanner.isActive && !cameraScanner.isLoading && (
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                    <Badge className="bg-purple-600 text-white text-xs gap-1">
                      <Camera className="w-3 h-3" /> Camera Active
                    </Badge>
                    <span className="text-xs text-white/70 bg-black/50 px-2 py-0.5 rounded">Point at barcode to scan</span>
                  </div>
                )}
                {/* Scan target overlay */}
                {cameraScanner.isActive && !cameraScanner.isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-24 border-2 border-white/50 rounded-lg" />
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScanHistory(!showScanHistory)}
                  className="gap-1 text-xs h-7"
                >
                  <History className="w-3.5 h-3.5" />
                  History ({scanner.scanHistory.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className="h-7 w-7 p-0"
                  title={audioEnabled ? 'Mute scan sounds' : 'Enable scan sounds'}
                >
                  {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
                </Button>
              </div>
              {/* Last Scan Result */}
              {scanner.lastScan && (
                <div className={cn(
                  'flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all',
                  scanPulse ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted/50'
                )}>
                  <CheckCircle2 className={cn('w-3.5 h-3.5 flex-shrink-0', scanPulse ? 'text-emerald-600' : 'text-muted-foreground')} />
                  <span className="font-mono text-xs">{scanner.lastScan}</span>
                  <Badge variant="outline" className="text-xs">
                    {scanner.scanHistory[0]?.source === 'scanner' ? 'HID' : 'Manual'}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Scan History Drawer */}
        {showScanHistory && (
          <SectionCard
            title="Scan History"
            subtitle={`${scanner.scanHistory.length} entries this session`}
            headerActions={
              <Button variant="ghost" size="sm" onClick={scanner.clearHistory} className="h-6 text-xs gap-1">
                <Trash2 className="w-3 h-3" /> Clear
              </Button>
            }
          >
            {scanner.scanHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No scans yet. Scan a barcode to see history.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {scanner.scanHistory.map((entry, i) => (
                  <div key={`${entry.barcode}-${entry.timestamp.getTime()}`} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-muted/50 text-sm">
                    <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                    <span className="font-mono text-xs flex-1">{entry.barcode}</span>
                    <Badge variant="outline" className={cn('text-xs', entry.source === 'scanner' ? 'text-indigo-600 border-indigo-200' : 'text-gray-600 border-gray-200')}>
                      {entry.source === 'scanner' ? 'Scanner' : 'Manual'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Pending Requests', value: pendingRequests, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
            { label: 'Bottles Out', value: bottlesOut, icon: ArrowUpFromLine, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Returned Today', value: returnedToday, icon: ArrowDownToLine, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Empty Today', value: emptyToday, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Broken (Total)', value: brokenTotal, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          ].map(kpi => (
            <Card key={kpi.label} className={cn('border-0 shadow-sm', kpi.bg)}>
              <CardContent className="p-3 flex items-center gap-3">
                <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                <div>
                  <div className="text-xl font-bold text-foreground">{kpi.value}</div>
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="requests" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Requests ({pendingRequests})
            </TabsTrigger>
            <TabsTrigger value="out" className="gap-1.5">
              <ArrowUpFromLine className="w-3.5 h-3.5" /> Currently Out ({bottlesOut})
            </TabsTrigger>
            <TabsTrigger value="ledger" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Full Ledger
            </TabsTrigger>
          </TabsList>

          {/* Pending Requests Tab — Grouped by Operator */}
          <TabsContent value="requests" className="mt-4 space-y-4">
            {requestsByOperator.length === 0 ? (
              <SectionCard title="All Clear">
                <EmptyState
                  icon={CheckCircle2}
                  title="All requests fulfilled"
                  description="No pending bottle requests. Operators will request bottles when they need them."
                />
              </SectionCard>
            ) : (
              requestsByOperator.map(group => {
                const isExpanded = expandedOperators.has(group.id);
                return (
                  <SectionCard
                    key={group.id}
                    title={
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          {group.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span>{group.name}</span>
                        <Badge variant="outline" className="text-xs">{group.requests.length} bottle{group.requests.length !== 1 ? 's' : ''}</Badge>
                      </div>
                    }
                    headerActions={
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => fulfillOperatorBatch(group.id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs h-7"
                        >
                          <ScanBarcode className="w-3 h-3" /> Give All ({group.requests.length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleOperator(group.id)}
                          className="h-7 w-7 p-0"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    }
                  >
                    {isExpanded && (
                      <div className="space-y-2">
                        {group.requests.map(req => (
                          <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 flex items-center justify-center">
                                <Package className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{req.bottle_name}</span>
                                  <Badge variant="outline" className="text-xs">{req.brand}</Badge>
                                  <Badge variant="outline" className="text-xs font-mono">{req.size_ml}ml</Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span className="font-mono">{req.bottle_barcode}</span>
                                  <span>·</span>
                                  <span>{req.station}</span>
                                  {req.job_code && <><span>·</span><span className="font-mono text-indigo-600">{req.job_code}</span></>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={cn('text-xs', req.source === 'auto_picking' ? 'bg-blue-100 text-blue-700' : req.source === 'manual_decant' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700')}>
                                {req.source === 'auto_picking' ? 'Auto · S2' : req.source === 'manual_decant' ? 'Manual Decant' : 'Manual'}
                              </Badge>
                              <Button size="sm" onClick={() => fulfillRequest(req)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 h-7 text-xs">
                                <ScanBarcode className="w-3 h-3" /> Give
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                );
              })
            )}
          </TabsContent>

          {/* Currently Out Tab */}
          <TabsContent value="out" className="mt-4 space-y-3">
            {ledger.filter(e => e.status === 'out').length === 0 ? (
              <SectionCard title="All Returned">
                <EmptyState
                  icon={CheckCircle2}
                  title="All bottles returned to vault"
                  description="No bottles are currently checked out."
                />
              </SectionCard>
            ) : (
              ledger.filter(e => e.status === 'out').map(entry => {
                const outTime = entry.checked_out_at ? new Date(entry.checked_out_at) : new Date();
                const hoursOut = Math.round((Date.now() - outTime.getTime()) / 3600000 * 10) / 10;
                const isLong = hoursOut > 4;
                return (
                  <Card key={entry.id} className={cn('hover:shadow-md transition-shadow', isLong && 'border-amber-300 dark:border-amber-700')}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isLong ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30')}>
                            <ArrowUpFromLine className={cn('w-5 h-5', isLong ? 'text-amber-600' : 'text-blue-600')} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{entry.bottle_name}</span>
                              <Badge variant="outline" className="text-xs">{entry.brand}</Badge>
                              <Badge variant="outline" className="text-xs font-mono">{entry.size_ml}ml</Badge>
                              {isLong && <Badge className="bg-amber-100 text-amber-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" /> Long checkout</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="font-mono">{entry.bottle_barcode}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {entry.operator_name}</span>
                              <span>·</span>
                              <span>{entry.station}</span>
                              <span>·</span>
                              <span>Out since {fmt(entry.checked_out_at!)}</span>
                              {entry.vault_location && <><span>·</span><span className="text-indigo-600">{entry.vault_location}</span></>}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setReturnEntry(entry); setShowReturnDialog(true); }}
                          className="gap-1"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" /> Return
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Full Ledger Tab */}
          <TabsContent value="ledger" className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search bottles, barcodes, operators..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={ledgerFilter} onValueChange={setLedgerFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Movements</SelectItem>
                  <SelectItem value="out">Currently Out</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="empty">Empty</SelectItem>
                  <SelectItem value="broken">Broken</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredLedger.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No ledger entries"
                description="Movement history will appear here as bottles are checked out and returned."
              />
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Bottle</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Barcode</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Operator</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Station</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Out</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">In</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Notes</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map(entry => {
                      const StatusIcon = STATUS_ICONS[entry.status];
                      return (
                        <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{entry.bottle_name}</div>
                            <div className="text-xs text-muted-foreground">{entry.brand} · {entry.size_ml}ml</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{entry.bottle_barcode}</td>
                          <td className="px-4 py-3">
                            <Badge className={cn('text-xs gap-1', STATUS_COLORS[entry.status])}>
                              <StatusIcon className="w-3 h-3" /> {entry.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">{entry.operator_name}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{entry.station}</td>
                          <td className="px-4 py-3 text-xs">{entry.checked_out_at ? fmt(entry.checked_out_at) : '—'}</td>
                          <td className="px-4 py-3 text-xs">{entry.checked_in_at ? fmt(entry.checked_in_at) : '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{entry.notes || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {entry.status === 'out' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setReturnEntry(entry); setShowReturnDialog(true); }}
                                className="gap-1 h-7 text-xs"
                              >
                                <ArrowDownToLine className="w-3 h-3" /> Return
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Return Dialog — Enhanced with bottle details popup and notes */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-indigo-600" />
              Return Bottle to Vault
            </DialogTitle>
          </DialogHeader>
          {returnEntry && (
            <div className="space-y-4">
              {/* Bottle Details Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
                    <Package className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{returnEntry.bottle_name}</div>
                    <div className="text-sm text-muted-foreground">{returnEntry.brand} · {returnEntry.size_ml}ml</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ScanBarcode className="w-3.5 h-3.5" />
                    <span className="font-mono text-xs">{returnEntry.bottle_barcode}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span>{returnEntry.operator_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{returnEntry.checked_out_at ? fmt(returnEntry.checked_out_at) : '—'}</span>
                  </div>
                  {returnEntry.vault_location && (
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-xs">{returnEntry.vault_location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Return Status Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Return Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'returned', label: 'Returned', icon: ArrowDownToLine, color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
                    { value: 'empty', label: 'Empty', icon: Package, color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
                    { value: 'broken', label: 'Broken', icon: XCircle, color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setReturnStatus(opt.value)}
                      className={cn(
                        'p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all',
                        returnStatus === opt.value ? opt.color : 'border-muted bg-background text-muted-foreground hover:border-muted-foreground/30'
                      )}
                    >
                      <opt.icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes Field — Always visible */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Notes {(returnStatus === 'empty' || returnStatus === 'broken') && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  placeholder={
                    returnStatus === 'returned' ? 'Optional: condition notes, remaining ml estimate...'
                    : returnStatus === 'empty' ? 'Required: e.g., Fully decanted — 0ml remaining'
                    : 'Required: e.g., Dropped, cap cracked, leaking'
                  }
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>Cancel</Button>
            <Button
              onClick={handleReturn}
              disabled={(returnStatus === 'empty' || returnStatus === 'broken') && !returnNotes.trim()}
              className={cn(
                returnStatus === 'returned' ? 'bg-emerald-600 hover:bg-emerald-700' :
                returnStatus === 'empty' ? 'bg-amber-600 hover:bg-amber-700' :
                'bg-red-600 hover:bg-red-700',
                'text-white'
              )}
            >
              {returnStatus === 'returned' ? 'Return to Vault' : returnStatus === 'empty' ? 'Log as Empty' : 'Log as Broken'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
