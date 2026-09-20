# State

updated: 2026-09-20

> A snapshot of where this project is right now — the file a new session reads
> first. It answers "what exists, what is half-done, what is next".
>
> It is not a diary. When this file starts telling stories, the stories belong
> in the logbook. `doctor` enforces that with a line budget.

## Shipped

- `template/` — the six markdown files, `bitacora.config.json`, two hooks, and
  three Claude Code skills (`log-mistake`, `recall`, `close-session`).
- `template/.bitacora/cli.mjs` — zero-dependency CLI: `doctor`, `new`,
  `recall`, `rotate`, `stats`.
- `doctor` checks structure, per-file line budgets, `STATE.md` freshness, entry
  metadata, id uniqueness across live logs *and* archive, newest-first date
  ordering, severity values, eager `@`-imports — and, the point of the whole
  thing, that each entry's sections carry real content. A mistake whose
  **Guardrail** is missing or gestural fails. `--strict` also fails on warnings.
- `recall` ranks hits (exact tag > file or title > prose) and prints the top
  five in full, so an agent gets the guardrail without a second call.
- `bin/create-bitacora.mjs` — installer. Detects stack and commands from
  `package.json`, drops command lines for commands the project does not have,
  turns undetectable prose into placeholders `doctor` will demand, merges into
  an existing `.claude/settings.json`, and is safe to re-run.
- `--global` / `--global --remove` — a `start-project` skill and a
  sentinel-delimited rule in `~/.claude/CLAUDE.md`, so Claude Code applies the
  logbook to new projects on its own. Idempotent; honours `CLAUDE_CONFIG_DIR`.
- `test/smoke.mjs` — 49 end-to-end assertions against the real installer in
  real temp directories, across three fixture shapes (with tests, without
  tests, no `package.json`). No test framework.
- `scripts/sync-self.mjs` (`npm run sync:self`) — this repo uses its own
  system, so the operational files exist twice; this syncs `template/` to the
  root without touching the root markdown. CI fails if they drift.
- Hooks verified against the Claude Code hook reference, not assumed: the
  session-end reminder travels as JSON `systemMessage` because `Stop` sends
  plain stdout only to the debug log, and a second `SessionStart` entry fires on
  the `compact` matcher — restating the durable state at the moment compaction
  destroys the volatile copy.
- Touchpoints placed by workflow rather than by file lifecycle: `recall` fires
  before the plan, `close-session` covers `/clear` as well as session end, and
  `log-mistake` routes a subagent's findings through the main session, whose
  context outlives it.
- CI: smoke tests on Node 18/20/22, hook syntax, this repo's own `doctor`, the
  drift check, and an install from a packed tarball — which is the only thing
  that can catch a file missing from `package.json` "files".
- `README.md`, four docs, `CONTRIBUTING.md`, two issue templates, MIT. The
  positioning now rests on Anthropic's own material: the engineering blog names
  structured note-taking and just-in-time retrieval as the patterns; Claude
  Academy teaches capturing incident learnings in a memory file. The README
  also quotes and answers the sharpest objection to the category — that
  model-curated memory is not a context engineering primitive — which is the
  clearest statement of what the enforcement is for.
- This repository uses its own system. The logbook is real, and two of its
  entries are defects found by auditing the README against the code.

## In flight

Nothing. 0.1.1 is ready to publish: it fixes M-0010 and M-0011, both found by
installing the published 0.1.0 into a real new project. One day of real use,
two high-severity defects — neither reachable by reading this repo's code.

## Next

1. Publish 0.1.1.
2. Keep using it on real projects. 0.1.0 survived one day of real use and
   produced one high-severity defect, which is the rate to expect for a while.

## Known rough edges

- The `Stop` hook's `systemMessage` field is documented as reaching the model,
  but that was read from the reference rather than observed end to end in a live
  session. Worth confirming once in practice before leaning on it in the README.

- `recall` is ranked substring matching over markdown. Intended at
  one-repository scale, but a common word still matches noisily at the lowest
  rank. Tag discipline is the mitigation, and it is documented rather than
  enforced.
- The archive index accumulates one line per retired entry forever. At a few
  hundred entries that tail is itself worth rotating. Deliberately not solved
  ahead of evidence.
- The forty-character section floor is a proxy for "says something". It catches
  "Be more careful." and would accept forty characters of nonsense. A better
  check is not obvious and a stricter one would be wrong.
- Only Claude Code gets hooks and skills out of the box; the hooks are bash, so
  Windows needs WSL or Git Bash. Everything else is platform-agnostic.
