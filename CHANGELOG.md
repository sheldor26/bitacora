# Changelog

## 0.1.1

- Fixed: a project created with `npm init -y` got a `CLAUDE.md` advertising
  `npm run test`, which is the stub npm writes to always fail. Detection now
  ignores it (`M-0010`), found by using the published package on a real project.
- Added: `CLAUDE.md` now states the language the logbook and docs are written
  in, defaulting to English and prompted for on an interactive install. Without
  it the agent writes in the language of the conversation and the repository
  ends up bilingual (`M-0011`).

## 0.1.0 — unreleased

First release.

**Installer** — `create-bitacora` detects the project name, stack and commands
from `package.json`, drops command lines for commands the project does not have,
turns prose it could not detect into placeholders `doctor` will demand, merges
its hooks into an existing `.claude/settings.json`, and is safe to re-run.
`--global` installs a `start-project` skill and a sentinel-delimited rule into
the Claude Code config directory so the logbook gets applied to new projects
without being asked; `--global --remove` undoes exactly that and nothing else.

**Logbook CLI** (`.bitacora/cli.mjs`, zero dependencies)

- `doctor` — required files, leftover placeholders, per-file line budgets,
  `STATE.md` freshness and size, entry metadata, id uniqueness across the live
  logs and the archive, newest-first date ordering, severity values, stale
  `files:` references, leftover `example` entries, eager `@`-imports of a log
  into `CLAUDE.md`, and whether each entry's sections carry real content — a
  mistake with a missing or gestural **Guardrail** fails. `--strict` fails on
  warnings too.
- `new` — assigns the id counting the archive, stamps the date, scaffolds the
  sections, inserts newest-first. Requires `--tags`; validates `--severity`.
- `recall` — ranks hits (exact tag above a passing mention in prose) and prints
  the top five in full, guardrail included, so an agent needs one call rather
  than a call plus a file read. `--brief` for an index.
- `rotate` — archives the overflow by year, leaves a deduplicated one-line
  index, sorts defensively by date. `--dry-run`.
- `stats` — tag frequency ranked by recent activity, with a 90-day column.

**Templates** — `CLAUDE.md`, `ARCHITECTURE.md`, `STATE.md`, `MISTAKES.md`,
`LEARNINGS.md`, `DECISIONS.md`, `bitacora.config.json`, and the `log-mistake`,
`recall` and `close-session` skills.

**Hooks** — a `SessionStart` digest, a second `SessionStart` entry on the
`compact` matcher that restates the durable state right after compaction, and a
`Stop` hook that reports through JSON `systemMessage` with exit 0. It never
blocks a stop.

**Testing** — 49 end-to-end assertions in `test/smoke.mjs`, no framework. CI on
Node 18/20/22, plus hook syntax, this repository's own `doctor`, a
template-versus-root drift check, and an install from a packed tarball.
