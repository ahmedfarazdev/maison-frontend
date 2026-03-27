// ============================================================
// PODocumentUpload — Dialog for uploading quote/invoice PDFs
// Supports drag-and-drop, inline PDF preview, and S3 storage
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useFileUpload } from '@/hooks/useFileUpload';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  X, Upload, FileText, Eye, Download, CheckCircle2,
  AlertCircle, Loader2, File,
} from 'lucide-react';

interface PODocumentUploadProps {
  poId: string;
  poNumber: string;
  type: 'quote' | 'invoice';
  existingUrl?: string | null;
  onClose: () => void;
  onUploaded: (url: string) => void;
}

export function PODocumentUpload({ poId, poNumber, type, existingUrl, onClose, onUploaded }: PODocumentUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress, error } = useFileUpload({
    folder: `po-documents/${type}s`,
    maxSizeMB: 10,
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    onSuccess: async (result) => {
      setPreviewUrl(result.url);
      // Save to PO record
      setSaving(true);
      try {
        await api.mutations.purchaseOrders.uploadDocument(poId, type, result.url);
        toast.success(`${type === 'quote' ? 'Quote' : 'Invoice'} uploaded successfully`);
        onUploaded(result.url);
      } catch (e: any) {
        toast.error(e.message || 'Failed to save document reference');
      } finally {
        setSaving(false);
      }
    },
    onError: (err) => {
      toast.error(err);
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, [upload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }, [upload]);

  const isPdf = previewUrl?.toLowerCase().endsWith('.pdf');
  const typeLabel = type === 'quote' ? 'Quote' : 'Invoice';
  const typeColor = type === 'quote' ? 'blue' : 'emerald';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center',
              type === 'quote' ? 'bg-blue-100 dark:bg-blue-950/30' : 'bg-emerald-100 dark:bg-emerald-950/30')}>
              <FileText className={cn('w-4.5 h-4.5', type === 'quote' ? 'text-blue-600' : 'text-emerald-600')} />
            </div>
            <div>
              <h3 className="text-base font-bold">Upload {typeLabel}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{poNumber} — PDF or image file (max 10MB)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop Zone */}
          {!previewUrl && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                dragOver ? `border-${typeColor}-400 bg-${typeColor}-50/50 dark:bg-${typeColor}-950/20` :
                'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                uploading && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploading ? (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 mx-auto text-muted-foreground animate-spin" />
                  <p className="text-sm font-medium">Uploading...</p>
                  <div className="w-48 mx-auto bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{progress}%</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium">Drop {typeLabel.toLowerCase()} file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports PDF, JPEG, PNG, WebP (max 10MB)</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Uploaded File Preview */}
          {previewUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn('w-5 h-5', type === 'quote' ? 'text-blue-500' : 'text-emerald-500')} />
                  <span className="text-sm font-medium">{typeLabel} uploaded</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                    onClick={() => setShowPreview(!showPreview)}>
                    <Eye className="w-3.5 h-3.5" /> {showPreview ? 'Hide' : 'Preview'}
                  </Button>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> Open
                    </Button>
                  </a>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs text-muted-foreground"
                    onClick={() => {
                      setPreviewUrl(null);
                      setShowPreview(false);
                    }}>
                    Replace
                  </Button>
                </div>
              </div>

              {/* Inline Preview */}
              {showPreview && (
                <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                  {isPdf ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[400px]"
                      title={`${typeLabel} Preview`}
                    />
                  ) : (
                    <div className="p-4 flex items-center justify-center">
                      <img src={previewUrl} alt={typeLabel} className="max-h-[400px] rounded-lg object-contain" />
                    </div>
                  )}
                </div>
              )}

              {/* File URL */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">File URL</p>
                <p className="text-xs font-mono text-muted-foreground break-all">{previewUrl}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>
            {previewUrl ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
