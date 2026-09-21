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

<!-- bitacora:entry
id: M-0004
date: 2026-09-20
tags: [doctor, thesis, verification]
severity: high
files: [.bitacora/cli.mjs]
-->
### doctor did not enforce the Guardrail section the whole project argues for

**What happened.** The README says "an entry without a guardrail is a
complaint". `docs/the-loop.md` says it twice more. The `new` template prompts
for it. And `doctor` never checked it: the only entry-body check was that no
`bitacora:fill-me` placeholder survived. Deleting the placeholder and writing
"**Guardrail.** Be more careful with prices." passed green. The single check
the whole method rests on did not exist, in a tool whose entire pitch is that it
turns a habit into a check.

**Root cause.** The checks were written by asking "what can go structurally
wrong with a markdown file" — missing file, bad id, unparseable date, over
budget. Every one is mechanical and every one was easy. The claim that
distinguishes this project from a folder of markdown files is a claim about
*content quality*, which is harder to check, so it never got written and its
absence was invisible: the documentation asserted it so confidently that
re-reading the documentation confirmed it.

**Guardrail.** Section presence and minimum real content are now checked per
entry, per log, configurable via `sections` in `bitacora.config.json`, with
`Guardrail` getting a message that says what a guardrail is rather than just
that the section is short. Two smoke-test assertions pin it: one for a gestural
guardrail, one for a missing section. More generally, the `sections` mechanism
means any claim the templates make about entry structure is now enforced by the
same code path rather than by hope.

<!-- bitacora:entry
id: M-0005
date: 2026-09-20
tags: [installer, templates, test-coverage]
severity: medium
files: [bin/create-bitacora.mjs]
-->
### A fill-me comment shipped to any project that had a test script

**What happened.** `template/CLAUDE.md` had a commands block whose test line
carried an inline `<!-- bitacora:fill-me or delete this line if there is no
test suite -->`, and `fill()` removed that line only when `TEST_COMMAND` was
empty. So a project *with* a test script got the command substituted correctly
and kept the placeholder comment — and since `doctor` errors on any surviving
`fill-me`, every Node project with tests would have installed the logbook and
immediately failed its own health check with a confusing message.

**Root cause.** The smoke test's fixture `package.json` had `dev` and `build`
scripts but no `test` script, so the only path exercised was the one where the
line gets deleted. A conditional with two branches had one branch covered, and
the covered branch was the one the author happened to be thinking about.

**Guardrail.** `fill()` no longer special-cases anything: a line containing a
placeholder whose command does not exist in this project is dropped whole, for
all three command variables, and the templates carry no instructional comments
inside command blocks. The smoke test now installs into three different
fixtures — with tests, without tests, and with no `package.json` at all — and
asserts `doctor` reaches green in each. When a template decision depends on
what a project has, every value of "what a project has" needs a fixture.

