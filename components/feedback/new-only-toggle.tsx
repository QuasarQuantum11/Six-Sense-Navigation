import Form from "next/form";
import type { SearchParams } from "@/lib/table-sort";

export const STATUS_PARAM = "status";

// A toggle button that limits the feedback table to items with the "New" status.
// It is a GET form, so it works without JavaScript, and it carries over the other
// query parameters (the current sort, and later a search) when switched on or off.
export function NewOnlyToggle({
  active,
  count,
  path,
  params,
}: {
  active: boolean;
  /** Number of feedback items with the New status, shown on the button. */
  count: number;
  path: string;
  params: SearchParams;
}) {
  const carried = Object.entries(params).flatMap(([name, value]) =>
    name === STATUS_PARAM
      ? []
      : (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(
          (item) => [name, item] as const,
        ),
  );

  return (
    <Form action={path} className="self-start">
      {carried.map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      {/* Switching on adds the filter; switching off simply omits it. */}
      {!active && <input type="hidden" name={STATUS_PARAM} value="new" />}
      <button
        type="submit"
        aria-pressed={active}
        className={`rounded-md border-2 border-primary px-4 py-2 text-sm font-semibold ${
          active
            ? "bg-primary text-white hover:bg-primary-dark"
            : "bg-white text-primary hover:bg-panel"
        }`}
      >
        {active ? "Showing New only" : "Show New only"} ({count})
      </button>
    </Form>
  );
}
