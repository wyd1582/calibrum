import { simulateMachine, type ReceiptBundle, type KeyPair } from "../src/index.js";

export function fixture(days = 5, seed = 11): { bundle: ReceiptBundle; keys: KeyPair } {
  return simulateMachine({ days, seed });
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
