// ============================================================
// PO Documents Panel — Upload, View, Verify, Compliance
// Design: "Maison Ops" — Luxury Operations
// Drag-and-drop upload, document list, verification badges,
// compliance status, and document viewer dialog.
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import {
  addDocumentToPO, verifyDocument, removeDocument,
  DOCUMENT_CATEGORIES,
  type PurchaseOrder, type PODocument, type DocumentCategory,
} from '@/lib/inventory-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  FileText, Upload, X, Check, CheckCircle2, AlertTriangle,
  Eye, Trash2, Shield, ShieldCheck, Clock, Download,
  Receipt, Truck, ClipboardList, Landmark, Microscope,
  Paperclip, FileCheck, FilePlus, FileWarning,
} from 'lucide-react';

// ---- Category Icon Map ----
const CATEGORY_ICONS: Record<DocumentCategory, React.ElementType> = {
  invoice: Receipt,
  certificate_of_authenticity: ShieldCheck,
  shipping_document: Truck,
  packing_list: ClipboardList,
  customs_declaration: Landmark,
  quality_report: Microscope,
  insurance: Shield,
  other: Paperclip,
};

// ---- Format file size ----
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Compliance Status Badge ----
function ComplianceBadge({ status }: { status: 'pending' | 'partial' | 'complete' }) {
  const config = {
    pending: { label: 'Docs Pending', variant: 'destructive' as const, icon: FileWarning },
    partial: { label: 'Partially Compliant', variant: 'warning' as const, icon: FilePlus },
    complete: { label: 'Fully Compliant', variant: 'success' as const, icon: FileCheck },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <StatusBadge variant={c.variant}>
      <Icon className="w-3 h-3 mr-1" />{c.label}
    </StatusBadge>
  );
}

