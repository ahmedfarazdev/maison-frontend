// ============================================================
// Maison Em — Bulk CSV Upload for Perfumes
// Parses CSV matching the Perfume Master Database structure,
// auto-generates Master IDs and Syringe IDs (S/1, S/2...)
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import { generateMasterId, AURA_COLORS } from '@/lib/master-id-generator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, X, Check, AlertTriangle,
  ChevronDown, ChevronRight, Download, Trash2, Pipette,
} from 'lucide-react';
import type { Perfume, AuraColor, Concentration, HypeLevel, ScentType, Syringe, Brand } from '@/types';

// ---- CSV Column mapping (matches PDF row structure) ----
const EXPECTED_COLUMNS = [
  'brand', 'name', 'concentration', 'gender', 'aura_color',
  'hype_level', 'scent_type', 'main_family', 'sub_family',
  'retail_price', 'wholesale_price', 'reference_size_ml',
  'notes_top', 'notes_heart', 'notes_base',
  'season', 'occasion', 'personality',
  'surcharge_category', 'bottle_image_url',
  'proposed_vault', 'scent_signature', 'aura_verse',
  'scent_prose', 'scent_story', 'made_in',
];

const REQUIRED_COLUMNS = ['brand', 'name', 'concentration', 'aura_color'];

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  perfume: Partial<Perfume> | null;
  masterId: string;
  syringeId: string;
  errors: string[];
  warnings: string[];
}

export interface PerfumeBulkImportOutcome {
  createdCount: number;
  failedRows: Array<{ rowIndex: number; message: string }>;
  syringeWarning?: string;
}

export type PerfumeBulkSyringeInput = Omit<Syringe, 'id'>;

interface BulkCsvUploadProps {
  onImport: (perfumes: Perfume[], syringes: PerfumeBulkSyringeInput[]) => Promise<PerfumeBulkImportOutcome>;
  onClose: () => void;
  existingPerfumeCount: number; // for syringe ID sequencing
  brands: Brand[]; // for auto-detecting Made In
}

// ---- Helpers ----
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

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

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows = lines.slice(1).map(l => parseLine(l));
  return { headers, rows };
}

function normalizeConcentration(val: string): Concentration | null {
  const v = val.toLowerCase().trim();
  if (/extrait/.test(v)) return 'Extrait de Parfum';
  if (/eau de parfum|edp/.test(v)) return 'Eau de Parfum';
  if (/parfum/.test(v) && !/eau/.test(v)) return 'Parfum';
  if (/toilette|edt/.test(v)) return 'Eau de Toilette';
  if (/cologne/.test(v)) return 'Cologne';
  return null;
}

function normalizeAuraColor(val: string): AuraColor | null {
  const v = val.toLowerCase().trim();
  const map: Record<string, AuraColor> = {
    red: 'Red', blue: 'Blue', violet: 'Violet', green: 'Green',
    yellow: 'Yellow', orange: 'Orange', pink: 'Pink',
  };
  return map[v] || null;
}

function normalizeHype(val: string): HypeLevel | null {
  const v = val.toLowerCase().trim();
  const map: Record<string, HypeLevel> = {
    extreme: 'Extreme', high: 'High', medium: 'Medium',
    low: 'Low', rare: 'Rare', discontinued: 'Discontinued',
  };
  return map[v] || null;
}

const AURA_HEX: Record<AuraColor, string> = {
  Red: '#C41E3A', Blue: '#1B6B93', Violet: '#4A0E4E',
  Green: '#2D6A4F', Yellow: '#D4A017', Orange: '#E07C24', Pink: '#D63384',
};

