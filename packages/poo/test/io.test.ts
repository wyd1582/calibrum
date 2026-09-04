import { describe, expect, it } from "vitest";
import { decodeBundle, detectFormat, encodeBundle } from "../src/io.js";
import { verifyBundle } from "../src/verify.js";
import { fixture } from "./helpers.js";

const { bundle } = fixture(3, 8);

describe("io", () => {
  it("json round trip", () => {
    const bytes = encodeBundle(bundle, "json");
    expect(detectFormat(bytes)).toBe("json");
    expect(decodeBundle(bytes)).toEqual(bundle);
  });
  it("cbor round trip verifies identically", () => {
    const bytes = encodeBundle(bundle, "cbor");
    expect(detectFormat(bytes)).toBe("cbor");
    const back = decodeBundle(bytes);
    expect(back.receipts.length).toBe(3);
    expect(verifyBundle(back).ok).toBe(true);
    expect(decodeBundle(bytes, "cbor").merkle_root).toBe(bundle.merkle_root);
  });
  it("detects json after leading whitespace and treats empty as json", () => {
    expect(detectFormat(new TextEncoder().encode("  \n{}"))).toBe("json");
    expect(detectFormat(new Uint8Array())).toBe("json");
  });
});
