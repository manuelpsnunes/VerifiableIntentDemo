import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FlowEvent } from "../types";
import { getSpecRef } from "../specRefs";
import { NARRATIVES } from "../narratives";
import { getTermsForAction } from "../glossary";
import { DocumentedJsonView } from "./DocumentedJsonView";

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

              {/* Wire-format breakdown: shows the on-the-wire compact
                  serialization with each base64url segment color-coded, plus
                  the ECDSA signing formula. Only rendered when the event
                  payload carries one or more serialized SD-JWTs. */}
              {event && <WireFormatPanel payload={event.payload} />}

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
                  <div className="flex-1 overflow-auto p-5 min-h-0 space-y-5">
                    {/* SECTION 1 — The actual wire payload.
                        Only the serialized credential string(s) are what
                        really travel between roles. Everything else in the
                        event is decoration the demo added for inspection. */}
                    {(() => {
                      const wire = buildWirePayload(event.payload);
                      if (!wire) return null;
                      const wireJson = JSON.stringify(wire, null, 2);
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2 sticky top-0 bg-[#0b1020] pb-2 -mt-1 pt-1 z-10">
                            <div className="flex items-baseline gap-2">
                              <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                                The actual wire payload
                              </div>
                              <div className="text-[10px] text-[#4f5a7e]">
                                what really travels between roles
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                try { navigator.clipboard.writeText(wireJson); } catch { /* ignore */ }
                              }}
                              className="text-[10px] text-[#7b87a8] hover:text-white border border-[#1f2a4a] hover:border-[#2c3a66] rounded px-2 py-0.5"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.03] p-3 text-[11px] font-mono text-[#d4dcf0] leading-relaxed overflow-auto whitespace-pre-wrap break-all">
{wireJson}
                          </pre>
                          <div className="mt-2 text-[10px] text-[#7b87a8] leading-snug">
                            In production this is roughly the entire HTTPS response body
                            (wrapped in an OpenID4VCI envelope like
                            <code className="text-[#7aa2ff]"> {`{ "format": "vc+sd-jwt", "credential": "..." }`}</code>).
                            The receiver decodes and verifies it locally.
                          </div>
                        </div>
                      );
                    })()}

                    {/* SECTION 2 — Pre-decoded inspection view.
                        Everything the demo added to make the credential's
                        internals (header, payload, disclosures, resolved
                        claims) visible without parsing the SD-JWT yourself. */}
                    <div>
                      <div className="flex items-center justify-between mb-2 sticky top-0 bg-[#0b1020] pb-2 -mt-1 pt-1 z-10">
                        <div className="flex items-baseline gap-2">
                          <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold">
                            Pre-decoded — for inspection & learning
                          </div>
                          <div className="text-[10px] text-[#4f5a7e]">
                            not transmitted; demo-side only
                          </div>
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
                      <DocumentedJsonView data={event.payload ?? {}} />
                      <div className="mt-2 text-[10px] text-[#7b87a8] leading-snug">
                        Hover any key for its spec definition. Fields like <code className="text-[#7aa2ff]">header</code>,
                        <code className="text-[#7aa2ff]"> payload</code>,
                        <code className="text-[#7aa2ff]"> resolved</code>, and
                        <code className="text-[#7aa2ff]"> disclosures</code> are
                        derived from the wire payload above — the receiver would
                        compute them locally after verifying the signature.
                      </div>
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

// ---------------------------------------------------------------------------
// Wire-format breakdown panel
// ---------------------------------------------------------------------------
// Surfaces the on-the-wire compact serialization of any signed credential in
// the current event payload, with each base64url segment color-coded to its
// role (header / payload / signature / disclosure). Also includes the ECDSA
// signing formula so readers can connect the visible bytes to the math that
// produced the signature.
//
// Probes the payload for known credential shapes used by the orchestrator:
//   - L1 / L2:                payload.credential.serialized
//   - checkout_jwt_signed:    payload.serialized
//   - l3_built:               payload.l3a.serialized, payload.l3b.serialized

