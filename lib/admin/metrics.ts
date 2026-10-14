import "server-only";

import { count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/feedback/schema";
import { students } from "@/lib/students/schema";
import {
  buildings,
  timetableBuildings,
  timetables,
} from "@/lib/timetables/schema";
import {
  CAMPUS_TIME_ZONE,
  SIGNUP_CHART_DAYS,
  addDays,
  buildDailySeries,
  campusDateString,
  campusWeekday,
  type DailyCount,
} from "@/lib/admin/dates";
import {
  RECENT_FEEDBACK_DAYS,
  type FeedbackStatus,
} from "@/lib/feedback/status";

const DAY_MS = 24 * 60 * 60 * 1000;
const LATEST_FEEDBACK_LIMIT = 5;

function daysAgo(days: number, now: Date) {
  return new Date(now.getTime() - days * DAY_MS);
}

// Timestamps are stored as UTC without a zone, so convert to the campus zone
// before taking the calendar date.
// The zone is inlined as a literal (it is a code constant, not user input): as a
// bind parameter, the SELECT and GROUP BY copies would differ and Postgres would
// reject the query.

// Raw sql`` parameters skip the column mapping, so pass UTC strings (not Dates,
// which the driver would send in the server's local time).
function isoDaysAgo(days: number, now: Date) {
  return daysAgo(days, now).toISOString();
}

const studentCampusDay = sql<string>`(((${students.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE ${sql.raw(`'${CAMPUS_TIME_ZONE}'`)})::date)::text`;

/**
 * New students per campus day for the last 30 *completed* days. Today is left
 * out because it is still in progress, so the chart only changes once a day,
 * after midnight campus time.
 */
async function getSignupSeries(now: Date): Promise<DailyCount[]> {
  const lastCompletedDay = addDays(campusDateString(now), -1);
  const firstDay = addDays(lastCompletedDay, -(SIGNUP_CHART_DAYS - 1));

  const rows = await db
    .select({ date: studentCampusDay, count: count() })
    .from(students)
    .where(
      sql`${studentCampusDay} >= ${firstDay} AND ${studentCampusDay} <= ${lastCompletedDay}`,
    )
    .groupBy(studentCampusDay);

  return buildDailySeries(rows, lastCompletedDay, SIGNUP_CHART_DAYS);
}

async function getStudentMetrics(now: Date) {
  const [row] = await db
    .select({
      total: count(),
      lastWeek: count(
        sql`CASE WHEN ${students.createdAt} >= ${isoDaysAgo(7, now)}::timestamp THEN 1 END`,
      ),
      lastMonth: count(
        sql`CASE WHEN ${students.createdAt} >= ${isoDaysAgo(30, now)}::timestamp THEN 1 END`,
      ),
    })
    .from(students);

  return row;
}

async function getFeedbackMetrics(now: Date) {
  const [byStatus, [recent], latest] = await Promise.all([
    db
      .select({ status: feedback.status, count: count() })
      .from(feedback)
      .groupBy(feedback.status),
    db
      .select({ count: count() })
      .from(feedback)
      .where(gte(feedback.createdAt, daysAgo(RECENT_FEEDBACK_DAYS, now))),
    db.query.feedback.findMany({
      orderBy: desc(feedback.createdAt),
      limit: LATEST_FEEDBACK_LIMIT,
      with: { student: { columns: { username: true } } },
    }),
  ]);

  const statusCounts: Record<FeedbackStatus, number> = {
    new: 0,
    not_reviewed: 0,
    in_review: 0,
    resolved: 0,
    dismissed: 0,
  };
  for (const row of byStatus) statusCounts[row.status] = row.count;

  return {
    recent: recent.count,
    statusCounts,
    awaitingReview: statusCounts.new + statusCounts.not_reviewed,
    latest,
  };
}

async function getTimetableMetrics(now: Date) {
  const [[totals], [today]] = await Promise.all([
    db
      .select({
        total: count(),
        lastWeek: count(
          sql`CASE WHEN ${timetables.createdAt} >= ${isoDaysAgo(7, now)}::timestamp THEN 1 END`,
        ),
      })
      .from(timetables),
    db
      .select({
        entries: count(),
        activeBuildings: sql<number>`count(distinct ${timetableBuildings.buildingId})::int`,
      })
      .from(timetableBuildings)
      .where(eq(timetableBuildings.dayOfWeek, campusWeekday(now))),
  ]);

  return { ...totals, todayEntries: today.entries, activeBuildings: today.activeBuildings };
}

async function getBuildingMetrics() {
  const [row] = await db
    .select({
      total: count(),
      located: count(
        sql`CASE WHEN ${buildings.latitude} IS NOT NULL AND ${buildings.longitude} IS NOT NULL THEN 1 END`,
      ),
    })
    .from(buildings);

  return row;
}

export async function getDashboardMetrics(now: Date = new Date()) {
  const [studentMetrics, signups, feedbackMetrics, timetableMetrics, buildingMetrics] =
    await Promise.all([
      getStudentMetrics(now),
      getSignupSeries(now),
      getFeedbackMetrics(now),
      getTimetableMetrics(now),
      getBuildingMetrics(),
    ]);

  return {
    students: studentMetrics,
    signups,
    feedback: feedbackMetrics,
    timetables: timetableMetrics,
    buildings: buildingMetrics,
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
