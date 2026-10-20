import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnresolvedToggle } from "@/components/feedback/unresolved-toggle";
import { UNRESOLVED_STATUSES } from "@/lib/feedback/status";

function render(active: boolean, count: number, params = {}) {
  return renderToStaticMarkup(
    <UnresolvedToggle active={active} count={count} path="/admin/feedback" params={params} />,
  );
}

describe("<UnresolvedToggle />", () => {
  it("treats New and Not reviewed as unresolved", () => {
    expect([...UNRESOLVED_STATUSES]).toEqual(["new", "not_reviewed"]);
  });

  it("offers to turn the filter on, showing how many items it would show", () => {
    const html = render(false, 7);

    expect(html).toContain("Show unresolved only (7)");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('name="status" value="unresolved"'); // submitting switches the filter on
  });

  it("shows when it is on, and submitting switches it off by leaving the filter out", () => {
    const html = render(true, 7);

    expect(html).toContain("Showing unresolved only (7)");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('name="status"');
  });

  it("carries the sort, search and page size, but returns to the first page", () => {
    const html = render(false, 2, { sort: "status", dir: "desc", q: "ramp", pageSize: "20", page: "3" });

    expect(html).toContain('name="sort" value="status"');
    expect(html).toContain('name="q" value="ramp"');
    expect(html).toContain('name="pageSize" value="20"');
    expect(html).not.toContain('name="page"');
  });

  it("replaces an earlier status filter rather than adding a second one", () => {
    const html = render(true, 2, { status: "unresolved" });

    expect(html.match(/name="status"/g)).toBeNull();
  });
});
