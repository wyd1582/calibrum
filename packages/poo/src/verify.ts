import { chainChecks } from "./chain.js";
import { HEX64, HEX128, hexToBytes, receiptHash } from "./hash.js";
import { publicKeyFromDidKey, verifySignature } from "./keys.js";
import { merkleRoot } from "./merkle.js";
import { physicsChecks } from "./physics.js";
import { POO_VERSION, type CheckResult, type LinkResult, type Receipt, type ReceiptBundle, type VerificationReport } from "./types.js";

export interface VerifyOptions {
  /** Skip physics envelope checks (signature + chain only). Default false. */
  skipPhysics?: boolean;
}

const REQUIRED_FIELDS: (keyof Receipt)[] = [
  "version",
  "receipt_id",
  "machine_id",
  "epoch",
  "timestamp",
  "event",
  "context",
  "risk_snapshot",
  "attester",
  "prev_hash",
  "hash",
  "signature",
];

function schemaChecks(r: Receipt): CheckResult[] {
  const missing = REQUIRED_FIELDS.filter((f) => (r as unknown as Record<string, unknown>)[f] === undefined);
  const out: CheckResult[] = [
    {
      kind: "schema",
      name: "required_fields",
      ok: missing.length === 0,
      detail: missing.length === 0 ? "all required fields present" : `missing: ${missing.join(", ")}`,
    },
    {
      kind: "schema",
      name: "version",
      ok: r.version === POO_VERSION,
      detail: r.version === POO_VERSION ? POO_VERSION : `unsupported version '${String(r.version)}'`,
    },
    {
      kind: "schema",
      name: "hash_format",
      ok: typeof r.hash === "string" && HEX64.test(r.hash),
      detail: typeof r.hash === "string" && HEX64.test(r.hash) ? "64-hex sha256" : "hash is not a 64-hex sha256",
    },
  ];
  const rs = r.risk_snapshot;
  const rsOk = !!rs && Number.isFinite(rs.mrs) && rs.mrs >= 300 && rs.mrs <= 850 && Number.isFinite(rs.p_fail_30) && rs.p_fail_30 >= 0 && rs.p_fail_30 <= 1;
  out.push({
    kind: "schema",
    name: "risk_snapshot_range",
    ok: rsOk,
    detail: rsOk ? `MRS ${rs.mrs} · p30 ${rs.p_fail_30.toFixed(3)}` : "risk_snapshot missing or out of range (MRS 300–850, p_fail_30 0–1)",
  });
  return out;
}

function signatureCheck(r: Receipt): CheckResult {
  const pub = publicKeyFromDidKey(String(r.machine_id));
  let bodyHash: string | null = null;
  try {
    bodyHash = receiptHash(r);
  } catch {
    bodyHash = null;
  }
  if (!pub) {
    return { kind: "signature", name: "machine_key", ok: false, detail: `machine_id '${String(r.machine_id)}' is not a valid Ed25519 did:key` };
  }
  if (typeof r.signature !== "string" || !HEX128.test(r.signature) || bodyHash === null) {
    return { kind: "signature", name: "ed25519", ok: false, detail: "signature malformed or body not hashable (expected 128-hex Ed25519 signature over the body hash)" };
  }
  // Verified over the hash of the body as it is NOW — "did the machine key sign this exact content?"
  const ok = verifySignature(hexToBytes(r.signature), hexToBytes(bodyHash), pub);
  const storedOk = typeof r.hash === "string" && HEX64.test(r.hash) && verifySignature(hexToBytes(r.signature), hexToBytes(r.hash), pub);
  return {
    kind: "signature",
    name: "ed25519",
    ok,
    detail: ok
      ? "valid signature by the key embedded in machine_id"
      : storedOk
        ? "signature covers the stored hash but not the current body — content was edited after signing"
        : "signature does not verify against machine_id key — not signed by this machine",
  };
}

