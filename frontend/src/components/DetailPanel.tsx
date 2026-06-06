import { JsonView, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import type { FlowEvent } from "../types";
import { NARRATIVES } from "../narratives";

interface Props {
  event: FlowEvent | null;
}

export function DetailPanel({ event }: Props) {
  if (!event) {
    return (
      <div className="h-full overflow-auto p-4 text-[15px] text-[#a4b0d0] leading-relaxed">
        <div className="text-xs uppercase tracking-wider text-[#7b87a8] mb-2">
          How to read this dashboard
        </div>
        <p className="mb-3">
          Click <span className="text-white">Run Demo</span> to watch an
          autonomous Verifiable Intent purchase unfold. Each colored dot in the
          timeline is one event; each role column collects its own events as
          they happen.
        </p>
        <p className="mb-3">
          Click any event card (or any timeline dot) to load that step here —
          you'll see a plain-English explanation plus the raw signed payload.
        </p>
        <p className="text-[#7b87a8] text-sm">
          Tip: open the <span className="text-white">credential</span> →{" "}
          <span className="text-white">disclosures</span> array to see exactly
          which fields each verifier was allowed to learn about.
        </p>
      </div>
    );
  }

  const narrative = NARRATIVES[event.action];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/10">
          step #{event.step}
        </span>
        <span className="text-xs uppercase tracking-wider text-[#7b87a8]">
          {event.role} · {event.action}
        </span>
      </div>

      {narrative && (
        <div className="mb-4 rounded-md border border-[#1f2a4a] bg-[#0e1530] p-3">
          <div className="text-base font-semibold text-white mb-1.5">
            {narrative.title}
          </div>
          <p className="text-[14px] text-[#d4dcf0] leading-relaxed mb-2">
            {narrative.summary}
          </p>
          <p className="text-[13px] text-[#7b87a8] leading-relaxed italic">
            {narrative.why}
          </p>
          {narrative.plain_payments && (
            <div className="mt-2 pt-2 border-t border-[#1f2a4a] text-[12px] text-[#d4dcf0] leading-relaxed">
              <span className="text-[#7b87a8] uppercase tracking-wider text-[9px] font-semibold mr-2">
                In payments terms
              </span>
              {narrative.plain_payments}
            </div>
          )}
          {narrative.real_world && (
            <div className="mt-2 pt-2 border-t border-[#1f2a4a] text-[12px] text-[#d4dcf0] leading-relaxed">
              <span className="text-emerald-400 uppercase tracking-wider text-[9px] font-semibold mr-2">
                In real life
              </span>
              {narrative.real_world}
            </div>
          )}
          {narrative.production_note && (
            <div className="mt-2 pt-2 border-t border-[#1f2a4a] text-[12px] text-[#d4dcf0] leading-relaxed">
              <span className="text-amber-400 uppercase tracking-wider text-[9px] font-semibold mr-2">
                In production
              </span>
              {narrative.production_note}
            </div>
          )}
          {narrative.look_at && narrative.look_at.length > 0 && (            <div className="mt-2 pt-2 border-t border-[#1f2a4a]">
              <div className="text-xs uppercase tracking-wider text-[#7b87a8] mb-1">
                Worth opening below
              </div>
              <div className="flex flex-wrap gap-1">
                {narrative.look_at.map((f) => (
                  <code
                    key={f}
                    className="text-xs px-1.5 py-0.5 rounded bg-[#1f2a4a] text-[#7aa2ff] font-mono"
                  >
                    {f}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-[15px] text-white mb-2">{event.summary}</div>
      <div className="text-xs uppercase tracking-wider text-[#7b87a8] mb-1">
        Raw signed payload
      </div>
      <div className="json-viewer rounded-md border border-[#1f2a4a] bg-[#0b1020] p-3">
        <JsonView
          data={event.payload ?? {}}
          shouldExpandNode={(level) => level < 2}
          style={darkStyles}
        />
      </div>
    </div>
  );
}
