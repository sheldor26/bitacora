#!/usr/bin/env node
/**
 * bitacora — the logbook your coding agent keeps.
 *
 * Zero dependencies. Lives inside your repo on purpose: no supply chain,
 * no version drift, and your agent can read the source of its own tooling.
 *
 * Usage:
 *   node .bitacora/cli.mjs doctor
 *   node .bitacora/cli.mjs new mistake "Scraper overwrote manual prices" --tags pricing,data-loss --severity high
 *   node .bitacora/cli.mjs recall pricing
 *   node .bitacora/cli.mjs rotate
 *   node .bitacora/cli.mjs stats
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const MARKER = '<!-- bitacora:entry';
const ARCHIVE_HEADING = '## Archived';

const DEFAULTS = {
  version: 1,
  logs: {
    'MISTAKES.md': { prefix: 'M', maxLines: 400, keepEntries: 20 },
    'LEARNINGS.md': { prefix: 'L', maxLines: 400, keepEntries: 20 },
    'DECISIONS.md': { prefix: 'D', maxLines: 600, keepEntries: 40 },
  },
  state: { file: 'STATE.md', maxLines: 200, maxAgeDays: 14 },
  required: ['CLAUDE.md', 'ARCHITECTURE.md', 'STATE.md', 'MISTAKES.md', 'LEARNINGS.md', 'DECISIONS.md'],
  archiveDir: 'docs/bitacora-archive',
};

const KIND_TO_FILE = { mistake: 'MISTAKES.md', learning: 'LEARNINGS.md', decision: 'DECISIONS.md' };

// ---------------------------------------------------------------- utilities

const C = process.env.NO_COLOR
  ? { red: (s) => s, green: (s) => s, yellow: (s) => s, dim: (s) => s, bold: (s) => s }
  : {
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
    };

function loadConfig() {
  const p = join(ROOT, 'bitacora.config.json');
  if (!existsSync(p)) return DEFAULTS;
  try {
    const user = JSON.parse(readFileSync(p, 'utf8'));
    return {
      ...DEFAULTS,
      ...user,
      logs: { ...DEFAULTS.logs, ...(user.logs || {}) },
      state: { ...DEFAULTS.state, ...(user.state || {}) },
    };
  } catch (e) {
    console.error(C.red(`bitacora.config.json is not valid JSON: ${e.message}`));
    process.exit(1);
  }
}

function read(file) {
  const p = join(ROOT, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseList(raw) {
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * Split a log file into { head, entries[], tail }.
 * An entry owns everything from its marker up to the next marker,
 * the "## Archived" heading, or end of file.
 */
