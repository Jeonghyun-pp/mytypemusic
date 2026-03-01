/**
 * Current timestamp in ISO 8601 format.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Format a Date as YYYYMMDD string.
 */
export function yyyymmdd(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
