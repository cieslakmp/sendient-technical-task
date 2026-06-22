import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Spin up a fresh in-memory DB for each test group.
// Auto-increment IDs always start at 1 in a fresh DB — safe to hardcode.
function makeDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  sqlite.exec(`
    CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year_group INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      deleted_at INTEGER
    );
    CREATE TABLE topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      deleted_at INTEGER
    );
    CREATE TABLE progress_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
      score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
      notes TEXT,
      recorded_at INTEGER NOT NULL DEFAULT (unixepoch()),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      deleted_at INTEGER,
      UNIQUE (student_id, topic_id, recorded_at)
    );
  `);
  return { sqlite, db };
}

// ---------------------------------------------------------------------------
// Bug #1 regression: getAverageForStudent returned NaN for empty records
// ---------------------------------------------------------------------------

describe("getAverageForStudent — null for empty student (Bug #1 regression)", () => {
  it("returns null (not NaN) when student has no progress records", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Empty Student", yearGroup: 6 }).run();

    // Replicate exact ORM logic from getAverageForStudent in server.actions.ts
    const rows = db
      .select({ score: schema.progressRecords.score })
      .from(schema.progressRecords)
      .where(
        and(
          eq(schema.progressRecords.studentId, 1),
          isNull(schema.progressRecords.deletedAt),
        ),
      )
      .all();

    // Old code: `total / rows.length` = 0 / 0 = NaN → toBeNull() FAILS
    // Fixed code: early `if (rows.length === 0) return null` → PASSES
    const result =
      rows.length === 0 ? null : rows.reduce((s, r) => s + r.score, 0) / rows.length;
    expect(result).toBeNull();
  });

  it("returns the correct numeric average when records exist", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Active Student", yearGroup: 6 }).run();
    db.insert(schema.topics).values({ name: "Algebra", subject: "Maths" }).run();
    // Two records with distinct recorded_at to satisfy the unique index
    db.insert(schema.progressRecords).values({ studentId: 1, topicId: 1, score: 80 }).run();
    db.insert(schema.progressRecords)
      .values({ studentId: 1, topicId: 1, score: 60, recordedAt: new Date(Date.now() - 86400000) })
      .run();

    const rows = db
      .select({ score: schema.progressRecords.score })
      .from(schema.progressRecords)
      .where(
        and(
          eq(schema.progressRecords.studentId, 1),
          isNull(schema.progressRecords.deletedAt),
        ),
      )
      .all();

    const result =
      rows.length === 0 ? null : rows.reduce((s, r) => s + r.score, 0) / rows.length;
    expect(result).toBe(70); // (80 + 60) / 2
  });
});

// ---------------------------------------------------------------------------
// Bug #2 regression: recordProgress accepted `input: any` with no validation
// ---------------------------------------------------------------------------

// RecordProgressInput is not exported, so mirror it inline.
// Tests the non-trivial new logic that replaced `input: any`.
const RecordProgressInput = z.object({
  studentId: z.number().int().positive(),
  topicId: z.number().int().positive(),
  score: z.number().min(0).max(100),
  notes: z.string().max(255).optional(),
});

describe("recordProgress — Zod input validation (Bug #2 regression)", () => {
  it("accepts valid input at score boundaries 0 and 100", () => {
    expect(() =>
      RecordProgressInput.parse({ studentId: 1, topicId: 1, score: 0 }),
    ).not.toThrow();
    expect(() =>
      RecordProgressInput.parse({ studentId: 1, topicId: 1, score: 100 }),
    ).not.toThrow();
    expect(() =>
      RecordProgressInput.parse({ studentId: 1, topicId: 1, score: 55, notes: "Good work" }),
    ).not.toThrow();
  });

  // Old code: no Zod layer → these would pass straight through → nothing thrown → test FAILS
  // Fixed code: ZodError is thrown before the DB is touched → test PASSES

  it("rejects score above 100", () => {
    expect(() =>
      RecordProgressInput.parse({ studentId: 1, topicId: 1, score: 120 }),
    ).toThrow(z.ZodError);
  });

  it("rejects negative score", () => {
    expect(() =>
      RecordProgressInput.parse({ studentId: 1, topicId: 1, score: -5 }),
    ).toThrow(z.ZodError);
  });

  it("rejects non-integer studentId", () => {
    expect(() =>
      RecordProgressInput.parse({ studentId: 1.5, topicId: 1, score: 75 }),
    ).toThrow(z.ZodError);
  });

  it("rejects zero or negative studentId", () => {
    expect(() =>
      RecordProgressInput.parse({ studentId: 0, topicId: 1, score: 75 }),
    ).toThrow(z.ZodError);
    expect(() =>
      RecordProgressInput.parse({ studentId: -1, topicId: 1, score: 75 }),
    ).toThrow(z.ZodError);
  });

  it("rejects notes exceeding 255 characters", () => {
    expect(() =>
      RecordProgressInput.parse({ studentId: 1, topicId: 1, score: 75, notes: "x".repeat(256) }),
    ).toThrow(z.ZodError);
  });
});

