# Testing

## Frameworks

- Node's built-in `node:test` (run via `node --import tsx --test test/**/*.test.ts`).
- Plain `node:assert/strict` for assertions; no third-party assertion library.
- `FakeAgentSideConnection` / `FakePiRpcProcess` from `test/helpers/fakes.ts` for component tests.

The project does **not** use Jest, Vitest, or any other runner — `package.json` has no `jest` / `vitest` dependency. There is no coverage tool wired up (`c8`, `nyc`, `istanbul` are not declared in `devDependencies`).

## Per-tier commands

| Path | Command | What it runs |
| --- | --- | --- |
| `npm run test` | `npm run test` | `node --import tsx --test test/**/*.test.ts` — runs `test/unit/*.test.ts` (15) and `test/component/*.test.ts` (10) together. |
| Per-file | `node --import tsx --test test/unit/<name>.test.ts` | One file. |
| Pattern | `node --import tsx --test --test-name-pattern='<regex>' test/<tier>/<file>.test.ts` | One named test. |
| Watch | `node --import tsx --test --watch test/unit/<name>.test.ts` | Re-run on save (Node 22+). |

## Unit suite (`test/unit/`)

| File | Coverage |
| --- | --- |
| `auth-methods-terminal-auth-meta.test.ts` | `getAuthMethods({supportsTerminalAuthMeta: true/false})` includes/omits the Zed `_meta["terminal-auth"]` block. |
| `builtin-commands.test.ts` | `/steering` reports current state; `/name` calls `setSessionName` and emits `session_info_update`. |
| `merge-commands.test.ts` | `mergeCommands` order-preserving de-dupe by first-write. |
| `new-session-auth-required-when-no-models.test.ts` | `newSession` throws `auth_required` (code `-32000`) when `proc.getAvailableModels` returns `{models:[]}` and disposes the proc. |
| `new-session-pi-not-found.test.ts` | When `pi` is missing, `newSession` rejects `InternalError` whose text contains `"executable not found"`. |
| `pi-auth-gate-before-spawn.test.ts` | `newSession` returns `auth_required` and does **not** call `sessions.create()` when no auth configured. |
| `pi-commands.test.ts` | `toAvailableCommandsFromPiGetCommands` filters `extension` source by default and toggles `skill:*` by `enableSkillCommands`. |
| `pi-messages.test.ts` | `normalizePiMessageText` / `normalizePiAssistantText` join text blocks, drop non-text blocks. |
| `pi-tools.test.ts` | `toolResultToText` handles `content[]`, `details.diff`, bash `details.{stdout,stderr,exitCode}`, JSON fallback. |
| `prompt-to-pi-message.test.ts` | `promptToPiMessage` flattens `text`, `resource_link`, `resource` (text vs blob), `audio` (marker), `image`. |
| `slash-commands.test.ts` | `parseCommandArgs`, `substituteArgs`, `expandSlashCommand`, `toAvailableCommands`. |
| `startup-info-env.test.ts` | `PI_ACP_STARTUP_INFO=false` disables both `buildStartupInfo` and the deferred `setTimeout` for it. |
| `startup-info-load-session.test.ts` | `loadSession` does not schedule a startup-info timer; only `available_commands_update` is scheduled. |
| `stdout-destroyed-does-not-crash.test.ts` | Regression test: stdout writer in `src/index.ts` resolves instead of throwing when `process.stdout.destroyed === true`. |

## Component suite (`test/component/`)

