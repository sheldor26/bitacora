# Mistakes

> Every time something breaks, it gets an entry here — what happened, why it
> was possible, and the guardrail that makes it impossible to repeat.
>
> An entry without a guardrail is just a complaint. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new mistake "Title" --tags area,failure-mode`

<!-- bitacora:entry
id: M-0014
date: 2026-09-21
tags: [cli, template]
severity: medium
-->
### Removing the shipped example entries has no supported path

**What happened.** Adopting bitacora into a real project ends with deleting the three shipped
example entries, and the CLI has no command for it. The deletion was done with
a script that split the file on the entry marker — and DECISIONS.md D-0001
contains that marker as prose inside a code span, describing the format. The
split produced a phantom fourth part, the script kept it, and the file was left
with an orphaned entry body. doctor caught it immediately: no id, no tags, no
date, no sections.

**Root cause.** Two causes that only bite together. The CLI can add an entry and retire an
entry to the archive, but cannot remove one, so the first thing every adopter
does is edit the file by hand. And the parser in the CLI is careful about
markers inside code spans — withoutCode() exists precisely for this — while
anything written outside the CLI is not. The template ships a trap and no tool
to walk past it.

**Guardrail.** Add a remove command to the CLI that deletes an entry by id through the same
parser that doctor uses, and have the installer take --without-examples so a
fresh install can start empty. Until it exists, the start-project skill must
delete example entries with the CLI's own parse, never with a string split.

<!-- bitacora:entry
id: M-0013
date: 2026-09-20
tags: [global, trigger, claude-code]
severity: high
files: [global/CLAUDE.md.block]
-->
### The global rule only fired when the user already knew to ask

**What happened.** A real project — an existing codebase being cleaned up for
open source release, work spanning several sessions — was opened with the global
rule installed, and the `start-project` skill did not fire. The session
refactored a 2,101-line file into ten modules with no logbook at all. The rule
said to follow the skill "when starting a new project, or **when asked** to set
up a repository that has no `bitacora.config.json`". The request was a refactor,
so neither clause matched, and the rule behaved exactly as written.

**Root cause.** The adoption clause required the person to ask — which requires
them to already know the logbook exists and to remember it at the right moment.
That is precisely the burden a global rule exists to remove, so the clause
cancelled the feature it was meant to deliver. The new-project path fired
correctly because starting a project is unmistakable; adoption is the ambiguous
case, and it got the narrower trigger rather than the wider one.

**Guardrail.** The rule now fires on any work that will not finish in one
sitting on a repository without a logbook, naming the cases that were silently
excluded — refactor, migration, cleanup before release — and says explicitly not
to wait to be asked. Widening it is safe because the caution lives one layer
down: the skill's first step already refuses to adopt a repository with
conventions of its own without asking. The general rule: put the trigger wide
and the caution deep, never the reverse, or the guard ends up suppressing the
feature instead of shaping it.

<!-- bitacora:entry
id: M-0012
date: 2026-09-20
tags: [rotate, budgets, design]
severity: high
files: [.bitacora/cli.mjs]
-->
### rotate was inert in exactly the case it existed for

**What happened.** `doctor` warned that `MISTAKES.md` was at 90% of its 400-line
budget. `rotate` — the command that warning points at — answered "nothing to
rotate: every log is within its entry budget" and did nothing. Asked to compact,
the tool's own compaction was a no-op.

**Root cause.** Two budgets invented for two different reasons and never checked
against each other. `maxLines` guards readability and drives the warning and the
error; `keepEntries` decides what `rotate` retires. Entries in this repo average
33 lines, so 20 of them is roughly 660 lines — the line budget is blown long
before the entry count is reached, and `rotate` is therefore inert in precisely
the situation it exists for. The defaults shipped contradicting each other, and
the only way to notice is to accumulate real entries at a realistic length,
which takes weeks of use or one very long day.

**Guardrail.** `rotate` now retires from the bottom until the file fits its line
budget, down to a floor of three live entries, on whichever budget binds first.
A smoke assertion builds a log that is over `maxLines` and under `keepEntries` —
the exact inert case — and fails unless `rotate` archives and `doctor` comes
back green; that path had never executed before the test forced it. The
near-budget warning now says rotate archives once the limit is crossed and does
nothing before, so it stops implying a fix that would not fire.

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


## Archived

Older entries, one line each. `recall` still searches them in full.

- `M-0003` An unquoted heredoc let the shell expand backticks inside the payload — [tooling, shell] → `docs/bitacora-archive/mistakes-2026.md`
- `M-0002` paste -d silently cycles through its delimiter list — [hooks, shell] → `docs/bitacora-archive/mistakes-2026.md`
- `M-0001` The entry parser counted a quoted marker in prose as a real entry — [parser, docs, self-reference] → `docs/bitacora-archive/mistakes-2026.md`
