// ============================================================
// MultiImageUpload — Deferred image selection with previews
// Images are queued locally and processed in background after save.
// ============================================================

import { useState, useRef, useCallback, useMemo, useEffect, type DragEvent } from "react";
import { Upload, X, Star, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MultiImageUploadProps {
  /** Array of S3 URLs already uploaded */
  images: string[];
  /** Pending local files that will be compressed/uploaded after form save */
  pendingFiles: File[];
  /** Called whenever the image list changes */
  onChange: (urls: string[]) => void;
  /** Called whenever pending local files change */
  onPendingFilesChange: (files: File[]) => void;
  /** S3 folder prefix */
  folder?: string;
  /** Max number of images allowed */
  maxImages?: number;
  /** Max file size in MB */
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

export function MultiImageUpload({
  images,
  pendingFiles,
  onChange,
  onPendingFilesChange,
  folder = "perfume-images",
  maxImages = 8,
  maxSizeMB = 10,
  className,
  disabled = false,
}: MultiImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const pendingPreviewUrls = useMemo(
    () => pendingFiles.map((file) => URL.createObjectURL(file)),
    [pendingFiles]
  );

  useEffect(() => {
    return () => {
      pendingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPreviewUrls]);

  const combinedImages = useMemo(
    () => [
      ...images.map((url) => ({ kind: "uploaded" as const, url })),
      ...pendingFiles.map((file, index) => ({
        kind: "pending" as const,
        file,
        previewUrl: pendingPreviewUrls[index],
      })),
    ],
    [images, pendingFiles, pendingPreviewUrls]
  );

  const syncCombinedImages = useCallback(
    (
      entries: Array<
        | { kind: "uploaded"; url: string }
        | { kind: "pending"; file: File; previewUrl: string }
      >
    ) => {
      onChange(entries.filter((entry) => entry.kind === "uploaded").map((entry) => entry.url));
      onPendingFilesChange(entries.filter((entry) => entry.kind === "pending").map((entry) => entry.file));
    },
    [onChange, onPendingFilesChange]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      if (disabled) return;

      const remaining = maxImages - combinedImages.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      const toQueue = files.slice(0, remaining);
      if (files.length > remaining) {
        toast.warning(`Only ${remaining} more image(s) can be added`);
      }

      const validFiles: File[] = [];
      for (const file of toQueue) {
        if (!file.type.startsWith("image/")) {
          toast.error(`Skipped non-image file: ${file.name}`);
          continue;
        }

        if (file.size > maxBytes) {
          toast.error(`Skipped ${file.name}: exceeds ${maxSizeMB}MB`);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        return;
      }

      onPendingFilesChange([...pendingFiles, ...validFiles]);
      toast.success(`${validFiles.length} image(s) queued for background upload`);
    },
    [disabled, maxImages, combinedImages.length, maxBytes, maxSizeMB, pendingFiles, onPendingFilesChange]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(f =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(f =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) handleFiles(files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeImage = useCallback((index: number) => {
    const reordered = combinedImages.filter((_, i) => i !== index);
    syncCombinedImages(reordered);
  }, [combinedImages, syncCombinedImages]);

  const setPrimary = useCallback(
    (index: number) => {
      if (index === 0) return;
      const reordered = [...combinedImages];
      const [moved] = reordered.splice(index, 1);
      reordered.unshift(moved);
      syncCombinedImages(reordered);
      toast.success("Primary image updated");
    },
    [combinedImages, syncCombinedImages]
  );

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        onDragOver={e => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
          isDragging
            ? "border-gold bg-gold/5 scale-[1.01]"
            : "border-input hover:border-gold/40 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {isDragging
            ? "Drop images here..."
            : "Drag & drop images or click to browse"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Folder: {folder} · PNG, JPG, WebP, GIF · up to {maxSizeMB}MB each · {combinedImages.length}/{maxImages} selected
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Compression (~90 quality) and upload happen in background after save.
        </p>
      </div>

      {/* Selected images (uploaded + queued) */}
      {combinedImages.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {combinedImages.map((entry, i) => {
            const src = entry.kind === "uploaded" ? entry.url : entry.previewUrl;
            const key = entry.kind === "uploaded"
              ? `uploaded-${entry.url}-${i}`
              : `pending-${entry.file.name}-${entry.file.lastModified}-${i}`;

            return (
            <div key={key} className="relative group">
              <img
                src={src}
                alt={`Image ${i + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
              {entry.kind === "pending" && (
                <span className="absolute top-0.5 left-0.5 inline-flex items-center gap-1 text-[8px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                  <Clock3 className="w-2.5 h-2.5" />
                  Queued
                </span>
              )}
              {/* Primary badge */}
              {i === 0 && (
                <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-gold text-gold-foreground px-1 rounded font-medium">
                  Primary
                </span>
              )}
              {/* Set as primary button */}
              {i !== 0 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setPrimary(i);
                  }}
                  className="absolute bottom-0.5 left-0.5 p-0.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Set as primary"
                >
                  <Star className="w-3 h-3" />
                </button>
              )}
              {/* Remove button */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  removeImage(i);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
