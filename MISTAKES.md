# Mistakes

> Every time something breaks, it gets an entry here — what happened, why it
> was possible, and the guardrail that makes it impossible to repeat.
>
> An entry without a guardrail is just a complaint. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new mistake "Title" --tags area,failure-mode`

<!-- bitacora:entry
id: M-0002
date: 2026-09-20
tags: [hooks, shell]
severity: low
files: [.claude/hooks/bitacora-session-start.sh]
-->
### paste -d silently cycles through its delimiter list

**What happened.** The session-start hook joins the top tag names for display.
It used `paste -sd', ' -`, and the output came out as
`dx,parser docs,self-reference` — commas and spaces alternating instead of
`, ` between every pair.

**Root cause.** `paste -d` takes a *list* of delimiters and cycles through it,
one per join. `', '` is therefore two delimiters, not one two-character
separator. The command is not wrong, it is doing exactly what it was asked;
the mental model of `-d` as "the separator" is what was wrong.

**Guardrail.** Join with a single-character delimiter and expand afterwards:
`paste -sd, - | sed 's/,/, /g'`. More generally: hook output is read by a
person and by a model, so every hook gets run by hand and its output read
before it ships. `bash -n` proves syntax, not sense.

<!-- bitacora:entry
id: M-0001
date: 2026-09-20
tags: [parser, docs, self-reference]
severity: medium
files: [template/.bitacora/cli.mjs, template/DECISIONS.md]
-->
### The entry parser counted a quoted marker in prose as a real entry

**What happened.** `doctor` reported three errors in `DECISIONS.md` about an
entry with no id, no date and no tags. There was no such entry. The example
entry in that template explains the format, and in doing so quotes the literal
string `<!-- bitacora:entry` inside backticks. `parseEntries` scanned for that
string with `indexOf` anywhere in the file, so the quotation opened a second
phantom entry that inherited the rest of the file as its body.

**Root cause.** The marker was treated as a token that could appear anywhere,
when structurally it only ever appears at the start of a line. Documentation
that describes its own format is the ordinary case for this tool, not an edge
case — the parser was wrong about its own input domain, and the first document
written with it was enough to prove that.

**Guardrail.** The scan is anchored to the start of a line (`^` with the `m`
flag) rather than a bare `indexOf`. The smoke test keeps a self-describing
example entry in the `DECISIONS.md` template permanently, so any regression in
the anchoring fails `test/smoke.mjs` at the "doctor passes once filled"
assertion rather than reaching a user.

