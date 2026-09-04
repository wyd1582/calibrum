/**
 * The MRS dial: the brand's calibration ring — a C of graduation ticks with one
 * violet "reading" tick at the score position. 300 sits at the bottom-right end
 * of the C, 850 at the top-right end; the reading travels clockwise.
 */
export function CalibrationRing({ score, size = 220, label, sub, color = "#8B7CF6" }: { score: number; size?: number; label?: string; sub?: string; color?: string }) {
  const f = Math.min(Math.max((score - 300) / 550, 0), 1);
  const start = 45; // degrees, screen coords (clockwise, 0 = +x)
  const sweep = 270;
  const reading = start + sweep * f;
  const ticks: { a: number; major: boolean }[] = [];
  for (let i = 0; i <= 30; i++) ticks.push({ a: start + (sweep * i) / 30, major: i % 5 === 0 });
  const R = 100;
  const pt = (deg: number, r: number) => {
    const t = (deg * Math.PI) / 180;
    return [128 + r * Math.cos(t), 128 + r * Math.sin(t)] as const;
  };
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label={`Machine Risk Score ${score}`}>
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {ticks.map((t, i) => {
        const [x1, y1] = pt(t.a, t.major ? R - 22 : R - 16);
        const [x2, y2] = pt(t.a, R);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.major ? "#EAF0FB" : "#3D5A8F"} strokeWidth={t.major ? 6 : 3.5} strokeLinecap="round" opacity={t.a <= reading ? 1 : 0.45} />;
      })}
      {(() => {
        const [x1, y1] = pt(reading, R - 30);
        const [x2, y2] = pt(reading, R + 6);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={7} strokeLinecap="round" filter="url(#glow)" />;
      })()}
      <text x="128" y="122" textAnchor="middle" fill="#EAF0FB" fontSize="54" fontWeight="700" fontFamily="'Space Grotesk', system-ui, sans-serif" style={{ fontVariantNumeric: "tabular-nums" }}>
        {Math.round(score)}
      </text>
      <text x="128" y="146" textAnchor="middle" fill="#8FA3C4" fontSize="11" letterSpacing="1.5" fontFamily="'Space Grotesk', system-ui, sans-serif">
        {label ?? "MACHINE RISK SCORE"}
      </text>
      {sub && (
        <text x="128" y="166" textAnchor="middle" fill={color} fontSize="13" fontWeight="600" fontFamily="'Space Grotesk', system-ui, sans-serif">
          {sub}
        </text>
      )}
    </svg>
  );
}
