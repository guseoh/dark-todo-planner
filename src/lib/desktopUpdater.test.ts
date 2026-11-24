import { describe, expect, it, vi } from "vitest";
import { createDesktopUpdater } from "./desktopUpdater";

const state = { installedVersion: "0.3.6", availableVersion: "0.3.7" };
describe("desktop updater coordinator", () => {
  it("shares concurrent checks and passes the approved version", async () => {
    const command = vi.fn(async () => state);
    const updater = createDesktopUpdater(command, async () => []);
    const first = updater.check();
    expect(updater.check()).toBe(first);
    await first;
    expect(command).toHaveBeenCalledTimes(1);
    await updater.install("0.3.7");
    expect(command).toHaveBeenLastCalledWith({checkNow: true, install: true, expectedVersion: "0.3.7"});
  });
  it("blocks installation if offline mutations remain or storage cannot be read", async () => {
    const command = vi.fn(async () => state);
    await expect(createDesktopUpdater(command, async () => [{}]).install("0.3.7")).rejects.toThrow("동기화");
    await expect(createDesktopUpdater(command, async () => { throw new Error("storage"); }).install("0.3.7")).rejects.toThrow("저장소");
    expect(command).not.toHaveBeenCalled();
  });
  it("rejects competing installs and releases the gate on failure", async () => {
    const command = vi.fn(async () => { throw new Error("network"); });
    const updater = createDesktopUpdater(command, async () => []);
    const first = updater.install("0.3.7");
    await expect(updater.install("0.3.7")).rejects.toThrow("진행 중");
    await expect(updater.check()).rejects.toThrow("진행 중");
    await expect(first).rejects.toThrow("network");
    command.mockResolvedValueOnce(state as never);
    await expect(updater.check()).resolves.toEqual(state);
  });
});
