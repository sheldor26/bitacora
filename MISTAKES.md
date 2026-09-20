# Mistakes

> Every time something breaks, it gets an entry here — what happened, why it
> was possible, and the guardrail that makes it impossible to repeat.
>
> An entry without a guardrail is just a complaint. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new mistake "Title" --tags area,failure-mode`

<!-- bitacora:entry
id: M-0011
date: 2026-09-20
tags: [templates, conventions, claude-code]
severity: high
files: [template/CLAUDE.md]
-->
### The first real project came out half English, half Spanish

**What happened.** The first project scaffolded with the published package came
out bilingual. The scaffolding was English, because it comes from the template;
every word the agent wrote was Spanish — 159 Spanish words in `DECISIONS.md`,
31 in `ARCHITECTURE.md`, 23 in `STATE.md`, and Spanish comments in three source
files. For a public repository aimed at an international audience that is the
worst of both options: it reads as unfinished to everyone.

**Root cause.** The template never stated what language the record is written
in. Being written in English is a signal, but a weak one, and it loses to the
strongest signal an agent has: the language of the conversation it is in. An
unstated convention is not a convention — it is a preference the author holds
and nobody else can see. The same class as M-0009: the design was correct in the
author's head and absent from the artifact.

**Guardrail.** `RECORD_LANGUAGE` is now a filled variable, defaulting to English
and prompted for on an interactive install, written into the non-negotiables
where the agent reads it every session — with the reason attached, because a
rule without a reason is the first one dropped under pressure. A smoke assertion
fails if the line or its reason disappears from the template.

Honest limit: this is a stated convention, not an enforced check. `doctor` could
not detect language cheaply or reliably, and a detector with false positives on
a technical term or a proper noun would be worse than none. What is enforced is
that the instruction is present and reasoned, which is most of what makes an
instruction followed.

<!-- bitacora:entry
id: M-0010
date: 2026-09-20
tags: [installer, detection, claude-code]
severity: high
files: [bin/create-bitacora.mjs]
-->
### CLAUDE.md advertised a test command that only fails

**What happened.** The first real project scaffolded with the published package
— `predeploy`, started with `npm init -y` — got a `CLAUDE.md` whose commands
block read `npm run test  # test suite`. That script is the stub `npm init`
writes: `echo "Error: no test specified" && exit 1`. Its entire behaviour is to
fail. So the file the agent trusts most told it to run a command that always
errors, and the session-close checklist pointed at the same command.

**Root cause.** Detection treated the *presence* of a `scripts.test` key as
evidence that a test command exists. For `npm init -y` — the single most common
starting state for a Node project, and therefore the most common state for a
project someone installs a logbook into on day one — presence means the
opposite: the key exists precisely because there is no test suite. The check was
written against the manifest rather than against what the manifest means.

**Guardrail.** The installer now ignores a script matching `/no test specified/`
and a smoke assertion installs into an `npm init -y` fixture, failing if any
test line reaches `CLAUDE.md`. The wider rule, which is the part worth keeping:
**anything detected from a manifest and then written as an instruction gets
checked against the known lying case first.** A manifest describes intent, not
capability, and an instruction that is wrong is worse than one that is missing —
the agent follows it.

<!-- bitacora:entry
id: M-0009
date: 2026-09-20
tags: [skills, workflow, design]
severity: high
files: [.claude/skills/recall.md]
-->
### The touchpoints were placed by file lifecycle, not by how work actually flows

**What happened.** Two symptoms, found by reading 102 transcripts of how people
actually work with Claude Code rather than by reading this project's code.

First: the `recall` skill said to pull history "before the first edit in any
area you have not touched this session". But plan mode is the dominant practice
in that corpus — 102 mentions across 25 files, one instructor saying he uses it
"100% of the time before I build anything" — and the plan is written before the
first edit. So the instruction fired *after* the decision it existed to inform.
A plan built without the history bakes the repeat mistake in, and implementation
then carries it out faithfully; recalling at edit time means either discarding
the plan or quietly routing around the guardrail, and routing around it is what
actually happens.

Second: subagents run in their own context window. They inherit the main
`CLAUDE.md`, so they can read these skills, but they return a summary and every
specific thing they saw dies with their context. Subagents get the exploratory
and verification work, which is exactly where mistakes are discovered — and
people are taught to delegate *more* of it to save context. The system had no
path back for any of it.

**Root cause.** The touchpoints were derived from the artifact's lifecycle —
when is a file read, when is it written — instead of from the workflow: when
does a person actually decide, and where does the work physically happen.
`recall` was placed at editing because editing is when files change, not because
that is when history changes an outcome. Nothing in the code could reveal this,
because the code is coherent with the wrong model; only watching how people work
could.

