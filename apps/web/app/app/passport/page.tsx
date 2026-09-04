"use client";
import { CalibrationRing } from "@/components/CalibrationRing";
import { useMachine } from "@/components/MachineProvider";
import { ScoreHistory } from "@/components/charts";
import { Chip, Illustrative, Panel, Stat, fmt, money } from "@/components/ui";
import { MODELS } from "@/lib/contract/registry";
import { DEMO_MACHINE_ID, ECON } from "@/lib/sim/machine";

export default function Passport() {
  const { state, a, dispatch } = useMachine();
  const model = MODELS.find((m) => m.id === state.modelId)!;
  const lastService = [...state.history].reverse().find((h) => h.event === "maintenance");
  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Panel
        title="01 · Calibrum Passport"
        sub="portable financial identity for one machine"
        right={
          <select value={state.modelId} onChange={(e) => dispatch({ type: "set_model", modelId: e.target.value })} className="max-w-[300px] rounded-lg border border-line bg-panel2 px-2 py-1.5 text-[11px] text-ink" title="Model contract (dataset provenance in label)">
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        }
      >
        <div className="flex flex-wrap items-center gap-6">
          <CalibrationRing score={a.mrs} size={230} sub={a.grade.label.toUpperCase()} color={a.grade.color} />
          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2">
              <Chip color={a.grade.color}>
                Grade {a.grade.tier} · {a.grade.label}
              </Chip>
              <Illustrative />
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-dimmer">machine_id</dt>
              <dd className="truncate font-mono text-dim" title={DEMO_MACHINE_ID}>
                {DEMO_MACHINE_ID}
              </dd>
              <dt className="text-dimmer">asset</dt>
              <dd className="text-dim">Autonomous mobile robot · pallet transport · cost {money(ECON.assetValue)}</dd>
              <dt className="text-dimmer">firmware</dt>
              <dd className="text-dim">{state.ledger.at(-1)?.context.fw_version}</dd>
              <dt className="text-dimmer">contract</dt>
              <dd className="text-dim">
                {model.model.kind} · {model.model.event}
              </dd>
              <dt className="text-dimmer">P(event)</dt>
              <dd className="tnum text-dim">{(a.result.p * 100).toFixed(2)}% within the next 30 cycles</dd>
              <dt className="text-dimmer">receipts</dt>
              <dd className="tnum text-dim">{state.ledger.length} signed · chain intact</dd>
            </dl>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat k="Verified hours" v={fmt(state.hours)} s="VMOH · signed" />
          <Stat k="Maintenance" v={`${state.sliders.maintenance}%`} s={lastService ? `last service at ${fmt(lastService.hours)} h` : "compliance · no service yet"} tone={state.sliders.maintenance >= 90 ? "good" : "amber"} />
          <Stat k="Incidents" v={state.sliders.incidents} s="signed events" tone={state.sliders.incidents ? "bad" : undefined} />
          <Stat k="Uptime" v={`${state.uptime.toFixed(1)}%`} s="last 90d" />
          <Stat k="Residual value" v={money(a.offers.residualValue)} s={`${Math.round(a.offers.residualPct * 100)}% of cost · illustrative`} />
        </div>
        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between text-xs text-dim">
            <span>Machine Risk Score over verified operating events</span>
            <span className="flex gap-3 text-[10.5px]">
              <span className="text-cyan">● operation</span>
              <span className="text-good">● maintenance</span>
              <span className="text-bad">● incident</span>
              <span className="text-violet">● financial</span>
            </span>
          </div>
          <ScoreHistory data={state.history} />
        </div>
      </Panel>
      <div className="grid gap-6">
        <Panel title="Insurance · Debt · Wallet" sub="the machine's balance sheet">
          <div className="grid grid-cols-3 gap-3">
            <Stat k="Insurance" v={state.policy ? "ACTIVE" : "NONE"} s={state.policy ? `${money(state.policy.premium)} premium` : `quote ${money(a.offers.premiumAnnual)}/yr`} tone={state.policy ? "good" : undefined} />
            <Stat k="Debt" v={money(state.debt)} s={`max loan ${money(a.offers.maxLoan)}`} tone={state.debt ? "amber" : undefined} />
            <Stat k="Wallet" v={money(state.wallet)} s={`revenue ${money(state.revenue)}`} tone="cyan" />
          </div>
          <p className="mt-3 text-xs text-dimmer">Offers reprice from MRS via the documented Part-4 mappings. See 03 · Finance for the formulas and 04 · Wallet to transact.</p>
        </Panel>
        <Panel title="How this score is computed" sub="one contract, no hidden math">
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-dim">
            <li>
              Sliders (behaviour, environment, age, incidents) position a demo machine on the cohort&apos;s empirical degradation trajectory and produce the contract&apos;s {model.model.features.length} raw features.
            </li>
            <li>z = (x − mean)/std per feature; logit = intercept + Σ coef·z; p = 1/(1+e^−logit).</li>
            <li>
              MRS = clip(600 + (40/ln 2)·ln(((1−p)/p)/15), 300, 850) — PDO 40, 600 points at 15:1 odds.
            </li>
            <li>
              Model: <span className="text-ink">{model.label}</span>. Holdout AUC {model.model.holdout_metrics.auc.toFixed(2)}, top-20% capture {Math.round(model.model.holdout_metrics.top20_capture * 100)}%.
            </li>
          </ol>
          <p className="mt-3 text-[11px] text-dimmer">{model.provenanceNote} The demo machine is synthetic; the model is the real trained artefact.</p>
        </Panel>
        <Panel title="Recent receipts" sub="Proof of Operation · latest first">
          <ul className="space-y-1.5 text-xs">
            {[...state.ledger]
              .reverse()
              .slice(0, 5)
              .map((r) => (
                <li key={r.receipt_id} className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-3 py-2">
                  <span>
                    <b className="text-violet">{r.event}</b> <span className="text-dim">· {r.context.note}</span>
                  </span>
                  <span className="tnum font-mono text-[10.5px] text-dimmer">
                    #{r.epoch} · {r.hash.slice(0, 10)}…
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
