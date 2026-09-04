import { describe, expect, it } from "vitest";
import { chainChecks, short } from "../src/chain.js";
import { GENESIS_HASH, type Receipt } from "../src/types.js";
import { clone, fixture } from "./helpers.js";

const { bundle } = fixture(4);
const [r0, r1] = bundle.receipts as [Receipt, Receipt];
const failing = (checks: ReturnType<typeof chainChecks>) => checks.filter((c) => !c.ok).map((c) => c.name);

describe("chainChecks", () => {
  it("passes on an intact chain", () => {
    expect(failing(chainChecks(r0, null, bundle.machine_id))).toEqual([]);
    expect(failing(chainChecks(r1, r0, bundle.machine_id))).toEqual([]);
  });
  it("detects a modified body via hash recompute", () => {
    const t = clone(r1);
    t.context.energy_wh += 1;
    expect(failing(chainChecks(t, r0, bundle.machine_id))).toEqual(["hash_recompute"]);
    expect(chainChecks(t, r0, bundle.machine_id)[0]?.detail).toMatch(/modified after signing/);
  });
  it("reports an un-canonicalisable body", () => {
    const t = clone(r1);
    (t as unknown as { context: { energy_wh: number } }).context.energy_wh = NaN;
    const c = chainChecks(t, r0, bundle.machine_id)[0];
    expect(c?.ok).toBe(false);
    expect(c?.detail).toMatch(/could not be canonicalised/);
  });
  it("genesis must link to GENESIS and have a valid epoch", () => {
    const t = clone(r0);
    t.prev_hash = "ab".repeat(32);
    expect(failing(chainChecks(t, null, bundle.machine_id))).toContain("genesis_prev_hash");
    const e = clone(r0);
    e.epoch = -1;
    expect(failing(chainChecks(e, null, bundle.machine_id))).toContain("epoch_start");
    expect(chainChecks(r0, null, bundle.machine_id).find((c) => c.name === "genesis_prev_hash")?.ok).toBe(true);
    expect(r0.prev_hash).toBe(GENESIS_HASH);
  });
  it("detects broken prev_hash links, epoch gaps and time reversal", () => {
    const t = clone(r1);
    t.prev_hash = GENESIS_HASH;
    expect(failing(chainChecks(t, r0, bundle.machine_id))).toEqual(["hash_recompute", "prev_hash_link"]);
    const g = clone(r1);
    g.epoch = 5;
    expect(failing(chainChecks(g, r0, bundle.machine_id))).toContain("epoch_increment");
    const ts = clone(r1);
    ts.timestamp = "2020-01-01T00:00:00.000Z";
    expect(failing(chainChecks(ts, r0, bundle.machine_id))).toContain("timestamp_monotonic");
    const bad = clone(r1);
    bad.timestamp = "not-a-date";
    expect(failing(chainChecks(bad, r0, bundle.machine_id))).toContain("timestamp_monotonic");
    const nonString = clone(r1);
    (nonString as unknown as { prev_hash: number }).prev_hash = 42;
    expect(failing(chainChecks(nonString, r0, bundle.machine_id))).toContain("prev_hash_link");
  });
  it("detects a foreign machine_id", () => {
    expect(failing(chainChecks(r1, r0, "did:key:zOther"))).toEqual(["machine_id_consistent"]);
  });
  it("short() abbreviates long hashes only", () => {
    expect(short("abc")).toBe("abc");
    expect(short("a".repeat(64))).toBe("aaaaaaaa…aaaaaa");
  });
});
