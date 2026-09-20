# Changelog

## 0.1.0 — unreleased

First release.

- `create-bitacora` installer: detects stack and build command from
  `package.json`, substitutes template variables, merges its hooks into an
  existing `.claude/settings.json`, and is safe to re-run.
- Logbook CLI (`.bitacora/cli.mjs`, zero dependencies): `doctor`, `new`,
  `recall`, `rotate`, `stats`.
- Six templates: `CLAUDE.md`, `ARCHITECTURE.md`, `STATE.md`, `MISTAKES.md`,
  `LEARNINGS.md`, `DECISIONS.md`, plus `bitacora.config.json`.
- Claude Code integration: session-start digest hook, checked session-end hook,
  and the `close-session` and `recall` skills.
- `doctor` checks: required files, leftover placeholders, per-file line budgets,
  entry metadata validity and id uniqueness, `STATE.md` freshness, and eager
  `@`-imports of a log into `CLAUDE.md`.
- 19 end-to-end assertions in `test/smoke.mjs`, CI on Node 18/20/22.
