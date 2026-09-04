import { describe, expect, it } from "vitest";
import { annualFailureProbability, claimPayout, creditSpreadBps, expectedLoss12m, maxLtv, offersFor, premiumRate, residualPct } from "./pricing";

describe("pricing functions (handoff Part 4, illustrative)", () => {
  it("match the documented formulas at reference points", () => {
    expect(premiumRate(782)).toBeCloseTo(0.09 - 0.782 * 0.075, 10);
    expect(maxLtv(782)).toBeCloseTo(0.25 + 0.782 * 0.55, 10);
    expect(creditSpreadBps(782)).toBe(418);
    expect(residualPct(782)).toBeCloseTo(0.3 + 0.782 * 0.4, 10);
    expect(premiumRate(431)).toBeGreaterThan(premiumRate(782));
  });
  it("are monotone in MRS", () => {
    for (let m = 300; m < 850; m += 10) {
      expect(premiumRate(m + 10)).toBeLessThan(premiumRate(m));
      expect(maxLtv(m + 10)).toBeGreaterThan(maxLtv(m));
      expect(creditSpreadBps(m + 10)).toBeLessThan(creditSpreadBps(m));
      expect(residualPct(m + 10)).toBeGreaterThan(residualPct(m));
    }
  });
  it("offers reprice and pool tiers switch at 600 / 700", () => {
    const good = offersFor(782, 85_000);
    expect(good.premiumAnnual).toBeCloseTo(85_000 * premiumRate(782), 6);
    expect(good.maxLoan).toBeCloseTo(85_000 * residualPct(782) * maxLtv(782), 6);
    expect(good.pool.tier).toBe("senior");
    expect(offersFor(650, 85_000).pool.tier).toBe("mezzanine");
    expect(offersFor(650, 85_000).pool.capacity).toBeCloseTo(offersFor(650, 85_000).maxLoan * 0.5, 6);
    expect(offersFor(431, 85_000).pool.eligible).toBe(false);
    expect(offersFor(850, 85_000, 1000).pool.capacity).toBe(1000);
  });
  it("expected loss compounds the 30-cycle probability", () => {
    expect(annualFailureProbability(0)).toBe(0);
    expect(annualFailureProbability(0.1)).toBeCloseTo(1 - 0.9 ** 12, 10);
    expect(expectedLoss12m(0.1, 100_000)).toBeCloseTo((1 - 0.9 ** 12) * 0.35 * 100_000, 6);
    expect(claimPayout(85_000)).toBeCloseTo(85_000 * 0.35 * 0.9, 6);
  });
});
