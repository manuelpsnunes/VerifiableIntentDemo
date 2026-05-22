import type { FlowEvent, Role } from "../types";
import { ROLE_COLOR, ROLE_GLYPH, ROLE_LABEL, PARTIES as ALL_PARTIES } from "../roleTheme";

interface Props {
  events: FlowEvent[];
  selectedStep: number | null;
  injectionEvents?: FlowEvent[];
  injectionMode?: string | null;
}

type Party = Exclude<Role, "system">;
type Visibility = "signed" | "full" | "partial" | "hidden";

interface CellState {
  visibility: Visibility;
  disclosureCount: number;
  note?: string;
}

const PARTIES: Party[] = ALL_PARTIES;
const PARTY_GLYPH: Record<Party, string> = {
  issuer: ROLE_GLYPH.issuer,
  wallet: ROLE_GLYPH.wallet,
  agent: ROLE_GLYPH.agent,
  merchant: ROLE_GLYPH.merchant,
  network: ROLE_GLYPH.network,
};
const PARTY_COLOR: Record<Party, string> = {
  issuer: ROLE_COLOR.issuer,
  wallet: ROLE_COLOR.wallet,
  agent: ROLE_COLOR.agent,
  merchant: ROLE_COLOR.merchant,
  network: ROLE_COLOR.network,
};
const PARTY_LABEL: Record<Party, string> = {
  issuer: ROLE_LABEL.issuer,
  wallet: ROLE_LABEL.wallet,
  agent: ROLE_LABEL.agent,
  merchant: ROLE_LABEL.merchant,
  network: ROLE_LABEL.network,
};

const CREDENTIALS = ["L1", "L2", "L3a", "L3b"] as const;
type Credential = (typeof CREDENTIALS)[number];

const CRED_COLOR: Record<Credential, string> = {
  L1: "#f59e0b",
  L2: "#34d399",
  L3a: "#f472b6",
  L3b: "#c084fc",
};

const VIS_STYLE: Record<Visibility, { bg: string; text: string; symbol: string; label: string }> = {
  signed: { bg: "#34d399", text: "#0b1020", symbol: "✎", label: "Signed by this party" },
  full: { bg: "#34d39933", text: "#34d399", symbol: "●", label: "Holds full credential (all disclosures)" },
  partial: { bg: "#facc1533", text: "#facc15", symbol: "◐", label: "Holds selective-disclosure subset" },
  hidden: { bg: "#1f2a4a", text: "#4f5a7e", symbol: "—", label: "Never receives this credential" },
};

interface MatrixSnapshot {
  cells: Record<Party, Record<Credential, CellState>>;
  l2DisclosureCount: number;
  l2CheckoutDisclosureCount: number;
  l2PaymentDisclosureCount: number;
  l1DisclosureCount: number;
  l3aDisclosureCount: number;
  l3bDisclosureCount: number;
}

function emptySnapshot(): MatrixSnapshot {
  const cells = {} as Record<Party, Record<Credential, CellState>>;
  for (const p of PARTIES) {
    cells[p] = {} as Record<Credential, CellState>;
    for (const c of CREDENTIALS) {
      cells[p][c] = { visibility: "hidden", disclosureCount: 0 };
    }
  }
  return {
    cells,
    l1DisclosureCount: 0,
    l2DisclosureCount: 0,
    l2CheckoutDisclosureCount: 0,
    l2PaymentDisclosureCount: 0,
    l3aDisclosureCount: 0,
    l3bDisclosureCount: 0,
  };
}

function disclosureCount(payload: any): number {
  if (!payload?.disclosures) return 0;
  return Array.isArray(payload.disclosures) ? payload.disclosures.length : 0;
}

