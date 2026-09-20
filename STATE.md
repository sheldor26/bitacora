# State

updated: 2026-09-20

> A snapshot of where this project is right now — the file a new session reads
> first. It answers "what exists, what is half-done, what is next".
>
> It is not a diary. When this file starts telling stories, the stories belong
> in the logbook. `doctor` enforces that with a line budget.

## Shipped

- `template/` — the six markdown files, `bitacora.config.json`, the two hooks
  and the two Claude Code skills that land in a user's project.
- `template/.bitacora/cli.mjs` — zero-dependency CLI: `doctor`, `new`,
  `recall`, `rotate`, `stats`.
- `bin/create-bitacora.mjs` — installer. Detects stack and build command from
  `package.json`, substitutes the `{{PLACEHOLDER}}` variables, merges its hooks
  into an existing `.claude/settings.json`, and is safe to re-run.
- `test/smoke.mjs` — 19 end-to-end assertions against the real installer in a
  real temp directory. No test framework.
- Docs: the loop, context budget, entry format, FAQ.
- CI on Node 18/20/22 plus a `bash -n` pass over the hooks.
- This repository uses its own system. The logbook below is real.

## In flight

Nothing. The next move is publication, not code.

## Next

1. Decide the GitHub account and repository name, then replace `USERNAME` in
   `package.json` (`repository`, `homepage`, `bugs`).
2. `npm publish` as `create-bitacora` so `npm create bitacora@latest` resolves.
3. Use it on the next real project from day one, and let that project's logbook
   be the proof in the README.

## Known rough edges

- `recall` is substring matching over markdown. That is the intended design at
  one-repository scale, but it means a common word matches noisily. Tag
  discipline is the mitigation, and it is documented rather than enforced.
- The archive index accumulates one line per retired entry forever. At a few
  hundred entries that tail is itself worth rotating. Not a problem yet;
  deliberately not solved ahead of evidence.
- Only Claude Code gets hooks and skills out of the box. Every other tool gets
  the markdown and the CLI, which is most of the value but not all of it.
