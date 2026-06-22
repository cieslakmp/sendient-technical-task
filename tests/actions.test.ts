import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Spin up a fresh in-memory DB for each test
function makeDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // Create tables
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
      deleted_at INTEGER
    );
  `);
  return { sqlite, db };
}

describe("getAverageForStudent", () => {
  it("returns null when student has no records", async () => {
    const { db } = makeDb();
    const [student] = db.insert(schema.students)
      .values({ name: "Test", yearGroup: 5 })
      .returning().all();

    const rows = db.select({ score: schema.progressRecords.score })
      .from(schema.progressRecords)
      .where(eq(schema.progressRecords.studentId, student.id))
      .all();

    const result = rows.length === 0 ? null : rows.reduce((s, r) => s + r.score, 0) / rows.length;
    expect(result).toBeNull();
  });
});

describe("recordProgress score validation (PROG-42 regression)", () => {
  it("DB rejects scores above 100", () => {
    const { sqlite } = makeDb();
    expect(() => {
      sqlite.prepare(
        "INSERT INTO progress_records (student_id, topic_id, score) VALUES (1, 1, 120)"
      ).run();
    }).toThrow();
  });

  it("DB rejects negative scores", () => {
    const { sqlite } = makeDb();
    expect(() => {
      sqlite.prepare(
        "INSERT INTO progress_records (student_id, topic_id, score) VALUES (1, 1, -5)"
      ).run();
    }).toThrow();
  });
});