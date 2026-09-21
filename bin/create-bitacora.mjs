#!/usr/bin/env node
/**
 * create-bitacora — install the logbook into a project.
 *
 * npm create bitacora@latest
 * npx create-bitacora --yes
 *
 * Zero dependencies. Never overwrites a file you already have unless you pass
 * --force, and merges its hooks into an existing .claude/settings.json rather
 * than replacing it.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, chmodSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, '..', 'template');

const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

// ------------------------------------------------------------------- argv

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return fallback;
  const a = argv[i];
  if (a.includes('=')) return a.split('=').slice(1).join('=');
  return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
})();

if (flag('version') || flag('v')) {
  console.log(VERSION);
  process.exit(0);
}

if (flag('help') || flag('h')) {
  console.log(`create-bitacora — install the logbook your coding agent keeps

  npm create bitacora@latest              interactive, in the current directory
  npx create-bitacora --yes               non-interactive, detect what it can
  npx create-bitacora --dir ./my-app      install somewhere else
  npx create-bitacora --force             overwrite files that already exist

  npx create-bitacora --global            teach Claude Code to do this on every
                                          new project, once, for all projects
  npx create-bitacora --global --remove   undo that
  npx create-bitacora --version

After installing, \`doctor\` fails on purpose: the template ships with
placeholders, and filling them in is step one.
`);
  process.exit(0);
}

const TARGET = join(process.cwd(), opt('dir', '.'));
const FORCE = flag('force');
const YES = flag('yes') || flag('y');

// ----------------------------------------------------------------- global

/**
 * --global: install the rule and the skill that make Claude Code reach for
 * this on its own. Writes only inside the Claude config directory, and only
 * inside a sentinel block in CLAUDE.md, so anything the user wrote there
 * survives.
 */
function installGlobal() {
  const cfg = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const GLOBAL = join(HERE, '..', 'global');
  const BEGIN = '<!-- BEGIN:bitacora -->';
  const END = '<!-- END:bitacora -->';

  /** Strip the owned block from CLAUDE.md, leaving every other line untouched. */
  const withoutBlock = (text) => {
    if (!text.includes(BEGIN) || !text.includes(END)) return null;
    const out = text.slice(0, text.indexOf(BEGIN)) + text.slice(text.indexOf(END) + END.length);
    return out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  };

  if (flag('remove')) {
    const memory = join(cfg, 'CLAUDE.md');
    if (existsSync(memory)) {
      const stripped = withoutBlock(readFileSync(memory, 'utf8'));
      if (stripped === null) console.log(`${c.yellow('·')} CLAUDE.md has no bitacora block`);
      else {
        writeFileSync(memory, stripped.trim() ? stripped : '');
        console.log(`${c.green('-')} CLAUDE.md ${c.dim('bitacora block removed; everything else kept')}`);
      }
    }
    const skillDir = join(cfg, 'skills', 'start-project');
    if (existsSync(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true });
      console.log(`${c.green('-')} skills/start-project`);
    }
    console.log(`\n${c.b('Removed.')} ${c.dim('Nothing bitacora put in ' + cfg + ' remains. Projects already using it are untouched.')}\n`);
    process.exit(0);
  }

  if (!existsSync(cfg)) {
    console.log(`${c.yellow('!')} ${cfg} does not exist.`);
    console.log(c.dim('  That directory is created the first time Claude Code runs. Start it once, then try again.'));
    console.log(c.dim('  If your config lives elsewhere, set CLAUDE_CONFIG_DIR and re-run.'));
    process.exit(1);
  }

  // 1. The skill: the procedure itself.
  const skillSrc = join(GLOBAL, 'skills', 'start-project', 'SKILL.md');
  const skillDest = join(cfg, 'skills', 'start-project', 'SKILL.md');
  const incoming = readFileSync(skillSrc, 'utf8');
  if (existsSync(skillDest) && readFileSync(skillDest, 'utf8') !== incoming && !FORCE) {
    console.log(`${c.yellow('·')} skills/start-project/SKILL.md differs from this version, left alone ${c.dim('(--force to update)')}`);
  } else {
    mkdirSync(dirname(skillDest), { recursive: true });
    writeFileSync(skillDest, incoming);
    console.log(`${c.green('+')} skills/start-project/SKILL.md`);
  }

  // 2. The rule: what makes it fire without being asked.
  const blockBody = readFileSync(join(GLOBAL, 'CLAUDE.md.block'), 'utf8').trim();
  const memoryPath = join(cfg, 'CLAUDE.md');
  const existing = existsSync(memoryPath) ? readFileSync(memoryPath, 'utf8') : '';
  let next;
  if (existing.includes(BEGIN) && existing.includes(END)) {
    const before = existing.slice(0, existing.indexOf(BEGIN));
    const after = existing.slice(existing.indexOf(END) + END.length);
    next = `${before}${blockBody}${after}`;
    console.log(`${c.green('~')} CLAUDE.md ${c.dim('bitacora block refreshed; everything else untouched')}`);
  } else {
    next = existing.trimEnd() + (existing.trim() ? '\n\n' : '') + blockBody + '\n';
    console.log(`${c.green('+')} CLAUDE.md ${c.dim(existing.trim() ? 'bitacora block appended' : 'created')}`);
  }
  writeFileSync(memoryPath, next);

  console.log(`
${c.b('Done.')} ${c.dim(cfg)}

Claude Code now reaches for the logbook on its own when you start a project,
and knows to ${c.b('recall')} instead of reading whole logs in projects that
already have one. Restart any open session to pick it up.

${c.dim('The rule lives in a BEGIN/END block — re-running this updates only that block.')}
${c.dim('To remove it: delete the block from CLAUDE.md and the skills/start-project directory.')}
`);
  process.exit(0);
}

