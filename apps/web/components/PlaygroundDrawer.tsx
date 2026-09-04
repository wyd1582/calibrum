"use client";
import { useMemo, useState } from "react";
import { useMachine } from "./MachineProvider";
import { Button, Illustrative, fmt, money } from "./ui";
import { SLIDER_RANGES, type Sliders } from "@/lib/contract/sliders";
import { assessSliders } from "@/lib/sim/machine";
import { attributionDelta, describeFeature } from "@/lib/contract/score";
import { MODELS } from "@/lib/contract/registry";

const KEYS = Object.keys(SLIDER_RANGES) as (keyof Sliders)[];

export function PlaygroundDrawer() {
  const { state, dispatch, a } = useMachine();
  const [open, setOpen] = useState(false);
  const [baseline, setBaseline] = useState<{ sliders: Sliders; modelId: string } | null>(null);
  const base = useMemo(() => (baseline ? assessSliders(baseline.modelId, baseline.sliders) : null), [baseline]);
  const deltas = useMemo(() => (base ? attributionDelta(base.result, a.result, 5) : []), [base, a]);
  const model = MODELS.find((m) => m.id === state.modelId);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setBaseline({ sliders: state.sliders, modelId: state.modelId });
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-violet bg-panel px-4 py-2.5 text-sm font-semibold text-ink shadow-lg hover:bg-panel2"
      >
        <span className="h-2 w-2 rounded-full bg-violet" /> Underwriting Playground
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setOpen(false)}>
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-gauge p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Underwriting Playground</h2>
                <p className="text-xs text-dim">Sliders map deterministically to the contract&apos;s 43 features (docs/slider-mapping.md) and reprice through the contract — never ad-hoc math.</p>
              </div>
              <Button tone="ghost" onClick={() => setOpen(false)}>
                ✕
              </Button>
            </div>
            <div className="mb-4 rounded-xl border border-line bg-panel px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider text-dim">Live MRS</span>
                <span className="tnum text-3xl font-bold" style={{ color: a.grade.color }}>
                  {a.mrs}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-dim">
                <div>
                  premium <b className="tnum text-ink">{money(a.offers.premiumAnnual)}</b>/yr
                </div>
                <div>
                  max LTV <b className="tnum text-ink">{Math.round(a.offers.maxLtv * 100)}%</b>
                </div>
                <div>
                  spread <b className="tnum text-ink">+{a.offers.spreadBps} bps</b>
                </div>
                <div>
                  residual <b className="tnum text-ink">{Math.round(a.offers.residualPct * 100)}%</b>
                </div>
                <div>
                  P(fail 30c) <b className="tnum text-ink">{(a.result.p * 100).toFixed(2)}%</b>
                </div>
                <div>
                  EL 12m <b className="tnum text-ink">{money(a.expectedLoss12m)}</b>
                </div>
              </div>
              <div className="mt-2">
                <Illustrative />
              </div>
            </div>
            <label className="mb-3 block text-xs text-dim">
              Model contract
              <select value={state.modelId} onChange={(e) => dispatch({ type: "set_model", modelId: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-ink">
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {model && <span className="mt-1 block text-[11px] text-dimmer">{model.provenanceNote}</span>}
            </label>
            <div className="space-y-3">
              {KEYS.map((k) => {
                const r = SLIDER_RANGES[k];
                return (
                  <div key={k} className="rounded-xl border border-line bg-panel px-3.5 py-2.5">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-dim">{r.label}</span>
                      <b className="tnum text-ink">
                        {k === "age" ? `${fmt(state.hours)} h` : `${state.sliders[k]}${r.unit}`}
                      </b>
                    </div>
                    <input type="range" min={r.min} max={r.max} value={state.sliders[k]} onChange={(e) => dispatch({ type: "set_slider", key: k, value: Number(e.target.value) })} />
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-xl border border-line bg-panel px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink">Why this changed</span>
                {base && (
                  <span className="tnum text-xs text-dim">
                    {base.mrs} → <b className="text-ink">{a.mrs}</b> since opening
                  </span>
                )}
              </div>
              {deltas.length === 0 || deltas.every((d) => Math.abs(d.delta) < 1e-9) ? (
                <p className="text-xs text-dimmer">Move a slider. The top five coef·z contribution changes appear here, signed (+ pushes toward failure).</p>
              ) : (
                <ul className="space-y-1.5">
                  {deltas.map((d) => (
                    <li key={d.feature} className="flex items-center justify-between text-xs">
                      <span className="text-dim">{describeFeature(d.feature)}</span>
                      <span className={`tnum font-semibold ${d.delta > 0 ? "text-bad" : "text-good"}`}>
                        {d.delta > 0 ? "+" : ""}
                        {d.delta.toFixed(2)} logit
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button tone="ghost" onClick={() => setBaseline({ sliders: state.sliders, modelId: state.modelId })}>
                reset baseline
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
