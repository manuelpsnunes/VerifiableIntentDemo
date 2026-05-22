import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { JsonView, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import type { FlowEvent } from "../types";
import { getSpecRef } from "../specRefs";
import { NARRATIVES } from "../narratives";

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
            className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-[#0b1020] border-l border-[#1f2a4a] z-50 flex flex-col shadow-2xl"
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

            {/* Body */}
            <div className="flex-1 overflow-auto">
              {!event && (
                <div className="p-6 text-[#7b87a8] text-sm">
                  Select a step (timeline, credential card, or role history)
                  then re-open the spec drawer to see the governing rule and
                  raw payload.
                </div>
              )}

              {event && spec && (
                <div className="p-5 border-b border-[#1f2a4a]">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#7aa2ff22] text-[#7aa2ff] font-bold">
                      {spec.section}
                    </span>
                    <span className="text-base font-semibold text-white">
                      {spec.title}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#d4dcf0] leading-relaxed mb-3">
                    {spec.paraphrase}
                  </p>
                  <a
                    href={spec.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-[#7aa2ff] hover:text-white underline decoration-dotted underline-offset-2"
                  >
                    Read the full spec section ↗
                  </a>
                </div>
              )}

              {event && narrative && (
                <div className="p-5 border-b border-[#1f2a4a]">
                  <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold mb-1.5">
                    Why this matters
                  </div>
                  <p className="text-[13px] text-[#a4b0d0] leading-relaxed italic">
                    {narrative.why}
                  </p>
                </div>
              )}

              {event && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
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