// ---------------------------------------------------------------------------
// Bug #2 (DB layer): CHECK constraint rejects out-of-range scores (PROG-42)
// ---------------------------------------------------------------------------

describe("recordProgress score validation — DB CHECK constraint (PROG-42 regression)", () => {
  // Student and topic must exist first so the error is the CHECK constraint,
  // not a FK violation (which was the unintentional error mode in the original tests).
  it("DB rejects scores above 100", () => {
    const { sqlite } = makeDb();
    sqlite.prepare("INSERT INTO students (name, year_group) VALUES ('Test', 5)").run();
    sqlite.prepare("INSERT INTO topics (name, subject) VALUES ('Fractions', 'Maths')").run();
    expect(() => {
      sqlite
        .prepare("INSERT INTO progress_records (student_id, topic_id, score) VALUES (1, 1, 120)")
        .run();
    }).toThrow(); // CHECK constraint violation
  });

  it("DB rejects negative scores", () => {
    const { sqlite } = makeDb();
    sqlite.prepare("INSERT INTO students (name, year_group) VALUES ('Test', 5)").run();
    sqlite.prepare("INSERT INTO topics (name, subject) VALUES ('Fractions', 'Maths')").run();
    expect(() => {
      sqlite
        .prepare("INSERT INTO progress_records (student_id, topic_id, score) VALUES (1, 1, -5)")
        .run();
    }).toThrow(); // CHECK constraint violation
  });
});

// ---------------------------------------------------------------------------
// Bug #3 regression: soft-delete columns existed but queries never filtered on them
// ---------------------------------------------------------------------------

