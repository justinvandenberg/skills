import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {commands, location} from '../src/install.ts';
import {ManifestError, parseManifest, type Entry} from '../src/manifest.ts';

const ROOT = '/repo';
const FLAGS = ['-g', '-a', 'codex', 'claude-code', '-y'];
const entry = (name: string, source: string, extra: Partial<Entry> = {}): Entry => ({group: 'g', name, source, ...extra});
const fork = (name: string): Entry => entry(name, 'justinvandenberg/plugins', {path: 'agents-harness/skills'});

test('groups names with the same location into one add command', () => {
  const argv = commands([entry('tdd', 'mattpocock/skills'), entry('triage', 'mattpocock/skills')], ROOT);
  assert.deepEqual(argv, [['npx', 'skills@1.9.0', 'add', 'mattpocock/skills', ...FLAGS, '--skill', 'tdd', 'triage']]);
});

test('uses owner/repo/path for an entry with a path', () => {
  assert.equal(location(fork('arena'), ROOT), 'justinvandenberg/plugins/agents-harness/skills');
});

test('splits one source with different paths into two commands', () => {
  const argv = commands([entry('x', 'o/r', {path: 'a'}), entry('y', 'o/r', {path: 'b'})], ROOT);
  assert.deepEqual(argv.map(item => item[3]), ['o/r/a', 'o/r/b']);
});

test('installs Orca skills with the Orca CLI, at the version this Orca build ships', () => {
  const argv = commands([entry('orca-cli', 'orca'), entry('orchestration', 'orca'), entry('tdd', 'mattpocock/skills')], ROOT);
  assert.deepEqual(argv[0], ['orca', 'skills', 'install', '--agent', 'codex,claude-code', '--skill', 'orca-cli', '--skill', 'orchestration']);
  assert.equal(argv[1][3], 'mattpocock/skills');
});

test('accepts orca as a source without a path', () => {
  assert.equal(parseManifest({skills: [{group: 'g', name: 'orca-cli', source: 'orca'}]}).length, 1);
});

test('rejects an orca entry with a path', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'orca-cli', source: 'orca', path: 'skills'}]}), /orca/);
});

test('installs an archive entry from the GitHub archive, not a clone', () => {
  const argv = commands([entry('archify', 'tt-a1i/archify', {path: 'archify', archive: true})], ROOT);
  assert.equal(argv.length, 1);
  assert.deepEqual(argv[0].slice(0, 2), ['sh', '-c']);
  assert.match(argv[0][2], /curl -fsSL "https:\/\/codeload\.github\.com\/\$owner\/\$repo\/tar\.gz\/HEAD"/);
  assert.match(argv[0][2], /npx skills@1\.9\.0 add "\$dir\/\$sub" -g -a codex claude-code -y --skill "\$@"/);
  assert.match(argv[0][2], /trap 'rm -rf "\$dir"' EXIT/);
  assert.deepEqual(argv[0].slice(3), ['skills-archive', 'tt-a1i', 'archify', 'archify', 'archify']);
});

test('keeps manifest values out of the archive script text', () => {
  const path = '$(touch injected)`touch backtick`';
  const [argv] = commands([entry('x', 'o/r', {path, archive: true})], ROOT);
  assert.ok(!argv[2].includes('touch'), 'the script text holds no manifest value');
  assert.equal(argv[6], path);
});

test('runs the archive script without executing a path, with stub curl, tar, and npx', t => {
  const dir = mkdtempSync(join(tmpdir(), 'skills-archive-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  for (const name of ['curl', 'tar']) writeFileSync(join(bin, name), '#!/bin/sh\ncat >/dev/null 2>&1 || true\n', {mode: 0o755});
  writeFileSync(join(bin, 'npx'), `#!/bin/sh\nprintf '%s\\n' "$@" > '${join(dir, 'npx-args')}'\n`, {mode: 0o755});
  const path = '$(touch injected)`touch backtick`';
  const [argv] = commands([entry('x', 'o/r', {path, archive: true})], ROOT);
  const result = spawnSync(argv[0], argv.slice(1), {cwd: dir, env: {...process.env, PATH: `${bin}:${process.env.PATH}`}, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!existsSync(join(dir, 'injected')) && !existsSync(join(dir, 'backtick')), 'no command in the path ran');
  const args = readFileSync(join(dir, 'npx-args'), 'utf8').split('\n');
  assert.ok(args[2].endsWith(`/${path}`), args[2]);
  assert.deepEqual(args.slice(3, 11), ['-g', '-a', 'codex', 'claude-code', '-y', '--skill', 'x', '']);
});

test('keeps archive entries apart from clone entries of the same repo', () => {
  const argv = commands([entry('a', 'o/r', {path: 'p', archive: true}), entry('b', 'o/r', {path: 'p'})], ROOT);
  assert.equal(argv.length, 2);
});

test('rejects archive on a local or orca entry', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'x', source: 'local', path: 'skills/x', archive: true}]}), /archive/);
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'x', source: 'orca', archive: true}]}), /archive/);
});

test('rejects an archive value that is not true', () => {
  assert.throws(() => parseManifest({skills: [{group: 'g', name: 'x', source: 'o/r', archive: 'yes'}]}), /archive/);
});

test('installs a local entry from its folder in this repo', () => {
  const argv = commands([entry('resolving-merge-conflicts', 'local', {path: 'skills/resolving-merge-conflicts'})], ROOT);
  assert.equal(argv[0][3], '/repo/skills');
});

test('splits local entries with different parent folders', () => {
  const argv = commands([entry('x', 'local', {path: 'skills/x'}), entry('y', 'local', {path: 'vendor/y'})], ROOT);
  assert.deepEqual(argv.map(item => item[3]), ['/repo/skills', '/repo/vendor']);
});

test('pins the skills CLI to an exact version', () => {
  for (const argv of commands([entry('tdd', 'mattpocock/skills')], ROOT)) assert.match(argv[1], /^skills@\d+\.\d+\.\d+$/);
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
