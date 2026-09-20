# bitacora

**The logbook your coding agent keeps.**

<sub>*bitácora* (bee-TAH-ko-rah) — Spanish for a ship's logbook: the record kept
so the next watch knows what the last one learned.</sub>

[![npm](https://img.shields.io/npm/v/create-bitacora?color=%23222)](https://www.npmjs.com/package/create-bitacora)
[![ci](https://github.com/sheldor26/bitacora/actions/workflows/ci.yml/badge.svg)](https://github.com/sheldor26/bitacora/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/create-bitacora)](https://nodejs.org)
[![deps](https://img.shields.io/badge/dependencies-0-%23222)](package.json)
[![license](https://img.shields.io/badge/license-MIT-%23222)](LICENSE)

Your agent's memory is being deleted while you work. Auto-compaction fires
around 85% of the context window, folding the oldest messages into summaries —
and summarising is lossy in exactly the wrong direction. The specific detail
goes first: the number that was wrong, the file that got clobbered, the reason
you picked Postgres over SQLite. What survives is an outline. The next session
starts from nothing at all.

The usual fix makes it worse. A growing `MISTAKES.md`, `@`-imported into every
session, spends context on history that is irrelevant 90% of the time — which
makes compaction arrive sooner.

bitacora is the other half of that idea. Structured memory on disk, retrieved
by tag, and a `doctor` that fails your build when the memory starts rotting.

```bash
npm create bitacora@latest
```

---

## The problem, precisely

Three things go wrong with agent memory, and they go wrong in sequence.

**1. It never gets written.** Logging a mistake at the end of a long session is
the first thing to get skipped. So the log has eleven entries from the first
week and nothing since.

**2. It gets written badly.** "Be more careful with prices" is a wish addressed
to a model that will not remember it. An entry that records a lesson rather than
installing a mechanism reads like diligence and changes nothing.

**3. It gets read *always*, which is the same as never.** `@MISTAKES.md` at the
top of `CLAUDE.md` guarantees the file is in context. It also guarantees you
spend two thousand tokens on database migrations while editing a CSS file. The
window fills faster, auto-compaction fires earlier, and the model's attention is
spread across history it has no use for. You paid tokens to bring the summariser
forward.

bitacora attacks all three: writing is one command, `doctor` refuses entries
that do not install a mechanism, and reading is by tag.

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
    ├── hooks/             # digest on session start and after compaction; checked close
    └── skills/            # log-mistake, recall, close-session
```

The CLI lives **inside your repo**, not in `node_modules`. No runtime
dependency, no version drift, nothing to audit — and your agent can read the
source of its own tooling when behaviour surprises it.

## The four ideas

### 1. An entry has to install a mechanism

This is the one that decides whether the whole thing is worth anything.

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

**Root cause** asks why it was *possible*, not what broke. **Guardrail** asks for
the check, test, type or refusal that makes it impossible rather than merely
known — and `doctor` rejects the entry if that section is missing or gestural:

```
$ node .bitacora/cli.mjs doctor
error MISTAKES.md M-0042 ("The scraper overwrote prices...") has a near-empty
      "Guardrail" section — name the check, test, type or refusal that makes
      this impossible to repeat, not an intention to be careful
```

Most postmortem templates ask for a lesson and get one. Asking for a mechanism,
and refusing the entry without one, is the difference between a log that
compounds and a log that grows.

The metadata sits in an HTML comment, so GitHub renders it as nothing — a human
reads clean prose, and the CLI parses it with a string split. No frontmatter
cluttering the page, no database, no YAML parser.

### 2. Retrieval, not loading

`CLAUDE.md` never `@`-imports a log. Instead it tells the agent to ask — before
it writes the plan, not before the first edit, because a plan built without the
history bakes the repeat mistake into it:

```bash
node .bitacora/cli.mjs recall pricing            # by tag
node .bitacora/cli.mjs recall scripts/import.ts  # by file
node .bitacora/cli.mjs recall "race condition"   # full text
```

Hits come back ranked — an exact tag match outranks a word that happens to
appear in someone's prose — and the top few print **in full**, guardrail
included, so the agent does not need a second call to go read the file. You pay
for three relevant entries instead of four hundred irrelevant lines.

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
compacting. Anthropic's own cost guidance for Claude Code puts it as *"the price
per token doesn't give you the full picture — you want to keep a tab on the cost
per task"*. History you loaded and did not need is part of the cost of every
task that loaded it. The instinct runs the other way — as one senior engineer put it,
*"I've seen people write enormous documents thinking more context is better,
but it's not"* ([How I use Claude Code](https://www.youtube.com/watch?v=MzhIr7BfpI0)).
Everyone agrees in principle; nothing enforces it. `doctor` fails at the limit
and tells you to `rotate`, which moves the oldest entries into
`docs/bitacora-archive/` and leaves a one-line index behind. `recall` still searches the archive in full — the history is not lost,
it is just no longer in the way.

`STATE.md` gets a second check: an `updated:` date older than two weeks is a
warning, because a stale snapshot is worse than no snapshot. Your agent has no
way to know it is stale. It will act on it.

### 4. Writing is one command

```bash
node .bitacora/cli.mjs new mistake "Scraper overwrote verified prices" \
  --tags pricing,data-loss --severity high
```

Assigns the id, stamps the date, scaffolds the three prompts, puts it at the
top. All that is left is prose. `--tags` is required, because an untagged entry
is one nobody will ever recall.

## Where the friction is

```
$ node .bitacora/cli.mjs stats

47 entries in the live logs, 12 from the last 90 days. Where the friction is:

  pricing       ██████████████████████████ 11 (4 recent)
  scrapers      ███████████████████ 8 (3 recent)
  deploy        ██████████████ 6 (5 recent)
  auth          █████████ 4
  migrations    ███████ 3

Ranked by recent activity. The top tag is usually one missing abstraction,
told n times.
```

This turns out to be the most useful command in the set, and it was an
afterthought. Eleven entries tagged `pricing` is not eleven mistakes — it is one
missing abstraction, told eleven times.

## "Memory is not a context engineering primitive"

That is Daisy Hollman, who led plugin design on the Claude Code team, in a talk
on agentic software engineering at scale — and it is the sharpest objection to a
project like this one:

> "Memory is model-curated. It's text files. You just tell the model to write a
> text file and then read the text file at a very specific point later. But
> because it's model-curated, I don't consider it to be a context engineering
> primitive. We really want to focus on what the primitives for sustainable,
> reusable context engineering are... those two things are going to need to
> function very separately."

She is right about the thing she is describing. A markdown file the model writes
into at its own discretion is not engineering. It is a habit with a filename,
and it decays the way habits decay: sparse entries, no structure, unbounded
growth, and a read that happens only if the model remembers to do it.

Everything bitacora adds exists to move a logbook across that line.

| Model-curated memory | An engineered artifact |
| :-- | :-- |
| The model decides what is worth writing | Required sections; `doctor` rejects an entry whose **Guardrail** names an intention instead of a mechanism |
| Grows until it is the problem | A declared line budget, enforced in CI, with `rotate` and a searchable archive |
| Read "at a very specific point later", if remembered | A retrieval interface — `recall <tag>` — invoked at a named moment, before the plan |
| Invisible, unversioned, one person's install | In the repository: in version control, in review, in CI, readable by any tool |

The same talk makes the case against the alternative, and makes it harder than
this README would dare to. Asked why plugins cannot ship a `CLAUDE.md`:

> "It is the worst at 'don't pay for what you don't use'... if we were to provide
> an abstraction that allowed plugins to unconditionally inject a large amount of
> text at the very beginning of every context, then we'd be limited to five or
> ten plugins being active at any given time. And the biggest problem is that
> **it doesn't look like it's that expensive.**"

Unconditional context injection was considered by the team that builds Claude
Code and deliberately refused, for exactly the reason `doctor` fails a build
that adds `@MISTAKES.md` to `CLAUDE.md`. The cost is real and invisible, which
is the only kind of cost that survives a code review.

The talk's preferred abstraction is the hook, "because hooks do scale" — the
pattern being to "call the script, determine if it's relevant immediately, and
quick exit if not." Both of bitacora's hooks are built that way: no logbook, no
output, no cost.

## Anthropic recommends the practice. This is the mechanism.

In a Claude Academy webinar on *Claude Code for Data Engineering*, an Anthropic
speaker describes memory files as the way to codify "the norms and the
procedures and correctness", and names the payoff directly: the powerful part is
that **"when you have incidents that have happened, the learnings from those
incidents can be captured in that memory file, so that in the future, with
similar incidents, Claude would know exactly how to react"**. A memory file, the
same talk notes, can live at an individual, a team, or a repository level — and
the documents a team writes today "become tomorrow's context".

That is the whole premise, from the vendor. What that advice does not say, and
what decides whether it works six months in:

- **What makes an incident entry useful.** "Be more careful with prices" is a
  learning captured in a memory file, and it changes nothing. `doctor` refuses
  an entry whose **Guardrail** names an intention instead of a mechanism.
- **What stops the file becoming the problem.** A memory file that accumulates
  incidents without bound is loaded into every session until it is the thing
  eating your window. Budgets, `rotate`, and an archive that `recall` still
  searches.
- **How you read it back.** "Claude would know how to react" requires the right
  entry to be in context at the right moment — which is before the plan, not
  after. Retrieval by tag, not wholesale loading.

Follow the advice. This is the shape that survives the second year of it.

## But Claude Code already has memory

It does, and you should use it. Claude Code keeps **auto memory** per
repository at `~/.claude/projects/<project>/memory/` — notes Claude writes for
itself about your preferences, the corrections you give it, and ongoing project
context. It is on by default and it is genuinely useful.

It is also not this, in three ways that decide the question:

**It lives outside your repository.** Not in version control, not in a pull
request, not visible to a teammate, not readable by a different agent or a
different tool. A guardrail that exists only inside one person's Claude Code
install is not a guardrail — it is a note.

**Nothing validates it.** Claude writes it, Claude reads it, and no check ever
asks whether an entry names a mechanism or merely records a feeling. `doctor`
fails your build. Auto memory cannot.

**It is loaded at the start of every conversation** — the documentation says so
plainly, for `CLAUDE.md` and auto memory both. That is precisely the unbounded
context cost this project exists to avoid, with the extra problem that you
never see the file, so you will not notice it growing.

Anthropic teaches memory files at three levels — individual, team, repository.
Auto memory is excellent at the first. This is the third one, built so it holds
up: in version control, in review, in CI, and readable by whatever tool you use
next.

Use both. Let auto memory learn that you prefer early returns. Put the thing
that cost you a weekend in the repository, where the next person — or the next
tool, or you in March — can actually find it.

## Install

```bash
npm create bitacora@latest          # interactive, current directory
npx create-bitacora --yes           # non-interactive, detects what it can
npx create-bitacora --dir ./app     # somewhere else
```

It reads your `package.json` to guess the stack and the build command, drops
command lines for commands your project does not have, never overwrites a file
you already have (pass `--force` if you want that), and merges its hooks into an
existing `.claude/settings.json` instead of replacing it. Re-running it is safe.

**`doctor` will fail immediately after install.** That is deliberate. The
template ships with placeholders, and an unfilled logbook is worse than no
logbook — your agent will read it and trust it. Filling them in is step one.

## Make it automatic

One command teaches Claude Code to reach for this on its own, for every project:

```bash
npx create-bitacora@latest --global
```

It writes two things into `~/.claude` and nothing else:

- `skills/start-project/SKILL.md` — the procedure: install, fill the
  placeholders from the codebase rather than by interview, and seed the first
  decisions while the reasoning behind them is still fresh.
- a `BEGIN:bitacora`/`END:bitacora` block in `CLAUDE.md` — the rule that makes
  it fire. Everything else in that file is left exactly as it was, and
  re-running refreshes only the block.

After that, "let's start a new project" installs the logbook before the first
feature, and a project that already has one gets `recall` instead of a wholesale
read. Respects `CLAUDE_CONFIG_DIR`. Undo it with `--global --remove`.

The skill is deliberately cautious: it asks before installing into a clone, a
fork, a client codebase, or anything that already has its own conventions.

## In CI

```yaml
- run: node .bitacora/cli.mjs doctor          # --strict to fail on warnings too
```

A pull request that breaks the logbook fails like any other broken test. This is
the line between a system and a habit you will abandon in three weeks.

## Works with

Built for [Claude Code](https://claude.com/claude-code) — the hooks and skills
target it directly. Everything else is plain markdown and a Node script, so
Cursor, Codex, Copilot, Aider, Zed and anything that reads files work fine; you
just wire the two hooks yourself, or skip them. The habit survives without them.

The hooks are bash, so on Windows they need WSL or Git Bash. Everything else —
the CLI, the installer, the markdown — is platform-agnostic.

## What this is not

- **Not a prompt pack.** No agents, no 90 slash commands, no rules for six
  languages. If you want that, [Everything Claude
  Code](https://github.com/affaan-m/everything-claude-code) is the maximalist
  answer and it is good. bitacora does one thing.
- **Not a memory API.** Nothing is embedded, indexed or vectorised. It is grep
  over structured markdown, which is enough at the scale of one repository and
  has the enormous advantage that you can read and edit it yourself.
- **Not automatic.** Nothing detects your mistakes for you. The system makes
  logging cheap, forgetting expensive, and a lazy entry impossible to commit.
  The judgement is still yours.

## Docs

- [The loop](docs/the-loop.md) — the method, and why each file exists
- [Context budget](docs/context-budget.md) — how the numbers were chosen
- [Entry format](docs/entry-format.md) — the full schema and every `doctor` check
- [FAQ](docs/faq.md)
- [Contributing](CONTRIBUTING.md) — zero dependencies, no test framework, and why

## Using it?

Drop this in your project's README. It tells a visitor what those six markdown
files at your root are for, which is otherwise the first question they have.

```markdown
[![bitacora](https://img.shields.io/badge/logbook-bitacora-%23222)](https://github.com/sheldor26/bitacora)
```

## Where it came from

I am a non-technical founder. Everything in my repositories is built with
Claude Code, which means I hit the amnesia problem earlier and harder than
someone who can hold the codebase in their own head. `MISTAKES.md` started as a
text file I asked Claude to append to after things went wrong — I called it the
*bitácora*, the word a Spanish-speaking sailor uses for the logbook bolted to
the binnacle. It worked well enough that a year later the file was 700 lines
and had become part of the problem. This is what I wish I had started with.

MIT. Issues and pull requests welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
