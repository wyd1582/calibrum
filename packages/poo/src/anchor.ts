import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { HEX64 } from "./hash.js";
import type { AnchorRecord } from "./types.js";

/**
 * Chain-agnostic anchor interface. An anchor commits a Merkle root (and the
 * number of receipts under it) to some neutral ledger and returns a reference
 * a third party can look up. Nothing about receipts themselves goes on-chain.
 */
export interface Anchor {
  readonly chain: string;
  anchor(root: string, count: number): Promise<AnchorRecord>;
  lookup(root: string): Promise<AnchorRecord | null>;
}

/** In-memory anchor for tests and demos. */
export class MockAnchor implements Anchor {
  readonly chain = "mock";
  private readonly store = new Map<string, AnchorRecord>();
  private seq = 0;
  constructor(private readonly now: () => Date = () => new Date()) {}

  async anchor(root: string, count: number): Promise<AnchorRecord> {
    if (!HEX64.test(root)) throw new Error("anchor: root must be 64-hex sha256");
    const rec: AnchorRecord = {
      chain: this.chain,
      root,
      count,
      anchored_at: this.now().toISOString(),
      ref: `mock:${(++this.seq).toString().padStart(6, "0")}`,
    };
    this.store.set(root, rec);
    return rec;
  }

  async lookup(root: string): Promise<AnchorRecord | null> {
    return this.store.get(root) ?? null;
  }
}

/** Minimal ABI helpers for the EVM stub (no ethers dependency). */
export function evmSelector(signature: string): string {
  return bytesToHex(keccak_256(utf8ToBytes(signature))).slice(0, 8);
}

export function encodeAnchorCalldata(root: string, count: number): string {
  if (!HEX64.test(root)) throw new Error("anchor: root must be 64-hex sha256");
  if (!Number.isInteger(count) || count < 0) throw new Error("anchor: count must be a non-negative integer");
  const selector = evmSelector("anchorRoot(bytes32,uint64)");
  const countWord = count.toString(16).padStart(64, "0");
  return `0x${selector}${root}${countWord}`;
}

export interface EvmTx {
  to: string;
  data: string;
  chainId: number;
}

/**
 * EVM anchor stub. Builds the calldata for `anchorRoot(bytes32 root, uint64 count)`
 * on a registry contract and hands it to an injected submitter (wallet/RPC).
 * With no submitter it records a dry-run reference — enough for tests and demos.
 * Contract source sketch lives in docs/poo-spec.md §6.
 */
export class EvmAnchorStub implements Anchor {
  readonly chain: string;
  private readonly seen = new Map<string, AnchorRecord>();

  constructor(
    private readonly opts: {
      chainId: number;
      contract: string;
      submit?: (tx: EvmTx) => Promise<string>;
      now?: () => Date;
    },
  ) {
    this.chain = `evm:${opts.chainId}`;
  }

  async anchor(root: string, count: number): Promise<AnchorRecord> {
    const tx: EvmTx = { to: this.opts.contract, data: encodeAnchorCalldata(root, count), chainId: this.opts.chainId };
    const ref = this.opts.submit ? await this.opts.submit(tx) : `dryrun:${tx.data.slice(0, 18)}`;
    const rec: AnchorRecord = { chain: this.chain, root, count, anchored_at: (this.opts.now ?? (() => new Date()))().toISOString(), ref };
    this.seen.set(root, rec);
    return rec;
  }

  async lookup(root: string): Promise<AnchorRecord | null> {
    return this.seen.get(root) ?? null;
  }
}