/**
 * Verify a bundle: schema, hash recompute, chain continuity, Ed25519 signature
 * and physics envelope for every receipt; Merkle root and anchor at batch level.
 * Never throws on malformed input.
 */
export function verifyBundle(bundle: ReceiptBundle, opts: VerifyOptions = {}): VerificationReport {
  const receipts = Array.isArray(bundle.receipts) ? bundle.receipts : [];
  const links: LinkResult[] = [];
  let prev: Receipt | null = null;
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i] as Receipt;
    const checks: CheckResult[] = [
      ...schemaChecks(r),
      ...chainChecks(r, prev, bundle.machine_id),
      signatureCheck(r),
      ...(opts.skipPhysics || !r.context ? [] : physicsChecks(r.context)),
    ];
    links.push({ index: i, receipt_id: String(r.receipt_id), epoch: r.epoch, ok: checks.every((c) => c.ok), checks });
    prev = r;
  }

  const batch: CheckResult[] = [];
  let computedRoot: string | null = null;
  const allHashesValid = receipts.length > 0 && receipts.every((r) => typeof r.hash === "string" && HEX64.test(r.hash));
  if (allHashesValid) computedRoot = merkleRoot(receipts.map((r) => r.hash));
  batch.push({
    kind: "merkle",
    name: "batch_nonempty",
    ok: receipts.length > 0,
    detail: receipts.length > 0 ? `${receipts.length} receipt(s)` : "bundle contains no receipts",
  });
  if (bundle.merkle_root !== undefined) {
    const ok = computedRoot !== null && computedRoot === bundle.merkle_root;
    batch.push({
      kind: "merkle",
      name: "merkle_root",
      ok,
      detail: ok ? `root ${bundle.merkle_root.slice(0, 12)}… matches` : `stored root ${String(bundle.merkle_root).slice(0, 12)}… ≠ computed ${computedRoot ? computedRoot.slice(0, 12) + "…" : "n/a"}`,
    });
  }
  if (bundle.anchor !== undefined) {
    const ok = bundle.anchor.root === bundle.merkle_root && bundle.anchor.count === receipts.length;
    batch.push({
      kind: "merkle",
      name: "anchor_consistent",
      ok,
      detail: ok ? `anchored on ${bundle.anchor.chain} (${bundle.anchor.ref})` : "anchor record does not match bundle root/count",
    });
  }

  const failed = links.reduce((n, l) => n + l.checks.filter((c) => !c.ok).length, 0) + batch.filter((c) => !c.ok).length;
  return {
    ok: failed === 0,
    machine_id: bundle.machine_id,
    receipts: receipts.length,
    links,
    batch,
    computed_merkle_root: computedRoot,
    failed_checks: failed,
  };
}

/** Human-readable PASS/FAIL report, one line per check that matters. */
export function formatReport(report: VerificationReport, opts: { verbose?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(`Proof of Operation verification — machine ${report.machine_id}`);
  lines.push(`${report.receipts} receipt(s) · ${report.failed_checks} failed check(s)`);
  lines.push("");
  for (const link of report.links) {
    const tag = link.ok ? "PASS" : "FAIL";
    lines.push(`[${tag}] #${link.epoch} ${link.receipt_id}`);
    for (const c of link.checks) {
      if (!c.ok || opts.verbose) lines.push(`       ${c.ok ? "ok  " : "FAIL"} ${c.kind}/${c.name}: ${c.detail}`);
    }
  }
  lines.push("");
  for (const c of report.batch) lines.push(`[${c.ok ? "PASS" : "FAIL"}] batch/${c.name}: ${c.detail}`);
  if (report.computed_merkle_root) lines.push(`merkle root: ${report.computed_merkle_root}`);
  lines.push("");
  lines.push(report.ok ? "RESULT: PASS — chain intact, signatures valid, physics consistent." : "RESULT: FAIL — see failed checks above.");
  return lines.join("\n");
}
