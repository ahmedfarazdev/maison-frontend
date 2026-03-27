// ============================================================
// H6 — Bulk Export Everywhere
// Universal export utility that can be dropped into any table/list.
// Supports CSV, JSON, and clipboard export. Configurable columns.
// ============================================================

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Download, FileSpreadsheet, FileJson, Copy, Settings2,
  CheckCircle2, Table2,
} from 'lucide-react';
import { toast } from 'sonner';

// ---- Types ----
export interface ExportColumn {
  key: string;
  label: string;
  enabled: boolean;
  formatter?: (value: any) => string;
}

export interface BulkExportProps<T extends Record<string, any>> {
  data: T[];
  columns: ExportColumn[];
  filename: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  onExport?: (format: string, count: number) => void;
}

// ---- CSV generation ----
function toCSV<T extends Record<string, any>>(data: T[], columns: ExportColumn[]): string {
  const enabledCols = columns.filter(c => c.enabled);
  const headers = enabledCols.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    enabledCols.map(col => {
      const val = row[col.key];
      const formatted = col.formatter ? col.formatter(val) : String(val ?? '');
      // Escape quotes in CSV
      return `"${formatted.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headers, ...rows].join('\n');
}

// ---- JSON generation ----
function toJSON<T extends Record<string, any>>(data: T[], columns: ExportColumn[]): string {
  const enabledCols = columns.filter(c => c.enabled);
  const filtered = data.map(row => {
    const obj: Record<string, any> = {};
    enabledCols.forEach(col => {
      obj[col.key] = col.formatter ? col.formatter(row[col.key]) : row[col.key];
    });
    return obj;
  });
  return JSON.stringify(filtered, null, 2);
}

// ---- Download helper ----
function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Bulk Export Component ----
export function BulkExport<T extends Record<string, any>>({
  data,
  columns: initialColumns,
  filename,
  label = 'Export',
  variant = 'outline',
  size = 'sm',
  className,
  onExport,
}: BulkExportProps<T>) {
  const [columns, setColumns] = useState(initialColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const toggleColumn = useCallback((key: string) => {
    setColumns(prev => prev.map(c =>
      c.key === key ? { ...c, enabled: !c.enabled } : c
    ));
  }, []);

  const handleExportCSV = useCallback(() => {
    const csv = toCSV(data, columns);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadBlob(csv, `${filename}-${dateStr}.csv`, 'text/csv;charset=utf-8;');
    toast.success(`Exported ${data.length} rows as CSV`);
    onExport?.('csv', data.length);
  }, [data, columns, filename, onExport]);

  const handleExportJSON = useCallback(() => {
    const json = toJSON(data, columns);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadBlob(json, `${filename}-${dateStr}.json`, 'application/json');
    toast.success(`Exported ${data.length} rows as JSON`);
    onExport?.('json', data.length);
  }, [data, columns, filename, onExport]);

  const handleCopyClipboard = useCallback(async () => {
    const csv = toCSV(data, columns);
    try {
      await navigator.clipboard.writeText(csv);
      toast.success(`Copied ${data.length} rows to clipboard`);
      onExport?.('clipboard', data.length);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [data, columns, onExport]);

  const enabledCount = columns.filter(c => c.enabled).length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={cn('gap-1.5', className)}>
            <Download className="w-3.5 h-3.5" />
            {size !== 'icon' && label}
            {data.length > 0 && size !== 'icon' && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">
                {data.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] text-muted-foreground">
            Export {data.length} rows ({enabledCount} columns)
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportCSV} className="gap-2 text-xs cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5 text-success" />
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportJSON} className="gap-2 text-xs cursor-pointer">
            <FileJson className="w-3.5 h-3.5 text-info" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyClipboard} className="gap-2 text-xs cursor-pointer">
            <Copy className="w-3.5 h-3.5 text-gold" />
            Copy to Clipboard
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowColumnPicker(true)} className="gap-2 text-xs cursor-pointer">
            <Settings2 className="w-3.5 h-3.5" />
            Configure Columns
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column Picker Dialog */}
      <Dialog open={showColumnPicker} onOpenChange={setShowColumnPicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Table2 className="w-4 h-4 text-gold" />
              Export Columns
            </DialogTitle>
            <DialogDescription>
              Select which columns to include in the export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
            {columns.map(col => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={col.enabled}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <span className="text-xs">{col.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumns(prev => prev.map(c => ({ ...c, enabled: true })))}
              className="text-xs"
            >
              Select All
            </Button>
            <Button size="sm" onClick={() => setShowColumnPicker(false)} className="text-xs">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Convenience: Quick Export Button (no column config) ----
export function QuickExportCSV<T extends Record<string, any>>({
  data,
  columns,
  filename,
  className,
}: {
  data: T[];
  columns: ExportColumn[];
  filename: string;
  className?: string;
}) {
  const handleExport = () => {
    const csv = toCSV(data, columns);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadBlob(csv, `${filename}-${dateStr}.csv`, 'text/csv;charset=utf-8;');
    toast.success(`Exported ${data.length} rows`);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleExport} className={cn('gap-1 text-xs h-7', className)}>
      <Download className="w-3 h-3" />
      CSV
    </Button>
  );
}
