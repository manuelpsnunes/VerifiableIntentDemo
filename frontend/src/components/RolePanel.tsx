import { motion, AnimatePresence } from "framer-motion";
import type { FlowEvent, Role } from "../types";
import { NARRATIVES } from "../narratives";
import { ROLE_COLOR, ROLE_GLYPH } from "../roleTheme";

interface Props {
  role: Role;
  title: string;
  subtitle: string;
  kid?: string;
  events: FlowEvent[];
  selectedStep: number | null;
  onSelect: (step: number) => void;
}

export function RolePanel({
  role,
  title,
  subtitle,
  kid,
  events,
  selectedStep,
  onSelect,
}: Props) {
  const color = ROLE_COLOR[role];
  const mine = events.filter((e) => e.role === role);

  return (
    <div
      className="flex flex-col h-full rounded-lg border bg-[#111933] overflow-hidden"
      style={{ borderColor: color + "40" }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: color + "30", background: color + "12" }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: color, color: "#0b1020" }}
        >
          {ROLE_GLYPH[role]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {title}
          </div>
          <div className="text-[11px] text-[#7b87a8] truncate">{subtitle}</div>
        </div>
      </div>

      {kid && (
        <div className="px-4 py-2 text-[10px] font-mono text-[#7b87a8] border-b border-[#1f2a4a] truncate">
          kid: {kid}
        </div>
      )}

      <div className="flex-1 overflow-auto p-2 space-y-2">
        <AnimatePresence initial={false}>
          {mine.map((e) => {
            const active = selectedStep === e.step;
            const narrative = NARRATIVES[e.action];
            return (
              <motion.button
                key={e.step + ":" + e.action}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => onSelect(e.step)}
                className={
                  "w-full text-left px-3 py-2 rounded-md border text-xs leading-snug transition " +
                  (active
                    ? "border-white/60 bg-white/5"
                    : "border-[#1f2a4a] hover:border-[#2c3a66] bg-[#0e1530]")
                }
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: color + "25", color }}
                  >
                    #{e.step}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[#7b87a8]">
                    {e.action}
                  </span>
                </div>
                {narrative && (
                  <div className="text-[12px] font-semibold text-white mb-0.5">
                    {narrative.title}
                  </div>
                )}
                <div className="text-[11px] text-white/70">{e.summary}</div>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {mine.length === 0 && (
          <div className="text-center text-[11px] text-[#4f5a7e] py-6 italic">
            waiting…
          </div>
        )}
      </div>
    </div>
  );
}
