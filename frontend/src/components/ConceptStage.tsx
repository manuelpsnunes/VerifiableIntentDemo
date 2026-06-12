import { useMemo, useState } from "react";
import type { FlowEvent } from "../types";
import { NARRATIVES } from "../narratives";
import { SdJwtXRay } from "./SdJwtXRay";
import { SplitL2Comparison } from "./SplitL2Comparison";
import { BindingMath, useBindingLines } from "./BindingMath";
import { FailureCompareCard } from "./FailureCompareCard";
import { ConstraintChecks } from "./ConstraintChecks";
import { ROLE_COLOR } from "../roleTheme";

interface Props {
  event: FlowEvent | null;
  totalEvents: number;
  allEvents: FlowEvent[];
  injectionEvent?: FlowEvent | null;
  injectionAllEvents?: FlowEvent[];
  injectionMode?: string | null;
}

// Best-effort: scan SD-JWT disclosures for a nested key (handles arbitrary depth).
function findInDisclosures(
  data: any,
  key: string
): string | undefined {
  if (!data?.disclosures) return undefined;
  for (const d of data.disclosures) {
    const v = d?.value;
    if (v && typeof v === "object") {
      // Disclosure value is { name, ...fields } or just an object.
      if (key in v) return v[key];
      // One level deeper (e.g., disclosure named "final_payment" wraps the obj).
      for (const inner of Object.values(v)) {
        if (inner && typeof inner === "object" && key in (inner as any)) {
          return (inner as any)[key];
        }
      }
    }
  }
  return undefined;
}

// Extract a self-contained binding context from all observed events.
function useBindingContext(allEvents: FlowEvent[]) {
  return useMemo(() => {
    const byAction = new Map<string, FlowEvent>();
    for (const e of allEvents) {
      if (!byAction.has(e.action)) byAction.set(e.action, e);
    }
    const l1 = byAction.get("l1_issued")?.payload as any;
    const l2 = byAction.get("l2_created")?.payload as any;
    const checkout = byAction.get("checkout_jwt_signed")?.payload as any;
    const l3 = byAction.get("l3_built")?.payload as any;
    return {
      l1Serialized: l1?.credential?.serialized,
      l2Serialized: l2?.credential?.serialized,
      l2SdHash: l2?.credential?.payload?.sd_hash,
      l2PaymentSerialized: l3?.l2_payment_view?.serialized,
      l2CheckoutSerialized: l3?.l2_checkout_view?.serialized,
      checkoutJwt: checkout?.checkout_jwt,
      checkoutHashClaimed: checkout?.checkout_hash,
      // transaction_id / checkout_hash live in selectively-disclosed fields,
      // so scan disclosures (and fall back to payload/resolved).
      l3aTransactionId:
        l3?.l3a?.resolved?.final_payment?.transaction_id ??
        l3?.l3a?.payload?.final_payment?.transaction_id ??
        findInDisclosures(l3?.l3a, "transaction_id") ??
        l3?.l3a?.resolved?.transaction_id ??
        l3?.l3a?.payload?.transaction_id,
      l3bCheckoutHash:
        l3?.l3b?.resolved?.final_checkout?.checkout_hash ??
        l3?.l3b?.payload?.final_checkout?.checkout_hash ??
        findInDisclosures(l3?.l3b, "checkout_hash") ??
        l3?.l3b?.resolved?.checkout_hash ??
        l3?.l3b?.payload?.checkout_hash,
    };
  }, [allEvents]);
}

const LAYER_COLOR: Record<string, string> = {
  L1: "#f59e0b",
  L2: "#34d399",
  L3a: "#f472b6",
  L3b: "#c084fc",
};

