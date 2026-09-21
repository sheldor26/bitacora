#!/usr/bin/env node
/**
 * This repository uses its own system, so the operational files exist twice:
 * once in `template/` as the payload shipped to users, and once at the root as
 * this project's own installed copy.
 *
 * `npm run sync:self` copies template -> root for those files, and only those
 * files. It deliberately does NOT touch the root markdown — CLAUDE.md,
 * STATE.md and the logs are this project's real content, and running the
 * installer with --force here would overwrite them with template placeholders.
 * That is the footgun this script exists to replace.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SYNCED = [
  '.bitacora/cli.mjs',
  '.claude/settings.json',
  '.claude/hooks/bitacora-session-start.sh',
  '.claude/hooks/bitacora-session-end.sh',
  '.claude/skills/close-session/SKILL.md',
  '.claude/skills/log-mistake/SKILL.md',
  '.claude/skills/recall/SKILL.md',
];

let changed = 0;
for (const rel of SYNCED) {
  const src = join(ROOT, 'template', rel);
  if (!existsSync(src)) {
    console.log(`!  template/${rel} does not exist — remove it from SYNCED or add the file`);
    process.exitCode = 1;
    continue;
  }
  const incoming = readFileSync(src, 'utf8');
  const dest = join(ROOT, rel);
  if (existsSync(dest) && readFileSync(dest, 'utf8') === incoming) continue;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, incoming);
  console.log(`~  ${rel}`);
  changed++;
}

console.log(changed === 0 ? 'already in sync' : `${changed} file${changed === 1 ? '' : 's'} synced from template/`);
