"use client";
import { useState } from "react";
import { verifyBundle, formatReport, type VerificationReport } from "@calibrum/poo";
import { useMachine } from "@/components/MachineProvider";
import { Button, Chip, Panel, fmt } from "@/components/ui";
import { bundleOf } from "@/lib/sim/machine";

const TAMPER_FIELDS = [
  { field: "context.operating_seconds", label: "operating hours (×10)" },
  { field: "context.energy_wh", label: "energy drawn (×10)" },
  { field: "event", label: "event type" },
  { field: "risk_snapshot.mrs", label: "risk snapshot MRS" },
  { field: "prev_hash", label: "previous hash" },
  { field: "timestamp", label: "timestamp" },
];

export default function Verify() {
  const { state, dispatch } = useMachine();
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showText, setShowText] = useState(false);
  const bundle = bundleOf(state);
  const receipts = [...bundle.receipts].reverse();
  const stale = report !== null && report.receipts !== bundle.receipts.length;
  const runVerify = () => {
    setReport(verifyBundle(bundle));
    setExpanded(null);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Panel
        title="05 · Proof Ledger"
        sub={`${bundle.receipts.length} hash-chained receipts · Ed25519 signed by the machine key in machine_id · latest first`}
        right={
          state.tamper ? (
            <Chip color="#F87171">TAMPERED · {state.tamper.field}</Chip>
          ) : (
            <Chip color="#34D399">signed original</Chip>
          )
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Button tone="primary" onClick={runVerify}>
            Verify chain
          </Button>
          <select id="tamperField" className="rounded-lg border border-line bg-panel2 px-2 py-1.5 text-xs text-ink" defaultValue="context.energy_wh">
            {TAMPER_FIELDS.map((f) => (
              <option key={f.field} value={f.field}>
                {f.label}
              </option>
            ))}
          </select>
          <Button
            tone="danger"
            onClick={() => {
              const field = (document.getElementById("tamperField") as HTMLSelectElement).value;
              dispatch({ type: "tamper", field });
              setReport(null);
            }}
          >
            Tamper one receipt
          </Button>
          {state.tamper && (
            <Button
              onClick={() => {
                dispatch({ type: "restore" });
                setReport(null);
              }}
            >
              Restore original
            </Button>
          )}
          <Button tone="ghost" onClick={() => navigator.clipboard?.writeText(JSON.stringify(bundle, null, 2))}>
            Copy bundle JSON
          </Button>
        </div>
        {state.tamper && <p className="mb-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">Tampered {state.tamper.description}. Now click Verify chain.</p>}
        <ul className="max-h-[640px] space-y-1.5 overflow-y-auto pr-1">
          {receipts.map((r) => {
            const link = report?.links.find((l) => l.index === r.epoch);
            const isT = state.tamper?.index === r.epoch;
            return (
              <li key={r.receipt_id} className={`rounded-lg border px-3 py-2 text-xs ${isT ? "border-bad/60 bg-bad/5" : "border-line bg-panel2"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {link && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${link.ok ? "bg-good/20 text-good" : "bg-bad/20 text-bad"}`}>{link.ok ? "PASS" : "FAIL"}</span>}
                    <b className="text-violet">{r.event}</b>
                    <span className="text-dim">· {r.context.note}</span>
                  </span>
                  <span className="tnum font-mono text-[10.5px] text-dimmer">
                    #{r.epoch} · {new Date(r.timestamp).toISOString().slice(0, 10)}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-dimmer">
                  <span>receipt_id</span>
                  <span className="truncate text-dim">{r.receipt_id}</span>
                  <span>context</span>
                  <span className="truncate text-dim">
                    {r.context.task_class} · {fmt(r.context.operating_seconds / 3600, 1)} h · {fmt(r.context.energy_wh)} Wh · {r.context.interventions} interventions · fw {r.context.fw_version} · sev {r.context.env_severity.toFixed(2)}
                  </span>
                  <span>risk</span>
                  <span className="text-dim">
                    MRS {r.risk_snapshot.mrs} · p30 {r.risk_snapshot.p_fail_30} · {r.risk_snapshot.model}
                  </span>
                  <span>attester</span>
                  <span className="truncate text-dim">
                    {r.attester.kind} · {r.attester.id}
                  </span>
                  <span>prev_hash</span>
                  <span className="truncate text-dim">{r.prev_hash}</span>
                  <span>hash</span>
                  <span className="truncate text-cyan">{r.hash}</span>
                  <span>signature</span>
                  <span className="truncate text-dim">{r.signature}</span>
                </div>
                {link && !link.ok && (
                  <ul className="mt-2 space-y-0.5 border-t border-line pt-2">
                    {link.checks
                      .filter((c) => !c.ok)
                      .map((c) => (
                        <li key={c.name} className="text-[11px] text-bad">
                          ✕ {c.kind}/{c.name}: {c.detail}
                        </li>
                      ))}
                  </ul>
                )}
                {link && link.ok && (
                  <button type="button" onClick={() => setExpanded(expanded === r.epoch ? null : r.epoch)} className="mt-1 text-[10.5px] text-dimmer hover:text-ink">
                    {expanded === r.epoch ? "hide" : "show"} {link.checks.length} checks
                  </button>
                )}
                {expanded === r.epoch && link && (
                  <ul className="mt-1 space-y-0.5">
                    {link.checks.map((c) => (
                      <li key={c.name} className="text-[10.5px] text-good">
                        ✓ {c.kind}/{c.name}: {c.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      <div className="grid content-start gap-6">
        <Panel title="Verification result" sub="recomputes every hash, checks every link, verifies every signature against the did:key in machine_id, and runs the physics envelope">
          {!report ? (
            <p className="text-sm text-dim">
              Click <b className="text-ink">Verify chain</b>. Then click <b className="text-ink">Tamper one receipt</b> and verify again to watch a specific link fail with a specific reason.
            </p>
          ) : (
            <div>
              <div className={`rounded-xl border px-4 py-3 ${report.ok ? "border-good/50 bg-good/10" : "border-bad/50 bg-bad/10"}`}>
                <div className={`text-lg font-bold ${report.ok ? "text-good" : "text-bad"}`}>{report.ok ? "PASS — chain intact, signatures valid, physics consistent" : `FAIL — ${report.failed_checks} failed check(s)`}</div>
                <div className="tnum mt-1 text-xs text-dim">
                  {report.receipts} receipts · {report.links.filter((l) => l.ok).length} links pass · {report.links.filter((l) => !l.ok).length} fail · merkle root {report.computed_merkle_root?.slice(0, 16)}…
                </div>
                {stale && <div className="mt-1 text-[11px] text-amber">Ledger changed since this run — verify again.</div>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {report.links.map((l) => (
                  <span key={l.index} title={`#${l.epoch} ${l.ok ? "PASS" : "FAIL"}`} className={`h-3 w-3 rounded-sm ${l.ok ? "bg-good" : "bg-bad"}`} />
                ))}
              </div>
              <button type="button" onClick={() => setShowText((s) => !s)} className="mt-3 text-xs text-cyan hover:underline">
                {showText ? "hide" : "show"} CLI-style report
              </button>
              {showText && <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-gauge p-3 text-[10.5px] leading-relaxed text-dim">{formatReport(report)}</pre>}
            </div>
          )}
        </Panel>
        <Panel title="What a PASS proves — and does not" sub="from docs/poo-spec.md §8">
          <p className="text-xs text-dim">
            A valid signature proves the holder of the machine&apos;s private key signed exactly this body, in this order, with no gaps. It does <b className="text-ink">not</b> prove the events happened — a
            compromised sensor signs garbage as happily as truth. Three further layers give a receipt its meaning: physics cross-checks (energy vs claimed hours, run here), adversarial financial outcomes
            (claims and defaults feed back into the score), and stake-and-slash for attesters (future work, and the only job a token has).
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-gauge p-3 text-[11px] text-ink">{`# same primitive, from the command line
pnpm --filter @calibrum/poo poo sign -d 7 -o receipts.json
pnpm --filter @calibrum/poo poo tamper receipts.json --field context.energy_wh
pnpm --filter @calibrum/poo poo verify receipts.tampered.json   # RESULT: FAIL`}</pre>
          <p className="mt-2 text-[11px] text-dimmer">This tab is a thin UI over the same @calibrum/poo verifier the CLI uses; receipts are signed in-browser with a seeded demo key and labelled SIMULATED in the bundle.</p>
        </Panel>
      </div>
    </div>
  );
}
