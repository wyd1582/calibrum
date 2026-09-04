# Proof of Operation (PoO) — Specification v0.1

**Status:** draft for review · **License:** MIT (reference implementation in `packages/poo`) · **Audience:** protocol engineers, insurers' data teams, auditors.

Proof of Operation is a cryptographically signed receipt that a specific machine performed a specific unit of work under specific conditions. Receipts are hash-chained per machine, batched into Merkle trees, and the roots are anchored on a neutral ledger. Raw telemetry never leaves the operator; what travels is the receipt — enough for a lender, insurer, servicer or buyer to re-verify a machine's operating history without trusting whoever handed it to them.

The one-line rationale: **lower verification cost → shorter Underwriting Distance → lower uncertainty → lower cost of machine capital.** Every design choice below is judged by whether it lowers the cost, for a stranger, of checking a claim about a machine.

---

## 1. Scope and non-goals

PoO v0.1 specifies:

1. The **receipt** data model and its canonical encoding (§2).
2. **Hashing and signing** rules (§3).
3. **Per-machine hash chaining** (§4).
4. **Merkle batching** and inclusion proofs (§5).
5. A **chain-agnostic anchor interface** with an EVM stub and a mock (§6).
6. **Verifier semantics**: the exact checks a conforming verifier runs and how it reports (§7).
7. A **threat model** that is explicit about what a signature does and does not prove (§8).

Non-goals for v0.1: key provisioning inside secure elements, revocation, receipt privacy beyond "raw telemetry stays off the receipt", multi-party attestations, and any token or staking mechanics beyond the interface points named in §8.

## 2. Receipt schema

A receipt has a **body** (everything that is hashed) plus two derived fields, `hash` and `signature`.

| Field | Type | Meaning |
|---|---|---|
| `version` | `"poo/0.1"` | Schema version. |
| `receipt_id` | string | Unique id. Convention: `rcpt_<machine-suffix>_<epoch:05d>`. |
| `machine_id` | string | `did:key:z…` — Ed25519 public key, multicodec `0xed01`, base58btc. The verification key travels *inside* the identifier. |
| `epoch` | integer ≥ 0 | Per-machine monotonic epoch index. Strictly `+1` per receipt. |
| `timestamp` | ISO-8601 UTC | End of the epoch. Non-decreasing along the chain. |
| `event` | enum | `genesis · operation · maintenance · incident · policy_bound · credit_draw · repayment · claim_settled`. |
| `context` | object | The operating facts (below). |
| `risk_snapshot` | object | `{ mrs: 300–850, p_fail_30: 0–1, model: string }` — the Machine Risk Score at receipt time and the contract that produced it. |
| `attester` | object | `{ id, kind }` with `kind ∈ device · oem · servicer · validator`. |
| `prev_hash` | hex64 | Hash of the previous receipt in this machine's chain, or `GENESIS` (64 zeros). |
| `hash` | hex64 | SHA-256 over the canonical body (§3). |
| `signature` | hex128 | Ed25519 signature over the 32 hash bytes, by the key in `machine_id`. |

### 2.1 `context`

| Field | Type | Meaning |
|---|---|---|
| `task_class` | enum | `amr_transport · humanoid_manipulation · drone_flight · gpu_training · idle · maintenance`. Selects the physics envelope (§7.4). |
| `operating_seconds` | number | Productive seconds claimed for the epoch, `0 ≤ s ≤ 86 400`. |
| `energy_wh` | number ≥ 0 | Energy drawn during the epoch. Cross-checked against `operating_seconds`. |
| `interventions` | integer ≥ 0 | Human interventions during the epoch. |
| `fault_codes` | string[] | Fault codes raised (empty if none). |
| `fw_version` | string | Firmware version in force. |
| `env_severity` | number 0–1 | Environment severity (temperature, dust, terrain…) as the OEM defines it. |
| `note` | string? | Optional human-readable note. |

An epoch is a machine-day in v0.1 (86 400 s). Finer epochs are a version bump, not a config flag, because the envelope constants in §7.4 assume the day.

### 2.2 Encodings

Two views are defined and MUST round-trip:

