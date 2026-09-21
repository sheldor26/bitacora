#!/usr/bin/env node
/**
 * End-to-end smoke test. No framework: spawn the real installer into a real
 * temp directory and assert on exit codes and output.
 *
 *   node test/smoke.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(ROOT, 'bin', 'create-bitacora.mjs');

// Long enough to clear doctor's minimum-content floor for a section.
const PROSE = 'Real content, written out at enough length to count as a considered sentence.';

let passed = 0;
const failures = [];
const temps = [];

function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${label}`);
  } catch (e) {
    failures.push(label);
    console.log(`FAIL  ${label}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function temp(prefix) {
  const d = mkdtempSync(join(tmpdir(), `bitacora-${prefix}-`));
  temps.push(d);
  return d;
}

function run(cmd, args, opts = {}) {
  try {
    return { code: 0, out: execFileSync(cmd, args, { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, ...opts }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const install = (dir, ...extra) => run(process.execPath, [INSTALLER, '--yes', ...extra], { cwd: dir });
const cli = (dir, ...args) => run(process.execPath, [join(dir, '.bitacora', 'cli.mjs'), ...args], { cwd: dir });

const readIn = (dir, f) => readFileSync(join(dir, f), 'utf8');
const editIn = (dir, f, fn) => writeFileSync(join(dir, f), fn(readIn(dir, f)));

/** Fill every placeholder the way a user would, so doctor can go green. */
function fillPlaceholders(dir, files = ['CLAUDE.md', 'ARCHITECTURE.md', 'STATE.md', 'MISTAKES.md', 'LEARNINGS.md', 'DECISIONS.md']) {
  for (const f of files) {
    if (existsSync(join(dir, f))) editIn(dir, f, (t) => t.replace(/<!--\s*bitacora:fill-me[\s\S]*?-->/g, PROSE));
  }
}

/** A project with a realistic package.json, installed and filled. */
function project(pkg = {}) {
  const dir = temp('project');
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'smoke-app',
        description: 'A test app',
        scripts: { dev: 'next dev', build: 'next build' },
        dependencies: { next: '16.0.0', react: '19.0.0' },
        ...pkg,
      },
      null,
      2
    )
  );
  assert(install(dir).code === 0, 'installer failed');
  fillPlaceholders(dir);
  return dir;
}

console.log('\nbitacora smoke test\n');

