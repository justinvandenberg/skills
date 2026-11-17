// The `npx skills add` commands for a manifest. Every skill installs globally for Codex and Claude Code.

import {dirname, join} from 'node:path';
import type {Entry} from './manifest.ts';

const FLAGS = ['-g', '-a', 'codex', 'claude-code', '-y'];

/**
 * The full install location of one entry: owner/repo[/path][#ref], or a folder in this repo. The skills CLI reads
 * `owner/repo@x` as a skill filter unless x is a full version or a commit SHA, so a ref always goes after `#`,
 * URL-encoded, which the CLI reads as a checkout ref for any branch, tag, or commit (vercel-labs/skills
 * src/source-parser.ts).
 */
export function location(entry: Entry, repoRoot: string): string {
  if (entry.source === 'local') return join(repoRoot, dirname(entry.path!));
  const base = entry.path ? `${entry.source}/${entry.path}` : entry.source;
  return entry.ref ? `${base}#${encodeURIComponent(entry.ref)}` : base;
}

/** One argv for each distinct location, in manifest order of first appearance. */
export function commands(entries: Entry[], repoRoot: string): string[][] {
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const where = location(entry, repoRoot);
    groups.set(where, [...(groups.get(where) ?? []), entry.name]);
  }
  return [...groups].map(([where, names]) => ['npx', 'skills@latest', 'add', where, ...FLAGS, '--skill', ...names]);
}
