import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getDashboardMetrics } from "@/lib/admin/metrics";
import { expireStaleFeedback } from "@/lib/feedback/expire";
import { feedbackStatusLabels, RECENT_FEEDBACK_DAYS } from "@/lib/feedback/status";
import {
  CAMPUS_TIME_ZONE,
  SIGNUP_CHART_DAYS,
  formatRelativeTime,
  greetingFor,
} from "@/lib/admin/dates";
import { SignupsChart } from "@/components/admin/signups-chart";
import { StatCard } from "@/components/admin/stat-card";
import {
  BuildingIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  MessageIcon,
  TableIcon,
  UsersIcon,
} from "@/components/admin/icons";

export const dynamic = "force-dynamic";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

function initials(name: string | null) {
  return name ? name.slice(0, 2).toUpperCase() : "G";
}

export default async function AdminDashboardPage() {
  const session = await requireAdmin();
  const now = new Date();

  // Keep statuses honest before counting them.
  await expireStaleFeedback(now);
  const metrics = await getDashboardMetrics(now);

  const todayLabel = new Intl.DateTimeFormat("en-AU", {
    timeZone: CAMPUS_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="flex flex-1 flex-col items-center bg-slate-50">
      <main className="flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Campus overview
            </p>
            <h1 className="mt-2 text-4xl font-bold text-primary-dark">
              {greetingFor(now)}, {session.username}.
            </h1>
            <p className="mt-2 text-muted">
              Here&apos;s what&apos;s happening across Six-Sense Navigation today.
            </p>
          </div>
          <p className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-accent-dark">
            <CalendarIcon size={18} />
            {todayLabel}
          </p>
        </header>

        <section aria-label="Key metrics" className="grid gap-4 md:grid-cols-3">
          <StatCard
            title={`New students (${RECENT_FEEDBACK_DAYS} days)`}
            value={metrics.students.lastWeek}
            detail={`${metrics.students.lastMonth} in the last 30 days · ${metrics.students.total} total`}
            href="/students"
            linkLabel="View students"
            icon={<UsersIcon />}
          />
          <StatCard
            title={`Recent feedback (${RECENT_FEEDBACK_DAYS} days)`}
            value={metrics.feedback.recent}
            detail={`${metrics.feedback.awaitingReview} awaiting review`}
            href="/admin/feedback"
            linkLabel="View all feedback"
            icon={<MessageIcon />}
            tone="accent"
          />
          <StatCard
            title="Timetables created"
            value={metrics.timetables.total}
            detail={`${metrics.timetables.lastWeek} this week`}
            href="/students"
            linkLabel="View students and timetables"
            icon={<TableIcon />}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-5">
          <section className={`${cardClass} lg:col-span-3`}>
            <h2 className="text-lg font-bold text-primary-dark">Student activity</h2>
            <p className="mb-4 text-sm text-muted">
              New student accounts per day over the last {SIGNUP_CHART_DAYS} days.
              Updated after midnight each day, so today isn&apos;t included.
            </p>
            <SignupsChart data={metrics.signups} />
          </section>

          <section className={`${cardClass} lg:col-span-2`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-primary-dark">Recent feedback</h2>
                <p className="text-sm text-muted">Latest student comments</p>
              </div>
              <Link
                href="/admin/feedback"
                className="text-sm font-semibold text-accent hover:text-accent-dark"
              >
                View all
              </Link>
            </div>

            {metrics.feedback.latest.length === 0 ? (
              <p className="mt-6 text-sm text-muted">No feedback submitted yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200">
                {metrics.feedback.latest.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-bold text-primary"
                    >
                      {initials(item.student?.username ?? null)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-sm font-semibold text-foreground">
                          {item.student?.username ?? "Guest"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-muted">
                          {feedbackStatusLabels[item.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                        {item.message}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatRelativeTime(item.createdAt, now)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-label="Navigation data" className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-primary to-primary-dark p-6 text-white shadow-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <BuildingIcon />
              </span>
              <div>
                <h2 className="text-sm font-bold">Campus buildings</h2>
                <p className="text-3xl font-extrabold">{metrics.buildings.total}</p>
                <p className="text-sm">{metrics.buildings.located} mapped with locations</p>
              </div>
            </div>
            <Link
              href="/admins/buildings"
              className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30"
            >
              Manage buildings
              <ChevronRightIcon size={16} />
            </Link>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-accent to-accent-dark p-6 text-white shadow-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <ClockIcon />
              </span>
              <div>
                <h2 className="text-sm font-bold">Today&apos;s timetable entries</h2>
                <p className="text-3xl font-extrabold">{metrics.timetables.todayEntries}</p>
                <p className="text-sm">
                  Across {metrics.timetables.activeBuildings} active{" "}
                  {metrics.timetables.activeBuildings === 1 ? "building" : "buildings"}
                </p>
              </div>
            </div>
            <Link
              href="/students"
              className="flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/30"
            >
              View timetables
              <ChevronRightIcon size={16} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
