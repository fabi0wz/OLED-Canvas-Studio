/**
 * Generate a unique identifier with a given prefix.
 * Uses timestamp + random suffix to guarantee uniqueness.
 */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
