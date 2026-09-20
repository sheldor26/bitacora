# Learnings

> The counterpart to MISTAKES.md. When something works unusually well, the
> transferable part gets written down before it is forgotten.
>
> The test for an entry: would it change how you approach the *next* problem?
> If not, it is a changelog line, not a learning. Newest first.
>
> Add entries with: `node .bitacora/cli.mjs new learning "Title" --tags area`

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

