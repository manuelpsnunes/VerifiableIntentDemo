import { motion } from "framer-motion";
import type { FlowEvent, Role } from "../types";
import { ROLE_COLOR, ROLE_GLYPH, ROLE_LABEL } from "../roleTheme";

interface Props {
  events: FlowEvent[];
  selectedStep: number | null;
  onSelect: (step: number) => void;
}

const ROLES: Role[] = ["issuer", "wallet", "agent", "merchant", "network"];

export function RoleHistoryStrip({ events, selectedStep, onSelect }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ROLES.map((role) => {
        const mine = events.filter((e) => e.role === role);
        const last = mine[mine.length - 1];
        const color = ROLE_COLOR[role];
        const isSelected = last && selectedStep === last.step;

        return (
          <div
            key={role}
            className="rounded-md border bg-[#0e1530] overflow-hidden"
            style={{ borderColor: color + "30" }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2 px-2 py-1 border-b"
              style={{ borderColor: color + "20", background: color + "10" }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: color, color: "#0b1020" }}
              >
                {ROLE_GLYPH[role]}
              </div>
              <span className="text-[11px] font-semibold text-white">
                {ROLE_LABEL[role]}
              </span>
              <span className="ml-auto text-[9px] font-mono text-[#7b87a8]">
                {mine.length}
              </span>
            </div>

            {/* Last action */}
            <div className="p-2">
              {last ? (
                <motion.button
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onSelect(last.step)}
                  className={
                    "w-full text-left rounded px-2 py-1.5 text-[10px] leading-tight transition " +
                    (isSelected
                      ? "bg-white/10 ring-1 ring-white/30"
                      : "hover:bg-white/5")
                  }
                  title={last.summary}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[9px] font-mono px-1 rounded"
                      style={{ background: color + "30", color }}
                    >
                      #{last.step}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-[#7b87a8] truncate">
                      {last.action}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/80 line-clamp-2">
                    {last.summary}
                  </div>
                </motion.button>
              ) : (
                <div className="text-[10px] text-[#4f5a7e] italic px-2 py-1">
                  idle
                </div>
              )}

              {/* Step dots */}
              {mine.length > 1 && (
                <div className="flex gap-0.5 mt-1.5 pl-2 flex-wrap">
                  {mine.slice(0, -1).map((e) => (
                    <button
                      key={e.step + ":" + e.action}
                      onClick={() => onSelect(e.step)}
                      title={`#${e.step} · ${e.action}`}
                      className={
                        "w-2 h-2 rounded-full transition " +
                        (selectedStep === e.step
                          ? "ring-1 ring-white"
                          : "hover:scale-125")
                      }
                      style={{ background: color + "80" }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
