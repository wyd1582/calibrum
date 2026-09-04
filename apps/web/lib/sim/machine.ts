/**
 * The demo machine: one Calibrum Passport with an mUSDC wallet and a Proof
 * Ledger. Pure reducer — every action is deterministic given the state's seed,
 * so the demo replays identically. Scores come ONLY from the model contract
 * (lib/contract), receipts ONLY from @calibrum/poo.
 *
 * ILLUSTRATIVE DEMO MODEL: the wallet economics (revenue per hour, service
 * cost, claim payout) are stated constants, documented here and in the UI.
 */
import {
  createReceipt,
  didKeyFromPublicKey,
  generateKeyPair,
  mulberry32,
  tamperBundle,
  type Receipt,
  type ReceiptBundle,
  type ReceiptEvent,
  type TaskClass,
  type TamperResult,
} from "@calibrum/poo";
import { getModel, DEFAULT_MODEL_ID } from "../contract/registry";
import { gradeFor, scoreVector, type Grade } from "../contract/score";
import { clamp, DEFAULT_SLIDERS, HOURS_PER_AGE_POINT, SLIDER_RANGES, slidersToFeatures, type Sliders } from "../contract/sliders";
import type { FeatureVector, ScoreResult } from "../contract/types";
import { claimPayout, expectedLoss12m, offersFor, type Offers } from "../finance/pricing";

// ---- economics (illustrative constants) ----
export const ECON = {
  assetValue: 85_000,
  startingWallet: 10_000,
  /** mUSDC earned per verified hour = base + utilisation/30 (from the founder's playground). */
  revenueBase: 5.8,
  serviceCost: 550,
  policyCoverHours: 8_760, // "12 months" of cover measured in machine-hours of the calendar
  borrowShareOfMax: 0.4,
  hoursPerReceipt: 20, // one PoO receipt per machine-day of ≤ 20 operating hours
  avgPowerW: 450,
  startHours: 2_400,
  epochMs: 86_400_000,
  startDate: Date.UTC(2026, 0, 1),
} as const;

export const DEMO_KEYS = generateKeyPair("calibrum-demo-passport");
export const DEMO_MACHINE_ID = didKeyFromPublicKey(DEMO_KEYS.publicKey);

export interface HistoryPoint {
  step: number;
  hours: number;
  mrs: number;
  p: number;
  event: ReceiptEvent | "slider";
  label: string;
}

export interface LogEntry {
  step: number;
  kind: ReceiptEvent | "note";
  text: string;
  amount?: number;
}

export interface MachineState {
  modelId: string;
  sliders: Sliders;
  hours: number;
  uptime: number;
  wallet: number;
  debt: number;
  revenue: number;
  claimsPaid: number;
  policy: { premium: number; boundAtHours: number; coverHours: number } | null;
  pendingClaim: boolean;
  step: number;
  seed: number;
  history: HistoryPoint[];
  ledger: Receipt[];
  tamper: TamperResult | null;
  log: LogEntry[];
  /** Sliders/model before the last state change — for the "why this changed" panel. */
  prev: { sliders: Sliders; modelId: string } | null;
}

export type Action =
  | { type: "set_slider"; key: keyof Sliders; value: number }
  | { type: "set_model"; modelId: string }
  | { type: "run"; hours: number }
  | { type: "maintain" }
  | { type: "incident" }
  | { type: "buy_insurance" }
  | { type: "borrow" }
  | { type: "repay" }
  | { type: "claim" }
  | { type: "tamper"; field: string; index?: number }
  | { type: "restore" }
  | { type: "reset" }
  | { type: "hydrate"; state: MachineState };

export interface Assessment {
  features: FeatureVector;
  result: ScoreResult;
  mrs: number;
  grade: Grade;
  offers: Offers;
  expectedLoss12m: number;
}

/** Everything derived from the current state — computed, never stored. */
export function assess(state: MachineState): Assessment {
  const reg = getModel(state.modelId);
  const features = slidersToFeatures(state.sliders, reg.trajectory, reg.window);
  const result = scoreVector(reg.model, features);
  const mrs = Math.round(result.mrs);
  return { features, result, mrs, grade: gradeFor(mrs), offers: offersFor(mrs, ECON.assetValue), expectedLoss12m: expectedLoss12m(result.p, ECON.assetValue) };
}