try {
  // ------------------------------------------------------------- installing

  const app = project();

  check('installs every required file', () => {
    for (const f of [
      'CLAUDE.md', 'ARCHITECTURE.md', 'STATE.md', 'MISTAKES.md', 'LEARNINGS.md', 'DECISIONS.md',
      'bitacora.config.json', '.bitacora/cli.mjs', '.claude/settings.json',
      '.claude/hooks/bitacora-session-start.sh', '.claude/hooks/bitacora-session-end.sh',
      '.claude/skills/close-session/SKILL.md', '.claude/skills/log-mistake/SKILL.md', '.claude/skills/recall/SKILL.md',
    ]) {
      assert(existsSync(join(app, f)), `missing ${f}`);
    }
  });

  check('substitutes placeholders from package.json', () => {
    const t = readIn(app, 'CLAUDE.md');
    assert(t.includes('# smoke-app'), 'project name not substituted');
    assert(t.includes('npm run build'), 'build command not detected');
    assert(t.includes('Next.js'), 'stack not detected');
    assert(!/\{\{[A-Z_]+\}\}/.test(t), `an unsubstituted placeholder survived: ${(t.match(/\{\{[A-Z_]+\}\}/) || [])[0]}`);
  });

  check('drops the command line for a script the project does not have', () => {
    const t = readIn(app, 'CLAUDE.md');
    assert(!t.includes('# test suite'), 'kept a test line for a project with no test script');
    assert(t.includes('# run it locally'), 'dropped the dev line, which does exist');
  });

  check('keeps the test line, and leaves no stray comment, when there IS a test script', () => {
    const withTests = project({ scripts: { dev: 'next dev', build: 'next build', test: 'vitest run' } });
    const t = readIn(withTests, 'CLAUDE.md');
    assert(t.includes('npm run test'), 'test command not substituted');
    assert(t.includes('# test suite'), 'test line dropped even though a test script exists');
    assert(!/bitacora:fill-me/.test(t), 'a fill-me comment survived in CLAUDE.md');
    assert(cli(withTests, 'doctor').code === 0, cli(withTests, 'doctor').out);
  });

  check('states the language of the record, so the agent does not pick one', () => {
    // Without this line the agent writes in the language of the conversation,
    // and a repository ends up half English and half something else (M-0011).
    const t = readFileSync(join(app, 'CLAUDE.md'), 'utf8');
    assert(/Write the record in English/.test(t), 'CLAUDE.md never says what language the record is written in');
    assert(/outlive the conversation/.test(t), 'the convention is stated without the reason, so it reads as arbitrary');
  });

  check('ignores the placeholder test script that npm init writes', () => {
    // `npm init -y` ships `echo "Error: no test specified" && exit 1`. A
    // CLAUDE.md that advertises it sends the agent to a command that always
    // fails (M-0010).
    const stub = temp('stub');
    writeFileSync(
      join(stub, 'package.json'),
      JSON.stringify({ name: 'stub-app', version: '1.0.0', scripts: { test: 'echo "Error: no test specified" && exit 1' } }, null, 2)
    );
    assert(install(stub).code === 0, 'installer failed');
    const t = readFileSync(join(stub, 'CLAUDE.md'), 'utf8');
    assert(!/# test suite/.test(t), 'advertised the npm-init stub as a real test command');
    assert(!/no test specified/.test(t), 'leaked the stub script into CLAUDE.md');
    fillPlaceholders(stub);
    assert(cli(stub, 'doctor').code === 0, cli(stub, 'doctor').out);
  });

  check('works in a project with no package.json at all', () => {
    const bare = temp('bare');
    writeFileSync(join(bare, 'main.go'), 'package main\n');
    writeFileSync(join(bare, 'go.mod'), 'module example.com/x\n');
    assert(install(bare).code === 0, 'installer failed on a non-Node project');
    const t = readIn(bare, 'CLAUDE.md');
    assert(!/\{\{[A-Z_]+\}\}/.test(t), 'unsubstituted placeholder');
    assert(t.includes('Go'), 'go.mod not detected as stack');
    assert(!/^\s*#\s/m.test(t.split('```bash')[1].split('```')[0].replace(/^node .*$/m, '')), 'a comment-only command line survived');
    assert(!existsSync(join(bare, 'package.json')), 'installer created a package.json');
    fillPlaceholders(bare);
    assert(cli(bare, 'doctor').code === 0, cli(bare, 'doctor').out);
  });

  check('adds a logbook script without clobbering existing ones', () => {
    const p = JSON.parse(readIn(app, 'package.json'));
    assert(p.scripts.logbook === 'node .bitacora/cli.mjs', 'logbook script missing');
    assert(p.scripts.build === 'next build', 'clobbered an existing script');
  });

  check('--version prints the package version', () => {
    const r = run(process.execPath, [INSTALLER, '--version']);
    assert(r.code === 0 && /^\d+\.\d+\.\d+/.test(r.out.trim()), `got: ${r.out}`);
  });

  check('re-running the installer is idempotent', () => {
    const before = readIn(app, 'MISTAKES.md');
    install(app);
    assert(readIn(app, 'MISTAKES.md') === before, 'clobbered an existing log');
    const s = JSON.parse(readIn(app, '.claude/settings.json'));
    assert(s.hooks.Stop.length === 1, `hook duplicated on re-install: ${s.hooks.Stop.length}`);
  });

  check('merges into a pre-existing settings.json instead of replacing it', () => {
    const fresh = temp('merge');
    mkdirSync(join(fresh, '.claude'), { recursive: true });
    writeFileSync(
      join(fresh, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] }, hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo mine' }] }] } })
    );
    install(fresh);
    const s = JSON.parse(readIn(fresh, '.claude/settings.json'));
    assert(s.permissions.allow[0] === 'Bash(ls:*)', 'dropped unrelated settings');
    assert(s.hooks.Stop.length === 2, `expected both Stop hooks, got ${s.hooks.Stop.length}`);
    assert(JSON.stringify(s.hooks.Stop).includes('echo mine'), 'dropped the existing hook');
  });

  // ---------------------------------------------------------------- doctor

  check('doctor fails while placeholders remain, and passes once filled', () => {
    const p = project();
    editIn(p, 'STATE.md', (t) => t.replace(PROSE, '<!-- bitacora:fill-me write this -->'));
    const bad = cli(p, 'doctor');
    assert(bad.code === 1 && /fill-me/.test(bad.out), `expected a fill-me complaint:\n${bad.out}`);
    fillPlaceholders(p);
    const good = cli(p, 'doctor');
    assert(good.code === 0 && /healthy/.test(good.out), good.out);
  });

  check('doctor warns about the leftover example entries, and --strict fails on them', () => {
    const r = cli(app, 'doctor');
    assert(r.code === 0 && /tagged "example"/.test(r.out), `expected an example warning:\n${r.out}`);
    const strict = cli(app, 'doctor', '--strict');
    assert(strict.code === 1 && /failing on warnings/.test(strict.out), strict.out);
  });

  check('doctor rejects a gestural Guardrail', () => {
    const p = project();
    editIn(p, 'MISTAKES.md', (t) => t.replace(/\*\*Guardrail\.\*\*[\s\S]*?(?=\n\n)/, '**Guardrail.** Be more careful.'));
    const r = cli(p, 'doctor');
    assert(r.code === 1, 'a two-word guardrail was accepted');
    assert(/near-empty "Guardrail"/.test(r.out), r.out);
    assert(/not an intention to be careful/.test(r.out), 'the message does not say what a guardrail is');
  });

  check('doctor rejects a missing section outright', () => {
    const p = project();
    editIn(p, 'MISTAKES.md', (t) => t.replace(/\*\*Guardrail\.\*\*[\s\S]*?(?=\n\n)/, ''));
    const r = cli(p, 'doctor');
    assert(r.code === 1 && /no "\*\*Guardrail\.\*\*" section/.test(r.out), r.out);
  });

  check('an entry may quote bitacora\'s own markers in prose without tripping doctor', () => {
    // The failure mode behind M-0001 and M-0006: a logbook documents its own
    // format, so prose quotes the markers. Backticked means prose, including
    // when the span soft-wraps across a line, as 80-column markdown does.
    const p = project();
    const quoting = [
      '<!-- bitacora:entry',
      'id: M-0002',
      `date: ${new Date().toISOString().slice(0, 10)}`,
      'tags: [format, self-reference]',
      'severity: low',
      '-->',
      '### An entry that explains the format it is written in',
      '',
      '**What happened.** Metadata goes in a `<!-- bitacora:entry -->` comment and',
      'unwritten sections are marked with `<!-- bitacora:fill-me a hint about what',
      'belongs here -->`, which is what this sentence is demonstrating.',
      '',
      `**Root cause.** ${PROSE}`,
      '',
      `**Guardrail.** ${PROSE}`,
      '',
      '',
    ].join('\n');
    editIn(p, 'MISTAKES.md', (t) => {
      const at = t.indexOf('<!-- bitacora:entry');
      return t.slice(0, at) + quoting + t.slice(at);
    });
    const r = cli(p, 'doctor');
    assert(r.code === 0, `prose quoting a marker was read as a marker:\n${r.out}`);
  });

  check('doctor validates severity', () => {
    const p = project();
    editIn(p, 'MISTAKES.md', (t) => t.replace(/^severity: .*/m, 'severity: critical'));
    const r = cli(p, 'doctor');
    assert(r.code === 1 && /severity "critical"/.test(r.out), r.out);
  });

  check('doctor rejects dates in the future and entries out of order', () => {
    const p = project();
    const future = new Date(Date.now() + 9e8).toISOString().slice(0, 10);
    editIn(p, 'MISTAKES.md', (t) => t.replace(/^date: .*/m, `date: ${future}`));
    assert(/dated in the future/.test(cli(p, 'doctor').out), 'future date accepted');

    // The template's example entry is dated 1970, so the top entry has to be
    // pushed behind a bumped bottom entry for the invariant to be violated.
    const q = project();
    cli(q, 'new', 'mistake', 'Newer on top', '--tags', 'ordering');
    fillPlaceholders(q, ['MISTAKES.md']);
    editIn(q, 'MISTAKES.md', (t) =>
      t.replace('date: 1970-01-01', 'date: 2021-01-01').replace(/^date: .*/m, 'date: 2020-01-01')
    );
    const r = cli(q, 'doctor');
    assert(r.code === 1 && /entries run newest first/.test(r.out), `out-of-order dates accepted:\n${r.out}`);
  });

  check('doctor catches an id that collides with one already archived', () => {
    const p = project();
    mkdirSync(join(p, 'docs', 'bitacora-archive'), { recursive: true });
    writeFileSync(
      join(p, 'docs', 'bitacora-archive', 'mistakes-2025.md'),
      `# Mistakes — 2025\n\n<!-- bitacora:entry\nid: M-0001\ndate: 2025-01-01\ntags: [old]\nseverity: low\n-->\n### An archived entry reusing a live id\n\n**What happened.** ${PROSE}\n\n**Root cause.** ${PROSE}\n\n**Guardrail.** ${PROSE}\n`
    );
    const r = cli(p, 'doctor');
    assert(r.code === 1 && /duplicate id M-0001/.test(r.out), r.out);
  });

  check('doctor warns when an entry references a file that is gone', () => {
    const p = project();
    editIn(p, 'MISTAKES.md', (t) => t.replace(/^files: .*/m, 'files: [src/deleted-long-ago.ts]'));
    assert(/no longer exists/.test(cli(p, 'doctor').out), 'stale file reference not reported');
  });

  check('doctor catches an @-import of a log into CLAUDE.md', () => {
    const p = project();
    editIn(p, 'CLAUDE.md', (t) => `@MISTAKES.md\n${t}`);
    const r = cli(p, 'doctor');
    assert(r.code === 1 && /loads the whole log/.test(r.out), r.out);
  });

  check('doctor rejects a STATE.md that has become a diary', () => {
    const p = project();
    editIn(p, 'STATE.md', (t) => t + '\nfiller\n'.repeat(250));
    const r = cli(p, 'doctor');
    assert(r.code === 1 && /snapshot, not a diary/.test(r.out), r.out);
  });

  // ------------------------------------------------------------------- new

  check('new refuses an untagged entry and a bogus severity', () => {
    const a = cli(app, 'new', 'mistake', 'No tags here');
    assert(a.code === 1 && /tags is required/.test(a.out), a.out);
    const b = cli(app, 'new', 'mistake', 'Bad severity', '--tags', 'x', '--severity', 'catastrophic');
    assert(b.code === 1 && /severity must be one of/.test(b.out), b.out);
  });

  check('new assigns sequential ids and writes newest first', () => {
    const p = project();
    cli(p, 'new', 'mistake', 'First real failure', '--tags', 'pricing,data-loss', '--severity', 'high');
    cli(p, 'new', 'mistake', 'Second real failure', '--tags', 'pricing');
    const t = readIn(p, 'MISTAKES.md');
    assert(t.includes('id: M-0002') && t.includes('id: M-0003'), 'ids not assigned');
    assert(t.indexOf('Second real failure') < t.indexOf('First real failure'), 'not newest-first');
    assert(cli(p, 'doctor').code === 1, 'unfilled new entries passed doctor');
  });

  // ---------------------------------------------------------------- recall

  check('recall prints matching entries in full, guardrail included', () => {
    const p = project();
    cli(p, 'new', 'mistake', 'Importer clobbered verified prices', '--tags', 'pricing', '--severity', 'high');
    fillPlaceholders(p, ['MISTAKES.md']);
    const r = cli(p, 'recall', 'pricing');
    assert(/Importer clobbered verified prices/.test(r.out), 'title missing');
    assert(/\*\*Guardrail\.\*\*/.test(r.out), 'body not printed in full — the agent would need a second call');
    assert(/M-0002/.test(r.out), 'id missing');
  });

  check('recall --brief prints an index only', () => {
    const p = project();
    cli(p, 'new', 'mistake', 'Something specific', '--tags', 'pricing', '--severity', 'low');
    fillPlaceholders(p, ['MISTAKES.md']);
    const r = cli(p, 'recall', 'pricing', '--brief');
    assert(/Something specific/.test(r.out), 'title missing');
    assert(!/\*\*Guardrail\.\*\*/.test(r.out), '--brief printed full bodies');
  });

  check('recall ranks an exact tag match above a passing mention in prose', () => {
    const p = project();
    cli(p, 'new', 'mistake', 'Tagged one', '--tags', 'deploy', '--severity', 'low');
    cli(p, 'new', 'mistake', 'Untagged one', '--tags', 'unrelated', '--severity', 'low');
    fillPlaceholders(p, ['MISTAKES.md']);
    editIn(p, 'MISTAKES.md', (t) => t.replace('### Untagged one', '### Untagged one').replace(/(### Untagged one\n\n\*\*What happened\.\*\*)/, '$1 A passing mention of deploy.'));
    const r = cli(p, 'recall', 'deploy', '--brief');
    assert(r.out.indexOf('Tagged one') < r.out.indexOf('Untagged one'), `ranking wrong:\n${r.out}`);
  });

  check('recall hands over the write command when it finds nothing', () => {
    const r = cli(app, 'recall', 'nonexistent-tag');
    assert(/nothing logged/.test(r.out) && /first mistake has not been made/.test(r.out), r.out);
    // A miss is where the loop closes: the command comes pre-tagged so the
    // entry gets written when the thing finally bites.
    assert(/new mistake .* --tags nonexistent-tag/.test(r.out), `no pre-filled command offered:\n${r.out}`);
  });

  // ---------------------------------------------------------------- rotate

  const flooded = (() => {
    const p = project();
    for (let i = 0; i < 30; i++) cli(p, 'new', 'mistake', `Flood entry ${i}`, '--tags', 'flood', '--severity', 'low');
    fillPlaceholders(p, ['MISTAKES.md']);
    return p;
  })();

  check('doctor fails when a log exceeds its line budget', () => {
    const r = cli(flooded, 'doctor');
    assert(r.code === 1 && /budget is 400/.test(r.out) && /rotate/.test(r.out), r.out);
  });

  check('rotate archives on the line budget, not only the entry count', () => {
    // Entries long enough to be worth keeping blow through maxLines well
    // before they reach keepEntries, so rotate on entry count alone is inert
    // exactly when it is needed (M-0012).
    const p = project();
    // Wrapped prose, because the budget counts lines: one very long line is
    // still one line.
    const para = Array.from({ length: 10 }, () => 'A line of real prose, wrapped the way hand-written markdown wraps.').join('\n');
    const entry = (n, date) =>
      ['<!-- bitacora:entry', `id: M-${String(n).padStart(4, '0')}`, `date: ${date}`, 'tags: [budget]', 'severity: low', '-->',
       `### Long entry number ${n}`, '', `**What happened.** ${para}`, '', `**Root cause.** ${para}`, '', `**Guardrail.** ${para}`, '', ''].join('\n');
    const dates = (n) => `2026-0${1 + Math.floor(n / 28)}-${String((n % 28) + 1).padStart(2, '0')}`;
    const many = Array.from({ length: 12 }, (_, i) => entry(200 - i, dates(200 - i - 150)))
      .sort((a, b) => (a.match(/date: (\S+)/)[1] < b.match(/date: (\S+)/)[1] ? 1 : -1))
      .join('');
    editIn(p, 'MISTAKES.md', (t) => t.slice(0, t.indexOf('<!-- bitacora:entry')) + many);

    const lines = readIn(p, 'MISTAKES.md').split('\n').length;
    const count = (readIn(p, 'MISTAKES.md').match(/^<!-- bitacora:entry/gm) || []).length;
    assert(lines > 400, `fixture is only ${lines} lines, it must exceed the budget`);
    assert(count < 20, `fixture has ${count} entries, it must stay under keepEntries`);

    assert(cli(p, 'doctor').code === 1, 'doctor did not fail on an over-budget log');
    const r = cli(p, 'rotate');
    assert(/moved/.test(r.out), `rotate did nothing on an over-budget log:\n${r.out}`);
    const after = readIn(p, 'MISTAKES.md').split('\n').length;
    assert(after <= 400, `still ${after} lines after rotate`);
    assert(/## Archived/.test(readIn(p, 'MISTAKES.md')), 'no archive index');
    const d = cli(p, 'doctor');
    assert(d.code === 0, `doctor still failing after rotate:\n${d.out}`);
  });

  check('rotate --dry-run changes nothing', () => {
    const before = readIn(flooded, 'MISTAKES.md');
    cli(flooded, 'rotate', '--dry-run');
    assert(readIn(flooded, 'MISTAKES.md') === before, 'dry run wrote to the file');
  });

  check('rotate archives the overflow, leaves an index, and restores health', () => {
    cli(flooded, 'rotate');
    const live = readIn(flooded, 'MISTAKES.md');
    assert(/## Archived/.test(live), 'no archive index left behind');
    const year = new Date().toISOString().slice(0, 4);
    assert(existsSync(join(flooded, 'docs', 'bitacora-archive', `mistakes-${year}.md`)), 'archive file not created');
    const r = cli(flooded, 'doctor');
    assert(r.code === 0, `doctor still failing after rotate:\n${r.out}`);
  });

  check('rotate keeps the newest entries and archives the oldest', () => {
    const live = readIn(flooded, 'MISTAKES.md');
    assert(live.includes('Flood entry 29'), 'archived the newest entry');
    assert(!live.split('## Archived')[0].includes('Flood entry 0'), 'kept the oldest entry live');
  });

  check('repeated rotate does not duplicate index lines', () => {
    for (let i = 30; i < 55; i++) cli(flooded, 'new', 'mistake', `More ${i}`, '--tags', 'flood', '--severity', 'low');
    fillPlaceholders(flooded, ['MISTAKES.md']);
    cli(flooded, 'rotate');
    const index = readIn(flooded, 'MISTAKES.md').split('## Archived')[1] || '';
    const ids = [...index.matchAll(/^- `([A-Z]-\d{4})`/gm)].map((m) => m[1]);
    assert(ids.length > 0, 'no index lines at all');
    assert(new Set(ids).size === ids.length, `duplicate index lines: ${ids.length} lines, ${new Set(ids).size} unique`);
  });

  check('new does not reuse an id that only exists in the archive', () => {
    const before = new Set([...readIn(flooded, 'MISTAKES.md').matchAll(/id: (M-\d{4})/g)].map((m) => m[1]));
    cli(flooded, 'new', 'mistake', 'After rotation', '--tags', 'flood', '--severity', 'low');
    const id = (readIn(flooded, 'MISTAKES.md').match(/id: (M-\d{4})/) || [])[1];
    assert(id && !before.has(id), `reused id ${id}`);
    const archive = readIn(flooded, join('docs', 'bitacora-archive', `mistakes-${new Date().toISOString().slice(0, 4)}.md`));
    assert(!archive.includes(`id: ${id}`), `new id ${id} collides with the archive`);
  });

  check('recall still reaches archived entries', () => {
    assert(/archived/.test(cli(flooded, 'recall', 'flood').out), 'no archived hit reported');
  });

  // ----------------------------------------------------------------- stats

  check('stats ranks tags and separates recent activity', () => {
    const r = cli(flooded, 'stats');
    assert(/flood/.test(r.out) && /in the live logs/.test(r.out), r.out);
    assert(/last 90 days/.test(r.out), 'no recency framing');
  });

  // ---------------------------------------------------------------- global

  const gdir = temp('global');
  const cfgDir = join(gdir, '.claude');
  mkdirSync(cfgDir, { recursive: true });
  writeFileSync(join(cfgDir, 'CLAUDE.md'), '# My global rules\n\nAlways speak Spanish to me.\n');
  const globalRun = (dir, ...extra) =>
    run(process.execPath, [INSTALLER, '--global', ...extra], { env: { ...process.env, CLAUDE_CONFIG_DIR: dir, NO_COLOR: '1' } });

  check('--global installs the skill and appends the rule, keeping what was there', () => {
    const r = globalRun(cfgDir);
    assert(r.code === 0, r.out);
    assert(existsSync(join(cfgDir, 'skills', 'start-project', 'SKILL.md')), 'skill not installed');
    const m = readFileSync(join(cfgDir, 'CLAUDE.md'), 'utf8');
    assert(m.includes('Always speak Spanish to me.'), 'clobbered the user\'s own rules');
    assert(m.includes('<!-- BEGIN:bitacora -->') && m.includes('<!-- END:bitacora -->'), 'sentinel block missing');
    assert(m.includes('start-project'), 'rule does not point at the skill');
  });

  check('--global is idempotent: one block, however many runs', () => {
    globalRun(cfgDir);
    globalRun(cfgDir);
    const m = readFileSync(join(cfgDir, 'CLAUDE.md'), 'utf8');
    assert((m.match(/BEGIN:bitacora/g) || []).length === 1, 'the block was duplicated');
    assert((m.match(/Always speak Spanish/g) || []).length === 1, 'user content was duplicated');
  });

  check('--global leaves a customised skill alone without --force', () => {
    const skill = join(cfgDir, 'skills', 'start-project', 'SKILL.md');
    writeFileSync(skill, '# mine now\n');
    const r = globalRun(cfgDir);
    assert(readFileSync(skill, 'utf8') === '# mine now\n', 'overwrote a customised skill');
    assert(/--force to update/.test(r.out), r.out);
    assert(globalRun(cfgDir, '--force').code === 0 && readFileSync(skill, 'utf8') !== '# mine now\n', '--force did not update it');
  });

  check('--global --remove strips only its own block', () => {
    const r = globalRun(cfgDir, '--remove');
    assert(r.code === 0, r.out);
    const m = readFileSync(join(cfgDir, 'CLAUDE.md'), 'utf8');
    assert(!m.includes('bitacora'), `block survived removal:\n${m}`);
    assert(m.includes('Always speak Spanish to me.'), 'removed the user\'s own rules');
    assert(!existsSync(join(cfgDir, 'skills', 'start-project')), 'skill directory survived removal');
  });

  check('--global refuses when the config directory does not exist', () => {
    const r = globalRun(join(gdir, 'absent'));
    assert(r.code === 1 && /does not exist/.test(r.out), r.out);
  });

  // ----------------------------------------------------------------- hooks

  const hook = (dir, name, ...args) =>
    run('bash', [join(dir, '.claude', 'hooks', name), ...args], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir, NO_COLOR: '1' } });

  check('settings.json uses documented hook events, and Stop carries no matcher', () => {
    // Claude Code ignores an unknown event name silently, so a typo here is a
    // feature that never runs and never complains. See M-0007.
    const DOCUMENTED = new Set(['SessionStart', 'Setup', 'UserPromptSubmit', 'UserPromptExpansion', 'PreToolUse', 'PermissionRequest', 'PermissionDenied', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'Notification', 'MessageDisplay', 'SubagentStart', 'SubagentStop', 'TaskCreated', 'TaskCompleted', 'Stop', 'StopFailure', 'TeammateIdle', 'InstructionsLoaded', 'ConfigChange', 'CwdChanged', 'DirectoryAdded', 'FileChanged', 'WorktreeCreate', 'WorktreeRemove', 'PreCompact', 'PostCompact', 'PreModelSwitch', 'PostModelSwitch', 'Elicitation', 'ElicitationResult']);
    const s = JSON.parse(readFileSync(join(ROOT, 'template/.claude/settings.json'), 'utf8'));
    for (const event of Object.keys(s.hooks)) assert(DOCUMENTED.has(event), `"${event}" is not a documented hook event`);
    for (const group of s.hooks.Stop) assert(!('matcher' in group), 'Stop does not support a matcher');
    const reasons = s.hooks.SessionStart.map((g) => g.matcher).join('|');
    assert(/\bcompact\b/.test(reasons), 'no SessionStart hook fires after compaction, which is the moment the digest matters most');
  });

  check('both hooks cost nothing in a project with no logbook', () => {
    // Claimed in the README, so it needs an assertion: the Claude Code team's
    // rule for hooks is decide relevance immediately and quick exit. A hook
    // that prints into a project that never asked for it is a hook people
    // uninstall.
    const bare = temp('nohook');
    mkdirSync(join(bare, '.claude', 'hooks'), { recursive: true });
    for (const name of ['bitacora-session-start.sh', 'bitacora-session-end.sh']) {
      writeFileSync(join(bare, '.claude', 'hooks', name), readFileSync(join(ROOT, 'template/.claude/hooks', name), 'utf8'));
      const r = hook(bare, name);
      assert(r.code === 0, `${name} exited ${r.code} in a project without a logbook`);
      assert(r.out.trim() === '', `${name} printed into a project with no logbook:\n${r.out}`);
    }
  });

  check('the Stop hook reports through JSON systemMessage, not plain stdout', () => {
    // Stop is not one of the events whose plain stdout reaches the model — it
    // goes to the debug log. A reminder printed as text is a reminder nobody
    // ever receives.
    const p = project();
    editIn(p, 'STATE.md', (t) => t.replace(/^updated: .*/m, 'updated: 2020-01-01'));
    const r = hook(p, 'bitacora-session-end.sh');
    assert(r.code === 0, `the hook must never block a stop: exit ${r.code}`);
    let parsed;
    try {
      parsed = JSON.parse(r.out);
    } catch {
      throw new Error(`stdout is not JSON, so Claude never sees it:\n${r.out}`);
    }
    assert(typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0, 'no systemMessage field');
    assert(/STATE\.md still says/.test(parsed.systemMessage), parsed.systemMessage);
  });

  check('the Stop hook stays silent when there is nothing to report', () => {
    const p = project();
    const r = hook(p, 'bitacora-session-end.sh');
    assert(r.code === 0 && r.out.trim() === '', `expected silence, got:\n${r.out}`);
  });

  check('the session-start hook prints a digest, and names compaction when it follows one', () => {
    const p = project();
    const plain = hook(p, 'bitacora-session-start.sh');
    assert(/Logbook digest/.test(plain.out), plain.out);
    assert(/In flight/.test(plain.out), 'the digest omits the section a cold session needs');
    const after = hook(p, 'bitacora-session-start.sh', '--after-compaction');
    assert(/after compaction/i.test(after.out) && /did not go through that summary/.test(after.out), after.out);
  });

  // ---------------------------------------------------------------- skills

  check('every shipped skill names WHEN to use it, not just what it does', () => {
    // A skill wired to the wrong moment is worse than a missing one: it fires
    // too late to change anything and looks like it worked. recall shipped
    // saying "before the first edit" when the moment that matters is before
    // the plan (M-0009). A description that cannot name its trigger has not
    // had that question asked of it.
    const dirs = [join(ROOT, 'template/.claude/skills'), join(ROOT, 'global/skills')];
    let checked = 0;
    for (const dir of dirs) {
      const walk = (d) => {
        for (const name of readdirSync(d, { withFileTypes: true })) {
          const full = join(d, name.name);
          if (name.isDirectory()) { walk(full); continue; }
          if (!name.name.endsWith('.md')) continue;
          const text = readFileSync(full, 'utf8');
          const desc = (text.match(/^description:\s*(.+)$/m) || [])[1];
          assert(desc, `${name.name} has no description in its frontmatter`);
          assert(
            /\b(before|when|after|the moment|while|ending)\b/i.test(desc),
            `${name.name} describes what it does but never says when to reach for it: "${desc}"`
          );
          checked++;
        }
      };
      walk(dir);
    }
    assert(checked >= 4, `expected to check at least 4 skills, checked ${checked}`);
  });

  // ------------------------------------------------------------ this repo

  check('every file listed in package.json "files" exists', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    for (const f of pkg.files) assert(existsSync(join(ROOT, f)), `"files" lists ${f}, which does not exist`);
    for (const needed of ['bin', 'template', 'global']) {
      assert(pkg.files.includes(needed), `"files" is missing ${needed} — it would not be published`);
    }
  });

  check("the repo's own installed copies match the template", () => {
    // settings.json is compared parsed, not byte-for-byte: the installer
    // re-serialises it on merge, so its formatting legitimately differs.
    const parsed = (p) => JSON.stringify(JSON.parse(readFileSync(join(ROOT, p), 'utf8')));
    assert(parsed('template/.claude/settings.json') === parsed('.claude/settings.json'), '.claude/settings.json has drifted from the template');
    for (const rel of [
      '.bitacora/cli.mjs',
      '.claude/hooks/bitacora-session-start.sh',
      '.claude/hooks/bitacora-session-end.sh',
      '.claude/skills/close-session/SKILL.md',
      '.claude/skills/log-mistake/SKILL.md',
      '.claude/skills/recall/SKILL.md',
    ]) {
      assert(
        readFileSync(join(ROOT, 'template', rel), 'utf8') === readFileSync(join(ROOT, rel), 'utf8'),
        `${rel} has drifted from template/${rel} — run: npm run sync:self`
      );
    }
  });
  check('every shipped skill is a directory containing SKILL.md with a description', () => {
  // A loose .md file in .claude/skills/ is never discovered by Claude Code, so
  // it can look installed and do nothing at all (M-0016).
  const dir = join(ROOT, 'template', '.claude', 'skills');
  const entries = readdirSync(dir);
  assert(entries.length > 0, 'the template ships no skills at all');
  for (const name of entries) {
    assert(statSync(join(dir, name)).isDirectory(), `template/.claude/skills/${name} is a file; a skill must be a directory`);
    const skill = join(dir, name, 'SKILL.md');
    assert(existsSync(skill), `template/.claude/skills/${name}/ has no SKILL.md`);
    const text = readFileSync(skill, 'utf8');
    assert(text.startsWith('---\n'), `${name}/SKILL.md frontmatter is not on the first line, so the whole file is read as content`);
    const front = text.slice(4, text.indexOf('\n---', 4));
    const description = (front.match(/^description:[ \t]*(.+)$/m) || [])[1] || '';
    assert(description.trim().length > 20, `${name}/SKILL.md has no usable description — that field is what decides when it fires`);
    }
  });

  check('installing over a pre-directory layout removes the inert flat file', () => {
  const dir = temp();
  mkdirSync(join(dir, '.claude', 'skills'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', 'recall.md'), 'stale\n');
  install(dir);
  assert(!existsSync(join(dir, '.claude', 'skills', 'recall.md')), 'the old flat recall.md was left beside the new directory');
    assert(existsSync(join(dir, '.claude', 'skills', 'recall', 'SKILL.md')), 'recall/SKILL.md was not installed');
  });

} finally {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) console.log(failures.map((f) => `  - ${f}`).join('\n'));
console.log('');
process.exit(failures.length > 0 ? 1 : 0);
