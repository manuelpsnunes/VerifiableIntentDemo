import { create } from "zustand";
import type { FlowEvent, RoleKey, Catalog } from "./types";

// Backend origin. In Vite dev the frontend runs on :5173 and the API on :8000;
// in production the built frontend is served same-origin by FastAPI, so an
// empty base (relative URLs) "just works". Override with window.__VI_API_URL__.
const API_URL =
  (typeof window !== "undefined" && (window as any).__VI_API_URL__) ||
  (typeof window !== "undefined" && window.location.port === "5173"
    ? "http://localhost:8000"
    : "");

// Delay between revealing successive events client-side, mirroring the
// backend's former STEP_PACING_S streaming cadence.
const PACING_MS = 600;

export interface StepMeta {
  index: number;
  action: string;
  title: string;
  role: string;
}

export interface SessionStatus {
  active: boolean;
  total_steps: number;
  next_step_index: number | null;
  next_step: StepMeta | null;
  done: boolean;
  summary: any;
  just_ran?: StepMeta;
  error?: string;
}

export type InjectionMode =
  | "tamper_l2_sd_hash"
  | "exceed_budget"
  | "bad_checkout_hash";

interface FlowState {
  connected: boolean;
  events: FlowEvent[]; // reference-track events (existing consumers default here)
  injectionEvents: FlowEvent[]; // injection-track events (empty unless an injection ran)
  injectionMode: InjectionMode | null;
  injectionRunning: boolean;
  roles: RoleKey[];
  catalog: Catalog | null;
  running: boolean;
  selectedStep: number | null;
  stepTable: StepMeta[];
  session: SessionStatus | null;
  init: () => void;
  selectStep: (n: number | null) => void;
  runDemo: (prompt: string, budgetUsd: number) => Promise<void>;
  runInjection: (
    mode: InjectionMode,
    prompt: string,
    budgetUsd: number
  ) => Promise<void>;
  clearInjection: () => void;
  startStepped: (prompt: string, budgetUsd: number) => Promise<void>;
  nextStep: () => Promise<void>;
  resetSession: () => Promise<void>;
  resetEvents: () => void;
}

type SetState = (
  partial: Partial<FlowState> | ((s: FlowState) => Partial<FlowState>)
) => void;

// Fold a single event into the store, mirroring the role/track routing the
// WebSocket consumer used to do. A fresh `demo_started` resets that track.
function applyEvent(set: SetState, evt: FlowEvent) {
  const track = evt.track ?? "reference";
  if (evt.action === "demo_started") {
    if (track === "injection") {
      set(() => ({ injectionEvents: [evt] }));
    } else {
      set(() => ({ events: [evt], selectedStep: null }));
    }
    return;
  }
  const done = evt.action === "demo_complete" || evt.action === "demo_failed";
  set((s) => {
    if (track === "injection") {
      return {
        injectionEvents: [...s.injectionEvents, evt],
        injectionRunning: done ? false : s.injectionRunning,
      };
    }
    return {
      events: [...s.events, evt],
      // Auto-advance the selected step to the freshly revealed event so the UI
      // follows the run without requiring a manual click.
      selectedStep: evt.step,
      running: done ? false : s.running,
    };
  });
}

// Reveal a returned event list one at a time, paced like the old stream.
async function replay(events: FlowEvent[], set: SetState) {
  for (let i = 0; i < events.length; i++) {
    applyEvent(set, events[i]);
    if (i < events.length - 1) {
      await new Promise((r) => setTimeout(r, PACING_MS));
    }
  }
}

