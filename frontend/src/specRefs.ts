// Single source of truth mapping each orchestrator event `action` to its
// Verifiable Intent spec section. Used by SpecDrawer to surface the rule that
// governs each step, with a working external link.
//
// Spec home: https://verifiableintent.dev/spec/
//
// IMPORTANT: anchor IDs follow MkDocs Material slugification —
// `### 8.2 checkout_hash / transaction_id Binding` becomes
// `#82-checkout_hash-transaction_id-binding`. Always verify on the live site
// before changing a URL; broken anchors silently scroll to the page top.

export interface SpecRef {
  section: string;
  title: string;
  url: string;
  paraphrase: string;
}

const SPEC_BASE = "https://verifiableintent.dev/spec/";
const CONSTRAINTS_DOC = "https://verifiableintent.dev/spec/constraints/";
const SECURITY_DOC = "https://verifiableintent.dev/spec/security-model/";

export const SPEC_REFS: Record<string, SpecRef> = {
  demo_started: {
    section: "§1",
    title: "Introduction & motivation",
    url: SPEC_BASE,
    paraphrase:
      "VI defines a three-layer SD-JWT credential chain (L1 → L2 → L3) so AI agents can act on a user's behalf with cryptographically bounded authority — no shared secret, no central trust authority.",
  },
  enrollment: {
    section: "§3",
    title: "Cryptography & key model",
    url: SPEC_BASE + "#6-technology-foundations",
    paraphrase:
      "Each role holds its own ES256 (P-256) keypair. Only public JWKs are exchanged. Every signature in the chain is verifiable against exactly one published public key; private keys never leave their owner.",
  },
  l1_issued: {
    section: "§5",
    title: "L1 — Card credential",
    url: SPEC_BASE + "#31-layered-credential-architecture",
    paraphrase:
      "L1 is an SD-JWT signed by the issuer (e.g. a card network). It anchors the chain by binding the user's device public key via cnf.jwk. Sensitive attributes (PAN, email) appear in the SD-JWT disclosures — verifiers only learn what they are explicitly given.",
  },
  l2_created: {
    section: "§6",
    title: "L2 — User mandate (KB-SD-JWT)",
    url: SPEC_BASE + "#34-mandate-types",
    paraphrase:
      "L2 is a KB-SD-JWT signed by the user's wallet. It binds to L1 via sd_hash (parent integrity) and delegates execution to a fresh agent key via cnf.jwk. The signed `constraints` claim encodes the four-bound envelope (merchants, items, amount range, payees) the agent is allowed to act inside.",
  },
  constraints_extracted: {
    section: "§7",
    title: "Constraints & STRICT-mode enforcement",
    url: CONSTRAINTS_DOC,
    paraphrase:
      "Constraints are signed inputs. STRICT-mode verifiers (e.g. the network) MUST reject any L3 whose fulfillment falls outside the L2 envelope. The agent reads constraints to plan; the network re-checks them to authorize.",
  },
  product_selected: {
    section: "§8",
    title: "Agent execution (non-cryptographic choice)",
    url: SPEC_BASE + "#103-agent-conformance",
    paraphrase:
      "The agent's only authority is choosing one fulfillment from inside the signed envelope. It cannot rewrite L2 (no key), cannot bypass merchant verification (signed cart), and cannot bypass network authorization (constraint re-check).",
  },
  checkout_jwt_signed: {
    section: "§9",
    title: "Checkout JWT & checkout_hash",
    url: SPEC_BASE + "#82-checkout_hash-transaction_id-binding",
    paraphrase:
      "The merchant signs a checkout JWT enumerating the exact cart. Its SHA-256 (checkout_hash) becomes the canonical anchor referenced by L3a (transaction_id) and L3b (delegate_payload). Tampering with the cart breaks both hashes.",
  },
  l3_built: {
    section: "§10",
    title: "L3 — Payment (L3a) & Checkout (L3b) mandates",
    url: SPEC_BASE + "#83-cross-reference-binding-autonomous-mode",
    paraphrase:
      "The agent signs two L3 credentials with its delegated key. L3a carries the final payment (amount, payee) to the network; L3b carries the cart commitment to the merchant. transaction_id (L3a) == checkout_hash (L3b) is how the network and merchant stitch one transaction across messages they each only half see.",
  },
  merchant_verified: {
    section: "§5.3",
    title: "Merchant verification",
    url: SPEC_BASE + "#53-verification-requirements-per-role",
    paraphrase:
      "The merchant MUST verify the L1 signature, the L2 signature against L1 cnf.jwk, the sd_hash bindings, that the disclosed checkout mandate matches the submitted checkout, and (Autonomous mode) resolve the agent key via L3b's kid and verify L3b. The merchant does NOT check payment constraints — it never sees the budget.",
  },
  network_verified: {
    section: "§5.3",
    title: "Network verification + constraints",
    url: SPEC_BASE + "#53-verification-requirements-per-role",
    paraphrase:
      "The network MUST verify the same L1→L2 chain on the payment side, resolve the agent key via L3a's kid and verify L3a, and — uniquely — verify that L3a's payment values satisfy every disclosed L2 payment constraint. The demo runs this in STRICT mode: any constraint failure rejects the transaction.",
  },
  authorized: {
    section: "§12",
    title: "Authorization & settlement",
    url: SPEC_BASE + "#5-trust-model",
    paraphrase:
      "Authorization is the network's contractual commitment. It is only issued after the full chain + constraint check passes. The authorization_id links VI verification to existing card-network rails.",
  },
  declined: {
    section: "§12",
    title: "Decline path",
    url: SECURITY_DOC,
    paraphrase:
      "Decline is a first-class outcome. VI does not just verify — it enforces. Any verification or constraint failure terminates the transaction here, before settlement.",
  },
  demo_complete: {
    section: "§1",
    title: "End-to-end guarantees",
    url: SPEC_BASE,
    paraphrase:
      "Each party verified only what it needed using public keys, the chain stitched together selectively-disclosed claims into a single approved transaction, and the agent operated entirely inside an envelope it could not rewrite.",
  },
  demo_failed: {
    section: "§11",
    title: "Failure modes",
    url: SECURITY_DOC,
    paraphrase:
      "VI failure modes are attributable: each rejection cites the specific rule that failed (signature, sd_hash, cnf.jwk, typ, exp, or constraint). Silent corruption is impossible by design.",
  },
};

export function getSpecRef(action: string): SpecRef | null {
  return SPEC_REFS[action] ?? null;
}
