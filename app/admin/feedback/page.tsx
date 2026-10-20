import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { students } from "@/lib/students/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";
import { FeedbackStatusSelect } from "@/components/feedback/feedback-status-select";
import {
  STATUS_PARAM,
  UNRESOLVED_FILTER,
  UnresolvedToggle,
} from "@/components/feedback/unresolved-toggle";
import { UNRESOLVED_STATUSES } from "@/lib/feedback/status";
import { SortableHeader } from "@/components/sortable-header";
import { expireStaleFeedback } from "@/lib/feedback/expire";
import { Pagination } from "@/components/pagination";
import { paginate, parsePage, parsePageSize } from "@/lib/pagination";
import { TableSearch } from "@/components/table-search";
import { parseSearch, searchCondition } from "@/lib/table-search";
import { orderByFor, parseSort } from "@/lib/table-sort";

export const dynamic = "force-dynamic";

const PATH = "/admin/feedback";

// Status sorts in workflow order (new, not reviewed, in review, resolved, dismissed),
// which is the order the values are declared in the database enum.
const sortColumns = {
  submittedBy: sql`lower(${students.username})`,
  message: sql`lower(${feedback.message})`,
  status: sql`${feedback.status}`,
  submitted: sql`${feedback.createdAt}`,
};
const sortKeys = Object.keys(sortColumns) as (keyof typeof sortColumns)[];

export default async function AllFeedbackPage({
  searchParams,
}: PageProps<"/admin/feedback">) {
  await requireAdmin();

  await expireStaleFeedback();

  const params = await searchParams;
  const sort = parseSort(params, sortKeys);
  const statusParam = params[STATUS_PARAM];
  const unresolvedOnly =
    (Array.isArray(statusParam) ? statusParam[0] : statusParam) === UNRESOLVED_FILTER;

  const query = parseSearch(params);
  const match = searchCondition(query, [feedback.message, students.username]);
  const unresolved = inArray(feedback.status, [...UNRESOLVED_STATUSES]);
  const visible = and(unresolvedOnly ? unresolved : undefined, match);

  const [[{ total }], [unresolvedTotal]] = await Promise.all([
    db
      .select({ total: count() })
      .from(feedback)
      .leftJoin(students, eq(feedback.studentId, students.id))
      .where(visible),
    // The button's count follows the search, so it shows how many unresolved items match.
    db
      .select({ count: count() })
      .from(feedback)
      .leftJoin(students, eq(feedback.studentId, students.id))
      .where(and(unresolved, match)),
  ]);
  const pageInfo = paginate(parsePage(params), parsePageSize(params), total);

  const allFeedback = await db
    .select({
      id: feedback.id,
      message: feedback.message,
      status: feedback.status,
      createdAt: feedback.createdAt,
      username: students.username,
    })
    .from(feedback)
    .leftJoin(students, eq(feedback.studentId, students.id))
    .where(visible)
    .orderBy(...orderByFor(sortColumns, sort, [desc(feedback.createdAt)]))
    .limit(pageInfo.pageSize)
    .offset(pageInfo.offset);

  const header = (label: string, sortKey: (typeof sortKeys)[number]) => (
    <SortableHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      path={PATH}
      params={params}
    />
  );

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">All feedback</h1>
          <BackLink href="/">← Back home</BackLink>
        </div>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <TableSearch
            path={PATH}
            params={params}
            query={query}
            label="Search feedback"
            hint="Searches the message and who submitted it."
          />
          <UnresolvedToggle
            active={unresolvedOnly}
            count={unresolvedTotal.count}
            path={PATH}
            params={params}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                {header("Submitted by", "submittedBy")}
                {header("Message", "message")}
                {header("Status", "status")}
                {header("Submitted", "submitted")}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {allFeedback.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-muted">
                    {item.username ? (
                      <span className="font-semibold text-accent">
                        {item.username}
                      </span>
                    ) : (
                      "Guest"
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{item.message}</td>
                  <td className="px-4 py-3">
                    <FeedbackStatusSelect
                      feedbackId={item.id}
                      status={item.status}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {allFeedback.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    {query
                      ? `No ${unresolvedOnly ? "unresolved " : ""}feedback matches “${query}”.`
                      : unresolvedOnly
                        ? "No unresolved feedback. Everything has been reviewed."
                        : "No feedback submitted yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination path={PATH} params={params} info={pageInfo} totalItems={total} />
      </main>
    </div>
  );
}
