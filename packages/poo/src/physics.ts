import type { CheckResult, ReceiptContext, TaskClass } from "./types.js";

/**
 * Physics envelopes: what a plausible epoch looks like for each task class.
 * These are deliberately coarse — the point is to make internally inconsistent
 * receipts (energy without work, work without energy, impossible duty cycles)
 * fail cheaply. Tighter fleet-derived envelopes replace these in production.
 */
export interface Envelope {
  /** Minimum sustained average power while operating, watts. */
  min_w: number;
  /** Maximum sustained average power while operating, watts. */
  max_w: number;
  /** Standby draw allowance when operating_seconds = 0, watt-hours per epoch. */
  idle_wh_max: number;
}

export const EPOCH_SECONDS = 86_400;

export const ENVELOPES: Record<TaskClass, Envelope> = {
  amr_transport: { min_w: 150, max_w: 900, idle_wh_max: 400 },
  humanoid_manipulation: { min_w: 200, max_w: 1500, idle_wh_max: 600 },
  drone_flight: { min_w: 100, max_w: 800, idle_wh_max: 100 },
  gpu_training: { min_w: 2000, max_w: 12000, idle_wh_max: 6000 },
  idle: { min_w: 0, max_w: 60, idle_wh_max: 800 },
  maintenance: { min_w: 0, max_w: 300, idle_wh_max: 800 },
};

export function physicsChecks(ctx: ReceiptContext): CheckResult[] {
  const out: CheckResult[] = [];
  const env = ENVELOPES[ctx.task_class];
  out.push({
    kind: "physics",
    name: "task_class_known",
    ok: env !== undefined,
    detail: env ? `envelope for ${ctx.task_class}: ${env.min_w}–${env.max_w} W` : `unknown task_class '${String(ctx.task_class)}'`,
  });
  if (!env) return out;

  const secs = ctx.operating_seconds;
  const secsOk = Number.isFinite(secs) && secs >= 0 && secs <= EPOCH_SECONDS;
  out.push({
    kind: "physics",
    name: "operating_seconds_range",
    ok: secsOk,
    detail: secsOk ? `${secs}s of ${EPOCH_SECONDS}s epoch` : `operating_seconds ${secs} outside [0, ${EPOCH_SECONDS}]`,
  });

  const wh = ctx.energy_wh;
  const whOk = Number.isFinite(wh) && wh >= 0;
  out.push({
    kind: "physics",
    name: "energy_nonnegative",
    ok: whOk,
    detail: whOk ? `${wh.toFixed(0)} Wh` : `energy_wh ${wh} is negative or non-numeric`,
  });

  if (secsOk && whOk) {
    if (secs > 0) {
      const avgW = wh / (secs / 3600);
      const ok = avgW >= env.min_w && avgW <= env.max_w;
      out.push({
        kind: "physics",
        name: "energy_vs_hours",
        ok,
        detail: ok
          ? `average draw ${avgW.toFixed(0)} W within ${env.min_w}–${env.max_w} W`
          : `average draw ${avgW.toFixed(0)} W outside ${env.min_w}–${env.max_w} W for ${ctx.task_class} — energy inconsistent with claimed hours`,
      });
    } else {
      const ok = wh <= env.idle_wh_max;
      out.push({
        kind: "physics",
        name: "idle_energy",
        ok,
        detail: ok ? `${wh.toFixed(0)} Wh standby ≤ ${env.idle_wh_max} Wh` : `${wh.toFixed(0)} Wh drawn with zero operating seconds (> ${env.idle_wh_max} Wh standby allowance)`,
      });
    }
  }

  const iv = ctx.interventions;
  const maxIv = secsOk ? Math.max(1, Math.floor(secs / 60)) : 1;
  const ivOk = Number.isInteger(iv) && iv >= 0 && iv <= maxIv;
  out.push({
    kind: "physics",
    name: "interventions_plausible",
    ok: ivOk,
    detail: ivOk ? `${iv} interventions` : `${iv} interventions implausible for ${secs}s of operation (max ${maxIv})`,
  });

  const sev = ctx.env_severity;
  const sevOk = Number.isFinite(sev) && sev >= 0 && sev <= 1;
  out.push({
    kind: "physics",
    name: "env_severity_range",
    ok: sevOk,
    detail: sevOk ? `severity ${sev.toFixed(2)}` : `env_severity ${sev} outside [0, 1]`,
  });

  const fcOk = Array.isArray(ctx.fault_codes) && ctx.fault_codes.every((c) => typeof c === "string");
  out.push({
    kind: "physics",
    name: "fault_codes_list",
    ok: fcOk,
    detail: fcOk ? `${ctx.fault_codes.length} fault code(s)` : "fault_codes must be a list of strings",
  });

  return out;
}
