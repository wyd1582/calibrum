#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { MockAnchor } from "./anchor.js";
import { decodeBundle, encodeBundle, type BundleFormat } from "./io.js";
import { didKeyFromPublicKey, generateKeyPair } from "./keys.js";
import { bytesToHex } from "./hash.js";
import { simulateMachine } from "./simulate.js";
import { tamperBundle } from "./tamper.js";
import type { TaskClass } from "./types.js";
import { formatReport, verifyBundle } from "./verify.js";

const program = new Command();
program.name("poo").description("Proof of Operation v0.1 — sign, verify and tamper machine operating receipts").version("0.1.0");

program
  .command("keygen")
  .description("generate an Ed25519 machine keypair and its did:key")
  .option("--seed <seed>", "deterministic seed (demo only)")
  .action((o: { seed?: string }) => {
    const kp = generateKeyPair(o.seed);
    console.log(JSON.stringify({ machine_id: didKeyFromPublicKey(kp.publicKey), public_key: bytesToHex(kp.publicKey), private_key: bytesToHex(kp.privateKey) }, null, 2));
  });

program
  .command("sign")
  .description("simulate machine-days and emit Ed25519-signed, hash-chained receipts")
  .option("-d, --days <n>", "number of daily epochs", "7")
  .option("-s, --seed <n>", "deterministic seed", "7")
  .option("-t, --task <class>", "task class: amr_transport | humanoid_manipulation | drone_flight | gpu_training", "amr_transport")
  .option("-o, --out <file>", "output file (default: receipts.json)", "receipts.json")
  .option("-f, --format <fmt>", "json | cbor", "json")
  .option("--anchor", "anchor the Merkle root with the mock anchor")
  .action(async (o: { days: string; seed: string; task: string; out: string; format: string; anchor?: boolean }) => {
    const { bundle } = simulateMachine({ days: Number(o.days), seed: Number(o.seed), taskClass: o.task as TaskClass });
    if (o.anchor) bundle.anchor = await new MockAnchor().anchor(bundle.merkle_root as string, bundle.receipts.length);
    const fmt = o.format as BundleFormat;
    writeFileSync(o.out, encodeBundle(bundle, fmt));
    console.log(`wrote ${bundle.receipts.length} signed receipts for ${bundle.machine_id} → ${o.out} (${fmt})`);
    console.log(`merkle root ${bundle.merkle_root}`);
    console.log(bundle.provenance);
  });

program
  .command("verify")
  .description("verify signatures, chain continuity and physics envelope; print PASS/FAIL per link")
  .argument("<file>", "receipt bundle (json or cbor)")
  .option("--json", "emit the machine-readable report")
  .option("-v, --verbose", "print every check, not only failures")
  .option("--skip-physics", "skip physics envelope checks")
  .action((file: string, o: { json?: boolean; verbose?: boolean; skipPhysics?: boolean }) => {
    const bundle = decodeBundle(new Uint8Array(readFileSync(file)));
    const report = verifyBundle(bundle, { skipPhysics: o.skipPhysics });
    console.log(o.json ? JSON.stringify(report, null, 2) : formatReport(report, { verbose: o.verbose }));
    process.exitCode = report.ok ? 0 : 1;
  });

program
  .command("tamper")
  .description("corrupt one field of one receipt without re-signing, so verify can catch it")
  .argument("<file>", "receipt bundle (json or cbor)")
  .requiredOption("--field <path>", "dotted field path, e.g. context.energy_wh")
  .option("-i, --index <n>", "receipt index (default: middle of chain)")
  .option("--value <v>", "explicit replacement value (JSON)")
  .option("-o, --out <file>", "output file (default: <file>.tampered.<ext>)")
  .action((file: string, o: { field: string; index?: string; value?: string; out?: string }) => {
    const bytes = new Uint8Array(readFileSync(file));
    const bundle = decodeBundle(bytes);
    const fmt: BundleFormat = file.endsWith(".cbor") ? "cbor" : "json";
    const res = tamperBundle(bundle, { field: o.field, index: o.index !== undefined ? Number(o.index) : undefined, value: o.value !== undefined ? JSON.parse(o.value) : undefined });
    const out = o.out ?? file.replace(/(\.[^.]+)?$/, `.tampered$1`);
    writeFileSync(out, encodeBundle(res.bundle, fmt));
    console.log(`tampered ${res.description}`);
    console.log(`wrote ${out} — run: poo verify ${out}`);
  });

program.parseAsync(process.argv);
