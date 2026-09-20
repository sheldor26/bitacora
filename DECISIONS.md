# Decisions

> Architecture decisions, lightweight. One entry per choice that would be
> expensive to reverse, or that a future reader would otherwise second-guess.
>
> The point is not the decision — it is the *context*, so that when the context
> changes the decision can be revisited honestly. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new decision "Title" --tags area`

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

