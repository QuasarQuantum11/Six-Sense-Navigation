import type { DailyCount } from "@/lib/admin/dates";

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
const TICKS = 4;
const LABEL_EVERY = 7;

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

// Dates are YYYY-MM-DD; format them as UTC so the browser's zone can't shift them.
function formatDay(date: string) {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`));
}

// Rounds the top of the y-axis up to 1, 2 or 5 x 10^n per tick.
export function niceStep(max: number) {
  const rough = Math.max(max, 1) / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const factor = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  // Counts are whole students, so never use a fractional step.
  return Math.max(1, factor * magnitude);
}

export function SignupsChart({ data }: { data: DailyCount[] }) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  const max = Math.max(...data.map((day) => day.count), 0);
  const step = niceStep(max);
  const top = step * TICKS;

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;

  const points = data.map((day, index) => `${x(index).toFixed(1)},${y(day.count).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const first = data[0];
  const last = data[data.length - 1];

  return (
    <figure>
      <figcaption className="sr-only">
        {total} new student accounts between {formatDay(first.date)} and {formatDay(last.date)}.
        The table below lists each day.
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="signups-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const value = i * step;
          return (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(value) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
              >
                {value}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#signups-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((day, index) => (
          <g key={day.date}>
            {/* Larger invisible target so each day's value shows on hover. */}
            <circle cx={x(index)} cy={y(day.count)} r={8} fill="transparent">
              <title>{`${formatDay(day.date)}: ${day.count} new`}</title>
            </circle>
            {day.count > 0 && (
              <circle cx={x(index)} cy={y(day.count)} r={2.5} fill="var(--primary)" />
            )}
          </g>
        ))}

        {data.map((day, index) =>
          index % LABEL_EVERY === 0 || index === data.length - 1 ? (
            <text
              key={day.date}
              x={x(index)}
              y={HEIGHT - 10}
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
              fontSize={11}
              fill="var(--muted)"
            >
              {formatDay(day.date)}
            </text>
          ) : null,
        )}
      </svg>

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
              <th scope="row">{formatDay(day.date)}</th>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
