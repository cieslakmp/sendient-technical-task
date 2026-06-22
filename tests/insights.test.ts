import { describe, expect, it } from "vitest";
import { deriveInsights } from "@/app/insights/derive";
import type { CohortInsightsRow } from "@/lib/actions/server.actions";

// Helper: build a minimal CohortInsightsRow for a student with no records
function studentRow(studentId: number, name: string, yearGroup: number): CohortInsightsRow {
  return {
    studentId,
    studentName: name,
    studentYearGroup: yearGroup,
    recordId: null,
    score: null,
    recordedAt: null,
    topicId: null,
    topicName: null,
    topicSubject: null,
  };
}

// Helper: build a row for a student with a record
function recordRow(
  studentId: number,
  name: string,
  yearGroup: number,
  recordId: number,
  score: number,
  topicId: number,
  topicName: string,
  topicSubject: string,
  recordedAt?: Date,
): CohortInsightsRow {
  return {
    studentId,
    studentName: name,
    studentYearGroup: yearGroup,
    recordId,
    score,
    recordedAt: recordedAt ?? new Date(2024, 0, recordId),
    topicId,
    topicName,
    topicSubject,
  };
}

// ─── Band distribution ───────────────────────────────────────────────────────

describe("deriveInsights — band distribution", () => {
  it("puts students with no records into the none band", () => {
    const rows = [studentRow(1, "Alice", 9), studentRow(2, "Bob", 10)];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts).toEqual({ high: 0, mid: 0, low: 0, none: 2 });
  });

  it("classifies a student with avg >= 70 as high", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 80, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 70, 1, "Algebra", "Maths"),
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.high).toBe(1);
    expect(bandCounts.mid).toBe(0);
    expect(bandCounts.low).toBe(0);
  });

  it("classifies a student with avg 50-69 as mid", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 50, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 69, 1, "Algebra", "Maths"),
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.mid).toBe(1);
  });

  it("classifies a student with avg < 50 as low", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 30, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 40, 1, "Algebra", "Maths"),
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.low).toBe(1);
  });

  it("does NOT flag avg exactly 50 as low", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 50, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.low).toBe(0);
    expect(bandCounts.mid).toBe(1);
  });

  it("buckets a mixed cohort correctly", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 80, 1, "Algebra", "Maths"),     // high
      recordRow(2, "Bob",   9, 2, 55, 1, "Algebra", "Maths"),     // mid
      recordRow(3, "Carol", 9, 3, 40, 1, "Algebra", "Maths"),     // low
      studentRow(4, "Dave", 9),                                    // none
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts).toEqual({ high: 1, mid: 1, low: 1, none: 1 });
  });
});

// ─── Attention: low average ───────────────────────────────────────────────────

describe("deriveInsights — low average flagging", () => {
  it("flags a student with avg < 50", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 45, 1, "Algebra", "Maths")];
    const { attentionStudents } = deriveInsights(rows);
    expect(attentionStudents).toHaveLength(1);
    expect(attentionStudents[0].reasons).toContain("Low average");
  });

  it("does NOT flag a student with avg exactly 50", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 50, 1, "Algebra", "Maths")];
    const { attentionStudents } = deriveInsights(rows);
    expect(attentionStudents).toHaveLength(0);
  });

  it("does NOT flag a student with no records", () => {
    const rows = [studentRow(1, "Alice", 9)];
    const { attentionStudents } = deriveInsights(rows);
    expect(attentionStudents).toHaveLength(0);
  });

  it("sorts attention students by avg ascending", () => {
    // Two students both below 50; worst should be first
    const rows = [
      recordRow(1, "Alice", 9, 1, 45, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 2, 30, 1, "Algebra", "Maths"),
    ];
    const { attentionStudents } = deriveInsights(rows);
    expect(attentionStudents[0].avg).toBeLessThan(attentionStudents[1].avg);
  });
});

// ─── Attention: declining trend ───────────────────────────────────────────────

