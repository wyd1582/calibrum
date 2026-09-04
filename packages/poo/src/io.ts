import { Encoder } from "cbor-x";
import type { ReceiptBundle } from "./types.js";

export type BundleFormat = "json" | "cbor";

const cbor = new Encoder({ useRecords: false, mapsAsObjects: true, structuredClone: false });

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .filter((k) => o[k] !== undefined)
        .map((k) => [k, sortKeys(o[k])]),
    );
  }
  return v;
}

export function encodeBundle(bundle: ReceiptBundle, format: BundleFormat = "json"): Uint8Array {
  if (format === "cbor") return new Uint8Array(cbor.encode(sortKeys(bundle)));
  return new TextEncoder().encode(JSON.stringify(bundle, null, 2) + "\n");
}

export function detectFormat(bytes: Uint8Array): BundleFormat {
  // JSON bundles start with '{' (optionally after whitespace); anything else is CBOR.
  for (const b of bytes) {
    if (b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09) continue;
    return b === 0x7b ? "json" : "cbor";
  }
  return "json";
}

export function decodeBundle(bytes: Uint8Array, format?: BundleFormat): ReceiptBundle {
  const f = format ?? detectFormat(bytes);
  if (f === "cbor") return cbor.decode(bytes) as ReceiptBundle;
  return JSON.parse(new TextDecoder().decode(bytes)) as ReceiptBundle;
}
