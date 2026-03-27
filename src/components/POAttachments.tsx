/**
 * POAttachments — Full attachment panel for a Purchase Order
 * Supports multi-file upload via drag-and-drop, category tagging,
 * inline PDF/image preview, and delete with confirmation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useFileUpload } from '@/hooks/useFileUpload';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import {
  X, Upload, FileText, Eye, Download, Trash2, Loader2,
  Paperclip, Ship, Receipt, FileSignature, FileCheck,
  PackageCheck, File as FileIcon, Plus, ChevronDown,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'shipping_doc', label: 'Shipping Document', icon: Ship, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { value: 'invoice', label: 'Invoice', icon: Receipt, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'contract', label: 'Contract', icon: FileSignature, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
  { value: 'receipt', label: 'Receipt', icon: FileCheck, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  { value: 'quote', label: 'Quote', icon: FileText, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' },
  { value: 'packing_list', label: 'Packing List', icon: PackageCheck, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' },
  { value: 'other', label: 'Other', icon: FileIcon, color: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30' },
] as const;

interface Attachment {
  attachmentId: string;
  poId: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  category: string;
  uploadedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface POAttachmentsProps {
  poId: string;
  poNumber: string;
  onClose: () => void;
  onChanged?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryMeta(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];
}

export function POAttachments({ poId, poNumber, onClose, onChanged }: POAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('other');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await api.purchaseOrders.attachments(poId);
      setAttachments((res.data || []) as Attachment[]);
    } catch (e) {
      console.warn('Failed to load attachments', e);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const { upload, uploading, progress } = useFileUpload({
    folder: `po-attachments/${poId}`,
    maxSizeMB: 10,
    allowedTypes: [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
    ],
    onSuccess: async (result) => {
      try {
        await api.mutations.purchaseOrders.addAttachment({
          poId,
          attachmentId: `ATT-${nanoid(10)}`,
          fileName: result.filename,
          fileUrl: result.url,
          fileKey: result.key,
          mimeType: result.mimeType,
          fileSize: result.size,
          category: selectedCategory,
        });
        toast.success(`File "${result.filename}" attached`);
        loadAttachments();
        onChanged?.();
      } catch (e: any) {
        toast.error(e.message || 'Failed to save attachment');
      }
    },
    onError: (err) => {
      toast.error(err);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) upload(files[0]);
  }, [upload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [upload]);

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.fileName}"? This cannot be undone.`)) return;
    setDeleting(att.attachmentId);
    try {
      await api.mutations.purchaseOrders.deleteAttachment(att.attachmentId);
      toast.success(`"${att.fileName}" removed`);
      setAttachments(prev => prev.filter(a => a.attachmentId !== att.attachmentId));
      if (previewAttachment?.attachmentId === att.attachmentId) setPreviewAttachment(null);
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const isPreviewable = (mime: string) =>
    mime === 'application/pdf' || mime.startsWith('image/');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
              <Paperclip className="w-4.5 h-4.5 text-gold" />
            </div>
            <div>
              <h3 className="text-base font-bold">Attachments</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{poNumber} — {attachments.length} file{attachments.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Upload Zone */}
          <div className="space-y-3">
            {/* Category Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Category:</span>
              <div className="relative">
                <button
                  onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 transition-colors"
                >
                  {(() => {
                    const cat = getCategoryMeta(selectedCategory);
                    const Icon = cat.icon;
                    return (
                      <>
                        <Icon className={cn('w-3.5 h-3.5', cat.color.split(' ')[0])} />
                        {cat.label}
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </>
                    );
                  })()}
                </button>
                {showCategoryPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.value}
                          onClick={() => { setSelectedCategory(cat.value); setShowCategoryPicker(false); }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors',
                            selectedCategory === cat.value && 'bg-muted/30 font-semibold'
                          )}
                        >
                          <Icon className={cn('w-3.5 h-3.5', cat.color.split(' ')[0])} />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                dragOver ? 'border-gold bg-gold/5' : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                uploading && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.doc,.docx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploading ? (
                <div className="space-y-2">
                  <Loader2 className="w-8 h-8 mx-auto text-muted-foreground animate-spin" />
                  <p className="text-sm font-medium">Uploading...</p>
                  <div className="w-40 mx-auto bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-[11px] text-muted-foreground">PDF, images, Excel, Word, CSV (max 10MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Attachments List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No attachments yet</p>
              <p className="text-xs mt-1">Upload shipping documents, invoices, or contracts</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {attachments.length} Attachment{attachments.length !== 1 ? 's' : ''}
              </p>
              {attachments.map(att => {
                const cat = getCategoryMeta(att.category);
                const CatIcon = cat.icon;
                const canPreview = isPreviewable(att.mimeType);
                const isActive = previewAttachment?.attachmentId === att.attachmentId;

                return (
                  <div
                    key={att.attachmentId}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      isActive ? 'border-gold/50 bg-gold/5' : 'border-border hover:bg-muted/30'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', cat.color)}>
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.fileName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatFileSize(att.fileSize)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(att.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canPreview && (
                        <button
                          onClick={() => setPreviewAttachment(isActive ? null : att)}
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            isActive ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          )}
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(att)}
                        disabled={deleting === att.attachmentId}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === att.attachmentId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline Preview */}
          {previewAttachment && (
            <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-medium truncate">{previewAttachment.fileName}</p>
                <button onClick={() => setPreviewAttachment(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {previewAttachment.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewAttachment.fileUrl}
                  className="w-full h-[400px]"
                  title="Attachment Preview"
                />
              ) : (
                <div className="p-4 flex items-center justify-center">
                  <img
                    src={previewAttachment.fileUrl}
                    alt={previewAttachment.fileName}
                    className="max-h-[400px] rounded-lg object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Compact badge showing attachment count — for use in PO rows/cards */
export function AttachmentBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-[10px] font-medium"
      title={`${count} attachment${count !== 1 ? 's' : ''}`}
    >
      <Paperclip className="w-3 h-3" />
      {count}
    </button>
  );
}