function parseEntries(text) {
  if (!text) return { head: '', entries: [], tail: '' };
  const archiveAt = text.indexOf(`\n${ARCHIVE_HEADING}`);
  const body = archiveAt === -1 ? text : text.slice(0, archiveAt);
  const tail = archiveAt === -1 ? '' : text.slice(archiveAt);

  // Anchored to the start of a line on purpose: prose that quotes the marker
  // inline (this project's own docs do) must not register as an entry.
  const starts = [];
  const anchor = new RegExp(`^${MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm');
  for (let m = anchor.exec(body); m !== null; m = anchor.exec(body)) starts.push(m.index);
  if (starts.length === 0) return { head: body, entries: [], tail };

  const head = body.slice(0, starts[0]);
  const entries = starts.map((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1] : body.length;
    const raw = body.slice(start, end);
    const close = raw.indexOf('-->');
    const frontmatter = close === -1 ? '' : raw.slice(MARKER.length, close);
    const meta = {};
    for (const line of frontmatter.split('\n')) {
      const m = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*?)\s*$/);
      if (m) meta[m[1]] = m[2];
    }
    const titleMatch = raw.match(/^#{2,4}\s+(.+)$/m);
    return {
      raw,
      id: meta.id || null,
      date: meta.date || null,
      tags: parseList(meta.tags),
      severity: meta.severity || null,
      files: parseList(meta.files),
      title: titleMatch ? titleMatch[1].trim() : '(untitled)',
      lines: raw.split('\n').length,
    };
  });
  return { head, entries, tail };
}

function nextId(prefix, entries) {
  let max = 0;
  for (const e of entries) {
    const m = (e.id || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function daysSince(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

// ------------------------------------------------------------------ doctor

function doctor(cfg) {
  const errors = [];
  const warnings = [];

  // 1. Required files exist.
  for (const f of cfg.required) {
    if (!existsSync(join(ROOT, f))) errors.push(`missing required file: ${f}`);
  }

  // 2. Placeholders left over from the template.
  for (const f of cfg.required) {
    const t = read(f);
    if (t && /<!--\s*bitacora:fill-me/.test(t)) {
      errors.push(`${f} still has a bitacora:fill-me placeholder — write the real thing or delete the block`);
    }
  }

  // 3. Context budget on each log.
  for (const [file, spec] of Object.entries(cfg.logs)) {
    const t = read(file);
    if (t === null) continue;
    const n = t.split('\n').length;
    if (n > spec.maxLines) {
      errors.push(`${file} is ${n} lines, budget is ${spec.maxLines} — run "rotate" to archive old entries`);
    } else if (n > spec.maxLines * 0.85) {
      warnings.push(`${file} is at ${Math.round((n / spec.maxLines) * 100)}% of its ${spec.maxLines}-line budget`);
    }
  }

  // 4. Every entry is machine-readable, and ids are unique.
  const seen = new Map();
  for (const [file, spec] of Object.entries(cfg.logs)) {
    const { entries } = parseEntries(read(file));
    entries.forEach((e, n) => {
      const where = `${file} entry #${n + 1} ("${e.title}")`;
      if (!e.id) errors.push(`${where} has no id`);
      else if (!new RegExp(`^${spec.prefix}-\\d{4}$`).test(e.id))
        errors.push(`${where} has id "${e.id}", expected ${spec.prefix}-0000 form`);
      else if (seen.has(e.id)) errors.push(`duplicate id ${e.id} (${seen.get(e.id)} and ${file})`);
      else seen.set(e.id, file);
      if (!e.date || Number.isNaN(Date.parse(e.date))) errors.push(`${where} has an unparseable date: "${e.date}"`);
      if (e.tags.length === 0) errors.push(`${where} has no tags — recall cannot find it`);
    });
  }

  // 5. STATE.md is fresh.
  const stateText = read(cfg.state.file);
  if (stateText) {
    const m = stateText.match(/^updated:\s*(\S+)/m);
    if (!m) {
      errors.push(`${cfg.state.file} has no "updated: YYYY-MM-DD" line`);
    } else {
      const age = daysSince(m[1]);
      if (age === null) errors.push(`${cfg.state.file} updated date is unparseable: "${m[1]}"`);
      else if (age > cfg.state.maxAgeDays)
        warnings.push(`${cfg.state.file} was last updated ${age} days ago (limit ${cfg.state.maxAgeDays}) — it is probably lying to your agent`);
    }
    const n = stateText.split('\n').length;
    if (n > cfg.state.maxLines)
      errors.push(`${cfg.state.file} is ${n} lines, budget is ${cfg.state.maxLines} — it is a snapshot, not a diary. Move history into the logs.`);
  }

  // 6. The context leak: CLAUDE.md must not eagerly import a budgeted file.
  const claude = read('CLAUDE.md');
  if (claude) {
    for (const file of [...Object.keys(cfg.logs)]) {
      if (new RegExp(`^\\s*@${file.replace('.', '\\.')}\\s*$`, 'm').test(claude)) {
        errors.push(`CLAUDE.md does "@${file}" — that loads the whole log into every session. Let the agent recall by tag instead.`);
      }
    }
  }

  for (const w of warnings) console.log(`${C.yellow('warn')}  ${w}`);
  for (const e of errors) console.log(`${C.red('error')} ${e}`);

  if (errors.length === 0) {
    const counts = Object.keys(cfg.logs)
      .map((f) => `${parseEntries(read(f)).entries.length} ${f.replace('.md', '').toLowerCase()}`)
      .join(', ');
    console.log(`${C.green('ok')}    bitacora is healthy ${C.dim(`(${counts})`)}`);
  }
  process.exit(errors.length > 0 ? 1 : 0);
}

// --------------------------------------------------------------------- new

