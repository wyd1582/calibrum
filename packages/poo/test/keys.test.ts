import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode, didKeyFromPublicKey, generateKeyPair, publicKeyFromDidKey, sign, verifySignature } from "../src/keys.js";

describe("keys", () => {
  it("deterministic seed → same keypair; random otherwise", () => {
    const a = generateKeyPair("m1");
    const b = generateKeyPair("m1");
    expect(a.publicKey).toEqual(b.publicKey);
    expect(generateKeyPair().publicKey).not.toEqual(a.publicKey);
  });
  it("signs and verifies; rejects wrong key and garbage", () => {
    const kp = generateKeyPair("s");
    const msg = new Uint8Array(32).fill(7);
    const sig = sign(msg, kp.privateKey);
    expect(verifySignature(sig, msg, kp.publicKey)).toBe(true);
    expect(verifySignature(sig, msg, generateKeyPair("other").publicKey)).toBe(false);
    expect(verifySignature(new Uint8Array(3), msg, kp.publicKey)).toBe(false);
  });
  it("base58 round trips including leading zeros", () => {
    const bytes = new Uint8Array([0, 0, 1, 255, 42, 0, 9]);
    expect(base58Decode(base58Encode(bytes))).toEqual(bytes);
    expect(base58Encode(new Uint8Array([0, 0]))).toBe("11");
    expect(() => base58Decode("0OIl")).toThrow(/invalid character/);
  });
  it("did:key round trips and rejects malformed ids", () => {
    const kp = generateKeyPair("d");
    const did = didKeyFromPublicKey(kp.publicKey);
    expect(did.startsWith("did:key:z6Mk")).toBe(true);
    expect(publicKeyFromDidKey(did)).toEqual(kp.publicKey);
    expect(publicKeyFromDidKey("did:web:example.com")).toBeNull();
    expect(publicKeyFromDidKey("did:key:z0")).toBeNull();
    expect(publicKeyFromDidKey("did:key:z" + base58Encode(new Uint8Array([0xec, 0x01, ...new Array(32).fill(1)])))).toBeNull();
    expect(publicKeyFromDidKey("did:key:z" + base58Encode(new Uint8Array(10)))).toBeNull();
    expect(() => didKeyFromPublicKey(new Uint8Array(31))).toThrow(/32 bytes/);
  });
});
