// ============================================================
// MultiImageUpload — Multiple image upload to S3 with previews
// ============================================================

import { useState, useRef, useCallback, type DragEvent } from "react";
import { useFileUpload, type UploadResult } from "@/hooks/useFileUpload";
import { Upload, X, ImageIcon, Loader2, AlertCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MultiImageUploadProps {
  /** Array of S3 URLs already uploaded */
  images: string[];
  /** Called whenever the image list changes */
  onChange: (urls: string[]) => void;
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
  onChange,
  folder = "perfume-images",
  maxImages = 8,
  maxSizeMB = 10,
  className,
  disabled = false,
}: MultiImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; name: string; preview: string; progress: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading } = useFileUpload({
    folder,
    maxSizeMB,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (disabled) return;
      const remaining = maxImages - images.length;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }
      const toUpload = files.slice(0, remaining);
      if (files.length > remaining) {
        toast.warning(`Only ${remaining} more image(s) can be added`);
      }

      // Create preview entries
      const entries = toUpload.map((file, i) => ({
        id: `${Date.now()}-${i}`,
        name: file.name,
        preview: URL.createObjectURL(file),
        progress: 0,
      }));
      setUploadingFiles(prev => [...prev, ...entries]);

      // Upload each file
      const results: string[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const entry = entries[i];

        setUploadingFiles(prev =>
          prev.map(e => (e.id === entry.id ? { ...e, progress: 30 } : e))
        );

        try {
          const result = await upload(file);
          if (result) {
            results.push(result.url);
            setUploadingFiles(prev =>
              prev.map(e => (e.id === entry.id ? { ...e, progress: 100 } : e))
            );
          }
        } catch (err) {
          toast.error(`Failed to upload ${file.name}`);
        }

        // Remove from uploading list after a brief delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(e => e.id !== entry.id));
          URL.revokeObjectURL(entry.preview);
        }, 500);
      }

      if (results.length > 0) {
        onChange([...images, ...results]);
        toast.success(`${results.length} image(s) uploaded`);
      }
    },
    [disabled, images, maxImages, onChange, upload]
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

  const removeImage = useCallback(
    (index: number) => {
      const updated = images.filter((_, i) => i !== index);
      onChange(updated);
    },
    [images, onChange]
  );

  const setPrimary = useCallback(
    (index: number) => {
      if (index === 0) return;
      const updated = [...images];
      const [moved] = updated.splice(index, 1);
      updated.unshift(moved);
      onChange(updated);
      toast.success("Primary image updated");
    },
    [images, onChange]
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
          PNG, JPG, WebP — up to {maxSizeMB}MB each — {images.length}/{maxImages} uploaded
        </p>
      </div>

      {/* Uploading previews */}
      {uploadingFiles.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {uploadingFiles.map(entry => (
            <div key={entry.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
              <img
                src={entry.preview}
                alt={entry.name}
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-gold animate-spin" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                <div
                  className="h-full bg-gold transition-all duration-300"
                  style={{ width: `${entry.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded images */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="relative group">
              <img
                src={url}
                alt={`Image ${i + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
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
          ))}
        </div>
      )}
    </div>
  );
}
