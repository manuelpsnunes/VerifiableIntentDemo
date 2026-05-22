// Single source of truth for per-role styling (color, glyph, label).
// Used by Timeline, RoleHistoryStrip, DisclosureMatrix (PARTY_* subset),
// RolePanel, ConceptStage, and the StakeholderGraph widget.

import type { Role } from "./types";

export const ROLE_COLOR: Record<Role, string> = {
  system: "#7b87a8",
  issuer: "#f59e0b",
  wallet: "#34d399",
  agent: "#7aa2ff",
  merchant: "#c084fc",
  network: "#f472b6",
};

export const ROLE_GLYPH: Record<Role, string> = {
  system: "·",
  issuer: "I",
  wallet: "W",
  agent: "A",
  merchant: "M",
  network: "N",
};

export const ROLE_LABEL: Record<Role, string> = {
  system: "System",
  issuer: "Issuer",
  wallet: "Wallet",
  agent: "Agent",
  merchant: "Merchant",
  network: "Network",
};

// The 5 "party" roles that participate in selective-disclosure tracking.
// (System is the orchestrator, not a credential-holding party.)
export type Party = Exclude<Role, "system">;
export const PARTIES: Party[] = ["issuer", "wallet", "agent", "merchant", "network"];

// Concrete real-world examples per role. Purely pedagogical — these brand names
// are *not* implemented anywhere in the demo; they exist so newcomers from a
// traditional payments background can map abstract roles to familiar players.
// "system" is the demo orchestrator (not a real payments party), so it stays
// generic.
export const ROLE_REAL_WORLD: Record<Role, string> = {
  system: "demo orchestrator",
  issuer: "e.g. UBS, Chase",
  wallet: "e.g. Apple Pay, Google Pay",
  agent: "e.g. ChatGPT, Claude",
  merchant: "e.g. Amazon, Nike.com",
  network: "e.g. Visa, Mastercard",
};
