// Circular stakeholder graph: shows the 6 roles (System, Issuer, Wallet, Agent,
// Merchant, Network) arranged in a clock face, with animated arrows for each
// pipeline step indicating which credential is moving from whom to whom.
//
// Driven by selectedStep from useFlowStore. No auto-play — follows the user's
// click in the Timeline / step controls. Hover an arrow to see the verb.

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "../store";
import type { Role } from "../types";
import { ROLE_COLOR, ROLE_GLYPH, ROLE_LABEL, ROLE_REAL_WORLD } from "../roleTheme";
import { NARRATIVES } from "../narratives";

interface Arrow {
  from: Role;
  to: Role;
  label: string; // terse, drawn on the line (e.g. "L1", "L2", "L3a + L2(payment)")
  verb: string;  // tooltip text on hover (full sentence)
}

interface StepDef {
  pulse?: Role[];  // roles to highlight without any arrow (internal/local action)
  arrows?: Arrow[]; // 1+ arrows for this step
}

// Maps every orchestrator step (0..11) to what the stakeholder graph shows.
// Sourced from backend/app/orchestrator.py STEPS table.
const STEP_FLOW: Record<number, StepDef> = {
  0: { pulse: ["user", "system"] },   // demo_started — user types the prompt
  1: { pulse: ["system"] },           // enrollment (keypairs loaded)
  2: {
    arrows: [
      { from: "issuer", to: "wallet", label: "L1", verb: "L1 loaded from wallet · issuer-signed at enrollment" },
    ],
  },
  3: {
    arrows: [
      // The user authorizes the mandate (consent / Face ID); the wallet then
      // ratifies that consent by signing L2. Showing both arrows makes it
      // explicit that the wallet did not invent the merchants/SKUs — the user
      // approved them.
      { from: "user",   to: "wallet", label: "consent", verb: "user approves merchants + items + budget (e.g. Face ID)" },
      { from: "wallet", to: "agent",  label: "L2",      verb: "wallet ratifies user consent by signing L2 mandate to agent" },
    ],
  },
  4: { pulse: ["agent"] },            // agent_planned (internal)
  5: { pulse: ["agent"] },            // agent_proposed (internal)
  6: {
    arrows: [
      { from: "merchant", to: "agent", label: "checkout_jwt", verb: "merchant signs checkout JWT and returns it to agent" },
    ],
  },
  7: {
    arrows: [
      { from: "agent", to: "merchant", label: "L3b + L2(checkout)", verb: "agent presents L3b + L2(checkout) view to merchant" },
      { from: "agent", to: "network",  label: "L3a + L2(payment)",  verb: "agent presents L3a + L2(payment) view to network" },
    ],
  },
  8:  { pulse: ["merchant"] },        // merchant verifies (internal)
  9:  { pulse: ["network"] },         // network verifies (internal)
  10: { pulse: ["network"] },         // network authorizes (internal)
  11: { pulse: ["user", "system"] },  // demo_complete — user sees confirmation
};

// --- geometry ---
const SIZE = 400;          // SVG viewBox width
const HEIGHT = 440;        // SVG viewBox height (extra for top/bottom labels)
const CENTER = { x: SIZE / 2, y: 220 };
const RADIUS = 140;        // distance from center to each node center
const NODE_R = 28;         // node circle radius

// Clock-face angles. With 7 nodes evenly spaced at ~51.4° apart, system stays
// at top (12 o'clock) and the user sits between wallet and agent — geometrically
// reinforcing that the user delegates *through* the wallet to the agent.
const ANGLES: Record<Role, number> = {
  system:    -90.00, // top
  issuer:    -38.57,
  wallet:     12.86,
  user:       64.29, // between wallet and agent
  agent:     115.71,
  merchant:  167.14,
  network:  -141.43, // == 218.57 normalised
};

const ROLES: Role[] = ["system", "issuer", "wallet", "user", "agent", "merchant", "network"];

function nodePos(role: Role) {
  const rad = (ANGLES[role] * Math.PI) / 180;
  return {
    x: CENTER.x + RADIUS * Math.cos(rad),
    y: CENTER.y + RADIUS * Math.sin(rad),
  };
}