* **JSON** — the human-readable interchange form. Whitespace and key order are irrelevant because hashing uses the canonical form (§3.1), never the file bytes.
* **CBOR** — the compact wire form for constrained devices (RFC 8949). The reference encoder sorts map keys and disables record/structure extensions so any CBOR decoder can read it.

A **bundle** wraps a machine's receipts for transport:

```json
{
  "version": "poo/0.1",
  "machine_id": "did:key:z6Mk…",
  "receipts": [ … ],
  "merkle_root": "hex64",          // optional
  "anchor": { "chain", "root", "count", "anchored_at", "ref" },   // optional
  "provenance": "SIMULATED — …"    // mandatory; simulated bundles say so
}
```

## 3. Hashing and signing

### 3.1 Canonical JSON

The hash input is the canonical JSON of the body:

* object keys sorted by code point, recursively;
* no whitespace;
* arrays in order;
* properties whose value is `undefined` are dropped;
* numbers serialised as JavaScript `JSON.stringify` would (shortest round-trip); non-finite numbers are a hard error, never `null`;
* `hash` and `signature` are excluded.

Reference: `canonicalize()` in `src/canonical.ts`.

### 3.2 Hash

`hash = SHA-256( UTF-8( canonical(body) ) )`, hex-encoded lowercase.

### 3.3 Signature

`signature = Ed25519.sign( bytes(hash), machine_private_key )`, hex-encoded. Signing the digest rather than the body keeps the signed payload fixed-size (32 bytes) for secure elements.

A verifier MUST verify the signature against the **recomputed** hash of the body as presented, not against the stored `hash` field. That is what makes "did this key sign *this* content?" the question being answered; a receipt whose stored hash still carries a valid signature but whose body no longer hashes to it is reported as *edited after signing*.

### 3.4 Machine identity

`machine_id = "did:key:z" + base58btc( 0xed 0x01 ‖ public_key )` (W3C did:key method, Ed25519 codec). The verifier extracts the public key from the identifier, so no key registry is required to verify a receipt. Binding the key to hardware (secure element / TEE attestation at provisioning) is out of scope for v0.1 and is the single most important production step — see §8.

## 4. Hash chaining

Each receipt commits to its predecessor through `prev_hash`. For receipt *i*:

* *i = 0*: `prev_hash == GENESIS` (64 zeros) and `epoch ≥ 0`.
* *i > 0*: `prev_hash == hash(receipt i−1)`, `epoch == epoch(i−1) + 1`, `timestamp ≥ timestamp(i−1)`.
* every receipt carries the bundle's `machine_id`.

Consequences an auditor can rely on:

* **Deletion** of a receipt breaks the next link (`prev_hash` mismatch) and the epoch sequence.
* **Insertion** or **reordering** breaks epoch monotonicity and the link.
* **Editing** a body breaks the hash recompute and the signature; re-signing with the machine key repairs that receipt but breaks the *next* link and the Merkle root (a re-signed history is not silently accepted — it is a fork).
* **Split history** (two chains from the same predecessor) is detectable only where both chains are visible; §8 explains why that is an anchoring problem, not a chaining one.

## 5. Merkle batching

`merkle_root = root( [hash_0, hash_1, …] )` with SHA-256 over the 64-byte concatenation of child hashes, odd levels duplicating the last node. A single receipt's root is its own hash. Inclusion proofs are lists of `{hash, position}` steps; `verifyMerkleProof(leaf, proof, root)` recomputes up to the root.

Batching exists so that anchoring cost is amortised: one 32-byte root per machine per batch (typically per day or per week), not one transaction per receipt.

## 6. Anchor interface

```ts
interface Anchor {
  readonly chain: string;                                  // "mock", "evm:8453", …
  anchor(root: hex64, count: number): Promise<AnchorRecord>;
  lookup(root: hex64): Promise<AnchorRecord | null>;
}
interface AnchorRecord { chain; root; count; anchored_at; ref }
```

The interface is deliberately tiny: *commit a root, look a root up*. Two implementations ship:

* **`MockAnchor`** — in-memory, for tests and demos.
* **`EvmAnchorStub`** — builds calldata for `anchorRoot(bytes32 root, uint64 count)` on a registry contract and hands it to an injected submitter (wallet, relayer, RPC). Without a submitter it records a dry-run reference. Contract sketch:

