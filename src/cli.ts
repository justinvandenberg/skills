// `skills-install` prints (or with --run, runs) the install commands; `skills-check` proves each skill is visible to
// both agents.

import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {check, EXPLAIN} from './check.ts';
import {commands} from './install.ts';
import {loadManifest, ManifestError} from './manifest.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const quote = (arg: string) => /^[\w@./:=-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;

export function install(argv: string[]): number {
  const list = commands(loadManifest(join(ROOT, 'manifest.json')), ROOT);
  if (!argv.includes('--run')) {
    for (const command of list) console.log(command.map(quote).join(' '));
    console.log(`\n${list.length} commands. Run them with: skills-install --run`);
    return 0;
  }
  for (const [index, command] of list.entries()) {
    console.log(`\n[${index + 1}/${list.length}] ${command.map(quote).join(' ')}`);
    const result = spawnSync(command[0], command.slice(1), {stdio: 'inherit'});
    if (result.status !== 0) {
      console.error(`\nStopped: command ${index + 1} failed (exit ${result.status ?? result.signal}). Fix it, then run again.`);
      return 1;
    }
  }
  console.log('\nAll commands finished. Run skills-check to confirm both agents see every skill.');
  return 0;
}

export function verify(): number {
  const problems = check(loadManifest(join(ROOT, 'manifest.json')), process.env.SKILLS_HOME ?? homedir());
  for (const {name, kind} of problems) console.log(`${name}: ${EXPLAIN[kind]}`);
  console.log(problems.length ? `\n${problems.length} problems.` : 'Every manifest skill is visible to Codex and Claude Code.');
  return problems.length ? 1 : 0;
}

if (import.meta.main) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    process.exitCode = command === 'install' ? install(rest) : command === 'check' ? verify() : (console.error('Usage: cli.ts install [--run] | check'), 2);
  } catch (error) {
    if (!(error instanceof ManifestError)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}
