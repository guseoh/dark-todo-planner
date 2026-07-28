import { describe, expect, it, vi } from "vitest";
import {
  buildDiscordReminderPayload,
  executeIncompleteTodoReminder,
  getReminderPlannerDate,
  selectIncompleteTodoReminderTargets,
  type ReminderTodo,
} from "./incompleteTodoReminder";

const todo = (id: string, overrides: Partial<ReminderTodo> = {}): ReminderTodo => ({
  id,
  title: `Todo ${id}`,
  date: "2026-07-27",
  completed: false,
  archived: false,
  repeat: "NONE",
  ...overrides,
});

const createStore = () => {
  const claims = new Map<string, string>();
  return {
    claim: vi.fn(async (plannerDate: string, provider: "discord") => {
      const key = `${plannerDate}:${provider}`;
      if (claims.has(key)) return null;
      const id = `claim-${claims.size + 1}`;
      claims.set(key, id);
      return id;
    }),
    markSent: vi.fn(async () => undefined),
    release: vi.fn(async (claimId: string) => {
      const entry = [...claims.entries()].find(([, id]) => id === claimId);
      if (entry) claims.delete(entry[0]);
    }),
  };
};

describe("reminder planner date", () => {
  it("uses the Korean planner day boundary at 3 AM", () => {
    expect(getReminderPlannerDate(new Date("2026-07-27T17:59:00Z"))).toBe("2026-07-27");
    expect(getReminderPlannerDate(new Date("2026-07-27T18:01:00Z"))).toBe("2026-07-28");
  });
});

describe("incomplete Todo reminder targets", () => {
  it("includes overdue and today non-repeating Todos", () => {
    const targets = selectIncompleteTodoReminderTargets(
      [todo("overdue"), todo("today", { date: "2026-07-28" })],
      "2026-07-28",
    );

    expect(targets.map(({ id }) => id)).toEqual(["overdue", "today"]);
  });

  it("excludes completed, archived, and future Todos", () => {
    const targets = selectIncompleteTodoReminderTargets(
      [
        todo("completed", { completed: true }),
        todo("archived", { archived: true }),
        todo("future", { date: "2026-07-29" }),
      ],
      "2026-07-28",
    );

    expect(targets).toEqual([]);
  });

  it("includes repeating Todos only when they occur on planner today", () => {
    const targets = selectIncompleteTodoReminderTargets(
      [
        todo("weekly-today", { date: "2026-07-21", repeat: "WEEKLY" }),
        todo("weekly-other-day", { date: "2026-07-20", repeat: "WEEKLY" }),
        todo("weekday", { date: "2026-07-01", repeat: "WEEKDAY" }),
        todo("weekend", { date: "2026-07-01", repeat: "WEEKEND" }),
      ],
      "2026-07-28",
    );

    expect(targets.map(({ id }) => id)).toEqual(["weekly-today", "weekday"]);
  });
});

describe("Discord reminder payload", () => {
  it("shows at most five titles and summarizes the rest", () => {
    const payload = buildDiscordReminderPayload(
      Array.from({ length: 7 }, (_, index) => todo(String(index + 1))),
      "2026-07-28",
    );

    expect(payload.content.match(/^• Todo/gm)).toHaveLength(5);
    expect(payload.content).toContain("• 외 2개");
  });

  it("sanitizes mentions and disables allowed mentions", () => {
    const payload = buildDiscordReminderPayload(
      [todo("mention", { title: "@everyone <@123456> 확인" })],
      "2026-07-28",
    );

    expect(payload.content).not.toContain("@everyone");
    expect(payload.content).not.toContain("<@123456>");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });
});

describe("reminder execution", () => {
  it("does not claim or send when there are no incomplete Todos", async () => {
    const store = createStore();
    const send = vi.fn(async () => undefined);

    const result = await executeIncompleteTodoReminder({
      webhookUrl: "configured",
      plannerDate: "2026-07-28",
      now: new Date("2026-07-28T12:00:00Z"),
      loadTodos: async () => [],
      store,
      send,
    });

    expect(result).toEqual({ status: "no-todos", count: 0 });
    expect(store.claim).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("skips safely when the webhook Secret is missing", async () => {
    const loadTodos = vi.fn(async () => [todo("one")]);
    const logInfo = vi.fn();

    const result = await executeIncompleteTodoReminder({
      plannerDate: "2026-07-28",
      now: new Date("2026-07-28T12:00:00Z"),
      loadTodos,
      store: createStore(),
      send: vi.fn(),
      logInfo,
    });

    expect(result).toEqual({ status: "missing-secret", count: 0 });
    expect(loadTodos).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith(expect.not.stringContaining("https://"));
  });

  it("sends only once for the same planner date and provider", async () => {
    const store = createStore();
    const send = vi.fn(async () => undefined);
    const input = {
      webhookUrl: "configured",
      plannerDate: "2026-07-28",
      now: new Date("2026-07-28T12:00:00Z"),
      loadTodos: async () => [todo("one")],
      store,
      send,
    };

    expect(await executeIncompleteTodoReminder(input)).toEqual({ status: "sent", count: 1 });
    expect(await executeIncompleteTodoReminder(input)).toEqual({ status: "duplicate", count: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("releases a failed claim so the same day can be retried", async () => {
    const store = createStore();
    const send = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    const input = {
      webhookUrl: "configured",
      plannerDate: "2026-07-28",
      now: new Date("2026-07-28T12:00:00Z"),
      loadTodos: async () => [todo("one")],
      store,
      send,
      logError: vi.fn(),
    };

    expect(await executeIncompleteTodoReminder(input)).toEqual({ status: "failed", count: 1 });
    expect(await executeIncompleteTodoReminder(input)).toEqual({ status: "sent", count: 1 });
    expect(store.release).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
