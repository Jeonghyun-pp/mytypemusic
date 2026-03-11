import { describe, it, expect } from "vitest";
import { cacheGet, cacheSet, cacheDel, cacheGetJSON, cacheSetJSON, isRedisConnected } from "../redis";

/**
 * Tests Redis module in fallback mode (no REDIS_URL set).
 * Verifies the in-memory fallback works correctly.
 */
describe("Redis cache (in-memory fallback)", () => {
  it("returns null for missing keys", async () => {
    const val = await cacheGet("nonexistent-key-" + Date.now());
    expect(val).toBeNull();
  });

  it("sets and gets a string value", async () => {
    const key = "test-string-" + Date.now();
    await cacheSet(key, "hello world");
    const val = await cacheGet(key);
    expect(val).toBe("hello world");
  });

  it("deletes a key", async () => {
    const key = "test-del-" + Date.now();
    await cacheSet(key, "to-delete");
    await cacheDel(key);
    const val = await cacheGet(key);
    expect(val).toBeNull();
  });

  it("sets and gets JSON values", async () => {
    const key = "test-json-" + Date.now();
    const data = { name: "test", items: [1, 2, 3], nested: { a: true } };
    await cacheSetJSON(key, data);
    const val = await cacheGetJSON<typeof data>(key);
    expect(val).toEqual(data);
  });

  it("respects TTL — value with positive TTL is accessible", async () => {
    const key = "test-ttl-" + Date.now();
    await cacheSet(key, "lives-for-a-bit", 60);
    const val = await cacheGet(key);
    expect(val).toBe("lives-for-a-bit");
  });

  it("reports Redis as not connected in fallback mode", () => {
    expect(isRedisConnected()).toBe(false);
  });

  it("handles cacheGetJSON returning null for invalid JSON", async () => {
    const key = "test-bad-json-" + Date.now();
    await cacheSet(key, "not-json{{{");
    const val = await cacheGetJSON(key);
    expect(val).toBeNull();
  });
});
