# Contributing

Issues and pull requests are welcome. This is a small project with a narrow
scope, and the scope is the point — the fastest way to get a change merged is
to show that it makes the existing idea work better, rather than adding a new
one.

## Running it

No install step, no dependencies.

```bash
git clone https://github.com/sheldor26/bitacora
cd bitacora
node test/smoke.mjs                              # the test suite
node bin/create-bitacora.mjs --yes --dir /tmp/try   # try the installer somewhere disposable
node .bitacora/cli.mjs doctor                    # this repo's own logbook
```

## The rules that are not up for negotiation

**Zero dependencies.** Production, development and test. A `dependencies` or
`devDependencies` key in `package.json` will be declined, however small the
package. This is the product's main claim.

**Node 18.** CI runs 18, 20 and 22. No syntax or API newer than 18.

**A skill names the moment, not just the job.** Every skill's `description`
must say *when* to reach for it — before a plan, when something breaks, before
`/clear`. A skill wired to the wrong moment is worse than a missing one: it
fires too late to change anything and still looks like it worked. `recall`
shipped saying "before the first edit" when the moment that decides the outcome
is before the plan (`M-0009`). A smoke assertion enforces this.

**Claims about other products cite their docs.** Any sentence comparing bitacora
to Claude Code's auto memory, to another tool, or to anything this project does
not control must be written from that product's own documentation, with the
page in hand. Comparisons are the claims most likely to be wrong and least
likely to be re-checked, because they flatter whoever wrote them. This rule
exists because the FAQ shipped a backwards description of Claude Code's memory
(`M-0008`), and the same missing habit had already shipped a hook wired to a
stream the platform does not deliver (`M-0007`).

**No test framework.** `test/smoke.mjs` spawns the real installer into a real
temporary directory and asserts on exit codes and file contents. It found the
only genuine bug this project has had (`M-0001`), which unit tests over
fixtures would have missed, because the fixtures would have been written by the
same wrong assumption. Add assertions there.

## This repository uses its own system

The operational files exist twice: in `template/` as what ships to users, and
at the root as this project's own installed copy. Edit `template/`, then:

```bash
npm run sync:self
```

Do **not** run the installer with `--force` at the repository root — that
overwrites this project's real `CLAUDE.md`, `STATE.md` and logs with template
placeholders. CI checks that the two copies are in sync.

The logbook at the root is real, not sample data. If your change breaks
something or teaches something, log it:

```bash
node .bitacora/cli.mjs new mistake "Title" --tags area --severity medium
```

`doctor` will reject the entry if the **Guardrail** section names an intention
rather than a mechanism. That check applies to contributors too.

## Changing the template

`template/` is read by both a human and a model in every project that installs
it. Write it like documentation that ships.

- A new `{{PLACEHOLDER}}` needs a matching key in `collect()` in the installer
  and a decision about which class it belongs to: `COMMAND_VARS` (the line is
  dropped when the command does not exist) or `PROSE_HINTS` (it becomes a
  `fill-me` block the user must write). The smoke test asserts that no `{{...}}`
  survives installation.
- A command placeholder may only appear inside a fenced code block. Inside a
  numbered list, dropping its line renumbers the list.
- A new required file goes in `required` in `bitacora.config.json` *and* in the
  existence assertion in the smoke test.
- Prose in the templates may quote the entry marker — `DECISIONS.md` does, on
  purpose. The parser is anchored to line starts so that this is safe.

## What will probably be declined

- Dependencies, of any size, for any reason.
- A test framework.
- Agents, rule packs, or a large command library. That space is well covered by
  [Everything Claude Code](https://github.com/affaan-m/everything-claude-code);
  this project does one thing.
- Embeddings, vector search or a hosted index for `recall`. It is grep over
  structured markdown, and at one-repository scale that is enough — with the
  large advantage that a human can read and edit the store.
- Loosening the `Guardrail` requirement. An entry without a mechanism is the
  failure mode the project exists to prevent.

## Reporting a bug

Include the command, what you expected, what happened, your Node version, and
the output of `node .bitacora/cli.mjs doctor` if it is relevant. A failing
assertion added to `test/smoke.mjs` is the most useful bug report there is.
