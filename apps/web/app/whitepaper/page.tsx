import type { Metadata } from "next";
import Link from "next/link";
import v0 from "../../../../engine/mrs_v0/out/metrics.json";
import fd2 from "../../../../engine/cohorts/out/cmapss_fd002/metrics.json";
import fd4 from "../../../../engine/cohorts/out/cmapss_fd004/metrics.json";
import mc from "../../../../sim/out/underwriting_mc.json";

export const metadata: Metadata = {
  title: "Calibrum Whitepaper — Machine Risk Score v0",
  description: "Underwriting distance, Proof of Operation, MRS methodology, empirical results, model governance, and network design.",
};

const SECTIONS = [
  ["abstract", "Abstract"],
  ["problem", "1 · Infinite data, zero credit"],
  ["distance", "2 · Underwriting Distance"],
  ["poo", "3 · Proof of Operation"],
  ["mrs", "4 · The Machine Risk Score"],
  ["results", "5 · Empirical results"],
  ["pricing", "6 · From score to price"],
  ["governance", "7 · Validation & model governance"],
  ["data", "8 · Data roadmap"],
  ["network", "9 · Network design & the chain"],
  ["positioning", "10 · Positioning & precedents"],
  ["limitations", "11 · Limitations"],
] as const;

function S({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line py-10 first:border-t-0">
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-4 space-y-4 text-[14.5px] leading-relaxed text-dim [&_b]:text-ink [&_code]:text-cyan">{children}</div>
    </section>
  );
}

