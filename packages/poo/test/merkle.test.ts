import { describe, expect, it } from "vitest";
import { merkleProof, merkleRoot, verifyMerkleProof } from "../src/merkle.js";
import { sha256Hex } from "../src/hash.js";

const leaves = Array.from({ length: 5 }, (_, i) => sha256Hex(new Uint8Array([i])));

describe("merkle", () => {
  it("single leaf root is the leaf", () => {
    expect(merkleRoot([leaves[0] as string])).toBe(leaves[0]);
  });
  it("root is deterministic and sensitive to order", () => {
    expect(merkleRoot(leaves)).toBe(merkleRoot(leaves));
    expect(merkleRoot(leaves)).not.toBe(merkleRoot([...leaves].reverse()));
  });
  it("rejects empty batches and bad leaves", () => {
    expect(() => merkleRoot([])).toThrow(/empty/);
    expect(() => merkleRoot(["zz"])).toThrow(/64-hex/);
    expect(() => merkleProof(leaves, 9)).toThrow(/out of range/);
  });
  it("proofs verify for every index (odd batch, duplicated last node)", () => {
    const root = merkleRoot(leaves);
    leaves.forEach((leaf, i) => {
      const proof = merkleProof(leaves, i);
      expect(verifyMerkleProof(leaf, proof, root)).toBe(true);
      expect(verifyMerkleProof(leaves[(i + 1) % leaves.length] as string, proof, root)).toBe(false);
    });
    expect(merkleProof([leaves[0] as string], 0)).toEqual([]);
  });
  it("rejects malformed proof input", () => {
    const root = merkleRoot(leaves);
    expect(verifyMerkleProof("nothex", [], root)).toBe(false);
    expect(verifyMerkleProof(leaves[0] as string, [{ hash: "bad", position: "left" }], root)).toBe(false);
    expect(verifyMerkleProof(leaves[0] as string, [], "bad")).toBe(false);
  });
});
