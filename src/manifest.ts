// The skill manifest: every skill, its group, and where it installs from.

import {readFileSync} from 'node:fs';

/**
 * One skill. A remote entry has source `owner/repo`, with an optional folder (`path`), and installs from the default
 * branch. A local entry has source `local` and a `path` to its folder in this repo. An `orca` entry is a skill that
 * the Orca app ships; it installs with the Orca CLI at the version that matches the app. A remote entry with
 * `archive: true` installs from the GitHub archive of the default branch instead of a git clone, for a repository
 * whose clone is too slow.
 */
export type Entry = {group: string; name: string; source: string; path?: string; archive?: true};

export class ManifestError extends Error {}

/** The folder in the plugins fork whose skills depend on the cursor-harness adapter skill. */
export const HARNESS_PATH = 'agents-harness/skills';
const FIELDS = new Set(['group', 'name', 'source', 'path', 'archive']);
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** The entries of a parsed manifest.json, checked. Each problem throws a ManifestError that names the entry. */
export function parseManifest(json: unknown): Entry[] {
  const skills = (json as {skills?: unknown})?.skills;
  if (!Array.isArray(skills)) throw new ManifestError('manifest.json: "skills" must be a list');
  const seen = new Set<string>();
  const entries = skills.map((item, index): Entry => {
    const where = `manifest.json skills[${index}]`;
    if (!item || typeof item !== 'object') throw new ManifestError(`${where}: must be an object`);
    for (const key of Object.keys(item)) if (!FIELDS.has(key)) throw new ManifestError(`${where}: unknown field "${key}"`);
    const entry = item as Record<string, unknown>;
    for (const key of ['group', 'name', 'source']) {
      if (typeof entry[key] !== 'string' || !entry[key]) throw new ManifestError(`${where}: "${key}" must be a non-empty string`);
    }
    if ('path' in entry && (typeof entry.path !== 'string' || !entry.path)) throw new ManifestError(`${where}: "path" must be a non-empty string`);
    if ('archive' in entry && entry.archive !== true) throw new ManifestError(`${where}: "archive" must be true when set`);
    const {name, source} = entry as Entry;
    if (entry.archive && (source === 'local' || source === 'orca')) throw new ManifestError(`${where}: "archive" applies only to an owner/repo source`);
    if (!NAME.test(name)) throw new ManifestError(`${where}: name "${name}" must be lowercase words joined by hyphens`);
    if (seen.has(name)) throw new ManifestError(`${where}: duplicate name "${name}"`);
    seen.add(name);
    if (source === 'orca') {
      if (entry.path) throw new ManifestError(`${where}: orca entry "${name}" cannot have a "path"; Orca ships it`);
    } else if (source === 'local') {
      if (!entry.path) throw new ManifestError(`${where}: local entry "${name}" needs a "path" in this repo`);
    } else if (!REPO.test(source)) {
      throw new ManifestError(`${where}: source "${source}" must be owner/repo, "local", or "orca"`);
    }
    return entry as Entry;
  });
  const harnessed = entries.filter(item => item.path === HARNESS_PATH && item.name !== 'cursor-harness');
  if (harnessed.length && !entries.some(item => item.name === 'cursor-harness')) {
    throw new ManifestError(`manifest.json: ${harnessed.map(item => item.name).join(', ')} need the cursor-harness skill, which is not listed`);
  }
  return entries;
}

export function loadManifest(path: string): Entry[] {
  return parseManifest(JSON.parse(readFileSync(path, 'utf8')));
}
