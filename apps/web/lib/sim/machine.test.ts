import { describe, expect, it } from "vitest";
import { verifyBundle } from "@calibrum/poo";
import { assess, bundleOf, initialState, projection, reduce, type Action, type MachineState } from "./machine";

function play(actions: Action[], s = initialState()): MachineState {
  return actions.reduce((st, a) => reduce(st, a), s);
}

describe("demo machine", () => {
  it("starts with a minted, verifiable passport", () => {
    const s = initialState();
    expect(s.ledger).toHaveLength(1);
    expect(verifyBundle(bundleOf(s)).ok).toBe(true);
    const a = assess(s);
    expect(a.mrs).toBeGreaterThan(700);
    expect(a.grade.tier).toMatch(/A|B/);
  });
  it("is deterministic", () => {
    const acts: Action[] = [{ type: "run", hours: 100 }, { type: "incident" }, { type: "maintain" }, { type: "run", hours: 500 }];
    expect(play(acts)).toEqual(play(acts));
  });
  it("running earns revenue and emits one receipt per machine-day; the chain verifies", () => {
    const s = play([{ type: "run", hours: 100 }]);
    expect(s.wallet).toBeGreaterThan(10_000);
    expect(s.ledger).toHaveLength(1 + 5);
    expect(s.hours).toBe(2_500);
    const rep = verifyBundle(bundleOf(s));
    expect(rep.ok).toBe(true);
    const s2 = play([{ type: "run", hours: 500 }], s);
    expect(s2.ledger).toHaveLength(6 + 25);
    expect(verifyBundle(bundleOf(s2)).ok).toBe(true);
  });
  it("incident drops the score and reprices; maintenance recovers some of it", () => {
    const s0 = initialState();
    const s1 = reduce(s0, { type: "incident" });
    expect(assess(s1).mrs).toBeLessThan(assess(s0).mrs);
    expect(assess(s1).offers.premiumAnnual).toBeGreaterThan(assess(s0).offers.premiumAnnual);
    expect(s1.pendingClaim).toBe(true);
    const s2 = reduce(s1, { type: "maintain" });
    expect(assess(s2).mrs).toBeGreaterThan(assess(s1).mrs);
    expect(s2.wallet).toBe(s1.wallet - 550);
    expect(s2.ledger.at(-1)?.attester.kind).toBe("servicer");
  });
  it("insurance, claim, borrow and repay follow the documented rules", () => {
    let s = initialState();
    expect(reduce(s, { type: "claim" }).log[0]?.text).toMatch(/No active insurance/);
    s = reduce(s, { type: "buy_insurance" });
    expect(s.policy).not.toBeNull();
    expect(s.wallet).toBe(10_000 - s.policy!.premium);
    expect(reduce(s, { type: "buy_insurance" }).log[0]?.text).toMatch(/already active/);
    expect(reduce(s, { type: "claim" }).log[0]?.text).toMatch(/No new verified incident/);
    s = reduce(s, { type: "incident" });
    const before = s.wallet;
    s = reduce(s, { type: "claim" });
    expect(s.wallet - before).toBe(Math.round(85_000 * 0.35 * 0.9));
    expect(s.pendingClaim).toBe(false);
    const a = assess(s);
    s = reduce(s, { type: "borrow" });
    expect(s.debt).toBe(Math.round(a.offers.maxLoan * 0.4));
    const w = s.wallet;
    s = reduce(s, { type: "repay" });
    expect(s.debt).toBe(0);
    expect(s.wallet).toBe(w - Math.round(a.offers.maxLoan * 0.4));
    expect(reduce(s, { type: "repay" }).log[0]?.text).toMatch(/No debt/);
    expect(verifyBundle(bundleOf(s)).ok).toBe(true);
  });
  it("tamper breaks verification at a specific link; restore repairs it", () => {
    let s = play([{ type: "run", hours: 100 }, { type: "incident" }]);
    s = reduce(s, { type: "tamper", field: "event", index: 6 });
    const rep = verifyBundle(bundleOf(s));
    expect(rep.ok).toBe(false);
    expect(rep.links[6]?.ok).toBe(false);
    expect(rep.links[5]?.ok).toBe(true);
    expect(s.tamper?.before).toBe("incident");
    s = reduce(s, { type: "restore" });
    expect(verifyBundle(bundleOf(s)).ok).toBe(true);
    // a new action after tampering always starts from the signed original
    s = reduce(reduce(s, { type: "tamper", field: "context.energy_wh" }), { type: "run", hours: 20 });
    expect(s.tamper).toBeNull();
    expect(verifyBundle(bundleOf(s)).ok).toBe(true);
  });
  it("sliders reprice through the contract and age moves hours", () => {
    const s = initialState();
    const worse = reduce(s, { type: "set_slider", key: "maintenance", value: 55 });
    expect(assess(worse).mrs).toBeLessThan(assess(s).mrs);
    const older = reduce(s, { type: "set_slider", key: "age", value: 60 });
    expect(older.hours).toBe(60 * 160);
    const proj = projection(s, 12);
    expect(proj).toHaveLength(13);
    expect(proj[12]!.mrs).toBeLessThanOrEqual(proj[0]!.mrs);
    const switched = reduce(s, { type: "set_model", modelId: "cmapss_fd004" });
    expect(assess(switched).mrs).toBeGreaterThan(300);
    expect(reduce(s, { type: "reset" }).step).toBe(0);
  });
});
