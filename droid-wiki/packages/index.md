# Packages

`pi-acp` ships as a single npm package, `pi-acp`, not a workspace. `package.json` declares `"main": "dist/index.js"` and `"bin": { "pi-acp": "dist/index.js" }`. Inside the package the code is organized by responsibility — not as separate packages, but as nested source directories whose boundaries the README and `AGENTS.md` describe explicitly.

## `pi-acp` (the only package)

ACP adapter for the `pi` coding agent. Exposes a CLI binary `pi-acp` and a library-style entry `dist/index.js`. The library entry is the stdio-mode ACP server (no public class is exported from the package root — consumers use the binary). Inside the source layout:

## `src/acp/*` — ACP-facing code

Anything that imports `@agentclientprotocol/sdk` lives here. The most important file is `agent.ts` (`PiAcpAgent implements ACPAgent`); supporting files are `session.ts`, `session-store.ts`, `pi-sessions.ts`, `slash-commands.ts`, `pi-commands.ts`, `pi-settings.ts`, `auth.ts`, `auth-required.ts`, `protocol.ts`, `errors.ts`, `paths.ts`, and the `translate/` subdirectory.

| File | Key exports | Notes |
| --- | --- | --- |
| `agent.ts` | `PiAcpAgent` (default export-style class; the only class implementing `ACPAgent`) | Wires `initialize`, `newSession`, `loadSession`, `unstable_resumeSession`, `unstable_listSessions`, `unstable_forkSession`, `prompt`, `cancel`, `setSessionMode`, `unstable_setSessionModel`, `authenticate`. Hosts `builtinAvailableCommands`, `mergeCommands`, `buildStartupInfo`. |
| `session.ts` | `SessionManager`, `PiAcpSession`, `StopReason` | Owns the in-memory turn queue, tool-call status map, edit snapshots, and `session/update` serializer. |
| `session-store.ts` | `SessionStore`, `StoredSession` | Persists `~/.pi/pi-acp/session-map.json`. |
| `pi-sessions.ts` | `PiSessionListItem`, `listPiSessions`, `findPiSessionFile`, `getPiSessionsDir` | Scans pi's JSONL files with a 1-line head + 256 KiB tail. |
| `slash-commands.ts` | `FileSlashCommand`, `loadSlashCommands`, `parseCommandArgs`, `substituteArgs`, `expandSlashCommand`, `toAvailableCommands` | Mirrors pi's terminal slash-command semantics. |
| `pi-commands.ts` | `PiRpcCommandInfo`, `toAvailableCommandsFromPiGetCommands` | Translates pi's `get_commands` response to ACP `AvailableCommand[]`. |
| `pi-settings.ts` | `getAgentDir`, `getEnableSkillCommands` | Reads `<agentDir>/settings.json` and `<cwd>/.pi/settings.json`. |
| `auth.ts` | `PI_SETUP_METHOD_ID`, `getAuthMethods` | Terminal Auth method with optional Zed `_meta["terminal-auth"]` block. |
| `auth-required.ts` | `maybeAuthRequiredError` | Substring-based detector for missing-credential errors. |
| `protocol.ts` | `ACPMethods`, `ACPMethod`, `ErrorCode` | Wire-visible method names and JSON-RPC + ACP error codes. |
| `errors.ts` | `ACPError`, `InvalidParamsError`, `InternalError`, `AuthRequiredError`, `MethodNotFoundError`, `ErrorCodes`, type guards | JSON-RPC 2.0 + ACP error shapes; `toJSON()` returns wire-compatible `{ code, message, data? }`. |
| `paths.ts` | `getPiAcpDir`, `getPiAcpSessionMapPath` | Adapter state lives under `~/.pi/pi-acp/`, separate from pi's `~/.pi/agent/`. |
| `translate/pi-messages.ts` | `normalizePiMessageText`, `normalizePiAssistantText` | Collapse pi content blocks into a single string. |
| `translate/pi-tools.ts` | `toolResultToText` | Pulls text out of pi tool results (`content[]`, `details.{stdout, stderr, exitCode, diff}`, JSON fallback). |
| `translate/prompt.ts` | `PiImage`, `promptToPiMessage` | ACP `ContentBlock[]` → `{message, images}`. |

## `src/pi-rpc/*` — Pi subprocess wrapper

`src/pi-rpc/process.ts` is the only file in this directory. Exports `PiRpcProcess`, `PiRpcSpawnError`, `PiRpcEvent`. Spawns `pi --mode rpc` (plus `--session <path>` for `loadSession`/`forkSession`), owns the `pending: Map<id, {resolve, reject}>` correlation table for NDJSON requests/responses, and exposes typed helpers for every command (`prompt`, `abort`, `getState`, `getAvailableModels`, `setModel`, `setThinkingLevel`, `setFollowUpMode`, `setSteeringMode`, `compact`, `setAutoCompaction`, `getSessionStats`, `setSessionName`, `exportHtml`, `switchSession`, `getMessages`, `getCommands`).

## `src/pi-auth/*` — Auth detection

`src/pi-auth/status.ts` exports `hasAnyPiAuthConfigured()` and `getPiAgentDir()`. The check covers `auth.json` (non-empty), `models.json` `providers.*.apiKey`, and a list of provider env vars. `getPiAgentDir()` honors `PI_CODING_AGENT_DIR` (with `~` expansion). Used by `PiAcpAgent.newSession` to short-circuit before spawning pi when no auth is available.

## `src/server/*` — Websocket transport

`src/server/ws.ts` exports `startWsServer({host, port})`, `connections`, `MAX_CONNECTIONS`, `IDLE_TIMEOUT_MS`, `PING_INTERVAL_MS`, `PONG_TIMEOUT_MS`. Wraps `ws.WebSocketServer` and an `http.Server` (for `/health`), wires each connection into `new AgentSideConnection((conn) => new PiAcpAgent(conn), stream)`, and enforces ping/pong, idle close, rate limiting, and a connection cap.

## `src/index.ts` — Process entry

Dispatches on `process.argv`:

- `--terminal-login` → `spawnSync('pi', [], { stdio: 'inherit' })` for ACP Registry Terminal Auth.
- `--ws` → `startWsServer({host, port})` with `--host=`/`--port=` flags or `PI_ACP_WS_HOST`/`PI_ACP_WS_PORT` env vars.
- otherwise → stdio mode: `ndJsonStream(input, output)` over `process.stdin` / `process.stdout`, `new AgentSideConnection((conn) => new PiAcpAgent(conn), stream)`. Catches `ERR_STREAM_DESTROYED` on the writable side and registers `SIGINT`/`SIGTERM` handlers that `process.exit(0)` cleanly.

## Bin

`pi-acp` (registered via `package.json:bin`). Built from `src/index.ts` by `tsup` (`tsup.config.ts`) — single ESM file with a shebang, `node22` target, sourcemap, no minify, no dts.

## Adapters and consumers

The `pi-acp` source is not designed as a library other than through its CLI; downstream projects that want to reuse `PiAcpAgent` in their own transport would import from `dist/index.js` (or directly from `src/acp/agent.ts` via `tsx`). There is no `@pi-acp/...` namespace, no workspace declaration (`packages/*` is not in `workspaces`), and no second npm package.

### Pinning and installing

```bash
# Pin a major version in your client config (Zed `settings.json`)
"command": "npx",
"args": ["-y", "pi-acp@^0"]

# Or install globally
npm install -g pi-acp
pi-acp --version
```
