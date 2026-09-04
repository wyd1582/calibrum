import { describe, expect, it } from "vitest";
import { tamperBundle } from "../src/tamper.js";
import { POO_VERSION, type ReceiptBundle } from "../src/types.js";
import { fixture } from "./helpers.js";

const { bundle } = fixture(5, 5);

describe("tamperBundle", () => {
  it("defaults to the middle receipt and does not mutate the input", () => {
    const before = JSON.stringify(bundle);
    const t = tamperBundle(bundle, { field: "context.energy_wh" });
    expect(t.index).toBe(2);
    expect(t.after).toBe((t.before as number) * 10);
    expect(JSON.stringify(bundle)).toBe(before);
    expect(t.description).toMatch(/hash and signature left untouched/);
  });
  it("applies type-appropriate corruption", () => {
    expect(tamperBundle(bundle, { index: 0, field: "context.fw_version" }).after).toMatch(/-tampered$/);
    expect(tamperBundle(bundle, { index: 0, field: "context.fault_codes" }).after).toContain("TAMPERED");
    expect(tamperBundle(bundle, { index: 0, field: "context.interventions", value: 0 }).after).toBe(0);
    const zero = tamperBundle(bundle, { index: 0, field: "context.interventions", value: 0 }).bundle;
    expect(tamperBundle(zero, { index: 0, field: "context.interventions" }).after).toBe(1);
    expect(tamperBundle(bundle, { index: 0, field: "risk_snapshot" }).after).toMatchObject({ tampered: true });
    const withBool = tamperBundle(bundle, { index: 0, field: "context.fw_version", value: true }).bundle;
    expect(tamperBundle(withBool, { index: 0, field: "context.fw_version" }).after).toBe(false);
    const withNull = tamperBundle(bundle, { index: 0, field: "context.fw_version", value: null }).bundle;
    expect(tamperBundle(withNull, { index: 0, field: "context.fw_version" }).after).toBe("TAMPERED");
  });
  it("rejects bad indexes, paths and empty bundles", () => {
    expect(() => tamperBundle(bundle, { index: 9, field: "epoch" })).toThrow(/out of range/);
    expect(() => tamperBundle(bundle, { field: "" })).toThrow(/empty/);
    expect(() => tamperBundle(bundle, { field: "context.nope" })).toThrow(/does not exist/);
    expect(() => tamperBundle(bundle, { field: "epoch.x" })).toThrow(/not an object/);
    const empty: ReceiptBundle = { version: POO_VERSION, machine_id: "m", receipts: [], provenance: "t" };
    expect(() => tamperBundle(empty, { field: "epoch" })).toThrow(/no receipts/);
  });
});