```solidity
contract PooRegistry {
    event RootAnchored(address indexed attester, bytes32 indexed root, uint64 count, uint256 at);
    mapping(bytes32 => uint256) public anchoredAt;
    function anchorRoot(bytes32 root, uint64 count) external {
        require(anchoredAt[root] == 0, "already anchored");
        anchoredAt[root] = block.timestamp;
        emit RootAnchored(msg.sender, root, count, block.timestamp);
    }
}
```

What goes on-chain: a root, a count, a timestamp, the attester's address. What does not: receipts, telemetry, machine identity beyond what the attester chooses to publish. The chain's job is to be a neutral, append-only clock that six mutually distrustful parties (OEM, operator, insurer, lender, servicer, buyer) can all read.

## 7. Verifier semantics

A conforming verifier runs the following checks on every receipt and reports each as PASS/FAIL with a specific, human-readable reason. It MUST NOT throw on malformed input; malformed input is a failed check.

### 7.1 Schema
`required_fields`, `version`, `hash_format`, `risk_snapshot_range`.

### 7.2 Hash and chain
`hash_recompute`, `genesis_prev_hash` / `prev_hash_link`, `epoch_start` / `epoch_increment`, `timestamp_monotonic`, `machine_id_consistent`.

### 7.3 Signature
`machine_key` (did:key decodes to an Ed25519 key), `ed25519` (signature valid over the recomputed hash).

### 7.4 Physics envelope
Coarse plausibility checks that make internally inconsistent receipts fail cheaply:

| Check | Rule |
|---|---|
| `task_class_known` | envelope exists |
| `operating_seconds_range` | `0 ≤ s ≤ 86 400` |
| `energy_nonnegative` | `Wh ≥ 0` |
| `energy_vs_hours` | if `s > 0`: average draw `Wh / (s/3600)` within `[min_w, max_w]` for the task class |
| `idle_energy` | if `s = 0`: `Wh ≤ idle_wh_max` |
| `interventions_plausible` | integer, `≤ max(1, s/60)` |
| `env_severity_range` | `0 ≤ sev ≤ 1` |
| `fault_codes_list` | list of strings |

Default envelopes (watts, sustained average while operating):

| task_class | min_w | max_w | idle_wh_max |
|---|---|---|---|
| amr_transport | 150 | 900 | 400 |
| humanoid_manipulation | 200 | 1 500 | 600 |
| drone_flight | 100 | 800 | 100 |
| gpu_training | 2 000 | 12 000 | 6 000 |
| idle | 0 | 60 | 800 |
| maintenance | 0 | 300 | 800 |

These constants are placeholders for fleet-derived distributions; the check *structure* is what the spec fixes.

### 7.5 Batch
`batch_nonempty`, `merkle_root` (if present), `anchor_consistent` (if present).

### 7.6 Report
A report is `{ ok, machine_id, receipts, links[], batch[], computed_merkle_root, failed_checks }` with per-link `{ index, receipt_id, epoch, ok, checks[] }`. The CLI renders it as one `[PASS]`/`[FAIL]` line per receipt, failed checks indented beneath, and a final `RESULT:` line.

## 8. Threat model

### 8.1 What a signature proves — and does not

A valid PoO signature proves exactly this: **the holder of the private key bound to `machine_id` signed this body, and the body has not changed since.** It does *not* prove that the events in the body happened. A compromised or misconfigured sensor signs garbage as happily as truth. Any system that treats "signed" as "true" will be flooded, as the first generation of on-chain agent registries was, because registering an identity is cheap and performing is expensive.

PoO therefore treats the signature as *the cheap first filter*, and defends the meaning of a receipt with three further layers:

