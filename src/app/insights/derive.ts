import type { CohortInsightsRow } from "@/lib/actions/server.actions";

type StudentEntry = {
  id: number;
  name: string;
  yearGroup: number;
  records: Array<{ score: number; recordedAt: Date }>;
};

type BandStudent = { id: number; name: string };

export type InsightsData = {
  totalStudents: number;
  totalRecords: number;
  studentsWithRecords: number;
  cohortAvg: number | null;
  bandCounts: { strong: number; good: number; mid: number; low: number; veryLow: number; none: number };
  studentsByBand: { strong: BandStudent[]; good: BandStudent[]; mid: BandStudent[]; low: BandStudent[]; veryLow: BandStudent[]; none: BandStudent[] };
  subjectStats: Array<{ subject: string; avg: number; studentCount: number }>;
  topicStats: Array<{ name: string; subject: string; count: number; avg: number | null }>;
  attentionStudents: Array<{
    id: number;
    name: string;
    yearGroup: number;
    avg: number;
    reasons: string[];
  }>;
};

export function deriveInsights(rows: CohortInsightsRow[]): InsightsData {
  // Group rows by student. Records arrive newest-first per student (ORDER BY desc recordedAt).
  const studentMap = new Map<number, StudentEntry>();
  for (const row of rows) {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, {
        id: row.studentId,
        name: row.studentName,
        yearGroup: row.studentYearGroup,
        records: [],
      });
    }
    if (row.recordId !== null) {
      studentMap.get(row.studentId)!.records.push({
        score: row.score!,
        recordedAt: row.recordedAt!,
      });
    }
  }

  // Per-student averages (null = no records)
  const studentAvgMap = new Map<number, number | null>();
  for (const [id, { records }] of studentMap) {
    if (records.length === 0) {
      studentAvgMap.set(id, null);
    } else {
      const sum = records.reduce((acc, r) => acc + r.score, 0);
      studentAvgMap.set(id, sum / records.length);
    }
  }

  // Overview stats
  const totalStudents = studentMap.size;
  const totalRecords = rows.filter((r) => r.recordId !== null).length;
  const allAvgs = [...studentAvgMap.values()].filter((v): v is number => v !== null);
  const studentsWithRecords = allAvgs.length;
  const cohortAvg =
    allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : null;

  // Band distribution — 5 finer bands so a cohort clustered in one range still shows structure.
  // Not using classifyScore() because it throws on null and only has 3 bands.
  const bandCounts = { strong: 0, good: 0, mid: 0, low: 0, veryLow: 0, none: 0 };
  const studentsByBand: InsightsData["studentsByBand"] = {
    strong: [], good: [], mid: [], low: [], veryLow: [], none: [],
  };
  for (const [id, { name }] of studentMap) {
    const avg = studentAvgMap.get(id)!;
    const entry: BandStudent = { id, name };
    if (avg === null)   { bandCounts.none++;    studentsByBand.none.push(entry); }
    else if (avg >= 80) { bandCounts.strong++;  studentsByBand.strong.push(entry); }
    else if (avg >= 65) { bandCounts.good++;    studentsByBand.good.push(entry); }
    else if (avg >= 50) { bandCounts.mid++;     studentsByBand.mid.push(entry); }
    else if (avg >= 35) { bandCounts.low++;     studentsByBand.low.push(entry); }
    else                { bandCounts.veryLow++; studentsByBand.veryLow.push(entry); }
  }
  for (const list of Object.values(studentsByBand)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Subject summary
  const subjectMap = new Map<string, { scores: number[]; studentIds: Set<number> }>();
  for (const row of rows) {
    if (row.recordId === null || row.topicSubject === null) continue;
    if (!subjectMap.has(row.topicSubject)) {
      subjectMap.set(row.topicSubject, { scores: [], studentIds: new Set() });
    }
    const entry = subjectMap.get(row.topicSubject)!;
    entry.scores.push(row.score!);
    entry.studentIds.add(row.studentId);
  }
  const subjectStats = [...subjectMap.entries()]
    .map(([subject, { scores, studentIds }]) => ({
      subject,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      studentCount: studentIds.size,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  // Topic stats — avg is null when < 3 records (insufficient for a reliable figure)
  const topicMap = new Map<number, { name: string; subject: string; scores: number[] }>();
  for (const row of rows) {
    if (row.recordId === null || row.topicId === null) continue;
    if (!topicMap.has(row.topicId)) {
      topicMap.set(row.topicId, {
        name: row.topicName!,
        subject: row.topicSubject!,
        scores: [],
      });
    }
    topicMap.get(row.topicId)!.scores.push(row.score!);
  }
  const topicStats = [...topicMap.values()].map((t) => ({
    name: t.name,
    subject: t.subject,
    count: t.scores.length,
    avg: t.scores.length >= 3 ? t.scores.reduce((a, b) => a + b, 0) / t.scores.length : null,
  }));

  // Students needing attention
  const attentionStudents: InsightsData["attentionStudents"] = [];
  for (const [id, { name, yearGroup, records }] of studentMap) {
    const avg = studentAvgMap.get(id)!;
    if (avg === null) continue;

    const reasons: string[] = [];

    if (avg < 50) {
      reasons.push("Low average");
    }

    // Declining trend: requires >= 5 records to avoid false alarms on sparse data.
    // Records are newest-first from the query, so slice(0,3) is the recent window.
    if (records.length >= 5) {
      const recentScores = records.slice(0, 3).map((r) => r.score);
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      if (avg - recentAvg >= 8) {
        reasons.push("Declining trend");
      }
    }

    if (reasons.length > 0) {
      attentionStudents.push({ id, name, yearGroup, avg, reasons });
    }
  }
  attentionStudents.sort((a, b) => a.avg - b.avg);

  return {
    totalStudents,
    totalRecords,
    studentsWithRecords,
    cohortAvg,
    bandCounts,
    studentsByBand,
    subjectStats,
    topicStats,
    attentionStudents,
  };
}
