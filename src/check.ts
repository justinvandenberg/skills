// Proves that each manifest skill is visible to both agents: a folder in ~/.agents/skills (Codex) and a link to it
// in ~/.claude/skills (Claude Code).

import {existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {join} from 'node:path';
import type {Entry} from './manifest.ts';

export type Problem = {name: string; kind: 'missing-agents' | 'bad-skill-file' | 'missing-claude' | 'plain-folder' | 'wrong-target' | 'unlisted'};

export const EXPLAIN: Record<Problem['kind'], string> = {
  'missing-agents': 'not in ~/.agents/skills, so Codex cannot load it',
  'bad-skill-file': 'SKILL.md in ~/.agents/skills is not a readable file whose frontmatter names this skill',
  'missing-claude': 'not in ~/.claude/skills, so Claude Code cannot load it',
  'plain-folder': 'a plain folder in ~/.claude/skills, not a link to ~/.agents/skills',
  'wrong-target': 'the link in ~/.claude/skills points somewhere other than ~/.agents/skills',
  unlisted: 'in ~/.agents/skills but not in manifest.json',
};

const lstat = (path: string) => {try {return lstatSync(path);} catch {return null;}};

/** The frontmatter `name` of a SKILL.md file, or null when it is not a readable file with frontmatter and a name. */
function skillName(path: string): string | null {
  try {
    if (!statSync(path).isFile()) return null;
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, 'utf8'))?.[1];
    const name = frontmatter && /^name:\s*(.+?)\s*$/m.exec(frontmatter)?.[1];
    return name ? name.replace(/^(["'])(.*)\1$/, '$2') : null;
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
