// Per-field documentation surfaced on hover inside the SpecDrawer's
// "Pre-decoded — for inspection & learning" JSON viewer.
//
// Each entry is keyed by the *literal JSON key name* as it appears in an event
// payload (e.g. `iss`, `_sd`, `sd_hash`, `delegate_payload`). When the user
// hovers a key in the decoded payload tree, DocumentedJsonView looks the key up
// here and renders a themed tooltip.
//
// `source` distinguishes two kinds of description:
//   - "spec":     authoritative — the field is defined by a published standard
//                 (JOSE/JWS, RFC 7519 JWT, the SD-JWT IETF draft, JWK
//                 RFC 7517/7518) or by the Verifiable Intent spec itself.
//   - "inferred": the field is demo-side decoration the backend adds for
//                 inspection (see backend/app/sd_jwt_view.py describe_sd_jwt)
//                 or an orchestrator/event wrapper field with no direct spec
//                 mandate. These descriptions are derived from the code and are
//                 tagged "(inferred)" in the UI so readers don't mistake them
//                 for normative wording.
//
// Spec-fidelity rule of thumb: paraphrase the live spec at
// https://verifiableintent.dev/spec/ but never invent semantics it doesn't
// grant. Where wording overlaps the per-step glossary (glossary.ts) we reuse it.

export interface FieldDoc {
  /** The literal JSON key this documents. */
  key: string;
  /** 1–3 sentence, plain-English, spec-faithful description. */
  short: string;
  /** Whether `short` is normative (spec) or derived from demo code (inferred). */
  source: "spec" | "inferred";
  /** Optional short citation, e.g. "RFC 7519 §4.1.1" or "VI §10". */
  specRef?: string;
  /** Optional analogy to a traditional (pre-agentic) payments concept. */
  payments_analog?: string;
}

