/**
 * Canonical JSON: deterministic serialisation used for hashing.
 * Rules: object keys sorted (code-point order) recursively, no whitespace,
 * arrays preserved in order, `undefined` properties dropped, non-finite numbers
 * rejected (they have no JSON representation and would silently become null).
 */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error(`canonicalize: non-finite number ${value}`);
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canonicalize(v)).join(",")}]`;
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
    }
    default:
      throw new Error(`canonicalize: unsupported type ${typeof value}`);
  }
}
