# bitácora

**The logbook your coding agent keeps.**

Your agent starts every session with amnesia. It will make the same mistake in
October that it made in August, because nothing it learned in August survived.
The usual fix — a big `CLAUDE.md`, a growing `MISTAKES.md`, `@`-imported into
every session — trades one problem for a worse one: a context window half-spent
on history that is irrelevant to the task at hand.

bitácora is the other half of that idea. Structured memory on disk, retrieved by
tag, and a `doctor` that fails your build when the memory starts rotting.

```bash
npm create bitacora@latest
```

---

## The problem, precisely

Three things go wrong with agent memory, and they go wrong in sequence.

**1. It never gets written.** Logging a mistake at the end of a long session is
the first thing to get skipped. So the log has eleven entries from the first
week and nothing since.

**2. It gets written and never read.** A 700-line `MISTAKES.md` is not read by
anyone, human or model. It is skimmed, at best, and skimming a mistakes log is
worse than not reading it — you come away confident you know the hazards.

**3. It gets read *always*, which is the same as never.** `@MISTAKES.md` at the
top of `CLAUDE.md` guarantees the file is in context. It also guarantees you
spend two thousand tokens on database migrations while editing a CSS file. Your
200k window shrinks, compaction hits sooner, and the model's attention is spread
across history it has no use for.

bitácora attacks all three: writing is one command, reading is by tag, and a
health check makes the rot visible.

## What you get

```
your-project/
├── CLAUDE.md              # identity, non-negotiables, and how to use the loop
├── ARCHITECTURE.md        # how it is built, and why
├── STATE.md               # where the project is right now — a snapshot, budgeted
├── MISTAKES.md            # what broke, why it was possible, and the guardrail
├── LEARNINGS.md           # what worked and is worth reusing
├── DECISIONS.md           # choices made, with the context that justified them
├── bitacora.config.json   # your context budgets
├── .bitacora/cli.mjs      # doctor · new · recall · rotate · stats (zero deps)
└── .claude/
    ├── settings.json      # hooks, merged into yours if you have one
    ├── hooks/             # digest on session start, checked close on session end
    └── skills/            # close-session, recall
```

The CLI lives **inside your repo**, not in `node_modules`. No runtime
dependency, no version drift, nothing to audit — and your agent can read the
source of its own tooling when it needs to.

## The four ideas

### 1. Entries are machine-readable and invisible

```markdown
<!-- bitacora:entry
id: M-0042
date: 2026-09-20
tags: [pricing, scrapers, data-loss]
severity: high
files: [scripts/import-prices.ts]
-->
### The scraper overwrote prices that had been verified by hand

**What happened.** The nightly import replaced 11 of 15 manually corrected
prices with stale values from the source feed...

**Root cause.** Nothing distinguished a scraped value from a verified one, so
"newer" always won...

**Guardrail.** A `priceVerifiedAt` field. Any row with one set inside 7 days is
skipped by the importer, which prints what it declined. Enforced by
`scripts/check-price-guard.mjs` in CI.
```

GitHub renders the comment as nothing — a human reads clean prose. The CLI
parses it with a string split. No frontmatter cluttering the page, no database,
no YAML parser.

### 2. Retrieval, not loading

`CLAUDE.md` never `@`-imports a log. Instead it tells the agent to ask:

```bash
node .bitacora/cli.mjs recall pricing            # by area
node .bitacora/cli.mjs recall scripts/import.ts  # by file
node .bitacora/cli.mjs recall "race condition"   # full text
```

You pay for three relevant entries instead of four hundred irrelevant lines.
`doctor` actively fails if it catches an `@MISTAKES.md` creeping back into
`CLAUDE.md`, because that single line quietly undoes the whole design.

### 3. A context budget, enforced

```json
{
  "logs": {
    "MISTAKES.md": { "prefix": "M", "maxLines": 400, "keepEntries": 20 }
  },
  "state": { "file": "STATE.md", "maxLines": 200, "maxAgeDays": 14 }
}
```

