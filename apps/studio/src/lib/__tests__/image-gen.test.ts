import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock both providers before import
vi.mock("openai", () => ({
  default: class {
    images = { generate: vi.fn() };
  },
}));

vi.mock("@fal-ai/client", () => ({
  fal: {
    config: vi.fn(),
    subscribe: vi.fn(),
  },
}));

import { getAvailableProviders } from "../image-gen";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("getAvailableProviders", () => {
  it("shows dalle available when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.FAL_KEY;

    const providers = getAvailableProviders();
    expect(providers).toEqual([
      { provider: "dalle", available: true },
      { provider: "flux-pro", available: false },
      { provider: "flux-schnell", available: false },
    ]);
  });

  it("shows all providers when both keys are set", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.FAL_KEY = "test-fal-key";

    const providers = getAvailableProviders();
    expect(providers.every((p) => p.available)).toBe(true);
  });

  it("shows nothing available when no keys set", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.FAL_KEY;

    const providers = getAvailableProviders();
    expect(providers.every((p) => !p.available)).toBe(true);
  });
});
