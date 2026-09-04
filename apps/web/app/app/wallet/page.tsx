"use client";
import { useMachine } from "@/components/MachineProvider";
import { Button, Illustrative, Panel, Stat, fmt, money } from "@/components/ui";
import { ECON } from "@/lib/sim/machine";

export default function Wallet() {
  const { state, dispatch, a } = useMachine();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Panel title="04 · Machine wallet" sub="the mUSDC economy: run, maintain, insure, borrow, settle" right={<Illustrative>Demo economy · not production underwriting</Illustrative>}>
        <div className="flex items-baseline gap-2">
          <span className="tnum text-4xl font-bold">{fmt(state.wallet)}</span>
          <span className="font-semibold text-cyan">mUSDC</span>
        </div>
        <p className="mt-1 text-xs text-dim">
          {state.debt ? `Debt ${money(state.debt)} · ` : "No active debt · "}
          {state.policy ? "Insurance active" : "No active policy"}
          {state.pendingClaim ? " · verified incident eligible for claim" : ""}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <Button tone="primary" onClick={() => dispatch({ type: "run", hours: 100 })}>
            Run +100 h
          </Button>
          <Button tone="primary" onClick={() => dispatch({ type: "run", hours: 500 })}>
            Run +500 h
          </Button>
          <Button tone="warn" onClick={() => dispatch({ type: "maintain" })} title={`${ECON.serviceCost} mUSDC`}>
            Perform maintenance · {ECON.serviceCost}
          </Button>
          <Button onClick={() => dispatch({ type: "buy_insurance" })} disabled={!!state.policy}>
            Buy 12m insurance · {fmt(Math.round(a.offers.premiumAnnual))}
          </Button>
          <Button onClick={() => dispatch({ type: "borrow" })}>Borrow against machine</Button>
          <Button onClick={() => dispatch({ type: "repay" })} disabled={!state.debt}>
            Repay debt
          </Button>
          <Button tone="danger" onClick={() => dispatch({ type: "incident" })}>
            Trigger incident
          </Button>
          <Button onClick={() => dispatch({ type: "claim" })} disabled={!state.policy || !state.pendingClaim}>
            Settle eligible claim
          </Button>
          <Button tone="ghost" onClick={() => dispatch({ type: "reset" })}>
            Reset economy
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat k="Debt" v={fmt(state.debt)} s="mUSDC" tone={state.debt ? "amber" : undefined} />
          <Stat k="Policy" v={state.policy ? "ON" : "OFF"} s="parametric cover" tone={state.policy ? "good" : undefined} />
          <Stat k="Revenue" v={fmt(state.revenue)} s="mUSDC generated" tone="cyan" />
          <Stat k="Claims paid" v={fmt(state.claimsPaid)} s="mUSDC" />
        </div>
        <div className="mt-5 flex items-center justify-between gap-2 text-[11px]">
          {["Signed telemetry", "Proof of Operation", "Risk engine", "Capital terms", "Settlement"].map((n, i) => (
            <span key={n} className="flex flex-1 items-center gap-2">
              <span className="flex-1 rounded-lg border border-line bg-panel2 px-2 py-2 text-center text-dim">{n}</span>
              {i < 4 && <span className="text-dimmer">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-dimmer">
          Economics are stated constants: revenue/h = {ECON.revenueBase} + utilisation/30 mUSDC; service {ECON.serviceCost}; premium and max loan from the Part-4 mappings at the live MRS; a draw is 40% of the max loan;
          claim payout = 35% severity × asset value − 10% deductible. Every action emits a signed Proof of Operation receipt (05 · Verify).
        </p>
      </Panel>
      <Panel title="Action log" sub="latest first · MRS reprices on every verified event">
        <div className="mb-3 grid grid-cols-3 gap-3">
          <Stat k="MRS now" v={a.mrs} s={a.grade.label} tone={a.grade.tier === "A" ? "good" : a.grade.tier === "B" ? "cyan" : a.grade.tier === "C" ? "amber" : "bad"} />
          <Stat k="Premium quote" v={money(a.offers.premiumAnnual)} s="per year" />
          <Stat k="Max loan" v={money(a.offers.maxLoan)} s={`${Math.round(a.offers.maxLtv * 100)}% LTV`} />
        </div>
        <ul className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1 text-xs">
          {state.log.map((l, i) => (
            <li key={`${l.step}-${i}`} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-panel2 px-3 py-2">
              <span>
                <b className={l.kind === "incident" ? "text-bad" : l.kind === "note" ? "text-amber" : "text-violet"}>{l.kind.replace("_", " ")}</b> <span className="text-dim">· {l.text}</span>
              </span>
              {l.amount !== undefined && (
                <span className={`tnum shrink-0 font-semibold ${l.amount >= 0 ? "text-good" : "text-bad"}`}>
                  {l.amount >= 0 ? "+" : "−"}
                  {fmt(Math.abs(l.amount))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
