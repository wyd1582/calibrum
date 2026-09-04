"use client";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart, Scatter, ScatterChart, ZAxis, CartesianGrid } from "recharts";

const AX = { stroke: "#5B6E92", fontSize: 11 };
const TT = { contentStyle: { background: "#0E1830", border: "1px solid #24365A", borderRadius: 10, fontSize: 12, color: "#EAF0FB" }, labelStyle: { color: "#8FA3C4" } };

export function ScoreHistory({ data }: { data: { step: number; mrs: number; event: string; label: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#1B2B4D" vertical={false} />
        <XAxis dataKey="step" tick={AX} axisLine={{ stroke: "#24365A" }} tickLine={false} />
        <YAxis domain={[300, 850]} tick={AX} axisLine={false} tickLine={false} ticks={[300, 450, 600, 750, 850]} />
        <Tooltip {...TT} formatter={(v) => [v, "MRS"]} labelFormatter={(l, p) => (p?.[0]?.payload as { label?: string })?.label ?? `step ${l}`} />
        <ReferenceLine y={700} stroke="#24365A" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="mrs" stroke="#38BDF8" strokeWidth={2.5} dot={(p) => {
          const { cx, cy, payload } = p as { cx: number; cy: number; payload: { event: string } };
          const c = payload.event === "incident" ? "#F87171" : payload.event === "maintenance" ? "#34D399" : payload.event === "operation" ? "#38BDF8" : "#8B7CF6";
          return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={payload.event === "slider" ? 2 : 4} fill={c} stroke="#0A1428" strokeWidth={1} />;
        }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProjectionChart({ data }: { data: { month: number; mrs: number; p: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="pfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0A05A" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#F0A05A" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1B2B4D" vertical={false} />
        <XAxis dataKey="month" tick={AX} axisLine={{ stroke: "#24365A" }} tickLine={false} tickFormatter={(m) => `${m}m`} />
        <YAxis tick={AX} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, (max: number) => Math.max(0.05, Math.ceil(max * 20) / 20)]} />
        <Tooltip {...TT} formatter={(v, n) => (n === "p" ? [`${((v as number) * 100).toFixed(2)}%`, "P(fail within next 30 cycles)"] : [v, n])} labelFormatter={(l) => `+${l} months, behaviour unchanged`} />
        <Area type="monotone" dataKey="p" stroke="#F0A05A" fill="url(#pfill)" strokeWidth={2.5} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PricingCurve({ current, series }: { current: number; series: { mrs: number; premium: number; ltv: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={series} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
        <CartesianGrid stroke="#1B2B4D" vertical={false} />
        <XAxis dataKey="mrs" tick={AX} axisLine={{ stroke: "#24365A" }} tickLine={false} type="number" domain={[300, 850]} ticks={[300, 450, 600, 750, 850]} />
        <YAxis yAxisId="l" tick={AX} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
        <YAxis yAxisId="r" orientation="right" tick={AX} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
        <Tooltip {...TT} formatter={(v, n) => (n === "premium" ? [`${Math.round(v as number).toLocaleString()} mUSDC/yr`, "premium"] : [`${(v as number).toFixed(0)}%`, "max LTV"])} labelFormatter={(l) => `MRS ${l}`} />
        <ReferenceLine x={current} yAxisId="l" stroke="#8B7CF6" strokeWidth={2} label={{ value: `now ${current}`, fill: "#8B7CF6", fontSize: 11, position: "top" }} />
        <Line yAxisId="l" type="monotone" dataKey="premium" stroke="#F0A05A" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line yAxisId="r" type="monotone" dataKey="ltv" stroke="#38BDF8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnomalyTimeline({ data }: { data: { step: number; hours: number; mrs: number; event: string; label: string; severity: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={150}>
      <ScatterChart margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#1B2B4D" />
        <XAxis dataKey="hours" name="verified hours" tick={AX} axisLine={{ stroke: "#24365A" }} tickLine={false} type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k h`} />
        <YAxis dataKey="mrs" tick={AX} axisLine={false} tickLine={false} domain={[300, 850]} ticks={[300, 600, 850]} />
        <ZAxis dataKey="severity" range={[30, 260]} />
        <Tooltip {...TT} cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n]} labelFormatter={() => ""} content={({ payload }) => {
          const p = payload?.[0]?.payload as { label: string; mrs: number; hours: number } | undefined;
          if (!p) return null;
          return <div style={TT.contentStyle}>{p.label} · MRS {p.mrs} · {p.hours.toLocaleString()} h</div>;
        }} />
        <Scatter data={data} shape={(p) => {
          const { cx, cy, payload } = p as { cx: number; cy: number; payload: { event: string; severity: number } };
          const c = payload.event === "incident" ? "#F87171" : payload.event === "maintenance" ? "#34D399" : payload.event === "operation" ? "#38BDF8" : "#8B7CF6";
          return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3 + payload.severity * 4} fill={c} fillOpacity={0.8} />;
        }} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
