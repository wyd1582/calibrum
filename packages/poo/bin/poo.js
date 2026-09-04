#!/usr/bin/env node
// Thin launcher: prefers the compiled CLI, falls back to tsx for source checkouts.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist", "cli.js");
const src = join(here, "..", "src", "cli.ts");
if (existsSync(dist)) {
  await import(dist);
} else {
  const r = spawnSync("npx", ["tsx", src, ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
