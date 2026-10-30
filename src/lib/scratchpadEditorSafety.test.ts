import { describe, expect, it } from "vitest";
import { requiresRawScratchpadEditing } from "./scratchpadEditorSafety";

describe("G4 Scratchpad Markdown compatibility gate", () => {
  it("allows ordinary text, Korean IME content, headings and checklists in the visual editor", () => {
    for (const input of ["", "한글 입력과 줄 바꿈\n그대로", "# 제목\n\n**강조**", "- [ ] 할 일\n- [x] 완료", "1. 첫 번째\n2. 두 번째", "> 인용", "~~~js\nconst a = 1\n~~~"]) {
      expect(requiresRawScratchpadEditing(input)).toBe(false);
    }
  });
  it("protects unsupported stored markdown without deleting or rewriting it", () => {
    for (const input of [
      "| 이름 | 값 |\n| --- | --- |\n| A | B |",
      "<details><summary>제목</summary>내용</details>",
      "![이미지](https://example.com/image.png)",
      "[참고]: https://example.com\n\n[링크][참고]",
      "$$\na^2 + b^2\n$$",
      "---\ntitle: 보존\n---\n문서",
    ]) expect(requiresRawScratchpadEditing(input)).toBe(true);
  });
});
