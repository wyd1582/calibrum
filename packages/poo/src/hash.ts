import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalize } from "./canonical.js";
import type { Receipt, ReceiptBody } from "./types.js";

export { bytesToHex, hexToBytes, utf8ToBytes };

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

/** Strip derived fields so the same object can be re-hashed after modification. */
export function receiptBody(r: Receipt | ReceiptBody): ReceiptBody {
  const { hash: _h, signature: _s, ...body } = r as Receipt;
  return body;
}

/** SHA-256 over canonical JSON of the receipt body (hash + signature excluded). */
export function receiptHash(r: Receipt | ReceiptBody): string {
  return sha256Hex(utf8ToBytes(canonicalize(receiptBody(r))));
}

export const HEX64 = /^[0-9a-f]{64}$/;
export const HEX128 = /^[0-9a-f]{128}$/;
