// ============================================================
// useFileUpload — Hook for uploading files to S3 via /api/upload
// ============================================================

import { useState, useCallback } from "react";

export interface UploadResult {
  url: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface UseFileUploadOptions {
  folder?: string;
  maxSizeMB?: number;
  allowedTypes?: string[];
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    folder = "uploads",
    maxSizeMB = 10,
    allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
    onSuccess,
    onError,
  } = options;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      setError(null);
      setProgress(0);
      setResult(null);

      // Validate file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        const msg = `File type "${file.type}" is not allowed. Accepted: ${allowedTypes.join(", ")}`;
        setError(msg);
        onError?.(msg);
        return null;
      }

      // Validate file size
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        const msg = `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${maxSizeMB}MB`;
        setError(msg);
        onError?.(msg);
        return null;
      }

      setUploading(true);
      setProgress(10);

      try {
        const formData = new FormData();
        formData.append("file", file);

        setProgress(30);

        const response = await fetch(`/api/upload?folder=${encodeURIComponent(folder)}`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        setProgress(80);

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(body.error || `Upload failed (${response.status})`);
        }

        const data: UploadResult = await response.json();
        setResult(data);
        setProgress(100);
        onSuccess?.(data);
        return data;
      } catch (err: any) {
        const msg = err.message || "Upload failed";
        setError(msg);
        onError?.(msg);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [folder, maxSizeMB, allowedTypes, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return { upload, uploading, progress, error, result, reset };
}
