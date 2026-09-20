# Entry format

An entry is an HTML comment carrying metadata, followed by ordinary markdown.
GitHub renders the comment as nothing, so a human reads clean prose; the CLI
parses it with a string split, so there is no YAML parser and no dependency.

```markdown
<!-- bitacora:entry
id: M-0042
date: 2026-09-20
tags: [pricing, scrapers, data-loss]
severity: high
files: [scripts/import-prices.ts, src/data/products.ts]
-->
### The scraper overwrote prices that had been verified by hand

**What happened.** ...

**Root cause.** ...

**Guardrail.** ...
```

## Fields

| Field | Required | Notes |
| :-- | :-- | :-- |
| `id` | yes | `M-0042`, `L-0007`, `D-0003`. Prefix per file, four digits, assigned by `new`. Unique across the live logs *and* the archive. |
| `date` | yes | `YYYY-MM-DD`. When it happened, not when it was written. Must not be in the future. |
| `tags` | yes | `[a, b, c]`. The retrieval key. An untagged entry cannot be recalled, so `new` refuses to create one. |
| `severity` | mistakes only | Exactly one of `low`, `medium`, `high`. |
| `files` | no | Paths touched. Makes `recall src/some/file.ts` work. A path that no longer exists is a warning, not an error. |

## The body

Three bold sections, in this order, because the order is the argument:

| Kind | Sections |
| :-- | :-- |
| Mistake | **What happened** · **Root cause** · **Guardrail** |
| Learning | **What worked** · **Why it worked** · **Reuse it when** |
| Decision | **Context** · **Decision** · **Consequences** |

The heading form is exactly `**Name.**` — bold, with the period inside. That is
what the parser looks for, and `doctor` requires all three to be present with
real content behind them.

Prose, not bullets. A mistake told as five fragments loses the causal chain, and
the causal chain is the part worth keeping.

`new` scaffolds these as `<!-- bitacora:fill-me ... -->` placeholders. Half-
written entries are how a logbook dies, so `doctor` fails while any survive.

### The Guardrail section is the point

A guardrail is not a lesson. It is a check, a test, a type or a refusal in the
code — something that works whether or not anyone reads the entry.

| Not a guardrail | A guardrail |
| :-- | :-- |
| "Be more careful with prices" | A `priceVerifiedAt` field the importer refuses to overwrite, checked in CI |
| "Remember the API is paginated" | A type that makes the un-paginated call unrepresentable |
| "Always run the build first" | A pre-commit hook, or a `Stop` hook that reports it |
| "Read the script header next time" | The script validates its input and exits with the reason |

If no guardrail is possible, say so and say why. "Unpreventable, detectable only
by reading the output, so the output is now printed and the review step is in
the skill" is a real entry. Silence in that section is not, and `doctor` will
not accept it.

## Ordering

Newest first, immediately after the file header. The agent reads top-down and
can stop early. `new` inserts at the top for you.

This is an invariant, not a convention: `rotate` retires entries from the
bottom, so a date out of order would archive the wrong entry. `doctor` errors on
a descending-date violation, and `rotate` sorts defensively anyway.

## What `doctor` checks

Errors fail the command with exit code 1; warnings do not, unless you pass
`--strict`.

**Errors**

- A required file is missing.
- A `bitacora:fill-me` placeholder survives anywhere in a required file.
- A log is over its `maxLines` budget.
- `STATE.md` is over its budget — it is a snapshot, not a diary.
- `STATE.md` has no `updated:` line, or one that is unparseable or in the future.
- An entry has no id, a malformed id, or an id that collides with another
  entry's — including one already in the archive.
- An entry has an unparseable or future date, or is dated after the entry above it.
- An entry has no tags.
- A mistake has no severity, or one outside `low | medium | high`.
- A required section is missing, or has under 40 characters of real content.

**Warnings**

- A log is past 85% of its budget.
- `STATE.md` has not been updated inside `maxAgeDays`.
- An entry is still tagged `example` — the template entry was never replaced.
- An entry's `files:` names a path that no longer exists.

## Tagging

Tags are how retrieval works, so they are worth five seconds of thought.

**Good tags** name a *thing in the system* or a *failure mode*: `pricing`,
`auth`, `migrations`, `deploy`, `scrapers`, `data-loss`, `race-condition`,
`silent-failure`, `type-hole`.

**Bad tags** describe the entry rather than the subject: `important`, `bug`,
`fixed`, `claude`, `september`. They match everything or nothing.

Two to four tags. One of them should be the area, one the failure mode. Check
`stats` before inventing a tag — reusing an existing one is what makes a
recurring failure mode visible as a count rather than as five unrelated entries.
If `recall <tag>` routinely returns more than five entries, split that tag.

## Editing by hand

Encouraged. It is markdown in your repository, and no entry body is ever
regenerated from parsed fields — `rotate` and `new` move raw text around. `new`
exists to make the common case fast and to assign ids without collisions, not to
own the file.

If you hand-write an entry, run `doctor` afterwards. It will tell you if the
metadata is malformed, the ordering is wrong, or a section says nothing.
