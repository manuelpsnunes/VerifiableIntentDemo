import { useEffect, useMemo, useState } from "react";
import { useFlowStore } from "./store";
import { Timeline } from "./components/Timeline";
import { CatalogModal } from "./components/CatalogModal";
import { CredentialStack } from "./components/CredentialStack";
import { ConceptStage } from "./components/ConceptStage";
import { RoleHistoryStrip } from "./components/RoleHistoryStrip";
import { SpecDrawer } from "./components/SpecDrawer";
import { DisclosureMatrix } from "./components/DisclosureMatrix";
import { StakeholderGraph } from "./components/StakeholderGraph";
import { FailureInjector } from "./components/FailureInjector";
import { getSpecRef } from "./specRefs";
import { NARRATIVES } from "./narratives";

function statusPill(label: string, ok: boolean | null) {
  const cls = ok === null
    ? "bg-[#1f2a4a] text-[#7b87a8]"
    : ok
    ? "bg-[#34d39922] text-[#34d399]"
    : "bg-[#f8717122] text-[#f87171]";
  return (
    <span className={"text-[10px] uppercase tracking-wider px-2 py-1 rounded " + cls}>
      {label}: {ok === null ? "—" : ok ? "ok" : "fail"}
    </span>
  );
}

export default function App() {
  const init = useFlowStore((s) => s.init);
  const connected = useFlowStore((s) => s.connected);
  const events = useFlowStore((s) => s.events);
  const injectionEvents = useFlowStore((s) => s.injectionEvents);
  const injectionMode = useFlowStore((s) => s.injectionMode);
  const running = useFlowStore((s) => s.running);
  const catalog = useFlowStore((s) => s.catalog);
  const selectedStep = useFlowStore((s) => s.selectedStep);
  const selectStep = useFlowStore((s) => s.selectStep);
  const runDemo = useFlowStore((s) => s.runDemo);
  const startStepped = useFlowStore((s) => s.startStepped);
  const nextStep = useFlowStore((s) => s.nextStep);
  const resetSession = useFlowStore((s) => s.resetSession);
  const session = useFlowStore((s) => s.session);

  const [prompt, setPrompt] = useState(
    "Buy me a good Babolat tennis racket under $400"
  );
  const [budget, setBudget] = useState(400);
  const [showCatalog, setShowCatalog] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);

  const sessionActive = !!session?.active;
  const sessionDone = !!session?.done;
  const nextStepMeta = session?.next_step ?? null;
  const handleStepClick = async () => {
    if (!sessionActive) {
      await startStepped(prompt, budget);
    } else if (!sessionDone) {
      await nextStep();
    }
  };
  const stepButtonLabel = !sessionActive
    ? "Step mode ▸"
    : sessionDone
    ? "All steps done"
    : `Next ▸ #${nextStepMeta?.index} ${nextStepMeta?.title ?? ""}`;

  useEffect(() => {
    init();
  }, [init]);

  // Keyboard: `s` toggles the spec drawer (ignored when typing in an input).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSpecOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selected = useMemo(
    () => events.find((e) => e.step === selectedStep) ?? null,
    [events, selectedStep]
  );

  // Matching event in the injection track (same step), used for side-by-side compare.
  const selectedInjection = useMemo(
    () =>
      injectionEvents.length > 0 && selectedStep !== null
        ? injectionEvents.find((e) => e.step === selectedStep) ?? null
        : null,
    [injectionEvents, selectedStep]
  );

  const selectedSpec = selected ? getSpecRef(selected.action) : null;

  // Pull demo_complete summary for status bar.
  const summaryEvt = events.find((e) => e.action === "demo_complete");
  const summary = summaryEvt?.payload?.summary as
    | {
        chain_valid: boolean;
        constraints_satisfied: boolean;
        authorized: boolean;
        authorization_id: string | null;
        product?: { sku: string; name: string };
        amount_cents?: number;
        currency?: string;
      }
    | undefined;

  return (
    <div className="min-h-full w-full flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1f2a4a] px-6 py-4 flex items-center gap-6">
        <div>
          <div className="text-lg font-semibold">Verifiable Intent — Live Demo</div>
          <div className="text-xs text-[#7b87a8]">
            L1 → L2 → L3 selectively-disclosed mandate chain · Claude agent · mock card network
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={
              "w-2 h-2 rounded-full " +
              (connected ? "bg-[#34d399]" : "bg-[#f87171]")
            }
          />
          <span className="text-xs text-[#7b87a8]">
            {connected ? "online" : "offline"}
          </span>
        </div>
      </header>

      {/* Controls */}
      <section className="border-b border-[#1f2a4a] px-6 py-3 flex flex-wrap items-center gap-3 bg-[#0e1530]">
        <input
          className="flex-1 min-w-[300px] bg-[#0b1020] border border-[#1f2a4a] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#7aa2ff]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should the agent buy?"
          disabled={running}
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#7b87a8]">budget $</span>
          <input
            type="number"
            min={10}
            max={1000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value) || 0)}
            className="w-24 bg-[#0b1020] border border-[#1f2a4a] rounded-md px-2 py-2 text-sm focus:outline-none focus:border-[#7aa2ff]"
            disabled={running}
          />
        </div>
        <button
          onClick={() => runDemo(prompt, budget)}
          disabled={running || !connected || !prompt.trim()}
          className="px-4 py-2 rounded-md text-sm font-semibold bg-[#7aa2ff] text-[#0b1020] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Running…" : "Run Demo"}
        </button>

        <button
          onClick={handleStepClick}
          disabled={
            running ||
            !connected ||
            !prompt.trim() ||
            sessionDone
          }
          title={
            sessionActive
              ? "Run the next step manually"
              : "Start a step-by-step walk-through"
          }
          className="px-3 py-2 rounded-md text-sm font-semibold border border-[#7aa2ff] text-[#7aa2ff] hover:bg-[#7aa2ff22] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {stepButtonLabel}
        </button>

        {sessionActive && (
          <button
            onClick={resetSession}
            className="px-3 py-2 rounded-md text-xs border border-[#1f2a4a] text-[#7b87a8] hover:text-white hover:border-[#2c3a66]"
            title="Cancel the manual session and clear events"
          >
            Reset
          </button>
        )}

        {catalog && (
          <button
            onClick={() => setShowCatalog(true)}
            className="ml-auto text-xs text-[#7b87a8] hover:text-white border border-[#1f2a4a] hover:border-[#2c3a66] rounded-md px-3 py-2 transition"
            title="View available products"
          >
            merchant: <span className="text-white">{catalog.merchant.name}</span> ·{" "}
            <span className="text-[#7aa2ff]">{catalog.products.length} products ▸</span>
          </button>
        )}
      </section>

      {/* "ChatGPT example" strip — anchors the abstract chain in a real-life story. */}
      {(events.length > 0 || sessionActive) && (() => {
        const activeEvt =
          (selectedStep !== null && events.find((e) => e.step === selectedStep)) ||
          events[events.length - 1];
        const realWorld =
          activeEvt && NARRATIVES[activeEvt.action]?.real_world;
        return (
          <section className="border-b border-emerald-500/20 px-6 py-2 bg-emerald-500/[0.04] flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-semibold uppercase tracking-wider shrink-0">
              In real life
            </span>
            <span className="text-[#7b87a8] shrink-0">
              user prompt:
            </span>
            <span className="text-white shrink-0 truncate max-w-[40ch]" title={prompt}>
              "{prompt}"
            </span>
            {realWorld && (
              <>
                <span className="text-[#2c3a66] shrink-0">·</span>
                <span className="text-[#d4dcf0] italic leading-snug">{realWorld}</span>
              </>
            )}
          </section>
        );
      })()}

      {/* Stepped-session progress bar */}
      {sessionActive && (
        <section className="border-b border-[#1f2a4a] px-6 py-2 bg-[#0a0f25] flex items-center gap-4 text-xs">
          <span className="text-[#7aa2ff] font-semibold uppercase tracking-wider">
            Step mode
          </span>
          <span className="text-[#7b87a8]">
            {sessionDone
              ? `Done · ${session?.total_steps}/${session?.total_steps} steps`
              : `Next: step ${nextStepMeta?.index} / ${(session?.total_steps ?? 12) - 1}`}
          </span>
          {nextStepMeta && !sessionDone && (
            <span className="text-white">
              <span className="px-1.5 py-0.5 rounded bg-[#1f2a4a] text-[10px] uppercase tracking-wider mr-2">
                {nextStepMeta.role}
              </span>
              {nextStepMeta.title}
            </span>
          )}
          {/* progress dots */}
          <span className="ml-auto flex gap-1">
            {Array.from({ length: session?.total_steps ?? 12 }).map((_, i) => {
              const done = (session?.next_step_index ?? 0) > i;
              const upNext = (session?.next_step_index ?? -1) === i;
              return (
                <span
                  key={i}
                  className={
                    "w-2 h-2 rounded-full " +
                    (done
                      ? "bg-[#34d399]"
                      : upNext
                      ? "bg-[#7aa2ff] animate-pulse"
                      : "bg-[#1f2a4a]")
                  }
                  title={`step ${i}`}
                />
              );
            })}
          </span>
        </section>
      )}

      {/* Failure injection control panel */}
      <section className="px-6 py-3 border-b border-[#1f2a4a] bg-[#0a0f25]">
        <FailureInjector prompt={prompt} budgetUsd={budget} />
      </section>

      {/* Persistent credential chain ribbon */}
      <CredentialStack
        events={events}
        currentStep={selectedStep}
        onSelect={selectStep}
      />

      {/* Timeline */}
      <section className="border-b border-[#1f2a4a] px-2 bg-[#0b1020]">
        <Timeline
          events={events}
          selectedStep={selectedStep}
          onSelect={selectStep}
        />
      </section>

      {/* Status bar */}
      <section className="px-6 py-2 border-b border-[#1f2a4a] flex items-center gap-2 text-xs bg-[#0e1530]">
        {statusPill("chain", summary ? summary.chain_valid : null)}
        {statusPill(
          "constraints",
          summary ? summary.constraints_satisfied : null
        )}
        {statusPill("authorized", summary ? summary.authorized : null)}
        {summary?.authorization_id && (
          <span className="font-mono text-[10px] text-[#7b87a8]">
            auth_id: {summary.authorization_id}
          </span>
        )}
        {summary?.product && (
          <span className="ml-auto text-[12px] text-white">
            {summary.product.name} —{" "}
            {((summary.amount_cents ?? 0) / 100).toFixed(2)}{" "}
            {summary.currency}
          </span>
        )}
      </section>

      {/* Main grid: Concept Stage centerpiece + Inspector */}
      <div className="grid grid-cols-12 gap-3 p-3">
        <div className="col-span-8 rounded-lg border border-[#1f2a4a] bg-[#111933]">
          <div className="px-4 py-2 text-xs uppercase tracking-wider text-[#7b87a8] border-b border-[#1f2a4a] flex items-center gap-2">
            <span>Concept stage</span>
            {selected && (
              <span className="text-[10px] font-mono text-[#4f5a7e]">
                step #{selected.step}
              </span>
            )}
            {selected && selectedSpec && (
              <button
                onClick={() => setSpecOpen(true)}
                className="ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-[#7aa2ff] text-[#7aa2ff] hover:bg-[#7aa2ff22] transition flex items-center gap-1"
                title="Open the spec drawer (S)"
              >
                <span className="font-mono normal-case">{selectedSpec.section}</span>
                <span>Show spec ↗</span>
              </button>
            )}
          </div>
          <div>
            <ConceptStage
              event={selected}
              totalEvents={events.length}
              allEvents={events}
              injectionEvent={selectedInjection}
              injectionAllEvents={injectionEvents}
              injectionMode={injectionMode}
            />
          </div>
        </div>
        <div className="col-span-4 space-y-3">
          <div className="rounded-lg border border-[#1f2a4a] bg-[#111933]">
            <div className="px-4 py-2 text-xs uppercase tracking-wider text-[#7b87a8] border-b border-[#1f2a4a] flex items-center gap-2">
              <span>Disclosure matrix</span>
              {selected && (
                <button
                  onClick={() => setSpecOpen(true)}
                  className="ml-auto text-[10px] uppercase tracking-wider text-[#7aa2ff] hover:text-white"
                  title="Open the spec drawer for raw payload (S)"
                >
                  Raw payload · Spec ↗
                </button>
              )}
            </div>
            <div>
              <DisclosureMatrix
                events={events}
                selectedStep={selectedStep}
                injectionEvents={injectionEvents}
                injectionMode={injectionMode}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[#1f2a4a] bg-[#111933]">
            <div className="px-4 py-2 text-xs uppercase tracking-wider text-[#7b87a8] border-b border-[#1f2a4a]">
              Stakeholder graph
            </div>
            <div>
              <StakeholderGraph />
            </div>
          </div>
        </div>
      </div>

      {/* Role history strip (collapsed from former 5-column role grid) */}
      <section className="border-t border-[#1f2a4a] px-3 py-2 bg-[#0a0f25]">
        <div className="text-[10px] uppercase tracking-wider text-[#7b87a8] mb-1.5 font-semibold">
          Role history
        </div>
        <RoleHistoryStrip
          events={events}
          selectedStep={selectedStep}
          onSelect={selectStep}
        />
      </section>

      <CatalogModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        catalog={catalog}
        selectedSku={summary?.product?.sku ?? null}
      />

      <SpecDrawer
        open={specOpen}
        onClose={() => setSpecOpen(false)}
        event={selected}
      />
    </div>
  );
}
