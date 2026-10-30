import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "./PageHeader";

describe("shared planner page header", () => {
  it("renders a semantic heading, description, and metadata", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="받은함" description="미계획 작업을 정리합니다." meta="미계획 3개" />,
    );
    expect(html).toContain('<header class="page-header">');
    expect(html).toContain(">받은함</h2>");
    expect(html).toContain("미계획 작업을 정리합니다.");
    expect(html).toContain("미계획 3개");
  });

  it("keeps contextual actions within the header", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="프로젝트" description="작업 관리" actions={<button type="button">프로젝트 추가</button>} />,
    );
    expect(html).toContain("프로젝트 추가</button>");
    expect(html).toContain('type="button"');
  });
});
