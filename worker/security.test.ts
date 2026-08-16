import { describe, expect, it } from "vitest";
import { browserMutationIsSameOrigin } from "./security";

describe("browser mutation origin guard", () => {
  it("allows safe methods", () => {
    expect(browserMutationIsSameOrigin(new Request("https://planner.example/api/todos", { method: "GET", headers: { Origin: "https://evil.example" } }))).toBe(true);
  });

  it("allows same-origin browser mutations", () => {
    expect(browserMutationIsSameOrigin(new Request("https://planner.example/api/todos", {
      method: "POST",
      headers: { Origin: "https://planner.example", "Sec-Fetch-Site": "same-origin" },
    }))).toBe(true);
  });

  it("rejects cross-site and same-site browser mutations", () => {
    expect(browserMutationIsSameOrigin(new Request("https://planner.example/api/todos", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    }))).toBe(false);
    expect(browserMutationIsSameOrigin(new Request("https://planner.example/api/todos", {
      method: "POST",
      headers: { Origin: "https://sub.planner.example", "Sec-Fetch-Site": "same-site" },
    }))).toBe(false);
  });

  it("allows non-browser same-origin-compatible clients without fetch metadata", () => {
    expect(browserMutationIsSameOrigin(new Request("https://planner.example/api/todos", { method: "POST" }))).toBe(true);
  });
});
