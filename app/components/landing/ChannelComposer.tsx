"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { Smartphone, Mail, MessageSquare, Send, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";

type ChannelKey = "email" | "sms" | "whatsapp";
type SendStatus = "idle" | "preparing" | "sending" | "delivered";

const CHANNEL_TABS: { key: ChannelKey; label: string; sub: string; Icon: typeof Smartphone }[] = [
  { key: "email", label: "Email", sub: "Full context, inbox delivery", Icon: Mail },
  { key: "sms", label: "SMS", sub: "Short, timely updates", Icon: Smartphone },
  { key: "whatsapp", label: "WhatsApp", sub: "Direct, familiar reach", Icon: MessageSquare },
];

const SUBJECT = "Early release today at 12:30 PM";
const BODY =
  "Due to weather, dismissal will begin at 12:30 PM. After-school activities are cancelled.";

const TO: Record<ChannelKey, string> = {
  email: "All Families",
  sms: "All Families",
  whatsapp: "Parents",
};

export function ChannelComposer() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<ChannelKey>("email");
  const [status, setStatus] = useState<SendStatus>("idle");
  // Always show the finished message by default — never blank — and only
  // replay the typing effect once the section first enters view, or again
  // whenever the active channel changes.
  const [typedSubject, setTypedSubject] = useState(SUBJECT);
  const [typedBody, setTypedBody] = useState(BODY);
  const [autoplay, setAutoplay] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playedForRef = useRef<ChannelKey | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inView = useInView(panelRef, { once: true, margin: "-80px" });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  // Replay the typing effect the first time the composer scrolls into view,
  // and again every time the active channel changes — otherwise the finished
  // message stays visible, so the section is never caught blank.
  useEffect(() => {
    if (!inView || reduceMotion) return;
    if (playedForRef.current === active) return;
    playedForRef.current = active;

    clearTimers();
    setTypedSubject("");
    setTypedBody("");

    let i = 0;
    const typeSubject = () => {
      if (i > SUBJECT.length) {
        i = 0;
        timers.current.push(setTimeout(typeBody, 260));
        return;
      }
      setTypedSubject(SUBJECT.slice(0, i));
      i += 1;
      timers.current.push(setTimeout(typeSubject, 22));
    };
    const typeBody = () => {
      if (i > BODY.length) {
        return;
      }
      setTypedBody(BODY.slice(0, i));
      i += 1;
      timers.current.push(setTimeout(typeBody, 16));
    };
    const start = setTimeout(typeSubject, 300);
    timers.current.push(start);
    return clearTimers;
  }, [inView, reduceMotion, active]);

  // Gently auto-cycle the channel tabs to show them "switching lightly."
  useEffect(() => {
    if (!inView || reduceMotion || !autoplay) return;
    const interval = setInterval(() => {
      setActive((cur) => {
        const idx = CHANNEL_TABS.findIndex((t) => t.key === cur);
        return CHANNEL_TABS[(idx + 1) % CHANNEL_TABS.length].key;
      });
    }, 2600);
    return () => clearInterval(interval);
  }, [inView, reduceMotion, autoplay]);

  function selectChannel(key: ChannelKey) {
    setAutoplay(false);
    setActive(key);
  }

  function handleSend() {
    if (status === "preparing" || status === "sending") return;
    setAutoplay(false);
    clearTimers();
    setStatus("preparing");
    timers.current.push(
      setTimeout(() => setStatus("sending"), 500),
      setTimeout(() => setStatus("delivered"), 1250)
    );
  }

  function handleReplay() {
    clearTimers();
    setStatus("idle");
    const t = setTimeout(() => handleSend(), 50);
    timers.current.push(t);
  }

  const isEmail = active === "email";

  return (
    <div ref={panelRef} className="rounded-2xl border border-border bg-surface shadow-[0_8px_48px_rgba(20,40,90,0.10)] overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
        {/* Channel tabs */}
        <div
          role="tablist"
          aria-label="Message channel"
          className="flex sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-border-subtle bg-surface-2"
        >
          {CHANNEL_TABS.map(({ key, label, sub, Icon }) => {
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`composer-tab-${key}`}
                aria-selected={isActive}
                aria-controls="composer-panel"
                aria-label={label}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectChannel(key)}
                onKeyDown={(e) => {
                  const idx = CHANNEL_TABS.findIndex((t) => t.key === key);
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    selectChannel(CHANNEL_TABS[(idx + 1) % CHANNEL_TABS.length].key);
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    selectChannel(CHANNEL_TABS[(idx - 1 + CHANNEL_TABS.length) % CHANNEL_TABS.length].key);
                  }
                }}
                className={[
                  "relative min-w-0 flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-0 sm:gap-3 rounded-xl px-2 sm:px-3.5 py-3 text-left transition-colors min-h-[44px] overflow-hidden",
                  isActive ? "bg-surface shadow-sm border border-border" : "border border-transparent hover:bg-surface/60",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-accent text-accent-fg" : "bg-surface text-text-muted border border-border",
                  ].join(" ")}
                >
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <span className="hidden sm:block min-w-0">
                  <span className="block text-[13px] font-medium text-text-primary truncate">{label}</span>
                  <span className="block text-[11px] text-text-muted truncate">{sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview panel */}
        <div
          id="composer-panel"
          role="tabpanel"
          aria-labelledby={`composer-tab-${active}`}
          className="min-w-0 p-5 sm:p-6 flex flex-col"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-text-muted mb-4">
            <span>
              To <span className="font-medium text-text-secondary">{TO[active]}</span>
            </span>
            <span className="hidden sm:inline">Preview only — no messages are sent</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
            >
              {isEmail && (
                <p className="text-[15px] font-semibold text-text-primary mb-1.5 min-h-[1.2em]">
                  {typedSubject}
                  <Caret show={typedSubject.length < SUBJECT.length && inView} />
                </p>
              )}
              <p className="text-[14px] text-text-secondary leading-relaxed min-h-[3.2em]">
                {typedBody}
                <Caret show={typedBody.length < BODY.length && typedSubject.length === SUBJECT.length && inView} />
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 pt-4 border-t border-border-subtle flex items-center justify-between gap-3 flex-wrap">
            <SendStatusLabel status={status} />
            <div className="flex items-center gap-2">
              {status === "delivered" && (
                <button
                  type="button"
                  onClick={handleReplay}
                  className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-border px-3 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:border-accent-border transition-colors"
                >
                  <RotateCcw size={13} strokeWidth={1.75} />
                  Replay
                </button>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={status === "preparing" || status === "sending"}
                className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-60 transition-colors"
              >
                {status === "preparing" || status === "sending" ? (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Send size={14} strokeWidth={2} />
                )}
                Send preview
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="sm:hidden px-5 pb-4 text-[11px] text-text-muted">Preview only — no messages are sent</p>
    </div>
  );
}

function Caret({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="inline-block w-[2px] h-[1em] bg-accent ml-0.5 align-middle animate-pulse" aria-hidden="true" />;
}

function SendStatusLabel({ status }: { status: SendStatus }) {
  if (status === "idle") return <span className="text-[12px] text-text-muted">Ready to send</span>;
  if (status === "preparing") return <span className="text-[12px] text-text-muted">Preparing…</span>;
  if (status === "sending") return <span className="text-[12px] text-text-muted">Sending…</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
      <CheckCircle2 size={13} strokeWidth={2} />
      Delivered
    </span>
  );
}
