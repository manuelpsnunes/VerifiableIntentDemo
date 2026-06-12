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
  /**
   * One short sentence (≤ ~110 chars) that anchors this step in *traditional,
   * pre-agentic* payment terminology (PAN, DPAN, EMV cryptogram, AUTH code…).
   * Surfaced in the Concept Stage, the Detail Panel, and as a one-liner under
   * the Stakeholder Graph. Optional; omit when no faithful analog exists
   * (e.g. L2 mandates have no legacy equivalent — agents are new).
   */
  plain_payments?: string;
  /**
   * Optional callout explaining how this step would differ in a real
   * production deployment vs. how the demo runs it inline for visibility.
   * Surfaced as a distinct "In production" badge in the Concept Stage and
   * Detail Panel.
   */
  production_note?: string;
  /**
   * Optional plain-language sentence describing what THIS step would look like
   * to a user in a real ChatGPT-style autonomous shopping flow. Used to bring
   * tangibility — e.g. "Your phone buzzes: 'ChatGPT wants to spend up to $400
   * at Tennis Warehouse on a Babolat racket. Approve with Face ID?'". Rendered
   * as a green "In real life" callout.
   */
  real_world?: string;
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
    plain_payments:
      "Like a card payment — but the cardholder isn't present; an AI agent checks out within pre-signed limits.",
    real_world:
      "You type 'Buy me a good Babolat racket under $400' into ChatGPT and hit send. From your side, this is the only thing you do until you see the confirmation.",
    look_at: ["prompt", "budget_usd"],
  },

  enrollment: {
    title: "Every party loads its keypair",
    summary:
      "Five separate ES256 (P-256) keypairs are loaded — one each for the issuer, wallet, agent, merchant, and network. Private keys never leave their owner; only the public JWKs are shared.",
    why: "Every signature in the rest of the demo is verifiable against exactly one of these public keys. There are no shared secrets and no central trust authority.",
    learning_objective:
      "Trust in VI rests on public-key cryptography, not shared secrets — each role has its own ES256 keypair and only ever publishes the public half.",
    plain_payments:
      "Each role generates its own ES256 keypair. Closest analog: per-device keys in EMV chip auth, with no central CA.",
    real_world:
      "Already done long ago. Your wallet's key lives in the most secure place your platform offers — Secure Enclave on iPhone, StrongBox/Keystore on Android, TPM on Windows, or HSMs at Stripe/Google/your bank for server-side wallets. Visa/Mastercard and the merchant manage their own keys in HSMs. Nobody generates keys at purchase time.",
    look_at: ["keys"],
  },

  l1_issued: {
    title: "L1 card credential (issuer-signed) loaded into the wallet",
    summary:
      "The wallet surfaces the L1 SD-JWT it holds for this card. The issuer signed it at enrollment, binding the user's device public key via cnf.jwk — only that key can later derive child credentials. The demo re-signs it on each run for visibility, but in production this credential is reused unchanged across purchases.",
    why: "The user's email is a selectively-disclosable claim: it appears as a hash inside the signed payload (_sd) and the cleartext value lives in the disclosures array. Verifiers see only what gets handed to them.",
    learning_objective:
      "L1 anchors the chain: the issuer's signature gives it authority, and cnf.jwk pins it to exactly one user device key — no other key can derive children from this L1.",
    plain_payments:
      "Like Apple Pay minting a network token (DPAN) into your phone — issuer-signed, bound to the wallet's key.",
    production_note:
      "In production, L1 is issued ONCE during user enrollment with the Credential Provider (via the chosen issuance protocol, e.g. OpenID4VCI) and stored in the wallet. Every later purchase reuses that stored L1 — the issuer is not contacted per transaction. The demo re-issues L1 on every run so the full chain is visible in one timeline.",
    real_world:
      "Your Apple Wallet (or bank app) already shows the Mastercard you added months ago — that's the L1, signed by the card network at enrollment and sitting on your phone.",
    look_at: ["credential.header", "credential.payload", "credential.disclosures"],
  },

  l2_created: {
    title: "Wallet signs the L2 mandate (autonomous mode)",
    summary:
      "The user's wallet signs an L2 KB-SD-JWT+KB mandate (the +KB form carries onward key binding so the agent can later sign L3). It encodes four constraints — allowed merchants, acceptable line items, payment-amount range, and allowed payees — and delegates execution to the agent's key via cnf.jwk.",
    why: "The sd_hash field cryptographically binds this L2 to the parent L1. The agent inherits authority only inside this envelope; the user's PAN and identity stay inside L1.",
    learning_objective:
      "L2 is where the user expresses intent: sd_hash binds it to L1 (the parent), and cnf.jwk hands a fresh delegated key to the agent — bounded by four signed constraints.",
    plain_payments:
      "A signed 'spending permission slip' the cardholder hands the agent. No legacy analog — agents are the new piece.",
    real_world:
      "Your phone buzzes: 'ChatGPT wants to spend up to $400 at Tennis Warehouse on a Babolat racket. Approve with Face ID?' You approve — that one tap is what creates this L2.",
    look_at: [
      "credential.payload.constraints",
      "credential.payload.cnf",
      "credential.payload.sd_hash",
    ],
  },

  constraints_extracted: {
    title: "Agent reads its boundaries",
    summary:
      "The agent resolves selectively-disclosed claims out of L2: the merchant allowlist, the catalog of acceptable items, and the budget range. It did NOT discover any of these — the wallet decided them at consent time and signed them in. The agent's only job here is to read them.",
    why: "Nothing the agent does later can step outside this set. The constraints are signed by the user's wallet — the agent cannot rewrite them, add merchants, or expand the catalog.",
    learning_objective:
      "Constraints are signed *inputs* to the agent, not outputs of agent discovery — the wallet decides what's allowed during consent, the agent only chooses within that envelope.",
    plain_payments:
      "Like a corporate card with a vendor allowlist and per-transaction cap — but the limits are cryptographic, not policy.",
    real_world:
      "ChatGPT now knows the exact boundaries you approved at consent time: ≤ $400, Tennis Warehouse only, Babolat rackets only. It cannot widen them, even if asked nicely.",
    production_note:
      "How does the wallet decide the merchant/SKU allowlists in the first place? Common patterns: (a) user picks merchants on the consent screen, (b) agent proposes a single SKU and user approves that exact one, (c) user has standing rules in their wallet (e.g. 'always allow REI'), or (d) open mandate with no merchant lock and looser caps. The demo hardcodes a single merchant + 3 Babolat SKUs in backend/app/catalog.py for simplicity; production wallets do this translation as part of their UX.",
    look_at: ["acceptable_items", "allowed_merchants", "max_amount_cents"],
  },

  product_selected: {
    title: "Agent chooses a product",
    summary:
      "The agent (Claude when an API key is set; a deterministic stub otherwise) picks exactly one SKU from the acceptable set, with a rationale.",
    why: "The agent has no key that can bypass L2's constraints. Its only freedom is choosing within them — and that choice will be re-checked by the network in step 9.",
    learning_objective:
      "The LLM's only role is *choosing* within the signed envelope — it never signs anything that could break the chain.",
    plain_payments:
      "Agent picks a SKU from the allowed list — it physically cannot add anything outside that list.",
    real_world:
      "ChatGPT browses Tennis Warehouse, picks the Babolat Pure Aero ($279.99), and tells you: 'I chose this one — top-rated all-court racket, fits your budget.'",
    look_at: ["pick.sku", "pick.rationale", "product"],
  },

  checkout_jwt_signed: {
    title: "Merchant signs the checkout JWT",
    summary:
      "The merchant produces a checkout JWT listing the exact cart, signed by its own merchant key.",
    why: "This JWT becomes the canonical record that both agent and network reference by SHA-256 hash. If anyone tampers with the cart later, the hashes break and verification fails.",
    learning_objective:
      "The checkout JWT is the single source of truth for what was bought — every later reference to the cart goes through its SHA-256 hash.",
    plain_payments:
      "Merchant signs the cart — a tamper-evident itemized receipt that locks in the line items before payment.",
    real_world:
      "Tennis Warehouse's server returns a signed receipt locking in the cart (one Babolat Pure Aero, $279.99) before payment is even attempted.",
    look_at: ["serialized", "payload.line_items", "checkout_hash"],
  },

  l3_built: {
    title: "Agent signs L3a (payment) and L3b (checkout)",
    summary:
      "Using its delegated key, the agent signs two L3 credentials: L3a (payment) for the network with final payment amount and payee, and L3b (checkout) for the merchant with the cart plus a SHA-256 of the checkout JWT.",
    why: "Both L3s point back to L2 via delegate_payload disclosure hashes. The transaction_id in L3a equals the checkout_hash in L3b — that's how the network and merchant link a single transaction across two messages they each only see half of.",
    learning_objective:
      "L3 splits the transaction in two: L3a for the network (knows payment, not cart), L3b for the merchant (knows cart, not budget). Both share transaction_id == checkout_hash.",
    plain_payments:
      "Like an EMV cryptogram, split in two: L3a for the network (amount), L3b for the merchant (cart), linked by a shared id.",
    real_world:
      "ChatGPT splits the order: tells Tennis Warehouse 'here's the cart' and tells Mastercard 'here's $279.99 to authorize'. Neither sees the other half.",
    look_at: [
      "l3a.payload.delegate_payload",
      "l3b.payload.delegate_payload",
      "l2_payment_view.serialized",
      "l2_checkout_view.serialized",
      "transmitted_to_merchant",
      "transmitted_to_network",
    ],
  },

  merchant_verified: {
    title: "Merchant verifies the checkout chain (L3b)",
    summary:
      "The merchant runs verify_chain over L1 → L2(checkout view) → L3b, then recomputes SHA-256(checkout_jwt) and confirms it matches L3b's checkout_hash. It sees only the checkout slice of L2 — never the budget envelope.",
    why: "The merchant only needs to know the cart is authentic and matches the JWT it signed. It does NOT check spending constraints — it can't even see the budget (selective disclosure). Constraint enforcement is the network's job.",
    learning_objective:
      "The merchant verifies the checkout-side chain plus the checkout_hash binding — but never checks payment constraints. It only sees the cart slice of L2.",
    plain_payments:
      "Like a store confirming the signed receipt it issued wasn't altered — it never sees your credit limit.",
    real_world:
      "Tennis Warehouse confirms the order is genuinely the one it quoted, then waits for the network's go-ahead before shipping.",
    look_at: ["chain_valid", "checks_performed", "l2_checkout_disclosed"],
  },

  network_verified: {
    title: "Network verifies the payment chain + constraints",
    summary:
      "The network runs verify_chain over L1 → L2(payment view) → L3a, then runs check_constraints in STRICT mode — confirming the agent's amount and payee fall inside L2's signed amount_range and allowed_payees. It sees only the payment slice of L2 — never the line items.",
    why: "The network is the constraint enforcer. STRICT mode means every disclosed L2 payment constraint MUST pass or the transaction is declined. It never sees the cart — only that the payment stays inside the signed envelope.",
    learning_objective:
      "Only the network checks constraints: it re-checks the agent's fulfillment (amount, payee) against L2's signed bounds in STRICT mode. It sees the payment slice of L2, not the cart.",
    plain_payments:
      "Like the card network checking the amount is within your limit and the merchant is allowed — the part the store never sees.",
    real_world:
      "Mastercard checks $279.99 is within the $400 you approved and that Tennis Warehouse is an allowed payee, then authorizes.",
    look_at: ["chain_valid", "constraints_satisfied", "constraint_checks", "fulfillment"],
  },

  authorized: {
    title: "Network authorizes the payment",
    summary:
      "Mock card network approves the payment (any amount ≤ $1000 in this demo) and mints an AUTH-* id. In production this is where the real card-network rails would be hit.",
    why: "The user's wallet never spoke to the merchant. The merchant never saw the budget. The network never saw the cart. Each verification used only what that party needed — and the cryptographic chain stitched them together.",
    learning_objective:
      "Authorization is the network's contractual commitment — it ran every verification *before* approving, and any chain failure would have stopped settlement.",
    plain_payments:
      "The card network's approval code (AUTH-*) — the same role Visa or Mastercard play on every contactless tap today.",
    production_note:
      "In production the authorization response (the AUTH code) returns to the MERCHANT — the party that requested it (via its acquirer/PSP) — which is what lets the merchant ship the goods. The user and wallet don't receive the raw code: the user just gets an order confirmation from the merchant/agent. The demo doesn't model that return hop; it simply displays the AUTH code on this network event.",
    real_world:
      "Mastercard returns the AUTH code. Tennis Warehouse ships your racket. ChatGPT replies in the chat: 'Done! Babolat Pure Aero, ships Friday.'",
    look_at: ["authorization_id", "amount", "currency", "payee"],
  },

  declined: {
    title: "Network declined the payment",
    summary:
      "The mock network rejected this authorization request.",
    why: "Common reasons: amount exceeds the demo cap ($1000), or PAYMENT_NETWORK_MODE was set to something other than 'mock' without a real adapter wired in.",
    learning_objective:
      "Decline is a first-class outcome: VI doesn't just verify, it *enforces*, and the network is the final gate.",
    plain_payments:
      "Like an issuer refusing a card payment — over-limit, wrong merchant category, or a failed cryptogram.",
    real_world:
      "Mastercard refuses — maybe over-limit, maybe a flagged merchant. ChatGPT tells you: 'I couldn't complete the purchase.' Nothing was charged.",
    look_at: ["reason"],
  },

  demo_complete: {
    title: "Done — chain verified end to end",
    summary:
      "The full L1 → L2 → L3a/L3b chain has been verified by both merchant and network using only public keys.",
    why: "The user's PAN never left the issuer. The items bought never left the merchant. The agent never had power to spend outside L2's constraints. That's the entire point of Verifiable Intent.",
    learning_objective:
      "End state: every party verified what it needed, nothing more — and the agent operated entirely within a cryptographic envelope it could not break.",
    plain_payments:
      "Every verifier confirmed the agent stayed inside the cardholder's pre-signed envelope — chain holds end-to-end.",
    real_world:
      "From your side: one Face ID prompt, one chat reply with the order confirmation. Everything else happened silently and verifiably.",
    look_at: ["summary"],
  },

  demo_failed: {
    title: "Something went wrong",
    summary: "The demo aborted before completing.",
    why: "See the error payload for details. In a real system any verification failure would also stop the transaction here.",
    learning_objective:
      "Failure modes are the point: VI is designed so that breaking the chain produces specific, attributable rejections — not silent corruption.",
    plain_payments:
      "Hard stop — like a chip reader refusing to authorize when the cryptogram doesn't validate.",
    real_world:
      "ChatGPT comes back in the chat: 'I ran into a problem and stopped — no charge was made.' The chain failure is what protected you.",
    look_at: ["error", "error_type"],
  },
};
