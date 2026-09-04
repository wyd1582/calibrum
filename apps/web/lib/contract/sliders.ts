import type { FeatureVector, Trajectory } from "./types";

/**
 * Underwriting Playground sliders → the contract's feature vector.
 * The mapping is deterministic and documented in docs/slider-mapping.md; the
 * resulting vector is scored ONLY by the contract (scoreVector). No ad-hoc math.
 */
export interface Sliders {
  /** maintenance compliance, 50–100 % */
  maintenance: number;
  /** anomaly / vibration risk, 0–100 */
  anomaly: number;
  /** environment severity, 0–100 */
  environment: number;
  /** human intervention rate, 0–40 % */
  intervention: number;
  /** utilisation, 10–100 % */
  utilization: number;
  /** firmware / model maturity, 40–100 */
  firmware: number;
  /** age / hours, 0–100 (100 ≙ 16 000 h) */
  age: number;
  /** incident count, 0–10 */
  incidents: number;
}

export const SLIDER_RANGES: Record<keyof Sliders, { min: number; max: number; unit: string; label: string }> = {
  maintenance: { min: 50, max: 100, unit: "%", label: "Maintenance compliance" },
  anomaly: { min: 0, max: 100, unit: "%", label: "Anomaly / vibration risk" },
  environment: { min: 0, max: 100, unit: "%", label: "Environment severity" },
  intervention: { min: 0, max: 40, unit: "%", label: "Human intervention rate" },
  utilization: { min: 10, max: 100, unit: "%", label: "Utilisation" },
  firmware: { min: 40, max: 100, unit: "%", label: "Firmware / model maturity" },
  age: { min: 0, max: 100, unit: "", label: "Age / hours" },
  incidents: { min: 0, max: 10, unit: "", label: "Incident count" },
};

export const DEFAULT_SLIDERS: Sliders = { maintenance: 94, anomaly: 14, environment: 35, intervention: 5, utilization: 74, firmware: 88, age: 15, incidents: 0 };

export const HOURS_PER_AGE_POINT = 160; // age 100 ≙ 16 000 verified hours

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function norm(v: number, key: keyof Sliders): number {
  const r = SLIDER_RANGES[key];
  return clamp((v - r.min) / (r.max - r.min), 0, 1);
}

/** Behavioural stress index 0..1 — weights documented in docs/slider-mapping.md §2. */
export function stressIndex(s: Sliders): number {
  const maint = norm(s.maintenance, "maintenance");
  const env = norm(s.environment, "environment");
  const interv = norm(s.intervention, "intervention");
  const util = norm(s.utilization, "utilization");
  const fw = norm(s.firmware, "firmware");
  const inc = Math.min(1, s.incidents / 5);
  return clamp(0.35 * (1 - maint) + 0.15 * env + 0.2 * interv + 0.1 * Math.max(0, (util - 0.8) / 0.2) + 0.1 * (1 - fw) + 0.1 * inc, 0, 1);
}

/** Raw position 0..1 from age + stress (§3). */
export function tauRaw(s: Sliders): number {
  const age = norm(s.age, "age");
  const stress = stressIndex(s);
  return clamp(0.08 + 0.4 * age + stress * (0.5 + 0.35 * age), 0, 1);
}

/** The part of the trajectory the sliders sweep: where the contract's score actually moves. */
export interface TrajectoryWindow {
  lo: number;
  hi: number;
}
export const FULL_WINDOW: TrajectoryWindow = { lo: 0, hi: 1 };

/**
 * Position on the degradation trajectory, 0 = far from failure, 1 = failing (§3).
 * tau = lo + (hi − lo) · tauRaw, where [lo, hi] is the model's scoring window
 * (see `trajectoryWindow`). With the full window this is just tauRaw.
 */
export function tauFor(s: Sliders, window: TrajectoryWindow = FULL_WINDOW): number {
  return window.lo + (window.hi - window.lo) * tauRaw(s);
}

/**
 * Data-derived scoring window per model (docs/slider-mapping.md §3):
 *   lo = first tau (1/200 grid) where score(trajectory(tau)) < plateau, minus 0.03 margin
 *   hi = first tau where score(trajectory(tau)) < floor (or 1)
 * A benchmark whose score sits on an 850 plateau for most of the life (C-MAPSS FD001)
 * gets a narrow late window; a graded cohort gets nearly the whole path.
 */
export function trajectoryWindow(traj: Trajectory, score: (x: FeatureVector) => number, plateau = 845, floor = 320): TrajectoryWindow {
  let lo = 0;
  let hi = 1;
  let seenLo = false;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const m = score(trajectoryAt(traj, t));
    if (!seenLo && m < plateau) {
      lo = clamp(t - 0.03, 0, 0.9);
      seenLo = true;
    }
    if (m < floor) {
      hi = Math.max(t, lo + 0.05);
      break;
    }
  }
  return { lo, hi };
}

/** Linear interpolation along the trajectory grid. */
export function trajectoryAt(traj: Trajectory, tau: number): FeatureVector {
  const pts = traj.points;
  const n = pts.length;
  const pos = clamp(tau, 0, 1) * (n - 1);
  const i = Math.min(Math.floor(pos), n - 1);
  const j = Math.min(i + 1, n - 1);
  const w = pos - i;
  const a = pts[i] as Record<string, number>;
  const b = pts[j] as Record<string, number>;
  const out: FeatureVector = {};
  for (const f of Object.keys(a)) out[f] = (a[f] as number) * (1 - w) + (b[f] as number) * w;
  return out;
}

/** Per-feature degradation direction: trajectory end minus start (§4). */
export function degradationDirection(traj: Trajectory): FeatureVector {
  const first = traj.points[0] as Record<string, number>;
  const last = traj.points[traj.points.length - 1] as Record<string, number>;
  const d: FeatureVector = {};
  for (const f of Object.keys(first)) d[f] = (last[f] as number) - (first[f] as number);
  return d;
}

/**
 * The mapping. Steps (docs/slider-mapping.md):
 *  1. tau from age + stress                       → base vector = trajectory(tau)
 *  2. anomaly scales trend/volatility features along the degradation direction
 *  3. incidents add a step along the degradation direction on all sensor features
 *  4. hours feature comes from the age slider directly (160 h per point → cycles via the trajectory's own hours scale)
 */
export function slidersToFeatures(s: Sliders, traj: Trajectory, window: TrajectoryWindow = FULL_WINDOW): FeatureVector {
  const tau = tauFor(s, window);
  const x = trajectoryAt(traj, tau);
  const d = degradationDirection(traj);
  const anom = norm(s.anomaly, "anomaly");
  for (const f of Object.keys(x)) {
    if (f === "hours") continue;
    if (f.startsWith("trd_") || f.startsWith("vol_")) x[f] = (x[f] as number) + 0.35 * (anom - 0.2) * (d[f] as number);
    x[f] = (x[f] as number) + 0.08 * s.incidents * (d[f] as number);
  }
  // hours: age slider positions the machine on the trajectory's own operating-cycle scale
  const h0 = (traj.points[0] as Record<string, number>).hours as number;
  const h1 = (traj.points[traj.points.length - 1] as Record<string, number>).hours as number;
  x.hours = h0 + norm(s.age, "age") * (h1 - h0);
  return x;
}
