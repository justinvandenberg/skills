import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {check} from '../src/check.ts';
import type {Entry} from '../src/manifest.ts';

const entries: Entry[] = [
  {group: 'g', name: 'tdd', source: 'mattpocock/skills'},
  {group: 'g', name: 'cursor-harness', source: 'justinvandenberg/plugins', path: 'agents-harness/skills'},
];

/** A fake home folder, removed after the test. */
function home(t: test.TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'skills-home-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  mkdirSync(join(dir, '.agents/skills'), {recursive: true});
  mkdirSync(join(dir, '.claude/skills'), {recursive: true});
  return dir;
}

/** Install a skill the way `npx skills add -g -a codex claude-code` does: a folder in .agents, a link in .claude. */
function install(dir: string, name: string) {
  mkdirSync(join(dir, '.agents/skills', name));
  writeFileSync(join(dir, '.agents/skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: test\n---\n# ${name}\n`);
  symlinkSync(`../../.agents/skills/${name}`, join(dir, '.claude/skills', name));
}

test('reports no problems for a correct home', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  assert.deepEqual(check(entries, dir), []);
});

test('reports a skill missing for Codex', t => {
  const dir = home(t);
  install(dir, 'tdd');
  assert.deepEqual(check(entries, dir), [{name: 'cursor-harness', kind: 'missing-agents'}, {name: 'cursor-harness', kind: 'missing-claude'}]);
});

test('reports a skill missing for Claude Code', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  rmSync(join(dir, '.claude/skills/tdd'));
  assert.deepEqual(check(entries, dir), [{name: 'tdd', kind: 'missing-claude'}]);
});

test('reports a plain folder in ~/.claude/skills', t => {
  const dir = home(t);
  install(dir, 'cursor-harness');
  mkdirSync(join(dir, '.agents/skills/tdd'));
  writeFileSync(join(dir, '.agents/skills/tdd/SKILL.md'), '---\nname: tdd\ndescription: test\n---\n');
  mkdirSync(join(dir, '.claude/skills/tdd'));
  assert.deepEqual(check(entries, dir), [{name: 'tdd', kind: 'plain-folder'}]);
});

test('reports a link that points outside ~/.agents/skills', t => {
  const dir = home(t);
  install(dir, 'cursor-harness');
  mkdirSync(join(dir, '.agents/skills/tdd'));
  writeFileSync(join(dir, '.agents/skills/tdd/SKILL.md'), '---\nname: tdd\ndescription: test\n---\n');
  mkdirSync(join(dir, 'elsewhere/tdd'), {recursive: true});
  symlinkSync(join(dir, 'elsewhere/tdd'), join(dir, '.claude/skills/tdd'));
  assert.deepEqual(check(entries, dir), [{name: 'tdd', kind: 'wrong-target'}]);
});

test('reports an unlisted skill in ~/.agents/skills', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  install(dir, 'gsd-help');
  assert.deepEqual(check(entries, dir), [{name: 'gsd-help', kind: 'unlisted'}]);
});

test('ignores folders in ~/.claude/skills that the manifest does not list', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  mkdirSync(join(dir, '.claude/skills/synced'));
  assert.deepEqual(check(entries, dir), []);
});

test('checks a local entry in both agents', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  const local: Entry = {group: 'g', name: 'resolving-merge-conflicts', source: 'local', path: 'skills/resolving-merge-conflicts'};
  mkdirSync(join(dir, '.agents/skills/resolving-merge-conflicts'));
  writeFileSync(join(dir, '.agents/skills/resolving-merge-conflicts/SKILL.md'), '---\nname: resolving-merge-conflicts\ndescription: test\n---\n');
  assert.deepEqual(check([...entries, local], dir), [{name: 'resolving-merge-conflicts', kind: 'missing-claude'}]);
});

test('reports a SKILL.md that is a folder', t => {
  const dir = home(t);
  install(dir, 'cursor-harness');
  mkdirSync(join(dir, '.agents/skills/tdd/SKILL.md'), {recursive: true});
  symlinkSync('../../.agents/skills/tdd', join(dir, '.claude/skills/tdd'));
  assert.deepEqual(check(entries, dir), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('reports a SKILL.md with no frontmatter', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  writeFileSync(join(dir, '.agents/skills/tdd/SKILL.md'), 'not a skill');
  assert.deepEqual(check(entries, dir), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('reports a SKILL.md whose name is another skill', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  writeFileSync(join(dir, '.agents/skills/tdd/SKILL.md'), '---\nname: triage\n---\n');
  assert.deepEqual(check(entries, dir), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('accepts a quoted name in the frontmatter', t => {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  writeFileSync(join(dir, '.agents/skills/tdd/SKILL.md'), '---\nname: "tdd"\ndescription: x\n---\n');
  assert.deepEqual(check(entries, dir), []);
});

/** Install tdd with this SKILL.md text, next to a correct cursor-harness. */
function withSkill(t: test.TestContext, text: string): string {
  const dir = home(t);
  install(dir, 'tdd');
  install(dir, 'cursor-harness');
  writeFileSync(join(dir, '.agents/skills/tdd/SKILL.md'), text);
  return dir;
}

test('reports a SKILL.md without a description, as the installer does', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: tdd\n---\n')), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('reports a SKILL.md with an empty description', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: tdd\ndescription: "  "\n---\n')), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('reports a SKILL.md whose name is not a string', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: [tdd]\ndescription: x\n---\n')), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('reports invalid YAML, as the installer does', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: tdd\ndescription: "unterminated\n---\n')), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('accepts a name with a YAML comment', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: tdd # the TDD skill\ndescription: x\n---\n')), []);
});

test('accepts the description forms that real skills use', t => {
  for (const description of ['plain text', '"quoted: text"', '>\n  folded\n  block', '|\n  literal\n  block', '\n  plain text\n  on indented lines']) {
    assert.deepEqual(check(entries, withSkill(t, `---\nname: tdd\ndescription: ${description}\n---\n`)), [], description);
  }
});

test('reports a description that is only control characters, as the installer does', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: tdd\ndescription: "\\x07"\n---\n')), [{name: 'tdd', kind: 'bad-skill-file'}]);
  assert.deepEqual(check(entries, withSkill(t, '---\nname: tdd\ndescription: "\\x9b\\x1b7\\x1bP data\\x1b\\\\"\n---\n')), [{name: 'tdd', kind: 'bad-skill-file'}]);
});

test('strips terminal escapes from the name, as the installer does', t => {
  assert.deepEqual(check(entries, withSkill(t, '---\nname: "\\x1b[31mtdd\\x1b[0m\\x1b]0;title\\x07"\ndescription: x\n---\n')), []);
});