1. **Physics cross-checks** — energy against claimed work, interventions against hours, duty cycles against the calendar, individual histories against fleet distributions. Faking one receipt is easy; faking a physically self-consistent multi-year history across correlated channels is expensive. v0.1 ships the per-receipt subset (§7.4); fleet-level statistical checks are the engine's job.
2. **Adversarial financial outcomes** — insurance claims and loan defaults are built-in audits. A machine whose history was inflated eventually surfaces as a loss, and both outcome streams feed back into the score. Lying in receipts is a bet against your own future claims history.
3. **Stake-and-slash** — parties that attest (OEMs, servicers, validators) post collateral; attestations later contradicted by physics or outcomes are slashed. This is the only role a token plays in the system: making cheap claims expensive to fake. It is explicitly *future work* and not required for v0.1 to be useful.

### 8.2 Attack matrix

| Attack | What the attacker does | Signature / chain | Physics | Outcomes | Stake |
|---|---|---|---|---|---|
| **Forged sensor data** | Device signs fabricated context (more hours, fewer faults). | Passes. | Energy/hours and fleet-distribution checks catch inconsistent fabrication; consistent fabrication survives this layer. | Inflated histories realise as claims/defaults; score degrades. | Attester who vouched for the device is slashed once outcomes contradict. |
| **Replay** | Re-submit an old valid receipt as new. | `epoch_increment` and `timestamp_monotonic` fail; anchored roots fix the original time. | — | — | — |
| **Split history** | Keep two chains from one predecessor; show the clean one to the lender, the other to nobody. | Each chain verifies alone. Detectable **only** via anchoring: a root anchored for epoch *n* pins which branch is canonical; a second root for the same `(machine, epoch)` range is a visible fork. | — | The hidden branch's incidents still produce claims that the clean branch cannot explain. | Attester that anchored both branches is slashed. |
| **Sybil attesters** | Spin up many "validators" that vouch for each other. | Signatures are valid. | — | — | Only stake defends this: attestations are weighted by collateral at risk, and slashing is applied to the stake, not the identity. Without stake, attester diversity is decorative — v0.1 says so rather than pretending otherwise. |
| **OEM key compromise** | An attacker with the OEM's provisioning key mints plausible machines. | Signatures valid. | Fleet-level checks see a burst of statistically identical machines. | Fabricated machines never generate revenue, insurance, or maintenance receipts from third parties. | OEM's stake covers losses; key rotation and revocation (out of scope v0.1) limit blast radius. |
| **Receipt edit in storage** | Someone edits a stored receipt. | `hash_recompute` and `ed25519` fail; re-signing needs the machine key and still breaks the next link and the Merkle root. | — | — | — |
| **Deletion / reordering** | Drop an incident receipt. | `prev_hash_link` and `epoch_increment` fail. | — | — | — |

### 8.3 Residual risks v0.1 does not address

* **Hardware key binding.** v0.1 assumes the private key lives in a secure element and never leaves. Until provisioning attestation is specified, a software key is indistinguishable from a hardware one.
* **Oracle problem for physical events.** A collision the sensors did not see leaves no receipt. Outcomes (claims) are the backstop.
* **Privacy.** Receipts reveal utilisation patterns. Bundles are shared under permission; on-chain exposure is limited to roots.
* **Envelope tuning.** The §7.4 constants are coarse. Too loose lets fabrication through; too tight rejects honest edge cases. Production envelopes come from fleet data per model and task class.

## 9. Reference implementation

`packages/poo` (TypeScript, MIT):

```
poo keygen [--seed s]                     # Ed25519 keypair + did:key
poo sign   [-d days] [-s seed] [-t task] [-f json|cbor] [--anchor] [-o file]
poo verify <file> [--json] [-v] [--skip-physics]
poo tamper <file> --field context.energy_wh [-i index] [--value json] [-o out]
```

`poo tamper` corrupts one field **without re-signing** — the exact residue an adversary editing stored receipts would leave — so reviewers can watch `poo verify` name the receipt, the field family, and the reason it failed. Verifier logic (`verify.ts`, `chain.ts`, `physics.ts`, `merkle.ts`, `tamper.ts`, `canonical.ts`) is held at 100 % line/branch/function coverage in CI.

## 10. Versioning

`version` is a string; verifiers reject unknown versions. Changes to canonicalisation, hashing, signing, chaining, or the envelope *structure* require a version bump. Envelope *constants* are data and may be tuned without one, provided the bundle's `provenance` names the envelope set used.
