import type { Contribution, FeatureVector, ModelContract, ScoreResult } from "./types";

/**
 * Scoring procedure, verbatim from the contract (handoff Part 4):
 *   z = (x − mean)/std per feature; logit = intercept + Σ coef·z; p = 1/(1+e^−logit);
 *   odds_good = (1−p)/p; MRS = clip(base_score + (PDO/ln 2)·ln(odds_good/base_odds), 300, 850).
 * Tested against Python-generated golden vectors (engine/fixtures/golden_mrs_v0.json).
 */
export function scoreVector(model: ModelContract, x: FeatureVector): ScoreResult {
  const contributions: Contribution[] = [];
  let logit = model.intercept;
  for (const f of model.features) {
    const xv = x[f];
    if (xv === undefined || !Number.isFinite(xv)) throw new Error(`scoreVector: missing or non-finite feature '${f}'`);
    const sd = model.std[f] ?? 1;
    const z = (xv - (model.mean[f] ?? 0)) / (sd === 0 ? 1 : sd);
    const c = (model.coef[f] ?? 0) * z;
    logit += c;
    contributions.push({ feature: f, x: xv, z, contribution: c });
  }
  const p = 1 / (1 + Math.exp(-logit));
  return { logit, p, mrs: probabilityToScore(model, p), contributions };
}

export function probabilityToScore(model: ModelContract, p: number): number {
  const { PDO, base_score, base_odds, clip } = model.score_scaling;
  const pc = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  const oddsGood = (1 - pc) / pc;
  const raw = base_score + (PDO / Math.LN2) * Math.log(oddsGood / base_odds);
  const lo = clip[0] ?? 300;
  const hi = clip[1] ?? 850;
  return Math.min(Math.max(raw, lo), hi);
}

/** Top-N signed contributors (coef·z terms), largest absolute first. Positive = pushes toward failure. */
export function topContributors(result: ScoreResult, n = 5): Contribution[] {
  return [...result.contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, n);
}

/**
 * "Why this changed": difference of coef·z terms between two feature vectors.
 * Sum of deltas equals the logit change exactly (linear model), so the panel is auditable.
 */
export function attributionDelta(before: ScoreResult, after: ScoreResult, n = 5): { feature: string; delta: number; before: number; after: number }[] {
  const b = new Map(before.contributions.map((c) => [c.feature, c.contribution]));
  return after.contributions
    .map((c) => ({ feature: c.feature, delta: c.contribution - (b.get(c.feature) ?? 0), before: b.get(c.feature) ?? 0, after: c.contribution }))
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, n);
}

export interface Grade {
  tier: "A" | "B" | "C" | "D" | "E";
  label: string;
  color: string;
}

/** Grade chip. Bands are illustrative underwriting tiers, not a calibrated rating scale. */
export function gradeFor(mrs: number): Grade {
  if (mrs >= 780) return { tier: "A", label: "Prime", color: "#34D399" };
  if (mrs >= 700) return { tier: "B", label: "Standard", color: "#38BDF8" };
  if (mrs >= 620) return { tier: "C", label: "Watch", color: "#F0A05A" };
  if (mrs >= 550) return { tier: "D", label: "Sub-standard", color: "#F87171" };
  return { tier: "E", label: "Decline", color: "#F87171" };
}

/** Human-readable name for a contract feature (C-MAPSS sensor naming). */
export function describeFeature(f: string): string {
  const m = /^(lvl|trd|vol)_(s\d+)$/.exec(f);
  if (!m) return f === "hours" ? "operating cycles (age)" : f;
  const kind = { lvl: "level", trd: "15-cycle trend", vol: "10-cycle volatility" }[m[1] as "lvl" | "trd" | "vol"];
  const sensor = SENSOR_NAMES[m[2] as string] ?? m[2];
  return `${sensor} · ${kind}`;
}

const SENSOR_NAMES: Record<string, string> = {
  s2: "LPC outlet temp",
  s3: "HPC outlet temp",
  s4: "LPT outlet temp",
  s7: "HPC outlet pressure",
  s8: "fan speed",
  s9: "core speed",
  s11: "HPC static pressure",
  s12: "fuel/Ps30 ratio",
  s13: "corrected fan speed",
  s14: "corrected core speed",
  s15: "bypass ratio",
  s17: "bleed enthalpy",
  s20: "HPT coolant bleed",
  s21: "LPT coolant bleed",
};
