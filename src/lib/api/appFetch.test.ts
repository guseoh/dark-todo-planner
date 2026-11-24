import { describe, expect, it } from "vitest";
import { waitForNativeRead } from "./appFetch";

describe("native read cancellation", () => {
  it("settles immediately when the renderer cancels a read", async () => {
    const controller = new AbortController();
    let finish!: (value: string) => void;
    const native = new Promise<string>(resolve => { finish = resolve; });
    const read = waitForNativeRead(native, controller.signal);
    controller.abort();
    await expect(read).rejects.toMatchObject({ name: "AbortError" });
    finish("late result");
    await expect(native).resolves.toBe("late result");
  });
  it("preserves a successful response and native errors", async () => {
    const controller = new AbortController();
    await expect(waitForNativeRead(Promise.resolve("ok"), controller.signal)).resolves.toBe("ok");
    await expect(waitForNativeRead(Promise.reject(new Error("offline")), controller.signal)).rejects.toThrow("offline");
  });
});
