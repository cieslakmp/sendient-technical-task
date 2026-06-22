# Audit Notes

_Fill this in as you go. See the README for what we're looking for._

## What I found

1. Division by zero in src\lib\actions\server.actions.ts and in the widget src\components\AverageScoreWidget.tsx handle the null by showing the dash.

2. Fix the fixme bug in src\lib\actions\server.actions.ts input: any removes TypeScript safety. Any input is accepted. Added a Zod schema. Replaced input: any.

3. Soft-delete columns exist but no query ever filters on them. Made changes to the queries.

4. deleteStudent does a hard delete, which is contradictory to soft-delete schema. The deleted students data should be retained and filtered out. 

5. students in the db schema has two identical time stamps on it. Both columns default to unixepoch() and nothing in the codebase sets them to different values. Remove joinedAt from the schema and generated new migration. Capturing just the creation time.

6. Found issue with unique index including soft-deleted rows but decided that since it is acknowledged in the schema.ts then it will be left. Fix could be applied since 3 and 4 have been implemented. But this would require a discussion with whoever wrote this code. 

7. Foreign key cascade contradicts soft-delete model. Changed the onDelete mode for students.id and topics.id to "restrict".

## What I fixed and why

_(For each fix: where it was, what was wrong, and why this one was worth fixing first.)_

## What I deferred and why

_(Anything you spotted but chose not to fix — and what would push it up the priority list.)_

## What I'd argue is the biggest problem with the codebase

_(One paragraph. Pick the one that matters most.)_
