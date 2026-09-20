# Mistakes

> Every time something breaks, it gets an entry here — what happened, why it
> was possible, and the guardrail that makes it impossible to repeat.
>
> An entry without a guardrail is just a complaint. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new mistake "Title" --tags area,failure-mode`

<!-- bitacora:entry
id: M-0001
date: 1970-01-01
tags: [bitacora, example]
severity: low
files: [MISTAKES.md]
-->
### Example entry — delete this one once you have a real mistake

**What happened.** Nothing. This entry exists so the format is visible before
the first real failure, and so `recall` and `doctor` have something to chew on.

**Root cause.** A logbook with no entries teaches nobody the format, so the
first real entry gets written badly, or not at all.

**Guardrail.** Replace this entry with your first real one. Note that the
`severity` field is only on mistakes, and that `files` is optional but makes
`recall <path>` work.

