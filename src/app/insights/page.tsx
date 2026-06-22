import Link from "next/link";
import { Card, CardSubtitle, CardTitle } from "@/components/ui/Card";
import { ScoreBadge } from "@/components/ScoreBadge";
import { getCohortInsights } from "@/lib/actions/server.actions";
import { cn } from "@/lib/utils/cn";
import { deriveInsights } from "./derive";

export default async function InsightsPage() {
  const rows = await getCohortInsights();
  const {
    totalStudents,
    totalRecords,
    studentsWithRecords,
    cohortAvg,
    bandCounts,
    subjectStats,
    topicStats,
    attentionStudents,
  } = deriveInsights(rows);

  if (totalStudents === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Insights</h1>
          <p className="mt-1 text-muted-foreground">Cohort-level analysis.</p>
        </div>
        <Card>
          <CardTitle>No students yet</CardTitle>
          <CardSubtitle>
            Add students and record progress to see cohort insights. Run{" "}
            <code>pnpm db:seed</code> to populate with sample data.
          </CardSubtitle>
        </Card>
      </div>
    );
  }

  // Precompute topic ranking lists
  const sortedStrongest = [...topicStats]
    .sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    })
    .slice(0, 4);

  const sortedWeakest = [...topicStats]
    .sort((a, b) => {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return a.avg - b.avg;
    })
    .slice(0, 4);

  const bands = [
    { key: "strong",  label: "80–100", count: bandCounts.strong,  bg: "bg-success",    text: "text-success-foreground" },
    { key: "good",    label: "65–79",  count: bandCounts.good,    bg: "bg-success/50", text: "text-foreground" },
    { key: "mid",     label: "50–64",  count: bandCounts.mid,     bg: "bg-warning",    text: "text-warning-foreground" },
    { key: "low",     label: "35–49",  count: bandCounts.low,     bg: "bg-error/50",   text: "text-foreground" },
    { key: "veryLow", label: "0–34",   count: bandCounts.veryLow, bg: "bg-error",      text: "text-error-foreground" },
    { key: "none",    label: "No records", count: bandCounts.none, bg: "bg-muted",     text: "text-muted-foreground" },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="mt-1 text-muted-foreground">
          {totalStudents} student{totalStudents !== 1 ? "s" : ""} · {totalRecords} record{totalRecords !== 1 ? "s" : ""}
          {cohortAvg !== null ? ` · cohort avgerage ${cohortAvg.toFixed(1)}` : ""}
        </p>
      </div>

      {totalStudents < 5 && (
        <p className="rounded-lg border border-warning bg-warning/10 px-4 py-3 text-sm text-foreground">
          This cohort has fewer than 5 students — statistics may not be representative.
        </p>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Cohort average</CardTitle>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-semibold">
              {cohortAvg !== null ? cohortAvg.toFixed(1) : "—"}
            </span>
            {cohortAvg !== null && <ScoreBadge score={cohortAvg} />}
          </div>
        </Card>
        <Card>
          <CardTitle>Total records</CardTitle>
          <p className="mt-3 text-3xl font-semibold">{totalRecords}</p>
        </Card>
        <Card>
          <CardTitle>Students with records</CardTitle>
          <p className="mt-3 text-3xl font-semibold">
            {studentsWithRecords}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {totalStudents}
            </span>
          </p>
        </Card>
      </div>

      {/* Score band distribution */}
      <Card>
        <CardTitle>Score band distribution</CardTitle>
        <CardSubtitle className="mt-1">
          Each student bucketed by their overall average.
        </CardSubtitle>
        <div className="mt-4 flex h-10 w-full overflow-hidden rounded-md">
          {bands.map((band) =>
            band.count === 0 ? null : (
              <div
                key={band.key}
                style={{ width: `${(band.count / totalStudents) * 100}%` }}
                className={cn(
                  "flex items-center justify-center overflow-hidden text-xs font-semibold transition-all",
                  band.bg,
                  band.text,
                )}
                title={`${band.label}: ${band.count} student${band.count !== 1 ? "s" : ""}`}
              >
                {band.count}
              </div>
            )
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {bands.map((band) =>
            band.count === 0 ? null : (
              <span key={band.key} className="flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", band.bg)} />
                {band.label}: {band.count}
              </span>
            )
          )}
        </div>
      </Card>

      {/* Subject summary */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">By subject</h2>
        {subjectStats.length === 0 ? (
          <Card>
            <CardTitle>No records yet</CardTitle>
            <CardSubtitle>Record progress to see subject breakdowns.</CardSubtitle>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {subjectStats.map(({ subject, avg, studentCount }) => (
              <Card key={subject}>
                <CardTitle>{subject}</CardTitle>
                <CardSubtitle>
                  {studentCount} student{studentCount !== 1 ? "s" : ""} with records
                </CardSubtitle>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{avg.toFixed(1)}</span>
                  <ScoreBadge score={avg} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Topic rankings */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Topic rankings</h2>
        {topicStats.length === 0 ? (
          <Card>
            <CardTitle>No records yet</CardTitle>
            <CardSubtitle>Record progress to see topic rankings.</CardSubtitle>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardTitle>Strongest topics</CardTitle>
              <ul className="mt-2">
                {sortedStrongest.map((topic) => (
                  <li
                    key={topic.name}
                    className="flex items-center justify-between border-t border-border py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{topic.name}</span>
                      <span className="ml-2 text-muted-foreground">{topic.subject}</span>
                    </div>
                    {topic.avg !== null ? (
                      <ScoreBadge score={topic.avg} />
                    ) : (
                      <span className="text-xs text-muted-foreground">(limited data)</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardTitle>Topics needing work</CardTitle>
              <ul className="mt-2">
                {sortedWeakest.map((topic) => (
                  <li
                    key={topic.name}
                    className="flex items-center justify-between border-t border-border py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{topic.name}</span>
                      <span className="ml-2 text-muted-foreground">{topic.subject}</span>
                    </div>
                    {topic.avg !== null ? (
                      <ScoreBadge score={topic.avg} />
                    ) : (
                      <span className="text-xs text-muted-foreground">(limited data)</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      {/* Students needing attention */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Students needing attention</h2>
        {attentionStudents.length === 0 ? (
          <Card>
            <CardTitle>No students flagged</CardTitle>
            <CardSubtitle>
              All students are performing within expected bands.
            </CardSubtitle>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Avg</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {attentionStudents.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">Year {s.yearGroup}</td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={s.avg} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{s.reasons.join(", ")}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/students/${s.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Trend data requires at least 5 records per student. Students with no records are not shown.
        </p>
      </div>
    </div>
  );
}
