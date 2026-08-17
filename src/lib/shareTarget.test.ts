import { describe, expect, it } from "vitest";
import { normalizeSharedHttpUrl, parseShareTargetLocation } from "./shareTarget";

describe("parseShareTargetLocation", () => {
  it("ignores normal app locations", () => {
    expect(parseShareTargetLocation("/", "?title=ignored")).toBeNull();
  });

  it("uses explicit title text and URL", () => {
    const draft = parseShareTargetLocation(
      "/share-target",
      "?title=Spring%20Transaction&text=%EC%9D%BD%EC%96%B4%EB%B3%BC%20%EA%B8%80&url=https%3A%2F%2Fexample.com%2Fspring",
    );

    expect(draft).toEqual({
      title: "Spring Transaction",
      memo: "읽어볼 글",
      referenceUrl: "https://example.com/spring",
      referenceLabel: "example.com",
    });
  });

  it("extracts an http URL from shared text when url is omitted", () => {
    const draft = parseShareTargetLocation(
      "/share-target/",
      "?text=JPA%20Lock%20%EC%A0%95%EB%A6%AC%0Ahttps%3A%2F%2Ftech.example.com%2Fjpa%3Ffrom%3Dshare",
    );

    expect(draft?.title).toBe("JPA Lock 정리");
    expect(draft?.memo).toBe("JPA Lock 정리");
    expect(draft?.referenceUrl).toBe("https://tech.example.com/jpa?from=share");
    expect(draft?.referenceLabel).toBe("tech.example.com");
  });

  it("falls back to the host when only a URL is shared", () => {
    const draft = parseShareTargetLocation(
      "/share-target",
      "?url=https%3A%2F%2Fwww.example.org%2Farticle",
    );

    expect(draft?.title).toBe("example.org");
    expect(draft?.memo).toBe("");
    expect(draft?.referenceLabel).toBe("example.org");
  });

  it("returns null for an empty share request", () => {
    expect(parseShareTargetLocation("/share-target", "")).toBeNull();
  });
});

describe("normalizeSharedHttpUrl", () => {
  it("accepts only http and https URLs", () => {
    expect(normalizeSharedHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(normalizeSharedHttpUrl("http://example.com/a")).toBe("http://example.com/a");
    expect(normalizeSharedHttpUrl("javascript:alert(1)")).toBe("");
  });

  it("trims common punctuation copied after a URL", () => {
    expect(normalizeSharedHttpUrl("https://example.com/article)."))
      .toBe("https://example.com/article");
  });
});
