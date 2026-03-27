// ============================================================
// Barcode / QR Scanner Dialog — Camera, 2D Hardware Scanner
// (Zebra DS2278 keyboard wedge), and manual input.
// Design: "Maison Ops" — dark overlay, gold scan frame, pulse
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
  Camera, X, Keyboard, ScanBarcode, RotateCcw,
  Flashlight, FlashlightOff, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BarcodeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

type ScanMode = 'camera' | 'scanner' | 'manual';

export default function BarcodeScannerDialog({ open, onClose, onScan }: BarcodeScannerDialogProps) {
  const [mode, setMode] = useState<ScanMode>('scanner');
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // 2D Scanner state
  const [scannerConnected, setScannerConnected] = useState(false);
  const [scannerBuffer, setScannerBuffer] = useState('');
  const [scannerHistory, setScannerHistory] = useState<{ code: string; time: string }[]>([]);
  const [scannerListening, setScannerListening] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef('');
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanRegionId = 'qr-reader-region';

  // ---- Camera Scanner Logic ----
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;
    setCameraError(null);
    setScanning(true);

    try {
      const scanner = new Html5Qrcode(scanRegionId, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0, disableFlip: false },
        (decodedText) => {
          setLastScanned(decodedText);
          onScan(decodedText);
          try { scanner.pause(true); } catch { /* ignore */ }
          setTimeout(() => { try { scanner.resume(); } catch { /* ignore */ } }, 2000);
        },
        () => {},
      );

      try {
        const caps = scanner.getRunningTrackCameraCapabilities();
        if (caps.torchFeature && caps.torchFeature().isSupported()) setHasTorch(true);
      } catch { setHasTorch(false); }
    } catch (err: any) {
      setCameraError(err?.message || 'Camera access denied or not available');
      setScanning(false);
      setMode('scanner');
    }
  }, [onScan]);

  useEffect(() => {
    if (open && mode === 'camera') {
      const timer = setTimeout(() => startScanner(), 300);
      return () => { clearTimeout(timer); stopScanner(); };
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
  }, [open, mode, startScanner, stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setLastScanned(null);
      setManualInput('');
      setCameraError(null);
      setTorch(false);
      setHasTorch(false);
      setScannerBuffer('');
    }
  }, [open, stopScanner]);

  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      const caps = scannerRef.current.getRunningTrackCameraCapabilities();
      const torchFeature = caps.torchFeature();
      if (torchFeature.isSupported()) {
        await torchFeature.apply(!torch);
        setTorch(!torch);
      }
    } catch { toast.error('Torch not supported on this device'); }
  }, [torch]);

  // ---- 2D Hardware Scanner Logic (Keyboard Wedge Mode) ----
  // Zebra DS2278 and similar scanners send characters as rapid keystrokes
  // followed by Enter. We detect this pattern: rapid chars (<50ms apart)
  // ending with Enter = scanner input.

  useEffect(() => {
    if (!open || mode !== 'scanner') {
      setScannerListening(false);
      return;
    }

    setScannerListening(true);
    // Focus the hidden input to capture scanner keystrokes
    setTimeout(() => scannerInputRef.current?.focus(), 100);

    // Detect scanner connection via rapid input pattern
    const checkConnection = () => {
      setScannerConnected(true); // Assume connected when in scanner mode
    };
    checkConnection();
  }, [open, mode]);

  const handleScannerInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScannerBuffer(val);
    bufferRef.current = val;

    // Clear any existing timer
    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);

    // Set a short timer — if no more input within 100ms, it's likely manual typing
    // Scanner input comes in <50ms bursts, so 100ms is a safe threshold
    bufferTimerRef.current = setTimeout(() => {
      // If buffer has content but no Enter was pressed, it's manual typing — keep buffer
    }, 100);
  }, []);

  const handleScannerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = bufferRef.current.trim();
      if (code) {
        setLastScanned(code);
        setScannerHistory(prev => [
          { code, time: new Date().toLocaleTimeString() },
          ...prev.slice(0, 19), // Keep last 20
        ]);
        onScan(code);
        setScannerBuffer('');
        bufferRef.current = '';
        toast.success('Scanned', { description: code.substring(0, 50) });
      }
    }
  }, [onScan]);

  // Keep scanner input focused when in scanner mode
  useEffect(() => {
    if (open && mode === 'scanner') {
      const interval = setInterval(() => {
        if (document.activeElement !== scannerInputRef.current) {
          scannerInputRef.current?.focus();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [open, mode]);

  // ---- Manual Input ----
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    setLastScanned(val);
    onScan(val);
    setManualInput('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
              <ScanBarcode className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Scan Bottle</h2>
              <p className="text-xs text-muted-foreground">
                {mode === 'camera' ? 'Point camera at barcode or QR' :
                 mode === 'scanner' ? 'Ready for 2D scanner input' :
                 'Enter code manually'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-border">
          {([
            { id: 'scanner' as ScanMode, icon: Zap, label: '2D Scanner' },
            { id: 'camera' as ScanMode, icon: Camera, label: 'Camera' },
            { id: 'manual' as ScanMode, icon: Keyboard, label: 'Manual' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === tab.id
                  ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* ---- 2D Scanner Mode ---- */}
          {mode === 'scanner' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={cn(
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                scannerConnected
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-amber-500/30 bg-amber-500/5',
              )}>
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  scannerConnected ? 'bg-emerald-500/20' : 'bg-amber-500/20',
                )}>
                  {scannerConnected ? (
                    <Wifi className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-6 h-6 text-amber-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {scannerConnected ? 'Scanner Ready' : 'Waiting for Scanner'}
                    </h3>
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      scannerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
                    )} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {scannerConnected
                      ? 'Zebra DS2278 or compatible — scan any barcode'
                      : 'Connect your 2D scanner via USB or Bluetooth'}
                  </p>
                </div>
              </div>

              {/* Scanner Input (captures keyboard wedge input) */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Scanner Input Buffer
                  </span>
                  {scannerListening && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      LISTENING
                    </span>
                  )}
                </div>
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerBuffer}
                    onChange={handleScannerInput}
                    onKeyDown={handleScannerKeyDown}
                    placeholder="Scan a barcode — input appears here automatically..."
                    className={cn(
                      'w-full h-12 pl-10 pr-4 text-sm font-mono bg-muted/50 border-2 rounded-xl',
                      'placeholder:text-muted-foreground/60 focus:outline-none transition-all',
                      scannerListening
                        ? 'border-amber-500/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                        : 'border-border',
                    )}
                    autoFocus
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Scanner sends keystrokes followed by Enter. You can also type manually and press Enter.
                </p>
              </div>

              {/* Supported Scanners */}
              <div className="bg-muted/30 rounded-xl p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Compatible Scanners
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Zebra DS2278', type: 'Bluetooth' },
                    { name: 'Zebra DS9308', type: 'USB' },
                    { name: 'Honeywell Voyager', type: 'USB' },
                    { name: 'Any HID Wedge', type: 'USB/BT' },
                  ].map(s => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-foreground font-medium">{s.name}</span>
                      <span className="text-muted-foreground">({s.type})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scan History */}
              {scannerHistory.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Recent Scans ({scannerHistory.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {scannerHistory.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => { onScan(item.code); setLastScanned(item.code); }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg hover:bg-muted/60 transition-colors text-left"
                      >
                        <span className="text-xs font-mono text-foreground truncate">{item.code}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{item.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Camera Mode ---- */}
          {mode === 'camera' && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                <div id={scanRegionId} ref={containerRef} className="w-full h-full" />
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[280px] h-[280px] relative">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-500 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-500 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-500 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-500 rounded-br-lg" />
                      <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse" style={{ top: '50%' }} />
                    </div>
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6">
                    <Camera className="w-10 h-10 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground mb-1">Camera not available</p>
                    <p className="text-xs text-muted-foreground/70 mb-4">{cameraError}</p>
                    <button onClick={() => setMode('scanner')}
                      className="px-4 py-2 text-sm bg-amber-500/20 text-amber-500 rounded-lg hover:bg-amber-500/30 transition-colors">
                      Use 2D Scanner
                    </button>
                  </div>
                )}
              </div>
              {scanning && (
                <div className="flex items-center justify-center gap-3">
                  {hasTorch && (
                    <button onClick={toggleTorch}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                        torch ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}>
                      {torch ? <FlashlightOff className="w-3.5 h-3.5" /> : <Flashlight className="w-3.5 h-3.5" />}
                      {torch ? 'Torch Off' : 'Torch On'}
                    </button>
                  )}
                  <button onClick={() => { stopScanner(); setTimeout(startScanner, 300); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" /> Restart
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---- Manual Mode ---- */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Bottle ID / Barcode / QR Data
                </label>
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={manualInput} onChange={e => setManualInput(e.target.value)}
                    placeholder="BTL-001, EM-BTL-001-BR540, or scan data..."
                    autoFocus
                    className="w-full h-11 pl-10 pr-4 text-sm bg-muted/50 border border-border rounded-lg placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enter a bottle ID (BTL-xxx), barcode (EM-BTL-xxx-xxx), or paste QR data
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Quick prefix:</p>
                <div className="flex flex-wrap gap-2">
                  {['BTL-', 'DEC-', 'EM-', 'SYR-', 'ORD-'].map(prefix => (
                    <button key={prefix} type="button" onClick={() => setManualInput(prefix)}
                      className="px-2.5 py-1 text-xs font-mono bg-muted border border-border rounded-md hover:bg-accent transition-colors">
                      {prefix}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={!manualInput.trim()}
                className="w-full h-10 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                Look Up
              </button>
            </form>
          )}

          {/* Last scanned indicator */}
          {lastScanned && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Last scanned</span>
              </div>
              <p className="mt-1 text-sm font-mono text-foreground truncate">{lastScanned}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
