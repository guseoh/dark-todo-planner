import { describe, expect, it } from "vitest";
import { notionBlockToMarkdown, notionRichTextToMarkdown } from "./notionClient";

describe("Notion Markdown conversion", () => {
  it("preserves rich text emphasis and safe links", () => {
    const markdown = notionRichTextToMarkdown([
      { plain_text: "중요", annotations: { bold: true } },
      { plain_text: " 문서", href: "https://example.com/docs" },
    ]);
    expect(markdown).toBe("**중요**[ 문서](https://example.com/docs)");
  });

  it("maps headings and list blocks to Markdown structure", () => {
    const heading = notionBlockToMarkdown({
      id: "heading",
      type: "heading_2",
      heading_2: { rich_text: [{ plain_text: "핵심 내용" }] },
    });
    const bullet = notionBlockToMarkdown({
      id: "bullet",
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ plain_text: "자동화 범위" }] },
    });
    const numbered = notionBlockToMarkdown({
      id: "numbered",
      type: "numbered_list_item",
      numbered_list_item: { rich_text: [{ plain_text: "두 번째" }] },
    }, 2);

    expect(heading).toBe("## 핵심 내용");
    expect(bullet).toBe("- 자동화 범위");
    expect(numbered).toBe("2. 두 번째");
  });

  it("keeps the original section marker compatible with tech blog cleanup", () => {
    expect(notionBlockToMarkdown({
      id: "original",
      type: "heading_2",
      heading_2: { rich_text: [{ plain_text: "원문" }] },
    })).toBe("원문");
  });

  it("renders callouts and code blocks with Markdown semantics", () => {
    const callout = notionBlockToMarkdown({
      id: "callout",
      type: "callout",
      callout: { icon: { type: "emoji", emoji: "💡" }, rich_text: [{ plain_text: "한 줄 정리" }] },
    });
    const code = notionBlockToMarkdown({
      id: "code",
      type: "code",
      code: { language: "java", rich_text: [{ plain_text: "var value = 1;" }] },
    });

    expect(callout).toBe("> 💡 한 줄 정리");
    expect(code).toBe("```java\nvar value = 1;\n```");
  });
});
