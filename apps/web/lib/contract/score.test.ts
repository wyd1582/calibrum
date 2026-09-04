import { describe, expect, it } from "vitest";
import golden from "../../../../engine/fixtures/golden_mrs_v0.json";
import v0 from "../../../../engine/mrs_v0/out/mrs_model.json";
import { MODELS } from "./registry";
import { attributionDelta, gradeFor, probabilityToScore, scoreVector, topContributors } from "./score";
import { DEFAULT_SLIDERS, degradationDirection, slidersToFeatures, stressIndex, tauFor, trajectoryAt, type Sliders } from "./sliders";
import type { ModelContract } from "./types";

const model = v0 as ModelContract;

describe("contract scoring vs Python golden vectors", () => {
  it("features match the contract", () => {
    expect(golden.features).toEqual(model.features);
    expect(model.features).toHaveLength(43);
  });
  for (const c of golden.cases) {
    it(`golden ${c.name}`, () => {
      const r = scoreVector(model, c.x);
      expect(r.logit).toBeCloseTo(c.logit, 6);
      expect(r.p).toBeCloseTo(c.p, 8);
      expect(r.mrs).toBeCloseTo(c.mrs, 4);
      for (const k of r.contributions) expect(k.contribution).toBeCloseTo(c.contributions[k.feature as keyof typeof c.contributions], 6);
    });
  }
  it("throws on a missing feature instead of silently scoring", () => {
    expect(() => scoreVector(model, {})).toThrow(/missing/);
  });
  it("score scaling is monotone and clipped", () => {
    expect(probabilityToScore(model, 0.5)).toBeLessThan(probabilityToScore(model, 0.01));
    expect(probabilityToScore(model, 0.999999)).toBe(300);
    expect(probabilityToScore(model, 1e-9)).toBe(850);
  });
  it("attribution deltas sum to the logit change", () => {
    const a = scoreVector(model, golden.cases[0]!.x);
    const b = scoreVector(model, golden.cases[1]!.x);
    const full = attributionDelta(a, b, 43);
    const sum = full.reduce((s, d) => s + d.delta, 0);
    expect(sum).toBeCloseTo(b.logit - a.logit, 6);
    expect(topContributors(b, 5)).toHaveLength(5);
  });
  it("grades are monotone in MRS", () => {
    expect(gradeFor(820).tier).toBe("A");
    expect(gradeFor(720).tier).toBe("B");
    expect(gradeFor(650).tier).toBe("C");
    expect(gradeFor(580).tier).toBe("D");
    expect(gradeFor(400).tier).toBe("E");
  });
});

describe("slider mapping", () => {
  const reg = MODELS[0]!;
  it("default machine scores as a healthy but not perfect passport", () => {
    const r = scoreVector(reg.model, slidersToFeatures(DEFAULT_SLIDERS, reg.trajectory, reg.window));
    expect(r.mrs).toBeGreaterThan(740);
    expect(r.mrs).toBeLessThan(835);
  });
  it("is deterministic and produces every contract feature", () => {
    const x1 = slidersToFeatures(DEFAULT_SLIDERS, reg.trajectory, reg.window);
    const x2 = slidersToFeatures({ ...DEFAULT_SLIDERS }, reg.trajectory, reg.window);
    expect(x1).toEqual(x2);
    for (const f of reg.model.features) expect(Number.isFinite(x1[f])).toBe(true);
  });
  it("worse behaviour never improves the score (monotone in each slider)", () => {
    const score = (s: Sliders) => scoreVector(reg.model, slidersToFeatures(s, reg.trajectory, reg.window)).mrs;
    const base = score(DEFAULT_SLIDERS);
    expect(score({ ...DEFAULT_SLIDERS, maintenance: 55 })).toBeLessThanOrEqual(base);
    expect(score({ ...DEFAULT_SLIDERS, anomaly: 90 })).toBeLessThanOrEqual(base);
    expect(score({ ...DEFAULT_SLIDERS, environment: 95 })).toBeLessThanOrEqual(base);
    expect(score({ ...DEFAULT_SLIDERS, intervention: 35 })).toBeLessThanOrEqual(base);
    expect(score({ ...DEFAULT_SLIDERS, firmware: 45 })).toBeLessThanOrEqual(base);
    expect(score({ ...DEFAULT_SLIDERS, age: 95 })).toBeLessThan(base);
    expect(score({ ...DEFAULT_SLIDERS, incidents: 8 })).toBeLessThan(base);
    const worst: Sliders = { maintenance: 50, anomaly: 100, environment: 100, intervention: 40, utilization: 100, firmware: 40, age: 100, incidents: 10 };
    const best: Sliders = { maintenance: 100, anomaly: 0, environment: 0, intervention: 0, utilization: 60, firmware: 100, age: 0, incidents: 0 };
    expect(score(worst)).toBeLessThan(450);
    expect(score(best)).toBeGreaterThan(800);
  });
  it("tau and stress stay in [0,1] and trajectory interpolation hits the endpoints", () => {
    const worst: Sliders = { maintenance: 50, anomaly: 100, environment: 100, intervention: 40, utilization: 100, firmware: 40, age: 100, incidents: 10 };
    expect(stressIndex(worst)).toBeLessThanOrEqual(1);
    expect(tauFor(worst)).toBe(1);
    expect(tauFor({ ...DEFAULT_SLIDERS, age: 0, maintenance: 100, anomaly: 0, environment: 0, intervention: 0, firmware: 100, incidents: 0, utilization: 50 })).toBeCloseTo(0.08, 6);
    expect(tauFor(DEFAULT_SLIDERS, { lo: 0.5, hi: 1 })).toBeGreaterThan(0.5);
    expect(reg.window.lo).toBeGreaterThan(0.6); // v0 sits on an 850 plateau until late in the trajectory
    expect(reg.window.hi).toBeLessThanOrEqual(1);
    expect(MODELS[2]!.window.lo).toBeLessThan(0.1);
    expect(trajectoryAt(reg.trajectory, 0)).toEqual(reg.trajectory.points[0]);
    expect(trajectoryAt(reg.trajectory, 1)).toEqual(reg.trajectory.points[reg.trajectory.points.length - 1]);
    const d = degradationDirection(reg.trajectory);
    expect(d.hours).toBeGreaterThan(0);
  });
  it("every registered model scores the default machine inside the clip range", () => {
    for (const m of MODELS) {
      const r = scoreVector(m.model, slidersToFeatures(DEFAULT_SLIDERS, m.trajectory, m.window));
      expect(r.mrs).toBeGreaterThan(650);
      expect(r.mrs).toBeGreaterThanOrEqual(300);
      expect(r.mrs).toBeLessThanOrEqual(850);
      expect(m.label).toMatch(/C-MAPSS/);
    }
  });
});
