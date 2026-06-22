# Audit Notes

_Fill this in as you go. See the README for what we're looking for._

## What I found

Issues Found
High severity
1. Division by zero → NaN shown to users
src/lib/actions/server.actions.ts / src/components/AverageScoreWidget.tsx

getAverageForStudent() returns total / rows.length. When a student has zero records, this is 0 / 0 = NaN. AverageScoreWidget calls .toFixed(1) on it with no guard, so "NaN" renders on the page.

2. recordProgress takes input: any with no validation
src/lib/actions/server.actions.ts

The FIXME on line 54 documents it: a teacher once entered "120" and it broke the badge display. Zod is a listed production dependency but is unused everywhere. Any score (negative, NaN, >100) passes straight to the DB.

3. Soft-delete columns exist but no query ever filters on them
server.actions.ts:12, 40, 72, 90

The schema comment says "callers should be soft-deleting and filtering here" — but none of the four read functions add WHERE deletedAt IS NULL. Deleted students appear in the student list, deleted topics appear in the topic picker, and deleted progress records are included in averages.

4. deleteStudent does a hard DELETE, not a soft delete
src/lib/actions/server.actions.ts

The schema has a deletedAt column on students for soft deletion, but deleteStudent() runs a hard db.delete(students). This also cascades and hard-deletes all that student's progress records.

Medium severity
5. students has two identical timestamp columns
src/lib/db/schema.ts

Both joinedAt and createdAt default to unixepoch() and are never set differently anywhere in the codebase. Their values are always identical.

6. Unique index includes soft-deleted rows
src/lib/db/schema.ts

The progress_per_student_topic_day unique index covers (studentId, topicId, recordedAt). The comment on line 56 flags it: soft-deleted records still occupy their slot, so re-recording the same student/topic/day after a soft-delete hits a constraint violation.

7. Foreign key cascade contradicts the soft-delete model
schema.ts:41, 44

onDelete: "cascade" on progress records means hard-deleting a student or topic permanently wipes history. The comment on line 40 itself flags this as an unresolved design decision.

8. No score range constraint at the DB level
src/lib/db/schema.ts / drizzle/0000_init.sql

score: real("score").notNull() accepts any float. There's no CHECK (score >= 0 AND score <= 100) in the schema or the migration SQL.

9. ScoreBadge uses hardcoded Tailwind colors, breaking dark mode
src/components/ScoreBadge.tsx

The file's own comment acknowledges this. It uses bg-red-100 text-red-700 etc. rather than the semantic CSS variables defined in globals.css. Dark mode is defined in the stylesheet but will never apply to this component.

10. Score input has no min/max and Number(score) can produce NaN
ProgressForm.tsx:83-89, 30

The <input type="number"> has no min="0" or max="100". On submit, Number(score) is called — if the field is empty or non-numeric, this produces NaN, which is stored unchecked.

11. Topic chips are mouse-only — keyboard inaccessible
src/components/ProgressForm.tsx

Topics are selected via <div onClick>. No role="button", no tabIndex, no onKeyDown. Keyboard users cannot select a topic.

12. classifyScore silently misclassifies invalid inputs
src/lib/scoring.ts

NaN >= 70 is false and NaN >= 50 is false, so NaN returns "low" silently. Scores above 100 return "high". Neither case errors or warns — bad data from the server is silently consumed.

Low severity
13. Hardcoded text-blue-600 in two places
src/app/students/[id]/page.tsx / src/app/students/page.tsx

Two "back" / "view" links use text-blue-600 directly instead of the text-primary semantic token.

14. Test suite has no out-of-range or integration coverage
tests/scoring.test.ts

Tests only cover valid boundary values (0, 49, 50, 69, 70, 99). Missing: negative scores, scores >100, NaN, any test for the documented PROG-42 bug, any test for getAverageForStudent() returning NaN on an empty student, and any soft-delete filtering tests.


## What I fixed and why

1. Division by zero in src\lib\actions\server.actions.ts and in the widget src\components\AverageScoreWidget.tsx handle the null by showing the dash.

2. Fix the fixme bug in src\lib\actions\server.actions.ts input: any removes TypeScript safety. Any input is accepted. Added a Zod schema. Replaced input: any.

3. Soft-delete columns exist but no query ever filters on them. Made changes to the queries.

4. deleteStudent does a hard delete, which is contradictory to soft-delete schema. The deleted students data should be retained and filtered out. 

5. students in the db schema has two identical time stamps on it. Both columns default to unixepoch() and nothing in the codebase sets them to different values. Remove joinedAt from the schema and generated new migration. Capturing just the creation time.

6. Found issue with unique index including soft-deleted rows but decided that since it is acknowledged in the schema.ts then it will be left. Fix could be applied since 3 and 4 have been implemented. But this would require a discussion with whoever wrote this code. 

7. Foreign key cascade contradicts soft-delete model. Changed the onDelete mode for students.id and topics.id to "restrict".

7. (2) Changes have broken the DB migration, reset and seeding. Added a SQLite table-recreation pattern.

10. Score input has no min or max and Number(score) can produce NaN. Changed the classify Score function and updated the tests at the same time.

14. Added missing edge-case testing and regression coverage.

## What I deferred and why

8. The Zod validation from #2 and the client-side guard from #10 both block invalid scores before they reach the DB. 

9. — ScoreBadge hardcoded Tailwind colors
Only matters if you plan to ship dark mode. If that's not on the roadmap, this is purely cosmetic and the app works perfectly with hardcoded colours.

11. — Topic chips are keyboard-inaccessible
Real accessibility concern, but fixing it properly means replacing the <div onClick> chips with radio buttons or adding role, tabIndex, and onKeyDown handlers — a meaningful refactor for a form that works fine with a mouse. Worth doing if this is a real product; fine to skip for a take-home.

12. — Hardcoded text-blue-600 in two link elements
Purely cosmetic. Two one-line changes to swap to text-primary. Doesn't affect correctness or behaviour at all — it's the kind of thing you'd fix in a design pass, not a bug fix session.

## What I'd argue is the biggest problem with the codebase

_(One paragraph. Pick the one that matters most.)_
