// Proves that each manifest skill is visible to both agents: a folder in ~/.agents/skills (Codex) and a link to it
// in ~/.claude/skills (Claude Code).

import {existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {parse as parseYaml} from 'yaml';
import type {Entry} from './manifest.ts';
import {sanitizeMetadata} from './sanitize.ts';

export type Problem = {name: string; kind: 'missing-agents' | 'bad-skill-file' | 'missing-claude' | 'plain-folder' | 'wrong-target' | 'unlisted'};

export const EXPLAIN: Record<Problem['kind'], string> = {
  'missing-agents': 'not in ~/.agents/skills, so Codex cannot load it',
  'bad-skill-file': 'SKILL.md in ~/.agents/skills is not a skill that the installer accepts with this name: unreadable, invalid YAML, or a missing name or description',
  'missing-claude': 'not in ~/.claude/skills, so Claude Code cannot load it',
  'plain-folder': 'a plain folder in ~/.claude/skills, not a link to ~/.agents/skills',
  'wrong-target': 'the link in ~/.claude/skills points somewhere other than ~/.agents/skills',
  unlisted: 'in ~/.agents/skills but not in manifest.json',
};

const lstat = (path: string) => {try {return lstatSync(path);} catch {return null;}};

// The installer's own rules (skills@1.9.0: src/frontmatter.ts, src/skills.ts, src/sanitize.ts), so the checker
// accepts exactly the SKILL.md files that the installer accepts. Keep yaml at the version that skills@1.9.0 resolves.
const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** The skill name that the installer reads from a SKILL.md file, or null when the installer would skip the file. */
export function skillName(path: string): string | null {
  try {
    if (!statSync(path).isFile()) return null;
    const match = FRONTMATTER.exec(readFileSync(path, 'utf8'));
    const data = (match ? parseYaml(match[1]) : null) as Record<string, unknown> | null;
    if (!data || typeof data.name !== 'string' || typeof data.description !== 'string') return null;
    const name = sanitizeMetadata(data.name);
    return name && sanitizeMetadata(data.description) ? name : null;
  } catch {
    return null;
  }
}

export function check(entries: Entry[], home: string): Problem[] {
  const agents = join(home, '.agents/skills'), claude = join(home, '.claude/skills');
  const problems: Problem[] = [];
  for (const {name} of entries) {
    const canonical = join(agents, name), linked = join(claude, name);
    if (!existsSync(join(canonical, 'SKILL.md'))) problems.push({name, kind: 'missing-agents'});
    else if (skillName(join(canonical, 'SKILL.md')) !== name) problems.push({name, kind: 'bad-skill-file'});
    const stat = lstat(linked);
    if (!stat) problems.push({name, kind: 'missing-claude'});
    else if (!stat.isSymbolicLink()) problems.push({name, kind: 'plain-folder'});
    else if (!existsSync(canonical) || !existsSync(linked) || realpathSync(linked) !== realpathSync(canonical)) problems.push({name, kind: 'wrong-target'});
  }
  const listed = new Set(entries.map(item => item.name));
  const installed = existsSync(agents) ? readdirSync(agents).filter(name => !name.startsWith('.')).sort() : [];
  for (const name of installed) if (!listed.has(name)) problems.push({name, kind: 'unlisted'});
  return problems;
}
