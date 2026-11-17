# Skills

Agent skills for Codex and Claude Code. Each skill installs from its original source into `~/.agents/skills` (Codex), with a link in `~/.claude/skills` (Claude Code).

## Use

Needs Node 26 or later and `npx`. Run `npm ci` once after you clone: `skills-check` reads `SKILL.md` with the same `yaml` version as the installer. The installer runs the `skills` CLI at a pinned version (`CLI` in `src/install.ts`); raise it by hand.

```sh
bin/skills-install          # print the install commands
bin/skills-install --run    # run them, one source at a time; stops at the first failure
bin/skills-check            # confirm that both agents see every skill
```

`skills-check` reports, for each skill in `manifest.json`:

- `missing-agents`: not in `~/.agents/skills`, so Codex cannot load it.
- `bad-skill-file`: the installer would skip its `SKILL.md` (unreadable, invalid YAML, or a missing or empty `name` or `description`), or its `name` is not the manifest name.
- `missing-claude`: not in `~/.claude/skills`, so Claude Code cannot load it.
- `plain-folder`: a folder in `~/.claude/skills` instead of a link. Remove the folder and install again.
- `wrong-target`: the link points somewhere other than `~/.agents/skills`.
- `unlisted`: a skill in `~/.agents/skills` that `manifest.json` does not list.

## Skills

| Group | Skills | Source |
| --- | --- | --- |
| Plan | grill-with-docs, to-spec, to-tickets, wayfinder, triage, domain-modeling, codebase-design, improve-codebase-architecture, prototype, research, setup-matt-pocock-skills, ask-matt | mattpocock/skills |
| Build | implement, tdd | mattpocock/skills |
| Build | resolving-merge-conflicts | this repo |
| Review | code-review | mattpocock/skills |
| Review | blast-radius, interrogate, arena, in-your-own-words, verify-this, how, why | justinvandenberg/plugins (`agents-harness/skills`) |
| PRs | pr | mattpocock/skills |
| PRs | make-pr-easy-to-review, loop-on-ci, get-pr-comments, fix-ci, review-and-ship | justinvandenberg/plugins (`agents-harness/skills`) |
| Debug | diagnosing-bugs | mattpocock/skills |
| Writing | handoff, writing-for-agents | mattpocock/skills |
| Writing | unslop | justinvandenberg/plugins (`agents-harness/skills`) |
| Writing | simplified-technical-english | 0xpili/simplified-technical-english |
| Tools | orca-cli, orchestration, orca-computer-use | stablyai/orca |
| Tools | archify | tt-a1i/archify |
| Tools | wizard | mattpocock/skills |
| Tools | find-skills | vercel-labs/skills |
| Tools | playwright-cli | microsoft/playwright-cli |
| Technology | trigger-authoring-tasks, trigger-cost-savings, trigger-getting-started, trigger-realtime-and-frontend | triggerdotdev/trigger.dev (`packages/cli-v3/skills`) |
| Technology | vercel-composition-patterns, vercel-react-best-practices, vercel-react-native-skills, web-design-guidelines | vercel-labs/agent-skills |
| Technology | typescript-best-practices | justinvandenberg/plugins (`agents-harness/skills`) |
| Technology | logging-best-practices | boristane/agent-skills |
| Technology | effect-ts | Effect-TS/skills |
| Memory | correct, recall, show-me-your-work | justinvandenberg/plugins (`agents-harness/skills`) |
| Memory | retro | mattpocock/skills |
| Harness | cursor-harness, principle-type-system-discipline, principle-boundary-discipline, principle-encode-lessons-in-structure, principle-prove-it-works, principle-redesign-from-first-principles, principle-separate-before-serializing-shared-state | justinvandenberg/plugins (`agents-harness/skills`) |

The skills from [justinvandenberg/plugins](https://github.com/justinvandenberg/plugins) are pstack and cursor-team-kit skills from [cursor/plugins](https://github.com/cursor/plugins), built to run outside Cursor. Each one that uses a Cursor name points to `cursor-harness`, which maps those names to Codex or Claude Code. That is why `cursor-harness` is required. The `principle-*` skills are required too: arena, show-me-your-work, and typescript-best-practices tell the agent to apply them.

## Add a skill

1. Add an entry to `manifest.json`: `group`, `name`, `source` (`owner/repo`, or `local` for a folder in `skills/`), and an optional `path`. Remote skills install from the source's default branch.
2. Run `npm test`, then `bin/skills-install --run` and `bin/skills-check`.

## Rules

- Every skill must load in Codex and Claude Code.
- Take each skill from its original source. Fork a source only when a skill must change to run in both agents.
- No skill or file here names a client, a project, or a teammate.

See [NOTICE.md](NOTICE.md) for the copied skill and its license.
