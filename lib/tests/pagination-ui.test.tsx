import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/components/pagination";
import { paginate } from "../pagination";

function render(page: number, pageSize: 5 | 10 | 20 | 50, total: number, params = {}) {
  return renderToStaticMarkup(
    <Pagination path="/admin/feedback" params={params} info={paginate(page, pageSize, total)} totalItems={total} />,
  );
}

describe("<Pagination />", () => {
  it("shows the visible range and every page size option", () => {
    const html = render(2, 10, 25);
    expect(html).toContain("Showing 11–20 of 25");
    for (const size of [5, 10, 20, 50]) expect(html).toContain(`<option value="${size}"`);
    expect(html).toContain('<option value="10" selected');
  });

  it("marks the current page and links neighbours, keeping the sort and filter", () => {
    const html = render(2, 10, 25, { sort: "status", dir: "asc", status: "new" });
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/admin/feedback?sort=status&amp;dir=asc&amp;status=new"'); // page 1 has no page param
    expect(html).toContain('href="/admin/feedback?sort=status&amp;dir=asc&amp;status=new&amp;page=3"');
  });

  it("disables the previous arrow on the first page and the next arrow on the last", () => {
    expect(render(1, 10, 25)).toMatch(/<span aria-disabled="true"[^>]*>.*?Previous page/);
    expect(render(3, 10, 25)).toMatch(/<span aria-disabled="true"[^>]*>.*?Next page/);
  });

  it("carries the sort and filter, but not the page, into the page-size form", () => {
    const html = render(4, 5, 100, { sort: "message", dir: "desc", page: "4", pageSize: "5" });
    expect(html).toContain('name="sort" value="message"');
    expect(html).not.toContain('name="page"');
    expect(html).not.toMatch(/<input[^>]*name="pageSize"/);
  });

  it("handles an empty table", () => {
    expect(render(1, 10, 0)).toContain("Showing 0–0 of 0");
  });
});
