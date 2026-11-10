// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showEnterScreen } from "./enterScreen";

describe("enter screen", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const settled = (promise: Promise<void>) => {
    let done = false;
    void promise.then(() => (done = true));
    return () => done;
  };

  it("with reduced motion, skips straight to the tabs and shows nothing", async () => {
    await showEnterScreen(document.body, true);
    expect(document.body.children).toHaveLength(0);
  });

  it("enters on the Enter key: dissolves first, then goes away", async () => {
    const isDone = settled(showEnterScreen(document.body, false));
    expect(document.querySelector(".enter-screen")).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.advanceTimersByTimeAsync(100);
    expect(isDone()).toBe(false); // still dissolving
    await vi.advanceTimersByTimeAsync(2000);
    expect(isDone()).toBe(true);
    expect(document.querySelector(".enter-screen")).toBeNull();
  });

  it("enters when its button is pressed, and ignores other keys", async () => {
    const isDone = settled(showEnterScreen(document.body, false));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(isDone()).toBe(false);

    document.querySelector<HTMLButtonElement>(".enter-screen button")!.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(isDone()).toBe(true);
  });
});
