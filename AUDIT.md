# Audit Notes

_Fill this in as you go. See the README for what we're looking for._

## What I found

1. Division by zero in src\lib\actions\server.actions.ts and in the widget src\components\AverageScoreWidget.tsx handle the null by showing the dash.

2. Fix the fixme bug in src\lib\actions\server.actions.ts input: any removes TypeScript safety. Any input is accepted. Added a Zod schema. Replaced input: any.

3. Soft-delete columns exist but no query ever filters on them. Made changes to the queries.

## What I fixed and why

_(For each fix: where it was, what was wrong, and why this one was worth fixing first.)_

## What I deferred and why

_(Anything you spotted but chose not to fix — and what would push it up the priority list.)_

## What I'd argue is the biggest problem with the codebase

_(One paragraph. Pick the one that matters most.)_
