"use client";
import { useMemo } from "react";
import { useMachine } from "@/components/MachineProvider";
import { PricingCurve } from "@/components/charts";
import { Illustrative, Panel, Stat, money, pct } from "@/components/ui";
import { maxLtv, offersFor, premiumRate, SOFR } from "@/lib/finance/pricing";
import { ECON } from "@/lib/sim/machine";

const UNRATED = 650; // the two-robots demo's unrated starting point

export default function Finance() {
  const { a, state } = useMachine();
  const o = a.offers;
  const ref = offersFor(UNRATED, ECON.assetValue);
  const series = useMemo(() => Array.from({ length: 56 }, (_, i) => 300 + i * 10).map((m) => ({ mrs: m, premium: ECON.assetValue * premiumRate(m), ltv: Math.round(maxLtv(m) * 100) })), []);
  const debt = state.debt || ref.maxLoan * 0.4;
  const gap = ref.premiumAnnual - o.premiumAnnual + debt * ((ref.spreadBps - o.spreadBps) / 10_000);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">03 · Three live offers, repriced from MRS {a.mrs}</h1>
          <p className="text-xs text-dim">Documented monotone mappings (handoff Part 4). Placeholders until calibrated against a real claims / loan book with a design partner.</p>
        </div>
        <Illustrative>Illustrative pricing functions · not offers</Illustrative>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Panel title="Insurer · annual premium" sub="premium_rate = 9.0% − MRS/1000 × 7.5% of asset value">
          <div className="tnum text-3xl font-bold text-amber">{money(o.premiumAnnual)}</div>
          <div className="mt-1 text-xs text-dim">
            {pct(o.premiumRate, 2)} of {money(ECON.assetValue)} · vs {money(ref.premiumAnnual)} for an unrated machine at {UNRATED}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat k="Cover" v="Parametric" s="pays on a verified incident receipt" />
            <Stat k="Payout" v={money(ECON.assetValue * 0.35 * 0.9)} s="35% severity · 10% deductible" />
          </div>
        </Panel>
        <Panel title="Lender · LTV and rate" sub="max LTV = 25% + MRS/1000 × 55% · spread = (1200 − MRS) bps over SOFR">
          <div className="tnum text-3xl font-bold text-cyan">
            {Math.round(o.maxLtv * 100)}% <span className="text-base font-medium text-dim">LTV</span>
          </div>
          <div className="mt-1 text-xs text-dim">
            SOFR {pct(SOFR)} + {o.spreadBps} bps = <b className="tnum text-ink">{pct(o.allInRate, 2)}</b> all-in
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat k="Collateral base" v={money(o.residualValue)} s={`residual = 30% + MRS/1000 × 40% = ${Math.round(o.residualPct * 100)}%`} />
            <Stat k="Max loan" v={money(o.maxLoan)} s="residual × max LTV" />
          </div>
        </Panel>
        <Panel title="Credit pool · availability" sub="senior ≥ 700 · mezzanine 600–699 · ineligible < 600">
          <div className={`tnum text-3xl font-bold ${o.pool.eligible ? "text-good" : "text-bad"}`}>{o.pool.eligible ? money(o.pool.capacity) : "0 mUSDC"}</div>
          <div className="mt-1 text-xs text-dim">
            tier: <b className="text-ink">{o.pool.tier}</b> · pool size {money(2_500_000)}
          </div>
          <p className="mt-4 text-xs text-dim">{o.pool.note}</p>
          <div className="mt-3 h-2 overflow-hidden rounded bg-panel2">
            <div className="h-2 bg-good" style={{ width: `${Math.min(100, (o.pool.capacity / o.maxLoan) * 100 || 0)}%` }} />
          </div>
        </Panel>
      </div>
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Premium and max LTV across the score range" sub={`${money(ECON.assetValue)} asset · the violet line is this machine`}>
          <PricingCurve current={a.mrs} series={series} />
        </Panel>
        <Panel title="Cost-of-capital gap vs unrated" sub="what verified history is worth to this operator per year">
          <div className={`tnum text-3xl font-bold ${gap >= 0 ? "text-good" : "text-bad"}`}>
            {gap >= 0 ? "+" : "−"}
            {money(Math.abs(gap))}/yr
          </div>
          <p className="mt-2 text-xs text-dim">
            Premium saving {money(ref.premiumAnnual - o.premiumAnnual)} + interest saving on {money(debt)} of debt at {ref.spreadBps - o.spreadBps} bps. Negative means this machine would pay more than a
            blind quote — because the evidence says it should.
          </p>
          <p className="mt-3 text-[11px] text-dimmer">Unverifiable risk is expensive risk: when an underwriter cannot distinguish the good robot from the bad one, both pay the bad robot&apos;s price.</p>
        </Panel>
      </div>
    </div>
  );
}
