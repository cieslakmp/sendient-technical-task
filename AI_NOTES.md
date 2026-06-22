# AI Notes

This file is required. We use it to understand how you collaborated with AI tools. **Please be specific** — generic statements like "I used Claude to write some code" don't tell us anything.

Aim for ~10 minutes on this. Quality over length.

---

## 1. Tools you used

Which AI tools did you reach for, and for what kinds of work? (e.g., Claude Code / Cursor / ChatGPT / Copilot, used for architecture sketching / code generation / test scaffolding / refactor proposals / domain research, etc.)

> Used Claude Code, opted for using Sonnet 4.6 at High effort setting to save token usage. I used it to do exploratory work on the codebase and give me a quick insights into the architecture and each of the components. I quickly created plans for each of the tasks and was able to review them efficiently. I treated AI as a pair programming colleague which has ability to quickly propose code snippets, and test scaffolding. Apart from planning I used both context and memory to limit token usage. Context was transferred between different claude sessions and updated once major changes: bug fixes or feature implementation have been made. 

---

## 2. Where AI took you further than you could have gone alone

This is the part we care most about. Pick **one or two specific things** in your submission that you would not have delivered (or would not have delivered at this quality) in the time available without AI.

For each one:

- **What it is** (point at file/line if possible).
- **Where AI helped** — the prompt or interaction shape, the suggestion, the option-generation, whatever it was.
- **What you did to verify it** — read it carefully, ran tests, sanity-checked the edge case, rejected one of the options it gave, etc.

> Writing tests for the insights page (tests/insights.test.ts) takes a thorough understanding of not just what the code does, but where the subtle edge cases are. The page already had 24 tests — AI helped me find what was missing rather than what was obvious. The most useful thing it did was spot that studentsByBand had zero test coverage despite being the data behind the chart's hover tooltips, and that two existing "declining trend" tests had misleading names — one labelled "gap is exactly 8" was actually exercising a gap of 14.8, so the real boundary was never tested. It also flagged that cohortAvg has a semantic worth pinning down: it's the average of per-student averages, not the mean of all records — easy to miss, easy to get wrong in a future refactor. I verified each addition by checking the arithmetic in the comments against the code in derive.ts before running the suite, which is also how I caught that the existing tests were testing the right outcome for the wrong reason.

---

## 3. Where AI was wrong, shallow, or unhelpful

What did AI get wrong, miss, or oversimplify? What did you have to correct? Where did you decide to *not* take its suggestion?

> Definately scaffoling the UI for the new page. I had to go over a few iterations of the proposed layouts. Had I had more time I would have used Claude Design to create a visually appealing page. The simplicity of the created dashboard was done on purpose, to allow a teacher or a somebody who hasn't been onboarded to quickly gain insights into cohorts performance. 

---

## 4. If you had another hour, what would you have done with it?

Specifically — what would AI have helped you do in that hour that you didn't get to?

> I'd fix the one issue I flagged as the biggest remaining problem: the unique index including soft-deleted rows. Right now a teacher can't correct a wrong entry — soft-deleting it and re-recording hits a constraint violation because the deleted row still holds its slot. The fix is a single migration adding WHERE deleted_at IS NULL to make it a partial index, and a regression test to prove the re-record workflow actually works. That's maybe twenty minutes of work but it closes the gap between what the soft-delete model promises and what it delivers. Then I would use AI to scan the entire codebase to make sure it passes Sendient requirements ( which I just noticed at the bottom of the Github page). 
