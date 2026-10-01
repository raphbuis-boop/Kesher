"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileCheck2, AlertCircle, X, RotateCcw } from "lucide-react";

/**
 * Frosted "liquid glass" file dropzone with a sweeping sheen on drag-over and
 * while uploading, a progress bar, a success state (name, size, remove) and a
 * clear error state for wrong type / too large. Styles live in globals.css
 * (.glass-drop*). Honours prefers-reduced-motion.
 */

export type UploadedFile = { name: string; size: number };

type Phase =
  | { kind: "idle" }
  | { kind: "dragging" }
  | { kind: "uploading"; name: string; size: number; progress: number }
  | { kind: "success"; file: UploadedFile }
  | { kind: "error"; message: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GlassDropzone({
  accept,
  acceptLabel,
  isAccepted,
  maxBytes,
  onUpload,
  onRemove,
  initialFile = null,
  title = "Drop a file here, or browse",
  hint,
  compact = false,
  disabled = false,
  resetAfterSuccess,
}: {
  /** <input accept> value, e.g. ".csv,text/csv" or "image/*" */
  accept: string;
  /** Human label for the error message, e.g. "a CSV file" */
  acceptLabel: string;
  isAccepted: (file: File) => boolean;
  maxBytes: number;
  /** Does the work; call onProgress(0–100). Throw an Error to show its message. */
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  /** Shows a remove button in the success state */
  onRemove?: () => void | Promise<void>;
  /** Already-uploaded file to show in the success state */
  initialFile?: UploadedFile | null;
  title?: string;
  hint?: React.ReactNode;
  compact?: boolean;
  disabled?: boolean;
  /** For multi-file zones: return to idle this many ms after a success */
  resetAfterSuccess?: number;
}) {
  const [phase, setPhase] = useState<Phase>(initialFile ? { kind: "success", file: initialFile } : { kind: "idle" });
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const beforeDrag = useRef<Phase>({ kind: "idle" });
  const busy = phase.kind === "uploading" || disabled;

  async function handleFile(file: File) {
    if (!isAccepted(file)) {
      setPhase({ kind: "error", message: `“${file.name}” isn't supported. Please choose ${acceptLabel}.` });
      return;
    }
    if (file.size > maxBytes) {
      setPhase({ kind: "error", message: `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.` });
      return;
    }
    setPhase({ kind: "uploading", name: file.name, size: file.size, progress: 0 });
    try {
      await onUpload(file, (pct) =>
        setPhase((p) => (p.kind === "uploading" ? { ...p, progress: Math.max(p.progress, Math.min(100, pct)) } : p))
      );
      setPhase({ kind: "success", file: { name: file.name, size: file.size } });
      if (resetAfterSuccess) {
        setTimeout(() => setPhase((p) => (p.kind === "success" ? { kind: "idle" } : p)), resetAfterSuccess);
      }
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Upload failed. Please try again." });
    }
  }

  async function handleRemove() {
    if (!onRemove) return setPhase({ kind: "idle" });
    setRemoving(true);
    try {
      await onRemove();
      setPhase({ kind: "idle" });
    } finally {
      setRemoving(false);
    }
  }

  const openPicker = () => {
    if (!busy) inputRef.current?.click();
  };

  const interactive = phase.kind === "idle" || phase.kind === "dragging" || phase.kind === "error";
  const state = phase.kind;

  return (
    <div className="glass-drop-wrap">
      <div
        className={`glass-drop ${compact ? "px-5 py-6" : "px-8 py-10"} ${interactive && !busy ? "cursor-pointer" : ""}`}
        data-state={state}
        role={interactive ? "button" : undefined}
        tabIndex={interactive && !busy ? 0 : undefined}
        aria-label={interactive ? `${title}. ${acceptLabel}, up to ${formatBytes(maxBytes)}.` : undefined}
        aria-disabled={busy || undefined}
        onClick={interactive ? openPicker : undefined}
        onKeyDown={(e) => {
          if (interactive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (busy) return;
          dragDepth.current += 1;
          if (phase.kind !== "dragging") beforeDrag.current = phase;
          setPhase({ kind: "dragging" });
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0 && phase.kind === "dragging") setPhase(beforeDrag.current);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          if (busy) return;
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
          else setPhase(beforeDrag.current);
        }}
      >
        <div aria-live="polite" className="relative z-[1]">
          {(phase.kind === "idle" || phase.kind === "dragging") && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line/70 bg-card/70 shadow-card">
                <UploadCloud size={18} strokeWidth={1.75} className={phase.kind === "dragging" ? "text-brand" : "text-ink-3"} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {phase.kind === "dragging" ? "Release to upload" : title}
                </p>
                {hint && <p className="mt-1 text-[12px] text-ink-3">{hint}</p>}
              </div>
            </div>
          )}

          {phase.kind === "uploading" && (
            <div className="mx-auto max-w-sm space-y-2.5">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate font-medium text-ink">{phase.name}</span>
                <span className="shrink-0 tabular-nums text-ink-3">{Math.round(phase.progress)}%</span>
              </div>
              <div
                className="glass-progress"
                role="progressbar"
                aria-label={`Uploading ${phase.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(phase.progress)}
              >
                <span style={{ width: `${Math.max(4, phase.progress)}%` }} />
              </div>
              <p className="text-[11px] text-ink-3">{formatBytes(phase.size)} · Uploading…</p>
            </div>
          )}

          {phase.kind === "success" && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                <FileCheck2 size={17} strokeWidth={1.75} className="text-emerald-600 [[data-theme=dark]_&]:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{phase.file.name}</p>
                <p className="text-[11px] text-ink-3">{phase.file.size > 0 ? `${formatBytes(phase.file.size)} · ` : ""}Uploaded</p>
              </div>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing || disabled}
                aria-label={`Remove ${phase.file.name}`}
                className="btn btn-secondary btn-sm"
              >
                {removing ? <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" /> : <X size={12} strokeWidth={2} />}
                Remove
              </button>
            </div>
          )}

          {phase.kind === "error" && (
            <div className="flex flex-col items-center gap-2.5 text-center" role="alert">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
                <AlertCircle size={18} strokeWidth={1.75} className="text-red-500" />
              </div>
              <p className="max-w-sm text-[12.5px] font-medium text-red-600 [[data-theme=dark]_&]:text-red-400">{phase.message}</p>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
                <RotateCcw size={11} strokeWidth={2} /> Click or drop another file to try again
              </span>
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** POSTs a FormData with real upload progress (fetch can't report upload progress). */
export function postWithProgress<T>(url: string, body: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 95);
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(data as T);
      } else {
        const msg = (data as { error?: string } | null)?.error;
        reject(new Error(msg || "Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and try again."));
    xhr.send(body);
  });
}
