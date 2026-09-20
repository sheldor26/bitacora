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
| `id` | yes | `M-0042`, `L-0007`, `D-0003`. Prefix per file, four digits, assigned by `new`. Must be unique across all logs — `doctor` checks. |
| `date` | yes | `YYYY-MM-DD`. When it happened, not when it was written. |
| `tags` | yes | `[a, b, c]`. The retrieval key. An untagged entry cannot be recalled, so `new` refuses to create one. |
| `severity` | mistakes only | `low` · `medium` · `high`. |
| `files` | no | Paths touched. Makes `recall src/some/file.ts` work. |

## Ordering

Newest first, immediately after the file header. The agent reads top-down and
can stop early. `new` inserts at the top for you.

## The body

Three bold prompts, in this order, because the order is the argument:

- **Mistakes** — What happened · Root cause · Guardrail
- **Learnings** — What worked · Why it worked · Reuse it when
- **Decisions** — Context · Decision · Consequences

Prose, not bullets. A mistake told as five fragments loses the causal chain,
and the causal chain is the part worth keeping.

`new` scaffolds these as `<!-- bitacora:fill-me ... -->` placeholders, and
`doctor` fails while any survive in a required file. Half-written entries are
the way a logbook dies.

## Tagging

Tags are how retrieval works, so they are worth five seconds of thought.

**Good tags** name a *thing in the system* or a *failure mode*: `pricing`,
`auth`, `migrations`, `deploy`, `scrapers`, `data-loss`, `race-condition`,
`silent-failure`, `type-hole`.

**Bad tags** describe the entry rather than the subject: `important`, `bug`,
`fixed`, `claude`, `september`. They match everything or nothing.

Two to four tags. One of them should be the area, one the failure mode. If
`recall <tag>` routinely returns more than five entries, split that tag.

## Editing by hand

Encouraged. It is markdown in your repository. `new` exists to make the common
case fast and to assign ids without collisions, not to own the file. If you
hand-write an entry, run `doctor` afterwards — it will tell you if the metadata
is malformed.
