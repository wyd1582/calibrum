import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/** Deterministic keypair from a seed string (demo only) or random if omitted. */
export function generateKeyPair(seed?: string): KeyPair {
  const privateKey = seed ? sha256(utf8ToBytes(`poo-seed:${seed}`)) : randomBytes(32);
  return { privateKey, publicKey: ed25519.getPublicKey(privateKey) };
}

export function sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function verifySignature(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// ---- did:key (Ed25519, multicodec 0xed01, base58btc "z" prefix) ----

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i] as number;
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] as number) << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i] as number];
  return out;
}

export function base58Decode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    const v = B58.indexOf(s[i] as string);
    if (v < 0) throw new Error(`base58: invalid character '${s[i]}'`);
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += (bytes[j] as number) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) out[zeros + i] = bytes[bytes.length - 1 - i] as number;
  return out;
}

const ED25519_MULTICODEC = [0xed, 0x01];

export function didKeyFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error("did:key: Ed25519 public key must be 32 bytes");
  const prefixed = new Uint8Array(2 + 32);
  prefixed.set(ED25519_MULTICODEC, 0);
  prefixed.set(publicKey, 2);
  return `did:key:z${base58Encode(prefixed)}`;
}

/** Returns the Ed25519 public key encoded in a did:key, or null if malformed. */
export function publicKeyFromDidKey(did: string): Uint8Array | null {
  if (!did.startsWith("did:key:z")) return null;
  let bytes: Uint8Array;
  try {
    bytes = base58Decode(did.slice("did:key:z".length));
  } catch {
    return null;
  }
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) return null;
  return bytes.slice(2);
}
