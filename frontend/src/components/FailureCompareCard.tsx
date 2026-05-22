import type { FlowEvent } from "../types";

interface Props {
  referenceEvent: FlowEvent;
  injectionEvent: FlowEvent;
  injectionMode: string;
}

interface VerdictDiff {
  refOk: boolean | null;
  injOk: boolean | null;
  refLabel: string;
  injLabel: string;
}

// Compare ref vs injection events for the same step and surface the divergence.
function diffVerdict(
  ref: FlowEvent,
  inj: FlowEvent
): VerdictDiff | null {
  const rp = ref.payload as any;
  const ip = inj.payload as any;
  switch (ref.action) {
    case "verified": {
      const refOk = !!rp?.chain_valid && (rp?.constraints_satisfied ?? true);
      const injOk = !!ip?.chain_valid && (ip?.constraints_satisfied ?? true);
      const ipErrors: string[] = [
        ...(ip?.errors ?? []),
        ...(ip?.chain_errors ?? []),
        ...(ip?.constraint_violations ?? []).map((v: any) =>
          typeof v === "string" ? v : v?.error ?? JSON.stringify(v)
        ),
      ];
      return {
        refOk,
        injOk,
        refLabel: refOk ? "Chain verified" : "Verification failed",
        injLabel: injOk
          ? "Unexpectedly passed"
          : `SDK rejected: ${ipErrors[0] ?? "unknown error"}`,
      };
    }
    case "authorized":
    case "declined": {
      const refOk = !!rp?.approved;
      const injOk = !!ip?.approved;
      return {
        refOk,
        injOk,
        refLabel: refOk
          ? `Authorized · ${rp?.authorization_id ?? ""}`
          : `Declined: ${rp?.reason ?? "?"}`,
        injLabel: injOk
          ? `Authorized · ${ip?.authorization_id ?? ""}`
          : `Declined: ${ip?.reason ?? "?"}`,
      };
    }
    case "l2_created": {
      return {
        refOk: true,
        injOk: ip?.tampered ? false : true,
        refLabel: "Real sd_hash binds L2 → L1",
        injLabel: ip?.tampered
          ? "L2.sd_hash tampered (binds wrong L1)"
          : "L2 unchanged",
      };
    }
    case "product_selected": {
      const refPrice = rp?.product?.price ?? 0;
      const injPrice = ip?.product?.price ?? 0;
      return {
        refOk: true,
        injOk: !ip?.tampered,
        refLabel: `Selected at $${(refPrice / 100).toFixed(2)}`,
        injLabel: ip?.tampered
          ? `Price tampered to $${(injPrice / 100).toFixed(2)} (above budget)`
          : `Selected at $${(injPrice / 100).toFixed(2)}`,
      };
    }
    case "checkout_jwt_signed": {
      return {
        refOk: true,
        injOk: !ip?.tampered,
        refLabel: "Real checkout_hash = SHA-256(checkout_jwt)",
        injLabel: ip?.tampered
          ? "Tampered checkout_hash (no longer matches JWT)"
          : "Unchanged",
      };
    }
    default:
      return null;
  }
}

function Verdict({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok === null ? "#7b87a8" : ok ? "#34d399" : "#f87171";
  const glyph = ok === null ? "…" : ok ? "✓" : "✗";
  return (
    <div className="flex items-start gap-2">
      <span
        className="text-[12px] font-mono font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: color + "22", color }}
      >
        {glyph}
      </span>
      <span
        className="text-[13px] leading-snug"
        style={{ color: ok === false ? "#fca5a5" : "#d4dcf0" }}
      >
        {label}
      </span>
    </div>
  );
}

export function FailureCompareCard({
  referenceEvent,
  injectionEvent,
  injectionMode,
}: Props) {
  const diff = diffVerdict(referenceEvent, injectionEvent);
  if (!diff) return null;

  const divergent =
    diff.refOk !== diff.injOk ||
    diff.refLabel !== diff.injLabel;

  return (
    <div className="rounded-lg border border-[#3a1f1f] bg-gradient-to-r from-[#0a1530] to-[#1a0f10] overflow-hidden">
      <div className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b border-[#3a1f1f] bg-[#0a0a1f] flex items-center gap-2">
        <span className="text-[#f87171]">Failure injection · compare</span>
        <span className="text-[10px] font-mono text-[#7b87a8] normal-case">
          mode={injectionMode}
        </span>
        {divergent && (
          <span className="ml-auto text-[10px] text-[#34d399] uppercase">
            tracks diverge here ↓
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-[#3a1f1f]">
        <div className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-[#34d399] mb-2 font-bold">
            Reference path
          </div>
          <Verdict ok={diff.refOk} label={diff.refLabel} />
        </div>
        <div className="p-3 bg-[#1a0f10]/50">
          <div className="text-[10px] uppercase tracking-wider text-[#f87171] mb-2 font-bold">
            Injection path
          </div>
          <Verdict ok={diff.injOk} label={diff.injLabel} />
        </div>
      </div>
    </div>
  );
}
