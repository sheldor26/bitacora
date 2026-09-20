# Learnings

> The counterpart to MISTAKES.md. When something works unusually well, the
> transferable part gets written down before it is forgotten.
>
> The test for an entry: would it change how you approach the *next* problem?
> If not, it is a changelog line, not a learning. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new learning "Title" --tags area`

<!-- bitacora:entry
id: L-0006
date: 2026-09-20
tags: [positioning, docs]
-->
### Answer the strongest objection in the README, in the objector's own words

**What worked.** Going looking for the sharpest argument *against* this category
of project — not for supporting evidence — and quoting it in the README before
answering it. The best one came from the person who led plugin design on the
platform this tool plugs into: memory is model-curated text files, and therefore
not a context engineering primitive.

**Why it worked.** The objection is correct about the thing it describes, and it
would occur to any informed reader within about thirty seconds of understanding
the project. Leaving it unaddressed means the reader raises it themselves, in
their own head, unanswered — and at that moment the project looks naive rather
than considered. Quoting it does the opposite: it demonstrates the objection was
already understood, and the answer then lands as a definition rather than a
defence. It also produced better writing than anything drafted from scratch. The
line between "model-curated memory" and "an engineered artifact" is a sharper
description of what this project is for than the four ideas it had been
explaining, and it came from the critic.

**Reuse it when.** Any project in a category with articulate critics, which is
every category worth entering. Search for the strongest case against before
writing the case for. If the objection cannot be answered honestly, that is
worth far more than a README section — it means the design is wrong, and it is
cheaper to learn it now than from the first comment thread.

<!-- bitacora:entry
id: L-0005
date: 2026-09-20
tags: [positioning, verification]
-->
### Check whether the platform vendor already teaches the practice you are building

**What worked.** Searching Anthropic's own education material — Claude Academy
webinars, not just the reference docs — for whether they already recommend the
practice this project implements. They do, explicitly: capturing incident
learnings in a memory file so Claude knows how to react next time, described as
codifying "the norms and the procedures and correctness", with memory files
scoped at individual, team or repository level.

**Why it worked.** It changes what the README has to do. Arguing "here is a
practice I invented, please adopt it" requires persuading the reader that the
problem exists, that it matters, and that this shape solves it. Arguing "here is
the mechanism for the practice your vendor already teaches" requires only
showing the mechanism. It also resolves the competitive question honestly: this
is not competing with the platform's memory feature, it is the missing structure
around advice the platform gives and then leaves entirely to the reader —
nothing in that advice says what makes an entry useful, what stops the file
becoming the problem, or when to read it back.

**Reuse it when.** Building anything that sits on top of someone else's
platform. Search their *education* material, not only their documentation: docs
describe mechanics, talks and courses describe practice, and practice is where
the endorsement lives. Do it before writing the positioning, not after — the
argument you would have written without it is weaker and takes longer.

<!-- bitacora:entry
id: L-0004
date: 2026-09-20
tags: [verification, docs]
-->
### Claims about someone else's product get verified against its docs

**What worked.** Reading the primary documentation for the platform this tool
plugs into, instead of reasoning from familiarity with it.

**Why it worked.** Two defects on the same day had one root: M-0007 shipped a
hook wired to a stream the platform does not deliver, and M-0008 shipped a
factual claim about that platform's memory system that was backwards. Both came
from a mental model that was coherent, confident and untested. Neither was
reachable by reading this project's own code, which is internally consistent
with the wrong assumption. The hook reference also paid for itself immediately:
it surfaced the `compact` matcher on `SessionStart`, which turned out to be the
single best hook in the project — it re-states the durable memory at the exact
moment compaction destroys the volatile copy.

**Reuse it when.** Anything that integrates with a platform you did not build:
hook and event names, file locations, what a runtime does with your output, and
above all any sentence comparing your thing to theirs. Budget an hour of reading
the reference before the first line. It is cheaper than the hour, and it
reliably hands you a capability you did not know to ask for.

<!-- bitacora:entry
id: L-0003
date: 2026-09-20
tags: [verification, docs]
-->
### Audit the README's claims against the code, one by one

**What worked.** Re-reading the README as an adversary — treating every claim
as an accusation to be verified against the code — rather than re-reading the
code looking for bugs.

**Why it worked.** The two worst defects found in this project were both
documented behaviour that did not exist. `doctor` did not enforce the guardrail
the README promised (M-0004), and the installer shipped a placeholder to
projects with test scripts while the docs described a clean install (M-0005).
Neither is reachable by reading the code, because the code is internally
consistent and looks finished; the gap only appears when an external promise is
held against it. Documentation is a specification that nobody runs, and a
confident sentence is the best hiding place for a missing feature — re-reading
the docs keeps confirming it.

**Reuse it when.** Any project with a README that makes claims, and especially
one whose value proposition is a behaviour rather than a data structure. Go
claim by claim, in writing, and for each one name the line of code or the test
that makes it true. A claim with no line behind it is either a bug or marketing.

<!-- bitacora:entry
id: L-0002
date: 2026-09-20
tags: [testing, dx]
files: [test/smoke.mjs]
-->
### Testing the installer by actually running it found the only real bug

**What worked.** `test/smoke.mjs` spawns the real installer into a real
`mkdtemp` directory with a realistic `package.json`, then asserts on exit
codes and file contents. No framework, no mocks, no dependency — about 180
lines.

**Why it worked.** The one genuine bug in this codebase (M-0001) lived in the
interaction between two files: a template that documents the format and a
parser that reads it. Unit tests over `parseEntries` with hand-written fixtures
would have passed, because the fixtures would have been written by the same
assumption that was wrong. Running the whole thing end to end was the only
setup where the template and the parser met.

**Reuse it when.** Building anything whose job is to produce files. Assert on
the artefact, in a temp directory, using the real entry point. Reach for unit
tests afterwards, for the branches the end-to-end path cannot reach cheaply.

<!-- bitacora:entry
id: L-0001
date: 2026-09-20
tags: [design, context-engineering]
files: [template/CLAUDE.md, template/.bitacora/cli.mjs]
-->
### Making the failure mode a check, not advice

**What worked.** `doctor` fails if `CLAUDE.md` contains `@MISTAKES.md`. The
whole premise of the project is that logs should be retrieved by tag rather
than loaded wholesale, and that premise is undone by one line someone adds in
good faith six months later.

**Why it worked.** The README argues for retrieval over loading, and arguments
in a README lose to convenience every time. A check in `doctor` that fails CI
does not lose. The general shape: when a design has exactly one line that can
silently negate it, spend the twenty lines to detect that line.

**Reuse it when.** Any design whose benefit is invisible once it is broken —
context budgets, cache boundaries, layering rules. If breaking it produces no
symptom, write the detector.

