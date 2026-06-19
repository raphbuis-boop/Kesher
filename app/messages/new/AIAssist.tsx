"use client";

import { useState, useRef, useEffect } from "react";
import type { ComposeAction } from "@/app/api/ai-compose/route";

type ActionResult =
  | { type: "draft"; subject: string; body: string }
  | { type: "body"; body: string }
  | { type: "subject_lines"; subjectLines: string[] };

type Props = {
  audienceLabel: string;
  currentSubject: string;
  currentBody: string;
  onApplyDraft: (subject: string, body: string) => void;
  onApplyBody: (body: string) => void;
  onApplySubject: (subject: string) => void;
};

type ActionDef = {
  action: ComposeAction;
  label: string;
  icon: React.ReactNode;
  requiresContent: boolean;
  requiresPrompt: boolean;
};

const SparkleIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
  </svg>
);

const ACTIONS: ActionDef[] = [
  { action: "rewrite_professional", label: "Rewrite Professionally", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
  { action: "rewrite_warm", label: "Rewrite Warmly", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
  { action: "rewrite_shorter", label: "Rewrite Shorter", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
  { action: "sms", label: "Generate SMS Version", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
  { action: "whatsapp", label: "Generate WhatsApp Version", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
  { action: "translate", label: "Translate English ↔ Hebrew", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
  { action: "subject_lines", label: "Generate Subject Lines", icon: <SparkleIcon />, requiresContent: true, requiresPrompt: false },
];

export function AIAssist({
  audienceLabel,
  currentSubject,
  currentBody,
  onApplyDraft,
  onApplyBody,
  onApplySubject,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [activeAction, setActiveAction] = useState<ComposeAction | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && promptRef.current) {
      promptRef.current.focus();
    }
  }, [open]);

  // Clear result when opening fresh
  function handleOpen() {
    setOpen(true);
    setResult(null);
    setError(null);
    setActiveAction(null);
  }

  async function runAction(action: ComposeAction, prompt?: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveAction(action);

    try {
      const res = await fetch("/api/ai-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subject: currentSubject,
          body: currentBody,
          prompt: prompt ?? "",
          audienceLabel,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult(data as ActionResult);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const hasContent = currentSubject.trim().length > 0 || currentBody.trim().length > 0;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
      >
        <SparkleIcon />
        AI Assist
      </button>

      {/* Panel overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-start sm:pt-24 sm:pr-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 flex w-full flex-col rounded-t-xl border border-zinc-200 bg-white shadow-xl sm:w-96 sm:rounded-xl"
            style={{ maxHeight: "80vh" }}>
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-600">
                  <SparkleIcon />
                </div>
                <span className="text-sm font-semibold text-zinc-900">AI Assist</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Draft from prompt */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Draft Message
                </p>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <textarea
                    ref={promptRef}
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    placeholder={`e.g. "Remind parents about the Shabbaton this Friday"`}
                    rows={3}
                    className="w-full resize-none bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draftPrompt.trim()) {
                        runAction("draft", draftPrompt.trim());
                      }
                    }}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => runAction("draft", draftPrompt.trim())}
                      disabled={!draftPrompt.trim() || loading}
                      className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading && activeAction === "draft" ? (
                        <>
                          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Drafting…
                        </>
                      ) : (
                        <>
                          <SparkleIcon />
                          Draft
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions on existing content */}
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Edit Current Message
                </p>
                <div className="space-y-1">
                  {ACTIONS.map((a) => {
                    const disabled = !hasContent || (loading && activeAction !== a.action);
                    const isLoading = loading && activeAction === a.action;
                    return (
                      <button
                        key={a.action}
                        type="button"
                        onClick={() => runAction(a.action)}
                        disabled={disabled || isLoading || !hasContent}
                        className={
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                          (!hasContent
                            ? "text-zinc-300"
                            : "text-zinc-700 hover:bg-zinc-50")
                        }
                      >
                        {isLoading ? (
                          <svg className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        ) : (
                          <span className="flex-shrink-0 text-violet-400">{a.icon}</span>
                        )}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                {!hasContent && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Write a subject or message first to use these options.
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              {/* Result */}
              {result && !loading && (
                <div className="rounded-lg border border-violet-200 bg-violet-50">
                  <div className="border-b border-violet-100 px-3 py-2">
                    <p className="text-xs font-medium text-violet-700">
                      {result.type === "subject_lines" ? "Suggested subject lines" : "AI suggestion"}
                    </p>
                  </div>

                  {result.type === "draft" && (
                    <div className="px-3 py-3">
                      <div className="mb-2">
                        <p className="mb-0.5 text-xs font-medium text-zinc-500">Subject</p>
                        <p className="text-sm text-zinc-900">{result.subject}</p>
                      </div>
                      <div className="mb-3">
                        <p className="mb-0.5 text-xs font-medium text-zinc-500">Body</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                          {result.body}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyDraft(result.subject, result.body);
                          setOpen(false);
                        }}
                        className="w-full rounded-md bg-violet-600 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700"
                      >
                        Use this draft
                      </button>
                    </div>
                  )}

                  {result.type === "body" && (
                    <div className="px-3 py-3">
                      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                        {result.body}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyBody(result.body);
                          setOpen(false);
                        }}
                        className="w-full rounded-md bg-violet-600 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700"
                      >
                        Replace message body
                      </button>
                    </div>
                  )}

                  {result.type === "subject_lines" && (
                    <div className="px-3 py-3">
                      <div className="mb-1 space-y-1">
                        {result.subjectLines.map((line, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              onApplySubject(line);
                              setOpen(false);
                            }}
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-800 transition-colors hover:bg-violet-100"
                          >
                            <span className="mt-0.5 flex-shrink-0 text-violet-400">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                              </svg>
                            </span>
                            {line}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
