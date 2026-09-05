import Link from "next/link";
import metricsV0 from "../../../engine/mrs_v0/out/metrics.json";
import mc from "../../../sim/out/underwriting_mc.json";
import { CalibrationRing } from "@/components/CalibrationRing";

const CAP =
  "Data: NASA C-MAPSS FD001 physics-based degradation simulation benchmark — methodology validation, not market data. Model: logistic scorecard, out-of-machine holdout (units 71–100).";

function Eyebrow({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet">
      {n && <span className="mr-3 text-dimmer">{n}</span>}
      {children}
    </p>
  );
}

function Distance({ label, nodes, tone, note }: { label: string; nodes: string[]; tone: "amber" | "cyan"; note: string }) {
  const c = tone === "amber" ? "border-amber/40 text-amber" : "border-cyan/50 text-cyan";
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className={`mb-4 inline-flex rounded-full border px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] ${c}`}>{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {nodes.map((nd, i) => (
          <span key={nd} className="flex items-center gap-2">
            <span className="rounded-lg border border-line bg-panel2 px-3 py-2 text-[12.5px] text-ink">{nd}</span>
            {i < nodes.length - 1 && <span className="text-dimmer">→</span>}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-dim">{note}</p>
    </div>
  );
}

export default function Landing() {
  const m = metricsV0;
  return (
    <main className="mx-auto max-w-7xl px-6 pb-28">
      {/* ============ HERO ============ */}
      <section className="grid items-center gap-12 py-24 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Eyebrow>The financial standard for machines · 衡准</Eyebrow>
          <h1 className="mt-5 text-[52px] font-bold leading-[1.02] tracking-tight md:text-[68px]">
            The next billion borrowers may not be human.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-dim">
            Calibrum turns hardware-signed operating evidence into a portable <b className="text-ink">Machine Risk Score</b> that insurers, lenders, and
            lessors price against. One score. Every counterparty. Independently verifiable.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/app/passport" className="rounded-lg bg-violet px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet2">
              Explore a live passport →
            </Link>
            <Link href="/whitepaper" className="rounded-lg border border-line px-6 py-3 text-sm font-semibold text-ink transition hover:border-dimmer">
              Read the whitepaper
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-2.5 text-[13px]">
            {["Telemetry", "Proof", "Reputation", "Capital"].map((s, i) => (
              <span key={s} className="flex items-center gap-2.5">
                <span className={`rounded-full border px-4 py-1.5 ${i === 3 ? "border-violet bg-violet/10 text-ink" : "border-line text-dim"}`}>{s}</span>
                {i < 3 && <span className="text-dimmer">→</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="grid justify-items-center gap-5">
          <div className="rounded-3xl border border-line bg-panel/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,.35)]">
            <div className="flex items-center justify-between gap-8 text-[10.5px] font-semibold uppercase tracking-[0.2em]">
              <span className="text-dim">Live reading</span>
              <span className="flex items-center gap-1.5 text-good">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" /> Verified
              </span>
            </div>
            <CalibrationRing score={787} size={250} sub="PRIME" color="#34D399" />
            <div className="grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              {[
                ["7,431", "verified hours"],
                ["0", "open incidents"],
                ["3.1%", "premium quote"],
              ].map(([v, k]) => (
                <div key={k}>
                  <div className="tnum text-lg font-bold text-ink">{v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-dimmer">{k}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel px-5 py-3.5">
            <span className="tnum text-3xl font-bold text-cyan">{Math.round(m.top20_capture * 100)}%</span>
            <span className="max-w-[240px] text-xs leading-snug text-dim">
              of upcoming failures captured by the riskiest 20% of machine-cycles · AUC {m.auc.toFixed(2)} <span className="text-dimmer">(benchmark)</span>
            </span>
          </div>
        </div>
      </section>

      {/* ============ MARKET BAND ============ */}
      <section className="grid gap-4 rounded-3xl border border-line bg-panel/60 p-8 md:grid-cols-3">
        {[
          ["$100B+/yr", "of robots, GPU clusters and drones deployed — financed almost entirely with equity, because their risk cannot be underwritten"],
          ["5–6 parties", "sit between a machine event and a capital decision today; none can be independently re-verified by the party writing the check"],
          ["1 number", "an insurer, a lender and a buyer on three continents can all verify: the Machine Risk Score, 300–850"],
        ].map(([v, k]) => (
          <div key={k as string} className="border-line px-2 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-2">
            <div className="tnum text-4xl font-bold text-ink">{v}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-dim">{k}</p>
          </div>
        ))}
        <p className="col-span-full text-[10.5px] text-dimmer">Directional public estimates — sourcing and method in the whitepaper. Every simulated figure on this site is labelled.</p>
      </section>

      {/* ============ 01 ECONOMICS ============ */}
      <section className="py-24">
        <Eyebrow n="01">The economics</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight">Shorter underwriting distance lowers the cost of machine capital.</h2>
        <p className="mt-4 max-w-2xl text-dim">
          Unverifiable risk is expensive risk. When an underwriter cannot distinguish the good machine from the bad one, both pay the bad machine&apos;s
          price — and machines consume equity instead of attracting debt.
        </p>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Distance
            label="Today · distance ≈ 6"
            tone="amber"
            nodes={["Sensor", "OEM cloud", "Operator", "Broker", "Insurer", "Reinsurer"]}
            note="Six private interpretations. Every node can edit the data, has its own interests, and adds its own delay. Nothing survives a change of owner."
          />
          <Distance
            label="With Calibrum · distance ≈ 1"
            tone="cyan"
            nodes={["Machine-signed proof", "Risk engine", "Capital decision"]}
            note="One independently verifiable evidence path. Lower verification cost → shorter underwriting distance → lower uncertainty → lower cost of machine capital."
          />
        </div>
      </section>

      {/* ============ 02 PRODUCT ============ */}
      <section className="py-8">
        <Eyebrow n="02">The Calibrum Passport</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight">One machine. One verifiable financial history.</h2>
        <div className="mt-10 grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-line bg-panel p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-dim">Calibrum Passport</div>
                <div className="mt-1 text-lg font-bold">AMR · A7-2049</div>
                <div className="text-xs text-dimmer">Warehouse fleet · Columbus, Ohio</div>
              </div>
              <span className="rounded-full border border-good/50 px-2.5 py-0.5 text-[10.5px] font-semibold text-good">GRADE A · PRIME</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                ["782", "MRS"],
                ["8,000", "verified h"],
                ["0", "incidents"],
                ["$52k", "residual"],
              ].map(([v, k]) => (
                <div key={k} className="rounded-xl border border-line bg-panel2 py-2.5">
                  <div className="tnum text-base font-bold text-ink">{v}</div>
                  <div className="text-[9.5px] uppercase tracking-wider text-dimmer">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-line bg-panel2 px-4 py-3 text-xs">
              <div className="flex justify-between">
                <span className="text-dim">Latest signed event</span>
                <span className="font-mono text-[10px] text-dimmer">SHA-256 · chain intact</span>
              </div>
              <div className="mt-1 text-ink">Preventive maintenance completed · firmware 7.3.1 · receipt #214</div>
            </div>
            <p className="mt-3 text-[10.5px] text-dimmer">Illustrative passport. Raw telemetry stays encrypted off-chain; the passport carries proofs, permissions, and financial state.</p>
          </div>
          <div>
            <ul className="space-y-3 text-sm">
              {[
                ["01 Passport", "identity, verified hours, incidents, residual value — the MRS dial as a calibration ring"],
                ["02 Risk", "failure probability, expected loss, and a signed why-this-changed attribution that sums exactly"],
                ["03 Finance", "insurer premium, lender LTV and rate, credit-pool availability — repriced live from the score"],
                ["04 Wallet", "run, maintain, insure, borrow, settle — every action emits a signed receipt"],
                ["05 Verify", "recompute every hash, link and signature yourself; tamper one field and watch it fail"],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4 rounded-xl border border-line bg-panel/60 px-4 py-3">
                  <span className="w-24 shrink-0 font-semibold text-violet">{t}</span>
                  <span className="text-dim">{d}</span>
                </li>
              ))}
            </ul>
            <Link href="/app/passport" className="mt-5 inline-block rounded-lg bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet2">
              Open the live product →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 03 EVIDENCE ============ */}
      <section id="evidence" className="scroll-mt-24 py-24">
        <Eyebrow n="03">Reproducible model evidence</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight">A simple scorecard sees failure before it happens.</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-end gap-4">
              <span className="tnum text-[84px] font-bold leading-none text-cyan">{m.auc.toFixed(2)}</span>
              <div className="pb-3">
                <div className="text-sm font-semibold text-ink">holdout AUC</div>
                <div className="text-xs text-dim">{m.machines_holdout} machines never seen in training</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                ["KS", m.ks.toFixed(2)],
                ["Gini", m.gini.toFixed(2)],
                ["Top-20% capture", `${Math.round(m.top20_capture * 100)}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-panel px-4 py-3">
                  <div className="tnum text-xl font-bold text-ink">{v}</div>
                  <div className="text-[10.5px] uppercase tracking-wider text-dim">{k}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-dim">
              A deliberately boring model — a standardized logistic scorecard, the kind that survives audit — validated{" "}
              <b className="text-ink">out-of-machine</b> on a physics-based benchmark. Ablations prove the signal is degradation telemetry, not a leaked
              clock. The same engine, unchanged, runs three cohorts of increasing difficulty; real-hardware cohorts are next.
            </p>
            <div className="mt-6 rounded-xl border border-line bg-gauge p-4">
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-dim">Reproduce the headline · one command</div>
              <code className="text-[13px] text-cyan">make backtest</code>
            </div>
            <Link href="/whitepaper#results" className="mt-5 inline-block text-sm font-semibold text-violet hover:underline">
              Full methodology, metrics and ablations → whitepaper §5
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["/evidence/lift_curve.png", "Failure capture"],
              ["/evidence/score_distribution.png", "Score separation"],
              ["/evidence/calibration.png", "Calibration"],
              ["/evidence/finance_mapping.png", "Finance mapping"],
            ].map(([src, t]) => (
              <figure key={src} className="overflow-hidden rounded-2xl border border-line bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={t} className="w-full" />
                <figcaption className="px-3 py-2 text-[11px] font-semibold text-ink">{t}</figcaption>
              </figure>
            ))}
            <p className="col-span-2 text-[10.5px] leading-relaxed text-dimmer">{CAP}</p>
          </div>
        </div>
      </section>

      {/* ============ 04 WHY NOW ============ */}
      <section className="py-8">
        <Eyebrow n="04">Why now</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight">The machine economy got wallets before it got credit.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [
              "Insurers are already at the wall",
              "Embodied-AI policies are live in the fastest-moving markets; carriers name the blocker publicly: data barriers, and no credible way to assess risk across manufacturers. The product exists. The pricing infrastructure does not.",
            ],
            [
              "Identity and payments shipped",
              "On-chain agent identity and machine-payment rails with stablecoin settlement are live, built by others at their expense. Neither answers the only question capital asks: what should this machine pay to be insured, and what can it borrow?",
            ],
            [
              "The capital wave is here",
              "Robots and AI compute are absorbing capital at a pace the financing stack was never built for. Every basis point off the cost of machine capital compounds into more machines deployed.",
            ],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-panel p-6">
              <h3 className="text-[15px] font-bold text-ink">{t}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-dim">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 rounded-2xl border border-line bg-panel/60 p-6 md:grid-cols-3">
          {[
            ["flat pricing", mc.flat.mean_lr, "the blind book — loses money most years"],
            ["MRS pricing", mc.mrs.mean_lr, "same claims, evidence-based premiums"],
            ["MRS + selection", mc.mrs_select.mean_lr, "price and decline below the floor"],
          ].map(([k, lr, d], i) => (
            <div key={k as string} className="text-center">
              <div className={`tnum text-4xl font-bold ${i === 0 ? "text-amber" : i === 1 ? "text-cyan" : "text-good"}`}>{Math.round((lr as number) * 100)}%</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink">{k} · loss ratio</div>
              <div className="text-[11px] text-dimmer">{d}</div>
            </div>
          ))}
          <p className="col-span-full text-center text-[10.5px] text-dimmer">
            10,000 simulated insured years · SIMULATION with an invented hazard curve — demonstrates adverse selection, not any real book · regenerate with <code>make sim</code>
          </p>
        </div>
      </section>

      {/* ============ 05 LOOP + CLOSE ============ */}
      <section className="py-24 text-center">
        <Eyebrow n="05">The Calibrum loop</Eyebrow>
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3 text-sm">
          {["Proof of Operation", "Reputation", "Credit", "Capital"].map((s, i) => (
            <span key={s} className="flex items-center gap-3">
              <span className="rounded-full border border-line bg-panel px-5 py-2 text-ink">{s}</span>
              {i < 3 && <span className="text-violet">→</span>}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-5 max-w-xl text-sm text-dim">
          Lower verification cost creates better pricing. Better pricing deploys more machines. More machines create better outcome-linked evidence — a
          loop no single carrier can build alone.
        </p>
        <h2 className="mt-16 text-5xl font-bold tracking-tight md:text-6xl">Making machines bankable.</h2>
        <p className="mt-4 text-dim">Human finance took a century to turn behavioral history into cost of capital. Machines can sign their own.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/app/passport" className="rounded-lg bg-violet px-6 py-3 text-sm font-semibold text-white hover:bg-violet2">
            Explore the passport →
          </Link>
          <Link href="/whitepaper" className="rounded-lg border border-line px-6 py-3 text-sm font-semibold text-ink hover:border-dimmer">
            Whitepaper
          </Link>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-center text-[11px] leading-relaxed text-dimmer">
        Calibrum · 衡准 · The financial standard for machines. Calibrum provides risk analytics and verification infrastructure; it is not an insurer,
        lender, or broker, and nothing on this site is an offer of coverage, credit, or securities. Every score is computed by the published model
        contract; every simulated number is labelled.
      </footer>
    </main>
  );
}
