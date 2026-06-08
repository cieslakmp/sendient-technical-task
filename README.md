# Progress Tracker — Engineering Take-Home

Thanks for your time. This is a short, self-contained task designed to take **2–3 hours**. We're not looking for a polished product — we're looking for how you think, where you raise the bar, and how effectively you collaborate with AI tools to deliver more than you could alone.

---

## What this app is

A small Next.js app for tracking student progress across topics. There are three pages already wired up:

- `/students` — list of students
- `/students/[id]` — student detail with their progress log and a few summary widgets
- `/topics` — topics grouped by subject
- `/progress/new` — form to record a new progress entry

The data layer is **SQLite via Drizzle ORM**. No external services, no auth, no Docker. Just `pnpm install` and go.

---

## Getting the code

Please **fork this repository to your own GitHub account** rather than cloning it directly — that way you can push your work to your fork as you go, and submit by sharing the link to your fork.

1. Click the **Fork** button at the top right of [github.com/Sendient/sendient-technical-task](https://github.com/Sendient/sendient-technical-task).
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/sendient-technical-task.git
   cd sendient-technical-task
   ```
3. Work on whichever branch makes sense to you (main is fine for a take-home).

## Setup

```bash
pnpm install
pnpm db:migrate     # creates data.db with the schema
pnpm db:seed        # populates ~12 students, ~8 topics, ~380 progress records
pnpm dev            # http://localhost:3000
pnpm test           # vitest
```

If you ever want a clean slate: `pnpm db:reset`.

> **Node version**: 20 or newer. A `.nvmrc` is included (`nvm use` picks Node 22, the default we target). `better-sqlite3` ships prebuilt binaries for all current Node major versions, so installs should be quick and not require a C++ toolchain.
>
> **Windows / macOS / Linux** are all supported. On Windows we recommend PowerShell or Windows Terminal; the scripts are written to be shell-agnostic. If you use Git Bash, you may want `git config --global core.autocrlf input` to keep line endings consistent (a `.gitattributes` is included that normalises this for the repo).

---

## What we're asking you to do

The task has **three parts** plus a reflection. Aim for ~2–3 hours total. We're not expecting all three parts to be exhaustively done — we'd rather see good judgement about how to spend the time than a half-finished attempt at everything.

### 1. Audit and fix (≈45 min)

The starter repo is intentionally imperfect. There are several issues across the codebase — some structural, some subtle, some easy. You don't have to find them all. **Find what you can, fix the ones that matter, and write down what you'd defer and why.**

Put your audit notes in `AUDIT.md` at the repo root. We're interested in:

- What you found.
- What you chose to fix (and why those).
- What you chose to leave (and why).
- Anything you'd argue is the most important problem with the codebase.

### 2. Add a feature: Cohort Insights (≈75 min)

Add a new page at `/insights` showing **cohort-level analytics** across all students. There is no scaffolding for this page — you decide what it looks like and what it shows. Some ideas to anchor your thinking (you don't have to do all of them, and you can do something different):

- Distribution of average scores across the cohort (e.g., terciles, histogram).
- Topics where the cohort is strongest / weakest.
- Students who may need attention (e.g., consistently in the bottom band, or trending down across recent records).
- Per-subject summary cards.

The aim is to surface **something an actual teacher would find useful**, not just a render of an array. Think about empty states, small-sample edge cases, and what would mislead a teacher if you got it wrong.

### 3. Tests (≈30 min)

- At least **one regression test** that exercises a bug you fixed (it should fail before your fix and pass after).
- Tests for any non-trivial logic in your new feature.

### 4. AI reflection (≈10 min)

Fill in `AI_NOTES.md` (template provided). This is **important** to us — see the next section.

---

## How we evaluate AI use

You should assume that **using AI is expected**, not optional. Everyone we hire uses AI tools heavily. What we're evaluating is whether you use them **ambitiously**:

- Did you reach for AI to do things you couldn't comfortably have done alone in 2–3 hours?
- Did AI let you go wider (find more issues, write more tests, polish more UI) or deeper (work on a part of the stack you're weaker on) than you would have unaided?
- Where did you verify AI output rather than ship it blindly?
- Where did AI suggest something you rejected, and why?

`AI_NOTES.md` is where you show us. Be specific — point at files and lines. The strongest submissions explicitly call out **one or two things they wouldn't have delivered without AI**, and what they did to ensure those things were correct.

A submission that's clearly AI-shaped but lacks any sign of human judgement (inconsistent style, mismatched conventions, code that doesn't actually run, plausible-looking nonsense) will not score well. Neither will one that obviously avoided AI to play it safe.

---

## Conventions we like

You'll see these in the starter repo — please follow them in your additions:

- **TypeScript strict, no `any`.** Use `unknown` and narrow.
- **British English** in user-facing strings and comments.
- **Semantic colour tokens** (`text-success`, `bg-error`, `text-muted-foreground`) rather than raw Tailwind palette classes (`text-red-500`). Tokens are defined in `globals.css` for both light and dark mode.
- **Server actions** live in `src/lib/actions/*.actions.ts`. Keep files focused; large kitchen-sink files hurt cold-start compile times in Next.js.
- **Zod** at boundaries (user input, server action arguments, anything coming from outside the function).
- **Soft delete + filter on `deletedAt IS NULL`** rather than hard delete, where the entity has audit value.
- **Tests** for behaviour, not implementation. Regression tests for bugs are a hard expectation.

---

## Submitting

Push your work to your fork on GitHub and reply with the link. Useful commit history is a positive signal — small, focused commits with conventional prefixes (`fix:`, `feat:`, `test:`, `refactor:`) read better than one giant "done" commit.

If for any reason you can't use GitHub, zip the project (excluding `node_modules`, `.next`, and `data.db`) and email it instead.

Either way, please include:

- `AUDIT.md`
- `AI_NOTES.md`
- A short note (in your message or a `SUBMISSION.md`) on what you ran out of time to do.

Good luck, and have fun.