// ---- Component ----
export default function BulkCsvUpload({ onImport, onClose, existingPerfumeCount, brands }: BulkCsvUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const missing = REQUIRED_COLUMNS.filter(c => !csvHeaders.includes(c));
      if (missing.length > 0) {
        toast.error(`Missing required columns: ${missing.join(', ')}`);
        return;
      }

      // Parse each row
      const results: ParsedRow[] = rows.map((row, idx) => {
        const raw: Record<string, string> = {};
        csvHeaders.forEach((h, i) => { raw[h] = row[i] || ''; });

        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate required fields
        if (!raw.brand) errors.push('Brand is required');
        if (!raw.name) errors.push('Name is required');

        const concentration = normalizeConcentration(raw.concentration || '');
        if (!concentration) errors.push(`Invalid concentration: "${raw.concentration}"`);

        const auraColor = normalizeAuraColor(raw.aura_color || '');
        if (!auraColor) errors.push(`Invalid aura color: "${raw.aura_color}"`);

        const hypeLevel = normalizeHype(raw.hype_level || 'medium');
        if (!hypeLevel) warnings.push(`Unknown hype level: "${raw.hype_level}", defaulting to medium`);

        // Generate Master ID
        let masterId = '';
        if (raw.brand && raw.name && concentration && auraColor) {
          masterId = generateMasterId(auraColor, raw.brand, raw.name, concentration);
        }

        // Syringe ID
        const seqNum = existingPerfumeCount + idx + 1;
        const syringeId = `S/${seqNum}`;

        // Build perfume object
        const perfume: Partial<Perfume> | null = errors.length > 0 ? null : {
          master_id: masterId,
          brand: raw.brand,
          name: raw.name,
          concentration: concentration!,
          gender_target: (raw.gender?.toLowerCase() as 'masculine' | 'feminine' | 'unisex') || 'unisex',
          aura_color: auraColor!,
          aura_id: '',
          hype_level: hypeLevel || 'Medium',
          scent_type: (raw.scent_type as ScentType) || 'Warm',
          main_family_id: raw.main_family || '',
          sub_family_id: raw.sub_family || '',
          notes_top: (raw.notes_top || '').split(',').map(s => s.trim()).filter(Boolean),
          notes_heart: (raw.notes_heart || '').split(',').map(s => s.trim()).filter(Boolean),
          notes_base: (raw.notes_base || '').split(',').map(s => s.trim()).filter(Boolean),
          retail_price: parseFloat(raw.retail_price) || 0,
          wholesale_price: parseFloat(raw.wholesale_price) || 0,
          reference_size_ml: parseInt(raw.reference_size_ml) || 100,
          price_per_ml: parseFloat(raw.retail_price) / (parseInt(raw.reference_size_ml) || 100),
          price_multiplier: 1,
          surcharge: 0,
          surcharge_category: (raw.surcharge_category || 'S0') as 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5',
          season: (raw.season || '').split(',').map(s => s.trim()).filter(Boolean),
          occasion: (raw.occasion || '').split(',').map(s => s.trim()).filter(Boolean),
          personality: (raw.personality || '').split(',').map(s => s.trim()).filter(Boolean),
          decant_pricing: [],
          in_stock: true,
          bottle_image_url: raw.bottle_image_url || '',
          visibility: 'active' as const,
          brand_image_url: '',
          proposed_vault: raw.proposed_vault || '',
          scent_signature: raw.scent_signature || '',
          aura_verse: raw.aura_verse || '',
          scent_prose: raw.scent_prose || '',
          scent_story: raw.scent_story || '',
          made_in: raw.made_in || (brands.find(b => b.name.toLowerCase() === raw.brand?.toLowerCase())?.made_in || ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Warnings
        if (!raw.retail_price) warnings.push('No retail price — defaults to 0');
        if (!raw.hype_level) warnings.push('No hype level — defaults to Medium');
        if (!raw.scent_type) warnings.push('No scent type — defaults to Warm');

        return { rowIndex: idx + 1, raw, perfume, masterId, syringeId, errors, warnings };
      });

      setParsed(results);
      const valid = results.filter(r => r.errors.length === 0).length;
      const invalid = results.filter(r => r.errors.length > 0).length;
      toast.success(`Parsed ${results.length} rows: ${valid} valid, ${invalid} with errors`);
    };
    reader.readAsText(file);
  }, [existingPerfumeCount]);

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

    const perfumes = validRows.map(r => r.perfume as Perfume);
    const syringes: PerfumeBulkSyringeInput[] = validRows.map((r, idx) => ({
      syringe_id: r.syringeId,
      assigned_master_id: r.masterId,
      dedicated_perfume_name: `${r.raw.brand} ${r.raw.name}`,
      sequence_number: existingPerfumeCount + idx + 1,
      size: '5ml' as const,
      status: 'active' as const,
      use_count: 0,
      active: true,
      notes: 'Auto-created with CSV import',
      created_at: new Date().toISOString(),
    }));

    try {
      const result = await onImport(perfumes, syringes);

      const normalizedFailures = result.failedRows.map((row) => ({
        rowIndex: validRows[row.rowIndex - 1]?.rowIndex ?? row.rowIndex,
        message: row.message,
      }));

      if (normalizedFailures.length > 0) {
        const failureByRow = new Map<number, string>(
          normalizedFailures.map((row) => [row.rowIndex, row.message]),
        );

        setParsed((prev) => prev.map((row) => {
          const failureMessage = failureByRow.get(row.rowIndex);
          if (!failureMessage) return row;

          if (row.errors.includes(failureMessage)) return row;
          return { ...row, errors: [...row.errors, failureMessage] };
        }));
      }

      if (result.syringeWarning) {
        toast.warning('Perfumes saved but syringes were not fully created', {
          description: result.syringeWarning,
          duration: 7000,
        });
      }

      if (result.createdCount > 0 && normalizedFailures.length === 0) {
        toast.success(`Imported ${result.createdCount} perfumes successfully`);
        onClose();
        return;
      }

      if (result.createdCount > 0) {
        toast.warning(
          `Imported ${result.createdCount} perfumes, ${normalizedFailures.length} rows failed`,
        );
        return;
      }

      toast.error('No perfumes were imported');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const header = EXPECTED_COLUMNS.join(',');
    const example = 'Amouage,Interlude 53,Extrait,Unisex,Red,High,Warm,ORIENTAL,Oriental,850,600,100,"Saffron,Bergamot","Oud,Rose","Amber,Musk","All Year Round","Date Night,Office","Elegant,Mysterious",2,,Signature Vault,Smoke & Agarwood Depth,The Ember Veil,Rich tobacco blended with sweet vanilla,A modern classic of indulgence,Oman';
    const csv = `${header}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maison_em_perfume_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">Bulk CSV Import</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload a CSV to create perfumes in bulk with auto-generated Master IDs and Syringe IDs
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
                  <p className="text-xs text-muted-foreground max-w-md">
                    Required columns: <span className="font-mono text-foreground">brand, name, concentration, aura_color</span>.
                    Optional: gender, hype_level, scent_type, retail_price, notes_top/heart/base, season, occasion, personality, surcharge_category
                  </p>
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
                <div className="ml-auto flex items-center gap-1.5">
                  <Pipette className="w-4 h-4 text-gold" />
                  <span className="text-sm text-gold font-medium">
                    Syringes: S/{existingPerfumeCount + 1} → S/{existingPerfumeCount + validRows.length}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
                  onClick={() => { setParsed([]); setHeaders([]); }}>
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>

              {/* Column mapping */}
              <div className="bg-muted/20 rounded-lg p-3 border border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Detected Columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {headers.map(h => {
                    const isRequired = REQUIRED_COLUMNS.includes(h);
                    const isKnown = EXPECTED_COLUMNS.includes(h);
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
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-12">#</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Brand</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Perfume</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Master ID</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Syringe</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5">Aura</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2.5 w-20">Status</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map(row => {
                      const isOpen = expandedRow === row.rowIndex;
                      const hasErrors = row.errors.length > 0;
                      const auraColor = normalizeAuraColor(row.raw.aura_color || '');

                      return (
                        <tr key={row.rowIndex} className="group">
                          <td colSpan={8} className="p-0">
                            <div>
                              {/* Main row */}
                              <button
                                className={cn(
                                  'w-full flex items-center text-left hover:bg-muted/20 transition-colors border-b border-border/50',
                                  hasErrors && 'bg-red-50/50 dark:bg-red-950/10'
                                )}
                                onClick={() => setExpandedRow(isOpen ? null : row.rowIndex)}
                              >
                                <div className="px-4 py-2.5 w-12 text-xs font-mono text-muted-foreground">{row.rowIndex}</div>
                                <div className="px-4 py-2.5 flex-1 text-sm font-medium truncate">{row.raw.brand || '—'}</div>
                                <div className="px-4 py-2.5 flex-1 text-sm truncate">{row.raw.name || '—'}</div>
                                <div className="px-4 py-2.5 flex-1">
                                  {row.masterId ? (
                                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{row.masterId}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div className="px-4 py-2.5 w-20">
                                  <span className="text-xs font-mono font-bold text-gold">{row.syringeId}</span>
                                </div>
                                <div className="px-4 py-2.5 w-16">
                                  {auraColor ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: AURA_HEX[auraColor] }} />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                                <div className="px-4 py-2.5 w-20">
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
                                <div className="px-6 py-4 bg-muted/10 border-b border-border space-y-3">
                                  {row.errors.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Errors</p>
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
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Raw Data</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {Object.entries(row.raw).filter(([, v]) => v).map(([k, v]) => (
                                        <div key={k} className="text-xs">
                                          <span className="font-mono text-muted-foreground">{k}:</span>{' '}
                                          <span className="font-medium">{v}</span>
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
            {parsed.length > 0 && (
              <span>
                Each imported perfume auto-creates a dedicated syringe (S/{existingPerfumeCount + 1} → S/{existingPerfumeCount + validRows.length})
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {parsed.length > 0 && (
              <Button
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
                onClick={handleImport}
                disabled={validRows.length === 0 || importing}
              >
                {importing ? (
                  <>Importing...</>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Import {validRows.length} Perfumes + {validRows.length} Syringes
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
