# bitácora

A scaffolder that installs a structured logbook into a project, so a coding
agent stops losing what it learned when the session ends. Published as
`create-bitacora`.

## Stack in one line

Node >= 18, ESM, **zero dependencies** — production and development both. Plain
markdown templates plus two small scripts. Details in [ARCHITECTURE.md](ARCHITECTURE.md).

## Non-negotiables

1. **No dependencies. Ever.** Not in the installer, not in the template CLI,
   not in the test suite. This is the product's main claim; a `package.json`
   with a `dependencies` key is a bug, not a trade-off.
2. **Node 18 compatible.** CI runs 18, 20 and 22. No syntax or API newer than 18.
3. **The template is the product.** `template/` is what lands in someone's
   repository. Every word in it is read by both a human and a model — write it
   like documentation that ships, not like a placeholder.
4. **Never write to a user's existing file without `--force`.** Except
   `.claude/settings.json`, which merges. Re-running the installer must be safe.
5. **Simple beats clever.** No dependency, no parser generator, no config DSL.
   String splits and `readFileSync`.
6. **Do not commit unless asked.** Show the diff and wait.

## The loop

This project uses its own system. The logbook is real, not example data.

| File | What it holds | When you touch it |
| :-- | :-- | :-- |
| [STATE.md](STATE.md) | Where the project is *right now*. A snapshot, not a diary. | End of every session |
| [MISTAKES.md](MISTAKES.md) | Something broke. What, why, and the guardrail that stops it recurring. | The moment it happens |
| [LEARNINGS.md](LEARNINGS.md) | Something worked unusually well and is worth reusing. | The moment it happens |
| [DECISIONS.md](DECISIONS.md) | A choice made, with the alternatives considered. | When the choice is made |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the thing is built and why. | When the shape changes |

**Read before you write.** Before touching an unfamiliar area, pull the
relevant history instead of reading whole files:

```bash
node .bitacora/cli.mjs recall <tag>        # e.g. recall parser, recall install, recall format
node .bitacora/cli.mjs stats               # where the recurring friction is
```

This is deliberate. The logs are never `@`-imported into this file: an
`@MISTAKES.md` would burn thousands of tokens on every session for history
that is irrelevant 90% of the time. Retrieve by tag, pay only for what you use.

**Write as you go.** Do not save it for the end of the session:

```bash
node .bitacora/cli.mjs new mistake  "Short, specific title" --tags area,failure-mode --severity high
node .bitacora/cli.mjs new learning "Short, specific title" --tags area
node .bitacora/cli.mjs new decision "Short, specific title" --tags area
```

The command scaffolds the entry and assigns the id. Then fill the
`bitacora:fill-me` blocks in full prose — `doctor` fails while any remain.

## Commands

```bash
node test/smoke.mjs                        # this is the test suite. It must pass.
node bin/create-bitacora.mjs --yes --dir /tmp/try   # try the installer somewhere disposable
node .bitacora/cli.mjs doctor              # is this repo's own logbook healthy?
```

There is no build step and no lint config. `node --check` on both scripts plus
`node test/smoke.mjs` is the whole gate.

## Changing the template

Editing anything under `template/` changes what every future user gets, and
`test/smoke.mjs` asserts against the real thing. In particular:

- A new `{{PLACEHOLDER}}` needs a matching key in `collect()` in the installer,
  or it ships to users unsubstituted. The smoke test asserts no `{{...}}`
  survives.
- A new required file needs adding to `required` in `bitacora.config.json`
  *and* to the existence assertion in the smoke test.
- Prose in the templates may quote the entry marker — it does, on purpose, in
  `DECISIONS.md`. The parser is line-anchored so that this is safe. Do not
  "simplify" that back to `indexOf` (see M-0001).

## Before closing a session

1. `node test/smoke.mjs` passes.
2. `STATE.md` reflects reality, and its `updated:` line is today.
3. Anything that broke is in `MISTAKES.md`, with a guardrail — not just a description.
4. `node .bitacora/cli.mjs doctor` is green.

## What not to do

- No `git push`, no `--force`, no branch deletion unless asked explicitly.
- No emojis in code or files unless asked.
- No new `.md` files at the repo root. The logbook has a place for everything;
  if something genuinely has no place, say so instead of inventing a file.
- Do not add a test framework. The smoke test is the test suite.
