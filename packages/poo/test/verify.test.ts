import { describe, expect, it } from "vitest";
import { createReceipt, resignReceipt } from "../src/receipt.js";
import { formatReport, verifyBundle } from "../src/verify.js";
import { tamperBundle } from "../src/tamper.js";
import { MockAnchor } from "../src/anchor.js";
import { GENESIS_HASH, POO_VERSION, type Receipt, type ReceiptBundle } from "../src/types.js";
import { clone, fixture } from "./helpers.js";

const { bundle, keys } = fixture(6, 3);
const failedNames = (b: ReceiptBundle) =>
  verifyBundle(b).links.flatMap((l) => l.checks.filter((c) => !c.ok).map((c) => `${l.index}:${c.name}`));

describe("verifyBundle", () => {
  it("passes an intact simulated chain and computes the root", () => {
    const rep = verifyBundle(bundle);
    expect(rep.ok).toBe(true);
    expect(rep.failed_checks).toBe(0);
    expect(rep.receipts).toBe(6);
    expect(rep.computed_merkle_root).toBe(bundle.merkle_root);
    expect(rep.batch.map((c) => c.name)).toEqual(["batch_nonempty", "merkle_root"]);
    expect(formatReport(rep)).toMatch(/RESULT: PASS/);
    expect(formatReport(rep, { verbose: true })).toMatch(/ok +physics\/energy_vs_hours/);
  });

  it("a tampered field fails hash, signature and every downstream link", () => {
    const t = tamperBundle(bundle, { index: 2, field: "context.energy_wh" });
    const rep = verifyBundle(t.bundle);
    expect(rep.ok).toBe(false);
    const names = failedNames(t.bundle);
    expect(names).toContain("2:hash_recompute");
    expect(names).toContain("2:ed25519");
    expect(names).toContain("2:energy_vs_hours");
    expect(names).not.toContain("3:prev_hash_link"); // downstream prev_hash still points at the stored (stale) hash
    expect(rep.links[2]?.ok).toBe(false);
    expect(rep.links[3]?.ok).toBe(true);
    expect(rep.batch.find((c) => c.name === "merkle_root")?.ok).toBe(true); // stored hashes unchanged
    expect(formatReport(rep)).toMatch(/RESULT: FAIL/);
  });

  it("re-signing a tampered receipt with the machine key repairs it but breaks the next link", () => {
    const t = tamperBundle(bundle, { index: 1, field: "context.operating_seconds", value: 20_000 });
    t.bundle.receipts[1] = resignReceipt(t.bundle.receipts[1] as Receipt, keys.privateKey);
    const names = failedNames(t.bundle);
    expect(names).not.toContain("1:hash_recompute");
    expect(names).not.toContain("1:ed25519");
    expect(names).toContain("2:prev_hash_link");
    expect(verifyBundle(t.bundle).batch.find((c) => c.name === "merkle_root")?.ok).toBe(false);
  });

  it("a receipt signed by a different key fails the signature check", () => {
    const b = clone(bundle);
    const other = resignReceipt(b.receipts[0] as Receipt, new Uint8Array(32).fill(9));
    b.receipts[0] = other;
    const names = failedNames(b);
    expect(names).toContain("0:ed25519");
    expect(names).not.toContain("0:hash_recompute");
    expect(verifyBundle(b).links[0]?.checks.find((c) => c.name === "ed25519")?.detail).toMatch(/not signed by this machine/);
    const edited = tamperBundle(bundle, { index: 0, field: "context.fw_version", value: "0.0.0-edited" });
    expect(verifyBundle(edited.bundle).links[0]?.checks.find((c) => c.name === "ed25519")?.detail).toMatch(/edited after signing/);
    const nan = clone(bundle);
    (nan.receipts[0] as Receipt).context.energy_wh = NaN;
    expect(verifyBundle(nan).links[0]?.checks.find((c) => c.name === "ed25519")?.detail).toMatch(/not hashable/);
  });

  it("flags schema problems: missing fields, bad version, malformed hash, risk snapshot out of range", () => {
    const b = clone(bundle);
    const r = b.receipts[0] as Receipt;
    delete (r as Partial<Receipt>).attester;
    (r as { version: string }).version = "poo/9";
    r.hash = "nothex";
    r.risk_snapshot.mrs = 999;
    const names = failedNames(b);
    expect(names).toEqual(expect.arrayContaining(["0:required_fields", "0:version", "0:hash_format", "0:risk_snapshot_range", "0:ed25519"]));
    const rep = verifyBundle(b);
    expect(rep.computed_merkle_root).toBeNull();
    expect(rep.batch.find((c) => c.name === "merkle_root")?.detail).toMatch(/n\/a/);
  });

  it("rejects an invalid machine did:key", () => {
    const b = clone(bundle);
    b.machine_id = "did:key:zNope";
    for (const r of b.receipts) r.machine_id = "did:key:zNope";
    const names = failedNames(b);
    expect(names).toContain("0:machine_key");
  });

  it("handles missing context and skipPhysics", () => {
    const b = clone(bundle);
    delete (b.receipts[0] as Partial<Receipt>).context;
    const rep = verifyBundle(b);
    expect(rep.links[0]?.checks.some((c) => c.kind === "physics")).toBe(false);
    const rep2 = verifyBundle(bundle, { skipPhysics: true });
    expect(rep2.links.every((l) => l.checks.every((c) => c.kind !== "physics"))).toBe(true);
    expect(rep2.ok).toBe(true);
  });

  it("handles empty or malformed bundles without throwing", () => {
    const empty: ReceiptBundle = { version: POO_VERSION, machine_id: bundle.machine_id, receipts: [], provenance: "test" };
    const rep = verifyBundle(empty);
    expect(rep.ok).toBe(false);
    expect(rep.batch[0]?.name).toBe("batch_nonempty");
    expect(rep.computed_merkle_root).toBeNull();
    const garbage = { machine_id: "x", receipts: "nope" } as unknown as ReceiptBundle;
    expect(verifyBundle(garbage).ok).toBe(false);
    const text = formatReport(rep);
    expect(text).toMatch(/\[FAIL\] batch\/batch_nonempty/);
    expect(text).not.toMatch(/merkle root:/);
  });

  it("verifies the anchor record against root and count", async () => {
    const b = clone(bundle);
    b.anchor = await new MockAnchor().anchor(b.merkle_root as string, b.receipts.length);
    const rep = verifyBundle(b);
    expect(rep.ok).toBe(true);
    expect(rep.batch.find((c) => c.name === "anchor_consistent")?.ok).toBe(true);
    b.anchor.count = 99;
    expect(verifyBundle(b).batch.find((c) => c.name === "anchor_consistent")?.ok).toBe(false);
  });

  it("verifies a chain built manually with createReceipt", () => {
    const first = createReceipt(
      {
        receipt_id: "r0",
        machine_id: bundle.machine_id,
        epoch: 0,
        timestamp: "2026-02-01T00:00:00.000Z",
        event: "genesis",
        context: { task_class: "idle", operating_seconds: 0, energy_wh: 5, interventions: 0, fault_codes: [], fw_version: "1", env_severity: 0 },
        risk_snapshot: { mrs: 650, p_fail_30: 0.05, model: "test" },
        attester: { id: "oem:acme", kind: "oem" },
      },
      keys.privateKey,
    );
    expect(first.prev_hash).toBe(GENESIS_HASH);
    const second = createReceipt({ ...first, receipt_id: "r1", epoch: 1, timestamp: "2026-02-02T00:00:00.000Z", event: "operation", prev_hash: undefined }, keys.privateKey, first);
    expect(second.prev_hash).toBe(first.hash);
    const b: ReceiptBundle = { version: POO_VERSION, machine_id: bundle.machine_id, receipts: [first, second], provenance: "test" };
    expect(verifyBundle(b).ok).toBe(true);
  });
});
