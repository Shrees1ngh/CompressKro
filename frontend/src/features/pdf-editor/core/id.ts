// ============================================================
// CompressKro PDF Editor — Unique ID Generator
// ============================================================
// Generates collision-resistant unique IDs for editor objects.
// Uses crypto.randomUUID() where available, falls back to a
// timestamp + random suffix approach.
// ============================================================

let counter = 0;

/**
 * Generates a unique ID string suitable for editor objects.
 * Format: `{prefix}-{uuid}` or `{prefix}-{timestamp}-{random}-{counter}`.
 *
 * @param prefix - Short prefix indicating the object type (e.g. 'txt', 'img', 'shp').
 * @returns A unique string ID.
 */
export function generateId(prefix: string = 'obj'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  // Fallback: timestamp + random + monotonic counter
  counter += 1;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}-${counter}`;
}

/**
 * Generates a batch of unique IDs.
 *
 * @param prefix - Short prefix.
 * @param count - Number of IDs to generate.
 * @returns Array of unique ID strings.
 */
export function generateIds(prefix: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateId(prefix));
  }
  return ids;
}