interface WireFormatPanelProps {
  payload: any;
}

interface SerializedCandidate {
  label: string;
  serialized: string;
}

const SEG_COLOR = {
  header: "#7aa2ff",
  payload: "#34d399",
  signature: "#f472b6",
  disclosure: "#facc15",
} as const;

function decomposeSerialized(serialized?: string): {
  header: string;
  payload: string;
  signature: string;
  disclosures: string[];
} | null {
  if (!serialized) return null;
  const trimmed = serialized.endsWith("~") ? serialized.slice(0, -1) : serialized;
  const tildeParts = trimmed.split("~");
  const jwt = tildeParts[0] ?? "";
  const disclosures = tildeParts.slice(1).filter(Boolean);
  const dotParts = jwt.split(".");
  if (dotParts.length !== 3) return null;
  return {
    header: dotParts[0],
    payload: dotParts[1],
    signature: dotParts[2],
    disclosures,
  };
}

function collectSerialized(payload: any): SerializedCandidate[] {
  if (!payload) return [];
  const out: SerializedCandidate[] = [];
  // L1 / L2 credentials wrapped as { credential: { serialized, ... } }.
  if (typeof payload.credential?.serialized === "string") {
    const layer = typeof payload.credential_layer === "string"
      ? payload.credential_layer
      : "credential";
    out.push({ label: layer, serialized: payload.credential.serialized });
  }
  // Merchant-signed checkout JWT lives at the top level for that event.
  if (typeof payload.serialized === "string" && !payload.credential) {
    out.push({ label: "checkout_jwt", serialized: payload.serialized });
  }
  // Split L3 — two siblings, surface both side by side.
  if (typeof payload.l3a?.serialized === "string") {
    out.push({ label: "L3a (payment → network)", serialized: payload.l3a.serialized });
  }
  if (typeof payload.l3b?.serialized === "string") {
    out.push({ label: "L3b (checkout → merchant)", serialized: payload.l3b.serialized });
  }
  return out;
}

/**
 * Build a minimal "wire payload" view by stripping the event of demo-only
 * decoration (decoded headers/payloads/disclosures, transport hints, UI labels)
 * and keeping only the actual signed credential string(s) that would travel
 * over the wire in production. Returns null when the event has no signed
 * credential (e.g. system events like demo_started or enrollment).
 */
function buildWirePayload(payload: any): Record<string, unknown> | null {
  const candidates = collectSerialized(payload);
  if (candidates.length === 0) return null;
  // For single-credential events use the OpenID4VCI-style envelope shape.
  // For multi-credential events (e.g. l3_built emits L3a + L3b) use an object
  // keyed by the credential label so each one is individually visible.
  if (candidates.length === 1) {
    return {
      format: "vc+sd-jwt",
      credential: candidates[0].serialized,
    };
  }
  const out: Record<string, unknown> = {};
  for (const c of candidates) {
    out[c.label] = { format: "vc+sd-jwt", credential: c.serialized };
  }
  return out;
}

function shortSeg(s: string, max = 14): string {
  return s.length > max + 1 ? `${s.slice(0, max)}…` : s;
}

