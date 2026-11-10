import { describe, expect, it, vi } from "vitest";
import { recentCache } from "./recentCache";

describe("recentCache", () => {
  it("computes a key once while it stays cached", () => {
    const compute = vi.fn((n: number) => ({ n }));
    const get = recentCache(2, compute);
    expect(get(1)).toBe(get(1));
    expect(compute).toHaveBeenCalledOnce();
  });

  it("drops the least recently used key when full", () => {
    const compute = vi.fn((n: number) => n * 10);
    const get = recentCache(2, compute);
    get(1);
    get(2);
    get(1); // 2 is now the least recently used
    get(3); // drops 2
    compute.mockClear();
    get(1);
    get(3);
    expect(compute).not.toHaveBeenCalled();
    get(2);
    expect(compute).toHaveBeenCalledWith(2);
  });
});
