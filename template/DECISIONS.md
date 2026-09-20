# Decisions

> Architecture decisions, lightweight. One entry per choice that would be
> expensive to reverse, or that a future reader would otherwise second-guess.
>
> The point is not the decision — it is the *context*, so that when the context
> changes the decision can be revisited honestly. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new decision "Title" --tags area`

<!-- bitacora:entry
id: D-0001
date: 1970-01-01
tags: [bitacora, example]
-->
### Example entry — delete this one once you have a real decision

**Context.** The logbook needs to be readable by a human on GitHub and parseable
by a script, without a database and without frontmatter cluttering the rendered
page.

**Decision.** Entry metadata lives in an HTML comment (`<!-- bitacora:entry ... -->`).
GitHub renders it as nothing; the CLI parses it with a string split.

**Consequences.** Cheap to write, invisible to readers, trivial to parse — but
the metadata is not validated by any markdown tooling, so `doctor` has to check
it. That check is the price of the simplicity.

