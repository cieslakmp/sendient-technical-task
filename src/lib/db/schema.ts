import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  yearGroup: integer("year_group").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  // Intentionally present: callers should be soft-deleting and filtering here.
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const topics = sqliteTable("topics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const progressRecords = sqliteTable(
  "progress_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      // NOTE: cascade vs restrict is one of the things to think about.
      .references(() => students.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    notes: text("notes"),
    recordedAt: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (t) => ({
    // One entry per (student, topic, day). Note: this index does not
    // distinguish deleted rows from active rows.
    perStudentTopicDay: uniqueIndex("progress_per_student_topic_day").on(
      t.studentId,
      t.topicId,
      t.recordedAt,
    ),
  }),
);

export type Student = typeof students.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type ProgressRecord = typeof progressRecords.$inferSelect;
