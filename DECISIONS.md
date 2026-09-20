# Decisions

> Architecture decisions, lightweight. One entry per choice that would be
> expensive to reverse, or that a future reader would otherwise second-guess.
>
> The point is not the decision — it is the *context*, so that when the context
> changes the decision can be revisited honestly. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new decision "Title" --tags area`

<!-- bitacora:entry
id: D-0006
date: 2026-09-20
tags: [hooks, claude-code]
-->
### The Stop hook reports through systemMessage instead of blocking

**Context.** A `Stop` hook can reach the model two ways. Exit 2 blocks the stop
and feeds stderr back, forcing the session to continue. Exit 0 with
`{"systemMessage": "..."}` on stdout surfaces the text without blocking. Plain
text, the original approach, reaches nothing (M-0007).

**Decision.** JSON `systemMessage`, exit 0. The hook reports and the session
ends regardless of what it found.

**Consequences.** The reminder can be ignored, and sometimes will be — blocking
would guarantee it is read. That is the wrong trade: a hook that refuses to let
someone stop working over an out-of-date `STATE.md` gets deleted within a week,
and a deleted hook enforces nothing at all. `doctor` in CI is where the hard
line belongs, because a pull request can wait and a person mid-thought cannot.
The cost is that the reminder is now JSON, so the hook needs `node` on PATH to
serialise it safely; it exits quietly if node is missing rather than emitting
malformed output.

<!-- bitacora:entry
id: D-0005
date: 2026-09-20
tags: [installer, templates]
-->
### Placeholders come in two classes, because an absent value means two things

**Context.** `{{PLACEHOLDER}}` variables in the templates are filled from
detection against the host project, and detection routinely comes up empty —
there may be no test script, no build script, no detectable stack. The original
`fill()` substituted whatever it had, which left blank command lines and
comment-only lines in `CLAUDE.md`, plus one special case hacked in for the test
line.

**Decision.** Two explicit classes. `COMMAND_VARS` name a command: if the
project has no such command, the entire line is dropped, so a repo with no test
suite ships no test line. `PROSE_HINTS` name something a human has to write: an
empty value becomes a `bitacora:fill-me` block with a hint, which `doctor` then
refuses to let them forget. Anything unlisted substitutes empty.

**Consequences.** Line-dropping is only safe inside a fenced command block —
inside a numbered list it renumbers the list — so the templates must keep
command placeholders out of prose, which is now a rule in `CONTRIBUTING.md` and
the reason `CLAUDE.md`'s closing checklist says "the build passes (see Commands
above)" instead of naming the command twice. In exchange, the special case is
gone, undetectable values fail loudly instead of shipping blank, and adding a
placeholder is a decision about which class it belongs to rather than an
invitation to hack `fill()` again.

<!-- bitacora:entry
id: D-0004
date: 2026-09-20
tags: [global, install, claude-code]
-->
### The global rule goes in a sentinel block, not a separate imported file

**Context.** `--global` has to add a rule to `~/.claude/CLAUDE.md`, a file the
user owns and has probably written by hand. Three options: append and never
touch it again; write a separate `~/.claude/bitacora.md` and add an
`@bitacora.md` import; or delimit an owned region inside the file.

**Decision.** A `BEGIN:bitacora`/`END:bitacora` HTML comment block. Present, it
is replaced; absent, it is appended. Nothing outside it is ever read back or
rewritten.

**Consequences.** Updates and removal are exact, and re-running is safe — the
smoke test asserts a single block after three runs with the user's own rules
intact. Append-only would duplicate the rule on every run. The separate
imported file would have been worse than untidy: this project's whole argument
is that eagerly `@`-imported memory is the problem, and installing itself that
way would have contradicted it in the act. The cost is that a user who edits
inside the block loses those edits on the next `--global`, and the block does
not warn them — a documentation gap worth closing if anyone hits it.

<!-- bitacora:entry
id: D-0003
date: 2026-09-20
tags: [dx, install]
-->
### The installer leaves `doctor` failing on purpose

**Context.** The template ships with `bitacora:fill-me` placeholders in
`CLAUDE.md`, `ARCHITECTURE.md` and `STATE.md`. The obvious alternative is to
omit those sections and let the user add them, so that a fresh install is
green.

**Decision.** Ship the placeholders, have `doctor` treat them as errors, and
say so in the installer's closing message and in the README.

**Consequences.** A first run that fails looks like a bug and some people will
file it as one. Accepted, because a half-filled logbook is actively worse than
no logbook: the agent reads it and trusts it. A red `doctor` with three named
files is a to-do list; an empty template is an invitation to forget. The FAQ
answers it directly.

<!-- bitacora:entry
id: D-0002
date: 2026-09-20
tags: [architecture, supply-chain]
-->
### The CLI is copied into the user's repository, not installed as a dependency

**Context.** `.bitacora/cli.mjs` is about 440 lines with no dependencies. It
could as easily be the runtime of the published package, with the project
depending on `bitacora` and calling a binary.

**Decision.** The installer copies the script into the target repository.
`create-bitacora` is a scaffolder only; nothing remains installed.

**Consequences.** No supply chain, no version drift, no install step in CI, and
the agent can read the source of its own tooling when behaviour surprises it.
The cost is that fixes do not propagate: users re-run the installer, which
leaves their logs alone. Given that the script is small and stable and the data
is markdown, that trade is clearly correct here — and it would be clearly wrong
for anything with a real dependency tree.

<!-- bitacora:entry
id: D-0001
date: 2026-09-20
tags: [format, parsing]
-->
### Entry metadata lives in an HTML comment

**Context.** Entries must be readable as prose by a human on GitHub and
parseable by a script. YAML frontmatter per entry is the conventional answer,
but frontmatter is a document-level construct — repeating it mid-file renders
as visible junk. A JSON sidecar would drift from the prose it describes.

**Decision.** A line-anchored HTML comment, `bitacora:entry`, carrying `id`,
`date`, `tags` and optional `severity` and `files`. GitHub renders it as
nothing; the CLI parses it with a string split.

**Consequences.** Zero dependencies, invisible to readers, trivial to parse, and
the metadata cannot drift from its prose because it sits on top of it. In
exchange, no markdown tooling validates the metadata, so `doctor` has to — and
the parser must be anchored to line starts, which cost one real bug to learn
(see M-0001).

