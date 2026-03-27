// ============================================================
// ImageUpload — Drag-and-drop image upload component with preview
// ============================================================

import { useState, useRef, useCallback, type DragEvent } from "react";
import { useFileUpload, type UploadResult } from "@/hooks/useFileUpload";
import { Upload, X, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string; // Current image URL
  onChange: (url: string) => void;
  onUploadComplete?: (result: UploadResult) => void;
  folder?: string;
  className?: string;
  placeholder?: string;
  aspectRatio?: "square" | "landscape" | "portrait";
  maxSizeMB?: number;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  onUploadComplete,
  folder = "perfume-images",
  className,
  placeholder = "Drop image here or click to upload",
  aspectRatio = "square",
  maxSizeMB = 10,
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading, progress, error } = useFileUpload({
    folder,
    maxSizeMB,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    onSuccess: (result) => {
      onChange(result.url);
      onUploadComplete?.(result);
      // Clear local preview since we now have the S3 URL
      setPreviewUrl(null);
    },
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled || uploading) return;
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
      await upload(file);
    },
    [disabled, uploading, upload]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFile]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setPreviewUrl(null);
    },
    [onChange]
  );

  const displayUrl = previewUrl || value;
  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "landscape"
        ? "aspect-video"
        : "aspect-[3/4]";

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-all cursor-pointer overflow-hidden",
          aspectClass,
          isDragging
            ? "border-primary bg-primary/5"
            : displayUrl
              ? "border-transparent"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed",
          uploading && "cursor-wait"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt="Uploaded"
              className="w-full h-full object-cover"
            />
            {/* Overlay on hover */}
            {!uploading && !disabled && (
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <span className="text-white text-sm font-medium">
                  Click to replace
                </span>
              </div>
            )}
            {/* Remove button */}
            {!uploading && !disabled && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <div className="p-3 rounded-full bg-muted">
                  {isDragging ? (
                    <Upload className="w-6 h-6" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm text-center px-4">{placeholder}</p>
                <p className="text-xs opacity-60">
                  JPG, PNG, WebP up to {maxSizeMB}MB
                </p>
              </>
            )}
          </div>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <span className="text-white text-sm font-medium">
              Uploading... {progress}%
            </span>
            <div className="w-3/4 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
