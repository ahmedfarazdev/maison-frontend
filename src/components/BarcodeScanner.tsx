// ============================================================
// BarcodeScanner — Reusable camera-based barcode/QR scanner
// Uses html5-qrcode with manual text input fallback
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, ScanBarcode, X, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  /** Called when a barcode is successfully scanned or manually entered */
  onScan: (code: string) => void;
  /** Placeholder text for the manual input */
  placeholder?: string;
  /** Whether to auto-start the camera on mount */
  autoStart?: boolean;
  /** Additional class names */
  className?: string;
  /** Label shown above the scanner */
  label?: string;
  /** Whether the scanner is disabled */
  disabled?: boolean;
}

export function BarcodeScanner({
  onScan,
  placeholder = 'Scan barcode or type ID...',
  autoStart = false,
  className,
  label,
  disabled = false,
}: BarcodeScannerProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const scannerIdRef = useRef(`scanner-${Math.random().toString(36).slice(2, 8)}`);

  const stopCamera = useCallback(async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (disabled) return;
    setError(null);

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');

      // Stop any existing scanner first
      if (html5QrCodeRef.current) {
        await stopCamera();
      }

      const scannerId = scannerIdRef.current;
      const scannerEl = document.getElementById(scannerId);
      if (!scannerEl) return;

      const scanner = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 2.0,
        },
        (decodedText: string) => {
          onScan(decodedText);
          // Brief vibration feedback if available
          if (navigator.vibrate) navigator.vibrate(100);
        },
        () => {
          // Ignore scan failures (normal when no barcode in view)
        }
      );

      setCameraActive(true);
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError') || msg.includes('no camera')) {
        setError('No camera found on this device.');
        setCameraAvailable(false);
      } else {
        setError('Could not start camera. Use manual input instead.');
      }
      setCameraActive(false);
    }
  }, [disabled, onScan, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !disabled) {
      startCamera();
    }
  }, [autoStart, disabled, startCamera]);

  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();
    if (trimmed) {
      onScan(trimmed);
      setManualInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSubmit();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}

      {/* Camera viewport */}
      {cameraActive && (
        <div className="relative rounded-lg overflow-hidden border border-gold/30 bg-black">
          <div id={scannerIdRef.current} ref={scannerRef} className="w-full" />
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 h-7 w-7 p-0 bg-black/50 hover:bg-black/70 text-white z-10"
            onClick={stopCamera}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-[10px] text-white/80 text-center">Point camera at barcode</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input row: manual input + camera toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:opacity-50"
          />
        </div>
        {manualInput.trim() && (
          <Button
            size="sm"
            variant="outline"
            className="h-10 gap-1 text-xs"
            onClick={handleManualSubmit}
            disabled={disabled}
          >
            <Keyboard className="w-3.5 h-3.5" /> Enter
          </Button>
        )}
        {cameraAvailable && (
          <Button
            size="sm"
            variant={cameraActive ? 'default' : 'outline'}
            className={cn(
              'h-10 gap-1 text-xs',
              cameraActive && 'bg-gold hover:bg-gold/90 text-gold-foreground'
            )}
            onClick={cameraActive ? stopCamera : startCamera}
            disabled={disabled}
          >
            {cameraActive ? (
              <><CameraOff className="w-3.5 h-3.5" /> Stop</>
            ) : (
              <><Camera className="w-3.5 h-3.5" /> Scan</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline scanner for use within tables or tight spaces.
 * Shows just the input + camera button on a single line.
 */
export function InlineBarcodeScanner({
  onScan,
  placeholder = 'Scan...',
  disabled = false,
  className,
}: Omit<BarcodeScannerProps, 'label' | 'autoStart'>) {
  const [manualInput, setManualInput] = useState('');

  const handleSubmit = () => {
    const trimmed = manualInput.trim();
    if (trimmed) {
      onScan(trimmed);
      setManualInput('');
    }
  };

  return (
    <div className={cn('flex gap-1.5', className)}>
      <div className="relative flex-1">
        <ScanBarcode className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-8 pl-7 pr-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-gold/30 disabled:opacity-50"
        />
      </div>
      {manualInput.trim() && (
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={handleSubmit} disabled={disabled}>
          OK
        </Button>
      )}
    </div>
  );
}
