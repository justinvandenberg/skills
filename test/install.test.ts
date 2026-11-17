import test from 'node:test';
import assert from 'node:assert/strict';
import {commands, location} from '../src/install.ts';
import {ManifestError, parseManifest, type Entry} from '../src/manifest.ts';

const ROOT = '/repo';
const FLAGS = ['-g', '-a', 'codex', 'claude-code', '-y'];
const entry = (name: string, source: string, extra: Partial<Entry> = {}): Entry => ({group: 'g', name, source, ...extra});
const fork = (name: string): Entry => entry(name, 'justinvandenberg/plugins', {path: 'agents-harness/skills'});

test('groups names with the same location into one add command', () => {
  const argv = commands([entry('tdd', 'mattpocock/skills'), entry('triage', 'mattpocock/skills')], ROOT);
  assert.deepEqual(argv, [['npx', 'skills@latest', 'add', 'mattpocock/skills', ...FLAGS, '--skill', 'tdd', 'triage']]);
});

test('uses owner/repo/path for an entry with a path', () => {
  assert.equal(location(fork('arena'), ROOT), 'justinvandenberg/plugins/agents-harness/skills');
});

test('splits one source with different paths into two commands', () => {
  const argv = commands([entry('x', 'o/r', {path: 'a'}), entry('y', 'o/r', {path: 'b'})], ROOT);
  assert.deepEqual(argv.map(item => item[3]), ['o/r/a', 'o/r/b']);
});

test('installs a local entry from its folder in this repo', () => {
  const argv = commands([entry('resolving-merge-conflicts', 'local', {path: 'skills/resolving-merge-conflicts'})], ROOT);
  assert.equal(argv[0][3], '/repo/skills');
});

test('splits local entries with different parent folders', () => {
  const argv = commands([entry('x', 'local', {path: 'skills/x'}), entry('y', 'local', {path: 'vendor/y'})], ROOT);
  assert.deepEqual(argv.map(item => item[3]), ['/repo/skills', '/repo/vendor']);
});

test('always installs for codex and claude-code globally', () => {
  for (const argv of commands([entry('tdd', 'mattpocock/skills'), fork('arena'), fork('cursor-harness')], ROOT)) {
    assert.deepEqual(argv.slice(4, 9), FLAGS);
  }
});

test('keeps manifest order of first appearance', () => {
  const argv = commands([entry('a', 'o/one'), entry('b', 'o/two'), entry('c', 'o/one')], ROOT);
  assert.deepEqual(argv.map(item => item.slice(10)), [['a', 'c'], ['b']]);
});

test('installs cursor-harness with the other fork skills', () => {
  const argv = commands([fork('arena'), fork('cursor-harness')], ROOT);
  assert.deepEqual(argv[0].slice(10), ['arena', 'cursor-harness']);
});

const valid = {skills: [{group: 'g', name: 'tdd', source: 'mattpocock/skills'}]};

test('parses a valid manifest', () => {
  assert.deepEqual(parseManifest(valid), valid.skills);
});

test('rejects a duplicate name', () => {
  assert.throws(() => parseManifest({skills: [...valid.skills, ...valid.skills]}), ManifestError);
});

test('rejects an unknown field', () => {
  assert.throws(() => parseManifest({skills: [{...valid.skills[0], extra: 1}]}), /extra/);
});

test('rejects a missing source', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'tdd'}]}), /source/);
});

test('rejects a ref, which the manifest does not support', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'x', source: 'o/r', ref: 'v1'}]}), /ref/);
});

test('rejects a local entry without a path', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'x', source: 'local'}]}), /path/);
});

test('rejects a fork entry when cursor-harness is not listed', () => {
  assert.throws(() => parseManifest({skills: [fork('arena')]}), /cursor-harness/);
});

test('accepts a fork entry with cursor-harness listed', () => {
  assert.equal(parseManifest({skills: [fork('arena'), fork('cursor-harness')]}).length, 2);
});
