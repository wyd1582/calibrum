import type { ReceiptBundle } from "./types.js";

export interface TamperOptions {
  /** Receipt index to corrupt (default: middle of the chain). */
  index?: number;
  /** Dotted field path inside the receipt, e.g. "context.energy_wh". */
  field: string;
  /** Explicit replacement value; if omitted a type-appropriate corruption is applied. */
  value?: unknown;
}

export interface TamperResult {
  bundle: ReceiptBundle;
  index: number;
  field: string;
  before: unknown;
  after: unknown;
  description: string;
}

function corrupt(v: unknown): unknown {
  if (typeof v === "number") return v === 0 ? 1 : v * 10;
  if (typeof v === "string") return `${v}-tampered`;
  if (typeof v === "boolean") return !v;
  if (Array.isArray(v)) return [...v, "TAMPERED"];
  if (v === null || v === undefined) return "TAMPERED";
  return { ...(v as object), tampered: true };
}

/**
 * Deep-clone the bundle and corrupt one field of one receipt WITHOUT re-signing —
 * exactly what an adversary editing a stored receipt would leave behind.
 */
export function tamperBundle(bundle: ReceiptBundle, opts: TamperOptions): TamperResult {
  const clone = JSON.parse(JSON.stringify(bundle)) as ReceiptBundle;
  const n = clone.receipts.length;
  if (n === 0) throw new Error("tamper: bundle has no receipts");
  const index = opts.index ?? Math.floor(n / 2);
  if (!Number.isInteger(index) || index < 0 || index >= n) throw new Error(`tamper: index ${index} out of range 0..${n - 1}`);
  const path = opts.field.split(".").filter(Boolean);
  if (path.length === 0) throw new Error("tamper: field path is empty");
  let target: Record<string, unknown> = clone.receipts[index] as unknown as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const next = target[path[i] as string];
    if (typeof next !== "object" || next === null) throw new Error(`tamper: '${path.slice(0, i + 1).join(".")}' is not an object`);
    target = next as Record<string, unknown>;
  }
  const leaf = path[path.length - 1] as string;
  if (!(leaf in target)) throw new Error(`tamper: field '${opts.field}' does not exist on receipt ${index}`);
  const before = target[leaf];
  const after = opts.value !== undefined ? opts.value : corrupt(before);
  target[leaf] = after;
  return {
    bundle: clone,
    index,
    field: opts.field,
    before,
    after,
    description: `receipt #${index} (${clone.receipts[index]?.receipt_id}): ${opts.field} ${JSON.stringify(before)} → ${JSON.stringify(after)} (hash and signature left untouched)`,
  };
}