/** Score for an arbitrary slider set under the current model (used by the playground drawer and projections). */
export function assessSliders(modelId: string, sliders: Sliders): Assessment {
  return assess({ ...initialState(), modelId, sliders });
}

/** Risk projection: months ahead assuming behaviour unchanged (utilisation drives hours). Illustrative. */
export function projection(state: MachineState, months = 12): { month: number; mrs: number; p: number }[] {
  const out: { month: number; mrs: number; p: number }[] = [];
  const hoursPerMonth = (state.sliders.utilization / 100) * 720;
  for (let m = 0; m <= months; m++) {
    const hours = state.hours + m * hoursPerMonth;
    const a = assessSliders(state.modelId, { ...state.sliders, age: ageFromHours(hours) });
    out.push({ month: m, mrs: a.mrs, p: a.result.p });
  }
  return out;
}

export function ageFromHours(hours: number): number {
  return clamp(hours / HOURS_PER_AGE_POINT, SLIDER_RANGES.age.min, SLIDER_RANGES.age.max);
}

export function initialState(seed = 7): MachineState {
  const base: MachineState = {
    modelId: DEFAULT_MODEL_ID,
    sliders: { ...DEFAULT_SLIDERS, age: ageFromHours(ECON.startHours) },
    hours: ECON.startHours,
    uptime: 97.8,
    wallet: ECON.startingWallet,
    debt: 0,
    revenue: 0,
    claimsPaid: 0,
    policy: null,
    pendingClaim: false,
    step: 0,
    seed,
    history: [],
    ledger: [],
    tamper: null,
    log: [],
    prev: null,
  };
  const a = assess(base);
  const genesis = mint(base, "genesis", idleContext("idle", 0, 20, base.sliders, "Passport minted — device identity initialised"), a);
  return {
    ...base,
    history: [{ step: 0, hours: base.hours, mrs: a.mrs, p: a.result.p, event: "genesis", label: "Passport minted" }],
    ledger: [genesis],
    log: [{ step: 0, kind: "genesis", text: "Calibrum Passport minted for the demo machine. Wallet funded with 10,000 mUSDC (demo economy)." }],
  };
}

// ---- receipts ----
function fwVersion(s: Sliders): string {
  return `7.${Math.round(((s.firmware - 40) / 60) * 9)}.1`;
}

function idleContext(task: TaskClass, seconds: number, energy: number, s: Sliders, note: string) {
  return { task_class: task, operating_seconds: seconds, energy_wh: energy, interventions: 0, fault_codes: [] as string[], fw_version: fwVersion(s), env_severity: s.environment / 100, note };
}

function mint(state: MachineState, event: ReceiptEvent, context: ReturnType<typeof idleContext>, a: Assessment): Receipt {
  const prev = state.ledger[state.ledger.length - 1] ?? null;
  const epoch = prev ? prev.epoch + 1 : 0;
  return createReceipt(
    {
      receipt_id: `rcpt_${DEMO_MACHINE_ID.slice(-6)}_${String(epoch).padStart(5, "0")}`,
      machine_id: DEMO_MACHINE_ID,
      epoch,
      timestamp: new Date(ECON.startDate + (epoch + 1) * ECON.epochMs - 1000).toISOString(),
      event,
      context,
      risk_snapshot: { mrs: a.mrs, p_fail_30: Math.round(a.result.p * 1e6) / 1e6, model: `${getModel(state.modelId).model.kind}/${state.modelId}` },
      attester: { id: event === "maintenance" ? "servicer:demo-oem-service" : DEMO_MACHINE_ID, kind: event === "maintenance" ? "servicer" : "device" },
    },
    DEMO_KEYS.privateKey,
    prev,
  );
}

export function bundleOf(state: MachineState): ReceiptBundle {
  const receipts = state.tamper ? state.tamper.bundle.receipts : state.ledger;
  return { version: "poo/0.1", machine_id: DEMO_MACHINE_ID, receipts, provenance: "SIMULATED — Calibrum investor demo. Receipts are signed in-browser with a seeded demo key. Not field data." };
}

// ---- reducer ----
function push(state: MachineState, a: Assessment, event: HistoryPoint["event"], label: string, extra: Partial<MachineState> = {}): MachineState {
  const next = { ...state, ...extra, step: state.step + 1, prev: { sliders: state.sliders, modelId: state.modelId } };
  return { ...next, history: [...next.history, { step: next.step, hours: next.hours, mrs: a.mrs, p: a.result.p, event, label }] };
}

