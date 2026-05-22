import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { JsonView, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import type { FlowEvent } from "../types";
import { getSpecRef } from "../specRefs";
import { NARRATIVES } from "../narratives";
import { getTermsForAction } from "../glossary";

interface Props {
  open: boolean;
  onClose: () => void;
  event: FlowEvent | null;
}

export function SpecDrawer({ open, onClose, event }: Props) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const spec = event ? getSpecRef(event.action) : null;
  const narrative = event ? NARRATIVES[event.action] : null;
  const terms = event ? getTermsForAction(event.action) : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-[1100px] bg-[#0b1020] border-l border-[#1f2a4a] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between px-5 py-3 border-b border-[#1f2a4a] bg-[#0e1530]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold">
                  Spec drawer
                </div>
                <div className="text-sm font-semibold text-white">
                  {event ? `Step #${event.step} · ${event.action}` : "No step selected"}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-[#7b87a8] hover:text-white text-xl leading-none px-2"
                title="Close (Esc)"
              >
                ×
              </button>
            </header>

            {/* Body: slim context strip on top, then a two-column scroll area
                with the glossary on the left and the raw payload on the right.
                Each column scrolls independently so the user can keep the JSON
                in view while glancing at a term definition. Below the `lg`
                breakpoint (1024 px) the columns stack vertically. */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {!event && (
                <div className="p-6 text-[#7b87a8] text-sm">
                  Select a step (timeline, credential card, or role history)
                  then re-open the spec drawer to see the governing rule and
                  raw payload.
                </div>
              )}

              {/* Top context strip: spec ref + why-this-matters (always compact) */}
              {event && (spec || narrative) && (
                <div className="px-5 py-3 border-b border-[#1f2a4a] bg-[#0e1530]">
                  {spec && (
                    <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mb-1.5">
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#7aa2ff22] text-[#7aa2ff] font-bold">
                        {spec.section}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {spec.title}
                      </span>
                      <a
                        href={spec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[11px] text-[#7aa2ff] hover:text-white underline decoration-dotted underline-offset-2"
                      >
                        Read full spec ↗
                      </a>
                    </div>
                  )}
                  {spec && (
                    <p className="text-[12px] text-[#a4b0d0] leading-snug mb-1.5">
                      {spec.paraphrase}
                    </p>
                  )}
                  {narrative && (
                    <p className="text-[12px] text-[#7b87a8] leading-snug italic">
                      <span className="not-italic text-[#7b87a8] uppercase tracking-wider text-[9px] font-semibold mr-1.5">
                        Why
                      </span>
                      {narrative.why}
                    </p>
                  )}
                </div>
              )}

              {/* Two-column scroll area */}
              {event && (
                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
                  {/* LEFT: Glossary (only when there are terms to show) */}
                  {terms.length > 0 && (
                    <div className="lg:w-[40%] lg:border-r border-b lg:border-b-0 border-[#1f2a4a] overflow-auto p-5 max-h-[40vh] lg:max-h-none">
                      <div className="flex items-baseline justify-between mb-3 sticky top-0 bg-[#0b1020] pb-2 -mt-1 pt-1">
                        <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold">
                          Terms in play here
                        </div>
                        <div className="text-[10px] text-[#4f5a7e]">
                          {terms.length} {terms.length === 1 ? "term" : "terms"}
                        </div>
                      </div>
                      <ul className="space-y-2.5">
                        {terms.map((t) => (
                          <li
                            key={t.id}
                            className="rounded-md border border-[#1f2a4a] bg-[#0e1530] px-3 py-2"
                          >
                            <div className="text-[13px] font-mono font-semibold text-[#7aa2ff] mb-1">
                              {t.label}
                            </div>
                            <p className="text-[12px] text-[#d4dcf0] leading-snug">
                              {t.short}
                            </p>
                            {t.payments_analog && (
                              <p className="mt-1.5 text-[11px] text-[#a4b0d0] leading-snug italic">
                                <span className="not-italic text-[#7b87a8] uppercase tracking-wider text-[9px] font-semibold mr-1.5">
                                  In payments
                                </span>
                                {t.payments_analog}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* RIGHT: Raw payload (full width when no terms) */}
                  <div className="flex-1 overflow-auto p-5 min-h-0">
                    <div className="flex items-center justify-between mb-2 sticky top-0 bg-[#0b1020] pb-2 -mt-1 pt-1 z-10">
                      <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold">
                        Raw event payload
                      </div>
                      <button
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(
                              JSON.stringify(event.payload, null, 2)
                            );
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="text-[10px] text-[#7b87a8] hover:text-white border border-[#1f2a4a] hover:border-[#2c3a66] rounded px-2 py-0.5"
                      >
                        Copy JSON
                      </button>
                    </div>
                    <div className="json-viewer rounded-md border border-[#1f2a4a] bg-[#0b1020] p-3">
                      <JsonView
                        data={event.payload ?? {}}
                        shouldExpandNode={(level) => level < 2}
                        style={darkStyles}
                      />
                    </div>
                    <div className="mt-3 text-[10px] text-[#4f5a7e]">
                      This is the exact payload the WebSocket bus emitted for this
                      step — what the SDK signed, hashed, or verified.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <footer className="px-5 py-2 border-t border-[#1f2a4a] bg-[#0a0f25] flex items-center justify-between text-[10px] text-[#7b87a8]">
              <span>
                Press <kbd className="px-1 py-0.5 rounded bg-[#1f2a4a] text-[#7aa2ff] font-mono">S</kbd> to toggle ·
                <kbd className="ml-1 px-1 py-0.5 rounded bg-[#1f2a4a] text-[#7aa2ff] font-mono">Esc</kbd> to close
              </span>
              {event && (
                <span className="font-mono text-[10px]">
                  {event.role} · {new Date(event.ts * 1000).toLocaleTimeString()}
                </span>
              )}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
