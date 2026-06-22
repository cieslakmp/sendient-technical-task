"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { recordProgress } from "@/lib/actions/server.actions";
import type { Student, Topic } from "@/lib/db/schema";

interface ProgressFormProps {
  readonly students: ReadonlyArray<Student>;
  readonly topics: ReadonlyArray<Topic>;
}

export function ProgressForm({ students, topics }: ProgressFormProps) {
  const router = useRouter();
  const [studentId, setStudentId] = useState<number | null>(null);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (studentId == null || topicId == null) return;
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) return;
    startTransition(async () => {
      await recordProgress({
        studentId,
        topicId,
        score: Number(score),
        notes: notes || null,
      });
      router.push(`/students/${studentId}`);
    });
  }

  return (
    <Card>
      <CardTitle>New record</CardTitle>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Student</p>
          <select
            value={studentId ?? ""}
            onChange={(e) => setStudentId(Number(e.target.value) || null)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Select a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Year {s.yearGroup})
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Topic</p>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const selected = topicId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTopicId(t.id)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1 text-xs",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {t.subject} · {t.name}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Score</p>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="0 – 100"
            className="h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Notes (optional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={pending || studentId == null || topicId == null}
          >
            {pending ? "Saving…" : "Save record"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