export const FIELD_DOCS: Record<string, FieldDoc> = {
  // ── JWS header (JOSE) ──────────────────────────────────────────────────
  alg: {
    key: "alg",
    short:
      "Signature algorithm used to sign this JWS. In Verifiable Intent it is always ES256 — ECDSA over the P-256 curve with SHA-256.",
    source: "spec",
    specRef: "RFC 7515 §4.1.1",
  },
  typ: {
    key: "typ",
    short:
      "Media type of this token, telling a verifier how to interpret it (e.g. a JWT or a specific SD-JWT variant). Verifiers MUST check typ to avoid cross-type confusion attacks.",
    source: "spec",
    specRef: "RFC 7515 §4.1.9",
  },
  kid: {
    key: "kid",
    short:
      "Key ID — short identifier of the key that produced this signature. Verifiers use it to look up the matching public JWK before verifying.",
    source: "spec",
    specRef: "RFC 7515 §4.1.4",
  },

  // ── Registered JWT claims (RFC 7519) ───────────────────────────────────
  iss: {
    key: "iss",
    short:
      "Issuer — identifies the party that created and signed this credential. Its public key is what a verifier checks the signature against.",
    source: "spec",
    specRef: "RFC 7519 §4.1.1",
  },
  sub: {
    key: "sub",
    short:
      "Subject — the principal this credential is about (e.g. the user for L1/L2, or the cart for the checkout JWT).",
    source: "spec",
    specRef: "RFC 7519 §4.1.2",
  },
  aud: {
    key: "aud",
    short:
      "Audience — the party this credential is intended for. A verifier rejects a credential presented to the wrong audience.",
    source: "spec",
    specRef: "RFC 7519 §4.1.3",
  },
  exp: {
    key: "exp",
    short:
      "Expiration time (Unix seconds). After this instant the credential is no longer valid; verifiers MUST reject expired tokens.",
    source: "spec",
    specRef: "RFC 7519 §4.1.4",
  },
  iat: {
    key: "iat",
    short:
      "Issued-at time (Unix seconds) — when this credential was minted.",
    source: "spec",
    specRef: "RFC 7519 §4.1.6",
  },
  nonce: {
    key: "nonce",
    short:
      "A unique, single-use value that makes each credential distinct and resistant to replay. Here a fresh UUID per mandate.",
    source: "spec",
  },

  // ── SD-JWT disclosure mechanism (IETF SD-JWT draft) ────────────────────
  _sd: {
    key: "_sd",
    short:
      "Array of base64url-encoded SHA-256 digests, one per selectively-disclosable claim. The cleartext for each lives in the separate disclosures array; a verifier only learns a claim if it is given the matching disclosure.",
    source: "spec",
    specRef: "SD-JWT draft §4.2.4",
  },
  _sd_alg: {
    key: "_sd_alg",
    short:
      "Hash algorithm used to compute the _sd digests. In Verifiable Intent this is sha-256.",
    source: "spec",
    specRef: "SD-JWT draft §4.1.1",
  },
  cnf: {
    key: "cnf",
    short:
      "Confirmation claim — the key this credential is bound to. Only the holder of the matching private key can present it or derive children from it. L1 binds to the user's device key; L2 binds to the agent's delegated key.",
    source: "spec",
    specRef: "RFC 7800",
    payments_analog:
      "Same role as Apple Pay binding a device token (DPAN) to the Secure Element's key.",
  },
  jwk: {
    key: "jwk",
    short:
      "JSON Web Key — the public key, as a structured JSON object. Only the public half is ever exchanged in Verifiable Intent.",
    source: "spec",
    specRef: "RFC 7517",
  },
  kty: {
    key: "kty",
    short:
      "Key type of a JWK. For ES256 keys this is EC (elliptic curve).",
    source: "spec",
    specRef: "RFC 7518 §6.1",
  },
  crv: {
    key: "crv",
    short:
      "Elliptic curve a JWK uses. Verifiable Intent uses P-256 (a.k.a. secp256r1).",
    source: "spec",
    specRef: "RFC 7518 §6.2.1.1",
  },
  x: {
    key: "x",
    short:
      "X coordinate of the elliptic-curve public key point, base64url-encoded.",
    source: "spec",
    specRef: "RFC 7518 §6.2.1.2",
  },
  y: {
    key: "y",
    short:
      "Y coordinate of the elliptic-curve public key point, base64url-encoded.",
    source: "spec",
    specRef: "RFC 7518 §6.2.1.3",
  },

  // ── Disclosure object fields (describe_disclosure) ─────────────────────
  salt: {
    key: "salt",
    short:
      "Random per-disclosure value that makes a claim's hash unguessable, so a verifier can't brute-force hidden values from the _sd digests alone.",
    source: "spec",
    specRef: "SD-JWT draft §4.2.1",
  },
  name: {
    key: "name",
    short:
      "Within a disclosure: the claim name being revealed (null for an array-element disclosure). Elsewhere: a human-readable label such as a merchant or product name.",
    source: "spec",
  },
  value: {
    key: "value",
    short:
      "Within a disclosure: the cleartext claim value that the holder is revealing to this verifier.",
    source: "spec",
    specRef: "SD-JWT draft §4.2.1",
  },
  hash: {
    key: "hash",
    short:
      "Demo-side: the SHA-256 digest of this disclosure, precomputed so you can match it to an entry in the parent _sd array. The receiver would compute this itself.",
    source: "inferred",
  },
  encoded: {
    key: "encoded",
    short:
      "Demo-side: the original base64url disclosure string ([salt, name, value]) exactly as it travels appended to the SD-JWT after a ~ separator.",
    source: "inferred",
  },

  // ── VI-specific credential claims ──────────────────────────────────────
  sd_hash: {
    key: "sd_hash",
    short:
      "SHA-256 of the parent SD-JWT's compact serialization. L2 carries sd_hash = SHA-256(L1) and L3 carries sd_hash over its L2 view — this is how each child credential cryptographically commits to its parent.",
    source: "spec",
    specRef: "VI §6 / §10",
  },
  vct: {
    key: "vct",
    short:
      "Verifiable Credential Type — names the mandate kind, e.g. mandate.payment.open.1 or mandate.checkout.open.1. Lets a verifier apply the right rules.",
    source: "spec",
    specRef: "VI §10",
  },
  mode: {
    key: "mode",
    short:
      "On a mandate: the execution mode, AUTONOMOUS — the agent acts without a live cardholder challenge, relying on L2's pre-signed constraints. On an authorization result: the settlement backend, mock or stripe.",
    source: "spec",
    specRef: "VI §3.4",
  },
  prompt_summary: {
    key: "prompt_summary",
    short:
      "Human-readable summary of the user intent the wallet captured when minting L2. Context only — it is the signed constraints, not this text, that bound the agent.",
    source: "spec",
  },
  merchants: {
    key: "merchants",
    short:
      "Allowed-merchant set carried in L2: the only merchants the agent may transact with. Enforced by the checkout-side constraint.",
    source: "spec",
    specRef: "VI §7",
  },
  acceptable_items: {
    key: "acceptable_items",
    short:
      "Catalog of SKUs/line items the agent is permitted to buy. The agent must choose its fulfillment from inside this set; the verifier re-checks it.",
    source: "spec",
    specRef: "VI §7",
  },
  delegate_payload: {
    key: "delegate_payload",
    short:
      "The part of an L3 credential that references the L2 it derives from, via L2's disclosure hashes. It stitches L3 back to L2 without leaking L2's contents.",
    source: "spec",
    specRef: "VI §10",
  },
  constraints: {
    key: "constraints",
    short:
      "The signed bounds an agent must act inside: allowed payees, acceptable line items, amount range, and allowed merchants. STRICT-mode verifiers reject any fulfillment outside them.",
    source: "spec",
    specRef: "VI §7",
    payments_analog:
      "Like merchant-category-code limits on a corporate card — but cryptographically enforced, not just policy.",
  },
  match_mode: {
    key: "match_mode",
    short:
      "How a line-items constraint is satisfied — e.g. \"minimum\" means at least the listed items/quantities must be present.",
    source: "spec",
    specRef: "VI §7",
  },
  min: {
    key: "min",
    short:
      "Lower bound (in minor units, e.g. cents) of an amount-range constraint.",
    source: "spec",
    specRef: "VI §7",
  },
  max: {
    key: "max",
    short:
      "Upper bound (in minor units, e.g. cents) of an amount-range constraint — the spending ceiling the agent may not exceed.",
    source: "spec",
    specRef: "VI §7",
  },
  currency: {
    key: "currency",
    short:
      "ISO 4217 currency code (e.g. USD) for an amount or amount-range. A currency mismatch fails the constraint check.",
    source: "spec",
  },
  allowed: {
    key: "allowed",
    short:
      "Within a constraint: the permitted set (merchants or payees). Entries may be inline objects or SD-JWT disclosure references (an object with a \"...\" digest).",
    source: "spec",
    specRef: "VI §7",
  },
  allowed_payees: {
    key: "allowed_payees",
    short:
      "Payment-side constraint: the merchants/payees the agent is allowed to pay. The network rejects an L3a whose payee is not listed.",
    source: "spec",
    specRef: "VI §7",
  },
  allowed_merchants: {
    key: "allowed_merchants",
    short:
      "Checkout-side constraint: the merchants the agent may transact a cart with.",
    source: "spec",
    specRef: "VI §7",
  },
  amount_range: {
    key: "amount_range",
    short:
      "Payment constraint bounding the transaction amount: a currency plus min/max in minor units.",
    source: "spec",
    specRef: "VI §7",
  },
  line_items: {
    key: "line_items",
    short:
      "Checkout constraint listing the acceptable items and quantities for the cart, with a match_mode describing how they must be satisfied.",
    source: "spec",
    specRef: "VI §7",
  },
  recurrence: {
    key: "recurrence",
    short:
      "Optional payment constraint bounding how often a recurring payment may occur.",
    source: "spec",
    specRef: "VI §7",
  },
  payment_instrument: {
    key: "payment_instrument",
    short:
      "The funding instrument to charge — its type, an opaque id, and a description. Carried through the mandate chain to the payment.",
    source: "spec",
  },
  risk_data: {
    key: "risk_data",
    short:
      "Optional contextual signals (e.g. device id, IP address) attached to a mandate to support the verifier's risk decision.",
    source: "spec",
  },
  checkout_jwt: {
    key: "checkout_jwt",
    short:
      "The merchant-signed JWT enumerating the exact cart (line items, currency, total). Its SHA-256 becomes the checkout_hash both agent and network reference.",
    source: "spec",
    specRef: "VI §9",
    payments_analog:
      "Like a tamper-evident itemized receipt locked in before payment is requested.",
  },
  checkout_hash: {
    key: "checkout_hash",
    short:
      "SHA-256 of the merchant's checkout JWT, carried in L3b. It equals L3a's transaction_id — how merchant and network prove they are settling the same transaction.",
    source: "spec",
    specRef: "VI §8.2",
  },
  transaction_id: {
    key: "transaction_id",
    short:
      "Identifier in L3a (network-facing) that equals the checkout_hash in L3b (merchant-facing). Cross-references the two halves of one VI transaction.",
    source: "spec",
    specRef: "VI §8.3",
  },
  payee: {
    key: "payee",
    short:
      "The merchant being paid in this transaction. Checked against the allowed_payees constraint.",
    source: "spec",
  },
  payment_amount: {
    key: "payment_amount",
    short:
      "The final amount to charge — a currency plus an amount in minor units. Checked against the amount_range constraint.",
    source: "spec",
  },
  final_payment: {
    key: "final_payment",
    short:
      "The concrete payment the agent commits to in L3a: transaction_id, payee, payment_amount, and payment_instrument.",
    source: "spec",
    specRef: "VI §10",
  },
  final_checkout: {
    key: "final_checkout",
    short:
      "The concrete cart commitment the agent commits to in L3b: the checkout_jwt and its checkout_hash.",
    source: "spec",
    specRef: "VI §10",
  },

  // ── demo-side credential wrapper (describe_sd_jwt) ──────────────────────
  serialized: {
    key: "serialized",
    short:
      "The compact, on-the-wire SD-JWT string: <header>.<payload>.<signature> followed by ~-separated disclosures. This is what actually travels between roles; everything else here is decoded for inspection.",
    source: "inferred",
  },
  header: {
    key: "header",
    short:
      "Demo-side: the decoded JWS header (alg, typ, kid). Derived from the serialized form by base64url-decoding the first segment.",
    source: "inferred",
  },
  payload: {
    key: "payload",
    short:
      "Demo-side: the decoded JWT/SD-JWT payload, including _sd digests. The cleartext of hidden claims is not here — see resolved and disclosures.",
    source: "inferred",
  },
  resolved: {
    key: "resolved",
    short:
      "Demo-side: the payload after applying every available disclosure, so you can read the fully-resolved claim set. A real verifier computes this locally from the disclosures it was actually given.",
    source: "inferred",
  },
  disclosures: {
    key: "disclosures",
    short:
      "Demo-side: a decoded list of this credential's disclosures, each broken into salt, name, value, hash, and the encoded string. On the wire these are just the ~-appended base64url segments.",
    source: "inferred",
  },
  credential: {
    key: "credential",
    short:
      "Demo-side: the decoded SD-JWT for this step (its serialized form, header, payload, resolved claims, and disclosures).",
    source: "inferred",
  },
  credential_layer: {
    key: "credential_layer",
    short:
      "Demo-side label naming which layer this credential is — L1 (card), L2 (mandate), or L3 (per-transaction).",
    source: "inferred",
  },
  transmitted_to: {
    key: "transmitted_to",
    short:
      "Demo-side: which role this credential was handed to in this step.",
    source: "inferred",
  },
  transmissions: {
    key: "transmissions",
    short:
      "Demo-side: the list of who received which credentials in this step (e.g. L3a to the network, L3b to the merchant).",
    source: "inferred",
  },
  l3a: {
    key: "l3a",
    short:
      "The payment mandate the agent signs for the network: carries amount + payee (not the cart). Bound to L2 via delegate_payload; its transaction_id equals L3b's checkout_hash.",
    source: "spec",
    specRef: "VI §10",
    payments_analog:
      "The network-facing half of an EMV cryptogram — proof this specific payment was authorized.",
  },
  l3b: {
    key: "l3b",
    short:
      "The checkout mandate the agent signs for the merchant: carries the cart + checkout_hash (not the budget). Bound to L2 via delegate_payload; its checkout_hash equals L3a's transaction_id.",
    source: "spec",
    specRef: "VI §10",
    payments_analog:
      "The merchant-facing half of an EMV cryptogram — proof this specific cart was authorized.",
  },
  l2_payment_view: {
    key: "l2_payment_view",
    short:
      "Demo-side: the L2 presentation shown to the network — the payment-related disclosures (budget/payees) but not the cart.",
    source: "inferred",
  },
  l2_checkout_view: {
    key: "l2_checkout_view",
    short:
      "Demo-side: the L2 presentation shown to the merchant — the cart-related disclosures but not the budget.",
    source: "inferred",
  },

  // ── orchestrator event / step payload fields ───────────────────────────
  step: {
    key: "step",
    short:
      "Demo-side: ordinal index of this event in the flow (0–11).",
    source: "inferred",
  },
  role: {
    key: "role",
    short:
      "Demo-side: the role that performed this step (system, issuer, wallet, agent, merchant, or network).",
    source: "inferred",
  },
  action: {
    key: "action",
    short:
      "Demo-side: machine name of this step (e.g. l1_issued, l3_built), used to key narratives and spec references.",
    source: "inferred",
  },
  summary: {
    key: "summary",
    short:
      "Demo-side: a human-readable description of what happened in this step (or, at completion, a roll-up of the whole transaction).",
    source: "inferred",
  },
  ts: {
    key: "ts",
    short:
      "Demo-side: Unix timestamp (seconds) when this event was emitted.",
    source: "inferred",
  },
  track: {
    key: "track",
    short:
      "Demo-side: which run this event belongs to — \"reference\" (clean) or \"injection\" (a tamper scenario), used by the side-by-side comparison.",
    source: "inferred",
  },
  run_id: {
    key: "run_id",
    short:
      "Demo-side: identifier of the demo run/session that produced this event.",
    source: "inferred",
  },
  prompt: {
    key: "prompt",
    short:
      "Demo-side: the natural-language purchase request the user gave the agent.",
    source: "inferred",
  },
  budget_usd: {
    key: "budget_usd",
    short:
      "Demo-side: the spending budget expressed in dollars.",
    source: "inferred",
  },
  budget_cents: {
    key: "budget_cents",
    short:
      "Demo-side: the spending budget expressed in cents (the integer minor-unit form used for constraint checks).",
    source: "inferred",
  },
  injection_mode: {
    key: "injection_mode",
    short:
      "Demo-side: which tamper/attack scenario is active for this run, or null for the clean reference run.",
    source: "inferred",
  },
  tampered: {
    key: "tampered",
    short:
      "Demo-side: true when this step's data was deliberately altered for an injection scenario — used to show how verification catches it.",
    source: "inferred",
  },
  keys: {
    key: "keys",
    short:
      "Demo-side: the public keys enrolled per role at startup — each with its kid and public JWK. Private keys never leave their owner.",
    source: "inferred",
  },
  public_jwk: {
    key: "public_jwk",
    short:
      "Demo-side: the public half of a role's ES256 key, as a JWK. This is the only key material exchanged between roles.",
    source: "inferred",
  },
  sku: {
    key: "sku",
    short:
      "Stock-keeping unit — the product identifier the agent selected from the acceptable_items catalog.",
    source: "inferred",
  },
  rationale: {
    key: "rationale",
    short:
      "Demo-side: the agent's explanation for why it picked this product from inside the allowed set.",
    source: "inferred",
  },
  product: {
    key: "product",
    short:
      "Demo-side: the full product record the agent chose (sku, name, brand, category, price).",
    source: "inferred",
  },
  raw_llm_response: {
    key: "raw_llm_response",
    short:
      "Demo-side: the raw tool/LLM output behind the agent's product choice (or a stub marker when no live model is used). Non-cryptographic; the agent's only real authority is choosing inside the signed envelope.",
    source: "inferred",
  },
  checkout_payload: {
    key: "checkout_payload",
    short:
      "Demo-side: the decoded payload of the merchant's checkout JWT (the itemized cart) shown for inspection.",
    source: "inferred",
  },
  chain_valid: {
    key: "chain_valid",
    short:
      "Demo-side: result of the credential-chain check — whether every signature and sd_hash binding from L3 back to L1 verified.",
    source: "inferred",
  },
  errors: {
    key: "errors",
    short:
      "Demo-side: chain-verification error messages, empty when the chain is valid.",
    source: "inferred",
  },
  chain_errors: {
    key: "chain_errors",
    short:
      "Demo-side: chain-verification error messages reported by the network, empty when valid.",
    source: "inferred",
  },
  checks_performed: {
    key: "checks_performed",
    short:
      "Demo-side: the list of verification checks this role actually ran on the credentials it received.",
    source: "inferred",
  },
  checks_skipped: {
    key: "checks_skipped",
    short:
      "Demo-side: checks this role did not run — typically because the relevant claims were not disclosed to it (selective disclosure in action).",
    source: "inferred",
  },
  l2_checkout_disclosed: {
    key: "l2_checkout_disclosed",
    short:
      "Demo-side: the L2 claims the merchant was actually allowed to see (the cart side), demonstrating selective disclosure.",
    source: "inferred",
  },
  l2_payment_disclosed: {
    key: "l2_payment_disclosed",
    short:
      "Demo-side: the L2 claims the network was actually allowed to see (the payment side), demonstrating selective disclosure.",
    source: "inferred",
  },
  constraints_satisfied: {
    key: "constraints_satisfied",
    short:
      "Demo-side: whether the L3 fulfillment satisfied every L2 constraint under STRICT-mode checking.",
    source: "inferred",
  },
  constraint_checks: {
    key: "constraint_checks",
    short:
      "Demo-side: the individual constraint checks the network performed (amount range, currency, allowed payees, line items).",
    source: "inferred",
  },
  constraint_violations: {
    key: "constraint_violations",
    short:
      "Demo-side: descriptions of any constraints the fulfillment broke. A non-empty list means the transaction is declined.",
    source: "inferred",
  },
  payment_constraints: {
    key: "payment_constraints",
    short:
      "Demo-side: the payment-side constraints (from L2) the network evaluated the fulfillment against.",
    source: "inferred",
  },
  fulfillment: {
    key: "fulfillment",
    short:
      "Demo-side: the concrete payment (from L3a) the network checked against the constraints — the resolved amount, payee, and instrument.",
    source: "inferred",
  },
  approved: {
    key: "approved",
    short:
      "Demo-side: whether the network authorized the transaction. Only true after the full chain and every constraint passed.",
    source: "inferred",
  },
  authorization_id: {
    key: "authorization_id",
    short:
      "The authorization identifier minted when the transaction is approved — the link from VI verification to existing card-network rails. Empty on decline.",
    source: "spec",
    specRef: "VI §12",
    payments_analog:
      "The approval code Visa/Mastercard/Amex return on a contactless tap.",
  },
  reason: {
    key: "reason",
    short:
      "Demo-side: the human-readable decline reason, or null when approved.",
    source: "inferred",
  },
  extra: {
    key: "extra",
    short:
      "Demo-side: additional authorization detail — the payee, amount in cents, and currency that were charged.",
    source: "inferred",
  },
  amount_cents: {
    key: "amount_cents",
    short:
      "An amount in cents (integer minor units), the form used for exact constraint comparisons.",
    source: "inferred",
  },
  completed_at: {
    key: "completed_at",
    short:
      "Demo-side: timestamp when the transaction finished, in the completion roll-up.",
    source: "inferred",
  },

  // ── generic product / merchant fields ───────────────────────────────────
  id: {
    key: "id",
    short:
      "An identifier for the surrounding object — e.g. a line-item id, product id, merchant id, or payment-instrument id.",
    source: "inferred",
  },
  brand: {
    key: "brand",
    short:
      "Demo-side: the product's brand name.",
    source: "inferred",
  },
  category: {
    key: "category",
    short:
      "Demo-side: the product's category.",
    source: "inferred",
  },
  price: {
    key: "price",
    short:
      "Demo-side: the product price in cents (integer minor units).",
    source: "inferred",
  },
  price_dollars: {
    key: "price_dollars",
    short:
      "Demo-side: the product price expressed in dollars.",
    source: "inferred",
  },
  title: {
    key: "title",
    short:
      "Demo-side: the product's display name within the acceptable_items catalog.",
    source: "inferred",
  },
  quantity: {
    key: "quantity",
    short:
      "Demo-side: the number of units for a cart line item or the count a line-items constraint expects.",
    source: "inferred",
  },
  website: {
    key: "website",
    short:
      "Demo-side: a merchant's website, part of its identifying record.",
    source: "inferred",
  },
  type: {
    key: "type",
    short:
      "A discriminator naming the kind of the surrounding object — e.g. a constraint type (mandate.payment.amount_range) or a payment-instrument type.",
    source: "spec",
  },
  description: {
    key: "description",
    short:
      "Demo-side: a human-readable description of the surrounding object (e.g. the payment instrument).",
    source: "inferred",
  },
  device_id: {
    key: "device_id",
    short:
      "Demo-side: a device identifier inside risk_data, a contextual signal for the verifier's risk decision.",
    source: "inferred",
  },
  ip_address: {
    key: "ip_address",
    short:
      "Demo-side: an IP address inside risk_data, a contextual signal for the verifier's risk decision.",
    source: "inferred",
  },
  items: {
    key: "items",
    short:
      "Within a line-items constraint: the groups of acceptable items and quantities the cart must satisfy.",
    source: "spec",
    specRef: "VI §7",
  },
};

/** Resolve a JSON key to its documentation, or null if undocumented. */
export function getFieldDoc(key: string): FieldDoc | null {
  return FIELD_DOCS[key] ?? null;
}
