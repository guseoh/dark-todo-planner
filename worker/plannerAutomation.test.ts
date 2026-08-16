import { describe, expect, it } from "vitest";
import { runPlannerAutomations } from "./plannerAutomation";

type Call = { sql: string; bindings: unknown[] };

const database = (changes: number[]) => {
  const calls: Call[] = [];
  let index = 0;
  const DB = {
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          return {
            async run() {
              calls.push({ sql, bindings });
              const value = changes[index] ?? 0;
              index += 1;
              return { meta: { changes: value } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { DB, calls };
};

describe("planner automations", () => {
  it("carries only prior scheduled non-repeating Todos and sweeps completed Todos when enabled", async () => {
    const { DB, calls } = database([2, 3]);
    const result = await runPlannerAutomations({ DB }, "single-user", "2026-08-16", { carryOverEnabled: true, autoArchiveCompleted: true });

    expect(result).toMatchObject({ plannerDate: "2026-08-16", carriedOver: 2, autoArchived: 3 });
    expect(calls[0].sql).toContain("repeat = 'NONE'");
    expect(calls[0].sql).toContain("planning_state = 'SCHEDULED'");
    expect(calls[0].sql).toContain("date < ?");
    expect(calls[0].bindings.at(-1)).toBe("2026-08-16");
    expect(calls[1].sql).toContain("completed = 1 AND archived = 0");
  });

  it("does nothing when both automations are disabled", async () => {
    const { DB, calls } = database([]);
    const result = await runPlannerAutomations({ DB }, "single-user", "2026-08-16", { carryOverEnabled: false, autoArchiveCompleted: false });
    expect(result).toEqual({ plannerDate: "2026-08-16", carriedOver: 0, autoArchived: 0 });
    expect(calls).toEqual([]);
  });
});