export function ConceptStage({
  event,
  totalEvents,
  allEvents = [],
  injectionEvent = null,
  injectionAllEvents = [],
  injectionMode = null,
}: Props) {
  const bindingCtx = useBindingContext(allEvents);
  const allBindings = useBindingLines(bindingCtx);
  const injectionBindingCtx = useBindingContext(injectionAllEvents);
  const injectionBindings = useBindingLines(injectionBindingCtx);
  if (!event) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center">
        <div className="text-xs uppercase tracking-wider text-[#7b87a8] mb-2">
          {totalEvents === 0 ? "Concept Stage" : "Select a step"}
        </div>
        <div className="text-base text-[#a4b0d0] max-w-md leading-relaxed">
          {totalEvents === 0
            ? "Click Run Demo or Step mode above. Each step will explain one Verifiable Intent concept here, with the live credential chain forming at the top."
            : "Pick any step from the credential ribbon, timeline, or history strip below to focus on it."}
        </div>
      </div>
    );
  }

  const narrative = NARRATIVES[event.action];
  const color = ROLE_COLOR[event.role] ?? "#7b87a8";

  return (
    <div className="p-6">
      {/* Step header */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
          style={{ background: color + "22", color }}
        >
          #{event.step}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[#7b87a8]">
          {event.role} · {event.action}
        </span>
      </div>

      {/* Learning objective banner */}
      {narrative?.learning_objective && (
        <div className="mb-4 rounded-md border-l-4 px-4 py-3 bg-[#0e1530]"
          style={{ borderLeftColor: color }}>
          <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] mb-1 font-semibold">
            What this step teaches
          </div>
          <div className="text-[15px] text-white leading-snug">
            {narrative.learning_objective}
          </div>
        </div>
      )}

      {/* Narrative */}
      {narrative && (
        <div className="mb-5">
          <div className="text-xl font-semibold text-white mb-2">
            {narrative.title}
          </div>
          <p className="text-[15px] text-[#d4dcf0] leading-relaxed mb-2">
            {narrative.summary}
          </p>
          <p className="text-[13px] text-[#7b87a8] leading-relaxed italic">
            {narrative.why}
          </p>
          <NarrativeLensTabs narrative={narrative} />
        </div>
      )}

      {/* "Look at" hint chips — single inline row, no header. */}
      {narrative?.look_at && narrative.look_at.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[#7b87a8] uppercase tracking-wider text-[10px]">
            Inspect:
          </span>
          {narrative.look_at.map((f) => (
            <code
              key={f}
              className="px-1.5 py-0.5 rounded bg-[#1f2a4a] text-[#7aa2ff] font-mono text-[11px]"
            >
              {f}
            </code>
          ))}
        </div>
      )}

      {/* Per-step visual modules */}
      {injectionEvent && injectionMode && (
        <div className="mt-5">
          <FailureCompareCard
            referenceEvent={event}
            injectionEvent={injectionEvent}
            injectionMode={injectionMode}
          />
        </div>
      )}
      {(() => {
        const p = event.payload as any;
        if (event.action === "l1_issued" && p?.credential) {
          return (
            <div className="mt-5">
              <SdJwtXRay
                data={p.credential}
                title="L1 · Card credential"
                layerColor={LAYER_COLOR.L1}
              />
            </div>
          );
        }
        if (event.action === "l2_created" && p?.credential) {
          // Show binding math: L2.sd_hash should equal SHA-256(L1.serialized)
          const sdHashLines = allBindings.filter(
            (l) => l.label === "L2 binds to L1 (parent integrity)"
          );
          return (
            <div className="mt-5 space-y-4">
              {sdHashLines.length > 0 && (
                <BindingMath
                  lines={sdHashLines}
                  title="Binding math · L2 → L1"
                />
              )}
              <SdJwtXRay
                data={p.credential}
                title="L2 · User mandate"
                layerColor={LAYER_COLOR.L2}
              />
            </div>
          );
        }
        if (event.action === "checkout_jwt_signed") {
          const checkoutLines = allBindings.filter(
            (l) => l.label === "Checkout JWT is the canonical cart anchor"
          );
          if (checkoutLines.length > 0) {
            return (
              <div className="mt-5">
                <BindingMath
                  lines={checkoutLines}
                  title="Binding math · checkout hash"
                />
              </div>
            );
          }
          return null;
        }
        if ((event.action === "merchant_verified" || event.action === "network_verified" || event.action === "authorized" || event.action === "declined") && allBindings.length > 0) {
          // Show all known bindings at verification time; if an injection track is
          // present, render its bindings underneath for side-by-side comparison.
          return (
            <div className="mt-5 space-y-4">
              <BindingMath
                lines={allBindings}
                title="Reference path · all bindings re-checked"
              />
              {injectionBindings.length > 0 && (
                <BindingMath
                  lines={injectionBindings}
                  title="Injection path · same bindings (note any ✗)"
                />
              )}
              <ConstraintChecks
                events={allEvents}
                injectionEvents={injectionAllEvents}
                injectionMode={injectionMode}
              />
            </div>
          );
        }
        if (event.action === "l3_built" && p?.l3a && p?.l3b) {
          // Best-effort full L2 disclosure count = union of the two view sets
          // (disclosure hashes are deterministic so dedupe by hash).
          let fullCount = 0;
          if (p.l2_payment_view?.disclosures && p.l2_checkout_view?.disclosures) {
            const set = new Set<string>();
            for (const d of p.l2_payment_view.disclosures) set.add(d.hash);
            for (const d of p.l2_checkout_view.disclosures) set.add(d.hash);
            fullCount = set.size;
          }
          // Show binding math: transaction_id == checkout_hash cross-reference
          const crossRefLines = allBindings.filter(
            (l) => l.label === "L3a ↔ L3b cross-reference"
          );
          return (
            <div className="mt-5 space-y-4">
              {crossRefLines.length > 0 && (
                <BindingMath
                  lines={crossRefLines}
                  title="Binding math · L3a ↔ L3b"
                />
              )}
              {p.l2_payment_view && p.l2_checkout_view && (
                <SplitL2Comparison
                  merchantView={p.l2_checkout_view}
                  networkView={p.l2_payment_view}
                  fullL2DisclosureCount={fullCount}
                />
              )}
              <SdJwtXRay
                data={p.l3a}
                title="L3a · Payment mandate (to network)"
                layerColor={LAYER_COLOR.L3a}
              />
              <SdJwtXRay
                data={p.l3b}
                title="L3b · Checkout mandate (to merchant)"
                layerColor={LAYER_COLOR.L3b}
              />
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

// Tabbed "lens" switcher: shows narrative.real_world / plain_payments /
// production_note one at a time instead of stacking three boxes. Defaults to
// the most tangible framing ("In real life") when present.
function NarrativeLensTabs({
  narrative,
}: {
  narrative: {
    plain_payments?: string;
    real_world?: string;
    production_note?: string;
  };
}) {
  type Lens = { id: string; label: string; color: "emerald" | "slate" | "amber"; body: string };
  const lenses: Lens[] = [];
  if (narrative.real_world) {
    lenses.push({ id: "real", label: "In real life", color: "emerald", body: narrative.real_world });
  }
  if (narrative.plain_payments) {
    lenses.push({ id: "payments", label: "In payments terms", color: "slate", body: narrative.plain_payments });
  }
  if (narrative.production_note) {
    lenses.push({ id: "prod", label: "In production", color: "amber", body: narrative.production_note });
  }

  const [active, setActive] = useState(lenses[0]?.id ?? "");
  if (lenses.length === 0) return null;
  const current = lenses.find((l) => l.id === active) ?? lenses[0];

  const colorMap = {
    emerald: {
      tab: "border-emerald-500/60 text-emerald-300 bg-emerald-500/10",
      body: "border-emerald-500/30 bg-emerald-500/5",
    },
    slate: {
      tab: "border-[#2c3a66] text-[#a4b0d0] bg-[#0b1020]",
      body: "border-[#1f2a4a] bg-[#0b1020]",
    },
    amber: {
      tab: "border-amber-500/60 text-amber-300 bg-amber-500/10",
      body: "border-amber-500/30 bg-amber-500/5",
    },
  } as const;
  const inactive =
    "border-[#1f2a4a] text-[#7b87a8] bg-transparent hover:text-white hover:border-[#2c3a66]";

  return (
    <div className="mt-3">
      <div className="flex gap-1 mb-2">
        {lenses.map((l) => (
          <button
            key={l.id}
            onClick={() => setActive(l.id)}
            className={
              "text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded border transition " +
              (l.id === active ? colorMap[l.color].tab : inactive)
            }
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className={"rounded-md border px-3 py-2 " + colorMap[current.color].body}>
        <p className="text-[13px] text-[#d4dcf0] leading-relaxed">{current.body}</p>
      </div>
    </div>
  );
}
