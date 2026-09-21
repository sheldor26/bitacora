---
name: start-project
description: Set up a new project, or adopt an existing one, with a bitacora logbook — the structured memory that survives between sessions. Use when starting a project from scratch, scaffolding a repo, or before beginning any work that will span more than one session on a repository with no bitacora.config.json — a refactor, a migration, a cleanup before release, not only an explicit request to set one up.
---

# Start a project with a logbook

A project that will outlive one session needs memory that outlives one session.
Install it first, before feature code, because the first decisions are the ones
most worth recording and the easiest to lose.

## 1. Check whether this applies

Install the logbook when the work will span more than one session. **Ask first**
— do not install unprompted — when any of these is true:

- The repository belongs to someone else (a clone, a fork, a client codebase).
- It already has a `CLAUDE.md`, `AGENTS.md`, or its own documented conventions.
- It is a scratch directory, a spike, or a single-file experiment.

If `bitacora.config.json` already exists, there is nothing to install. Skip to
step 5.

## 2. Install

```bash
npx create-bitacora@latest --yes
```

`--yes` detects the project name, stack and build command from `package.json`.
Drop it to be prompted instead. The installer never overwrites an existing file
(pass `--force` for that) and merges its hooks into an existing
`.claude/settings.json`, so it is safe on a project that is already configured.

## 3. Fill the placeholders

`doctor` fails until this is done, and that is deliberate — a half-filled
logbook is worse than none, because it gets read and trusted.

Read the codebase first, then write. Do not interview the user for anything the
repository already answers.

- **The language of the record.** The installer defaults to English. Confirm it
  with the user, because the default answer is wrong for plenty of projects and
  because an agent otherwise writes in whatever language the conversation is in
  — which produces a repository half in one language and half in another. Ask
  once, here, and never again.
- **`CLAUDE.md`** — the non-negotiables. The template ships with generic ones;
  replace them with the rules that are actually true here. Ask the user for the
  two or three constraints that are not visible in the code: what must never be
  touched, what needs approval, how they want to be talked to.
- **`ARCHITECTURE.md`** — shape, data, boundaries, conventions. For an empty
  project this is the intended design; say so plainly rather than describing
  code that does not exist yet.
- **`STATE.md`** — for a new project: **Shipped** is empty, **Next** holds the
  first two or three moves. Set `updated:` to today.

Then:

```bash
node .bitacora/cli.mjs doctor
```

Run it until green.

## 4. Seed the decisions

This is the step that gets skipped, and it is the one that pays off most.

Every project starts with three to five choices that are expensive to reverse —
the framework, the database, the auth provider, the hosting, whether there are
tests. Those choices were just made, with reasons that are clear right now and
will be invisible in two months.

```bash
node .bitacora/cli.mjs new decision "Postgres over SQLite" --tags database
```

Fill **Context** (the forces in play at the time), **Decision**, and
**Consequences** (what this makes easy, and what it makes expensive). The
context is the payload: it is what lets the decision be revisited honestly when
the situation changes. `doctor` rejects a section with under forty characters of
real content, so a decision entered as three words will fail the check.

Do not invent reasoning. If a choice was made because it is what the user
already knows, write that — it is a real and legitimate reason, and a future
session needs to know it was not a benchmarked decision.

## 5. Work the loop

From here on, in every session on this project:

- **Before writing a plan** — `recall` the area first. Not before the first
  edit: a plan built without the history bakes the repeat mistake into it, and
  implementation then follows the plan faithfully. Auth, payments, migrations,
  data writes, scrapers, deploy config, anything touching money or user data.
  The logs are deliberately not loaded into context; retrieve by tag.
- **The moment something breaks** — log it, with a guardrail. Not at the end of
  the session, when the details are gone and it is the first thing to get cut.
- **The moment something breaks** — the project's `log-mistake` skill covers
  what separates a guardrail from a good intention. Use it; that difference is
  the whole value of the log.
- **Closing the session** — the `close-session` skill installed in the project
  walks the checklist. `STATE.md` current, `doctor` green.

## What not to do

- Do not add `@MISTAKES.md` to `CLAUDE.md`. It loads the whole log into every
  session for history that is irrelevant most of the time, and it undoes the
  entire design. `doctor` fails if it finds one.
- Do not write entries without a guardrail. "Be more careful with X" is a wish
  addressed to a model that will not remember it. A check, a test, a type or a
  refusal in the code is a guardrail — it works whether or not anyone reads it.
  `doctor` enforces this: a missing or near-empty **Guardrail** section fails
  the check, and the project installs a `log-mistake` skill covering how to
  write one.
- Do not let `STATE.md` become a diary. It is a snapshot and it has a line
  budget. History belongs in the logs, where `recall` can find it by tag.