function WireFormatPanel({ payload }: WireFormatPanelProps) {
  const candidates = collectSerialized(payload);
  if (candidates.length === 0) return null;

  return (
    <div className="px-5 py-3 border-b border-[#1f2a4a] bg-[#0a0f25]">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold">
          Wire format & signature
        </div>
        <div className="text-[10px] text-[#4f5a7e]">
          What actually travels over the wire
        </div>
      </div>

      <div className="space-y-3">
        {candidates.map((c, idx) => {
          const d = decomposeSerialized(c.serialized);
          if (!d) return null;
          return (
            <div key={idx} className="rounded-md border border-[#1f2a4a] bg-[#0b1020] p-2.5">
              {candidates.length > 1 && (
                <div className="text-[10px] uppercase tracking-wider text-[#7aa2ff] font-mono font-semibold mb-1.5">
                  {c.label}
                </div>
              )}

              {/* Color-coded compact serialization */}
              <div className="text-[10px] font-mono leading-snug flex flex-wrap items-baseline">
                <span
                  className="px-1 rounded break-all"
                  style={{ background: SEG_COLOR.header + "18", color: SEG_COLOR.header }}
                  title={`HEADER · ${d.header.length} chars base64url`}
                >
                  {shortSeg(d.header)}
                </span>
                <span className="text-[#7b87a8] mx-0.5">.</span>
                <span
                  className="px-1 rounded break-all"
                  style={{ background: SEG_COLOR.payload + "18", color: SEG_COLOR.payload }}
                  title={`PAYLOAD · ${d.payload.length} chars base64url`}
                >
                  {shortSeg(d.payload)}
                </span>
                <span className="text-[#7b87a8] mx-0.5">.</span>
                <span
                  className="px-1 rounded break-all"
                  style={{ background: SEG_COLOR.signature + "18", color: SEG_COLOR.signature }}
                  title={`SIGNATURE · ${d.signature.length} chars base64url (64-byte ECDSA r‖s)`}
                >
                  {shortSeg(d.signature)}
                </span>
                {d.disclosures.map((disc, i) => (
                  <span key={i} className="flex items-baseline">
                    <span className="text-[#7b87a8] mx-0.5">~</span>
                    <span
                      className="px-1 rounded break-all"
                      style={{ background: SEG_COLOR.disclosure + "18", color: SEG_COLOR.disclosure }}
                      title={`DISCLOSURE #${i + 1} · ${disc.length} chars base64url`}
                    >
                      {shortSeg(disc)}
                    </span>
                  </span>
                ))}
                <span className="text-[#7b87a8] mx-0.5">~</span>
              </div>

              {/* Legend */}
              <div className="mt-2 text-[9px] text-[#4f5a7e] flex flex-wrap gap-x-3 gap-y-0.5">
                <span><span style={{ color: SEG_COLOR.header }}>■</span> header</span>
                <span><span style={{ color: SEG_COLOR.payload }}>■</span> payload</span>
                <span><span style={{ color: SEG_COLOR.signature }}>■</span> signature</span>
                {d.disclosures.length > 0 && (
                  <span><span style={{ color: SEG_COLOR.disclosure }}>■</span> disclosure(s)</span>
                )}
                <span className="text-[#4f5a7e]">
                  all base64url · "." = JWS separator · "~" = SD-JWT disclosure separator
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Signing formula — universal, only shown once even when there are
          multiple credentials, since the math is identical for every signer. */}
      <div className="mt-3 rounded-md border border-pink-500/30 bg-pink-500/5 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-pink-300 mb-1.5 font-semibold">
          How the signature was produced
        </div>
        <div className="font-mono text-[11px] text-[#d4dcf0] leading-snug pl-1">
          <div>
            signature = <span className="text-pink-300">ECDSA_sign</span>(
          </div>
          <div className="pl-4">
            <span className="text-white">private_key</span>,
          </div>
          <div className="pl-4">
            <span className="text-pink-300">SHA-256</span>(
            <span className="text-[#7aa2ff]">b64u(header)</span> + "." + <span className="text-[#34d399]">b64u(payload)</span>
            )
          </div>
          <div>)</div>
        </div>
        <div className="mt-2 text-[10px] text-[#7b87a8] leading-snug">
          Verified against the signer's public key (no shared secret).
          Tamper any byte of <span className="text-[#7aa2ff]">header</span> or
          <span className="text-[#34d399]"> payload</span> → recomputed SHA-256
          differs → ECDSA verification fails.
        </div>
      </div>
    </div>
  );
}
