import { describe, expect, it } from "vitest";
import { EvmAnchorStub, MockAnchor, encodeAnchorCalldata, evmSelector } from "../src/anchor.js";

const root = "ab".repeat(32);

describe("anchors", () => {
  it("mock anchor stores and looks up", async () => {
    const a = new MockAnchor(() => new Date("2026-01-01T00:00:00Z"));
    const rec = await a.anchor(root, 3);
    expect(rec).toMatchObject({ chain: "mock", root, count: 3, anchored_at: "2026-01-01T00:00:00.000Z", ref: "mock:000001" });
    expect(await a.lookup(root)).toEqual(rec);
    expect(await a.lookup("cd".repeat(32))).toBeNull();
    await expect(a.anchor("bad", 1)).rejects.toThrow(/64-hex/);
  });
  it("encodes anchorRoot(bytes32,uint64) calldata", () => {
    expect(evmSelector("transfer(address,uint256)")).toBe("a9059cbb");
    const data = encodeAnchorCalldata(root, 7);
    expect(data).toBe(`0x${evmSelector("anchorRoot(bytes32,uint64)")}${root}${"0".repeat(63)}7`);
    expect(() => encodeAnchorCalldata("x", 1)).toThrow(/64-hex/);
    expect(() => encodeAnchorCalldata(root, -1)).toThrow(/non-negative/);
  });
  it("evm stub dry-runs without a submitter and uses one when given", async () => {
    const dry = new EvmAnchorStub({ chainId: 8453, contract: "0x" + "11".repeat(20), now: () => new Date(0) });
    const rec = await dry.anchor(root, 2);
    expect(rec.chain).toBe("evm:8453");
    expect(rec.ref.startsWith("dryrun:0x")).toBe(true);
    expect(await dry.lookup(root)).toEqual(rec);
    expect(await dry.lookup("00".repeat(32))).toBeNull();
    const seen: string[] = [];
    const live = new EvmAnchorStub({ chainId: 1, contract: "0x" + "22".repeat(20), submit: async (tx) => { seen.push(tx.data); return "0xtxhash"; } });
    const rec2 = await live.anchor(root, 2);
    expect(rec2.ref).toBe("0xtxhash");
    expect(seen).toHaveLength(1);
  });
});