function log(state: MachineState, kind: LogEntry["kind"], text: string, amount?: number): MachineState {
  return { ...state, log: [{ step: state.step, kind, text, amount }, ...state.log].slice(0, 60) };
}

export function reduce(state: MachineState, action: Action): MachineState {
  const rng = mulberry32(state.seed * 1000 + state.step);
  switch (action.type) {
    case "set_slider": {
      const r = SLIDER_RANGES[action.key];
      const value = clamp(Math.round(action.value), r.min, r.max);
      const sliders = { ...state.sliders, [action.key]: value };
      const hours = action.key === "age" ? value * HOURS_PER_AGE_POINT : state.hours;
      const a = assess({ ...state, sliders, hours });
      return push(state, a, "slider", `${r.label} → ${value}${r.unit}`, { sliders, hours });
    }
    case "set_model": {
      const next = { ...state, modelId: action.modelId };
      const a = assess(next);
      return push(next, a, "slider", `Model switched to ${action.modelId}`);
    }
    case "run": {
      const h = action.hours;
      const earned = Math.round(h * (ECON.revenueBase + state.sliders.utilization / 30));
      const sliders: Sliders = {
        ...state.sliders,
        anomaly: clamp(Math.round(state.sliders.anomaly + h / 220 + rng() * 3), 0, 100),
        maintenance: clamp(Math.round(state.sliders.maintenance - h / 800), 50, 100),
      };
      const hours = state.hours + h;
      sliders.age = ageFromHours(hours);
      const uptime = clamp(state.uptime + (rng() - 0.55) * 0.35, 90, 99.9);
      let next: MachineState = { ...state, sliders, hours, uptime, wallet: state.wallet + earned, revenue: state.revenue + earned };
      const a = assess(next);
      // one signed receipt per machine-day of ≤ 20 operating hours
      let remaining = h;
      const ledger = [...state.ledger];
      const intervP = state.sliders.intervention / 100;
      while (remaining > 0) {
        const dayHours = Math.min(ECON.hoursPerReceipt, remaining);
        remaining -= dayHours;
        const seconds = Math.round(dayHours * 3600);
        const energy = Math.round((seconds / 3600) * ECON.avgPowerW * (0.9 + rng() * 0.2));
        const interventions = rng() < intervP * 2 ? 1 : 0;
        const ctx = { ...idleContext("amr_transport", seconds, energy, sliders, `${dayHours} verified operating hours`), interventions };
        ledger.push(mint({ ...next, ledger }, "operation", ctx, a));
      }
      next = { ...next, ledger, tamper: null };
      const before = assess(state).mrs;
      next = push(next, a, "operation", `+${h} h verified · +${earned} mUSDC`);
      return log(next, "operation", `${h} verified machine-hours · ${earned} mUSDC operating revenue · MRS ${before} → ${a.mrs}`, earned);
    }
    case "maintain": {
      if (state.wallet < ECON.serviceCost) return log(state, "note", "Insufficient mUSDC for service.");
      const sliders: Sliders = { ...state.sliders, maintenance: 100, anomaly: Math.max(4, state.sliders.anomaly - 28) };
      let next: MachineState = { ...state, sliders, wallet: state.wallet - ECON.serviceCost, uptime: Math.min(99.6, state.uptime + 0.7) };
      const a = assess(next);
      next = { ...next, ledger: [...state.ledger, mint(next, "maintenance", idleContext("maintenance", 0, 300, sliders, "Authorised service completed by attested servicer"), a)], tamper: null };
      next = push(next, a, "maintenance", `Service · −${ECON.serviceCost} mUSDC`);
      return log(next, "maintenance", `Authorised service completed · ${ECON.serviceCost} mUSDC paid · anomaly reduced · MRS → ${a.mrs}`, -ECON.serviceCost);
    }
    case "incident": {
      const sliders: Sliders = { ...state.sliders, anomaly: Math.min(100, state.sliders.anomaly + 24), incidents: Math.min(10, state.sliders.incidents + 1) };
      let next: MachineState = { ...state, sliders, uptime: Math.max(88, state.uptime - 2.8), pendingClaim: true };
      const a = assess(next);
      const ctx = { ...idleContext("amr_transport", 3600, 480, sliders, "Collision — rack impact, human intervention required"), interventions: 1, fault_codes: ["F412"] };
      next = { ...next, ledger: [...state.ledger, mint(next, "incident", ctx, a)], tamper: null };
      next = push(next, a, "incident", "Incident receipt");
      return log(next, "incident", `Collision / fault event recorded · signed machine state · MRS repriced to ${a.mrs} · everything reprices`);
    }
    case "buy_insurance": {
      if (state.policy) return log(state, "note", "Policy already active.");
      const a = assess(state);
      const premium = Math.round(a.offers.premiumAnnual);
      if (state.wallet < premium) return log(state, "note", `Insufficient wallet balance for the ${premium} mUSDC premium.`);
      let next: MachineState = { ...state, wallet: state.wallet - premium, policy: { premium, boundAtHours: state.hours, coverHours: ECON.policyCoverHours } };
      next = { ...next, ledger: [...state.ledger, mint(next, "policy_bound", idleContext("idle", 0, 20, state.sliders, `Parametric cover bound · premium ${premium} mUSDC`), a)], tamper: null };
      next = push(next, a, "policy_bound", `Policy bound · −${premium} mUSDC`);
      return log(next, "policy_bound", `${premium} mUSDC premium paid (${(a.offers.premiumRate * 100).toFixed(2)}% of asset value at MRS ${a.mrs}) · parametric cover activated`, -premium);
    }
    case "borrow": {
      const a = assess(state);
      const room = Math.max(0, a.offers.maxLoan - state.debt);
      const draw = Math.round(Math.min(a.offers.maxLoan * ECON.borrowShareOfMax, room));
      if (draw <= 0) return log(state, "note", `No borrowing capacity left at MRS ${a.mrs} (max loan ${Math.round(a.offers.maxLoan)} mUSDC).`);
      let next: MachineState = { ...state, wallet: state.wallet + draw, debt: state.debt + draw };
      next = { ...next, ledger: [...state.ledger, mint(next, "credit_draw", idleContext("idle", 0, 20, state.sliders, `Credit draw ${draw} mUSDC at ${Math.round(a.offers.maxLtv * 100)}% max LTV`), a)], tamper: null };
      next = push(next, a, "credit_draw", `Credit draw · +${draw} mUSDC`);
      return log(next, "credit_draw", `${draw} mUSDC advanced against the machine · ${Math.round(a.offers.maxLtv * 100)}% max LTV · SOFR + ${a.offers.spreadBps} bps`, draw);
    }
    case "repay": {
      if (!state.debt) return log(state, "note", "No debt to repay.");
      const pay = Math.min(state.wallet, state.debt);
      const a = assess(state);
      let next: MachineState = { ...state, wallet: state.wallet - pay, debt: state.debt - pay };
      next = { ...next, ledger: [...state.ledger, mint(next, "repayment", idleContext("idle", 0, 20, state.sliders, `Repayment ${pay} mUSDC`), a)], tamper: null };
      next = push(next, a, "repayment", `Repayment · −${pay} mUSDC`);
      return log(next, "repayment", `${pay} mUSDC repaid · remaining debt ${next.debt}`, -pay);
    }
    case "claim": {
      if (!state.policy) return log(state, "note", "No active insurance policy.");
      if (!state.pendingClaim) return log(state, "note", "No new verified incident eligible for a claim.");
      const payout = Math.round(claimPayout(ECON.assetValue));
      const a = assess(state);
      let next: MachineState = { ...state, wallet: state.wallet + payout, claimsPaid: state.claimsPaid + payout, pendingClaim: false };
      next = { ...next, ledger: [...state.ledger, mint(next, "claim_settled", idleContext("idle", 0, 20, state.sliders, `Claim settled ${payout} mUSDC against verified incident receipt`), a)], tamper: null };
      next = push(next, a, "claim_settled", `Claim settled · +${payout} mUSDC`);
      return log(next, "claim_settled", `${payout} mUSDC paid automatically against the verified incident receipt (35% severity, 10% deductible — illustrative)`, payout);
    }
    case "tamper": {
      const bundle = bundleOf({ ...state, tamper: null });
      const idx = action.index ?? Math.max(0, Math.min(bundle.receipts.length - 1, Math.floor(bundle.receipts.length / 2)));
      const t = tamperBundle(bundle, { field: action.field, index: idx });
      return log({ ...state, tamper: t }, "note", `Tampered ${t.description}`);
    }
    case "restore":
      return log({ ...state, tamper: null }, "note", "Ledger restored to the signed original.");
    case "reset":
      return initialState(state.seed);
    case "hydrate":
      return action.state;
  }
}