if (flag('global')) installGlobal();

// -------------------------------------------------------------- detection

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const pkgPath = join(TARGET, 'package.json');
const pkg = readJson(pkgPath);
const scripts = (pkg && pkg.scripts) || {};

const pm = existsSync(join(TARGET, 'pnpm-lock.yaml'))
  ? 'pnpm'
  : existsSync(join(TARGET, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(TARGET, 'bun.lockb'))
      ? 'bun'
      : 'npm';
const runner = pm === 'npm' ? 'npm run' : pm === 'yarn' ? 'yarn' : `${pm} run`;

function guessStack() {
  const deps = { ...((pkg && pkg.dependencies) || {}), ...((pkg && pkg.devDependencies) || {}) };
  const hits = [];
  const map = {
    next: 'Next.js',
    react: 'React',
    vue: 'Vue',
    svelte: 'Svelte',
    astro: 'Astro',
    typescript: 'TypeScript',
    tailwindcss: 'Tailwind',
    '@supabase/supabase-js': 'Supabase',
    '@clerk/nextjs': 'Clerk',
    prisma: 'Prisma',
    'drizzle-orm': 'Drizzle',
    express: 'Express',
    hono: 'Hono',
    vitest: 'Vitest',
    jest: 'Jest',
  };
  for (const [dep, label] of Object.entries(map)) if (deps[dep]) hits.push(label);
  if (existsSync(join(TARGET, 'pyproject.toml')) || existsSync(join(TARGET, 'requirements.txt'))) hits.push('Python');
  if (existsSync(join(TARGET, 'go.mod'))) hits.push('Go');
  if (existsSync(join(TARGET, 'Cargo.toml'))) hits.push('Rust');
  return hits.join(' + ');
}

// `npm init -y` writes a test script whose only behaviour is to fail. Treating
// it as a real command puts a broken instruction in CLAUDE.md — and the agent
// then follows it, because the file is the thing it trusts. See M-0010.
const PLACEHOLDER_SCRIPT = /no test specified/i;
const script = (name) => (scripts[name] && !PLACEHOLDER_SCRIPT.test(scripts[name]) ? `${runner} ${name}` : '');

const detected = {
  PROJECT_NAME: (pkg && pkg.name) || TARGET.split('/').filter(Boolean).pop() || 'Project',
  ONE_LINE_DESCRIPTION: (pkg && pkg.description) || '',
  STACK: guessStack(),
  DEV_COMMAND: script('dev') || script('start'),
  BUILD_COMMAND: script('build'),
  TEST_COMMAND: script('test'),
  // The language of the permanent record is a decision nobody makes out loud,
  // so the agent defaults to the language of the conversation and the repo ends
  // up bilingual. Stating it costs one line and settles it forever (M-0011).
  RECORD_LANGUAGE: 'English',
};

// ---------------------------------------------------------------- prompting

async function collect() {
  if (YES) return detected;
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (label, fallback) => {
    const suffix = fallback ? c.dim(` (${fallback})`) : '';
    const answer = (await rl.question(`${label}${suffix}: `)).trim();
    return answer || fallback || '';
  };
  console.log(c.b('\nbitacora\n'));
  console.log(c.dim('Enter to accept what was detected. These fill CLAUDE.md.\n'));
  const out = {
    PROJECT_NAME: await ask('Project name', detected.PROJECT_NAME),
    ONE_LINE_DESCRIPTION: await ask('One line: what is this', detected.ONE_LINE_DESCRIPTION),
    STACK: await ask('Stack', detected.STACK),
    DEV_COMMAND: await ask('Run it locally', detected.DEV_COMMAND),
    BUILD_COMMAND: await ask('Build / typecheck', detected.BUILD_COMMAND),
    TEST_COMMAND: await ask('Test suite (blank if none)', detected.TEST_COMMAND),
    RECORD_LANGUAGE: await ask('Language for the logbook and docs', detected.RECORD_LANGUAGE),
  };
  rl.close();
  return out;
}

// -------------------------------------------------------------------- copy

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p));
  }
  return out;
}

// Two classes of placeholder, because an absent value means different things.
//
// A command that does not exist should take its whole line with it: a project
// with no test suite must not ship a blank test line in its CLAUDE.md. These
// therefore only ever appear inside a fenced command block, where dropping a
// line is safe — never inside a numbered list.
const COMMAND_VARS = ['DEV_COMMAND', 'BUILD_COMMAND', 'TEST_COMMAND'];

