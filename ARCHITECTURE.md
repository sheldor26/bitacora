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
test/smoke.mjs              the test suite: runs the real installer in a temp dir
docs/                       method and reference, for humans reading the repo
```

Two scripts, one payload directory. `template/` is data to the installer — it
walks the tree and copies, so adding a file there needs no code change.

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

Markers are matched anchored to the start of a line. This is load-bearing: the
templates quote the marker in prose to explain the format, and an unanchored
scan reads that quotation as an entry (M-0001).

## Conventions

- ESM, `.mjs`, top-level `await` allowed in the installer only.
- No dependencies, including dev. `node --check` and `test/smoke.mjs` are the gate.
- Colour output goes through the local `c`/`C` helpers, which respect `NO_COLOR`.
  Hooks and the test suite set it, so assertions never match escape codes.
- `doctor` distinguishes **error** (exit 1, blocks CI) from **warn** (exit 0).
  Structural problems are errors; staleness is a warning, because a paused
  project legitimately has an old snapshot.
- User-facing strings say what to do next, not just what is wrong. Every
  `doctor` error names the command that fixes it.
