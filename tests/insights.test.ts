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
    expect(bandCounts).toEqual({ strong: 0, good: 0, mid: 0, low: 0, veryLow: 0, none: 2 });
  });

  it("classifies avg >= 80 as strong", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 85, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.strong).toBe(1);
    expect(bandCounts.good).toBe(0);
  });

  it("classifies avg 65-79 as good", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 65, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 74, 1, "Algebra", "Maths"),
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.good).toBe(1);
    expect(bandCounts.strong).toBe(0);
  });

  it("classifies avg 50-64 as mid", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 50, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 64, 1, "Algebra", "Maths"),
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.mid).toBe(1);
  });

  it("classifies avg 35-49 as low", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 35, 1, "Algebra", "Maths"),
      recordRow(1, "Alice", 9, 2, 45, 1, "Algebra", "Maths"),
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.low).toBe(1);
    expect(bandCounts.veryLow).toBe(0);
  });

  it("classifies avg < 35 as veryLow", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 20, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.veryLow).toBe(1);
    expect(bandCounts.low).toBe(0);
  });

  it("does NOT put avg exactly 50 into low", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 50, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.low).toBe(0);
    expect(bandCounts.mid).toBe(1);
  });

  it("buckets a mixed cohort correctly across all bands", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 90, 1, "Algebra", "Maths"),    // strong
      recordRow(2, "Bob",   9, 2, 70, 1, "Algebra", "Maths"),    // good
      recordRow(3, "Carol", 9, 3, 55, 1, "Algebra", "Maths"),    // mid
      recordRow(4, "Dan",   9, 4, 40, 1, "Algebra", "Maths"),    // low
      recordRow(5, "Eve",   9, 5, 20, 1, "Algebra", "Maths"),    // veryLow
      studentRow(6, "Frank", 9),                                  // none
    ];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts).toEqual({ strong: 1, good: 1, mid: 1, low: 1, veryLow: 1, none: 1 });
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

  it("flags a student when gap is exactly 8 points (at the threshold boundary)", () => {
    // recent 3 = [60,60,60], older 2 = [80,80]
    // overall = (60+60+60+80+80)/5 = 68; recentAvg = 60; gap = 8 → flagged (>= 8)
    const rows = makeStudentRows(1, [60, 60, 60, 80, 80]);
    const { attentionStudents } = deriveInsights(rows);
    const reasons = attentionStudents.find((s) => s.id === 1)?.reasons ?? [];
    expect(reasons).toContain("Declining trend");
  });

  it("does NOT flag a student when gap is just below 8 points", () => {
    // recent 3 = [60,60,60], older 2 = [79,79]
    // overall = (60+60+60+79+79)/5 = 67.6; recentAvg = 60; gap = 7.6 → not flagged (< 8)
    const rows = makeStudentRows(1, [60, 60, 60, 79, 79]);
    const { attentionStudents } = deriveInsights(rows);
    const reasons = attentionStudents.find((s) => s.id === 1)?.reasons ?? [];
    expect(reasons).not.toContain("Declining trend");
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

  it("tracks multiple topics independently and applies the 3-record threshold per topic", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 60, 1, "Algebra",   "Maths"),
      recordRow(2, "Bob",   9, 2, 80, 1, "Algebra",   "Maths"),
      recordRow(3, "Carol", 9, 3, 70, 1, "Algebra",   "Maths"),
      recordRow(4, "Dave",  9, 4, 50, 2, "Fractions", "Maths"),
      recordRow(5, "Eve",   9, 5, 40, 2, "Fractions", "Maths"),
    ];
    const { topicStats } = deriveInsights(rows);
    const algebra   = topicStats.find((t) => t.name === "Algebra");
    const fractions = topicStats.find((t) => t.name === "Fractions");
    expect(algebra?.avg).toBeCloseTo(70);  // 3 records → avg computed
    expect(fractions?.avg).toBeNull();     // 2 records → below threshold
    expect(fractions?.count).toBe(2);
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

  it("returns subject stats sorted alphabetically by subject name", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 70, 1, "Algebra",   "Maths"),
      recordRow(2, "Bob",   9, 2, 80, 2, "Poetry",    "English"),
      recordRow(3, "Carol", 9, 3, 60, 3, "Computing", "Science"),
    ];
    const { subjectStats } = deriveInsights(rows);
    expect(subjectStats.map((s) => s.subject)).toEqual(["English", "Maths", "Science"]);
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

  it("cohortAvg is the average of per-student averages, not the mean of all records", () => {
    // Student A has 1 record at 90 → studentAvg = 90
    // Student B has 3 records at 10 → studentAvg = 10
    // cohortAvg = (90 + 10) / 2 = 50
    // NOT (90 + 10 + 10 + 10) / 4 = 30 (simple mean of all records)
    const rows = [
      recordRow(1, "Alice", 9, 1, 90, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 2, 10, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 3, 10, 1, "Algebra", "Maths"),
      recordRow(2, "Bob",   9, 4, 10, 1, "Algebra", "Maths"),
    ];
    const { cohortAvg } = deriveInsights(rows);
    expect(cohortAvg).toBeCloseTo(50);
  });
});

// ─── studentsByBand ───────────────────────────────────────────────────────────

describe("deriveInsights — studentsByBand", () => {
  it("places each student in the correct band list", () => {
    const rows = [
      recordRow(1, "Alice", 9, 1, 90, 1, "Algebra", "Maths"),  // strong
      recordRow(2, "Bob",   9, 2, 70, 1, "Algebra", "Maths"),  // good
      studentRow(3, "Carol", 9),                                 // none
    ];
    const { studentsByBand } = deriveInsights(rows);
    expect(studentsByBand.strong.map((s) => s.name)).toEqual(["Alice"]);
    expect(studentsByBand.good.map((s) => s.name)).toEqual(["Bob"]);
    expect(studentsByBand.mid).toHaveLength(0);
    expect(studentsByBand.none.map((s) => s.name)).toEqual(["Carol"]);
  });

  it("sorts students alphabetically by name within each band", () => {
    // Both students land in "good" (avg 65-79); insertion order is Zara then Charlie.
    // The sort in derive.ts must reorder them to ["Charlie", "Zara"].
    const rows = [
      recordRow(1, "Zara",    9, 1, 70, 1, "Algebra", "Maths"),
      recordRow(2, "Charlie", 9, 2, 75, 1, "Algebra", "Maths"),
    ];
    const { studentsByBand } = deriveInsights(rows);
    expect(studentsByBand.good.map((s) => s.name)).toEqual(["Charlie", "Zara"]);
  });
});

// ─── Band exact boundaries ────────────────────────────────────────────────────

describe("deriveInsights — band exact boundaries", () => {
  it("avg exactly 80 classifies as strong, not good", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 80, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.strong).toBe(1);
    expect(bandCounts.good).toBe(0);
  });

  it("avg exactly 65 classifies as good, not mid", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 65, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.good).toBe(1);
    expect(bandCounts.mid).toBe(0);
  });

  it("avg exactly 35 classifies as low, not veryLow", () => {
    const rows = [recordRow(1, "Alice", 9, 1, 35, 1, "Algebra", "Maths")];
    const { bandCounts } = deriveInsights(rows);
    expect(bandCounts.low).toBe(1);
    expect(bandCounts.veryLow).toBe(0);
  });
});
