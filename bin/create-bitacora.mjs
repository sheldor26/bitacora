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

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, chmodSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
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

if (flag('help') || flag('h')) {
  console.log(`create-bitacora — install the logbook your coding agent keeps

  npm create bitacora@latest              interactive, in the current directory
  npx create-bitacora --yes               non-interactive, detect what it can
  npx create-bitacora --dir ./my-app      install somewhere else
  npx create-bitacora --force             overwrite files that already exist

After installing, \`doctor\` fails on purpose: the template ships with
placeholders, and filling them in is step one.
`);
  process.exit(0);
}

const TARGET = join(process.cwd(), opt('dir', '.'));
const FORCE = flag('force');
const YES = flag('yes') || flag('y');

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

const detected = {
  PROJECT_NAME: (pkg && pkg.name) || TARGET.split('/').filter(Boolean).pop() || 'Project',
  ONE_LINE_DESCRIPTION: (pkg && pkg.description) || '',
  STACK: guessStack(),
  DEV_COMMAND: scripts.dev ? `${runner} dev` : scripts.start ? `${runner} start` : '',
  BUILD_COMMAND: scripts.build ? `${runner} build` : '',
  TEST_COMMAND: scripts.test ? `${runner} test` : '',
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

function fill(text, vars) {
  let out = text.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
  // A blank test command would leave a dangling line in the commands block.
  if (!vars.TEST_COMMAND) {
    out = out
      .split('\n')
      .filter((l) => !/bitacora:fill-me or delete this line if there is no test suite/.test(l))
      .join('\n');
  }
  return out;
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
`);