| File | Coverage |
| --- | --- |
| `agent-steering-followup-modes.test.ts` | `/steering` and `/follow-up` (with no arg, with valid arg, with invalid arg) on `PiAcpAgent` through `FakePiRpcProcess`. |
| `session-diff.test.ts` | End-to-end ACP diff payload: pre-write `before\n`, fire `tool_execution_start{toolName:'edit'}`, edit to `after\n`, fire `tool_execution_end`; assert `tool_call_update.content[0] === {type:'diff', oldText:'before\n', newText:'after\n', path:'a.txt'}`. |
| `session-events.test.ts` | `text_delta` → `agent_message_chunk`; `thinking_delta` → `agent_thought_chunk`; `tool_execution_{start,update,end}` → `tool_call` then `tool_call_update`s; prompt resolves on `agent_end`; cancel flips stopReason to `cancelled`; queued prompts start after `agent_end`. |
| `session-list-and-load.test.ts` | `unstable_listSessions` lists pi JSONLs; `loadSession` replays `user` + `assistant` messages as `session/update`. |
| `session-list-scoped.test.ts` | When `unstable_listSessions` is called with `{}`, it filters to `lastSessionCwd`. |
| `session-load-toolresult.test.ts` | `loadSession` replays a historic `toolResult` as `tool_call` + `tool_call_update` with `status: 'completed'`. |
| `session-queue-cancel.test.ts` | `cancel()` clears queued prompts (resolve as `cancelled`), aborts the running turn (resolve as `cancelled`), no further prompt started. |
| `session-slash-commands.test.ts` | `/hello world` is expanded to `expanded` text before being sent to pi. |
| `session-thinking-modes.test.ts` | `setSessionMode` rejects an invalid `modeId` (this test is light; the real coverage is in `agent.ts` calls). |
| `session-title-long-session.test.ts` | `listPiSessions` finds `session_info.name` even when it sits outside the 256 KiB tail window (full-file scan fallback). |
| `session-updatedAt-message-only.test.ts` | `listPiSessions` `updatedAt` is the last `message.timestamp`, not the last `session_info.timestamp`. |

## Patterns

- **Translation unit tests.** Construct the function with a literal payload and assert the string. See `test/unit/pi-tools.test.ts`:

  ```typescript
  test('toolResultToText: prefers details.diff when present', () => {
    const text = toolResultToText({ details: { diff: '--- a\n+++ b\n' } })
    assert.equal(text, '--- a\n+++ b\n')
  })
  ```

- **Component tests with `FakeAgentSideConnection`.** Construct `new PiAcpSession({...})` with a fake proc and a fake connection, fire `proc.emit({type:'message_update', ...})`, and assert the recorded `updates`. See `test/component/session-events.test.ts`:

  ```typescript
  proc.emit({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'hi' } })
  await new Promise(r => setTimeout(r, 0))
  assert.equal(conn.updates.length, 1)
  assert.deepEqual(conn.updates[0]!.update, {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text: 'hi' }
  })
  ```

- **Hermetic filesystem tests.** Write a synthetic JSONL into `mkdtempSync(join(tmpdir(), 'pi-acp-test-'))`, set `process.env.PI_CODING_AGENT_DIR` to point at the temp, and reset in `finally`. See `test/component/session-list-and-load.test.ts`.

- **Override `PiRpcProcess.spawn`.** Stub `(PiRpcProcess as any).spawn = async () => fakeProc` to avoid spawning real pi. Always reset in `finally`:

  ```typescript
  const originalSpawn = PiRpcProcess.spawn
  ;(PiRpcProcess as any).spawn = async () => ({ onEvent: () => () => {}, getMessages: ..., getAvailableModels: ..., getState: ... })
  try { ... } finally { PiRpcProcess.spawn = originalSpawn }
  ```

## Smoke scripts (manual / out of band)

`scripts/smoke-*.mjs` are not part of `npm run test`. They build, spawn the bundled `dist/index.js`, send JSON-RPC over stdio, and assert. They require `pi` installed and configured. Examples:

```bash
node scripts/smoke-newsession-intro.mjs   # startup info before any prompt
node scripts/smoke-acp-load.mjs           # full session/load cycle
node scripts/smoke-changelog.mjs          # /changelog built-in
node scripts/smoke-compact.mjs            # /compact
node scripts/smoke-export.mjs             # /export
node scripts/smoke-modes.mjs              # setSessionMode -> pi setThinkingLevel
node scripts/smoke-queue.mjs              # /queue built-in
node scripts/smoke-session.mjs            # /session stats
node scripts/smoke-startupinfo.mjs        # startup info emitted as first chunk
```

## Coverage expectations

- Every new `src/acp/translate/*` function gets at least one unit test (input → output) before PR.
- Every new built-in slash command gets a `test/unit/builtin-commands.test.ts` entry.
- Every new event handler branch in `handlePiEvent` (`src/acp/session.ts`) gets a `test/component/session-events.test.ts` entry that asserts the resulting `session/update` notification.
- New ACP method handlers (`src/acp/agent.ts`) get either a component test (when a fake session/proc is enough) or a smoke script (when real pi behavior is required).
- A regression test in `test/unit/stdout-destroyed-does-not-crash.test.ts` style is appropriate for any change to the wire-write path in `src/index.ts`.