// ---- Document Viewer Dialog ----
function DocumentViewerDialog({ doc, poId, onClose }: {
  doc: PODocument;
  poId: string;
  onClose: () => void;
}) {
  const CatIcon = CATEGORY_ICONS[doc.category];
  const catLabel = DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category;

  const handleVerify = () => {
    verifyDocument(poId, doc.doc_id);
    toast.success(`Document verified: ${doc.file_name}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
              doc.verified ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
              <CatIcon className={cn('w-5 h-5', doc.verified ? 'text-emerald-500' : 'text-amber-500')} />
            </div>
            <div>
              <h3 className="text-base font-bold">{doc.file_name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{catLabel} · {formatFileSize(doc.file_size)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Document Preview Placeholder */}
          <div className="bg-muted/30 border border-dashed border-border rounded-xl p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Document Preview</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{doc.file_type} · {formatFileSize(doc.file_size)}</p>
            <p className="text-[10px] text-muted-foreground/50 mt-3">
              In production, this would render the actual PDF/image document
            </p>
          </div>

          {/* Document Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/20 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Category</p>
              <div className="flex items-center gap-2">
                <CatIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{catLabel}</span>
              </div>
            </div>
            <div className="bg-muted/20 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">File Type</p>
              <p className="text-sm font-medium">{doc.file_type}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Uploaded</p>
              <p className="text-sm font-medium">{new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">by {doc.uploaded_by}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Verification</p>
              {doc.verified ? (
                <div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Verified</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    by {doc.verified_by} on {doc.verified_at ? new Date(doc.verified_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Pending Verification</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {doc.notes && (
            <div className="bg-muted/20 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Notes</p>
              <p className="text-sm">{doc.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => { removeDocument(poId, doc.doc_id); toast.info('Document removed'); onClose(); }}>
            <Trash2 className="w-3 h-3" /> Remove
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Download className="w-3 h-3" /> Download
            </Button>
            {!doc.verified && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs" onClick={handleVerify}>
                <CheckCircle2 className="w-3 h-3" /> Verify Document
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Upload Document Dialog ----
function UploadDocumentDialog({ po, onClose }: {
  po: PurchaseOrder;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<DocumentCategory>('invoice');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<{ name: string; type: string; size: number }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles.map(f => ({ name: f.name, type: f.type || 'application/octet-stream', size: f.size }))]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles.map(f => ({ name: f.name, type: f.type || 'application/octet-stream', size: f.size }))]);
  }, []);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = () => {
    if (files.length === 0) { toast.error('Select at least one file'); return; }

    let uploadedCount = 0;
    for (const file of files) {
      const result = addDocumentToPO(po.po_id, {
        category,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: 'usr_001',
        notes: notes || undefined,
      });
      if (result) uploadedCount++;
    }

    toast.success(`${uploadedCount} document${uploadedCount > 1 ? 's' : ''} uploaded to ${po.po_id}`, {
      description: `Category: ${DOCUMENT_CATEGORIES.find(c => c.value === category)?.label}`,
    });
    onClose();
  };

  // Determine which required docs are missing
  const existingCategories = new Set(po.documents.map(d => d.category));
  const missingRequired = DOCUMENT_CATEGORIES.filter(c => c.required && !existingCategories.has(c.value));

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <Upload className="w-4.5 h-4.5 text-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload Documents</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{po.po_id} · {po.supplier_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Missing Required Docs Warning */}
          {missingRequired.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Missing Required Documents</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missingRequired.map(cat => {
                  const CatIcon = CATEGORY_ICONS[cat.value];
                  return (
                    <button key={cat.value} onClick={() => setCategory(cat.value)}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all',
                        category === cat.value
                          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                          : 'bg-background border-border text-muted-foreground hover:border-amber-300')}>
                      <CatIcon className="w-3 h-3" /> {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Document Category */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">Document Type</label>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_CATEGORIES.map(cat => {
                const CatIcon = CATEGORY_ICONS[cat.value];
                const alreadyUploaded = existingCategories.has(cat.value);
                return (
                  <button key={cat.value} onClick={() => setCategory(cat.value)}
                    className={cn('flex items-center gap-2.5 p-3 rounded-lg border transition-all text-left',
                      category === cat.value
                        ? 'border-gold/50 bg-gold/5'
                        : 'border-border hover:border-border/80 hover:bg-muted/30')}>
                    <CatIcon className={cn('w-4 h-4 shrink-0',
                      category === cat.value ? 'text-gold' : 'text-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs font-semibold truncate',
                          category === cat.value ? 'text-gold' : 'text-foreground')}>{cat.label}</span>
                        {cat.required && <span className="text-[8px] font-bold text-destructive bg-destructive/10 px-1 rounded">REQ</span>}
                      </div>
                      {alreadyUploaded && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                          <Check className="w-2.5 h-2.5" /> Uploaded
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drop Zone */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">Files</label>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-gold bg-gold/5'
                  : 'border-border hover:border-gold/50 hover:bg-muted/20'
              )}>
              <Upload className={cn('w-8 h-8 mx-auto mb-3', isDragging ? 'text-gold' : 'text-muted-foreground/40')} />
              <p className="text-sm font-medium">{isDragging ? 'Drop files here' : 'Click or drag files to upload'}</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOCX — Max 25MB per file</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.xlsx,.xls"
                onChange={handleFileSelect} className="hidden" />
            </div>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted/20 rounded-lg px-4 py-2.5 border border-border/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{file.type} · {formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none"
              placeholder="Additional notes about this document..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5" onClick={handleUpload} disabled={files.length === 0}>
            <Upload className="w-3.5 h-3.5" /> Upload {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Documents Panel (inline in PO detail) ----
export default function PODocumentsPanel({ po }: { po: PurchaseOrder }) {
  const [viewingDoc, setViewingDoc] = useState<PODocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const docs = po.documents || [];
  const requiredCategories = DOCUMENT_CATEGORIES.filter(c => c.required);
  const uploadedRequired = requiredCategories.filter(cat => docs.some(d => d.category === cat.value));
  const verifiedCount = docs.filter(d => d.verified).length;

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/10">
          <div className="flex items-center gap-3">
            <FileText className="w-4.5 h-4.5 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-bold">Documents & Compliance</h3>
              <p className="text-[10px] text-muted-foreground">
                {docs.length} document{docs.length !== 1 ? 's' : ''} · {verifiedCount} verified · {uploadedRequired.length}/{requiredCategories.length} required
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ComplianceBadge status={po.compliance_status} />
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setShowUpload(true)}>
              <Upload className="w-3 h-3" /> Upload
            </Button>
          </div>
        </div>

        {/* Compliance Checklist */}
        <div className="px-5 py-3 border-b border-border/50 bg-muted/5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Required Documents</p>
          <div className="flex flex-wrap gap-2">
            {requiredCategories.map(cat => {
              const uploaded = docs.find(d => d.category === cat.value);
              const verified = uploaded?.verified;
              const CatIcon = CATEGORY_ICONS[cat.value];
              return (
                <div key={cat.value} className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium border',
                  verified
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : uploaded
                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                      : 'bg-destructive/5 border-destructive/20 text-destructive'
                )}>
                  {verified ? <CheckCircle2 className="w-3 h-3" /> : uploaded ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  <CatIcon className="w-3 h-3" />
                  {cat.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Document List */}
        {docs.length > 0 ? (
          <div className="divide-y divide-border/50">
            {docs.map(doc => {
              const CatIcon = CATEGORY_ICONS[doc.category];
              const catLabel = DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category;
              const isRequired = DOCUMENT_CATEGORIES.find(c => c.value === doc.category)?.required;
              return (
                <div key={doc.doc_id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/10 transition-colors group">
                  {/* Icon */}
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    doc.verified ? 'bg-emerald-500/10' : 'bg-muted/30')}>
                    <CatIcon className={cn('w-4.5 h-4.5', doc.verified ? 'text-emerald-500' : 'text-muted-foreground')} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{doc.file_name}</p>
                      {isRequired && <span className="text-[8px] font-bold text-destructive bg-destructive/10 px-1 rounded shrink-0">REQ</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{catLabel}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Verification Status */}
                  <div className="shrink-0">
                    {doc.verified ? (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Verified</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); verifyDocument(po.po_id, doc.doc_id); toast.success('Document verified'); }}
                        className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-emerald-600 transition-colors">
                        <Clock className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">Verify</span>
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setViewingDoc(doc)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { removeDocument(po.po_id, doc.doc_id); toast.info('Document removed'); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-3" onClick={() => setShowUpload(true)}>
              <Upload className="w-3 h-3" /> Upload First Document
            </Button>
          </div>
        )}
      </div>

      {/* Document Viewer Dialog */}
      {viewingDoc && (
        <DocumentViewerDialog doc={viewingDoc} poId={po.po_id} onClose={() => setViewingDoc(null)} />
      )}

      {/* Upload Dialog */}
      {showUpload && (
        <UploadDocumentDialog po={po} onClose={() => setShowUpload(false)} />
      )}
    </>
  );
}

// ---- Compact Compliance Badge (for PO list items) ----
export function POComplianceBadge({ po }: { po: PurchaseOrder }) {
  return <ComplianceBadge status={po.compliance_status} />;
}

// ---- Inline Document Count (for PO list items) ----
export function PODocCount({ po }: { po: PurchaseOrder }) {
  const docs = po.documents || [];
  const verified = docs.filter(d => d.verified).length;
  if (docs.length === 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
      <FileText className="w-3 h-3" /> {docs.length} doc{docs.length > 1 ? 's' : ''} ({verified} verified)
    </span>
  );
}
