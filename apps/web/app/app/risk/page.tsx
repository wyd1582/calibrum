"use client";
import { useMemo } from "react";
import { useMachine } from "@/components/MachineProvider";
import { AnomalyTimeline, ProjectionChart } from "@/components/charts";
import { Illustrative, Panel, Stat, money } from "@/components/ui";
import { attributionDelta, describeFeature, topContributors } from "@/lib/contract/score";
import { annualFailureProbability, SEVERITY } from "@/lib/finance/pricing";
import { assessSliders, projection } from "@/lib/sim/machine";

export default function Risk() {
  const { state, a } = useMachine();
  const proj = useMemo(() => projection(state, 12), [state]);
  const prev = useMemo(() => (state.prev ? assessSliders(state.prev.modelId, state.prev.sliders) : null), [state.prev]);
  const deltas = prev ? attributionDelta(prev.result, a.result, 5) : [];
  const top = topContributors(a.result, 5);
  const timeline = state.history
    .filter((h) => h.event !== "slider")
    .map((h) => ({ ...h, severity: h.event === "incident" ? 1 : h.event === "maintenance" ? 0.5 : 0.2 }));
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-6">
        <Panel title="02 · Failure probability" sub="P(failure within the next 30 cycles), projected month by month if behaviour is unchanged" right={<Illustrative>Projection · illustrative</Illustrative>}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat k="P(fail, next 30 cycles)" v={`${(a.result.p * 100).toFixed(2)}%`} s="from the contract, now" tone={a.result.p > 0.1 ? "bad" : a.result.p > 0.02 ? "amber" : "good"} />
            <Stat k="Annualised" v={`${(annualFailureProbability(a.result.p) * 100).toFixed(1)}%`} s="1 − (1 − p)^12 · illustrative" />
            <Stat k="Expected loss, 12m" v={money(a.expectedLoss12m)} s={`× ${Math.round(SEVERITY * 100)}% severity of asset value`} tone="amber" />
          </div>
          <ProjectionChart data={proj} />
          <p className="mt-2 text-[11px] text-dimmer">Hours accrue at the current utilisation; the machine slides along the cohort&apos;s empirical degradation trajectory and is rescored by the same contract at each step.</p>
        </Panel>
        <Panel title="Anomaly timeline" sub="every signed event, sized by severity, at the verified hours it was recorded">
          <AnomalyTimeline data={timeline} />
        </Panel>
      </div>
      <div className="grid gap-6">
        <Panel title="Why this changed" sub={prev ? `${prev.mrs} → ${a.mrs} after: ${state.history.at(-1)?.label ?? "—"}` : "no change yet"}>
          {deltas.length === 0 ? (
            <p className="text-xs text-dimmer">Take an action in 04 · Wallet or move a slider; the five largest signed coef·z changes appear here. Their sum equals the logit change exactly.</p>
          ) : (
            <ul className="space-y-2">
              {deltas.map((d) => (
                <li key={d.feature} className="flex items-center gap-3 text-xs">
                  <span className="w-44 shrink-0 text-dim">{describeFeature(d.feature)}</span>
                  <span className="relative h-2 flex-1 rounded bg-panel2">
                    <span className={`absolute top-0 h-2 rounded ${d.delta > 0 ? "bg-bad" : "bg-good"}`} style={{ left: d.delta > 0 ? "50%" : `${50 - Math.min(50, Math.abs(d.delta) * 25)}%`, width: `${Math.min(50, Math.abs(d.delta) * 25)}%` }} />
                  </span>
                  <span className={`tnum w-20 text-right font-semibold ${d.delta > 0 ? "text-bad" : "text-good"}`}>
                    {d.delta > 0 ? "+" : ""}
                    {d.delta.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-dimmer">Units: logit. Positive pushes toward failure. Σ of all 43 deltas = {prev ? (a.result.logit - prev.result.logit).toFixed(3) : "—"}.</p>
        </Panel>
        <Panel title="Top contributors now" sub="largest |coef·z| terms in the current score">
          <ul className="space-y-2">
            {top.map((c) => (
              <li key={c.feature} className="flex items-center justify-between text-xs">
                <span className="text-dim">
                  {describeFeature(c.feature)} <span className="font-mono text-[10px] text-dimmer">{c.feature}</span>
                </span>
                <span className="tnum">
                  <span className="text-dimmer">z {c.z.toFixed(2)} · </span>
                  <b className={c.contribution > 0 ? "text-bad" : "text-good"}>
                    {c.contribution > 0 ? "+" : ""}
                    {c.contribution.toFixed(2)}
                  </b>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-dimmer">
            Intercept {a.result.logit - a.result.contributions.reduce((s, c) => s + c.contribution, 0) > -100 ? (a.result.logit - a.result.contributions.reduce((s, c) => s + c.contribution, 0)).toFixed(2) : ""} · logit {a.result.logit.toFixed(2)}
          </p>
        </Panel>
      </div>
    </div>
  );
}
