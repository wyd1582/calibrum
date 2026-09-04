/**
 * Proof of Operation (PoO) v0.1 — receipt schema.
 *
 * A receipt is a hardware-signed statement that a specific machine performed a
 * specific unit of work under specific conditions. Receipts are hash-chained per
 * machine (prev_hash → hash) and signed with the machine's Ed25519 key, whose
 * public half is embedded in `machine_id` as a did:key.
 *
 * See docs/poo-spec.md for the normative description.
 */

export const POO_VERSION = "poo/0.1" as const;

/** 64 hex zeros: the prev_hash of the first receipt in a machine's chain. */
export const GENESIS_HASH = "0".repeat(64);

export type TaskClass =
  | "amr_transport"
  | "humanoid_manipulation"
  | "drone_flight"
  | "gpu_training"
  | "idle"
  | "maintenance";

export type ReceiptEvent =
  | "genesis"
  | "operation"
  | "maintenance"
  | "incident"
  | "policy_bound"
  | "credit_draw"
  | "repayment"
  | "claim_settled";

export type AttesterKind = "device" | "oem" | "servicer" | "validator";

export interface ReceiptContext {
  /** Task performed during the epoch. */
  task_class: TaskClass;
  /** Seconds of productive operation claimed for this epoch (0..epoch length). */
  operating_seconds: number;
  /** Energy drawn during the epoch, watt-hours. Cross-checked against operating_seconds. */
  energy_wh: number;
  /** Human interventions required during the epoch. */
  interventions: number;
  /** Fault codes raised during the epoch (empty if none). */
  fault_codes: string[];
  /** Firmware version running during the epoch. */
  fw_version: string;
  /** Environment severity 0 (benign) .. 1 (harsh). */
  env_severity: number;
  /** Free-form human-readable note (e.g. "Collision — rack impact"). */
  note?: string;
}

export interface RiskSnapshot {
  /** Machine Risk Score at receipt time (300–850). */
  mrs: number;
  /** Probability of failure within the next 30 operating cycles at receipt time. */
  p_fail_30: number;
  /** Identifier of the scoring contract used, e.g. "logistic_scorecard_v0/mrs_v0". */
  model: string;
}

export interface Attester {
  /** Identifier of the attesting party (did:key for devices, org id otherwise). */
  id: string;
  kind: AttesterKind;
}

/** Everything that is hashed. `hash` and `signature` are derived from this. */
export interface ReceiptBody {
  version: typeof POO_VERSION;
  /** Unique receipt identifier, e.g. "rcpt_<machine-short>_<epoch>". */
  receipt_id: string;
  /** did:key:z... (Ed25519 public key, multicodec 0xed01, base58btc). */
  machine_id: string;
  /** Monotonic per-machine epoch index; strictly +1 per receipt. */
  epoch: number;
  /** ISO-8601 UTC timestamp at end of epoch. */
  timestamp: string;
  event: ReceiptEvent;
  context: ReceiptContext;
  risk_snapshot: RiskSnapshot;
  attester: Attester;
  /** SHA-256 hex of the previous receipt in this machine's chain, or GENESIS_HASH. */
  prev_hash: string;
}

export interface Receipt extends ReceiptBody {
  /** SHA-256 hex over the canonical JSON of the ReceiptBody. */
  hash: string;
  /** Ed25519 signature (hex) over the hash bytes, by the machine key in machine_id. */
  signature: string;
}

/** A batch of receipts for one machine, optionally Merkle-rooted and anchored. */
export interface ReceiptBundle {
  version: typeof POO_VERSION;
  machine_id: string;
  receipts: Receipt[];
  /** Merkle root over receipt hashes (hex). Optional; verified if present. */
  merkle_root?: string;
  /** Anchor record if the root has been committed to a ledger. */
  anchor?: AnchorRecord;
  /** Provenance note, e.g. "SIMULATED — poo sign". Never omitted for simulated data. */
  provenance: string;
}

export interface AnchorRecord {
  chain: string;
  root: string;
  count: number;
  anchored_at: string;
  /** Chain-specific reference (tx hash, block, or mock id). */
  ref: string;
}

/** Per-check result inside a verification report. */
export interface CheckResult {
  /** Check family. */
  kind: "schema" | "hash" | "chain" | "signature" | "physics" | "merkle";
  name: string;
  ok: boolean;
  detail: string;
}

export interface LinkResult {
  index: number;
  receipt_id: string;
  epoch: number;
  ok: boolean;
  checks: CheckResult[];
}

export interface VerificationReport {
  ok: boolean;
  machine_id: string;
  receipts: number;
  links: LinkResult[];
  /** Bundle-level checks (Merkle root, anchor presence). */
  batch: CheckResult[];
  computed_merkle_root: string | null;
  failed_checks: number;
}
