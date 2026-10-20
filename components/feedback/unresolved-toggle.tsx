import Form from "next/form";
import { PAGE_PARAM, carriedParams, type SearchParams } from "@/lib/table-sort";

export const STATUS_PARAM = "status";
export const UNRESOLVED_FILTER = "unresolved";

// A toggle button that limits the feedback table to unresolved items, meaning the
// New and Not reviewed statuses (see UNRESOLVED_STATUSES in lib/feedback/status.ts).
// It is a GET form, so it works without JavaScript, and it carries over the other
// query parameters (the current sort and search) when switched on or off.
export function UnresolvedToggle({
  active,
  count,
  path,
  params,
}: {
  active: boolean;
  /** Number of unresolved feedback items, shown on the button. */
  count: number;
  path: string;
  params: SearchParams;
}) {
  // Switching the filter restarts from the first page, so the page is not carried over.
  const carried = carriedParams(params, [STATUS_PARAM, PAGE_PARAM]);

  return (
    <Form action={path} className="self-start">
      {carried.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      {/* Switching on adds the filter; switching off simply omits it. */}
      {!active && <input type="hidden" name={STATUS_PARAM} value={UNRESOLVED_FILTER} />}
      <button
        type="submit"
        aria-pressed={active}
        title="Feedback with the New or Not reviewed status"
        className={`rounded-md border-2 border-primary px-4 py-2 text-sm font-semibold ${
          active
            ? "bg-primary text-white hover:bg-primary-dark"
            : "bg-white text-primary hover:bg-panel"
        }`}
      >
        {active ? "Showing unresolved only" : "Show unresolved only"} ({count})
      </button>
    </Form>
  );
}