// Prose that detection could not supply is something the user has to write, so
// it becomes a placeholder that doctor will refuse to let them forget.
const PROSE_HINTS = {
  ONE_LINE_DESCRIPTION: 'one line: what this project is and who it is for',
  STACK: 'the stack in one line — language, framework, database, host',
};

function fill(text, vars) {
  return text
    .split('\n')
    .filter((line) => {
      // Drop a command line whose command does not exist in this project.
      const used = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      return !used.some((k) => COMMAND_VARS.includes(k) && !vars[k]);
    })
    .join('\n')
    .replace(/\{\{(\w+)\}\}/g, (whole, k) => {
      if (vars[k]) return vars[k];
      if (k in PROSE_HINTS) return `<!-- bitacora:fill-me ${PROSE_HINTS[k]} -->`;
      return k in vars ? '' : whole;
    });
}

function mergeSettings(targetPath, incoming) {
  const existing = readJson(targetPath);
  if (!existing) return incoming;
  const merged = { ...existing, hooks: { ...(existing.hooks || {}) } };
  for (const [event, groups] of Object.entries(incoming.hooks)) {
    const already = JSON.stringify(merged.hooks[event] || []);
    if (already.includes('bitacora-session')) continue; // re-install stays idempotent
    merged.hooks[event] = [...(merged.hooks[event] || []), ...groups];
  }
  return merged;
}

// -------------------------------------------------------------------- main

const vars = await collect();
const files = walk(TEMPLATE);
const written = [];
const skipped = [];

for (const rel of files) {
  const src = join(TEMPLATE, rel);
  const dest = join(TARGET, rel);
  const isSettings = rel === join('.claude', 'settings.json');

  if (existsSync(dest) && !FORCE && !isSettings) {
    skipped.push(rel);
    continue;
  }

  mkdirSync(dirname(dest), { recursive: true });

  if (isSettings) {
    const incoming = JSON.parse(readFileSync(src, 'utf8'));
    writeFileSync(dest, JSON.stringify(mergeSettings(dest, incoming), null, 2) + '\n');
  } else if (/\.(md|json)$/.test(rel)) {
    let text = fill(readFileSync(src, 'utf8'), vars);
    if (rel === 'STATE.md') text = text.replace(/^updated: .*/m, `updated: ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(dest, text);
  } else {
    writeFileSync(dest, readFileSync(src));
    if (rel.endsWith('.sh') || rel.endsWith('.mjs')) chmodSync(dest, 0o755);
  }
  written.push(rel);
}

// Migrate an install from before skills were directories. A loose .md file in
// .claude/skills/ is never discovered by Claude Code — a skill has to be a
// directory containing SKILL.md — so the old copies were inert, and leaving
// them beside the new directories only invites editing the wrong one (M-0016).
const migrated = [];
for (const rel of files) {
  const m = rel.match(/^\.claude[/\\]skills[/\\]([^/\\]+)[/\\]SKILL\.md$/);
  if (!m) continue;
  const stale = join(TARGET, '.claude', 'skills', `${m[1]}.md`);
  if (existsSync(stale)) {
    rmSync(stale);
    migrated.push(join('.claude', 'skills', `${m[1]}.md`));
  }
}

// A convenience script, only if there is already a package.json to put it in.
if (pkg) {
  pkg.scripts = pkg.scripts || {};
  if (!pkg.scripts.logbook) {
    pkg.scripts.logbook = 'node .bitacora/cli.mjs';
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(c.dim(`\nadded "logbook" script to package.json — ${runner} logbook doctor`));
  }
}

console.log('');
for (const f of written) console.log(`${c.green('+')} ${f}`);
for (const f of skipped) console.log(`${c.yellow('·')} ${f} ${c.dim('already exists, left alone')}`);
for (const f of migrated) console.log(`${c.green('-')} ${f} ${c.dim('removed: a loose .md in skills/ is never loaded as a skill')}`);

console.log(`
${c.b('Installed.')} Three things, in order:

  ${c.b('1.')} Fill the ${c.b('bitacora:fill-me')} blocks in CLAUDE.md, ARCHITECTURE.md and STATE.md.
     ${c.dim('doctor fails until they are gone. That is the point — an unfilled')}
     ${c.dim('logbook is worse than none, because your agent will trust it.')}

  ${c.b('2.')} ${c.b('node .bitacora/cli.mjs doctor')}
     ${c.dim('Run it until it is green.')}

  ${c.b('3.')} Log the first real thing that breaks, the moment it breaks:
     ${c.dim('node .bitacora/cli.mjs new mistake "Title" --tags area --severity high')}

${c.dim('The hooks are wired: a digest on session start, a checked close on session end.')}
${c.dim('To have Claude Code do all of this on its own for every future project:')}
  ${c.dim('npx create-bitacora@latest --global')}
`);