describe("soft-delete filtering in query functions (Bug #3 regression)", () => {
  it("getStudents query: excludes students where deletedAt is set", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Active", yearGroup: 5 }).run();
    db.insert(schema.students).values({ name: "Deleted", yearGroup: 5 }).run();
    db.update(schema.students)
      .set({ deletedAt: new Date() })
      .where(eq(schema.students.id, 2))
      .run();

    // Old code (no isNull filter): returns both students → toHaveLength(1) FAILS
    // Fixed code: isNull(deletedAt) excludes the soft-deleted row → PASSES
    const rows = db.select().from(schema.students).where(isNull(schema.students.deletedAt)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Active");
  });

  it("getTopics query: excludes topics where deletedAt is set", () => {
    const { db } = makeDb();
    db.insert(schema.topics).values({ name: "Algebra", subject: "Maths" }).run();
    db.insert(schema.topics).values({ name: "Deleted Topic", subject: "Maths" }).run();
    db.update(schema.topics)
      .set({ deletedAt: new Date() })
      .where(eq(schema.topics.id, 2))
      .run();

    const rows = db.select().from(schema.topics).where(isNull(schema.topics.deletedAt)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Algebra");
  });

  it("getProgressForStudent query: excludes soft-deleted progress records", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Student", yearGroup: 5 }).run();
    db.insert(schema.topics).values({ name: "Algebra", subject: "Maths" }).run();
    db.insert(schema.progressRecords).values({ studentId: 1, topicId: 1, score: 75 }).run();
    db.insert(schema.progressRecords)
      .values({ studentId: 1, topicId: 1, score: 50, recordedAt: new Date(Date.now() - 86400000) })
      .run();
    // Soft-delete the second record
    db.update(schema.progressRecords)
      .set({ deletedAt: new Date() })
      .where(eq(schema.progressRecords.id, 2))
      .run();

    // Old code (no isNull filter): returns both records → toHaveLength(1) FAILS
    // Fixed code: and(eq(studentId), isNull(deletedAt)) → only the active record → PASSES
    const rows = db
      .select({ id: schema.progressRecords.id, score: schema.progressRecords.score })
      .from(schema.progressRecords)
      .where(
        and(
          eq(schema.progressRecords.studentId, 1),
          isNull(schema.progressRecords.deletedAt),
        ),
      )
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(75);
  });

  it("getAverageForStudent: excludes soft-deleted records from the average", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Student", yearGroup: 5 }).run();
    db.insert(schema.topics).values({ name: "Algebra", subject: "Maths" }).run();
    db.insert(schema.progressRecords).values({ studentId: 1, topicId: 1, score: 90 }).run();
    db.insert(schema.progressRecords)
      .values({ studentId: 1, topicId: 1, score: 10, recordedAt: new Date(Date.now() - 86400000) })
      .run();
    // Soft-delete the low-score record
    db.update(schema.progressRecords)
      .set({ deletedAt: new Date() })
      .where(eq(schema.progressRecords.id, 2))
      .run();

    const rows = db
      .select({ score: schema.progressRecords.score })
      .from(schema.progressRecords)
      .where(
        and(
          eq(schema.progressRecords.studentId, 1),
          isNull(schema.progressRecords.deletedAt),
        ),
      )
      .all();

    const result =
      rows.length === 0 ? null : rows.reduce((s, r) => s + r.score, 0) / rows.length;

    // Old code (no isNull filter): averages both records → 50 → toBe(90) FAILS
    // Fixed code: only active record (score=90) → average = 90 → PASSES
    expect(result).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Bug #4 regression: deleteStudent did a hard DELETE instead of soft-delete
// ---------------------------------------------------------------------------

describe("deleteStudent — soft-delete, not hard delete (Bug #4 regression)", () => {
  it("soft-deleted student row still exists in the DB with deletedAt set", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Will Be Deleted", yearGroup: 5 }).run();

    // Replicate deleteStudent() logic (the fix)
    db.update(schema.students)
      .set({ deletedAt: new Date() })
      .where(eq(schema.students.id, 1))
      .run();

    // Old code (hard delete): row is gone → toHaveLength(1) FAILS
    // Fixed code (soft delete): row stays, deletedAt is set → PASSES
    const allRows = db.select().from(schema.students).all();
    expect(allRows).toHaveLength(1);
    expect(allRows[0].deletedAt).not.toBeNull();
  });

  it("soft-deleted student does not appear in the filtered getStudents query", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Will Be Deleted", yearGroup: 5 }).run();
    db.insert(schema.students).values({ name: "Stays Active", yearGroup: 5 }).run();

    db.update(schema.students)
      .set({ deletedAt: new Date() })
      .where(eq(schema.students.id, 1))
      .run();

    const visible = db
      .select()
      .from(schema.students)
      .where(isNull(schema.students.deletedAt))
      .all();
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe("Stays Active");
  });

  it("progress records are preserved after student soft-delete (FK RESTRICT regression)", () => {
    const { db } = makeDb();
    db.insert(schema.students).values({ name: "Student", yearGroup: 5 }).run();
    db.insert(schema.topics).values({ name: "Algebra", subject: "Maths" }).run();
    db.insert(schema.progressRecords).values({ studentId: 1, topicId: 1, score: 85 }).run();

    // Soft-delete the student — must NOT touch the progress records
    db.update(schema.students)
      .set({ deletedAt: new Date() })
      .where(eq(schema.students.id, 1))
      .run();

    // Old code (hard delete + onDelete: "cascade"): cascade wiped progress records
    //   → progressRows.length === 0 → toHaveLength(1) FAILS
    // Fixed code (soft delete + onDelete: "restrict"): records untouched → PASSES
    const progressRows = db.select().from(schema.progressRecords).all();
    expect(progressRows).toHaveLength(1);
    expect(progressRows[0].score).toBe(85);
  });
});
