// ============================================================================
// Environment variable helpers for rewrite providers
// ============================================================================

export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}.\n` +
        `Set it before running the rewrite module (e.g. export ${key}=sk-...).`,
    );
  }
  return value;
}
