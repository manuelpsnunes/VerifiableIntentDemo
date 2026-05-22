import { useFlowStore, type InjectionMode } from "../store";

interface Props {
  prompt: string;
  budgetUsd: number;
}

const MODES: Array<{
  id: InjectionMode;
  label: string;
  blurb: string;
  fails: string;
}> = [
  {
    id: "tamper_l2_sd_hash",
    label: "Tamper L2.sd_hash",
    blurb: "Bind L2 to a different L1",
    fails: "→ chain rejected at verify_chain",
  },
  {
    id: "exceed_budget",
    label: "Exceed budget",
    blurb: "Push product price above budget envelope",
    fails: "→ network constraint check fails",
  },
  {
    id: "bad_checkout_hash",
    label: "Tamper checkout_hash",
    blurb: "Break SHA-256(checkout_jwt) binding",
    fails: "→ merchant rejects L3b binding",
  },
];

export function FailureInjector({ prompt, budgetUsd }: Props) {
  const runInjection = useFlowStore((s) => s.runInjection);
  const clearInjection = useFlowStore((s) => s.clearInjection);
  const injectionMode = useFlowStore((s) => s.injectionMode);
  const injectionRunning = useFlowStore((s) => s.injectionRunning);
  const injectionEvents = useFlowStore((s) => s.injectionEvents);
  const refRunning = useFlowStore((s) => s.running);
  const refEvents = useFlowStore((s) => s.events);

  const canRun = !injectionRunning && !refRunning && refEvents.length > 0;

  return (
    <div className="rounded-lg border border-[#3a1f1f] bg-[#1a0f10] px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-[#f87171]">
          Failure injection
        </span>
        <span className="text-[10px] text-[#7b87a8] italic">
          Inputs are tampered; rejections come from the real SDK.
        </span>
        {injectionMode && (
          <button
            onClick={clearInjection}
            className="ml-auto text-[10px] uppercase tracking-wider text-[#7aa2ff] hover:text-white border border-[#1f2a4a] rounded px-2 py-1"
            title="Drop the injection track and return to reference-only view"
          >
            Clear injection
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const active = injectionMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => runInjection(m.id, prompt, budgetUsd)}
              disabled={!canRun || active}
              className={`text-left px-3 py-2 rounded-md border transition ${
                active
                  ? "border-[#f87171] bg-[#2a1414]"
                  : canRun
                  ? "border-[#3a1f1f] bg-[#0e1530] hover:border-[#f87171]/60 hover:bg-[#1a0f10]"
                  : "border-[#1f2a4a] bg-[#0a0f25] opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                <span className="text-[#f87171]">✗</span>
                <span>{m.label}</span>
                {active && injectionRunning && (
                  <span className="ml-auto text-[9px] uppercase text-[#fbbf24]">
                    running…
                  </span>
                )}
                {active && !injectionRunning && injectionEvents.length > 0 && (
                  <span className="ml-auto text-[9px] uppercase text-[#34d399]">
                    rejected ✓
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#a4b0d0] mt-0.5">{m.blurb}</div>
              <div className="text-[10px] text-[#f87171]/80 italic mt-0.5">
                {m.fails}
              </div>
            </button>
          );
        })}
      </div>

      {!canRun && refEvents.length === 0 && (
        <div className="text-[10px] text-[#7b87a8] italic mt-2">
          Run the reference demo first, then inject a failure to compare.
        </div>
      )}
    </div>
  );
}
