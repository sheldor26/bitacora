# FAQ

### Isn't this just `CLAUDE.md` with extra steps?

`CLAUDE.md` holds rules, which are stable. This holds history, which
accumulates. Putting accumulating content in an always-loaded file is the
problem bitácora exists to solve — and `doctor` fails if you try, by checking
that `CLAUDE.md` does not `@`-import a log.

### Why not use Claude Code's built-in memory?

Use both. Built-in memory follows *you* across projects. This lives in the
repository, versions with the code, shows up in pull requests, and is readable
by a collaborator or a different tool entirely. A guardrail that only exists in
one person's assistant is not a guardrail.

### Won't the agent just ignore the instructions to log things?

Sometimes. That is why the `Stop` hook checks rather than trusts: it runs
`doctor`, notices when `STATE.md` was not touched, and says so. It does not
block — blocking a session over bookkeeping is how people delete the hook.

### Why a script inside my repo instead of a dependency?

No supply chain, no version drift, no install step, and the agent can read the
source of its own tooling when behaviour surprises it. The cost is that you do
not get updates automatically — re-run the installer, which leaves your logs
alone and only refreshes what you have not customised.

### Does this work with Cursor / Codex / Aider / Copilot?

Yes. The files are markdown and the CLI is Node. Only the two hooks and the two
skills are Claude Code specific; wire equivalents yourself or skip them. The
habit is the part that matters and it is tool-agnostic.

### `doctor` fails right after I install it. Is that a bug?

No, it is the design. The template ships with `bitacora:fill-me` placeholders in
`CLAUDE.md`, `ARCHITECTURE.md` and `STATE.md`. An unfilled logbook is worse than
none, because the agent will read it and trust it. Fill them, then `doctor`
goes green.

### My `MISTAKES.md` is already 700 lines. Can I import it?

Not automatically, and you probably should not want to. Read it once, keep the
entries that still have teeth, rewrite each one with a real guardrail, and let
the rest go. Most of a long mistakes log is entries that were never actionable —
the rewrite is where the value is, not the migration.

### What if I disagree with a guardrail my past self wrote?

Say so explicitly and change it, in the entry. What you must not do is route
around it silently — that is how the same failure returns wearing a different
hat. The `recall` skill tells the agent the same thing.

### Is there a hosted version / dashboard / MCP server?

No. It is markdown in a git repository, on purpose.