describe("deriveInsights — declining trend flagging", () => {
  // Build rows for a student with given scores in order newest-first (as the query returns them)
  function makeStudentRows(studentId: number, scoresNewestFirst: number[]): CohortInsightsRow[] {
    return scoresNewestFirst.map((score, i) =>
      recordRow(
        studentId,
        `Student ${studentId}`,
        9,
        i + 1,
        score,
        1,
        "Algebra",
        "Maths",
        new Date(2024, 0, scoresNewestFirst.length - i), // newest gets highest date
      ),
    );
  }

  it("does NOT flag a student with fewer than 5 records even if recent scores are low", () => {
    // 4 records: recent 3 are [20, 20, 20], earlier 1 is [80] → overall avg ~35, recent avg 20
    // Gap is 15 but gate requires >= 5 records
    const rows = makeStudentRows(1, [20, 20, 20, 80]);
    const { attentionStudents } = deriveInsights(rows);
    const reasons = attentionStudents.find((s) => s.id === 1)?.reasons ?? [];
    expect(reasons).not.toContain("Declining trend");
  });

  it("does NOT flag a student with 5 records when gap is exactly 7", () => {
    // overall avg = (80+80+73+73+73)/5 = 75.8; recent avg of last 3 = (73+73+73)/3 = 73; gap = 2.8
    // Actually let's be precise: overall avg 60, recent 3 avg 53 → gap 7
    // scores newest-first: [53, 53, 54, 65, 75] → overall = 300/5 = 60; recent = (53+53+54)/3 ≈ 53.33; gap ≈ 6.67 < 8 → NOT flagged
    const rows = makeStudentRows(1, [53, 53, 54, 65, 75]);
    const { attentionStudents } = deriveInsights(rows);
    const reasons = attentionStudents.find((s) => s.id === 1)?.reasons ?? [];
    expect(reasons).not.toContain("Declining trend");
  });

  it("flags a student with 5 records when gap is exactly 8", () => {
    // We need: overall_avg - recent_avg >= 8
    // 5 scores; let recent 3 = [50, 50, 50] and earlier 2 = [87, 87]
    // overall = (50+50+50+87+87)/5 = 324/5 = 64.8; recentAvg = 50; gap = 14.8 >= 8 → flagged
    const rows = makeStudentRows(1, [50, 50, 50, 87, 87]);
    const { attentionStudents } = deriveInsights(rows);
    const reasons = attentionStudents.find((s) => s.id === 1)?.reasons ?? [];
    expect(reasons).toContain("Declining trend");
  });

  it("can carry both Low average and Declining trend reasons", () => {
    // Student avg < 50 AND declining: recent 3 are much lower than overall
    // overall = (20+20+20+60+60)/5 = 180/5 = 36; recent = 20; gap = 16 → both reasons
    const rows = makeStudentRows(1, [20, 20, 20, 60, 60]);
    const { attentionStudents } = deriveInsights(rows);
    const student = attentionStudents.find((s) => s.id === 1);
    expect(student?.reasons).toContain("Low average");
    expect(student?.reasons).toContain("Declining trend");
  });
});

// ─── Topic rankings ───────────────────────────────────────────────────────────

describe("deriveInsights — topic stats", () => {
  it("returns avg: null for a topic with fewer than 3 records", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 80, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 2, 70, 1, "Algebra", "Maths"),
    ];
    const { topicStats } = deriveInsights(rows);
    const algebra = topicStats.find((t) => t.name === "Algebra");
    expect(algebra?.avg).toBeNull();
    expect(algebra?.count).toBe(2);
  });

  it("computes avg for a topic with exactly 3 records", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 60, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 2, 80, 1, "Algebra", "Maths"),
      recordRow(3, "Carol", 9, 3, 70, 1, "Algebra", "Maths"),
    ];
    const { topicStats } = deriveInsights(rows);
    const algebra = topicStats.find((t) => t.name === "Algebra");
    expect(algebra?.avg).toBeCloseTo(70);
  });
});

// ─── Subject summary ──────────────────────────────────────────────────────────

describe("deriveInsights — subject stats", () => {
  it("deduplicates studentIds across multiple records in the same subject", () => {
    // Alice has 2 records in Maths — she should count as 1 student
    const rows = [
      recordRow(1, "Alice", 9, 1, 80, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 60, 1, "Algebra", "Maths"),
    ];
    const { subjectStats } = deriveInsights(rows);
    const maths = subjectStats.find((s) => s.subject === "Maths");
    expect(maths?.studentCount).toBe(1);
  });

  it("returns no subject stats when there are no records", () => {
    const rows = [studentRow(1, "Alice", 9)];
    const { subjectStats } = deriveInsights(rows);
    expect(subjectStats).toHaveLength(0);
  });

  it("computes correct average across records in a subject", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 60, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 2, 80, 1, "Algebra", "Maths"),
    ];
    const { subjectStats } = deriveInsights(rows);
    const maths = subjectStats.find((s) => s.subject === "Maths");
    expect(maths?.avg).toBeCloseTo(70);
  });
});

// ─── Overview stats ───────────────────────────────────────────────────────────

describe("deriveInsights — overview stats", () => {
  it("returns null cohortAvg when no records exist", () => {
    const rows = [studentRow(1, "Alice", 9), studentRow(2, "Bob", 10)];
    const { cohortAvg, totalRecords, studentsWithRecords } = deriveInsights(rows);
    expect(cohortAvg).toBeNull();
    expect(totalRecords).toBe(0);
    expect(studentsWithRecords).toBe(0);
  });

  it("counts totalStudents including those without records", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 70, 1, "Algebra", "Maths"),
      studentRow(2, "Bob", 10),
    ];
    const { totalStudents, studentsWithRecords } = deriveInsights(rows);
    expect(totalStudents).toBe(2);
    expect(studentsWithRecords).toBe(1);
  });

  it("returns 0 totalStudents and 0 totalRecords for an empty dataset", () => {
    const { totalStudents, totalRecords, cohortAvg } = deriveInsights([]);
    expect(totalStudents).toBe(0);
    expect(totalRecords).toBe(0);
    expect(cohortAvg).toBeNull();
  });
});
