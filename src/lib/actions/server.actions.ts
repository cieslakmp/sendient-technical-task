"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { progressRecords, students, topics } from "@/lib/db/schema";

import { z } from "zod";

const RecordProgressInput = z.object({
  studentId: z.number().int().positive(),
  topicId: z.number().int().positive(),
  score: z.number().min(0).max(100),
  notes: z.string().max(255).optional(),
});


// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function getStudents() {
  return db.select().from(students)
  .where(isNull(students.deletedAt))
  .orderBy(students.name).all();
}

export async function getStudent(id: number) {
  const row = db.select().from(students)
  .where(eq(students.id, id)).get();
  return row ?? null;
}

export async function createStudent(input: { name: string; yearGroup: number }) {
  const [row] = db
    .insert(students)
    .values({ name: input.name, yearGroup: input.yearGroup })
    .returning()
    .all();
  revalidatePath("/students");
  return row;
}

export async function deleteStudent(id: number) {
  db.update(students)
  .set({ deletedAt: new Date() })
  .where(eq(students.id, id))
  .run();
  revalidatePath("/students");
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export async function getTopics() {
  return db.select().from(topics)
  .where(isNull(topics.deletedAt))
  .orderBy(topics.subject, topics.name).all();
}

export async function createTopic(input: { name: string; subject: string }) {
  const [row] = db.insert(topics).values(input).returning().all();
  revalidatePath("/topics");
  return row;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export async function recordProgress(raw: unknown) {
  const input = RecordProgressInput.parse(raw);
  const [row] = db
    .insert(progressRecords)
    .values({
      studentId: input.studentId,
      topicId: input.topicId,
      score: input.score,
      notes: input.notes ?? null,
    })
    .returning()
    .all();
  revalidatePath(`/students/${input.studentId}`);
  return row;
}

export async function getProgressForStudent(studentId: number) {
  return db
    .select({
      id: progressRecords.id,
      score: progressRecords.score,
      notes: progressRecords.notes,
      recordedAt: progressRecords.recordedAt,
      topicId: progressRecords.topicId,
      topicName: topics.name,
      topicSubject: topics.subject,
    })
    .from(progressRecords)
    .innerJoin(topics, eq(progressRecords.topicId, topics.id))
    .where(
      and(
        eq(progressRecords.studentId, studentId),
        isNull(progressRecords.deletedAt)
      )
    )
    .orderBy(desc(progressRecords.recordedAt))
    .all();
}

export async function getAverageForStudent(studentId: number): Promise<number | null> {
  const rows = db
    .select({ score: progressRecords.score })
    .from(progressRecords)
    .where(
      and(
        eq(progressRecords.studentId, studentId),
        isNull(progressRecords.deletedAt)
      )
    )
    .all();
    if (rows.length === 0) return null;
  const total = rows.reduce((sum, r) => sum + r.score, 0);
  return total / rows.length;
}

// ---------------------------------------------------------------------------
// Internal admin helpers
// ---------------------------------------------------------------------------

// Used by the seed/reset flow. Wipes the table.
export async function _unsafeDeleteAllProgress(): Promise<void> {
  db.delete(progressRecords).run();
}
