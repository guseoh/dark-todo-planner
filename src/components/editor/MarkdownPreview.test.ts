import { describe, expect, it } from "vitest";
import { renderMarkdownPreviewHtml } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("renders headings instead of exposing raw markdown markers", () => {
    const html = renderMarkdownPreviewHtml("## 핵심 이해 포인트\n- 첫 번째 포인트");
    expect(html).toContain("<h2");
    expect(html).toContain("핵심 이해 포인트</h2>");
    expect(html).not.toContain("## 핵심 이해 포인트");
  });

  it("preserves ordered list numbers", () => {
    const html = renderMarkdownPreviewHtml("1. 첫 질문\n2. 둘째 질문\n3. 셋째 질문");
    expect(html).toContain(">1.</span>");
    expect(html).toContain(">2.</span>");
    expect(html).toContain(">3.</span>");
  });

  it("continues escaping raw html", () => {
    const html = renderMarkdownPreviewHtml("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
