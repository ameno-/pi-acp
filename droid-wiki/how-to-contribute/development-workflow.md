# Development workflow

## Branch

Branch off `main`. The `pi-acp` repo's `AGENTS.md` says: **"DO NOT commit unless explicitly asked!"** — open a PR; ask the maintainer to merge.

```bash
git checkout main
git pull --rebase
git checkout -b <short-name>
```

## Code

- Place adapter code under `src/acp/` (ACP-facing) or `src/pi-rpc/` (subprocess wrapper).
- Keep protocol types in `src/acp/protocol.ts`; keep error classes in `src/acp/errors.ts`.
- Place translation helpers in `src/acp/translate/` (`pi-messages.ts`, `pi-tools.ts`, `prompt.ts`).
- Place tests under `test/unit/` (pure logic) or `test/component/` (needs `FakeAgentSideConnection` / `FakePiRpcProcess`).
- Place smoke scripts under `scripts/smoke-<feature>.mjs`.
- Use full repo-root paths in commit messages and PR descriptions (`src/acp/agent.ts`, not "the agent file").

## Test

Run the test suite before pushing:

```bash
npm run test
```

This runs `node --import tsx --test test/**/*.test.ts`. Both `test/unit/*.test.ts` and `test/component/*.test.ts` are included. See [Testing](testing.md) for the matrix.

For a single file:

```bash
node --import tsx --test test/component/session-diff.test.ts
```

For a single named test:

```bash
node --import tsx --test --test-name-pattern='emits ACP diff' test/component/session-diff.test.ts
```

## Typecheck and lint

```bash
npm run typecheck
npm run lint
```

`typecheck` is `tsc --noEmit` against `tsconfig.json` (`strict: true`, ES2022, ESM, Node types). `lint` is `eslint .` with `typescript-eslint` recommended plus a permissive `no-unused-vars` rule (`{argsIgnorePattern: '^_', varsIgnorePattern: '^_'}`). `no-explicit-any` is off (the `AGENTS.md` keeps ACP handler code lean).

## Build

```bash
npm run build
```

This runs `tsup` (`tsup.config.ts`): single entry `src/index.ts`, ESM, `node22` target, sourcemap on, no minify, no dts, `#!/usr/bin/env node` banner injected into `dist/index.js`. `clean: true` wipes the previous `dist/`.

## Smoke test

```bash
npm run smoke
```

The default aggregate (`scripts/smoke-acp.mjs`) builds, spawns `node dist/index.js`, sends `initialize` + `session/new` + `session/prompt`, prints whatever the adapter emits, and SIGTERMs the child once `session/prompt` resolves. Other smoke scripts:

```bash
node scripts/smoke-newsession-intro.mjs   # startup info before any prompt
node scripts/smoke-acp-load.mjs          # full session/load cycle
node scripts/smoke-changelog.mjs         # /changelog built-in
node scripts/smoke-compact.mjs           # /compact
node scripts/smoke-export.mjs            # /export
node scripts/smoke-modes.mjs             # setSessionMode -> pi setThinkingLevel
node scripts/smoke-queue.mjs             # /queue built-in
node scripts/smoke-session.mjs           # /session stats
node scripts/smoke-startupinfo.mjs       # startup info emitted as first chunk
```

Each smoke requires `pi` on `PATH` with some provider configured. None are aggregated under `npm run smoke`; invoke them by name.

## Dev loop without rebuilding

```bash
npm run dev
```

`tsx src/index.ts` runs the source directly. Useful when you want to attach a debugger to the un-bundled module graph.

## PR

```bash
git push -u origin <branch>
```

Open the PR with a one-paragraph summary, the GitHub issue it closes (if any), and a list of test commands you ran locally (`npm run typecheck && npm run lint && npm run test && npm run smoke`).

## Merge

No CI workflow is configured to gate merges — `.github/workflows/` only ships `github-release.yml` and `npm-publish.yml`. Reviewers must run the workspace commands locally before approval:

```bash
npm run typecheck
npm run lint
npm run test
```

The `prepublishOnly` hook enforces the same gates, so a green `npm publish --dry-run` is a meaningful proxy for "tests + build passed".
