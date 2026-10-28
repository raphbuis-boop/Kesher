"use client";

import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

/**
 * Tiny toast system (no dependency). Call toast.success("Saved") or
 * toast.error("…") from any client component; <Toaster /> in the root
 * layout renders them bottom-right and dismisses after a few seconds.
 */

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: ToastKind, message: string) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, kind, message }];
  emit();
  setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

const EMPTY: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[10000] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-card px-3.5 py-3 text-[12.5px] text-ink shadow-pop"
        >
          {t.kind === "success" ? (
            <CheckCircle2 size={15} strokeWidth={2} className="mt-px shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle size={15} strokeWidth={2} className="mt-px shrink-0 text-red-500" />
          )}
          <p className="flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="-m-1 rounded p-1 text-ink-3 hover:bg-muted hover:text-ink"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Fires a toast when a useActionState result changes. Pass the state object
 * returned by the action; `success`/`error` pick the message from it.
 */
export function useActionToast<S>(
  state: S,
  pick: (s: S) => { success?: string | null; error?: string | null }
) {
  const prev = useRef(state);
  const notify = useEffectEvent((s: S) => {
    const { success, error } = pick(s);
    if (error) toast.error(error);
    else if (success) toast.success(success);
  });
  useEffect(() => {
    if (state === prev.current) return;
    prev.current = state;
    notify(state);
  }, [state]);
}
