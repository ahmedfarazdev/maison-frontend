import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, X, Check, AlertTriangle,
  ChevronDown, ChevronRight, Download, Trash2,
} from 'lucide-react';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  description?: string;
  hideInPreview?: boolean;
}

interface GenericBulkImportProps<T> {
  title: string;
  subtitle?: string;
  columns: ImportColumn[];
  onImport: (data: T[]) => Promise<any>;
  onClose: () => void;
  transformRow?: (raw: Record<string, string>) => Partial<T>;
  validateRow?: (raw: Record<string, string>) => { errors: string[]; warnings: string[] };
  beforeImport?: (data: T[]) => Promise<T[]>;
  summaryExtra?: (data: T[]) => React.ReactNode;
  previewColumns?: string[];
  templateExample: Record<string, string>;
  templateFilename: string;
}

// ---- Helpers ----
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 0) return { headers: [], rows: [] };
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows = lines.slice(1).map(l => parseLine(l));
  return { headers, rows };
}

export default function GenericBulkImport<T>({
  title,
  subtitle,
  columns,
  onImport,
  onClose,
  transformRow,
  validateRow,
  beforeImport,
  summaryExtra,
  previewColumns,
  templateExample,
  templateFilename,
}: GenericBulkImportProps<T>) {
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow<T>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const REQUIRED_KEYS = columns.filter(c => c.required).map(c => c.key);
  const EXPECTED_KEYS = columns.map(c => c.key);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: csvHeaders, rows } = parseCSV(text);
      setHeaders(csvHeaders);

      // Check required columns
      const missing = REQUIRED_KEYS.filter(k => !csvHeaders.includes(k));
      if (missing.length > 0) {
        toast.error(`Missing required columns: ${missing.join(', ')}`);
        return;
      }

      // Parse each row
      const results: ParsedRow<T>[] = rows.map((row, idx) => {
        const raw: Record<string, string> = {};
        csvHeaders.forEach((h, i) => { raw[h] = row[i] || ''; });

        let errors: string[] = [];
        let warnings: string[] = [];

        // Basic required field validation
        REQUIRED_KEYS.forEach(key => {
          if (!raw[key]) errors.push(`${columns.find(c => c.key === key)?.label || key} is required`);
        });

        // Run custom validator if provided
        if (validateRow) {
          const custom = validateRow(raw);
          errors = [...errors, ...custom.errors];
          warnings = [...warnings, ...custom.warnings];
        }

        // Transform row
        let data: Partial<T> | null = null;
        if (errors.length === 0) {
          if (transformRow) {
            data = transformRow(raw);
          } else {
            // Default shallow mapping if no transform provided
            data = {} as Partial<T>;
            EXPECTED_KEYS.forEach(key => {
              if (raw[key] !== undefined) (data as any)[key] = raw[key];
            });
          }
        }

        return { rowIndex: idx + 1, raw, data, errors, warnings };
      });

      setParsed(results);
      const valid = results.filter(r => r.errors.length === 0).length;
      const invalid = results.filter(r => r.errors.length > 0).length;
      toast.success(`Parsed ${results.length} rows: ${valid} valid, ${invalid} with errors`);
    };
    reader.readAsText(file);
  }, [columns, REQUIRED_KEYS, EXPECTED_KEYS, transformRow, validateRow]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const validRows = parsed.filter(r => r.errors.length === 0);
  const invalidRows = parsed.filter(r => r.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setImporting(true);

    try {
      let finalData = validRows.map(r => r.data as T);
      
      if (beforeImport) {
        finalData = await beforeImport(finalData);
      }

      await onImport(finalData);
      toast.success(`Successfully imported ${finalData.length} items`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headerLine = EXPECTED_KEYS.join(',');
    const exampleValues = EXPECTED_KEYS.map(key => templateExample[key] || '');
    const exampleLine = exampleValues.map(v => v.includes(',') ? `"${v}"` : v).join(',');
    
    const csv = `${headerLine}\n${exampleLine}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFilename.endsWith('.csv') ? templateFilename : `${templateFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {subtitle || 'Upload a CSV to import data in bulk'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Drop zone */}
          {parsed.length === 0 && (
            <>
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer',
                  dragOver
                    ? 'border-gold bg-gold/5 scale-[1.01]'
                    : 'border-border hover:border-gold/50 hover:bg-muted/30'
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-gold" />
                  </div>
                  <div>
                    <p className="text-base font-semibold">Drop your CSV file here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  </div>
                  <div className="text-xs text-muted-foreground max-w-md space-y-1">
                    <p>
                      Required columns: <span className="font-mono text-foreground font-semibold">{REQUIRED_KEYS.join(', ')}</span>
                    </p>
                    <p>
                      Other columns: {EXPECTED_KEYS.filter(k => !REQUIRED_KEYS.includes(k)).join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
                  <Download className="w-3.5 h-3.5" /> Download CSV Template
                </Button>
              </div>
            </>
          )}

          {/* Results */}
          {parsed.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{parsed.length} rows parsed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-emerald-600 font-medium">{validRows.length} valid</span>
                </div>
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600 font-medium">{invalidRows.length} errors</span>
                  </div>
                )}
                {summaryExtra && (
                  <div className="h-4 w-px bg-border mx-2" />
                )}
                {summaryExtra && summaryExtra(validRows.map(r => r.data as T))}
                
                <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-muted-foreground"
                  onClick={() => { setParsed([]); setHeaders([]); }}>
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>

              {/* Column mapping summary */}
              <div className="bg-muted/20 rounded-lg p-3 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Detected CSV Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {headers.map(h => {
                    const mappedCol = columns.find(c => c.key === h);
                    const isRequired = mappedCol?.required;
                    const isKnown = !!mappedCol;
                    return (
                      <span key={h} className={cn(
                        'text-[10px] px-2 py-1 rounded-full font-mono',
                        isRequired ? 'bg-gold/15 text-gold border border-gold/30' :
                        isKnown ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' :
                        'bg-muted text-muted-foreground border border-border'
                      )}>
                        {h}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Row table */}
              <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-12 text-center">#</th>
                      {columns
                        .filter(c => previewColumns ? previewColumns.includes(c.key) : !c.hideInPreview)
                        .map(col => (
                          <th key={col.key} className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">
                            {col.label}
                          </th>
                        ))}
                      <th className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-20">Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map(row => {
                      const isOpen = expandedRow === row.rowIndex;
                      const hasErrors = row.errors.length > 0;

                      return (
                        <tr key={row.rowIndex} className="group border-b border-border last:border-0">
                          <td colSpan={columns.filter(c => !c.hideInPreview).length + 3} className="p-0">
                            <div>
                              {/* Main inline row */}
                              <button
                                className={cn(
                                  'w-full flex items-center text-left hover:bg-muted/20 transition-colors',
                                  hasErrors && 'bg-red-50/50 dark:bg-red-950/10'
                                )}
                                onClick={() => setExpandedRow(isOpen ? null : row.rowIndex)}
                              >
                                <div className="px-4 py-2.5 w-12 text-center text-xs font-mono text-muted-foreground">{row.rowIndex}</div>
                                {columns
                                  .filter(c => previewColumns ? previewColumns.includes(c.key) : !c.hideInPreview)
                                  .map(col => (
                                    <div key={col.key} className="px-4 py-2.5 flex-1 text-sm truncate">
                                      {row.raw[col.key] || <span className="text-muted-foreground text-xs">—</span>}
                                    </div>
                                  ))}
                                <div className="px-4 py-2.5 w-24">
                                  {hasErrors ? (
                                    <StatusBadge variant="destructive">Error</StatusBadge>
                                  ) : row.warnings.length > 0 ? (
                                    <StatusBadge variant="warning">Warn</StatusBadge>
                                  ) : (
                                    <StatusBadge variant="success">Valid</StatusBadge>
                                  )}
                                </div>
                                <div className="px-2 py-2.5 w-10 text-muted-foreground">
                                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                              </button>

                              {/* Expanded detail */}
                              {isOpen && (
                                <div className="px-6 py-4 bg-muted/10 space-y-3">
                                  {row.errors.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Errors Found</p>
                                      {row.errors.map((err, i) => (
                                        <p key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                                          <AlertTriangle className="w-3 h-3 shrink-0" /> {err}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {row.warnings.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Warnings</p>
                                      {row.warnings.map((w, i) => (
                                        <p key={i} className="text-xs text-amber-600">{w}</p>
                                      ))}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Full CSV Content</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                                      {Object.entries(row.raw).map(([k, v]) => (
                                        <div key={k} className="text-xs">
                                          <span className="font-mono text-muted-foreground opacity-70">{k}:</span>{' '}
                                          <span className={cn("font-medium", !v && "text-muted-foreground")}>{v || '(empty)'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {parsed.length > 0 ? (
              <span>Only valid rows will be imported. Batch processing ensures data integrity.</span>
            ) : (
              <span>Total rows limit: 1000 per import session</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button>
            {parsed.length > 0 && (
              <Button
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5 min-w-[140px]"
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
              >
                {importing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Import {validRows.length} Rows
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
