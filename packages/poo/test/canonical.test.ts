import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/canonical.js";

describe("canonicalize", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalize({ b: 1, a: { d: [1, "x", null], c: undefined, e: true } })).toBe('{"a":{"d":[1,"x",null],"e":true},"b":1}');
  });
  it("handles primitives", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize("s\"q")).toBe('"s\\"q"');
    expect(canonicalize(false)).toBe("false");
    expect(canonicalize(1.5)).toBe("1.5");
  });
  it("rejects non-finite numbers and unsupported types", () => {
    expect(() => canonicalize(NaN)).toThrow(/non-finite/);
    expect(() => canonicalize(Infinity)).toThrow(/non-finite/);
    expect(() => canonicalize(() => 1)).toThrow(/unsupported/);
    expect(() => canonicalize(Symbol("x"))).toThrow(/unsupported/);
  });
  it("is order independent", () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });
});
