// The `npx skills add` commands for a manifest. Every skill installs globally for Codex and Claude Code.

import {dirname, join} from 'node:path';
import type {Entry} from './manifest.ts';

const FLAGS = ['-g', '-a', 'codex', 'claude-code', '-y'];

/** The full install location of one entry: a tree URL, owner/repo[@ref], or a folder in this repo. */
export function location(entry: Entry, repoRoot: string): string {
  if (entry.source === 'local') return join(repoRoot, dirname(entry.path!));
  if (entry.path) return `https://github.com/${entry.source}/tree/${entry.ref ?? 'main'}/${entry.path}`;
  return entry.ref ? `${entry.source}@${entry.ref}` : entry.source;
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
