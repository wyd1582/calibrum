import Link from "next/link";
import { MODELS } from "@/lib/contract/registry";
import metricsV0 from "../../../engine/mrs_v0/out/metrics.json";
import mc from "../../../sim/out/underwriting_mc.json";
import { Illustrative, Panel } from "@/components/ui";
import { CalibrationRing } from "@/components/CalibrationRing";

const CAP = "Data: NASA C-MAPSS FD001 physics-based degradation simulation benchmark - methodology validation, not market data. Model: logistic scorecard, out-of-machine holdout (units 71-100).";
const CAP_FIN = "Pricing functions are illustrative and uncalibrated to any live book.";

const CHARTS = [
  { src: "/evidence/lift_curve.png", title: "Riskiest 20% of machine-cycles captured 97% of upcoming failures", cap: CAP },
  { src: "/evidence/score_distribution.png", title: "MRS separates healthy cycles from pre-failure cycles", cap: CAP },
  { src: "/evidence/calibration.png", title: "Predicted vs observed failure rate by MRS decile", cap: CAP },
  { src: "/evidence/finance_mapping.png", title: "Premium and max LTV as functions of MRS", cap: CAP_FIN },
];

export default function Landing() {
  const m = metricsV0;
  const abl = m.ablations;
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24">
      {/* HERO */}
      <section className="grid items-center gap-10 py-20 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-violet">Calibrum · 衡准 · The financial standard for machines</p>
          <h1 className="text-5xl font-bold leading-[1.02] tracking-tight md:text-6xl">The next billion borrowers may not be human.</h1>
          <p className="mt-6 max-w-2xl text-lg text-dim">
            Machines have infinite data and zero credit. Calibrum turns hardware-signed operating receipts — <b className="text-ink">Proof of Operation</b> — into a portable{" "}
            <b className="text-ink">Machine Risk Score</b> that insurers, lenders and lessors price against.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            {["Telemetry", "Evidence", "Reputation", "Capital"].map((s, i) => (
              <span key={s} className="flex items-center gap-3">
                <span className={`rounded-lg border px-3.5 py-2 ${i === 3 ? "border-violet bg-violet/10 text-ink" : "border-line bg-panel text-ink"}`}>{s}</span>
                {i < 3 && <span className="text-dimmer">→</span>}
              </span>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <Link href="/app/passport" className="rounded-lg bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet2">
              Open the Calibrum Passport →
            </Link>
            <a href="#evidence" className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink hover:border-dimmer">
              See the evidence
            </a>
          </div>
          <p className="mt-4 text-xs text-dimmer">
            Lower verification cost → shorter Underwriting Distance → lower uncertainty → lower cost of machine capital.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <CalibrationRing score={782} size={190} sub="PRIME" color="#34D399" />
              <div className="text-xs text-dim">Robot A · 8,000 h, zero incidents</div>
            </div>
            <div className="text-center">
              <CalibrationRing score={431} size={190} sub="DECLINE" color="#F87171" />
              <div className="text-xs text-dim">Robot B · 3 collisions, 2 joint replacements</div>
            </div>
          </div>
          <p className="max-w-sm text-center text-xs text-dimmer">
            Same manufacturer, model, year and price. Today a bank quotes them roughly the same rate. <Illustrative>Illustrative passports from the founder essay</Illustrative>
          </p>
        </div>
      </section>

      <div className="tick-rule my-6" />

      {/* STORY */}
      <section className="grid gap-6 py-12 md:grid-cols-3">
        <Panel title="Underwriting Distance" sub="why the data doesn't count">
          <p className="text-sm text-dim">
            Sensor → OEM cloud → operator report → broker summary → insurer → reinsurer. Call the number of trusted intermediaries between a machine event and a capital decision the{" "}
            <b className="text-ink">Underwriting Distance</b>. For machines today it is five or six. None of it can be independently re-verified by the party writing the check.{" "}
            <b className="text-ink">Unverifiable risk is expensive risk.</b>
          </p>
        </Panel>
        <Panel title="Proof of Operation" sub="the primitive">
          <p className="text-sm text-dim">
            A cryptographically signed receipt that a specific machine performed a specific unit of work under specific conditions. Raw telemetry stays encrypted off-chain. What goes on a neutral ledger is
            identity, commitments and state transitions — the parts six mutually distrustful parties all need to agree on. A signature proves the sensor said X, not that X happened; physics cross-checks,
            adversarial financial outcomes and stake-and-slash give it meaning.
          </p>
        </Panel>
        <Panel title="Proof of Operation → Reputation → Credit → Capital" sub="the whole company in one line">
          <p className="text-sm text-dim">
            From verified operation, a deliberately boring model — a logistic scorecard, the kind a consumer-credit shop would build — produces one number: the Machine Risk Score. An insurer, a lender and a
            used-equipment buyer on three continents see the same difference, verify the same evidence, and price accordingly.
          </p>
          <div className="mt-4 flex gap-3 text-xs">
            <Link href="/demos/two_robots.html" className="text-cyan hover:underline">
              ▶ Two Robots, 24 months
            </Link>
            <Link href="/demos/underwriter_game.html" className="text-cyan hover:underline">
              ▶ Play the underwriting desk
            </Link>
          </div>
        </Panel>
      </section>

      {/* EVIDENCE */}
      <section id="evidence" className="scroll-mt-24 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet">Evidence</p>
            <h2 className="mt-2 text-3xl font-bold">Even the dumb model has underwriting power on machine telemetry.</h2>
            <p className="mt-2 max-w-3xl text-sm text-dim">
              MRS v0: standardised logistic regression, 43 features from 20 cycles of history, validated <b className="text-ink">out-of-machine</b> on {m.machines_holdout} turbofans never seen in training.{" "}
              <b className="text-ink">{m.dataset}</b> — a physics-based simulation benchmark that validates the method, not the market.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              ["AUC", m.auc.toFixed(2)],
              ["Gini", m.gini.toFixed(2)],
              ["KS", m.ks.toFixed(2)],
              ["Top-20% capture", `${Math.round(m.top20_capture * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-panel px-4 py-3">
                <div className="tnum text-2xl font-bold text-cyan">{v}</div>
                <div className="text-[10.5px] uppercase tracking-wider text-dim">{k}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {CHARTS.map((c) => (
            <figure key={c.src} className="overflow-hidden rounded-2xl border border-line bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt={c.title} className="w-full" />
              <figcaption className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-dimmer">{c.cap}</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr]">
          <Panel title="Ablations — the leakage check" sub="is it the clock, or the telemetry?">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-dimmer">
                <tr>
                  <th className="py-1">features</th>
                  <th>AUC</th>
                  <th>top-20% capture</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {(["full", "hours_only", "sensors_only"] as const).map((k) => (
                  <tr key={k} className="border-t border-line">
                    <td className="py-1.5 text-dim">{{ full: "full model (43)", hours_only: "machine age only", sensors_only: "sensors only, no age" }[k]}</td>
                    <td>{abl[k].auc.toFixed(2)}</td>
                    <td>{Math.round(abl[k].cap20 * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-dim">The full model&apos;s performance comes from degradation signal in the telemetry, not from a leaked clock.</p>
          </Panel>
          <Panel title="One engine, three cohorts" sub="same 43 features, same scorecard, harder benchmarks">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-dimmer">
                <tr>
                  <th className="py-1">cohort</th>
                  <th>machines</th>
                  <th>AUC</th>
                  <th>top-20%</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {MODELS.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-1.5 text-dim">{r.model.holdout_metrics.dataset.replace(" (simulation benchmark", " (sim").replace(/;.*\)/, ")")}</td>
                    <td>{r.model.holdout_metrics.machines_train + r.model.holdout_metrics.machines_holdout}</td>
                    <td>{r.model.holdout_metrics.auc.toFixed(2)}</td>
                    <td>{Math.round(r.model.holdout_metrics.top20_capture * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-dim">
              Multi-condition sets shift raw sensor levels by operating regime; the naive scorecard pays for ignoring that. Real-hardware cohorts (Backblaze drives, GPU fault traces, robot arms) are the next
              step — see <code className="text-cyan">DECISIONS.md</code>.
            </p>
          </Panel>
        </div>
        <Panel title="Reproduce this" sub="every number above regenerates from a clean clone" className="mt-6">
          <pre className="overflow-x-auto rounded-xl border border-line bg-gauge p-4 text-[12.5px] leading-relaxed text-ink">
            {`git clone <repo> calibrum && cd calibrum
make setup           # python venv (pandas, scikit-learn, matplotlib) + pnpm install
make backtest        # downloads NASA C-MAPSS FD001 (3 MB), retrains MRS v0, regenerates the four charts into engine/mrs_v0/out/
make backtest-cohorts   # FD002 / FD004 through the same engine → engine/cohorts/out/
make sim             # 10,000 simulated insured years: flat vs MRS pricing → sim/out/
make verify-poo      # sign → tamper → verify a Proof of Operation chain and watch it fail legibly
make dev             # this app: npm install && npm run dev`}
          </pre>
        </Panel>
      </section>

      {/* SIM */}
      <section className="grid gap-6 py-12 md:grid-cols-[1fr_1fr]">
        <figure className="overflow-hidden rounded-2xl border border-line bg-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/evidence/underwriting_mc.png" alt="Loss-ratio distribution: flat vs MRS pricing" className="w-full" />
          <figcaption className="border-t border-line px-4 py-3 text-[11.5px] text-dimmer">
            SIMULATION: invented hazard curve p_fail(MRS), uniform severities. Demonstrates the mechanism of adverse selection, not any real book. Illustrative demo model. Regenerate with{" "}
            <code>make sim</code>.
          </figcaption>
        </figure>
        <Panel title="Why the insurers are our first customers" sub="the underwriting desk, in 10,000 simulated years">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Flat pricing", mc.flat.mean_lr, mc.flat.p_loss, "amber"],
              ["MRS pricing, insure all", mc.mrs.mean_lr, mc.mrs.p_loss, "cyan"],
              [`MRS pricing + decline <${mc.mrs_floor}`, mc.mrs_select.mean_lr, mc.mrs_select.p_loss, "good"],
            ].map(([k, lr, pl, tone]) => (
              <div key={k as string} className="rounded-xl border border-line bg-panel2 px-3 py-3">
                <div className="text-[10.5px] uppercase tracking-wider text-dim">{k as string}</div>
                <div className={`tnum mt-1 text-2xl font-bold text-${tone}`}>{Math.round((lr as number) * 100)}%</div>
                <div className="text-[11px] text-dimmer">mean loss ratio · loses money {Math.round((pl as number) * 100)}% of years</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-dim">
            Without verified history every machine quotes the same flat premium, so the careful operator subsidises the careless one and the book is adversely selected. Price and select on MRS and the same
            claims produce a profitable book. <Illustrative>Simulation · model-derived, not hand-tuned</Illustrative>
          </p>
        </Panel>
      </section>

      <div className="tick-rule my-6" />
      <section className="grid items-center gap-8 py-12 md:grid-cols-[0.9fr_1.1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ill_humanoid.png" alt="Humanoid with a calibration-ring halo" className="mx-auto max-w-sm rounded-2xl" />
        <div>
          <h2 className="text-3xl font-bold">Human finance took a century to turn behavioural history into cost of capital.</h2>
          <p className="mt-4 text-dim">The machine economy gets to skip most of that century — because unlike people, machines can sign their own history.</p>
          <p className="mt-4 text-dim">We are building their credit system.</p>
          <Link href="/app/passport" className="mt-6 inline-block rounded-lg bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet2">
            Open the Passport →
          </Link>
        </div>
      </section>
      <footer className="mt-12 border-t border-line pt-6 text-xs text-dimmer">
        Calibrum · 衡准 · Investor demo. Every score on this site is computed by the published model contract (engine/mrs_v0/out/mrs_model.json). Every simulated number is labelled. Nothing here is an offer.
      </footer>
    </main>
  );
}
