#!/usr/bin/env node
/**
 * End-to-end smoke test. No framework: spawn the real installer into a real
 * temp directory and assert on exit codes and output.
 *
 *   node test/smoke.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(ROOT, 'bin', 'create-bitacora.mjs');

let passed = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${label}`);
  } catch (e) {
    failures.push(`${label}: ${e.message}`);
    console.log(`FAIL  ${label}\n      ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Run the in-repo CLI in `dir`. Returns { code, out }. */
function cli(dir, ...args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, '.bitacora', 'cli.mjs'), ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

const dir = mkdtempSync(join(tmpdir(), 'bitacora-smoke-'));
console.log(`\nbitacora smoke test\n${dir}\n`);

try {
  // A realistic host project, so detection has something to find.
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      { name: 'smoke-app', description: 'A test app', scripts: { dev: 'next dev', build: 'next build' }, dependencies: { next: '16.0.0', react: '19.0.0' } },
      null,
      2
    )
  );

  execFileSync(process.execPath, [INSTALLER, '--yes'], { cwd: dir, encoding: 'utf8' });

  check('installs every required file', () => {
    for (const f of ['CLAUDE.md', 'ARCHITECTURE.md', 'STATE.md', 'MISTAKES.md', 'LEARNINGS.md', 'DECISIONS.md', 'bitacora.config.json', '.bitacora/cli.mjs', '.claude/settings.json', '.claude/hooks/bitacora-session-start.sh', '.claude/skills/close-session.md']) {
      assert(existsSync(join(dir, f)), `missing ${f}`);
    }
  });

  check('substitutes placeholders from package.json', () => {
    const t = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
    assert(t.includes('# smoke-app'), 'project name not substituted');
    assert(t.includes('npm run build'), 'build command not detected');
    assert(t.includes('Next.js'), 'stack not detected');
    assert(!/\{\{[A-Z_]+\}\}/.test(t), `an unsubstituted placeholder survived: ${(t.match(/\{\{[A-Z_]+\}\}/) || [])[0]}`);
  });

  check('drops the test-command line when there is no test script', () => {
    assert(!readFileSync(join(dir, 'CLAUDE.md'), 'utf8').includes('bitacora:fill-me or delete'), 'dangling test line kept');
  });

  check('adds a logbook script to package.json', () => {
    const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert(p.scripts.logbook === 'node .bitacora/cli.mjs', 'logbook script missing');
    assert(p.scripts.build === 'next build', 'clobbered an existing script');
  });

  check('doctor fails while placeholders remain', () => {
    const r = cli(dir, 'doctor');
    assert(r.code === 1, 'expected a non-zero exit');
    assert(/fill-me/.test(r.out), `expected a fill-me complaint, got:\n${r.out}`);
  });

  // Fill the placeholders the way a user would.
  for (const f of ['CLAUDE.md', 'ARCHITECTURE.md', 'STATE.md']) {
    const p = join(dir, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/<!--\s*bitacora:fill-me[\s\S]*?-->/g, 'Real content.'));
  }

  check('doctor passes once filled', () => {
    const r = cli(dir, 'doctor');
    assert(r.code === 0, `expected success, got:\n${r.out}`);
    assert(/healthy/.test(r.out), 'expected a healthy summary');
  });

  check('new refuses an untagged entry', () => {
    const r = cli(dir, 'new', 'mistake', 'No tags here');
    assert(r.code === 1, 'expected a refusal');
    assert(/tags is required/.test(r.out), r.out);
  });

  check('new assigns sequential ids and writes newest first', () => {
    cli(dir, 'new', 'mistake', 'First real failure', '--tags', 'pricing,data-loss', '--severity', 'high');
    cli(dir, 'new', 'mistake', 'Second real failure', '--tags', 'pricing');
    const t = readFileSync(join(dir, 'MISTAKES.md'), 'utf8');
    assert(t.includes('id: M-0002'), 'M-0002 not assigned');
    assert(t.includes('id: M-0003'), 'M-0003 not assigned');
    assert(t.indexOf('Second real failure') < t.indexOf('First real failure'), 'not newest-first');
  });

  check('doctor fails again on the fresh unfilled entries', () => {
    assert(cli(dir, 'doctor').code === 1, 'expected failure on unfilled entries');
  });

  check('recall finds entries by tag, and says so when it finds none', () => {
    const hit = cli(dir, 'recall', 'pricing');
    assert(/M-0002/.test(hit.out) && /M-0003/.test(hit.out), `expected both entries:\n${hit.out}`);
    assert(/nothing logged/.test(cli(dir, 'recall', 'nonexistent-tag').out), 'expected an empty-result message');
  });

  check('stats ranks tags', () => {
    const r = cli(dir, 'stats');
    assert(/pricing/.test(r.out), r.out);
    assert(/entries logged/.test(r.out), r.out);
  });

  // Fill the two new entries, then flood the log to trip the budget.
  const fillAll = (f) => {
    const p = join(dir, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/<!--\s*bitacora:fill-me[\s\S]*?-->/g, 'Real content.'));
  };
  fillAll('MISTAKES.md');

  check('doctor is green again after filling', () => {
    const r = cli(dir, 'doctor');
    assert(r.code === 0, r.out);
  });

  for (let i = 0; i < 30; i++) {
    cli(dir, 'new', 'mistake', `Flood entry ${i}`, '--tags', 'flood');
  }
  fillAll('MISTAKES.md');

  check('doctor fails when a log exceeds its line budget', () => {
    const r = cli(dir, 'doctor');
    assert(r.code === 1, 'expected a budget failure');
    assert(/budget is 400/.test(r.out) && /rotate/.test(r.out), `expected a budget message, got:\n${r.out}`);
  });

  check('rotate --dry-run changes nothing', () => {
    const before = readFileSync(join(dir, 'MISTAKES.md'), 'utf8');
    cli(dir, 'rotate', '--dry-run');
    assert(readFileSync(join(dir, 'MISTAKES.md'), 'utf8') === before, 'dry run wrote to the file');
  });

  check('rotate archives the overflow and leaves an index', () => {
    cli(dir, 'rotate');
    const live = readFileSync(join(dir, 'MISTAKES.md'), 'utf8');
    assert(/## Archived/.test(live), 'no archive index left behind');
    const year = new Date().toISOString().slice(0, 4);
    assert(existsSync(join(dir, 'docs', 'bitacora-archive', `mistakes-${year}.md`)), 'archive file not created');
    assert(cli(dir, 'doctor').code === 0, `doctor still failing after rotate:\n${cli(dir, 'doctor').out}`);
  });

  check('recall still reaches archived entries', () => {
    assert(/archived/.test(cli(dir, 'recall', 'pricing').out + cli(dir, 'recall', 'flood').out), 'no archived hit reported');
  });

  check('doctor catches an @-import of a log into CLAUDE.md', () => {
    const p = join(dir, 'CLAUDE.md');
    const original = readFileSync(p, 'utf8');
    writeFileSync(p, `@MISTAKES.md\n${original}`);
    const r = cli(dir, 'doctor');
    writeFileSync(p, original);
    assert(r.code === 1, 'the context leak went undetected');
    assert(/loads the whole log/.test(r.out), r.out);
  });

  check('re-running the installer is idempotent', () => {
    const before = readFileSync(join(dir, 'MISTAKES.md'), 'utf8');
    execFileSync(process.execPath, [INSTALLER, '--yes'], { cwd: dir, encoding: 'utf8' });
    assert(readFileSync(join(dir, 'MISTAKES.md'), 'utf8') === before, 'the installer clobbered an existing log');
    const s = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
    assert(s.hooks.Stop.length === 1, `hook duplicated on re-install: ${s.hooks.Stop.length} entries`);
  });

  check('merges into a pre-existing settings.json instead of replacing it', () => {
    const fresh = mkdtempSync(join(tmpdir(), 'bitacora-merge-'));
    execFileSync(process.execPath, ['-e', `require('fs').mkdirSync('${fresh}/.claude',{recursive:true});require('fs').writeFileSync('${fresh}/.claude/settings.json', JSON.stringify({permissions:{allow:['Bash(ls:*)']},hooks:{Stop:[{matcher:'',hooks:[{type:'command',command:'echo mine'}]}]}}))`]);
    execFileSync(process.execPath, [INSTALLER, '--yes'], { cwd: fresh, encoding: 'utf8' });
    const s = JSON.parse(readFileSync(join(fresh, '.claude', 'settings.json'), 'utf8'));
    assert(s.permissions.allow[0] === 'Bash(ls:*)', 'dropped unrelated settings');
    assert(s.hooks.Stop.length === 2, `expected both Stop hooks, got ${s.hooks.Stop.length}`);
    assert(JSON.stringify(s.hooks.Stop).includes('echo mine'), 'dropped the existing hook');
    rmSync(fresh, { recursive: true, force: true });
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
process.exit(failures.length > 0 ? 1 : 0);
