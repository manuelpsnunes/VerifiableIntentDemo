// Event schema mirrors backend/app/orchestrator.py.
// Keep field names in sync with `_emit` payloads.

export type Role =
  | "system"
  | "user"
  | "issuer"
  | "wallet"
  | "agent"
  | "merchant"
  | "network";

export interface FlowEvent {
  step: number;
  role: Role;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  ts: number;
  // Dual-track tagging: "reference" = the happy-path run; "injection" = a
  // tampered run that should fail at a verifier. Optional for back-compat.
  track?: "reference" | "injection";
  run_id?: string;
}

export interface RoleKey {
  role: string;
  kid: string;
  jwk: Record<string, unknown>;
}

export interface Product {
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number; // cents
  price_dollars: number;
  currency: string;
}

export interface Merchant {
  id: string;
  name: string;
  website: string;
}

export interface Catalog {
  merchant: Merchant;
  merchants: Merchant[];
  products: Product[];
  payment_instrument: Record<string, unknown>;
}

export interface DemoSummary {
  prompt: string;
  budget_cents: number;
  product: { sku: string; name: string; brand: string };
  amount_cents: number;
  currency: string;
  authorization_id: string | null;
  chain_valid: boolean;
  constraints_satisfied: boolean;
  authorized: boolean;
  authorization_mode: string;
  authorization_reason: string | null;
}
