# @calibrum/poo — Proof of Operation reference implementation

Ed25519-signed, hash-chained operating receipts for machines, with Merkle batching, physics-envelope checks and a chain-agnostic anchor interface. TypeScript, zero network dependencies, MIT.

**Spec:** [`docs/poo-spec.md`](../../docs/poo-spec.md) · **Threat model:** spec §8 · **Coverage:** verifier logic held at 100 % in CI.

## Sixty-second demo

```bash
pnpm --filter @calibrum/poo poo sign -d 7 --anchor -o receipts.json   # simulate 7 machine-days, sign, chain, Merkle-root, mock-anchor
pnpm --filter @calibrum/poo poo verify receipts.json                  # RESULT: PASS
pnpm --filter @calibrum/poo poo tamper receipts.json --field context.energy_wh
pnpm --filter @calibrum/poo poo verify receipts.tampered.json         # RESULT: FAIL — names the receipt, the field family and why
```

Or from the repo root: `make verify-poo`.

What the tampered verification prints:

```
[FAIL] #3 rcpt_xxxxxx_00003
       FAIL hash/hash_recompute: stored 6f1c…a2e1 ≠ recomputed 9b02…77c4 — body was modified after signing
       FAIL signature/ed25519: signature covers the stored hash but not the current body — content was edited after signing
       FAIL physics/energy_vs_hours: average draw 6083 W outside 150–900 W for amr_transport — energy inconsistent with claimed hours
```

Every receipt is simulated and says so in the bundle's `provenance` field. Nothing here is field data.

## Library

```ts
import { generateKeyPair, didKeyFromPublicKey, createReceipt, verifyBundle, formatReport, tamperBundle, merkleRoot, MockAnchor } from "@calibrum/poo";

const keys = generateKeyPair();                    // Ed25519; seed it only for demos
const machine_id = didKeyFromPublicKey(keys.publicKey);   // did:key:z6Mk… — the verification key travels in the id

const r0 = createReceipt({ receipt_id: "r0", machine_id, epoch: 0, timestamp: new Date().toISOString(),
  event: "operation", context: { task_class: "amr_transport", operating_seconds: 36000, energy_wh: 4000,
  interventions: 0, fault_codes: [], fw_version: "7.3.1", env_severity: 0.3 },
  risk_snapshot: { mrs: 782, p_fail_30: 0.01, model: "logistic_scorecard_v0/mrs_v0" },
  attester: { id: machine_id, kind: "device" } }, keys.privateKey);            // prev_hash = GENESIS
const r1 = createReceipt({ ...r0, receipt_id: "r1", epoch: 1, prev_hash: undefined }, keys.privateKey, r0);

const bundle = { version: "poo/0.1", machine_id, receipts: [r0, r1], merkle_root: merkleRoot([r0.hash, r1.hash]), provenance: "example" };
const report = verifyBundle(bundle);               // never throws; every problem is a failed check
console.log(formatReport(report));
```

### API surface

| Module | Exports |
|---|---|
| receipts | `createReceipt`, `resignReceipt`, `receiptHash`, `canonicalize` |
| keys | `generateKeyPair`, `sign`, `verifySignature`, `didKeyFromPublicKey`, `publicKeyFromDidKey` |
| verification | `verifyBundle`, `formatReport`, `chainChecks`, `physicsChecks`, `ENVELOPES` |
| batching | `merkleRoot`, `merkleProof`, `verifyMerkleProof` |
| anchoring | `Anchor`, `MockAnchor`, `EvmAnchorStub`, `encodeAnchorCalldata` |
| demo tooling | `simulateMachine`, `tamperBundle`, `encodeBundle` / `decodeBundle` (JSON + CBOR) |

## CLI

```
poo keygen [--seed s]
poo sign   [-d days] [-s seed] [-t amr_transport|humanoid_manipulation|drone_flight|gpu_training] [-f json|cbor] [--anchor] [-o file]
poo verify <file> [--json] [-v] [--skip-physics]      # exit code 1 on FAIL
poo tamper <file> --field <dotted.path> [-i index] [--value <json>] [-o out]
```

## What a PASS means — and does not

A PASS proves the holder of the machine's private key signed these exact bodies, in this order, with no gaps, and that each receipt is internally physically consistent. It does **not** prove the events happened: a compromised sensor signs garbage as happily as truth. The spec's threat model (§8) lays out the three further layers — physics cross-checks, adversarial financial outcomes, stake-and-slash — that give a receipt its meaning.

## Development

```bash
pnpm install
pnpm --filter @calibrum/poo test        # vitest + v8 coverage with thresholds
pnpm --filter @calibrum/poo lint
pnpm --filter @calibrum/poo build       # emits dist/ for publishing
```

MIT © 2026 Calibrum.
