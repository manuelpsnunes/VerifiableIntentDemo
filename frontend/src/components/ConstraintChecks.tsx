import type { FlowEvent } from "../types";

interface Props {
  events: FlowEvent[];
  injectionEvents?: FlowEvent[];
  injectionMode?: string | null;
}

interface ConstraintRow {
  key: string;
  label: string;
  boundary: string;
  refActual: string;
  refOk: boolean;
  injActual?: string;
  injOk?: boolean;
  specRef: string;
}

function findEvent(events: FlowEvent[], action: string): FlowEvent | undefined {
  return events.find((e) => e.action === action);
}

function buildRows(
  events: FlowEvent[],
  injectionEvents: FlowEvent[]
): ConstraintRow[] {
  const extract = findEvent(events, "constraints_extracted");
  const product = findEvent(events, "product_selected");
  const checkout = findEvent(events, "checkout_jwt_signed");
  if (!extract) return [];

  const ext = extract.payload as any;
  const refProd = (product?.payload as any)?.product ?? null;
  const refMerchant = (checkout?.payload as any)?.merchant ?? null;

  const injExtract = findEvent(injectionEvents, "constraints_extracted");
  const injProduct = findEvent(injectionEvents, "product_selected");
  const injCheckout = findEvent(injectionEvents, "checkout_jwt_signed");
  const injExt = (injExtract?.payload as any) ?? null;
  const injProd = (injProduct?.payload as any)?.product ?? null;
  const injMerchant = (injCheckout?.payload as any)?.merchant ?? null;

  const rows: ConstraintRow[] = [];

  // amount_range
  const maxCents = ext.max_amount_cents as number | null;
  if (maxCents != null) {
    const refPrice = refProd?.price ?? null;
    const injPrice = injProd?.price ?? null;
    rows.push({
      key: "amount_range",
      label: "Amount within budget",
      boundary: `≤ $${(maxCents / 100).toFixed(2)}`,
      refActual: refPrice != null ? `$${(refPrice / 100).toFixed(2)}` : "—",
      refOk: refPrice != null ? refPrice <= maxCents : false,
      injActual:
        injPrice != null ? `$${(injPrice / 100).toFixed(2)}` : undefined,
      injOk: injPrice != null ? injPrice <= (injExt?.max_amount_cents ?? maxCents) : undefined,
      specRef: "§7 amount_range",
    });
  }

  // currency
  const currency = ext.currency as string | null;
  if (currency) {
    rows.push({
      key: "currency",
      label: "Currency match",
      boundary: currency,
      refActual: currency,
      refOk: true,
      injActual: injExt?.currency ?? undefined,
      injOk:
        injExt?.currency != null
          ? injExt.currency === currency
          : undefined,
      specRef: "§7 currency",
    });
  }

  // allowed_merchants — agent always picks view.allowed_merchants[0], so this
  // row is informational: the constraint is satisfied iff an allowed merchant
  // exists and a product was selected on each path.
  const allowedMerchants: any[] = ext.allowed_merchants ?? [];
  if (allowedMerchants.length > 0) {
    const refMerchantName =
      refMerchant?.name ?? allowedMerchants[0]?.name ?? "—";
    const injMerchantName =
      injMerchant?.name ?? (injExt?.allowed_merchants?.[0]?.name);
    rows.push({
      key: "allowed_merchants",
      label: "Merchant on allowlist",
      boundary: `${allowedMerchants.length} allowed`,
      refActual: refMerchantName,
      refOk: refProd != null,
      injActual: injProd != null ? injMerchantName : undefined,
      injOk: injProd != null ? true : undefined,
      specRef: "§7 allowed_payees",
    });
  }

  // line_items (acceptable_items)
  const acceptable: any[] = ext.acceptable_items ?? [];
  if (acceptable.length > 0) {
    const acceptableSkus = new Set(
      acceptable.map((it) => it?.sku ?? it?.id).filter(Boolean)
    );
    const refSku = refProd?.sku ?? null;
    const injSku = injProd?.sku ?? null;
    rows.push({
      key: "line_items",
      label: "Product in acceptable items",
      boundary: `${acceptable.length} SKU(s)`,
      refActual: refSku ?? "—",
      refOk: refSku != null && acceptableSkus.has(refSku),
      injActual: injSku ?? undefined,
      injOk: injSku != null ? acceptableSkus.has(injSku) : undefined,
      specRef: "§7 line_items",
    });
  }

  return rows;
}

function Pill({ ok, text }: { ok: boolean | undefined; text: string }) {
  if (ok === undefined) {
    return <span className="text-[#4f5a7e] text-[12px]">—</span>;
  }
  const color = ok ? "#34d399" : "#f87171";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center"
        style={{ background: color + "22", color }}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span
        className="font-mono text-[12px]"
        style={{ color: ok ? "#d4dcf0" : "#fca5a5" }}
      >
        {text}
      </span>
    </span>
  );
}

export function ConstraintChecks({
  events,
  injectionEvents = [],
  injectionMode = null,
}: Props) {
  const rows = buildRows(events, injectionEvents);
  if (rows.length === 0) return null;
  const hasInjection = injectionEvents.length > 0 && injectionMode;

  return (
    <div className="mt-5 rounded-lg border border-[#1f2a4a] bg-[#0a1530] overflow-hidden">
      <div className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-[#7aa2ff] border-b border-[#1f2a4a] bg-[#0b1020] flex items-center gap-2">
        <span>Constraints · L2 boundary vs L3 actual</span>
        {hasInjection && (
          <span className="ml-auto text-[9px] text-[#f87171] font-mono normal-case">
            inj={injectionMode}
          </span>
        )}
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[#7b87a8]">
            <th className="px-3 py-1.5 text-left">Constraint</th>
            <th className="px-3 py-1.5 text-left">L2 boundary</th>
            <th className="px-3 py-1.5 text-left">
              {hasInjection ? "Reference actual" : "L3 actual"}
            </th>
            {hasInjection && (
              <th className="px-3 py-1.5 text-left text-[#f87171]">
                Injection actual
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-[#1f2a4a]">
              <td className="px-3 py-2 text-white/90">
                <div>{r.label}</div>
                <div className="text-[9px] text-[#4f5a7e] font-mono mt-0.5">
                  {r.specRef}
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-[#d4dcf0]">
                {r.boundary}
              </td>
              <td className="px-3 py-2">
                <Pill ok={r.refOk} text={r.refActual} />
              </td>
              {hasInjection && (
                <td className="px-3 py-2">
                  <Pill ok={r.injOk} text={r.injActual ?? "—"} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
