"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { DailyCount } from "@/lib/admin/dates";

const CHART_HEIGHT = 260;

const shortDay = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const longDay = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Dates are YYYY-MM-DD; format them as UTC so the browser's zone can't shift them.
const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
const formatShort = (date: string) => shortDay.format(toDate(date));

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const point = active ? (payload?.[0]?.payload as DailyCount | undefined) : undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-foreground">{longDay.format(toDate(point.date))}</p>
      <p className="text-muted">
        <span className="font-bold text-primary">{point.count}</span> new{" "}
        {point.count === 1 ? "student" : "students"}
      </p>
    </div>
  );
}

export function SignupsChart({ data }: { data: DailyCount[] }) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <figure>
      <figcaption className="sr-only">
        {total} new student accounts between {formatShort(first.date)} and{" "}
        {formatShort(last.date)}. Use the arrow keys to move between days, or read the table below.
      </figcaption>

      <ResponsiveContainer
        width="100%"
        height={CHART_HEIGHT}
        initialDimension={{ width: 640, height: CHART_HEIGHT }}
      >
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="signups-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShort}
            // Drops labels that would collide instead of squashing them together.
            minTickGap={28}
            tickMargin={8}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(4, max)]}
            width={36}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ stroke: "var(--primary)", strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#signups-fill)"
            dot={false}
            activeDot={{ r: 5, fill: "var(--accent)", stroke: "#ffffff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <table className="sr-only">
        <caption>New student accounts per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">New students</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatShort(day.date)}</th>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
