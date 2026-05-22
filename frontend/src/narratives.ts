// Human-friendly explanations for every orchestrator event.
// Keyed by `action`. Each entry has:
//   title:               short headline
//   summary:             1-3 sentence plain-English description of what happened
//   why:                 why this step matters for trust / security
//   learning_objective:  one-sentence "what this step teaches" (for the PM banner)
//   look_at:             optional list of payload fields worth opening in the inspector

export interface Narrative {
  title: string;
  summary: string;
  why: string;
  learning_objective?: string;
  look_at?: string[];
}

export const NARRATIVES: Record<string, Narrative> = {
  demo_started: {
    title: "Kicking off an autonomous purchase",
    summary:
      "We're about to simulate a full Verifiable Intent purchase where the user delegates buying authority to an AI agent — but with cryptographic constraints the agent cannot break.",
    why: "Everything from here is signed with real ES256 keys. Five parties take part, and each verification step uses only public keys.",
    learning_objective:
      "VI is a chain of three credential layers (L1 → L2 → L3) that lets an agent act on a user's behalf without ever holding the user's payment secret.",
    look_at: ["prompt", "budget_usd"],
  },

  enrollment: {
    title: "Every party loads its keypair",
    summary:
      "Five separate ES256 (P-256) keypairs are loaded — one each for the issuer, wallet, agent, merchant, and network. Private keys never leave their owner; only the public JWKs are shared.",
    why: "Every signature in the rest of the demo is verifiable against exactly one of these public keys. There are no shared secrets and no central trust authority.",
    learning_objective:
      "Trust in VI rests on public-key cryptography, not shared secrets — each role has its own ES256 keypair and only ever publishes the public half.",
    look_at: ["keys"],
  },

  l1_issued: {
    title: "Issuer signs the L1 card credential",
    summary:
      "Mastercard (the issuer) signs an SD-JWT L1 credential. It binds the user's device public key via cnf.jwk — only that key can later derive child credentials.",
    why: "The user's email is a selectively-disclosable claim: it appears as a hash inside the signed payload (_sd) and the cleartext value lives in the disclosures array. Verifiers see only what gets handed to them.",
    learning_objective:
      "L1 anchors the chain: the issuer signs it, and cnf.jwk pins it to exactly one user device key — no other key can derive children from this L1.",
    look_at: ["credential.header", "credential.payload", "credential.disclosures"],
  },

  l2_created: {
    title: "Wallet signs the L2 mandate (autonomous mode)",
    summary:
      "The user's wallet signs an L2 KB-SD-JWT mandate. It encodes four constraints — allowed merchants, acceptable line items, payment-amount range, and allowed payees — and delegates execution to the agent's key via cnf.jwk.",
    why: "The sd_hash field cryptographically binds this L2 to the parent L1. The agent inherits authority only inside this envelope; the user's PAN and identity stay inside L1.",
    learning_objective:
      "L2 is where the user expresses intent: sd_hash binds it to L1 (the parent), and cnf.jwk hands a fresh delegated key to the agent — bounded by four signed constraints.",
    look_at: [
      "credential.payload.constraints",
      "credential.payload.cnf",
      "credential.payload.sd_hash",
    ],
  },

  constraints_extracted: {
    title: "Agent reads its boundaries",
    summary:
      "The agent resolves selectively-disclosed claims out of L2: the catalog of acceptable items, the merchant allowlist, and the budget range. These are the bounds inside which it is allowed to act.",
    why: "Nothing the agent does later can step outside this set. The constraints are signed by the user's wallet — the agent cannot rewrite them.",
    learning_objective:
      "Constraints are signed inputs to the agent, not configuration — the agent reads them, but the wallet's signature is what gives them legal/cryptographic force.",
    look_at: ["acceptable_items", "allowed_merchants", "max_amount_cents"],
  },

  product_selected: {
    title: "Agent chooses a product",
    summary:
      "The agent (Claude when an API key is set; a deterministic stub otherwise) picks exactly one SKU from the acceptable set, with a rationale.",
    why: "The agent has no key that can bypass L2's constraints. Its only freedom is choosing within them — and that choice will be re-checked by the network in step 9.",
    learning_objective:
      "The LLM's only role is *choosing* within the signed envelope — it never signs anything that could break the chain.",
    look_at: ["pick.sku", "pick.rationale", "product"],
  },

  checkout_jwt_signed: {
    title: "Merchant signs the checkout JWT",
    summary:
      "The merchant produces a checkout JWT listing the exact cart, signed by its own merchant key.",
    why: "This JWT becomes the canonical record that both agent and network reference by SHA-256 hash. If anyone tampers with the cart later, the hashes break and verification fails.",
    learning_objective:
      "The checkout JWT is the single source of truth for what was bought — every later reference to the cart goes through its SHA-256 hash.",
    look_at: ["serialized", "payload.line_items", "checkout_hash"],
  },

  l3_built: {
    title: "Agent signs L3a (payment) and L3b (checkout)",
    summary:
      "Using its delegated key, the agent signs two L3 credentials: L3a (payment) for the network with final payment amount and payee, and L3b (checkout) for the merchant with the cart plus a SHA-256 of the checkout JWT.",
    why: "Both L3s point back to L2 via delegate_payload disclosure hashes. The transaction_id in L3a equals the checkout_hash in L3b — that's how the network and merchant link a single transaction across two messages they each only see half of.",
    learning_objective:
      "L3 splits the transaction in two: L3a for the network (knows payment, not cart), L3b for the merchant (knows cart, not budget). Both share transaction_id == checkout_hash.",
    look_at: [
      "l3a.payload.delegate_payload",
      "l3b.payload.delegate_payload",
      "l2_payment_view.serialized",
      "l2_checkout_view.serialized",
      "transmitted_to_merchant",
      "transmitted_to_network",
    ],
  },

  verified: {
    title: "Verification (chain + constraints)",
    summary:
      "The merchant runs verify_chain over L1 → L2(checkout view) → L3b. The network runs verify_chain over L1 → L2(payment view) → L3a, plus check_constraints in STRICT mode.",
    why: "Each party sees a different slice of L2 (selective disclosure). The network never sees the line items; the merchant never sees the budget envelope. Both verify only public-key signatures and binding hashes — no shared secret.",
    learning_objective:
      "Each verifier sees only the L2 disclosures it needs — yet both compute the same sd_hash back to L1, proving the chain is intact without leaking the other party's data.",
    look_at: ["chain_valid", "constraints_satisfied", "checks_performed"],
  },

  authorized: {
    title: "Network authorizes the payment",
    summary:
      "Mock card network approves the payment (any amount ≤ $1000 in this demo) and mints an AUTH-* id. In production this is where the real Mastercard rails would be hit.",
    why: "The user's wallet never spoke to the merchant. The merchant never saw the budget. The network never saw the cart. Each verification used only what that party needed — and the cryptographic chain stitched them together.",
    learning_objective:
      "Authorization is the network's contractual commitment — it ran every verification *before* approving, and any chain failure would have stopped settlement.",
    look_at: ["authorization_id", "amount", "currency", "payee"],
  },

  declined: {
    title: "Network declined the payment",
    summary:
      "The mock network rejected this authorization request.",
    why: "Common reasons: amount exceeds the demo cap ($1000), or PAYMENT_NETWORK_MODE was set to something other than 'mock' without a real adapter wired in.",
    learning_objective:
      "Decline is a first-class outcome: VI doesn't just verify, it *enforces*, and the network is the final gate.",
    look_at: ["reason"],
  },

  demo_complete: {
    title: "Done — chain verified end to end",
    summary:
      "The full L1 → L2 → L3a/L3b chain has been verified by both merchant and network using only public keys.",
    why: "The user's PAN never left the issuer. The items bought never left the merchant. The agent never had power to spend outside L2's constraints. That's the entire point of Verifiable Intent.",
    learning_objective:
      "End state: every party verified what it needed, nothing more — and the agent operated entirely within a cryptographic envelope it could not break.",
    look_at: ["summary"],
  },

  demo_failed: {
    title: "Something went wrong",
    summary: "The demo aborted before completing.",
    why: "See the error payload for details. In a real system any verification failure would also stop the transaction here.",
    learning_objective:
      "Failure modes are the point: VI is designed so that breaking the chain produces specific, attributable rejections — not silent corruption.",
    look_at: ["error", "error_type"],
  },
};
