import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { HEX64 } from "./hash.js";

export interface MerkleProofStep {
  hash: string;
  position: "left" | "right";
}

function parent(left: string, right: string): string {
  const buf = new Uint8Array(64);
  buf.set(hexToBytes(left), 0);
  buf.set(hexToBytes(right), 32);
  return bytesToHex(sha256(buf));
}

function assertLeaves(leaves: string[]): void {
  if (leaves.length === 0) throw new Error("merkle: empty batch has no root");
  for (const l of leaves) if (!HEX64.test(l)) throw new Error(`merkle: leaf is not a 64-hex sha256: ${l}`);
}

/** Binary Merkle root over sha256 leaves; odd levels duplicate the last node. */
export function merkleRoot(leaves: string[]): string {
  assertLeaves(leaves);
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i] as string;
      const r = (level[i + 1] ?? l) as string;
      next.push(parent(l, r));
    }
    level = next;
  }
  return level[0] as string;
}

export function merkleProof(leaves: string[], index: number): MerkleProofStep[] {
  assertLeaves(leaves);
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) throw new Error(`merkle: index ${index} out of range`);
  const proof: MerkleProofStep[] = [];
  let level = leaves.slice();
  let i = index;
  while (level.length > 1) {
    const sibling = i % 2 === 0 ? i + 1 : i - 1;
    const sib = (level[sibling] ?? level[i]) as string;
    proof.push({ hash: sib, position: i % 2 === 0 ? "right" : "left" });
    const next: string[] = [];
    for (let j = 0; j < level.length; j += 2) next.push(parent(level[j] as string, (level[j + 1] ?? level[j]) as string));
    level = next;
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyMerkleProof(leaf: string, proof: MerkleProofStep[], root: string): boolean {
  if (!HEX64.test(leaf) || !HEX64.test(root)) return false;
  let h = leaf;
  for (const step of proof) {
    if (!HEX64.test(step.hash)) return false;
    h = step.position === "right" ? parent(h, step.hash) : parent(step.hash, h);
  }
  return h === root;
}