function computeMatrix(events: FlowEvent[], uptoStep: number): MatrixSnapshot {
  const snap = emptySnapshot();

  const relevant = events.filter((e) => e.step <= uptoStep);

  // Step 2: issuer signs L1; wallet receives L1 full
  const l1Evt = relevant.find((e) => e.action === "l1_issued");
  if (l1Evt) {
    const cred = (l1Evt.payload as any)?.credential ?? {};
    const n = disclosureCount(cred);
    snap.l1DisclosureCount = n;
    snap.cells.issuer.L1 = { visibility: "signed", disclosureCount: n };
    snap.cells.wallet.L1 = { visibility: "full", disclosureCount: n };
  }

  // Step 3: wallet signs L2; agent receives L2 full
  const l2Evt = relevant.find((e) => e.action === "l2_created");
  if (l2Evt) {
    const cred = (l2Evt.payload as any)?.credential ?? {};
    const n = disclosureCount(cred);
    snap.l2DisclosureCount = n;
    snap.cells.wallet.L2 = { visibility: "signed", disclosureCount: n };
    snap.cells.agent.L2 = { visibility: "full", disclosureCount: n };
  }

  // Step 7: agent signs L3a + L3b; transmits L1+L2(view)+L3 to merchant & network
  const l3Evt = relevant.find((e) => e.action === "l3_built");
  if (l3Evt) {
    const l3a = (l3Evt.payload as any)?.l3a ?? {};
    const l3b = (l3Evt.payload as any)?.l3b ?? {};
    const l2pv = (l3Evt.payload as any)?.l2_payment_view ?? {};
    const l2cv = (l3Evt.payload as any)?.l2_checkout_view ?? {};

    snap.l3aDisclosureCount = disclosureCount(l3a);
    snap.l3bDisclosureCount = disclosureCount(l3b);
    snap.l2PaymentDisclosureCount = disclosureCount(l2pv);
    snap.l2CheckoutDisclosureCount = disclosureCount(l2cv);

    // Agent signed both L3s
    snap.cells.agent.L3a = {
      visibility: "signed",
      disclosureCount: snap.l3aDisclosureCount,
    };
    snap.cells.agent.L3b = {
      visibility: "signed",
      disclosureCount: snap.l3bDisclosureCount,
    };

    // Network bundle: L1 (full) + L2 payment view (partial) + L3a (full)
    snap.cells.network.L1 = {
      visibility: "full",
      disclosureCount: snap.l1DisclosureCount,
      note: "received with L3a bundle",
    };
    snap.cells.network.L2 = {
      visibility: "partial",
      disclosureCount: snap.l2PaymentDisclosureCount,
      note: `${snap.l2PaymentDisclosureCount} of ${snap.l2DisclosureCount} L2 disclosures (payment view)`,
    };
    snap.cells.network.L3a = {
      visibility: "full",
      disclosureCount: snap.l3aDisclosureCount,
    };

    // Merchant bundle: L1 (full) + L2 checkout view (partial) + L3b (full)
    snap.cells.merchant.L1 = {
      visibility: "full",
      disclosureCount: snap.l1DisclosureCount,
      note: "received with L3b bundle",
    };
    snap.cells.merchant.L2 = {
      visibility: "partial",
      disclosureCount: snap.l2CheckoutDisclosureCount,
      note: `${snap.l2CheckoutDisclosureCount} of ${snap.l2DisclosureCount} L2 disclosures (checkout view)`,
    };
    snap.cells.merchant.L3b = {
      visibility: "full",
      disclosureCount: snap.l3bDisclosureCount,
    };
  }

  return snap;
}

function Cell({
  state,
  cred,
}: {
  state: CellState;
  cred: Credential;
}) {
  const style = VIS_STYLE[state.visibility];
  const tooltip = `${cred} · ${style.label}${
    state.disclosureCount > 0 ? ` · ${state.disclosureCount} disclosure(s)` : ""
  }${state.note ? ` · ${state.note}` : ""}`;
  return (
    <td
      title={tooltip}
      className="px-1.5 py-1 text-center text-[10px] font-mono"
      style={{ background: style.bg, color: style.text }}
    >
      <span>{style.symbol}</span>
      {state.disclosureCount > 0 && state.visibility !== "hidden" && (
        <span className="ml-1 text-[9px] opacity-80">
          {state.disclosureCount}
        </span>
      )}
    </td>
  );
}

