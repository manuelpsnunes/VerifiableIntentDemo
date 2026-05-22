// Per-step glossary surfaced inside SpecDrawer.
//
// Each Term keeps the *short* definition (1-2 lines) close to its spec
// wording, plus an optional `payments_analog` that maps the term onto the
// legacy / pre-agentic payments world (DPAN, EMV cryptogram, AUTH code …).
//
// `STEP_TERMS` is the per-event-action filter — only the terms relevant
// to the currently-selected step are shown in the drawer, so newcomers
// don't drown in a wall of jargon.
//
// Spec fidelity rule of thumb: definitions paraphrase the live spec at
// https://verifiableintent.dev/spec/ but never invent semantics the spec
// doesn't grant. When something has no legacy analog (e.g. L2 mandates,
// kb-sd-jwt) leave `payments_analog` undefined and say so explicitly.

export interface Term {
  /** Stable id (used as dictionary key and STEP_TERMS reference). */
  id: string;
  /** Display label. Usually the literal token as it appears in payloads. */
  label: string;
  /** 1-2 sentence definition. Plain English, spec-faithful. */
  short: string;
  /** Optional analogy to a traditional (pre-agentic) payments concept. */
  payments_analog?: string;
}

export const GLOSSARY: Record<string, Term> = {
  // ── Crypto primitives ─────────────────────────────────────────────────
  es256: {
    id: "es256",
    label: "ES256",
    short:
      "ECDSA signature scheme over the P-256 curve with SHA-256. The only signing algorithm VI uses; every credential and JWT in the demo is signed with ES256.",
    payments_analog:
      "Same algorithm family used by EMV chip authentication and Apple/Google Pay device attestation.",
  },
  jwk: {
    id: "jwk",
    label: "JWK",
    short:
      "JSON Web Key — a structured JSON representation of a public (or private) key. Each role publishes only the public half of its ES256 JWK.",
    payments_analog:
      "Conceptually like the public-key certificates an EMV terminal pulls from a CA — but here there is no CA, each role just publishes its own.",
  },
  kid: {
    id: "kid",
    label: "kid",
    short:
      "Key ID. Short identifier of the key that signed a given JWT, embedded in the JWS header. Verifiers look up the matching JWK by kid.",
  },

  // ── SD-JWT family ─────────────────────────────────────────────────────
  sd_jwt: {
    id: "sd_jwt",
    label: "SD-JWT",
    short:
      "Selective Disclosure JWT (IETF draft). A JWT where certain claims are stored as hashes inside the signed payload (in `_sd`), while the cleartext lives in a separate disclosures array. The holder chooses which disclosures to reveal per verifier.",
    payments_analog:
      "Lets the same signed credential reveal different fields to the merchant vs the network — no traditional payment artefact does this.",
  },
  kb_sd_jwt: {
    id: "kb_sd_jwt",
    label: "KB-SD-JWT",
    short:
      "Key-Bound SD-JWT. An SD-JWT whose `cnf.jwk` claim binds it to a specific public key — that key must sign a fresh proof-of-possession JWT each time the credential is presented.",
    payments_analog:
      "Same idea as Apple Pay's per-transaction cryptogram being signed by the Secure Element's device key.",
  },
  _sd: {
    id: "_sd",
    label: "_sd",
    short:
      "Array of base64url-encoded SHA-256 hashes inside an SD-JWT payload. Each hash hides one selectively-disclosable claim; the matching cleartext value lives in the disclosures array.",
  },
  disclosures: {
    id: "disclosures",
    label: "disclosures",
    short:
      "Side array of `[salt, claim_name, claim_value]` triples that travel with an SD-JWT. The holder includes only the disclosures a given verifier is allowed to see; the verifier rehashes each one and matches it against the `_sd` array inside the signed payload.",
  },
  cnf_jwk: {
    id: "cnf_jwk",
    label: "cnf.jwk",
    short:
      "Confirmation claim. The public JWK that the credential is *bound to* — only the holder of the matching private key can derive children from it or present it. Used by L1 (binds to user device key) and L2 (binds to delegated agent key).",
    payments_analog:
      "Same role as Apple Pay's binding of a DPAN to the device's Secure Element key.",
  },
  sd_hash: {
    id: "sd_hash",
    label: "sd_hash",
    short:
      "SHA-256 of the parent SD-JWT's compact serialization. L2 includes `sd_hash = SHA-256(L1)`; L3 includes `sd_hash = SHA-256(L2_view)`. This is how a child credential cryptographically commits to its parent.",
    payments_analog:
      "Closest analog: the way an EMV transaction's MAC commits to the cryptogram of the preceding step in chip-and-PIN.",
  },

  // ── Credential layers (the VI-specific concepts) ──────────────────────
  l1: {
    id: "l1",
    label: "L1 (card credential)",
    short:
      "The bottom layer: an issuer-signed SD-JWT representing the user's payment instrument. Bound via `cnf.jwk` to the user's device key.",
    payments_analog:
      "Like Apple Pay's network token (DPAN) bound to a device's Secure Element.",
  },
  l2: {
    id: "l2",
    label: "L2 (mandate)",
    short:
      "The middle layer: a KB-SD-JWT signed by the user's wallet, encoding constraints (allowed merchants, line items, amount range, payees) and delegating execution authority to the agent's key via `cnf.jwk`. Cryptographically bound to L1 via `sd_hash`.",
    payments_analog:
      "No legacy analog — agents are the new piece. Closest cultural analog is a power-of-attorney, but for spending and machine-readable.",
  },
  l3a: {
    id: "l3a",
    label: "L3a (payment)",
    short:
      "Per-transaction credential the agent signs for the *network*. Carries amount + payee but not the cart. Bound to L2 via `delegate_payload`; its `transaction_id` equals L3b's `checkout_hash`.",
    payments_analog:
      "The network-facing half of an EMV cryptogram — proof that this specific payment was authorized.",
  },
  l3b: {
    id: "l3b",
    label: "L3b (checkout)",
    short:
      "Per-transaction credential the agent signs for the *merchant*. Carries the cart plus a SHA-256 of the checkout JWT, but not the budget. Bound to L2 via `delegate_payload`; its `checkout_hash` equals L3a's `transaction_id`.",
    payments_analog:
      "The merchant-facing half of an EMV cryptogram — proof that this specific cart was authorized.",
  },
  delegate_payload: {
    id: "delegate_payload",
    label: "delegate_payload",
    short:
      "Field inside L3a/L3b that references the L2 it was derived from, via L2 disclosure hashes. This is what stitches L3 back to L2 without leaking L2's contents.",
  },
  mandate: {
    id: "mandate",
    label: "mandate",
    short:
      "The VI term for an L2 credential — a signed grant of spending authority from the user to the agent, bounded by four constraints.",
  },
  constraints: {
    id: "constraints",
    label: "constraints",
    short:
      "The four signed bounds inside L2: `allowed_payees`, `acceptable_items` (catalog of allowed SKUs), `amount_range` (currency + max), and `allowed_merchants`. The agent cannot legally act outside these.",
    payments_analog:
      "Comparable to merchant-category-code (MCC) restrictions on a corporate card — but cryptographically enforced, not just policy.",
  },
  autonomous_mode: {
    id: "autonomous_mode",
    label: "autonomous mode",
    short:
      "One of two L3 execution modes in the spec. The agent acts without a live cardholder challenge; L2's pre-signed constraints + L3's chain are the only authorization the network needs.",
  },

  // ── Checkout / payment integrity ──────────────────────────────────────
  jwt: {
    id: "jwt",
    label: "JWT",
    short:
      "JSON Web Token — a compact, signed JSON object (`header.payload.signature`). The base building block; SD-JWT, L1/L2/L3 and the checkout JWT are all JWT variants.",
  },
  checkout_jwt: {
    id: "checkout_jwt",
    label: "checkout JWT",
    short:
      "JWT signed by the merchant listing the exact cart (line items, currency, total). Becomes the canonical record both agent and network reference by SHA-256 hash.",
    payments_analog:
      "Like a tamper-evident itemized receipt that's locked in *before* payment is requested.",
  },
  checkout_hash: {
    id: "checkout_hash",
    label: "checkout_hash",
    short:
      "SHA-256 of the merchant's checkout JWT. Carried inside L3b. Also equals L3a's `transaction_id` — this is how merchant and network prove they're talking about the same transaction.",
  },
  transaction_id: {
    id: "transaction_id",
    label: "transaction_id",
    short:
      "Identifier inside L3a (the network-facing credential) that equals the `checkout_hash` inside L3b (the merchant-facing one). Cross-references the two halves of a single VI transaction.",
  },

  // ── Verification & authorization ──────────────────────────────────────
  verify_chain: {
    id: "verify_chain",
    label: "verify_chain",
    short:
      "Recursive check: L3 binds to L2 (via `delegate_payload` and `sd_hash`), L2 binds to L1 (via `sd_hash`). Each link is a signature + a hash comparison; no shared secrets involved.",
  },
  check_constraints: {
    id: "check_constraints",
    label: "check_constraints",
    short:
      "STRICT-mode check the network runs: amount within L2's `amount_range`, currency match, merchant on `allowed_payees`, SKU in `acceptable_items`. Any failure → declined.",
  },
  selective_disclosure: {
    id: "selective_disclosure",
    label: "selective disclosure",
    short:
      "The SD-JWT property where a credential's holder reveals only the claims a given verifier needs. In VI: the merchant sees the cart claims of L2 but not the budget; the network sees the budget claims but not the cart.",
  },
  strict_mode: {
    id: "strict_mode",
    label: "STRICT mode",
    short:
      "Network verification mode where every L2 constraint MUST be checked and MUST pass. The demo always runs the network in STRICT mode.",
  },
  auth_code: {
    id: "auth_code",
    label: "AUTH-*",
    short:
      "Mock authorization id minted by the demo's network role after all checks pass. Format `AUTH-` + 12 hex chars. In production this is where a real card-network authorization id would surface.",
    payments_analog:
      "The same role the approval code from Visa / Mastercard / Amex plays on every contactless tap today.",
  },
};

