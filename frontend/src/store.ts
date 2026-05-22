import { create } from "zustand";
import type { FlowEvent, RoleKey, Catalog } from "./types";

const WS_URL =
  (typeof window !== "undefined" && (window as any).__VI_WS_URL__) ||
  "ws://localhost:8000/ws/events";
const API_URL =
  (typeof window !== "undefined" && (window as any).__VI_API_URL__) ||
  "http://localhost:8000";

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

let socket: WebSocket | null = null;

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
    // Fetch catalog + roles + step table once.
    fetch(`${API_URL}/api/catalog`)
      .then((r) => r.json())
      .then((data) => set({ catalog: data }))
      .catch(() => {});
    fetch(`${API_URL}/api/roles`)
      .then((r) => r.json())
      .then((data: { roles: RoleKey[] }) => set({ roles: data.roles }))
      .catch(() => {});
    fetch(`${API_URL}/api/demo/steps`)
      .then((r) => r.json())
      .then((data: { steps: StepMeta[] }) => set({ stepTable: data.steps }))
      .catch(() => {});

    if (socket) return;
    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => set({ connected: true });
      socket.onclose = () => {
        set({ connected: false });
        socket = null;
        setTimeout(connect, 1500);
      };
      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          /* ignore */
        }
      };
      socket.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data) as FlowEvent;
          const track = evt.track ?? "reference";
          // If a fresh `demo_started` arrives, clear that track's events but do
          // NOT flip `running`/`injectionRunning` to true here — those are owned
          // by runDemo/runInjection. The WS replay on reconnect can otherwise
          // spuriously enable the "Running…" lock.
          if (evt.action === "demo_started") {
            if (track === "injection") {
              set({ injectionEvents: [evt] });
            } else {
              set({ events: [evt], selectedStep: null });
            }
            return;
          }
          set((s) => {
            if (track === "injection") {
              return {
                injectionEvents: [...s.injectionEvents, evt],
                injectionRunning:
                  evt.action === "demo_complete" ? false : s.injectionRunning,
              };
            }
            return {
              events: [...s.events, evt],
              running:
                evt.action === "demo_complete" ? false : s.running,
            };
          });
        } catch (e) {
          // ignore malformed
        }
      };
    };
    connect();
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
      }
      // Success: events stream via WebSocket; `running` clears on demo_complete.
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
      }
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
      const data = (await res.json()) as SessionStatus;
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