**Guardrail.** Every shipped skill's frontmatter `description` must name its
trigger moment — a smoke assertion walks `template/.claude/skills` and
`global/skills` and fails any description without a temporal trigger, because a
description that cannot say *when* has not had that question asked of it. The
rule is stated in `CONTRIBUTING.md` alongside it. `recall` now fires before the
plan, `close-session` names `/clear` as well as session end, and `log-mistake`
carries the rule that the main session writes up what a subagent found, while
the summary is still in hand.

<!-- bitacora:entry
id: M-0008
date: 2026-09-20
tags: [docs, claude-code, verification]
severity: medium
files: [docs/faq.md]
-->
### The FAQ stated a fact about Claude Code's memory that was wrong

**What happened.** `docs/faq.md` answered "why not use Claude Code's built-in
memory?" with "built-in memory follows *you* across projects". It does not.
Auto memory is stored per repository at `~/.claude/projects/<project>/memory/`,
shared across worktrees of the same repo — the opposite axis. The answer then
built a differentiation argument on top of the wrong fact.

**Root cause.** The claim was written to make the comparison come out well, from
a general sense of how assistant memory usually works, without opening the
documentation of the product being compared against. It reads as confident and
specific, which is exactly what stops anyone re-checking it.

**Guardrail.** The comparison is now written from the memory reference and
states what is actually true and actually differentiating: auto memory lives
outside the repository, nothing validates its entries, and it loads at the start
of every conversation. Standing rule, now in `CONTRIBUTING.md`: any sentence
this project writes about another product cites that product's own docs, or it
does not ship. Comparisons are the claims most likely to be wrong and least
likely to be checked, because they flatter the author.

<!-- bitacora:entry
id: M-0007
date: 2026-09-20
tags: [hooks, claude-code, silent-failure]
severity: high
files: [.claude/hooks/bitacora-session-end.sh]
-->
### The session-end hook printed to a stream Claude Code never reads

**What happened.** The `Stop` hook printed its reminder — stale `STATE.md`, a
failing `doctor` — as plain text on stdout. Claude Code adds plain stdout to the
model's context for only four events (`UserPromptSubmit`, `UserPromptExpansion`,
`SessionStart`, `PostModelSwitch`); for everything else it goes to the debug
log. `Stop` is everything else. So the checked session close, advertised in the
README, the CHANGELOG, `STATE.md` and the global skill, produced output that
neither Claude nor the user ever saw. The feature had never worked.

**Root cause.** The hook was written from a plausible model of how hooks behave
— a script prints, someone reads it — instead of from the hook reference. It
was tested by running the script by hand and reading the output in a terminal,
which confirms the script works and says nothing about whether Claude Code
surfaces it. Worse, this is a silent failure by construction: an unread stream
produces no error, so every signal available said the feature was fine.

**Guardrail.** The hook now emits `{"systemMessage": "..."}` as JSON on stdout
with exit 0, which is the documented channel that reaches the model without
blocking the stop. Three smoke assertions pin it: the hook exits 0, its stdout
parses as JSON carrying a non-empty `systemMessage`, and it stays silent when
there is nothing to report. A fourth asserts every event name in
`settings.json` is on the documented list, because an unknown event name is
ignored in the same silence that hid this one.

<!-- bitacora:entry
id: M-0006
date: 2026-09-20
tags: [parser, self-reference, doctor]
severity: medium
files: [.bitacora/cli.mjs]
-->
### The fill-me detector repeated M-0001's failure mode on a different marker

**What happened.** Writing the entry for M-0005 meant quoting the offending
placeholder comment in the prose. `doctor` then reported that entry as having
unfilled placeholders, because the detector searched the raw entry text for the
marker and found the quotation. M-0001 was this same failure — prose describing
the format tripping the code that reads the format — and its guardrail, an
anchored entry-marker scan, did not generalise to the second marker.

**Root cause.** M-0001 was fixed as a point defect in one regular expression
rather than as a class. The class is: this tool's documents necessarily quote
this tool's syntax, so every scan for a marker has a false-positive path, and
each new marker reintroduces it. Anchoring worked for the entry marker only
because that one always sits at a line start; `bitacora:fill-me` appears
mid-line by design, so anchoring was never available to it.

**Guardrail.** One rule for all markers, in code: `withoutCode()` strips fenced
blocks and inline spans before any marker scan, so a marker in backticks is
prose and a bare marker is a marker. Inline spans may wrap across lines but not
across a blank line, because hand-written markdown at 80 columns wraps them
constantly — the first version of the helper missed that and the bug survived
one more round. A smoke-test assertion keeps an entry whose prose quotes both
markers, in backticks and soft-wrapped, and requires `doctor` to stay green.

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

