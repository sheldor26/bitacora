# The loop

Five files, each read at a different moment. That separation is the whole
design — merging any two of them means always reading twice as much as the
moment requires.

## STATE.md — read first, written last

The snapshot. What exists, what is half-done, what is next, and what is
knowingly broken. A session that starts cold reads this and nothing else, and
should be able to resume without asking a question.

It is **not** a diary. The single most common failure is letting it accumulate
session notes until it is two thousand lines of history with the current state
buried in it. That is why it has a 200-line budget and why `doctor` enforces it:
when the file starts telling stories, the stories belong in the logs.

The `updated:` line matters more than it looks. A stale snapshot is worse than
none, because the agent has no way to know it is stale — it will confidently act
on a picture of the project from three weeks ago. Two weeks old is a warning by
default.

**Write specifically.** "Halfway through checkout" is worthless. "Form validates
and submits; the Stripe webhook handler in `app/api/stripe/route.ts` is an empty
function" is a session that resumes in thirty seconds.

## MISTAKES.md — read defensively, before touching a risky area

Three fields, and the third is the one that matters.

- **What happened** — concrete, no blame, enough detail to recognise the shape
  of it again.
- **Root cause** — why it was *possible*, not what broke. "The importer
  overwrote the value" is what broke. "Nothing distinguished a verified value
  from a scraped one" is why it was possible.
- **Guardrail** — the check, test, type or rule that makes the same failure
  impossible rather than merely known.

An entry without a guardrail is a complaint. "Be more careful with prices" is
not a guardrail — it is a wish addressed to a model that will not remember it.
A field the importer refuses to overwrite, verified by a script in CI, is a
guardrail. It works whether or not anyone read the entry.

This is the part that makes the difference between a log that compounds and a
log that just grows.

## LEARNINGS.md — read offensively, when starting something new

The test for an entry: **would it change how you approach the next problem?**
If not, it is a changelog line.

Kept separate from mistakes because of *when* it gets read. Mistakes are
consulted before touching a hazard. Learnings are consulted when opening a new
front. One file for both means every consultation pays for both.

## DECISIONS.md — read when someone is about to do the opposite

ADRs, minus the ceremony. One entry per choice that would be expensive to
reverse, or that a future reader would otherwise quietly undo.

The decision itself is the least valuable part. The **context** is the payload:
the forces in play at the time. A decision whose context no longer holds should
be revisited, and you cannot tell whether it still holds unless someone wrote it
down. And **consequences** — what this makes easy, and what it makes expensive —
is what stops the same debate happening twice.

## ARCHITECTURE.md — read once, then rarely

The shape of the thing. Where state lives, what talks to what, what is
deliberately forbidden, and the naming conventions that are obvious to you and
invisible to everyone else.

If a section grows past a screen, it is probably a decision wearing a
description's clothes. Move it.

## The cadence

**During the session.** Log the moment it happens, not at the end. `new mistake`
takes four seconds and the details are still in your head; at the end of a
three-hour session they are not, and it is the first thing to get skipped. This
is the single highest-leverage habit in the system, and the only one that
depends on you.

**Before any risky edit.** `recall <tag>`. Auth, payments, migrations, data
writes, scrapers, deploy config, anything touching money or user data.

**Closing the session.** Build green, `STATE.md` rewritten (not appended) with
today's date, anything that broke logged with a guardrail, `doctor` green. The
`close-session` skill walks through it.

**Monthly, roughly.** `stats`. The top tag is not a list of mistakes — it is one
missing abstraction, told n times. Then `rotate` when `doctor` asks.
