import { motion, AnimatePresence } from "framer-motion";
import type { FlowEvent } from "../types";

interface Props {
  events: FlowEvent[];
  currentStep: number | null;
  onSelect: (step: number) => void;
}

interface CardData {
  label: string;
  layer: "L1" | "L2" | "L3a" | "L3b";
  step: number;
  issuer: string;
  subject: string;
  cnfThumb?: string;
  exp?: number;
  serialized?: string;
}

function shortKid(kid?: string): string {
  if (!kid) return "—";
  return kid.length > 14 ? `${kid.slice(0, 8)}…${kid.slice(-4)}` : kid;
}

function jwkThumbprint(jwk: any): string | undefined {
  // The backend already attaches `kid` to each role. We surface that as the
  // thumbprint label here. If a credential has a cnf.jwk we fall back to a
  // short serialization preview.
  if (!jwk) return undefined;
  if (typeof jwk === "string") return jwk;
  if (jwk.kid) return String(jwk.kid);
  if (jwk.x) return `x:${String(jwk.x).slice(0, 8)}…`;
  return undefined;
}

function extractCards(events: FlowEvent[]): CardData[] {
  const out: CardData[] = [];

  const l1Evt = events.find((e) => e.action === "l1_issued");
  if (l1Evt) {
    const cred = (l1Evt.payload as any)?.credential ?? {};
    const payload = cred.payload ?? {};
    out.push({
      label: "L1 · Card credential",
      layer: "L1",
      step: l1Evt.step,
      issuer: payload.iss ?? "issuer",
      subject: payload.sub ?? "user",
      cnfThumb: jwkThumbprint(payload?.cnf?.jwk),
      exp: payload.exp,
      serialized: cred.serialized,
    });
  }

  const l2Evt = events.find((e) => e.action === "l2_created");
  if (l2Evt) {
    const cred = (l2Evt.payload as any)?.credential ?? {};
    const payload = cred.payload ?? {};
    out.push({
      label: "L2 · User mandate",
      layer: "L2",
      step: l2Evt.step,
      issuer: payload.iss ?? "wallet",
      subject: payload.sub ?? "agent",
      cnfThumb: jwkThumbprint(payload?.cnf?.jwk),
      exp: payload.exp,
      serialized: cred.serialized,
    });
  }

  const l3Evt = events.find((e) => e.action === "l3_built");
  if (l3Evt) {
    const l3a = (l3Evt.payload as any)?.l3a ?? {};
    const l3b = (l3Evt.payload as any)?.l3b ?? {};
    out.push({
      label: "L3a · Payment mandate",
      layer: "L3a",
      step: l3Evt.step,
      issuer: l3a?.payload?.iss ?? "agent",
      subject: "network",
      cnfThumb: undefined,
      exp: l3a?.payload?.exp,
      serialized: l3a.serialized,
    });
    out.push({
      label: "L3b · Checkout mandate",
      layer: "L3b",
      step: l3Evt.step,
      issuer: l3b?.payload?.iss ?? "agent",
      subject: "merchant",
      cnfThumb: undefined,
      exp: l3b?.payload?.exp,
      serialized: l3b.serialized,
    });
  }

  return out;
}

const LAYER_COLOR: Record<CardData["layer"], string> = {
  L1: "#f59e0b",
  L2: "#34d399",
  L3a: "#f472b6",
  L3b: "#c084fc",
};

function CredentialCard({
  card,
  isActive,
  onClick,
}: {
  card: CardData;
  isActive: boolean;
  onClick: () => void;
}) {
  const color = LAYER_COLOR[card.layer];
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: -10, scale: 0.9 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: isActive ? `0 0 0 2px ${color}, 0 0 24px ${color}55` : "none",
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={onClick}
      title={`Step ${card.step} · ${card.layer}`}
      className="text-left w-[180px] flex-shrink-0 rounded-lg border bg-[#0e1530] px-3 py-2 hover:bg-[#111933] transition"
      style={{ borderColor: color + (isActive ? "" : "40") }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {card.layer}
        </span>
        <span className="text-[9px] font-mono text-[#7b87a8]">
          #{card.step}
        </span>
      </div>
      <div className="text-[11px] text-white font-semibold leading-tight mb-1.5 truncate">
        {card.label}
      </div>
      <div className="text-[9px] text-[#7b87a8] font-mono leading-tight">
        iss: <span className="text-white/80">{card.issuer}</span>
      </div>
      <div className="text-[9px] text-[#7b87a8] font-mono leading-tight">
        sub: <span className="text-white/80">{card.subject}</span>
      </div>
      {card.cnfThumb && (
        <div className="text-[9px] text-[#7b87a8] font-mono leading-tight truncate">
          cnf: <span className="text-[#7aa2ff]">{shortKid(card.cnfThumb)}</span>
        </div>
      )}
    </motion.button>
  );
}

function BindingArrow({
  label,
  direction,
  color,
}: {
  label: string;
  direction: "down" | "up";
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="flex flex-col items-center justify-center px-1"
      title={direction === "down" ? "child binds to parent via sd_hash" : "parent delegates to child via cnf.jwk"}
    >
      <span
        className="text-[9px] font-mono uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-[16px] leading-none" style={{ color }}>
        {direction === "down" ? "↓" : "↑"}
      </span>
    </motion.div>
  );
}

export function CredentialStack({ events, currentStep, onSelect }: Props) {
  const cards = extractCards(events);

  return (
    <section className="border-b border-[#1f2a4a] px-6 py-3 bg-[#0a0f25]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider text-[#7b87a8] font-semibold">
          Credential chain
        </span>
        <span className="text-[10px] text-[#4f5a7e] font-mono">
          L1 → L2 → L3a + L3b
        </span>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        <AnimatePresence>
          {cards.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11px] text-[#4f5a7e] italic py-4"
            >
              Run the demo to watch the credential chain form…
            </motion.div>
          )}
          {cards.map((card, idx) => {
            const prev = cards[idx - 1];
            const showBinding = prev && prev.layer !== card.layer && card.layer !== "L3b";
            return (
              <div key={card.layer + ":" + card.step} className="flex items-stretch gap-1">
                {showBinding && (
                  <div className="flex flex-col items-center justify-center gap-1">
                    <BindingArrow
                      label="sd_hash"
                      direction="down"
                      color="#7aa2ff"
                    />
                    <BindingArrow
                      label="cnf.jwk"
                      direction="up"
                      color="#c084fc"
                    />
                  </div>
                )}
                <CredentialCard
                  card={card}
                  isActive={currentStep === card.step}
                  onClick={() => onSelect(card.step)}
                />
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