// Compute start/end endpoints on the circumference of source/target nodes,
// with a tiny gap so the arrowhead marker sits cleanly outside the target.
function arrowGeom(from: Role, to: Role) {
  const a = nodePos(from);
  const b = nodePos(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / dist;
  const uy = dy / dist;
  const gap = NODE_R + 4;
  const sx = a.x + ux * gap;
  const sy = a.y + uy * gap;
  const ex = b.x - ux * gap;
  const ey = b.y - uy * gap;
  return { sx, sy, ex, ey, mx: (sx + ex) / 2, my: (sy + ey) / 2 };
}

// A failure on the active injection-track event for this step.
function isFailurePayload(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    o.chain_valid === false ||
    o.constraints_satisfied === false ||
    o.approved === false
  );
}

export function StakeholderGraph() {
  const { events, injectionEvents, injectionMode, selectedStep } = useFlowStore();
  const [hover, setHover] = useState<{ x: number; y: number; verb: string } | null>(null);

  const activeStep = selectedStep ?? -1;
  const def = STEP_FLOW[activeStep];

  // Pull the plain-payments analogy for the active step's action so we can
  // surface a one-liner under the graph. Works on both reference and
  // injection tracks.
  const plainPayments = useMemo(() => {
    const src = injectionMode ? injectionEvents : events;
    const action = src.find((e) => e.step === activeStep)?.action;
    return action ? NARRATIVES[action]?.plain_payments : undefined;
  }, [events, injectionEvents, injectionMode, activeStep]);

  // Failure detection: only meaningful when an injection ran. Applies to both
  // arrow steps (agent presents bad credentials) AND pulse-only verifier steps
  // (merchant/network verifies, finds the chain broken).
  const failureActive = useMemo(() => {
    if (!injectionMode || !def) return false;
    const evt = injectionEvents.find((e) => e.step === activeStep);
    return evt ? isFailurePayload(evt.payload) : false;
  }, [injectionMode, injectionEvents, activeStep, def]);

  // Which roles are "involved" in this step, for dimming the rest.
  const involved = useMemo(() => {
    const s = new Set<Role>();
    def?.pulse?.forEach((r) => s.add(r));
    def?.arrows?.forEach((a) => { s.add(a.from); s.add(a.to); });
    return s;
  }, [def]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SIZE} ${HEIGHT}`}
        className="w-full h-auto block"
        role="img"
        aria-label="Stakeholder interaction graph"
      >
        <defs>
          {ROLES.map((r) => (
            <marker
              key={`arrow-${r}`}
              id={`vi-arrow-${r}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={ROLE_COLOR[r]} />
            </marker>
          ))}
          <marker
            id="vi-arrow-fail"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f87171" />
          </marker>
        </defs>

        {/* Background guide circle */}
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r={RADIUS}
          fill="none"
          stroke="#1f2a4a"
          strokeWidth={1}
          strokeDasharray="3 5"
        />

        {/* Pulse rings (drawn before nodes so they sit behind).
            NOT wrapped in AnimatePresence: combining `repeat: Infinity`
            with an exit transition causes framer to never resolve exit,
            leaving ghost pulses from every previously-visited step. Rely
            on React unmounting via the `key` change on step transitions. */}
        {def?.pulse?.map((role) => {
          const p = nodePos(role);
          const pulseColor = failureActive ? "#f87171" : ROLE_COLOR[role];
          return (
            <motion.circle
              key={`pulse-${activeStep}-${role}-${failureActive ? "fail" : "ok"}`}
              cx={p.x}
              cy={p.y}
              fill="none"
              stroke={pulseColor}
              strokeWidth={2}
              initial={{ r: NODE_R, opacity: 0.7 }}
              animate={{ r: NODE_R + 16, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          );
        })}

        {/* Failure ✗ overlay for pulse-only steps that failed verification */}
        {failureActive && !def?.arrows && def?.pulse?.map((role) => {
          const p = nodePos(role);
          return (
            <text
              key={`fail-x-${role}`}
              x={p.x + NODE_R - 4}
              y={p.y - NODE_R + 10}
              textAnchor="middle"
              fontSize="20"
              fontWeight="bold"
              fill="#f87171"
              style={{ pointerEvents: "none" }}
            >
              ✗
            </text>
          );
        })}

        {/* Arrows */}
        <AnimatePresence>
          {def?.arrows?.map((arr, i) => {
            const { sx, sy, ex, ey, mx, my } = arrowGeom(arr.from, arr.to);
            const stroke = failureActive ? "#f87171" : ROLE_COLOR[arr.from];
            const markerId = failureActive ? "vi-arrow-fail" : `vi-arrow-${arr.from}`;
            const labelWidth = arr.label.length * 6 + 12;
            return (
              <g key={`${activeStep}-${i}-${arr.from}-${arr.to}`}>
                <motion.path
                  d={`M ${sx} ${sy} L ${ex} ${ey}`}
                  stroke={stroke}
                  strokeWidth={2.5}
                  fill="none"
                  markerEnd={`url(#${markerId})`}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                />
                {/* Wide invisible hover hit area */}
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke="transparent"
                  strokeWidth={20}
                  onMouseEnter={() => setHover({ x: mx, y: my, verb: arr.verb })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "help" }}
                />
                {/* Label on midpoint */}
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 }}
                  style={{ pointerEvents: "none" }}
                >
                  <rect
                    x={mx - labelWidth / 2}
                    y={my - 9}
                    width={labelWidth}
                    height={16}
                    rx={3}
                    fill="#0b1020"
                    stroke={stroke}
                    strokeWidth={0.75}
                    opacity={0.94}
                  />
                  <text
                    x={mx}
                    y={my + 3}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                    fill={stroke}
                  >
                    {arr.label}
                  </text>
                </motion.g>
                {failureActive && (
                  <text
                    x={ex}
                    y={ey - 14}
                    textAnchor="middle"
                    fontSize="18"
                    fontWeight="bold"
                    fill="#f87171"
                  >
                    ✗
                  </text>
                )}
              </g>
            );
          })}
        </AnimatePresence>

        {/* Nodes */}
        {ROLES.map((role) => {
          const p = nodePos(role);
          const isInvolved = involved.has(role);
          const op = involved.size === 0 ? 1 : isInvolved ? 1 : 0.4;
          return (
            <motion.g
              key={role}
              animate={{ opacity: op }}
              transition={{ duration: 0.3 }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                fill="#0b1020"
                stroke={ROLE_COLOR[role]}
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y + 6}
                textAnchor="middle"
                fontSize="18"
                fontWeight="bold"
                fontFamily="ui-monospace, monospace"
                fill={ROLE_COLOR[role]}
                style={{ pointerEvents: "none" }}
              >
                {ROLE_GLYPH[role]}
              </text>
              <text
                x={p.x}
                y={p.y + NODE_R + 14}
                textAnchor="middle"
                fontSize="10"
                fill="#7b87a8"
                style={{ pointerEvents: "none" }}
              >
                {ROLE_LABEL[role]}
              </text>
              <text
                x={p.x}
                y={p.y + NODE_R + 26}
                textAnchor="middle"
                fontSize="8.5"
                fill="#4f5a7e"
                fontStyle="italic"
                style={{ pointerEvents: "none" }}
              >
                {ROLE_REAL_WORLD[role]}
              </text>
            </motion.g>
          );
        })}
      </svg>

      {/* Hover tooltip (HTML, positioned by SVG coords) */}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute pointer-events-none text-[11px] px-2 py-1 rounded bg-[#0b1020] border border-[#1f2a4a] text-white shadow-lg whitespace-nowrap"
            style={{
              left: `${(hover.x / SIZE) * 100}%`,
              top: `${(hover.y / HEIGHT) * 100}%`,
              transform: "translate(-50%, -140%)",
              maxWidth: 240,
              whiteSpace: "normal",
            }}
          >
            {hover.verb}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status strip below the graph */}
      <div className="text-[10px] text-[#7b87a8] px-3 pb-2 pt-1 flex items-center gap-2">
        {def ? (
          <>
            <span className="font-mono text-[#4f5a7e]">step #{activeStep}</span>
            <span>·</span>
            <span>
              {def.arrows
                ? `${def.arrows.length} message${def.arrows.length > 1 ? "s" : ""} in flight`
                : def.pulse
                ? `${def.pulse.map((r) => ROLE_LABEL[r]).join(", ")} working locally`
                : ""}
            </span>
            {failureActive && (
              <span className="ml-auto px-1.5 py-0.5 rounded bg-[#f8717122] text-[#f87171] font-semibold tracking-wider">
                VERIFIER REJECTED
              </span>
            )}
          </>
        ) : (
          <span className="italic text-[#4f5a7e]">
            pick a step on the timeline to see who talks to whom
          </span>
        )}
      </div>

      {/* "In payments terms" caption — anchors the active step in legacy
          payment-rail terminology for newcomers without an agentic mental model. */}
      {plainPayments && (
        <div className="text-[11px] italic leading-snug text-[#a4b0d0] px-3 pb-2 border-t border-[#1f2a4a] pt-2">
          <span className="text-[#7b87a8] not-italic uppercase tracking-wider text-[9px] font-semibold mr-2">
            In payments terms
          </span>
          {plainPayments}
        </div>
      )}
    </div>
  );
}