const BODY = {
  mistake: [
    '**What happened.** <!-- bitacora:fill-me one paragraph, concrete, no blame -->',
    '',
    '**Root cause.** <!-- bitacora:fill-me why it was possible, not just what broke -->',
    '',
    '**Guardrail.** <!-- bitacora:fill-me the check, test or rule that makes this impossible to repeat -->',
  ],
  learning: [
    '**What worked.** <!-- bitacora:fill-me -->',
    '',
    '**Why it worked.** <!-- bitacora:fill-me the transferable part -->',
    '',
    '**Reuse it when.** <!-- bitacora:fill-me the trigger that should bring this back -->',
  ],
  decision: [
    '**Context.** <!-- bitacora:fill-me the forces in play at the time -->',
    '',
    '**Decision.** <!-- bitacora:fill-me -->',
    '',
    '**Consequences.** <!-- bitacora:fill-me what this makes easy, and what it makes expensive -->',
  ],
};

function newEntry(cfg, args) {
  const kind = args._[0];
  const title = args._.slice(1).join(' ');
  if (!KIND_TO_FILE[kind] || !title) {
    console.error('usage: new <mistake|learning|decision> "<title>" [--tags a,b] [--severity low|medium|high] [--files a.ts,b.ts]');
    process.exit(1);
  }
  const file = KIND_TO_FILE[kind];
  const spec = cfg.logs[file];
  const text = read(file);
  if (text === null) {
    console.error(C.red(`${file} does not exist. Run the installer first.`));
    process.exit(1);
  }
  const { head, entries, tail } = parseEntries(text);
  const id = nextId(spec.prefix, entries);
  const tags = parseList(args.tags);
  if (tags.length === 0) {
    console.error(C.red('--tags is required: an untagged entry is an entry nobody will ever recall.'));
    process.exit(1);
  }

  const meta = [`id: ${id}`, `date: ${today()}`, `tags: [${tags.join(', ')}]`];
  if (kind === 'mistake') meta.push(`severity: ${args.severity || 'medium'}`);
  const files = parseList(args.files);
  if (files.length) meta.push(`files: [${files.join(', ')}]`);

  const entry = [MARKER, ...meta, '-->', `### ${title}`, '', ...BODY[kind], '', ''].join('\n');

  // Newest first: the agent reads top-down and stops early.
  writeFileSync(join(ROOT, file), head + entry + entries.map((e) => e.raw).join('') + tail);
  console.log(`${C.green('added')} ${id} to ${file} ${C.dim(`[${tags.join(', ')}]`)}`);
  console.log(C.dim('Now fill the bitacora:fill-me blocks. doctor fails while they are still there.'));
}

// ------------------------------------------------------------------ recall

function recall(cfg, args) {
  const needle = (args._[0] || '').toLowerCase();
  if (!needle) {
    console.error('usage: recall <tag-or-text>');
    process.exit(1);
  }
  let found = 0;
  for (const file of Object.keys(cfg.logs)) {
    const { entries } = parseEntries(read(file));
    const hits = entries.filter(
      (e) =>
        e.tags.some((t) => t.toLowerCase() === needle) ||
        e.title.toLowerCase().includes(needle) ||
        e.files.some((f) => f.toLowerCase().includes(needle)) ||
        e.raw.toLowerCase().includes(needle)
    );
    for (const h of hits) {
      found++;
      console.log(`${C.bold(`${h.id}  ${h.title}`)}`);
      console.log(C.dim(`      ${file} · ${h.date} · [${h.tags.join(', ')}]${h.severity ? ` · ${h.severity}` : ''}`));
    }
  }
  const archive = join(ROOT, cfg.archiveDir);
  if (existsSync(archive)) {
    for (const f of readdirSync(archive)) {
      const t = readFileSync(join(archive, f), 'utf8');
      const { entries } = parseEntries(t);
      const hits = entries.filter((e) => e.tags.some((x) => x.toLowerCase() === needle));
      for (const h of hits) {
        found++;
        console.log(`${C.bold(`${h.id}  ${h.title}`)} ${C.dim('(archived)')}`);
        console.log(C.dim(`      ${cfg.archiveDir}/${f} · ${h.date} · [${h.tags.join(', ')}]`));
      }
    }
  }
  if (found === 0) console.log(C.dim(`nothing logged under "${needle}" yet`));
  else console.log(C.dim(`\n${found} entr${found === 1 ? 'y' : 'ies'}. Read the full text before you touch this area.`));
}

