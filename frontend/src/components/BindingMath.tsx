import { useEffect, useState } from "react";

interface BindingLine {
  label: string;
  lhsLabel: string;
  rhsLabel: string;
  lhsValue: string;
  rhsValue: string;
  computedHash?: string;
  ok: boolean | null;
  note?: string;
  ruleRef?: string;
}

interface Props {
  lines: BindingLine[];
  title?: string;
}

function shortHash(h?: string, len = 12): string {
  if (!h) return "—";
  return h.length > len + 3 ? `${h.slice(0, len)}…` : h;
}

function Row({ line }: { line: BindingLine }) {
  const okColor =
    line.ok === null
      ? "#7b87a8"
      : line.ok
      ? "#34d399"
      : "#f87171";
  const okGlyph =
    line.ok === null ? "…" : line.ok ? "✓" : "✗";
  return (
    <div
      className="rounded-md border bg-[#0b1020] px-3 py-2"
      style={{ borderColor: okColor + "40" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] font-mono font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: okColor + "22", color: okColor }}
        >
          {okGlyph}
        </span>
        <span className="text-[12px] font-semibold text-white">{line.label}</span>
        {line.ruleRef && (
          <span className="ml-auto text-[9px] font-mono text-[#7b87a8]">
            {line.ruleRef}
          </span>
        )}
      </div>

      <div className="font-mono text-[11px] text-white/85 leading-relaxed pl-7">
        <div className="break-all">
          <span className="text-[#7b87a8]">{line.lhsLabel}</span> ={" "}
          <span style={{ color: okColor }}>{shortHash(line.lhsValue, 16)}</span>
        </div>
        {line.computedHash && (
          <div className="break-all">
            <span className="text-[#7b87a8]">
              SHA-256({line.rhsLabel})
            </span>{" "}
            ={" "}
            <span style={{ color: okColor }}>
              {shortHash(line.computedHash, 16)}
            </span>
          </div>
        )}
        {!line.computedHash && (
          <div className="break-all">
            <span className="text-[#7b87a8]">{line.rhsLabel}</span> ={" "}
            <span style={{ color: okColor }}>
              {shortHash(line.rhsValue, 16)}
            </span>
          </div>
        )}
      </div>

      {line.note && (
        <div className="text-[10px] text-[#7b87a8] italic mt-1.5 pl-7">
          {line.note}
        </div>
      )}
    </div>
  );
}

export function BindingMath({ lines, title = "Binding math" }: Props) {
  return (
    <div className="rounded-lg border border-[#1f2a4a] bg-[#0e1530] overflow-hidden">
      <div className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b border-[#1f2a4a] bg-[#0a0f25] text-white flex items-center gap-2">
        <span>{title}</span>
        <span className="text-[10px] font-mono text-[#7b87a8] normal-case">
          (computed client-side via WebCrypto SHA-256)
        </span>
      </div>
      <div className="p-3 space-y-2">
        {lines.map((line, i) => (
          <Row key={line.label + i} line={line} />
        ))}
      </div>
    </div>
  );
}

// ---------- Helpers to derive binding lines from event payloads ----------

const enc = new TextEncoder();

async function sha256Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  const bytes = new Uint8Array(buf);
  // base64url (matches verifiable-intent's hash_bytes encoding)
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface ComputeContext {
  l1Serialized?: string;
  l2Serialized?: string;
  l2SdHash?: string;
  l2PaymentSerialized?: string;
  l2CheckoutSerialized?: string;
  checkoutJwt?: string;
  checkoutHashClaimed?: string;
  l3aTransactionId?: string;
  l3bCheckoutHash?: string;
}

export function useBindingLines(ctx: ComputeContext): BindingLine[] {
  const [lines, setLines] = useState<BindingLine[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      const out: BindingLine[] = [];

      // Line 1: L2.sd_hash == SHA-256(L1.serialized)
      if (ctx.l1Serialized && ctx.l2SdHash) {
        try {
          const computed = await sha256Url(ctx.l1Serialized);
          out.push({
            label: "L2 binds to L1 (parent integrity)",
            lhsLabel: "L2.payload.sd_hash",
            lhsValue: ctx.l2SdHash,
            rhsLabel: "L1.serialized",
            rhsValue: ctx.l1Serialized,
            computedHash: computed,
            ok: computed === ctx.l2SdHash,
            note:
              computed === ctx.l2SdHash
                ? "L2 cannot be substituted onto a different L1 without breaking this hash."
                : "Hash mismatch — chain rejected.",
            ruleRef: "§11 verify_chain",
          });
        } catch (e) {
          /* ignore */
        }
      }

      // Line 2: checkout_hash claimed == SHA-256(checkout_jwt)
      if (ctx.checkoutJwt && ctx.checkoutHashClaimed) {
        try {
          const computed = await sha256Url(ctx.checkoutJwt);
          out.push({
            label: "Checkout JWT is the canonical cart anchor",
            lhsLabel: "claimed checkout_hash",
            lhsValue: ctx.checkoutHashClaimed,
            rhsLabel: "checkout_jwt",
            rhsValue: ctx.checkoutJwt,
            computedHash: computed,
            ok: computed === ctx.checkoutHashClaimed,
            note:
              computed === ctx.checkoutHashClaimed
                ? "Any tampering with the cart breaks this hash everywhere it's referenced."
                : "Tampering detected — hash mismatch.",
            ruleRef: "§9 checkout JWT",
          });
        } catch (e) {
          /* ignore */
        }
      }

      // Line 3: L3a.transaction_id == L3b.checkout_hash
      if (ctx.l3aTransactionId && ctx.l3bCheckoutHash) {
        const ok = ctx.l3aTransactionId === ctx.l3bCheckoutHash;
        out.push({
          label: "L3a ↔ L3b cross-reference",
          lhsLabel: "L3a.transaction_id",
          lhsValue: ctx.l3aTransactionId,
          rhsLabel: "L3b.checkout_hash",
          rhsValue: ctx.l3bCheckoutHash,
          ok,
          note: ok
            ? "Network (sees payment only) and merchant (sees cart only) can prove they're talking about the same transaction."
            : "Cross-reference mismatch — chain rejected.",
          ruleRef: "§10 L3 binding",
        });
      }

      if (!cancelled) setLines(out);
    }

    compute();
    return () => {
      cancelled = true;
    };
  }, [
    ctx.l1Serialized,
    ctx.l2Serialized,
    ctx.l2SdHash,
    ctx.l2PaymentSerialized,
    ctx.l2CheckoutSerialized,
    ctx.checkoutJwt,
    ctx.checkoutHashClaimed,
    ctx.l3aTransactionId,
    ctx.l3bCheckoutHash,
  ]);

  return lines;
}
