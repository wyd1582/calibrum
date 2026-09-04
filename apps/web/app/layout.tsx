import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Calibrum | 衡准 — The financial standard for machines",
  description: "Proof of Operation → Machine Risk Score → Credit → Capital. Investor demo: passport, risk, finance, wallet, verify.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app-router root layout applies to every page */}
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Noto+Serif+SC:wght@900&display=swap" rel="stylesheet" />
        <link rel="icon" href="/brand/calibrum_mark_dark.svg" />
      </head>
      <body className="min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}
