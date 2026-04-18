/**
 * Hashes an ArrayBuffer using the browser's native Web Crypto API.
 * This is used to verify the Walrus payload matches the Sui on-chain hash.
 */
export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