function Formula({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-xl border border-line bg-gauge px-5 py-4">
      {label && <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-dimmer">{label}</div>}
      <div className="tnum overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

function T({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-panel2 text-left text-[11px] uppercase tracking-wider text-dimmer">
            {head.map((h) => (
              <th key={h} className="px-3.5 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`px-3.5 py-2 ${j === 0 ? "text-dim" : "text-ink"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pc = (x: number) => `${Math.round(x * 100)}%`;

export default function Whitepaper() {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24">
      <header className="border-b border-line py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet">Calibrum · technical whitepaper · v0.1 · September 2026</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight">The Machine Risk Score: verifiable operating evidence as the pricing standard for machine capital.</h1>
        <p className="mt-5 max-w-2xl text-[15px] text-dim">
          Every figure in this document regenerates from a clean clone of the repository via a single <code className="text-cyan">make</code> target.
          Simulated results are labelled as such throughout.
        </p>
      </header>

      <div className="grid gap-12 py-8 lg:grid-cols-[240px_1fr]">
        <nav className="top-24 hidden self-start lg:sticky lg:block">
          <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-dimmer">Contents</div>
          <ul className="space-y-1.5 border-l border-line text-[13px]">
            {SECTIONS.map(([id, t]) => (
              <li key={id}>
                <a href={`#${id}`} className="-ml-px block border-l border-transparent py-0.5 pl-4 text-dim transition hover:border-violet hover:text-ink">{t}</a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-3xl">
          <S id="abstract" title="Abstract">
            <p>
              Autonomous machines — robots, GPU clusters, drones — generate more operating data than any asset class in history, yet none of it
              functions as financial evidence: it cannot be independently re-verified by the party writing the check. The consequence is a structural
              mispricing: good and bad machines pay the same premium and the same spread, and the asset class finances itself with equity instead of
              debt. Calibrum defines (i) <b>Proof of Operation (PoO)</b>, a hardware-signed, hash-chained receipt format for machine work, and (ii) the{" "}
              <b>Machine Risk Score (MRS)</b>, an auditable logistic scorecard mapping verified operating history to a 300–850 score with an exact,
              per-feature explanation. On a public run-to-failure benchmark, scored strictly out-of-machine, the riskiest 20% of machine-cycles
              captured {pc(v0.top20_capture)} of failures in the next 30 cycles (AUC {v0.auc.toFixed(2)}, KS {v0.ks.toFixed(2)}). We describe the
              method, its validation discipline, its documented mapping to insurance and credit terms, and the deliberately narrow role of a neutral
              ledger in the system.
            </p>
          </S>

          <S id="problem" title="1 · Infinite data, zero credit">
            <p>
              Two identical robots — same manufacturer, model, year, price. One has run 8,000 hours without incident; the other has collided three
              times and shut down unexpectedly four times last month. A bank quotes them roughly the same rate; an insurer quotes roughly the same
              premium. Not because the risks are believed equal — because there is no credible way to <b>prove</b> they differ: no evidence a
              counterparty can independently verify, no history that survives a change of owner, no score checkable in half a second from another
              continent.
            </p>
            <p>
              The law of finance this violates is simple: <b>unverifiable risk is expensive risk.</b> Where risk cannot be distinguished, everyone pays
              the worst credible price, careful operators subsidize careless ones, and lenders decline the collateral class entirely. Human finance
              solved this a century ago — credit bureaus, FICO, actuarial tables — machinery that converts behavioral history into cost of capital. No
              equivalent machinery exists for machines.
            </p>
          </S>

          <S id="distance" title="2 · Underwriting Distance">
            <p>
              Define the <b>Underwriting Distance</b> as the number of trusted intermediaries between a machine event and a capital decision. Today it
              is five or six: sensor → OEM cloud → operator report → broker summary → insurer evaluation → reinsurer pricing. Every node can edit the
              data, holds its own interests, uses its own format, and adds its own delay; none of it can be re-verified downstream. Each hop adds an
              uncertainty premium that the machine&apos;s owner ultimately pays.
            </p>
            <Formula label="The whole company in one line">
              lower verification cost → shorter underwriting distance → lower uncertainty → lower cost of machine capital
            </Formula>
            <p>
              Calibrum collapses the distance to approximately one: a machine-signed proof enters a published risk engine whose output any
              counterparty can recompute. The remainder of this document specifies the two components — the proof (§3) and the engine (§4–§7) — and
              the economics that connect them (§6).
            </p>
          </S>

          <S id="poo" title="3 · Proof of Operation">
            <p>
              A PoO receipt is a signed statement that a specific machine performed a specific unit of work under specific conditions:{" "}
              <code>machine_id</code> (a did:key carrying the machine&apos;s Ed25519 public key), epoch, timestamp, event, operating context
              (task class, operating seconds, energy, interventions, fault codes, firmware, environment severity), a risk snapshot, an attester, and{" "}
              <code>prev_hash</code>. Receipts are hash-chained per machine (SHA-256 over a canonical serialization) and batched into Merkle trees
              whose roots — and only the roots — are anchored on a neutral ledger. Raw telemetry stays encrypted off-chain, with the operator, where
              trade secrets belong.
            </p>
            <p>
              The chain gives an auditor concrete guarantees: editing a receipt breaks its hash and signature; deleting or reordering breaks the epoch
              sequence and the link; re-signing with the machine key repairs one receipt but visibly forks the chain and the Merkle root.
            </p>
            <p>
              <b>What a signature does not prove.</b> A valid signature proves the holder of the machine&apos;s key signed this content — not that the
              events happened. A compromised sensor signs garbage as happily as truth. PoO therefore treats the signature as the cheap first filter and
              defends meaning with three further layers: (1) <b>physics cross-checks</b> — energy against claimed hours, duty cycles against the
              calendar, individual histories against fleet distributions; faking one receipt is easy, faking a physically self-consistent multi-year
              history is expensive; (2) <b>adversarial financial outcomes</b> — claims and defaults are built-in audits that feed back into the score;
              an inflated history eventually surfaces as a loss; (3) <b>stake-and-slash</b> — attesting parties post collateral and provably false
              attestations are slashed (future work, §9). The full receipt schema, verifier semantics, and threat model — replay, split history, sybil
              attesters, OEM key compromise — are specified in <code>docs/poo-spec.md</code>; the reference implementation ships as an MIT-licensed
              package whose verifier logic is held at 100% test coverage.
            </p>
          </S>

          <S id="mrs" title="4 · The Machine Risk Score">
            <p>
              <b>Unit of scoring.</b> One machine at one point in time, using only its trailing window of history — no future information (verified by
              construction and by ablation, §5).
            </p>
            <p>
              <b>Event definition.</b> Failure within the next 30 operating cycles — the machine analogue of consumer credit&apos;s &quot;90+ days past
              due within 12 months&quot;. The event definition is the single most consequential line in the system: it defines what risk is being sold.
            </p>
            <p>
              <b>Features (43).</b> Cumulative operating cycles (age) plus three statistics over each of 14 informative sensor channels:
            </p>
            <Formula label="Feature construction — the credit-bureau triple, applied to telemetry">
              {`lvl_s  = mean(sensor, last 5 cycles)                    — current state (level)
trd_s  = lvl_s − mean(sensor, cycles t−19…t−15)         — degradation speed (trend)
vol_s  = std(sensor, last 10 cycles)                    — operating instability (volatility)`}
            </Formula>
            <p>
              <b>Model.</b> A standardized L2-regularized logistic regression — deliberately the most boring model in the toolbox, because every
              coefficient is auditable, monotone in its input, and defensible under regulatory questioning:
            </p>
            <Formula label="Scoring procedure (binding contract, mrs_model.json)">
              {`z_i    = (x_i − μ_i) / σ_i
logit  = β₀ + Σ β_i · z_i
p      = 1 / (1 + e^(−logit))                            — P(failure within 30 cycles)
odds   = (1 − p) / p
MRS    = clip( 600 + (40 / ln 2) · ln(odds / 15), 300, 850 )`}
            </Formula>
            <p>
              The scale follows the FICO convention: <b>PDO = 40</b> (each doubling of good:bad odds adds 40 points), anchored at 600 points for 15:1
              odds. Any practitioner can convert a score to a probability by inverting one line.
            </p>
            <p>
              <b>Interpretability is an identity, not an approximation.</b> Because the model is linear in z, the contribution of feature i is exactly{" "}
              <code>β_i·z_i</code>, and the 43 contributions sum to the logit. The product&apos;s &quot;why this changed&quot; panel displays the
              largest signed deltas between two states; their sum equals the log-odds change to machine precision. This is stronger than post-hoc
              attribution (SHAP approximates a black box; this is arithmetic).
            </p>
            <p>
              A cautionary example of conditional effects: the largest current weights are core-speed and turbine-temperature levels (+1.19, +1.18),
              while <code>hours</code> carries −1.01. Age is not protective — conditional on sensor state, a machine that reached high age with clean
              telemetry has revealed durability. Marginal correlation and conditional coefficients differ; this distinction is rehearsed here because
              it is the first question every actuary asks.
            </p>
          </S>

          <S id="results" title="5 · Empirical results">
            <p>
              All results below are on <b>NASA C-MAPSS</b>, a public physics-based run-to-failure simulation benchmark (turbofan degradation, 21 sensor
              channels). It validates the methodology — behavior → failure → score — not the market. Validation is strictly{" "}
              <b>out-of-machine</b>: holdout units are never seen in training.
            </p>
            <T
              head={["Cohort", "Machines", "Holdout rows", "AUC", "Gini", "KS", "Top-20% capture", "Top-10%"]}
              rows={[
                ["FD001 · 1 condition, 1 fault mode", v0.machines_train + v0.machines_holdout, v0.rows_holdout.toLocaleString(), v0.auc, v0.gini, v0.ks, pc(v0.top20_capture), pc(v0.top10_capture)],
                ["FD002 · 6 conditions", fd2.machines_train + fd2.machines_holdout, fd2.rows_holdout.toLocaleString(), fd2.auc, fd2.gini, fd2.ks, pc(fd2.top20_capture), pc(fd2.top10_capture)],
                ["FD004 · 6 conditions, 2 fault modes", fd4.machines_train + fd4.machines_holdout, fd4.rows_holdout.toLocaleString(), fd4.auc, fd4.gini, fd4.ks, pc(fd4.top20_capture), pc(fd4.top10_capture)],
              ]}
            />
            <p>
              <b>Reading the metrics.</b> <b>AUC</b> is the probability that a randomly chosen failing machine-cycle scores riskier than a surviving
              one — pure ranking power (0.5 = random). <b>Gini</b> = 2·AUC − 1, the credit-industry convention. <b>KS</b> is the maximum distance
              between the cumulative score distributions of good and bad outcomes — discrimination at the best single cutoff.{" "}
              <b>Top-20% capture</b> is the gains-curve statistic an underwriter actually uses: rank the fleet, examine the worst quintile, count the
              failures found there. <b>Calibration</b> — predicted versus observed failure rate by score decile — is reported separately in each
              cohort&apos;s report, because <b>discrimination sells and calibration prices</b>: premium adequacy depends on the predicted
              probabilities being right in level, not merely in order.
            </p>
            <p>
              <b>Leakage ablations.</b> Refitting on feature subsets bounds what the model could learn from a leaked clock: on FD001, machine age
              alone achieves AUC {v0.ablations.hours_only.auc.toFixed(2)} (capture {pc(v0.ablations.hours_only.cap20)}); sensors alone, with age
              removed, achieve AUC {v0.ablations.sensors_only.auc.toFixed(2)} (capture {pc(v0.ablations.sensors_only.cap20)}). The performance is
              degradation signal, not age.
            </p>
            <p>
              <b>Discounting the headline.</b> An AUC of 0.99 on a clean simulation should be read as an upper bound, not a promise. Consumer-credit
              scorecards run entire industries at AUC 0.75–0.80. We expect materially lower — and more credible — numbers on real-hardware cohorts
              (§8), and note that FD004&apos;s decline to {fd4.auc.toFixed(2)} under regime shift, with no regime normalization applied, is reported
              rather than tuned away: cross-cohort comparability of one simple method is the claim being defended.
            </p>
          </S>

          <S id="pricing" title="6 · From score to price">
            <p>
              MRS maps to indicative terms through documented, monotone functions — <b>illustrative placeholders until calibrated against a real
              claims and loan book with a design partner</b>, and labelled as such wherever they appear:
            </p>
            <Formula label="Financial mapping v0 (illustrative)">
              {`premium_rate   = 9.0% − (MRS/1000) · 7.5%        of asset value per year
max_LTV        = 25%  + (MRS/1000) · 55%
credit_spread  = (1200 − MRS) bps over SOFR
residual_value = 30%  + (MRS/1000) · 40%         of cost`}
            </Formula>
            <p>
              <b>Why pricing power is worth this much: adverse selection, quantified.</b> A Monte Carlo of {mc.years.toLocaleString()} insured years of
              an eight-machine book with a hidden hazard curve (SIMULATION — mechanism demonstration, not a real book) yields mean loss ratios of{" "}
              <b>{pc(mc.flat.mean_lr)}</b> for flat pricing (losing money in {pc(mc.flat.p_loss)} of years), <b>{pc(mc.mrs.mean_lr)}</b> for
              MRS-based pricing insuring everything, and <b>{pc(mc.mrs_select.mean_lr)}</b> for MRS pricing plus declining below a score floor
              (losing money in {pc(mc.mrs_select.p_loss)} of years). Half the value of a score is pricing; the other half is selection. Without
              verified history, the blind book is selected against by construction — the careful operator leaves, the careless one stays.
            </p>
          </S>

          <S id="governance" title="7 · Validation discipline & model governance">
            <p>
              <b>Current discipline.</b> Out-of-machine holdout (70/30 by unit); features constructed from trailing windows only; ablation bounds on
              age leakage; bit-for-bit reproducibility (<code>make backtest</code> retrains from raw download and reproduces the committed
              coefficients exactly); golden-vector parity tests pinning every scoring surface to the Python reference within 1e-6.
            </p>
            <p>
              <b>Champion/challenger roadmap.</b> The logistic scorecard is the champion — the filed, auditable model. Challengers are added for the
              measured value of complexity, each with a distinct statistical justification: <b>Cox proportional hazards</b> (semi-parametric survival;
              correctly uses censored observations the 30-cycle binary label discards), <b>accelerated failure time / gradient-boosted AFT</b>{" "}
              (non-linearity and interactions; outputs a remaining-life distribution), <b>random survival forests</b> (non-parametric regime
              partitioning — the natural candidate to recover FD002/FD004&apos;s multi-condition losses), and <b>Bayesian online updating</b>{" "}
              (posterior refresh per receipt, matching the product&apos;s score-per-operating-hour form). The champion–challenger AUC gap is itself
              governance evidence: it prices the opacity a regulator is asked to accept.
            </p>
            <p>
              <b>The regulatory bar the score must clear.</b> In U.S. practice a rating input succeeds when a carrier files it and demonstrates the
              statutory triple — rates not inadequate, not excessive, not unfairly discriminatory — with credible statistics, stability analysis, and
              actuarial sign-off under professional standards. Scores earn their way into pricing through exactly this path (wildfire and telematics
              scores are the precedents). Machines offer one structural simplification: there is no protected class, so the hardest fairness dimension
              of consumer scoring is absent by construction. Planned additions to match filing expectations: out-of-time validation, calibration
              scoring (Brier, reliability), decile-level premium-adequacy backtests, and population-stability monitoring.
            </p>
          </S>

          <S id="data" title="8 · Data roadmap">
            <T
              head={["Cohort", "Nature", "Status"]}
              rows={[
                ["NASA C-MAPSS FD001/002/004", "run-to-failure simulation benchmark", "trained & reported (§5)"],
                ["Backblaze Drive Stats", "300K+ real drives, daily SMART + failure labels — the large-scale real-hardware proof (proxy asset)", "pipeline complete; one command to run"],
                ["Production GPU cluster traces", "~1,800 nodes; event honestly defined as failure-burst proxy, not hardware death", "pipeline complete; one command to run"],
                ["Robot arms (NIST degradation, KUKA accelerated wear)", "small-N real robot hardware", "next"],
                ["Partner fleets via PoO", "signed field data with outcome linkage — the asset the network exists to create", "design-partner stage"],
              ]}
            />
            <p>
              Cohorts are deliberately <b>not merged</b> at v0. One engine, unchanged, across asset classes is the demonstration; a machine that
              switches cohorts switches contracts, with provenance on the label. The moat is not the algorithm — logistic regression has no moat — it
              is the evidence layer: standardized, signed, outcome-linked operating history across manufacturers, which no single carrier or OEM can
              assemble alone.
            </p>
          </S>

          <S id="network" title="9 · Network design & the role of the chain">
            <p>
              The ledger&apos;s role is narrow and justified only where six mutually distrustful parties — OEM, operator, insurer, lender, servicer,
              buyer — need one append-only record of identity, commitments, and state transitions. What goes on-chain: Merkle roots, counts,
              attester identities, timestamps. What never does: telemetry, receipts, or anything competitively sensitive. Settlement in stablecoins is
              an integration, not a thesis.
            </p>
            <p>
              A staking token, if ever introduced, does exactly one job: attesters post collateral and provably false attestations are slashed, making
              cheap claims expensive to fake — the missing defense against sybil attesters (§3). It is explicitly future work, gated on regulatory
              clarity, and the system is designed to be useful without it. <b>Never token-first.</b>
            </p>
          </S>

          <S id="positioning" title="10 · Positioning & precedents">
            <p>
              Calibrum is <b>pricing infrastructure, not a risk carrier</b>. The precedents are the data-and-scoring layers of existing insurance and
              credit markets — the analytics standards carriers price against and the bureaus lenders decide on — businesses that compound data
              network effects without holding underwriting risk, and that have historically commanded infrastructure economics rather than carrier
              economics. The insurtech generation that went full-stack demonstrated the alternative: technology multiples on the way up, carrier
              multiples after the first hard loss years.
            </p>
            <p>
              The wedge sequence follows from this: <b>rate</b> machines that incumbents already insure (carriers writing embodied-AI cover today name
              cross-manufacturer risk assessment as their public blocker — they are the first customers, not competitors); then <b>lend</b>, where the
              score prices LTV and residual curves; then <b>markets</b> — fleet financing structures and index licensing — once outcome data has
              seasoned. Each stage strictly deepens the evidence moat created by the previous one.
            </p>
          </S>

          <S id="limitations" title="11 · Limitations">
            <p>
              (1) C-MAPSS is simulated physics: it proves the pipeline, not the market; headline metrics will fall on field data, and should. (2)
              Pricing functions are uncalibrated placeholders until fitted to a real claims/loan book. (3) The 30-cycle binary label discards censored
              information; survival models address this (§7). (4) PoO v0.1 assumes hardware-bound keys; provisioning attestation inside secure
              elements is the most important unspecified component. (5) The GPU cohort&apos;s event is a node-health proxy that conflates hardware and
              software failure, stated on every output. (6) Physics envelopes are coarse constants pending fleet-derived distributions. (7) The
              demonstration economy (wallet, receipts, claims) is simulated and labelled; the model that scores it is the real trained artifact.
            </p>
            <p className="border-t border-line pt-4 text-[13px] text-dimmer">
              Reproducibility: <code>make backtest</code> · <code>make backtest-cohorts</code> · <code>make sim</code> · <code>make verify-poo</code>.
              Spec: <code>docs/poo-spec.md</code>. Slider-to-feature mapping: <code>docs/slider-mapping.md</code>. Trade-off log:{" "}
              <code>DECISIONS.md</code>.
            </p>
          </S>

          <div className="mt-8 flex gap-3">
            <Link href="/app/passport" className="rounded-lg bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet2">
              See it live →
            </Link>
            <Link href="/" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-dimmer">
              Back to overview
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
