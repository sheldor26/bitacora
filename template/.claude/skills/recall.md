---
name: recall
description: Pull the relevant slice of project history before touching an unfamiliar or risky area, instead of loading whole log files.
---

# Recall before you write

The logbook is deliberately *not* loaded into context automatically. Reading
`MISTAKES.md` in full costs thousands of tokens for history that is irrelevant
to the task at hand. Retrieve by tag instead.

## When to do this

Before the first edit in any area you have not touched this session, and always
before: auth, payments, migrations, data writes, scrapers, deploy config, and
anything that touches money or user data.

## How

```bash
node .bitacora/cli.mjs recall <tag>          # by area:      recall pricing
node .bitacora/cli.mjs recall <path>         # by file:      recall scripts/import.ts
node .bitacora/cli.mjs recall <phrase>       # full text:    recall "race condition"
node .bitacora/cli.mjs stats                 # where friction concentrates
```

`recall` prints ids, titles and tags — a cheap index. Then open the file and
read the full text of the two or three entries that actually apply. Do not
skim; the guardrail is usually the last line of the entry and it is the part
that matters.

## What to do with what you find

- A mistake entry with a guardrail: **honour the guardrail.** If it says a
  script must not overwrite manually verified values, do not write code that
  can. If the guardrail looks wrong, say so — do not route around it silently.
- A mistake entry without a guardrail: that entry is unfinished. Propose the
  guardrail as part of this task.
- A decision entry: check whether its **Context** still holds. If the context
  has changed, that is worth raising explicitly rather than quietly doing the
  opposite.

## If recall finds nothing

Say so, and proceed carefully. An area with no history is an area where the
first mistake has not been made yet — which makes it more likely, not less,
that this session makes it.
