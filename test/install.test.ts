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

test('splits one source with different refs into two commands', () => {
  const argv = commands([entry('x', 'o/r', {ref: 'v1'}), entry('y', 'o/r', {ref: 'v2'})], ROOT);
  assert.deepEqual(argv.map(item => item[3]), ['o/r#v1', 'o/r#v2']);
});

// The skills CLI reads `owner/repo@x` as a skill filter unless x is a full version or a commit SHA, so a branch or a
// short tag after @ installs the default branch. `#<ref>` is a checkout ref in every case (vercel-labs/skills
// src/source-parser.ts). These tests pin that form.
test('pins a branch with #, never with @', () => {
  assert.equal(location(entry('x', 'o/r', {ref: 'canary'}), ROOT), 'o/r#canary');
});

test('pins a short tag with #', () => {
  assert.equal(location(entry('x', 'o/r', {ref: 'v1'}), ROOT), 'o/r#v1');
});

test('encodes a branch name with a slash', () => {
  assert.equal(location(entry('x', 'o/r', {ref: 'feature/test'}), ROOT), 'o/r#feature%2Ftest');
});

test('pins a ref on an entry with a path', () => {
  assert.equal(location(entry('x', 'o/r', {path: 'skills', ref: 'canary'}), ROOT), 'o/r/skills#canary');
});

test('never puts a ref after @', () => {
  for (const ref of ['canary', 'v1', 'v1.2.3', 'feature/test']) {
    assert.doesNotMatch(location(entry('x', 'o/r', {ref}), ROOT), /@/);
    assert.doesNotMatch(location(entry('x', 'o/r', {path: 'p', ref}), ROOT), /@/);
  }
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

test('rejects a local entry without a path', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'x', source: 'local'}]}), /path/);
});

test('rejects a fork entry when cursor-harness is not listed', () => {
  assert.throws(() => parseManifest({skills: [fork('arena')]}), /cursor-harness/);
});

test('accepts a fork entry with cursor-harness listed', () => {
  assert.equal(parseManifest({skills: [fork('arena'), fork('cursor-harness')]}).length, 2);
});
