// ============================================================
// useCameraScanner — Camera-based barcode scanning
// Uses @zxing/browser to scan barcodes via device camera
// (getUserMedia API). Designed for mobile/tablet when no
// USB HID reader is available.
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export interface CameraScannerOptions {
  /** Callback when a barcode is decoded from camera */
  onScan: (barcode: string) => void;
  /** Whether to prefer rear camera. Default: true */
  preferRearCamera?: boolean;
  /** Scan interval in ms. Default: 250 */
  scanInterval?: number;
}

export interface CameraScannerState {
  /** Whether the camera is currently active */
  isActive: boolean;
  /** Whether the camera is initializing */
  isLoading: boolean;
  /** Error message if camera fails */
  error: string | null;
  /** Available video devices */
  devices: MediaDeviceInfo[];
  /** Currently selected device ID */
  selectedDeviceId: string | null;
  /** Start camera scanning */
  start: () => Promise<void>;
  /** Stop camera scanning */
  stop: () => void;
  /** Switch to a different camera device */
  switchDevice: (deviceId: string) => void;
  /** Ref to attach to the video element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useCameraScanner(options: CameraScannerOptions): CameraScannerState {
  const { onScan, preferRearCamera = true } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const lastBarcodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Initialize reader
  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();
    return () => {
      readerRef.current = null;
    };
  }, []);

  // List available video devices
  const listDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);

      if (videoDevices.length > 0 && !selectedDeviceId) {
        // Prefer rear camera
        const rear = preferRearCamera
          ? videoDevices.find(d =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
            )
          : null;
        setSelectedDeviceId(rear?.deviceId || videoDevices[0].deviceId);
      }
      return videoDevices;
    } catch {
      setError('Cannot access camera devices');
      return [];
    }
  }, [preferRearCamera, selectedDeviceId]);

  // Continuous decode loop
  const startDecodeLoop = useCallback(() => {
    if (!readerRef.current || !videoRef.current) return;

    const reader = readerRef.current;
    const video = videoRef.current;

    const decode = () => {
      if (!scanningRef.current || !video.videoWidth) {
        animFrameRef.current = requestAnimationFrame(decode);
        return;
      }

      try {
        // Create a canvas to capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Use the reader to decode from image data
          try {
            const luminanceSource = new (reader as any).constructor();
            // Fallback: decode directly from video element
          } catch {
            // Silent fail, will retry next frame
          }
        }
      } catch {
        // Silent fail, will retry next frame
      }

      if (scanningRef.current) {
        animFrameRef.current = requestAnimationFrame(decode);
      }
    };

    animFrameRef.current = requestAnimationFrame(decode);
  }, []);

  // Start camera
  const start = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const videoDevices = await listDevices();
      if (videoDevices.length === 0) {
        setError('No camera found on this device');
        setIsLoading(false);
        return;
      }

      const deviceId = selectedDeviceId || videoDevices[0]?.deviceId;
      if (!deviceId) {
        setError('No camera device available');
        setIsLoading(false);
        return;
      }

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: preferRearCamera ? 'environment' : 'user',
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      scanningRef.current = true;
      setIsActive(true);
      setIsLoading(false);

      // Use BrowserMultiFormatReader's continuous decode
      if (readerRef.current && videoRef.current) {
        const reader = readerRef.current;
        const video = videoRef.current;

        // Use decodeFromVideoElement for continuous scanning
        const scanLoop = async () => {
          while (scanningRef.current) {
            try {
              const result = await (reader as any).decodeOnce(video);
              if (result) {
                const barcode = result.getText();
                const now = Date.now();
                // Debounce: don't fire same barcode within 2s
                if (barcode !== lastBarcodeRef.current || now - lastScanTimeRef.current > 2000) {
                  lastBarcodeRef.current = barcode;
                  lastScanTimeRef.current = now;
                  onScan(barcode);
                }
              }
            } catch {
              // No barcode found in this frame, continue
            }
            // Wait before next scan attempt
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        };

        scanLoop();
      }
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access.'
        : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err?.message || 'Unknown error'}`;
      setError(msg);
      setIsLoading(false);
    }
  }, [listDevices, selectedDeviceId, preferRearCamera, onScan]);

  // Stop camera
  const stop = useCallback(() => {
    scanningRef.current = false;
    setIsActive(false);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Switch device
  const switchDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isActive) {
      stop();
      // Restart with new device after a short delay
      setTimeout(() => start(), 200);
    }
  }, [isActive, stop, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isActive,
    isLoading,
    error,
    devices,
    selectedDeviceId,
    start,
    stop,
    switchDevice,
    videoRef,
  };
}
