# Patterns and conventions

## Style

- TypeScript with `strict: true` (see `tsconfig.json`). ESM only (`"type": "module"`). `tsup` emits a single ESM bundle with a `#!/usr/bin/env node` banner. The package binary is `pi-acp` (`bin` field in `package.json`).
- 2-space indent, `singleQuote: true`, `semi: false`, `printWidth: 120`, `trailingComma: 'none'`, `arrowParens: 'avoid'`. See `.prettierrc.mjs`. The repo does not wire a `prettier` script — `npm run lint` (eslint + `typescript-eslint`) is the only formatter-checked gate.
- Prefer small translation functions with explicit return shapes (`normalizePiAssistantText`, `promptToPiMessage`, `toolResultToText`) over catch-all `as any` casts. The eslint config currently has `no-explicit-any: off` because the ACP SDK handler chain needs it, but `src/acp/translate/*` is where you should reach for `any` only as a last resort.
- Comments document the *why*, not the *what*. `AGENTS.md` says: *"Avoid producing unnecessary comments! Use comments sparingly to explain non-obvious decisions, not to narrate code."*

## Module boundaries

- **ACP-facing code** lives under `src/acp/`. Anything that imports `@agentclientprotocol/sdk` belongs here.
- **Pi-subprocess wrapper** lives under `src/pi-rpc/`. `PiRpcProcess` is the only thing that touches `child_process.spawn`.
- **Auth detection** lives under `src/pi-auth/` — `hasAnyPiAuthConfigured()` is the only export.
- **Translation layer** (`src/acp/translate/`) is the single place that knows both ACP and pi shapes. If a new ACP block type appears, add it here first.
- **Websocket transport** lives in `src/server/ws.ts` and shares `PiAcpAgent` with stdio mode — `startWsServer` constructs the same `AgentSideConnection` over a websocket stream.

## Streaming and ordering

The session handler in `src/acp/session.ts` has three invariants to preserve when you add a new event type:

1. **Serialized emission.** `emit()` chains `lastEmit = lastEmit.then(() => conn.sessionUpdate(...))`. New emit calls must go through `emit()` (not `await conn.sessionUpdate` directly) so the order is preserved.
2. **Prompt resolution after flushing.** `agent_end` is the only place a prompt resolves. New "I'm done with the prompt" signals must `flushEmits().finally(() => …)` first.
3. **Monotonic tool-call status.** `currentToolCalls: Map<toolCallId, 'pending' | 'in_progress'>` prevents downgrade. New tool events must consult the map before deciding to emit `tool_call` vs `tool_call_update`.

## Error handling

- **`ACPError` and subclasses** (`src/acp/errors.ts`) carry a JSON-RPC `code` and an optional `data` payload. `toJSON()` returns `{code, message, data?}`. Type guards (`isACPError`, `isInvalidParamsError`, etc.) are exported.
- **Spawn failures** are wrapped in `PiRpcSpawnError` (typed `code?: string`) by `PiRpcProcess.spawn`. The agent converts `ENOENT` into `InternalError("Could not start pi: executable not found ...")` so the client gets a useful wire message.
- **Auth-required detection** is post-hoc: `maybeAuthRequiredError(err)` substring-matches common missing-credential messages (`api key`, `unauthorized`, `401`, `403`, etc.) and converts them into a typed `RequestError.authRequired(...)` so the client can re-offer Terminal Auth.
- **`stdout` write failures** are swallowed in `src/index.ts` because the client closing stdout is a normal teardown — crashing the adapter would close the pipeline before all `session/update` notifications are flushed. There is a regression test for this in `test/unit/stdout-destroyed-does-not-crash.test.ts`.

## File-based slash command conventions

`src/acp/slash-commands.ts` implements the same conventions pi's terminal uses:

- User: `~/.pi/agent/prompts/**/*.md` (recursive).
- Project: `<cwd>/.pi/prompts/**/*.md` (recursive).
- Subdirectories become `name:frontend` and surface as `(user:frontend)` / `(project:frontend)`.
- Frontmatter is parsed (`description: …`); if absent, the first non-blank line is used as the description, truncated to 60 chars with `…`.
- Argument substitution: `$1` ... `$9` for positional args, `$@` for everything. Bash-style quoting (`"a b"`, `'a b'`) is handled by `parseCommandArgs`.

The test `test/unit/slash-commands.test.ts` locks in `parseCommandArgs`, `substituteArgs`, `expandSlashCommand`, and `toAvailableCommands` (de-dupe by name, first wins).

## Built-in slash command conventions

`builtinAvailableCommands()` in `src/acp/agent.ts` is the single source of truth for adapter-side slash commands. Add a new built-in here, then add a corresponding branch to `PiAcpAgent.prompt` (or whatever method the command belongs to). Always:

- Return `{stopReason: 'end_turn'}` after handling the command so the ACP client closes the turn.
- Emit one or more `agent_message_chunk` updates via `this.conn.sessionUpdate(...)`.
- Update related state via `session_info_update` if the command changes display name, queue depth, etc.
- Keep the command cheap — these are headless-friendly; the user expects no LLM call.

`test/unit/builtin-commands.test.ts` covers `/steering` and `/name`. `test/component/agent-steering-followup-modes.test.ts` exercises the underlying `proc.setSteeringMode` / `proc.setFollowUpMode` calls.

## Auth gate conventions

When you add a new reason the adapter can't serve a session, prefer `AuthRequiredError` over `InternalError`:

```typescript
throw new AuthRequiredError(
  'Configure an API key or log in with an OAuth provider.',
  getAuthMethods()
)
```

`getAuthMethods()` always returns the Terminal-Auth method with the launch spec derived from `process.argv[0]`/`[1]` (so a `node /path/to/dist/index.js` invocation is reusable). The Zed `_meta["terminal-auth"]` block is gated on `clientCapabilities._meta["terminal-auth"] === true` so older clients without the meta are not exposed to it.

## Test conventions

- **Unit tests** (`test/unit/`) construct the function under test with plain inputs and assert outputs. Use `node:test` and `node:assert/strict`. Examples: `slash-commands.test.ts`, `pi-tools.test.ts`, `pi-messages.test.ts`, `prompt-to-pi-message.test.ts`, `pi-commands.test.ts`.
- **Component tests** (`test/component/`) wire `PiAcpSession` or `PiAcpAgent` with `FakeAgentSideConnection` and `FakePiRpcProcess` from `test/helpers/fakes.ts`. They assert on the recorded `updates` array. Examples: `session-events.test.ts`, `session-diff.test.ts`, `session-slash-commands.test.ts`, `session-queue-cancel.test.ts`.
- **Hermetic filesystem tests** (e.g. `session-list-and-load.test.ts`, `session-updatedAt-message-only.test.ts`) write a synthetic JSONL into a temp `mkdtempSync` directory and set `process.env.PI_CODING_AGENT_DIR` to point `listPiSessions` at it. Always restore the env in `finally`.

## Naming

- File names mirror the public surface: `agent.ts` exports `PiAcpAgent`, `session.ts` exports `SessionManager` + `PiAcpSession`, `session-store.ts` exports `SessionStore`.
- Constants are `UPPER_SNAKE_CASE` (`ACPMethods`, `PI_SETUP_METHOD_ID`, `MAX_CONNECTIONS`, `IDLE_TIMEOUT_MS`).
- Public types are `PascalCase`; pure functions are `camelCase`.
- Slash-command handlers in `PiAcpAgent.prompt` are flat `if (cmd === 'name') { … }` chains rather than a registry. Keeping the structure flat makes the ACP wire mapping easy to read.
