"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lockup } from "./Logo";

const TABS = [
  { href: "/app/passport", n: "01", label: "Passport" },
  { href: "/app/risk", n: "02", label: "Risk" },
  { href: "/app/finance", n: "03", label: "Finance" },
  { href: "/app/wallet", n: "04", label: "Wallet" },
  { href: "/app/verify", n: "05", label: "Verify" },
];

export function Nav() {
  const path = usePathname();
  const inApp = path.startsWith("/app");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-gauge/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
        <Lockup />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className={`rounded-md px-3 py-1.5 ${!inApp && !path.startsWith("/whitepaper") ? "bg-panel text-ink" : "text-dim hover:text-ink"}`}>
            Overview
          </Link>
          <Link href="/#evidence" className="rounded-md px-3 py-1.5 text-dim hover:text-ink">
            Evidence
          </Link>
          <Link href="/whitepaper" className={`rounded-md px-3 py-1.5 ${path.startsWith("/whitepaper") ? "bg-panel text-ink" : "text-dim hover:text-ink"}`}>
            Whitepaper
          </Link>
          <span className="mx-2 h-5 w-px bg-line" />
          {TABS.map((t) => {
            const active = path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`rounded-md px-3 py-1.5 tnum ${active ? "bg-panel text-ink" : "text-dim hover:text-ink"}`}>
                <span className="mr-1.5 text-xs text-dimmer">{t.n}</span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
