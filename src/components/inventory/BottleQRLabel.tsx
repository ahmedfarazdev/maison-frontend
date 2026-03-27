// ============================================================
// BottleQRLabel — QR Code + Barcode Label for Bottles
// Shows QR code, bottle ID, master ID, type, and location
// Can be used inline or in a print-ready dialog
// ============================================================

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { InventoryBottle } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Printer, X, Download, QrCode, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

// ---- Inline QR Badge (small, for tables/cards) ----
export function BottleQRBadge({ bottle, size = 32 }: { bottle: InventoryBottle; size?: number }) {
  const [showFull, setShowFull] = useState(false);
  const qrData = bottle.qr_data || JSON.stringify({
    id: bottle.bottle_id,
    master: bottle.master_id,
    type: bottle.bottle_type,
    ml: bottle.size_ml,
  });

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowFull(true); }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors border border-border/50 group"
        title="View QR label"
      >
        <QRCodeSVG value={qrData} size={size} level="M" bgColor="transparent" fgColor="currentColor" className="text-foreground" />
        <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">QR</span>
      </button>
      {showFull && (
        <BottleLabelDialog bottle={bottle} onClose={() => setShowFull(false)} />
      )}
    </>
  );
}

// ---- Barcode visual (Code128-style rendered as SVG bars) ----
function BarcodeVisual({ value, width = 200, height = 40 }: { value: string; width?: number; height?: number }) {
  // Simple visual barcode representation using the string characters
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const barWidth = width / (value.length * 11 + 35);

  // Start pattern
  for (let i = 0; i < 6; i++) {
    bars.push({ x: x, w: barWidth * (i % 2 === 0 ? 1 : 1) });
    x += barWidth * (i % 2 === 0 ? 1 : 1.5);
  }

  // Data bars
  for (let c = 0; c < value.length; c++) {
    const code = value.charCodeAt(c);
    for (let b = 0; b < 8; b++) {
      const bit = (code >> (7 - b)) & 1;
      if (bit) {
        bars.push({ x, w: barWidth });
      }
      x += barWidth * 1.2;
    }
    x += barWidth * 0.5; // gap between chars
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-foreground">
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={0} width={bar.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}

// ---- Full Label Dialog (print-ready) ----
export function BottleLabelDialog({ bottle, onClose }: {
  bottle: InventoryBottle;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const qrData = bottle.qr_data || JSON.stringify({
    id: bottle.bottle_id,
    master: bottle.master_id,
    type: bottle.bottle_type,
    ml: bottle.size_ml,
  });

  const barcodeValue = bottle.barcode || `EM-${bottle.bottle_id}`;

  const handleCopyId = () => {
    navigator.clipboard.writeText(bottle.bottle_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Bottle ID copied');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Pop-up blocked'); return; }

    const labelHtml = `
      <!DOCTYPE html>
      <html><head>
        <title>Label — ${bottle.bottle_id}</title>
        <style>
          @page { size: 62mm 100mm; margin: 2mm; }
          body { font-family: 'Courier New', monospace; margin: 0; padding: 4mm; display: flex; flex-direction: column; align-items: center; }
          .label { border: 1px solid #333; padding: 3mm; width: 56mm; }
          .header { text-align: center; font-size: 8pt; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 2mm; margin-bottom: 2mm; }
          .qr { text-align: center; margin: 2mm 0; }
          .field { font-size: 7pt; margin: 1mm 0; display: flex; justify-content: space-between; }
          .field-label { font-weight: bold; }
          .barcode-text { text-align: center; font-size: 8pt; letter-spacing: 1px; margin-top: 1mm; }
          .type-badge { display: inline-block; padding: 0.5mm 2mm; border: 1px solid #333; font-size: 7pt; font-weight: bold; text-transform: uppercase; }
        </style>
      </head><body onload="window.print()">
        <div class="label">
          <div class="header">MAISON EM — AURA VAULT</div>
          <div class="qr" id="qr-container"></div>
          <div class="field"><span class="field-label">ID:</span><span>${bottle.bottle_id}</span></div>
          <div class="field"><span class="field-label">Master:</span><span style="font-size:6pt">${bottle.master_id}</span></div>
          <div class="field"><span class="field-label">Type:</span><span class="type-badge">${bottle.bottle_type}</span></div>
          <div class="field"><span class="field-label">Size:</span><span>${bottle.size_ml}ml</span></div>
          <div class="field"><span class="field-label">Location:</span><span>${bottle.location_code}</span></div>
          <div class="barcode-text">${barcodeValue}</div>
        </div>
      </body></html>
    `;
    printWindow.document.write(labelHtml);
    printWindow.document.close();
  };

  const typeColors: Record<string, string> = {
    sealed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    open: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
    tester: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-bold">Bottle Label</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Label Preview */}
        <div className="p-5">
          <div className="bg-white dark:bg-zinc-900 border-2 border-dashed border-border rounded-xl p-5 space-y-4">
            {/* Header */}
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Maison EM — Aura Vault</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={qrData} size={120} level="H" bgColor="#ffffff" fgColor="#1a1a1a" />
              </div>
            </div>

            {/* Bottle ID */}
            <div className="text-center">
              <button onClick={handleCopyId} className="inline-flex items-center gap-1.5 group">
                <span className="text-lg font-mono font-bold tracking-wide">{bottle.bottle_id}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />}
              </button>
            </div>

            {/* Details */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Master ID</span>
                <span className="text-[10px] font-mono text-foreground">{bottle.master_id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type</span>
                <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded border', typeColors[bottle.bottle_type] || typeColors.sealed)}>
                  {bottle.bottle_type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Size</span>
                <span className="text-xs font-mono font-bold">{bottle.size_ml}ml</span>
              </div>
              {bottle.current_ml !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Current</span>
                  <span className="text-xs font-mono font-bold">{bottle.current_ml}ml</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Location</span>
                <span className="text-xs font-mono font-bold">{bottle.location_code}</span>
              </div>
            </div>

            {/* Barcode */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex justify-center">
                <BarcodeVisual value={barcodeValue} width={240} height={35} />
              </div>
              <p className="text-center text-[10px] font-mono tracking-[0.15em] text-muted-foreground mt-1">{barcodeValue}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" /> Print Label
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleCopyId}>
            <Copy className="w-3.5 h-3.5" /> Copy ID
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BottleQRBadge;
