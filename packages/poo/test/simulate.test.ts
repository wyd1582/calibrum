import { describe, expect, it } from "vitest";
import { mulberry32, simulateContext, simulateMachine } from "../src/simulate.js";
import { verifyBundle } from "../src/verify.js";
import { generateKeyPair } from "../src/keys.js";

describe("simulateMachine", () => {
  it("is deterministic per seed and always physics-consistent", () => {
    const a = simulateMachine({ seed: 42, days: 30 });
    const b = simulateMachine({ seed: 42, days: 30 });
    expect(a.bundle.merkle_root).toBe(b.bundle.merkle_root);
    expect(a.bundle.provenance).toMatch(/SIMULATED/);
    for (const tc of ["amr_transport", "humanoid_manipulation", "drone_flight", "gpu_training", "idle"] as const) {
      const { bundle } = simulateMachine({ seed: 1, days: 40, taskClass: tc });
      expect(verifyBundle(bundle).ok).toBe(true);
    }
  });
  it("continues an existing chain", () => {
    const first = simulateMachine({ seed: 2, days: 3 });
    const cont = simulateMachine({ seed: 3, days: 2, keys: first.keys, previous: first.bundle.receipts[2], mrs: 500 });
    const all = { ...first.bundle, receipts: [...first.bundle.receipts, ...cont.bundle.receipts], merkle_root: undefined };
    expect(verifyBundle(all).ok).toBe(true);
    expect(cont.bundle.receipts[0]?.epoch).toBe(3);
    const explicit = simulateMachine({ seed: 3, days: 1, keys: generateKeyPair("k"), startEpoch: 10, fwVersion: "9.9" });
    expect(explicit.bundle.receipts[0]?.epoch).toBe(10);
    expect(explicit.bundle.receipts[0]?.context.fw_version).toBe("9.9");
  });
  it("produces incidents over a long enough horizon", () => {
    const { bundle } = simulateMachine({ seed: 9, days: 400 });
    expect(bundle.receipts.some((r) => r.event === "incident")).toBe(true);
    expect(bundle.receipts.every((r) => r.risk_snapshot.mrs >= 300 && r.risk_snapshot.mrs <= 850)).toBe(true);
  });
  it("mulberry32 is uniform-ish and idle context has zero seconds", () => {
    const rng = mulberry32(1);
    const xs = Array.from({ length: 1000 }, () => rng());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(simulateContext(mulberry32(5), "idle", "1").operating_seconds).toBe(0);
  });
});
