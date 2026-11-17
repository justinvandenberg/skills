// The `npx skills add` commands for a manifest. Every skill installs globally for Codex and Claude Code.

import {dirname, join} from 'node:path';
import type {Entry} from './manifest.ts';

const FLAGS = ['-g', '-a', 'codex', 'claude-code', '-y'];
/** The skills CLI version. Pinned, so a new release cannot change how sources install. Raise it by hand. */
export const CLI = 'skills@1.9.0';

/** The full install location of one entry: owner/repo[/path] on the default branch, or a folder in this repo. */
export function location(entry: Entry, repoRoot: string): string {
  if (entry.source === 'orca') return 'orca';
  if (entry.archive) return `archive:${entry.source}${entry.path ? `/${entry.path}` : ''}`;
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
    : where.startsWith('archive:') ? archive(where.slice('archive:'.length), names)
    : ['npx', CLI, 'add', where, ...FLAGS, '--skill', ...names]);
}

/**
 * Download the default branch as a GitHub archive into a temporary folder, then install from that folder. GitHub
 * serves the archive from a cache, so it stays fast for a repository whose clone times out. The script is fixed text;
 * every manifest value is a positional argument and is only used inside double-quoted expansions, so a value can never
 * run as shell code.
 */
const ARCHIVE_SCRIPT = [
  'set -eu',
  'owner=$1; repo=$2; sub=$3; shift 3',
  'dir=$(mktemp -d)',
  `trap 'rm -rf "$dir"' EXIT`,
  // A download slower than 10 KB/s for 30 s counts as stalled: curl stops it and tries again, up to 3 times. It
  // writes to a file, not a pipe, because a retry cannot take back data that it already sent down a pipe.
  'curl -fsSL --speed-limit 10240 --speed-time 30 --retry 3 --retry-all-errors -o "$dir/archive.tar.gz" "https://codeload.github.com/$owner/$repo/tar.gz/HEAD"',
  'mkdir "$dir/src"',
  'tar -xzf "$dir/archive.tar.gz" -C "$dir/src" --strip-components=1',
  `npx ${CLI} add "$dir/src/$sub" ${FLAGS.join(' ')} --skill "$@"`,
].join('; ');

function archive(target: string, names: string[]): string[] {
  const [owner, repo, ...rest] = target.split('/');
  return ['sh', '-c', ARCHIVE_SCRIPT, 'skills-archive', owner, repo, rest.join('/'), ...names];
}
