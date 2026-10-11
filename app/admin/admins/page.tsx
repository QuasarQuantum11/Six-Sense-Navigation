import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins } from "@/lib/admins/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";
import { SortableHeader } from "@/components/sortable-header";
import { orderByFor, parseSort } from "@/lib/table-sort";

export const dynamic = "force-dynamic";

const PATH = "/admin/admins";

const sortColumns = {
  username: sql`lower(${admins.username})`,
  email: sql`lower(${admins.email})`,
  emailVerified: sql`${admins.emailVerified}`,
  createdAt: sql`${admins.createdAt}`,
  id: sql`${admins.id}`,
};
const sortKeys = Object.keys(sortColumns) as (keyof typeof sortColumns)[];

export default async function AdminsPage({
  searchParams,
}: PageProps<"/admin/admins">) {
  await requireAdmin();

  const params = await searchParams;
  const sort = parseSort(params, sortKeys);

  const allAdmins = await db
    .select({
      id: admins.id,
      username: admins.username,
      email: admins.email,
      emailVerified: admins.emailVerified,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(...orderByFor(sortColumns, sort, [asc(admins.createdAt)]));

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
          <h1 className="text-2xl font-bold text-primary">Admins</h1>
          <BackLink href="/">← Back home</BackLink>
        </div>

        <div className="overflow-x-auto rounded-lg border-2 border-primary">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-panel">
              <tr>
                {header("Username", "username")}
                {header("Email", "email")}
                {header("Email Verified", "emailVerified")}
                {header("Created At", "createdAt")}
                {header("ID", "id")}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {allAdmins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-4 py-3 font-semibold text-accent">
                    {admin.username}
                  </td>
                  <td className="px-4 py-3 text-muted">{admin.email}</td>
                  <td className="px-4 py-3 text-muted">
                    {admin.emailVerified ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(admin.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {admin.id}
                  </td>
                </tr>
              ))}
              {allAdmins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    No admins yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
