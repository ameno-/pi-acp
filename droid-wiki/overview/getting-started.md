# Getting started

## Prerequisites

- **Node.js 20 or later.** `./package.json` declares `"engines": { "node": ">=20" }`. The TypeScript build target is ES2022; `tsup` emits a single `node22` ESM bundle to `dist/index.js` with a shebang banner.
- **npm 10 or later.** `package-lock.json` is committed; `npm ci` is the cleanest install. devDependencies include `@types/node@^22`, `tsx@^4`, `tsup@^8`, `eslint@^9`, `typescript@^5.6`, `typescript-eslint@^8`.
- **`pi` on `PATH`.** The adapter spawns `pi --mode rpc` once per ACP session. Install with `npm install -g @mariozechner/pi-coding-agent` and verify:

  ```bash
  pi --version
  ```

  Override the executable name with `PI_ACP_PI_COMMAND` (used in `test/unit/new-session-pi-not-found.test.ts` to point at a non-existent binary).
- **Provider auth configured for `pi`.** Either `~/.pi/agent/auth.json` (OAuth credentials), `~/.pi/agent/models.json` with a non-empty `providers.*.apiKey`, or one of the env vars listed in `src/pi-auth/status.ts` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.). Without one, `pi-acp` rejects `session/new` with `auth_required` and the Terminal-Auth method, which in Zed renders as the "Authenticate" banner that launches `pi-acp --terminal-login`.
- **An ACP client.** Today that is [Zed](https://zed.dev) (see [External references](#external-references)). Other ACP clients may or may not advertise the `terminal-auth` meta block or the `unstable_*` capabilities used here.

## Install

### From source (recommended for development)

```bash
git clone https://github.com/svkozak/pi-acp.git
cd pi-acp
npm install
npm run build
```

The `prepublishOnly` hook is `npm run test && npm run build`, so building from source gives you the exact artifact that ships to npm.

### Globally from npm

```bash
npm install -g pi-acp
```

This installs `pi-acp` (the bin) and the same `dist/index.js` shipped in the package. The `bin` field is `"pi-acp": "dist/index.js"`; the build banner turns it into an executable script directly.

### One-shot, no install (Zed `npx`)

```bash
npx -y pi-acp
```

This works because the published package ships with a working `dist/`.

## Configure your client

### Zed (current ACP client)

Zed's external-agent config takes a `command` plus `args`. Add this to `settings.json` (Settings → Open Settings → JSON):

#### Using `npx` (always loads the latest published version)

```json
{
  "agent_servers": {
    "pi": {
      "type": "custom",
      "command": "npx",
      "args": ["-y", "pi-acp"],
      "env": {
        "PI_ACP_STARTUP_INFO": "true"
      }
    }
  }
}
```

#### Global install

```json
{
  "agent_servers": {
    "pi": {
      "type": "custom",
      "command": "pi-acp",
      "args": [],
      "env": {}
    }
  }
}
```

#### From source (point Zed at the built bundle)

```json
{
  "agent_servers": {
    "pi": {
      "type": "custom",
      "command": "node",
      "args": ["/path/to/pi-acp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Other ACP clients

Clients that respect ACP JSON-RPC over stdio can launch the same `node /path/to/pi-acp/dist/index.js`. The adapter currently advertises:

- `loadSession: true`
- `mcpCapabilities: { http: false, sse: false }` (no MCP server passthrough — by design)
- `promptCapabilities: { image: true, audio: false, embeddedContext: false }`
- `sessionCapabilities.list/resume/fork` (UNSTABLE; relies on each client's `unstable_*` namespace)
- `authMethods: [{id: 'pi_terminal_login', ...}]` with `_meta["terminal-auth"]` when the client opts in via `clientCapabilities._meta["terminal-auth"]`

## Run the adapter

### stdio mode (default — what an ACP client invokes)

```bash
node dist/index.js
# or
pi-acp
# or
npx -y pi-acp
```

The adapter takes over stdin/stdout and speaks NDJSON-RPC. There is no console UI.

### Websocket mode (experimental)

```bash
node dist/index.js --ws --host=127.0.0.1 --port=8765
# or with env vars
PI_ACP_WS_HOST=127.0.0.1 PI_ACP_WS_PORT=8765 node dist/index.js --ws
```

`startWsServer` (`src/server/ws.ts`) opens an HTTP server on the same host/port with a `/health` endpoint:

```bash
curl http://127.0.0.1:8765/health
# {"status":"healthy","connections":0,"maxConnections":10,"uptime":3,"timestamp":"..."}
```

Limits: `MAX_CONNECTIONS=10`, `IDLE_TIMEOUT_MS=5min`, `PING_INTERVAL_MS=30s`, `PONG_TIMEOUT_MS=10s`, `RATE_LIMIT_MESSAGES=100`/`RATE_LIMIT_WINDOW_MS=60s`. The server logs `Connection closed` / `Max connections reached` to stderr.

### Terminal login (auth bootstrap)

```bash
pi-acp --terminal-login
```

This runs `spawnSync('pi', [], { stdio: 'inherit' })`. The ACP client invokes it indirectly when the user clicks the "Authenticate" banner — Zed spawns a daemon process for the banner that pipes `pi`'s stdio to its terminal.

## Smoke test (local sanity check)

`scripts/smoke-acp.mjs` spawns `node dist/index.js`, sends an `initialize` + `session/new` + `session/prompt`, prints whatever the adapter emits, then SIGTERM's the process:

```bash
npm run smoke
```

There are ten `scripts/smoke-*.mjs` in total: `smoke-acp`, `smoke-acp-load` (full `session/load` cycle), `smoke-changelog`, `smoke-compact`, `smoke-export`, `smoke-modes` (thinking-level switch), `smoke-newsession-intro` (startup-info block before any prompt), `smoke-queue`, `smoke-session`, `smoke-startupinfo`. None are wired into the `npm run smoke` aggregate by default — invoke them directly with `node scripts/smoke-<name>.mjs`.

## Per-script commands

| Path | Command | What it does |
| --- | --- | --- |
| `./package.json` | `npm run dev` | `tsx src/index.ts` — run from source without bundling. |
| `./package.json` | `npm run build` | `tsup` — emits `dist/index.js` (ESM, `node22`, shebang, sourcemap). |
| `./package.json` | `npm run start` | `node dist/index.js` — run the bundled artifact. |
| `./package.json` | `npm run typecheck` | `tsc --noEmit` against `tsconfig.json` (strict). |
| `./package.json` | `npm run lint` | `eslint .` — `typescript-eslint` recommended + `no-unused-vars: [error, {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}]`. |
| `./package.json` | `npm run test` | `node --import tsx --test test/**/*.test.ts` — runs both `test/unit/*.test.ts` and `test/component/*.test.ts`. |
| `./package.json` | `npm run smoke` | `node scripts/smoke-acp.mjs` — handshake + first prompt. |
| `./package.json` | `npm run prepack` | `npm run build`. |
| `./package.json` | `npm run prepublishOnly` | `npm run test && npm run build`. |

## Environment variables

| Var | Default | Effect |
| --- | --- | --- |
| `PI_ACP_PI_COMMAND` | `pi` | Executable name/path for `pi --mode rpc`. Used by `newSession`, `loadSession`, and `forkSession`. |
| `PI_ACP_STARTUP_INFO` | `true` | Emit the markdown "startup info" block (`pi` version, context, skills, prompts, extensions) as the first chunk of the first prompt and as `_meta.piAcp.startupInfo` on `session/new`. Set `false` to disable. |
| `PI_ACP_WS_HOST` | `127.0.0.1` | Listen host in `--ws` mode. |
| `PI_ACP_WS_PORT` | `8765` | Listen port in `--ws` mode. |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent` | Override the pi agent directory. Used by `getPiAgentDir`, `listPiSessions`, `getEnableSkillCommands`, and the smoke tests for hermetic fixtures. |

## External references

- ACP spec: <https://agentclientprotocol.com/get-started/introduction>
- Zed external agents: <https://zed.dev/docs/agents/external-agents/>
- Zed release notes for session history (`v0.225.0`): <https://zed.dev/releases/preview/0.225.0>
- pi coding agent: <https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent>
- pi-mcp-adapter (separate, for MCP server passthrough): <https://github.com/nicobailon/pi-mcp-adapter>
