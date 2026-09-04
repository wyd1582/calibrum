import { hexToBytes, receiptHash, bytesToHex } from "./hash.js";
import { sign } from "./keys.js";
import { GENESIS_HASH, POO_VERSION, type Receipt, type ReceiptBody } from "./types.js";

export type ReceiptInput = Omit<ReceiptBody, "version" | "prev_hash"> & { prev_hash?: string };

/**
 * Build a signed receipt. `prev_hash` defaults to the hash of `previous` (or GENESIS).
 * The signature is Ed25519 over the 32 hash bytes.
 */
export function createReceipt(input: ReceiptInput, privateKey: Uint8Array, previous?: Receipt | null): Receipt {
  const body: ReceiptBody = {
    version: POO_VERSION,
    ...input,
    prev_hash: input.prev_hash ?? previous?.hash ?? GENESIS_HASH,
  };
  const hash = receiptHash(body);
  const signature = bytesToHex(sign(hexToBytes(hash), privateKey));
  return { ...body, hash, signature };
}

/** Re-derive hash and signature for an (edited) receipt body. */
export function resignReceipt(r: Receipt | ReceiptBody, privateKey: Uint8Array): Receipt {
  const { hash: _h, signature: _s, ...body } = r as Receipt;
  const hash = receiptHash(body);
  return { ...(body as ReceiptBody), hash, signature: bytesToHex(sign(hexToBytes(hash), privateKey)) };
}
