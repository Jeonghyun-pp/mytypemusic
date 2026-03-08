import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock OpenAI before importing llm module
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = { completions: { create: mockCreate } };
    },
    __mockCreate: mockCreate,
  };
});

import { callGpt, callGptSafe, callGptJson, extractJson } from "../llm";

// Access the mock
async function getMockCreate() {
  const mod = await import("openai");
  return (mod as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;
}

function makeResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

beforeEach(async () => {
  const mockCreate = await getMockCreate();
  mockCreate.mockReset();
});

describe("extractJson", () => {
  it("strips markdown fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("handles bare JSON", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("strips fences without json label", () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe("callGpt", () => {
  it("returns text from OpenAI response", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeResponse("hello world"));

    const result = await callGpt("test prompt");
    expect(result).toBe("hello world");
  });

  it("passes model and temperature options", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeResponse("ok"));

    await callGpt("test", { model: "gpt-4o", temperature: 0.5 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        temperature: 0.5,
      }),
    );
  });

  it("includes system prompt when provided", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeResponse("ok"));

    await callGpt("test", { systemPrompt: "You are helpful" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "test" },
        ],
      }),
    );
  });

  it("returns empty string when response has no content", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce({ choices: [{ message: {} }] });

    const result = await callGpt("test");
    expect(result).toBe("");
  });
});

describe("callGptSafe", () => {
  it("retries on failure and succeeds", async () => {
    const mockCreate = await getMockCreate();
    // First call fails, second succeeds
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("temporary error"));
      return Promise.resolve(makeResponse("recovered"));
    });

    const result = await callGptSafe("test", { timeoutMs: 5000 });
    expect(result).toBe("recovered");
    expect(callCount).toBe(2);
  }, 10000);

  it("throws after all retries exhausted", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockImplementation(() => Promise.reject(new Error("persistent error")));

    await expect(callGptSafe("test", { timeoutMs: 1000 })).rejects.toThrow("persistent error");
    expect(mockCreate).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  }, 20000);

  it("times out slow calls", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockImplementation(() => new Promise(() => {})); // never resolves

    await expect(callGptSafe("test", { timeoutMs: 50 })).rejects.toThrow("timeout");
  }, 20000);
});

describe("callGptJson", () => {
  it("parses JSON response", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeResponse('{"name":"test","value":42}'));

    const result = await callGptJson<{ name: string; value: number }>("test");
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("handles markdown-wrapped JSON", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeResponse('```json\n{"ok":true}\n```'));

    const result = await callGptJson<{ ok: boolean }>("test");
    expect(result).toEqual({ ok: true });
  });

  it("throws on invalid JSON", async () => {
    const mockCreate = await getMockCreate();
    mockCreate.mockResolvedValueOnce(makeResponse("not json at all"));

    await expect(callGptJson("test")).rejects.toThrow();
  });
});