// ------------------------------------------------------------------ rotate

function rotate(cfg, args) {
  const dry = Boolean(args['dry-run']);
  let moved = 0;
  for (const [file, spec] of Object.entries(cfg.logs)) {
    const text = read(file);
    if (text === null) continue;
    const { head, entries, tail } = parseEntries(text);
    if (entries.length <= spec.keepEntries) continue;

    const keep = entries.slice(0, spec.keepEntries);
    const retire = entries.slice(spec.keepEntries);

    const byYear = new Map();
    for (const e of retire) {
      const year = (e.date || today()).slice(0, 4);
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(e);
    }

    const indexLines = [];
    for (const [year, group] of byYear) {
      const target = join(ROOT, cfg.archiveDir, `${file.replace('.md', '').toLowerCase()}-${year}.md`);
      const existing = existsSync(target)
        ? readFileSync(target, 'utf8')
        : `# ${file.replace('.md', '')} — ${year}\n\n> Archived by bitacora. Still searchable with "recall".\n\n`;
      if (!dry) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, existing + group.map((e) => e.raw).join(''));
      }
      const archiveRel = `${cfg.archiveDir}/${file.replace('.md', '').toLowerCase()}-${year}.md`;
      for (const e of group) {
        indexLines.push(`- \`${e.id}\` ${e.title} — [${e.tags.join(', ')}] → \`${archiveRel}\``);
      }
      moved += group.length;
    }

    const oldIndex = tail
      .split('\n')
      .filter((l) => l.trim().startsWith('- `'))
      .join('\n');
    const newTail = [`\n${ARCHIVE_HEADING}`, '', 'Older entries, one line each. `recall` still searches them.', '', indexLines.join('\n'), oldIndex, ''].join('\n');

    if (!dry) writeFileSync(join(ROOT, file), head + keep.map((e) => e.raw).join('') + newTail);
    console.log(`${dry ? C.yellow('would move') : C.green('moved')} ${retire.length} from ${file}`);
  }
  if (moved === 0) console.log(C.dim('nothing to rotate — every log is within its entry budget'));
  else if (!dry) console.log(C.dim(`\n${moved} entries archived. Live files are lean again; run doctor to confirm.`));
}

// ------------------------------------------------------------------- stats

function stats(cfg) {
  const tally = new Map();
  let total = 0;
  for (const file of Object.keys(cfg.logs)) {
    const { entries } = parseEntries(read(file));
    total += entries.length;
    for (const e of entries) for (const t of e.tags) tally.set(t, (tally.get(t) || 0) + 1);
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (ranked.length === 0) {
    console.log(C.dim('no entries yet'));
    return;
  }
  const width = Math.max(...ranked.map(([t]) => t.length));
  const top = ranked[0][1];
  console.log(C.bold(`\n${total} entries logged. Where the friction is:\n`));
  for (const [tag, n] of ranked) {
    const bar = '█'.repeat(Math.max(1, Math.round((n / top) * 28)));
    console.log(`  ${tag.padEnd(width)}  ${bar} ${n}`);
  }
  console.log(C.dim('\nThe top tag is the thing worth automating away.\n'));
}

// -------------------------------------------------------------------- main

function parseArgv(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v !== undefined ? v : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else out._.push(a);
  }
  return out;
}

const [, , cmd, ...rest] = process.argv;
const args = parseArgv(rest);
const cfg = loadConfig();

switch (cmd) {
  case 'doctor': doctor(cfg); break;
  case 'new': newEntry(cfg, args); break;
  case 'recall': recall(cfg, args); break;
  case 'rotate': rotate(cfg, args); break;
  case 'stats': stats(cfg); break;
  default:
    console.log(`bitacora — the logbook your coding agent keeps

  doctor                              check structure, freshness and context budget
  new <kind> "<title>" --tags a,b     add an entry (kind: mistake | learning | decision)
  recall <tag>                        pull only the entries that matter right now
  rotate [--dry-run]                  archive old entries, keep the live files lean
  stats                               where your friction actually is
`);
    process.exit(cmd ? 1 : 0);
}
