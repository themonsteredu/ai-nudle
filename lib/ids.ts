export function createId(prefix = "item") {
  const runtimeCrypto = globalThis.crypto as Crypto & { randomUUID?: () => string };
  if (typeof runtimeCrypto?.randomUUID === "function") return runtimeCrypto.randomUUID();
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
