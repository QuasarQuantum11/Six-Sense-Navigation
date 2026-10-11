import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TableSearch } from "@/components/table-search";

function render(query: string | null, params = {}) {
  return renderToStaticMarkup(
    <TableSearch
      path="/admin/admins"
      params={params}
      query={query}
      label="Search admins"
      hint="Searches username, email and ID."
    />,
  );
}

describe("<TableSearch />", () => {
  it("has an accessible label and describes which fields are searched", () => {
    const html = render(null);
    expect(html).toContain('role="search"');
    expect(html).toMatch(/<label[^>]*>Search admins<\/label>/);
    expect(html).toContain("Searches username, email and ID.");
    expect(html).toMatch(/aria-describedby="[^"]+"/);
  });

  it("shows the current search and a Clear link that keeps the sort", () => {
    const html = render("dana", { q: "dana", sort: "email", dir: "desc", page: "3" });
    expect(html).toContain('value="dana"');
    expect(html).toContain('href="/admin/admins?sort=email&amp;dir=desc"');
  });

  it("offers no Clear link when nothing is searched", () => {
    expect(render(null)).not.toContain("Clear search");
  });

  it("carries the sort and page size, but not the old search or page, into the form", () => {
    const html = render("old", { q: "old", sort: "email", dir: "asc", pageSize: "20", page: "4" });
    expect(html).toContain('name="sort" value="email"');
    expect(html).toContain('name="pageSize" value="20"');
    expect(html).not.toContain('name="page"');
    expect(html.match(/name="q"/g)).toHaveLength(1);
  });
});
