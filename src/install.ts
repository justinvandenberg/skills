// The `npx skills add` commands for a manifest. Every skill installs globally for Codex and Claude Code.

import {dirname, join} from 'node:path';
import type {Entry} from './manifest.ts';

const FLAGS = ['-g', '-a', 'codex', 'claude-code', '-y'];
/** The skills CLI version. Pinned, so a new release cannot change how sources install. Raise it by hand. */
export const CLI = 'skills@1.9.0';

/** The full install location of one entry: owner/repo[/path] on the default branch, or a folder in this repo. */
export function location(entry: Entry, repoRoot: string): string {
  if (entry.source === 'orca') return 'orca';
  if (entry.source === 'local') return join(repoRoot, dirname(entry.path!));
  return entry.path ? `${entry.source}/${entry.path}` : entry.source;
}

/** One argv for each distinct location, in manifest order of first appearance. */
export function commands(entries: Entry[], repoRoot: string): string[][] {
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const where = location(entry, repoRoot);
    groups.set(where, [...(groups.get(where) ?? []), entry.name]);
  }
  return [...groups].map(([where, names]) => where === 'orca'
    // Orca installs from its app bundle, at the version the app ships, into the same folders and links.
    ? ['orca', 'skills', 'install', '--agent', 'codex,claude-code', ...names.flatMap(name => ['--skill', name])]
    : ['npx', CLI, 'add', where, ...FLAGS, '--skill', ...names]);
}
