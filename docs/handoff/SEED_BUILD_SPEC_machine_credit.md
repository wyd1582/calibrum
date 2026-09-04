# Machine Credit Network — Seed-Round Build Spec
### Prompts for an AI engineering team (Claude Code / Codex), with acceptance criteria

**How to use this document.** Each workstream below is a self-contained prompt: paste it into Claude Code (or Codex) inside the same repo, in order. WS-1 is the only one that matters if you can run just one — it produces the backtest chart that ends technical due diligence. Everything ships into one monorepo so the data room is a single link.

**The bar.** Two audiences must both be impressed: a YC-partner-type who asks "show me evidence the score predicts losses," and a crypto-fund engineer who asks "let me verify a receipt myself." WS-1/2 serve the first; WS-3 serves the second; WS-4/5 serve everyone's eyes.

**Non-negotiable guardrails (apply to every workstream):**
- Never present synthetic data as real. Every chart carries a data-source caption; simulated outputs are labeled "simulation."
- Every number in any investor-facing artifact must be reproducible by `make <target>` from a clean clone.
- No trademark soup: the only named concepts are Machine Risk Score (MRS), Proof of Operation (PoO), and Underwriting Distance.
- Prefer boring, auditable tech (Python/scikit-survival/lifelines, TypeScript, SQLite/Parquet) over impressive-sounding infra.

---

## WS-0 — Repo scaffold

```
PROMPT:
Create a monorepo `machine-credit` with this layout:

  /engine        # Python: MRS models, backtests
  /poo           # TypeScript: Proof of Operation spec + signer/verifier CLI
  /sim           # Python: fleet & underwriting simulation
  /demos         # static HTML demos (two files will be provided; wire them in)
  /site          # investor data-room static site (Astro or plain HTML)
  /paper         # technical whitepaper (markdown -> PDF via pandoc)
  /data          # gitignored; Makefile targets download public datasets

Requirements:
- Python 3.11+, uv or poetry; TS via pnpm. One top-level Makefile with targets:
  `make data-backblaze`, `make data-alibaba`, `make backtest`, `make sim`,
  `make site`, `make paper`, `make verify-poo`, `make all`.
- CI (GitHub Actions): lint + unit tests + a smoke backtest on a 1%
  data sample committed as a fixture, so CI never needs the full download.
- README that a VC's technical advisor can follow to reproduce the headline
  chart in under 30 minutes on a laptop.
- MIT license for /poo (it will be public); rest private.
```

**Accept when:** clean clone → `make all` runs end-to-end on sample fixtures without network access.

---

## WS-1 — MRS backtest engine on real fleet data (THE artifact)

```
PROMPT:
In /engine, build a survival-analysis pipeline that computes a Machine Risk
Score for real machines and proves it predicts failures out-of-sample.

DATA: Backblaze Drive Stats (daily SMART telemetry + failure labels,
2015-2024). Treat each drive as a "machine": model, age, power-on hours,
reallocated sectors, temperature, etc. This is a deliberate proxy — the
methodology, not the asset, is what we are validating. Say so in captions.

PIPELINE:
1. Ingest quarterly CSVs -> Parquet; per-drive daily panel.
2. Feature engineering at scoring date T: age, vendor/model, rolling SMART
   deltas (30/90d), utilization proxies. No leakage: features use data <= T only.
3. Models: (a) Cox proportional hazards baseline (lifelines),
   (b) gradient-boosted survival (scikit-survival GBSA or XGBoost-AFT).
4. Map 12-month survival probability to MRS on a 300-850 scale
   (calibrated, monotone; document the mapping function).
5. Temporal validation: score on Jan 1 of year Y using history < Y,
   observe failures during year Y. Repeat for >= 3 years.

OUTPUTS (all via `make backtest`, saved to /engine/out):
- lift_curve.png: % of failures captured vs % of fleet ranked by MRS,
  with random-ranking diagonal. Headline stat in the title, e.g.
  "Bottom-quintile MRS captured X% of next-12-month failures."
- calibration.png: predicted vs observed 12m failure rate by MRS decile.
- ks_gini.json: KS statistic, Gini/AUC per validation year.
- decile_table.csv: per-decile failure rate, mean MRS, count.
- A 2-page /engine/REPORT.md written for a non-ML investor: what was
  predicted, on how many machines, with what discipline against leakage.

QUALITY BAR: Gini >= 0.5 on holdout years or investigate before shipping;
document every modeling choice an actuary would question (censoring,
competing risks, cohort drift across drive generations).
```

**Accept when:** the lift curve regenerates from raw data with one command, and the REPORT.md survives this question: "how do I know you didn't leak the future into the features?"

---

## WS-2 — GPU asset extension (the wedge asset)

```
PROMPT:
In /engine/gpu, apply the WS-1 methodology to GPU infrastructure using the
Alibaba cluster GPU traces (v2020 and v2023; add v2026 if schema permits).

Since traces record jobs/utilization rather than hardware death, define the
insurable event honestly: task-failure bursts, node health degradation, or
sustained utilization collapse — justify the label choice in writing.

DELIVERABLES:
- gpu_risk_curves.png: failure/degradation hazard vs utilization band and
  node age; the "utilization-adjusted depreciation" story in one chart.
- collateral_note.md: a 3-page memo — "How a lender should haircut a
  GPU cluster": inputs, LTV formula sketch, worked example on trace data.
- Same reproducibility bar as WS-1.

FRAMING for the data room: "One engine, three asset classes: validated on
disk fleets, extended to GPU clusters, designed for robot fleets."
```