// ── Per-step relevance map ───────────────────────────────────────────────
// Keyed by the orchestrator event `action`. Lists only the terms the user
// is likely to encounter or need on *that specific step* — keep these tight,
// the whole point is to avoid jargon overload.
export const STEP_TERMS: Record<string, string[]> = {
  demo_started: [],
  enrollment: ["es256", "jwk", "kid"],
  l1_issued: ["sd_jwt", "_sd", "disclosures", "cnf_jwk", "l1", "kid"],
  l2_created: ["kb_sd_jwt", "cnf_jwk", "sd_hash", "l2", "mandate", "constraints", "autonomous_mode"],
  constraints_extracted: ["constraints", "selective_disclosure", "disclosures"],
  product_selected: ["constraints", "autonomous_mode"],
  checkout_jwt_signed: ["jwt", "checkout_jwt", "checkout_hash"],
  l3_built: ["l3a", "l3b", "delegate_payload", "checkout_hash", "transaction_id", "sd_hash"],
  verified: ["verify_chain", "selective_disclosure", "sd_hash", "disclosures"],
  authorized: ["check_constraints", "strict_mode", "auth_code"],
  declined: ["check_constraints", "strict_mode"],
  demo_complete: ["selective_disclosure", "verify_chain"],
  demo_failed: ["verify_chain", "check_constraints"],
};

/** Resolve the active step's term list to actual Term objects, skipping unknowns. */
export function getTermsForAction(action: string | undefined): Term[] {
  if (!action) return [];
  const ids = STEP_TERMS[action] ?? [];
  return ids.map((id) => GLOSSARY[id]).filter((t): t is Term => Boolean(t));
}
