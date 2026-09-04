/**
 * Financial mapping (handoff Part 4). Illustrative, documented, monotone —
 * label as such in every UI. Not calibrated to any live book.
 */
export const SOFR = 0.043; // assumed reference rate for display, labelled
export const SEVERITY = 0.35; // loss given failure as a share of asset value (illustrative)
export const DEDUCTIBLE = 0.1; // share of loss retained by the insured (illustrative)
export const CYCLES_PER_YEAR_OVER_HORIZON = 12; // one 30-cycle horizon ≈ one month of operation (illustrative)

export function premiumRate(mrs: number): number {
  return 0.09 - (mrs / 1000) * 0.075;
}
export function maxLtv(mrs: number): number {
  return 0.25 + (mrs / 1000) * 0.55;
}
export function creditSpreadBps(mrs: number): number {
  return 1200 - mrs;
}
export function residualPct(mrs: number): number {
  return 0.3 + (mrs / 1000) * 0.4;
}

export interface Offers {
  premiumAnnual: number;
  premiumRate: number;
  maxLtv: number;
  spreadBps: number;
  allInRate: number;
  residualValue: number;
  residualPct: number;
  maxLoan: number;
  pool: { eligible: boolean; tier: string; capacity: number; note: string };
}

/** Three live offers repriced from MRS. Collateral base = residual value. */
export function offersFor(mrs: number, assetValue: number, poolSize = 2_500_000): Offers {
  const rv = assetValue * residualPct(mrs);
  const ltv = maxLtv(mrs);
  const maxLoan = rv * ltv;
  let pool: Offers["pool"];
  if (mrs >= 700) pool = { eligible: true, tier: "senior", capacity: Math.min(maxLoan, poolSize), note: "Eligible for the senior credit pool at full LTV." };
  else if (mrs >= 600) pool = { eligible: true, tier: "mezzanine", capacity: Math.min(maxLoan * 0.5, poolSize), note: "Eligible for mezzanine only: half LTV, wider spread." };
  else pool = { eligible: false, tier: "ineligible", capacity: 0, note: "Below the pool's 600 MRS floor — no credit-pool availability." };
  return {
    premiumAnnual: assetValue * premiumRate(mrs),
    premiumRate: premiumRate(mrs),
    maxLtv: ltv,
    spreadBps: creditSpreadBps(mrs),
    allInRate: SOFR + creditSpreadBps(mrs) / 10_000,
    residualValue: rv,
    residualPct: residualPct(mrs),
    maxLoan,
    pool,
  };
}

/** Annualised failure probability from the contract's 30-cycle probability (illustrative compounding). */
export function annualFailureProbability(p30: number): number {
  return 1 - Math.pow(1 - p30, CYCLES_PER_YEAR_OVER_HORIZON);
}

/** Expected 12-month loss = annual failure probability × severity × asset value. */
export function expectedLoss12m(p30: number, assetValue: number): number {
  return annualFailureProbability(p30) * SEVERITY * assetValue;
}

/** Parametric claim payout on a verified incident (illustrative). */
export function claimPayout(assetValue: number): number {
  return assetValue * SEVERITY * (1 - DEDUCTIBLE);
}