export const useFlowStore = create<FlowState>((set, get) => ({
  connected: false,
  events: [],
  injectionEvents: [],
  injectionMode: null,
  injectionRunning: false,
  roles: [],
  catalog: null,
  running: false,
  selectedStep: null,
  stepTable: [],
  session: null,

  init: () => {
    // Fetch catalog + roles + step table once. The catalog fetch doubles as a
    // reachability probe that drives the connection indicator.
    fetch(`${API_URL}/api/catalog`)
      .then((r) => r.json())
      .then((data) => set({ catalog: data, connected: true }))
      .catch(() => set({ connected: false }));
    fetch(`${API_URL}/api/roles`)
      .then((r) => r.json())
      .then((data: { roles: RoleKey[] }) => set({ roles: data.roles }))
      .catch(() => {});
    fetch(`${API_URL}/api/demo/steps`)
      .then((r) => r.json())
      .then((data: { steps: StepMeta[] }) => set({ stepTable: data.steps }))
      .catch(() => {});
  },

  selectStep: (n) => set({ selectedStep: n }),

  resetEvents: () =>
    set({
      events: [],
      injectionEvents: [],
      injectionMode: null,
      selectedStep: null,
    }),

  runDemo: async (prompt, budgetUsd) => {
    if (get().running) return;
    // If a stepped session is in flight, clear it server-side first.
    if (get().session?.active) {
      try {
        await fetch(`${API_URL}/api/demo/reset`, { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    set({
      running: true,
      events: [],
      injectionEvents: [],
      injectionMode: null,
      selectedStep: null,
      session: null,
    });
    try {
      const res = await fetch(`${API_URL}/api/demo/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, budget_usd: budgetUsd }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Demo run failed:", res.status, text);
        set({ running: false });
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        events?: FlowEvent[];
        error?: string;
      };
      if (!data.ok || !data.events) {
        console.error("Demo run error:", data.error);
        set({ running: false });
        return;
      }
      await replay(data.events, set);
      // Safety: clear the lock even if the run ended without a terminal event.
      set({ running: false });
    } catch (e) {
      console.error(e);
      set({ running: false });
    }
  },

  runInjection: async (mode, prompt, budgetUsd) => {
    if (get().running || get().injectionRunning) return;
    // Reference track must exist; otherwise run it first.
    if (get().events.length === 0) {
      await get().runDemo(prompt, budgetUsd);
    }
    set({
      injectionRunning: true,
      injectionEvents: [],
      injectionMode: mode,
    });
    try {
      const res = await fetch(`${API_URL}/api/demo/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prompt, budget_usd: budgetUsd }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Injection failed:", res.status, text);
        set({ injectionRunning: false });
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        events?: FlowEvent[];
        error?: string;
      };
      if (!data.ok || !data.events) {
        console.error("Injection error:", data.error);
        set({ injectionRunning: false });
        return;
      }
      await replay(data.events, set);
      set({ injectionRunning: false });
    } catch (e) {
      console.error(e);
      set({ injectionRunning: false });
    }
  },

  clearInjection: () =>
    set({
      injectionEvents: [],
      injectionMode: null,
      injectionRunning: false,
    }),

  startStepped: async (prompt, budgetUsd) => {
    if (get().running) return;
    set({ events: [], selectedStep: null, running: false });
    try {
      const res = await fetch(`${API_URL}/api/demo/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, budget_usd: budgetUsd }),
      });
      const data = (await res.json()) as SessionStatus;
      set({ session: data });
    } catch (e) {
      console.error("startStepped failed", e);
    }
  },

  nextStep: async () => {
    const session = get().session;
    if (!session || session.done) return;
    try {
      const res = await fetch(`${API_URL}/api/demo/step`, { method: "POST" });
      const data = (await res.json()) as SessionStatus & {
        events?: FlowEvent[];
      };
      // Render the event(s) this step produced, then update session status.
      for (const evt of data.events ?? []) applyEvent(set, evt);
      set({ session: data });
    } catch (e) {
      console.error("nextStep failed", e);
    }
  },

  resetSession: async () => {
    try {
      const res = await fetch(`${API_URL}/api/demo/reset`, { method: "POST" });
      const data = (await res.json()) as SessionStatus;
      set({ session: data, events: [], selectedStep: null, running: false });
    } catch (e) {
      console.error("resetSession failed", e);
    }
  },
}));
