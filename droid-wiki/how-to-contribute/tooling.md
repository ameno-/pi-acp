# Tooling

## Build

- **TypeScript bundler.** `tsup` is the only bundler. `tsup.config.ts` declares `entry: ['src/index.ts']`, `format: ['esm']`, `platform: 'node'`, `target: 'node22'`, `sourcemap: true`, `clean: true`, `dts: false`, `minify: false`, `banner: { js: '#!/usr/bin/env node' }`. The output is a single `dist/index.js`; there is no per-file mapping, no public exports — the `bin` field in `package.json` is just `dist/index.js`.
- **TypeScript compiler.** `tsc --noEmit` is the typecheck (`npm run typecheck`). `tsconfig.json` uses `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `lib: ['ES2022']`, `types: ['node']`, `esModuleInterop: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`. Output goes to `dist/` (used by `tsup`); the build is **not** `tsc -b`, it's `tsup` which then keeps the JS in `dist/`.

## Linters and formatters

- **ESLint 9** with `typescript-eslint@^8.18.0` recommended config. The flat config in `eslint.config.js`:
  - Ignores `dist/`, `node_modules/`, `.dist/`, `.dist-cache/`.
  - `@eslint/js` recommended rules.
  - `globals.node` + `sourceType: 'module'`.
  - `typescript-eslint` recommended (no type-checking variant).
  - Project-specific: `no-console: off` (the websocket server prints to stderr), `@typescript-eslint/no-explicit-any: off` (the ACP handler chain needs it), `@typescript-eslint/no-unused-vars: [error, {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}]`.
- **Prettier.** `.prettierrc.mjs` declares `trailingComma: 'none'`, `tabWidth: 2`, `semi: false`, `bracketSpacing: true`, `printWidth: 120`, `singleQuote: true`, `singleAttributePerLine: true`, `arrowParens: 'avoid'`. There is no `prettier` script in `package.json`; `.prettierignore` is committed (empty body other than the preamble). Run `npx prettier --check .` if you want the format gate locally.

## Test runner

- **`node --test`** is the only test runner used by `npm run test`. The command is `node --import tsx --test test/**/*.test.ts` — `tsx` is the ESM/TS loader, and `**/*.test.ts` is expanded by the shell to all test files. Node 22's `--watch` flag is supported (e.g. `node --import tsx --test --watch test/unit/foo.test.ts`).
- **No third-party mocking library.** `test/helpers/fakes.ts` is the source of truth for fakes. The shape:

  ```typescript
  export class FakeAgentSideConnection {
    readonly updates: SessionUpdateMsg[] = []
    async sessionUpdate(msg: SessionUpdateMsg): Promise<void> { this.updates.push(msg) }
  }

  export class FakePiRpcProcess {
    private handlers: Array<(ev: PiRpcEvent) => void> = []
    readonly prompts: Array<{ message: string; attachments: unknown[] }> = []
    abortCount = 0
    onEvent(handler) { /* … */ return () => { /* … */ } }
    emit(ev) { for (const h of this.handlers) h(ev) }
    async prompt(message, attachments = []) { this.prompts.push({ message, attachments }) }
    async abort() { this.abortCount += 1 }
    async getState() { return {} }
    async getAvailableModels() { return { models: [{ provider: 'test', id: 'model', name: 'model' }] } }
    async getMessages() { return { messages: [] } }
  }

  export function asAgentConn(conn: FakeAgentSideConnection): AgentSideConnection {
    return conn as unknown as AgentSideConnection
  }
  ```

  When a test needs methods that `FakePiRpcProcess` doesn't implement, it monkey-patches the instance (e.g. `proc.getState = async () => ({ steeringMode: 'one-at-a-time' })`).

## Smoke scripts

- **`scripts/smoke-*.mjs` (10 files)** are raw Node scripts that spawn the bundled `dist/index.js`, send JSON-RPC over stdio, and assert. They each rebuild the project before running (so they're slightly slow but always exercise the artifact that's actually published):

  ```javascript
  await new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', 'build'], { stdio: 'inherit', cwd })
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`build failed: ${code}`))))
  })
  ```

  None are aggregated under `npm run smoke`; only `smoke-acp.mjs` is wired to the `smoke` script in `package.json`.

## Issue tracker

- **GitHub issues** at <https://github.com/svkozak/pi-acp/issues>. The repo does not use Beads (`bd`); there is no `.beads/` directory. The upstream maintainer is `Sergii Kozak <svkozak@gmail.com>` (per `package.json`'s `author` field) but commits in this snapshot were authored by `Ameno Osman <ameno.osman13@gmail.com>`.

## CI

- **GitHub Actions** has two workflows, both unconditional (no `if: ${{ false }}` flip):
  - `.github/workflows/github-release.yml` — release on tag push.
  - `.github/workflows/npm-publish.yml` — publish to npm on release.
- **No `lint`/`test` CI workflow is committed.** Reviewers run `npm run typecheck && npm run lint && npm run test` locally; `prepublishOnly` (`npm run test && npm run build`) is the closest thing to a CI gate.

## Websocket debug surface

- `src/server/ws.ts` prints to stdout (not stderr) for connect/disconnect/overload/rate-limit/pong-timeout. Lines look like `[ws] New connection conn_1_abc123 from ::1. Total: 1` and `[ws] Max connections (10) reached. Rejecting new connection.`. Capture with `node dist/index.js --ws 2>ws.log` — but stderr is the actual stream for the runtime logs.
- `GET /health` returns `{status, connections, maxConnections, uptime, timestamp}` JSON. Hit it with `curl http://127.0.0.1:8765/health`.
- `RATE_LIMIT_MESSAGES=100`, `RATE_LIMIT_WINDOW_MS=60000`, `IDLE_TIMEOUT_MS=300000`, `PING_INTERVAL_MS=30000`, `PONG_TIMEOUT_MS=10000`, `MAX_CONNECTIONS=10` are hard-coded constants in `src/server/ws.ts`. There is no env override; recompile to change.

## Local helpers

- **Run a single test file in watch mode.** `node --import tsx --test --watch test/component/session-events.test.ts`. Node 22+ required.
- **Send raw JSON-RPC to the adapter.** `node dist/index.js` then pipe JSON to stdin:

  ```bash
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}' \
    | node dist/index.js
  ```

  For more realistic traffic, copy `scripts/smoke-acp.mjs` and adapt it.
- **Override the pi binary.** `PI_ACP_PI_COMMAND=/path/to/test-pi node dist/index.js`. Used by `test/unit/new-session-pi-not-found.test.ts`.
- **Override the pi data dir.** `PI_CODING_AGENT_DIR=/tmp/hermetic-pi node dist/index.js`. The adapter reads sessions, models, and auth from this path; useful for hermetic smoke runs.

### One-shot smoke invocation

```bash
# Build + handshake + first prompt against the bundled artifact. Requires `pi` on PATH.
npm run smoke

# Or invoke a specific smoke script (startup info before any prompt, full session/load, etc.)
node scripts/smoke-newsession-intro.mjs
node scripts/smoke-acp-load.mjs
node scripts/smoke-modes.mjs
```
