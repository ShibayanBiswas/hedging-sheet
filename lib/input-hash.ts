/** A short FNV-1a hash of the inputs, so two runs on the same inputs show the same code in the Debug Drawer. */
export function inputHash(inputs: unknown): string {
  const text = JSON.stringify(inputs, (_key, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").toUpperCase();
}
