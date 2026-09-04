import { describe, expect, it } from "vitest";
import { physicsChecks, ENVELOPES, EPOCH_SECONDS } from "../src/physics.js";
import type { ReceiptContext } from "../src/types.js";

const base: ReceiptContext = { task_class: "amr_transport", operating_seconds: 36_000, energy_wh: 4_000, interventions: 1, fault_codes: [], fw_version: "1", env_severity: 0.3 };
const fails = (ctx: ReceiptContext) => physicsChecks(ctx).filter((c) => !c.ok).map((c) => c.name);

describe("physicsChecks", () => {
  it("passes a plausible AMR day", () => {
    expect(fails(base)).toEqual([]);
  });
  it("rejects unknown task class and stops", () => {
    const r = physicsChecks({ ...base, task_class: "teleport" as never });
    expect(r).toHaveLength(1);
    expect(r[0]?.ok).toBe(false);
  });
  it("catches operating_seconds out of range", () => {
    expect(fails({ ...base, operating_seconds: EPOCH_SECONDS + 1 })).toContain("operating_seconds_range");
    expect(fails({ ...base, operating_seconds: -5 })).toContain("operating_seconds_range");
    expect(fails({ ...base, operating_seconds: NaN })).toContain("operating_seconds_range");
  });
  it("catches negative or non-numeric energy", () => {
    expect(fails({ ...base, energy_wh: -1 })).toContain("energy_nonnegative");
    expect(fails({ ...base, energy_wh: "lots" as never })).toContain("energy_nonnegative");
  });
  it("cross-checks energy against hours (too little and too much)", () => {
    expect(fails({ ...base, energy_wh: 40_000 })).toEqual(["energy_vs_hours"]);
    expect(fails({ ...base, energy_wh: 100 })).toEqual(["energy_vs_hours"]);
    expect(physicsChecks({ ...base, energy_wh: 40_000 }).find((c) => c.name === "energy_vs_hours")?.detail).toMatch(/inconsistent with claimed hours/);
  });
  it("bounds standby energy when nothing operated", () => {
    expect(fails({ ...base, operating_seconds: 0, energy_wh: 100, interventions: 0 })).toEqual([]);
    expect(fails({ ...base, operating_seconds: 0, energy_wh: ENVELOPES.amr_transport.idle_wh_max + 1, interventions: 0 })).toEqual(["idle_energy"]);
  });
  it("bounds interventions by operating time", () => {
    expect(fails({ ...base, operating_seconds: 60, energy_wh: 10, interventions: 2 })).toEqual(["interventions_plausible"]);
    expect(fails({ ...base, interventions: -1 })).toContain("interventions_plausible");
    expect(fails({ ...base, interventions: 1.5 })).toContain("interventions_plausible");
    expect(fails({ ...base, operating_seconds: NaN, interventions: 1 })).toEqual(["operating_seconds_range"]);
  });
  it("bounds env_severity and validates fault codes", () => {
    expect(fails({ ...base, env_severity: 1.2 })).toContain("env_severity_range");
    expect(fails({ ...base, fault_codes: "F1" as never })).toContain("fault_codes_list");
    expect(fails({ ...base, fault_codes: [1 as never] })).toContain("fault_codes_list");
  });
  it("covers every envelope", () => {
    for (const tc of Object.keys(ENVELOPES) as (keyof typeof ENVELOPES)[]) {
      const env = ENVELOPES[tc];
      const secs = tc === "idle" ? 0 : 3600;
      const wh = tc === "idle" ? 10 : (env.min_w + env.max_w) / 2;
      expect(fails({ ...base, task_class: tc, operating_seconds: secs, energy_wh: wh, interventions: 0 })).toEqual([]);
    }
  });
});
