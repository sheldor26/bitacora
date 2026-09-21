# MISTAKES — 2026

> Archived by bitacora. Still searchable with "recall".

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

<!-- bitacora:entry
id: M-0003
date: 2026-09-20
tags: [tooling, shell]
severity: medium
files: [DECISIONS.md]
-->
### An unquoted heredoc let the shell expand backticks inside the payload

**What happened.** A documentation edit was applied by piping a Python script
into `python3` with `<<PYEOF` instead of `<<'PYEOF'`. Bash therefore expanded
the heredoc before Python ever saw it, running every backtick span in the prose
as a command substitution and replacing it with the (empty) output. The new
`D-0004` entry landed with every inline code span silently deleted —
"**Context.** `--global` has to add a rule to `~/.claude/CLAUDE.md`" became
"**Context.**  has to add a rule to ,". `doctor` passed, because the metadata
was intact and prose quality is not something it can check.

**Root cause.** The payload was markdown about a shell tool, so it was dense
with backticks and `$`. An unquoted heredoc is safe only when the content has
neither. The failure is silent by construction: substitution of a
non-command yields empty output, not an error, so nothing fails loudly and the
damage is only visible by reading the result.

**Guardrail.** Quote the delimiter — `<<'EOF'` — in every heredoc whose body is
not meant to be expanded, which is every heredoc in this repository. Where
prose has to reach a script, write it to a file with its own quoted heredoc and
have the script read that file, rather than embedding it in the script's source.
And read back the region that was edited: `doctor` validates structure, never
sense.

