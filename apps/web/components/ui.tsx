import type { ReactNode } from "react";

export function Panel({ title, sub, children, className = "", right }: { title?: string; sub?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel/90 p-5 shadow-[0_15px_45px_rgba(0,0,0,.25)] ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ k, v, s, tone }: { k: string; v: ReactNode; s?: ReactNode; tone?: "good" | "bad" | "amber" | "cyan" | "violet" }) {
  const color = tone ? { good: "text-good", bad: "text-bad", amber: "text-amber", cyan: "text-cyan", violet: "text-violet" }[tone] : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-panel2 px-3.5 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-dim">{k}</div>
      <div className={`tnum mt-1 text-[21px] font-bold leading-tight ${color}`}>{v}</div>
      {s && <div className="mt-0.5 text-[11px] text-dimmer">{s}</div>}
    </div>
  );
}

export function Chip({ children, color = "#8B7CF6" }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: color, color }}>
      {children}
    </span>
  );
}

/** Mandatory label for every simulated number (handoff operating principle 1). */
export function Illustrative({ children = "Illustrative demo model · simulated" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-amber/60 bg-amber/10 px-2 py-0.5 text-[10.5px] font-medium text-amber">{children}</span>;
}

export function Button({ children, onClick, tone = "default", disabled, title }: { children: ReactNode; onClick?: () => void; tone?: "default" | "primary" | "warn" | "danger" | "ghost"; disabled?: boolean; title?: string }) {
  const cls = {
    default: "border-line bg-panel2 text-ink hover:border-dimmer",
    primary: "border-transparent bg-violet text-white hover:bg-violet2",
    warn: "border-amber/40 bg-amber/10 text-amber hover:bg-amber/20",
    danger: "border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
    ghost: "border-transparent bg-transparent text-dim hover:text-ink",
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`rounded-lg border px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

export const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const money = (n: number) => `${fmt(Math.round(n))} mUSDC`;
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