export function DisclosureMatrix({
  events,
  selectedStep,
  injectionEvents = [],
  injectionMode = null,
}: Props) {
  const uptoStep =
    selectedStep ?? (events.length > 0 ? events[events.length - 1].step : -1);
  const snap = computeMatrix(events, uptoStep);
  const injectionActive = injectionEvents.length > 0 && injectionMode;

  return (
    <div className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold mb-2 flex items-center gap-2">
        <span>Who knows what</span>
        <span className="font-mono normal-case text-[#4f5a7e]">
          (at step #{uptoStep < 0 ? "—" : uptoStep})
        </span>
        {injectionActive && (
          <span className="ml-auto text-[9px] uppercase tracking-wider text-[#f87171] normal-case font-mono">
            ref · inj={injectionMode}
          </span>
        )}
      </div>

      <table className="w-full border-separate" style={{ borderSpacing: "2px" }}>
        <thead>
          <tr>
            <th className="text-[9px] uppercase tracking-wider text-[#7b87a8] text-left pr-1">
              Party
            </th>
            {CREDENTIALS.map((c) => (
              <th
                key={c}
                className="text-[10px] font-mono font-bold px-1"
                style={{ color: CRED_COLOR[c] }}
                title={`Credential ${c}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PARTIES.map((p) => (
            <tr key={p}>
              <td className="text-[10px] pr-1 py-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ background: PARTY_COLOR[p], color: "#0b1020" }}
                  >
                    {PARTY_GLYPH[p]}
                  </span>
                  <span className="text-white/90">{PARTY_LABEL[p]}</span>
                </span>
              </td>
              {CREDENTIALS.map((c) => (
                <Cell key={c} state={snap.cells[p][c]} cred={c} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-[#1f2a4a]">
        <div className="text-[9px] uppercase tracking-wider text-[#7b87a8] mb-1.5 font-semibold">
          Legend
        </div>
        <div className="grid grid-cols-1 gap-1 text-[10px]">
          {(["signed", "full", "partial", "hidden"] as Visibility[]).map((v) => {
            const s = VIS_STYLE[v];
            return (
              <div key={v} className="flex items-center gap-2">
                <span
                  className="w-5 h-4 rounded text-center font-mono text-[10px] flex items-center justify-center"
                  style={{ background: s.bg, color: s.text }}
                >
                  {s.symbol}
                </span>
                <span className="text-white/80">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Headline numeric callout — the VI punchline */}
      {snap.l2DisclosureCount > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1f2a4a]">
          <div className="text-[9px] uppercase tracking-wider text-[#7b87a8] mb-1 font-semibold">
            L2 selective disclosure split
          </div>
          <div className="text-[11px] text-white/90 leading-snug">
            L2 has{" "}
            <span className="font-mono text-[#34d399] font-bold">
              {snap.l2DisclosureCount}
            </span>{" "}
            disclosures total.
          </div>
          {snap.l2CheckoutDisclosureCount > 0 && (
            <div className="text-[11px] text-white/80 mt-1 leading-snug">
              Merchant sees{" "}
              <span className="font-mono text-[#c084fc] font-bold">
                {snap.l2CheckoutDisclosureCount}
              </span>
              , Network sees{" "}
              <span className="font-mono text-[#f472b6] font-bold">
                {snap.l2PaymentDisclosureCount}
              </span>
              .
            </div>
          )}
          <div className="text-[10px] text-[#7b87a8] italic mt-1.5">
            Same parent sd_hash, different visible claims.
          </div>
        </div>
      )}
    </div>
  );
}
