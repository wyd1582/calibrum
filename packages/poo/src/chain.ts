import { HEX64, receiptHash } from "./hash.js";
import { GENESIS_HASH, type CheckResult, type Receipt } from "./types.js";

/**
 * Chain-continuity checks for receipt i given receipt i-1.
 * Pure: never throws on malformed input; every problem becomes a failed check.
 */
export function chainChecks(r: Receipt, prev: Receipt | null, expectedMachine: string): CheckResult[] {
  const out: CheckResult[] = [];

  const recomputed = safeHash(r);
  out.push({
    kind: "hash",
    name: "hash_recompute",
    ok: recomputed !== null && recomputed === r.hash,
    detail:
      recomputed === null
        ? "receipt body could not be canonicalised"
        : recomputed === r.hash
          ? `sha256(canonical body) = ${short(r.hash)}`
          : `stored ${short(r.hash)} ≠ recomputed ${short(recomputed)} — body was modified after signing`,
  });

  if (prev === null) {
    out.push({
      kind: "chain",
      name: "genesis_prev_hash",
      ok: r.prev_hash === GENESIS_HASH,
      detail: r.prev_hash === GENESIS_HASH ? "first receipt links to GENESIS" : `first receipt prev_hash is ${short(r.prev_hash)}, expected GENESIS`,
    });
    out.push({
      kind: "chain",
      name: "epoch_start",
      ok: Number.isInteger(r.epoch) && r.epoch >= 0,
      detail: Number.isInteger(r.epoch) && r.epoch >= 0 ? `epoch ${r.epoch}` : `epoch ${r.epoch} is not a non-negative integer`,
    });
  } else {
    const linkOk = typeof r.prev_hash === "string" && HEX64.test(r.prev_hash) && r.prev_hash === prev.hash;
    out.push({
      kind: "chain",
      name: "prev_hash_link",
      ok: linkOk,
      detail: linkOk
        ? `prev_hash matches receipt #${prev.epoch} (${short(prev.hash)})`
        : `prev_hash ${short(String(r.prev_hash))} ≠ hash of receipt #${prev.epoch} (${short(prev.hash)}) — chain broken`,
    });
    const epochOk = r.epoch === prev.epoch + 1;
    out.push({
      kind: "chain",
      name: "epoch_increment",
      ok: epochOk,
      detail: epochOk ? `epoch ${prev.epoch} → ${r.epoch}` : `epoch ${prev.epoch} → ${r.epoch}, expected ${prev.epoch + 1} (gap, replay or reorder)`,
    });
    const tPrev = Date.parse(prev.timestamp);
    const tCur = Date.parse(r.timestamp);
    const timeOk = Number.isFinite(tPrev) && Number.isFinite(tCur) && tCur >= tPrev;
    out.push({
      kind: "chain",
      name: "timestamp_monotonic",
      ok: timeOk,
      detail: timeOk ? `${prev.timestamp} ≤ ${r.timestamp}` : `timestamp ${r.timestamp} precedes previous ${prev.timestamp}`,
    });
  }

  out.push({
    kind: "chain",
    name: "machine_id_consistent",
    ok: r.machine_id === expectedMachine,
    detail: r.machine_id === expectedMachine ? "machine_id matches bundle" : `machine_id ${r.machine_id} ≠ bundle machine ${expectedMachine}`,
  });

  return out;
}

function safeHash(r: Receipt): string | null {
  try {
    return receiptHash(r);
  } catch {
    return null;
  }
}

export function short(h: string): string {
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}
