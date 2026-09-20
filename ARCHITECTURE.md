# Architecture

> How this project is built, and the reasoning that is too structural to live
> in a code comment. If a section here is longer than a screen, it probably
> wants to be a `DECISIONS.md` entry instead.

## Shape

```
bin/create-bitacora.mjs     the installer. The only thing npm publishes as executable.
template/                   verbatim payload — what lands in a user's repository.
  .bitacora/cli.mjs         the logbook CLI, copied into the user's repo (D-0002)
  .claude/                  hooks and skills, Claude Code specific
  *.md                      the six documents, with {{PLACEHOLDER}} variables
global/                     payload for --global: the rule block and start-project skill
test/smoke.mjs              the test suite: runs the real installer in temp dirs
scripts/sync-self.mjs       template/ -> this repo's own installed copies
docs/                       method and reference, for humans reading the repo
```

Two scripts, two payload directories. `template/` is data to the installer — it
walks the tree and copies, so adding a file there needs no code change.
`global/` is read by name, because its two files land in different places and
one of them is merged into a sentinel block rather than copied (D-0004).

Because this repository uses its own system, `template/`'s operational files
also exist at the root as this project's installed copy. `scripts/sync-self.mjs`
is the only sanctioned way to update them, and CI fails on drift — running the
installer with `--force` here would overwrite the real logbook with
placeholders.

## Data

There is no state outside the user's repository. `bitacora.config.json` holds
the budgets; the markdown files hold everything else. The CLI reads both on
every invocation and never caches.

The single source of truth for what a project must contain is the `required`
array in `bitacora.config.json`. `doctor` reads it; the installer does not,
because the installer copies whatever is in `template/`. Those two can drift,
which is why the smoke test asserts both.

## Boundaries

- **The installer never parses a logbook.** It copies, substitutes
  `{{PLACEHOLDER}}` variables, and merges `.claude/settings.json`. All parsing
  lives in the template CLI.
- **The template CLI never reaches outside `process.cwd()`.** It is running in
  someone else's repository.
- **Nothing in `template/` may import from the repository root.** After
  installation, `template/.bitacora/cli.mjs` is alone in a stranger's project.
  It has no siblings.
- **`docs/` is for humans.** Nothing reads it programmatically, so it may be as
  long as it earns.

## Parsing model

`parseEntries(text)` splits a log into `{ head, entries[], tail }`:

- `head` — everything before the first entry marker (the file's own header).
- `entries` — each marker up to the next marker, the `## Archived` heading, or
  end of file. Each carries its `raw` text, so `rotate` and `new` rewrite files
  by reassembling raw slices. **No entry body is ever regenerated from parsed
  fields**, which is what makes hand-edited entries safe.
- `tail` — the `## Archived` section onward.

Markers are matched anchored to the start of a line, and every marker scan runs
against `withoutCode()` — the text with fenced blocks and inline spans removed.
This is load-bearing rather than tidy: a logbook documents its own format, so
its prose quotes bitacora's markers constantly, and a raw scan reads those
quotations as markers. That bug happened twice, once per marker (M-0001,
M-0006). The rule is now one rule: backticked is prose, bare is a marker.

Entry validation is driven by `sections` in each log's config. `doctor` requires
every named section to be present as `**Name.**` with at least forty characters
of real content behind it, which is what makes the **Guardrail** requirement a
check rather than a suggestion (M-0004). Adding a section to a log is a config
change, not a code change.

## Conventions

- ESM, `.mjs`, top-level `await` allowed in the installer only.
- No dependencies, including dev. `node --check` and `test/smoke.mjs` are the gate.
- Colour output goes through the local `c`/`C` helpers, which respect `NO_COLOR`.
  Hooks and the test suite set it, so assertions never match escape codes.
- Both hooks quick-exit before doing anything when the project has no logbook,
  which is the pattern the Claude Code team recommends for hooks: call the
  script, decide relevance immediately, exit if not. A hook that costs nothing
  when it does not apply is the only kind that scales across many projects.
- `doctor` distinguishes **error** (exit 1, blocks CI) from **warn** (exit 0,
  or exit 1 under `--strict`). Structural problems and empty sections are
  errors; staleness, near-budget and stale `files:` references are warnings,
  because a paused project legitimately has an old snapshot.
- User-facing strings say what to do next, not just what is wrong. Every
  `doctor` error names the command that fixes it.
