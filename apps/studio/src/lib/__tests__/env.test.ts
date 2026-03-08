import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv } from "../env";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("validateEnv", () => {
  it("returns valid when required vars are set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.DATABASE_URL = "postgresql://localhost/test";

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns invalid when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.DATABASE_URL = "postgresql://localhost/test";

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("OPENAI_API_KEY");
  });

  it("returns invalid when DATABASE_URL is missing", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.DATABASE_URL;

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("DATABASE_URL");
  });

  it("lists optional vars as warnings", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.DATABASE_URL = "postgresql://localhost/test";
    delete process.env.FAL_KEY;
    delete process.env.CRON_SECRET;

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("FAL_KEY");
    expect(result.warnings).toContain("CRON_SECRET");
  });
});
