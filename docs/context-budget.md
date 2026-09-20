# Context budget

Every number in `bitacora.config.json` is a guess with a reason. Change them —
but change them deliberately, because the default failure mode of a memory
system is unbounded growth that nobody notices until sessions start compacting.

```json
{
  "logs": {
    "MISTAKES.md":  { "prefix": "M", "maxLines": 400, "keepEntries": 20 },
    "LEARNINGS.md": { "prefix": "L", "maxLines": 400, "keepEntries": 20 },
    "DECISIONS.md": { "prefix": "D", "maxLines": 600, "keepEntries": 40 }
  },
  "state": { "file": "STATE.md", "maxLines": 200, "maxAgeDays": 14 }
}
```

Auto-compaction fires around 85% of the context window. Everything you spend on
history you did not need is window you do not have, and it brings the summariser
forward — which destroys specific detail first, the exact thing a logbook is for.
The budget is not hygiene; it is the mechanism.

## Why lines and not tokens

Lines are countable without a tokeniser, stable across models, and visible in
any editor. Roughly 10–14 tokens per line of prose markdown, so a 400-line log
is about 5k tokens if it were ever loaded whole — which is exactly the thing
the design avoids. The budget is not there to make loading cheap; it is there so
`recall` stays fast to read and the file stays reviewable by a human.

## `maxLines: 400` for a mistakes log

A good mistake entry is 15–20 lines. Twenty of them plus a header is around 400.
Twenty entries is also roughly the point where a human stops being able to hold
the file in mind, which is the real constraint: a log you cannot review is a log
you cannot trust.

## `keepEntries: 20`

What `rotate` leaves in the live file. Older entries move to
`docs/bitacora-archive/mistakes-2026.md` and leave a one-line index. `recall`
still searches the archive, so nothing is lost — it is just no longer in the
way when you open the file.

If your project is young, raise it. If your project is large enough that twenty
recent entries are all from one subsystem, that is not a budget problem, it is a
signal to split the repository or accept that the log is subsystem-specific.

## `DECISIONS.md` gets more room

Decisions do not go stale the way incidents do. A choice made in the first week
still governs the codebase in year two, and archiving it makes it invisible at
exactly the moment someone is about to undo it. 600 lines, 40 entries.

## `STATE.md`: `maxLines: 200`

Hard limit, and the one people resent most. It is a snapshot: what exists, what
is in flight, what is next, what is knowingly broken. Two hundred lines is
generous for that.

The number was picked by feel and then turned out to have a second source. From
Anthropic's Applied AI team, in a Claude Code workshop: *"especially if the
markdown files get more than about 200 lines long, it's unlikely you're going to
read it, and certainly unlikely that your colleagues are going to read them."*
The budget is not really about tokens. It is the length past which a file stops
being reviewed by anyone, and an unreviewed snapshot is how a logbook starts
lying.

The moment it exceeds the budget, the file has started being a diary, and the
fix is not a bigger budget — it is moving the history into the logs where
`recall` can find it by tag. `doctor` reports this as an error rather than a
warning for that reason.

## `maxAgeDays: 14`

A warning, not an error, because a genuinely paused project has a legitimately
old snapshot. But two weeks of active work without touching `STATE.md` means
the file is now describing a project that no longer exists, and your agent has
no way to know that. It will act on it.

## Warnings versus errors

Structural problems are errors and fail with exit code 1: over budget, a broken
entry, a missing section. Staleness and near-budget are warnings and exit 0,
because a paused project legitimately has an old snapshot and a CI run should
not go red for it.

If you would rather hold a harder line, `doctor --strict` fails on warnings too.
That is a reasonable setting for a project several people work on, and an
annoying one for a side project you touch monthly.

## When to loosen

- **A monorepo.** Consider one logbook per package, each with its own config.
  A shared log across ten packages means every `recall` returns noise.
- **A project with a long incident history worth keeping hot** — regulated work,
  say. Raise `keepEntries` rather than `maxLines`, and let the file be long.
- **Solo weekend project.** Honestly, drop `DECISIONS.md` entirely. Remove it
  from `required` in the config and `doctor` stops asking.

## When to tighten

If `recall <tag>` routinely returns more than five entries, the tag is too
coarse, not the budget too small. Split it.
