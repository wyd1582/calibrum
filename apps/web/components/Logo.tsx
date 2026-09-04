import Link from "next/link";

export function Mark({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/calibrum_mark_dark.svg" width={size} height={size} alt="Calibrum calibration ring" style={{ width: size, height: size }} />;
}

export function Lockup({ size = 28, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 no-underline">
      <Mark size={size} />
      <span className="font-bold tracking-wide text-ink" style={{ fontSize: size * 0.68 }}>
        CALIBRUM
      </span>
      <span className="font-black text-violet" style={{ fontFamily: "'Noto Serif SC', serif", fontSize: size * 0.62 }}>
        衡准
      </span>
    </Link>
  );
}
