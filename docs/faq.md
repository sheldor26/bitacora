# FAQ

### Isn't this just `CLAUDE.md` with extra steps?

`CLAUDE.md` holds rules, which are stable. This holds history, which
accumulates. Putting accumulating content in an always-loaded file is the
problem bitacora exists to solve — and `doctor` fails if you try, by checking
that `CLAUDE.md` does not `@`-import a log.

### Why not use Claude Code's built-in memory?

Use both, but know what each one is. Claude Code's **auto memory** is stored
per repository at `~/.claude/projects/<project>/memory/` — notes Claude writes
for itself about your preferences, your corrections, and ongoing project
context. It is on by default.

It is outside your repository, so it does not version with the code, does not
appear in a pull request, and is invisible to a teammate or to any other tool.
Nothing checks whether an entry is useful. And it loads at the start of every
conversation, which is the context cost this project is built to avoid — except
you never see the file, so you cannot tell when it has grown.

Auto memory is good at learning how you like to work. This is for what the
project learned the hard way, in the repository, where it survives you changing
assistants.

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

### `doctor` rejected my entry for a "near-empty Guardrail". I wrote a sentence.

Then the sentence was probably a lesson rather than a mechanism. The check wants
the thing that makes the failure impossible without anyone remembering: a field
the importer refuses to overwrite, a type that will not compile, a test, a hook,
a script in CI. Forty characters is the floor, but length is not the test —
"added `--strict` to the CI doctor run" passes and is a perfectly good guardrail.

If nothing can prevent it, say that and say what detects it instead. That is a
real entry. An empty section is not.

### Can I turn the section requirement off?

Not with a flag. You can change `sections` for a log in
`bitacora.config.json` — set it to `[]` and nothing is required. It is your
repository. But that requirement is the difference between this and a folder of
markdown files, so consider whether the friction is telling you the entry is not
finished.

### Does `--global` affect projects that already have a logbook?

Only in that it tells Claude Code to `recall` instead of reading whole logs. It
never installs anything into an existing project on its own, and the skill asks
before adopting a repository that already has its own conventions.

### How do I uninstall?

Per project: delete the six markdown files, `bitacora.config.json`,
`.bitacora/`, and the bitacora entries from `.claude/`. Globally:
`npx create-bitacora --global --remove`, which strips its block from
`~/.claude/CLAUDE.md` and leaves everything else there alone.
