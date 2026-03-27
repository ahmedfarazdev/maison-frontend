// ============================================================
// useBarcodeScanner — USB HID Barcode Reader Integration
// Detects rapid keystroke sequences from USB barcode scanners
// operating in HID (keyboard emulation) mode.
//
// How it works:
// 1. USB barcode scanners type characters very fast (< 50ms between keys)
// 2. They terminate with Enter key
// 3. We detect this pattern vs normal human typing (> 100ms between keys)
// 4. When a scan is detected, the onScan callback fires with the barcode
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export interface ScanEntry {
  barcode: string;
  timestamp: Date;
  source: 'scanner' | 'manual';
}

export interface BarcodeScannerOptions {
  /** Callback when a barcode is scanned */
  onScan: (barcode: string, source: 'scanner' | 'manual') => void;
  /** Max time between keystrokes to be considered scanner input (ms). Default: 50 */
  scanThreshold?: number;
  /** Min barcode length to be considered valid. Default: 3 */
  minLength?: number;
  /** Max barcode length. Default: 100 */
  maxLength?: number;
  /** Whether the scanner hook is active. Default: true */
  enabled?: boolean;
  /** Play audio feedback on scan. Default: true */
  audioFeedback?: boolean;
  /** Max scan history entries to keep. Default: 50 */
  maxHistory?: number;
}

export interface BarcodeScannerState {
  /** Whether the scanner is currently detecting input */
  isDetecting: boolean;
  /** Connection status indicator */
  status: 'idle' | 'detecting' | 'ready';
  /** Last scanned barcode */
  lastScan: string | null;
  /** Last scan timestamp */
  lastScanTime: Date | null;
  /** Scan history (most recent first) */
  scanHistory: ScanEntry[];
  /** Total scans in this session */
  totalScans: number;
  /** Time since last scan in seconds (null if no scans yet) */
  timeSinceLastScan: number | null;
  /** Manually submit a barcode (for manual entry fallback) */
  submitManual: (barcode: string) => void;
  /** Clear scan history */
  clearHistory: () => void;
}

// Audio feedback using Web Audio API
const playBeep = (success: boolean) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (success) {
      // Success: short high beep
      oscillator.frequency.value = 1200;
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    } else {
      // Error: two low beeps
      oscillator.frequency.value = 400;
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    }

    // Cleanup
    oscillator.onended = () => {
      gainNode.disconnect();
      ctx.close();
    };
  } catch {
    // Audio not available — silently ignore
  }
};

export function useBarcodeScanner(options: BarcodeScannerOptions): BarcodeScannerState {
  const {
    onScan,
    scanThreshold = 50,
    minLength = 3,
    maxLength = 100,
    enabled = true,
    audioFeedback = true,
    maxHistory = 50,
  } = options;

  const [isDetecting, setIsDetecting] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanEntry[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [timeSinceLastScan, setTimeSinceLastScan] = useState<number | null>(null);

  // Refs for keystroke tracking
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // Process a completed scan
  const processScan = useCallback((barcode: string, source: 'scanner' | 'manual') => {
    const trimmed = barcode.trim();
    if (trimmed.length < minLength || trimmed.length > maxLength) return;

    const now = new Date();
    setLastScan(trimmed);
    setLastScanTime(now);
    setTotalScans(prev => prev + 1);
    setTimeSinceLastScan(0);

    const entry: ScanEntry = { barcode: trimmed, timestamp: now, source };
    setScanHistory(prev => [entry, ...prev].slice(0, maxHistory));

    if (audioFeedback) playBeep(true);
    onScanRef.current(trimmed, source);
  }, [minLength, maxLength, maxHistory, audioFeedback]);

  // Manual submit fallback
  const submitManual = useCallback((barcode: string) => {
    processScan(barcode, 'manual');
  }, [processScan]);

  // Clear history
  const clearHistory = useCallback(() => {
    setScanHistory([]);
    setTotalScans(0);
  }, []);

  // Update time since last scan every second
  useEffect(() => {
    if (!lastScanTime) return;
    const interval = setInterval(() => {
      setTimeSinceLastScan(Math.floor((Date.now() - lastScanTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastScanTime]);

  // Global keydown listener for scanner detection
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in a textarea or contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // If the target is an input, only intercept if it has our scanner data attribute
      // This allows the scanner to work even when an input is focused
      const isInputField = target.tagName === 'INPUT';
      const isScannerInput = target.getAttribute('data-scanner-input') === 'true';

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      if (e.key === 'Enter') {
        // Enter terminates the scan
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();

          // Determine if this was scanner or manual based on average speed
          const isScanner = timeDiff < scanThreshold * 3; // Allow some slack for Enter key
          processScan(bufferRef.current, isScanner ? 'scanner' : 'manual');
        }
        bufferRef.current = '';
        setIsDetecting(false);
        lastKeyTimeRef.current = 0;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Only capture printable characters
      if (e.key.length !== 1) return;

      // If typing in a non-scanner input field, don't intercept
      if (isInputField && !isScannerInput) {
        // Still track for scanner detection — scanners type fast even into inputs
        if (timeDiff < scanThreshold && bufferRef.current.length > 0) {
          // This looks like scanner input — capture it
          bufferRef.current += e.key;
          setIsDetecting(true);
        } else if (timeDiff < scanThreshold * 2 && bufferRef.current.length === 0) {
          // First character — start tracking
          bufferRef.current = e.key;
          lastKeyTimeRef.current = now;
        } else {
          // Too slow — reset
          bufferRef.current = '';
          setIsDetecting(false);
        }
        lastKeyTimeRef.current = now;
        return;
      }

      // For non-input targets or scanner inputs, capture everything
      if (timeDiff < scanThreshold || bufferRef.current.length === 0) {
        bufferRef.current += e.key;
        setIsDetecting(bufferRef.current.length > 1);

        // Prevent the character from being typed into other fields
        if (bufferRef.current.length > 2 && timeDiff < scanThreshold) {
          e.preventDefault();
        }
      } else {
        // Gap too long — reset buffer
        bufferRef.current = e.key;
        setIsDetecting(false);
      }

      lastKeyTimeRef.current = now;

      // Auto-reset buffer if no input for a while
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = '';
        setIsDetecting(false);
      }, 500);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, scanThreshold, minLength, processScan]);

  // Derive status
  const status = isDetecting ? 'detecting' : lastScan ? 'ready' : 'idle';

  return {
    isDetecting,
    status,
    lastScan,
    lastScanTime,
    scanHistory,
    totalScans,
    timeSinceLastScan,
    submitManual,
    clearHistory,
  };
}
