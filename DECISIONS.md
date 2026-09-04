# DECISIONS.md — trade-offs the founder should read first

Each entry: what was asked, what shipped, why, and what unblocks the rest. Newest at the top.

## 2026-09-03 · Real-hardware cohorts (Backblaze, GPU, robot arms) are built but not run: egress policy

**Asked.** Task C: Backblaze Drive Stats (341K+ drives), a GPU fault/utilisation trace, NIST/KUKA robot cohorts, each regenerating charts via one make target.

**Shipped.** Two complete, tested pipelines — `engine/cohorts/backblaze.py` and `engine/cohorts/gpu_alibaba2020.py` — that self-fetch their data, build leakage-safe panels, fit the same scorecard as v0, and write the identical report format (lift, calibration, KS/Gini, ablations, REPORT.md, contract JSON, trajectory). Each has a `make backtest-*` target. CI exercises both end-to-end on **synthetic schema fixtures** that are labelled `SYNTHETIC SMOKE FIXTURE` in every output and are never copied into the app.

**Why not run.** The build session's outbound network policy allows GitHub raw content, npm and PyPI only. `f001.backblazeb2.com`, `aliopentrace.oss-cn-beijing.aliyuncs.com`, `data.nist.gov`, `zenodo.org`, Hugging Face and Kaggle all return proxy 403 (policy denial). Routing around an organisation policy is not something this build will do.

**Honesty consequence.** The headline evidence in the app and README is still the C-MAPSS **simulation** benchmark, and every caption says so. The "341K real machines" upgrade is one command away on a laptop with normal internet:

```
make backtest-backblaze     # ~2 GB of quarterly zips, ~20 min; writes engine/cohorts/out/backblaze/
make backtest-gpu           # Alibaba PAI 2020 machine metrics + instance table
```

then register the resulting `mrs_model.json` + `trajectory.json` in `apps/web/lib/contract/registry.ts` (three lines) and run `make sync-evidence`. Expect materially lower AUCs than 0.99 — that is the point.

**Robot cohorts.** NIST robot-arm degradation and KUKA KR16 wear datasets are behind the same policy; no pipeline was written blind because their schemas were not inspectable from here.

## 2026-09-03 · GPU event definition is a proxy, and says so

Alibaba PAI traces record jobs and utilisation, not hardware death. The cohort's event is an **instance-failure burst on a node after a quiet week** (≥ 3 failed instances in the next 7 days). It measures "this node is about to be a bad place to schedule work" — which is what a lender haircuts — and it conflates hardware faults with software failures landing on the node. The report, the metrics JSON (`event_definition_note`) and the dropdown label all say "failure-burst proxy". An InfiniteHBD-style real fault trace replaces this when accessible.

## 2026-09-03 · The v0 pipeline is ported unchanged; ablations live in a companion script

`engine/mrs_v0/run_mrs_v0.py` is byte-identical to the shipped file and reproduces the shipped `mrs_model.json` exactly (max coefficient diff 0.0). The shipped `metrics.json` and `REPORT.md` carried an ablation section the shipped script does not compute; `engine/mrs_v0/ablations.py` recomputes it (hours-only AUC 0.87, sensors-only 0.99) and merges it in, so `make backtest` regenerates outputs identical to the package. The cohort framework (`engine/lib/mrslib.py`) reproduces the v0 coefficients bit-for-bit on FD001 — asserted in `engine/tests/test_engine.py`.

## 2026-09-03 · Slider mapping uses a data-derived trajectory and a per-model scoring window

The playground sliders cannot be mapped to 43 turbofan sensor statistics by formula without inventing scoring logic. They instead position a synthetic machine on each cohort's **empirical degradation trajectory** (mean feature vector by normalised time-to-failure, exported by the engine) and the contract scores that vector. Because the v0 contract scores 850 for the first ~70 % of a C-MAPSS life and then drops to 300 within ~20 %, the sliders sweep a **scoring window** computed per model from its own trajectory. Full description in `docs/slider-mapping.md`; monotonicity and range are tested. The demo machine is synthetic and labelled; the contract is the real trained artefact.

## 2026-09-03 · The underwriter game's "~68 %" needs selection, not just pricing

Porting the game's Monte Carlo (`sim/`) shows: flat pricing averages a **157 %** loss ratio (the demo copy's ~156 %); MRS pricing while still insuring every machine averages **104 %**; MRS pricing **plus declining machines below MRS 550** averages **68 %** (the demo copy's ~68 %). The game lets the player pass, so the copy was right — but the mechanism is pricing *and* selection. The app and README quote all three numbers, from `sim/out/underwriting_mc.json`, not from memory.

## 2026-09-03 · `@calibrum/poo` is consumed from its compiled `dist/`

Next.js/Turbopack could not resolve the package's NodeNext-style `.js` import specifiers from TypeScript source. The package now builds itself on install (`prepare` script), and the app imports the compiled ESM + types. Consequence: after editing `packages/poo/src`, run `pnpm --filter @calibrum/poo build` before the app sees the change. The Verify tab and the CLI run the exact same verifier code.

## 2026-09-03 · `npm install && npm run dev` vs pnpm

The workspace is a pnpm workspace (`pnpm-workspace.yaml`) that also declares npm `workspaces`, with `link-workspace-packages=true` and a plain `"*"` dependency on `@calibrum/poo` so either package manager links it. `make dev` uses pnpm; `npm install && npm run dev` from the repo root also works. The lockfile is pnpm's.

## 2026-09-03 · Space Grotesk is loaded at runtime, not bundled

`next/font/google` downloads at build time and would make the build depend on Google's servers; the layout links the stylesheet instead, with a full system-font fallback stack. Numerals use `font-feature-settings: "tnum"`.

## 2026-09-03 · Branded concept discipline

Only Calibrum, Machine Risk Score (MRS), Proof of Operation (PoO), Underwriting Distance and Calibrum Passport appear as named concepts. The credit-pool tiers ("senior / mezzanine"), grade tiers ("Prime / Standard / Watch / Sub-standard / Decline") and physics envelopes are plain descriptive labels, not products.