**Accept when:** a quant reading `collateral_note.md` can recompute the worked example by hand.

---

## WS-3 — Proof of Operation: spec + reference implementation (crypto credibility)

```
PROMPT:
In /poo, write the PoO v0.1 spec and a reference signer/verifier in TypeScript.

SPEC (poo-spec.md, ~10 pages):
- Receipt schema (CBOR + JSON views): machine_id (did:key), epoch, task class,
  operating seconds, energy_wh, interventions, fault_codes, fw_version,
  prev_receipt_hash (hash-chained per machine), sig (Ed25519, hardware-key).
- Merkle batching: N receipts -> root; anchoring interface is chain-agnostic
  (EVM contract stub + a mock anchor for tests).
- Threat model section: forged sensors, replay, split history, OEM key
  compromise, sybil attesters — and which layer answers each
  (physics cross-checks, outcome adversaries, stake/slash). Be explicit
  about what PoO does NOT prove (a signature proves the sensor said X).

REFERENCE IMPLEMENTATION:
- `poo sign` — simulate a machine day and emit signed receipts.
- `poo verify <file>` — verify signature, hash-chain continuity, and
  physics sanity checks (energy vs claimed hours within envelope);
  human-readable PASS/FAIL report per check.
- `poo tamper <file> --field energy_wh` — corrupt a receipt so reviewers
  can watch verification fail. This command is the demo.
- 100% test coverage on verifier logic; publish-ready README.

The goal: a crypto fund's engineer clones the repo, tampers a receipt,
watches `poo verify` catch it, and messages their partner "the primitive
is real."
```

**Accept when:** `make verify-poo` runs sign → tamper → verify and the tampered file fails with a specific, legible reason.

---

## WS-4 — Fleet simulation + underwriting sandbox API

```
PROMPT:
In /sim, build the simulation layer that powers demos and future pilots.

- Fleet generator: N machines with latent hazard params by class
  (AMR / humanoid / drone / GPU node), event streams (maintenance,
  collision, downtime) emitted as PoO receipts via the /poo library —
  so demo data and real data share one schema.
- MRS service: FastAPI app exposing POST /score (receipt history -> MRS,
  premium, LTV, spread, residual) using a distilled version of the WS-1
  model plus documented pricing functions. One endpoint, OpenAPI docs.
- Underwriting backtest: simulate an insurer book with flat pricing vs
  MRS pricing across 10k Monte Carlo years; output loss-ratio
  distributions chart (this replaces hand-tuned demo numbers with
  model-derived ones).
- Everything labeled SIMULATION in output metadata.
```

**Accept when:** the two HTML demos can (optionally) fetch live numbers from `POST /score` instead of inline constants, and the Monte Carlo chart reproduces the "flat pricing loses / scored pricing wins" result from first principles.

---

## WS-5 — Investor data-room site

```
PROMPT:
In /site, build a single static page (matching the deck's navy/violet
design system; Space Grotesk) with five sections:

1. The one-line thesis + Underwriting Distance diagram (from deck s.5).
2. EVIDENCE: the WS-1 lift curve, live-embedded, with reproduction
   instructions and a link to the repo.
3. PLAY: embed demo_two_robots.html and demo_underwriter_game.html
   (iframe or routed pages; files provided).
4. VERIFY: terminal-style block showing the `poo tamper` -> `poo verify`
   session, copy-pasteable commands.
5. READ: links to the founder essay and the WS-6 whitepaper PDF.

Deploy target: Vercel/Cloudflare Pages. No trackers, no login, loads < 1s.
This page IS the seed data room; every claim on it must be reproducible
from the repo.
```

**Accept when:** one URL demonstrates evidence → play → verify → read in under five minutes of a partner's attention.

---

## WS-6 — Technical whitepaper

```
PROMPT:
In /paper, assemble machine-credit-whitepaper-v0.md (-> PDF via pandoc,
15-20 pages), stitched from artifacts, not written fresh:

1. Underwriting Distance (from the essay, tightened to 2 pages)
2. PoO spec summary + threat model (from WS-3)
3. MRS methodology + backtest results (from WS-1 REPORT.md, charts inline)
4. Asset roadmap: disks -> GPU (WS-2) -> robots, with the four entry tests
5. Pricing functions and their calibration plan against real books
6. Network design: attester staking sketch, explicitly marked "future work,
   not day-one" — one page, no tokenomics tables
7. Honest limitations section: proxy-data caveats, cold-start plan,
   oracle-problem residual risk

Tone: Silicon Data / actuarial-note sobriety, not ICO whitepaper. Every
figure regenerable via make targets; figures carry dataset citations.
```

**Accept when:** an actuary and a protocol engineer can each read their half without cringing at the other half.

---

## Sequencing for the raise

| Week | Ship | Unlocks |
|---|---|---|
| 1-2 | WS-0 + WS-1 | The lift curve — begin partner conversations |
| 3 | WS-3 | Crypto-fund technical DD; open-source /poo for signal |
| 4 | WS-4 + WS-5 | Data-room URL in every follow-up email |
| 5 | WS-2 + WS-6 | GPU wedge memo for the "where's Y1 revenue" question; whitepaper for leads entering confirmatory DD |

**Division of labor:** the AI team writes every line of code above. The founder's irreplaceable work stays offline: signing the first data source, the design-partner insurer, and the credibility hire. Do not let the elegance of this repo substitute for those three signatures.