Memory files grow without bound, and nobody notices until a session starts
compacting. `doctor` fails at the limit and tells you to `rotate`, which moves
the oldest entries into `docs/bitacora-archive/` and leaves a one-line index
behind. `recall` still searches the archive — the history is not lost, it is
just no longer in the way.

`STATE.md` gets a second check: an `updated:` date older than two weeks is a
warning, because a stale snapshot is worse than no snapshot. Your agent believes
it.

### 4. Writing is one command

```bash
node .bitacora/cli.mjs new mistake "Scraper overwrote verified prices" \
  --tags pricing,data-loss --severity high
```

Assigns the id, stamps the date, scaffolds the three prompts, puts it at the
top. All that is left is prose — and `doctor` fails while the
`bitacora:fill-me` placeholders are still there, so half-written entries cannot
accumulate.

The mistake template asks for a **guardrail**, not a lesson. "Be more careful
with prices" is not a guardrail; a field the importer refuses to overwrite is.
An entry without one is unfinished, and saying so in the template is most of
why the entries end up useful.

## Where the friction is

```
$ node .bitacora/cli.mjs stats

47 entries logged. Where the friction is:

  pricing       ████████████████████████████ 11
  scrapers      ███████████████████ 8
  deploy        ██████████████ 6
  auth          █████████ 4
  migrations    ███████ 3

The top tag is the thing worth automating away.
```

This turns out to be the most useful command in the set, and it was an
afterthought. Eleven entries tagged `pricing` is not eleven mistakes — it is one
missing abstraction, told eleven times.

## Install

```bash
npm create bitacora@latest          # interactive, current directory
npx create-bitacora --yes           # non-interactive, detects what it can
npx create-bitacora --dir ./app     # somewhere else
```

It reads your `package.json` to guess the stack and the build command, never
overwrites a file you already have (pass `--force` if you want that), and merges
its hooks into an existing `.claude/settings.json` instead of replacing it.
Re-running it is safe.

**`doctor` will fail immediately after install.** That is deliberate. The
template ships with placeholders, and an unfilled logbook is worse than no
logbook — your agent will read it and trust it. Filling them in is step one.

## In CI

```yaml
- run: node .bitacora/cli.mjs doctor
```

A pull request that breaks the logbook fails like any other broken test. This is
the line between a system and a habit you will abandon in three weeks.

## Works with

Built for [Claude Code](https://claude.com/claude-code) — the hooks and skills
target it directly. Everything else is plain markdown and a Node script, so
Cursor, Codex, Copilot, Aider, Zed and anything that reads files work fine; you
just wire the two hooks yourself, or skip them. The habit survives without them.

## What this is not

- **Not a prompt pack.** No agents, no 90 slash commands, no rules for six
  languages. If you want that, [Everything Claude
  Code](https://github.com/affaan-m/everything-claude-code) is the maximalist
  answer and it is good. bitácora does one thing.
- **Not a memory API.** Nothing is embedded, indexed or vectorised. It is grep
  over structured markdown, which is enough at the scale of one repository and
  has the enormous advantage that you can read and edit it yourself.
- **Not automatic.** Nothing detects your mistakes for you. The system makes
  logging cheap and forgetting expensive; the judgement is still yours.

## Docs

- [The loop](docs/the-loop.md) — the method, and why each file exists
- [Context budget](docs/context-budget.md) — how the numbers were chosen
- [Entry format](docs/entry-format.md) — the full schema
- [FAQ](docs/faq.md)

## Where it came from

I am a non-technical founder. Everything in my repositories is built with
Claude Code, which means I hit the amnesia problem earlier and harder than
someone who can hold the codebase in their own head. `MISTAKES.md` started as a
text file I asked Claude to append to after things went wrong. It worked well
enough that a year later the file was 700 lines and had become part of the
problem. bitácora is what I wish I had started with.

MIT. Issues and pull requests welcome.
