import { motion } from "framer-motion";
import type { FlowEvent } from "../types";
import { ROLE_COLOR } from "../roleTheme";

interface Props {
  events: FlowEvent[];
  selectedStep: number | null;
  onSelect: (step: number) => void;
}

export function Timeline({ events, selectedStep, onSelect }: Props) {
  return (
    <div className="w-full overflow-x-auto py-2">
      <div className="flex items-center gap-1 min-w-max px-2">
        {events.map((e, i) => {
          const color = ROLE_COLOR[e.role] || "#7b87a8";
          const active = selectedStep === e.step;
          return (
            <div key={e.step + ":" + e.action} className="flex items-center">
              <motion.button
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                onClick={() => onSelect(e.step)}
                title={`${e.role} · ${e.action} · ${e.summary}`}
                className={
                  "flex flex-col items-center px-2 py-1 rounded-md transition " +
                  (active ? "bg-white/10" : "hover:bg-white/5")
                }
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: color,
                    boxShadow: active ? `0 0 0 3px ${color}55` : undefined,
                  }}
                />
                <div className="text-[10px] mt-1 text-white/70 font-mono">
                  #{e.step}
                </div>
                <div className="text-[9px] text-[#7b87a8] uppercase tracking-wider">
                  {e.role}
                </div>
              </motion.button>
              {i < events.length - 1 && (
                <div className="w-4 h-px bg-[#1f2a4a]" />
              )}
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="text-xs text-[#4f5a7e] italic px-4 py-2">
            timeline empty — run the demo
          </div>
        )}
      </div>
    </div>
  );
}
