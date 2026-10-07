# Debugging

## Logs

- The adapter writes nothing to stdout or stderr in normal operation (stdout is the ACP NDJSON stream; stderr is intentionally left for the client to consume).
- `src/index.ts` catches `ERR_STREAM_DESTROYED` and the `stdout.on('error')` handler swallows late writes — there's no log line. If you need a trace, attach `console.error` inside the `PiRpcProcess` line parser (`src/pi-rpc/process.ts`, `rl.on('line', ...)`).
- `src/server/ws.ts` does write to stderr — `console.log('[ws] ...')` for connect/disconnect/overload/rate-limit/pong-timeout. Run `node dist/index.js --ws 2>ws.log` to capture.

## Common errors

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `InternalError: "Could not start pi: executable not found"` on `session/new` | `pi` is not on `PATH` (or `PI_ACP_PI_COMMAND` points at a missing binary). | `src/pi-rpc/process.ts` (`PiRpcSpawnError`); `src/acp/agent.ts` (`newSession`); `test/unit/new-session-pi-not-found.test.ts` for the expected message. |
| `code: -32000` "Configure an API key or log in with an OAuth provider" on `session/new` | `hasAnyPiAuthConfigured()` returned false (no `auth.json`, no `models.json` `apiKey`, no provider env var). | `src/pi-auth/status.ts`; `test/unit/pi-auth-gate-before-spawn.test.ts`. |
| `code: -32000` after a successful spawn | `proc.getAvailableModels()` returned `{models:[]}`. pi started but has no providers (e.g. empty `models.json`, broken `auth.json`). | `src/acp/agent.ts` (`newSession`); `test/unit/new-session-auth-required-when-no-models.test.ts`. |
| Subprocess exits with `(code=null, signal=SIGTERM)` mid-prompt | `dispose('SIGTERM')` was called (e.g. ACP connection closed). | `src/acp/session.ts::dispose()`. |
| Tool calls missing `tool_call_update` after `tool_call` | pi sent only a `tool_execution_start` and never a `tool_execution_end` (subprocess died). | `src/pi-rpc/process.ts::request` (rejects all `pending` on `child.on('exit')`). |
| Prompt hangs after `session/prompt` | pi returned `agent_end` but the stream serializer hasn't flushed. | `src/acp/session.ts::flushEmits()` (called inside the `agent_end` handler before resolving). |
| `stopReason` is `error` instead of `cancelled` after `session/cancel` | `cancel()` was called before `cancelRequested` was set, or `proc.abort()` succeeded but `agent_end` came from a different stream. | `src/acp/session.ts::cancel()` and `wasCancelRequested()`. |
| `_meta["terminal-auth"]` missing from `initialize` | The client didn't advertise `clientCapabilities._meta["terminal-auth"]`. | `src/acp/auth.ts::getAuthMethods`; `test/unit/auth-methods-terminal-auth-meta.test.ts`. |
| Zed's "Authenticate" banner doesn't appear | Same as above, plus the client may not advertise it. The `initialize` response includes the `authMethods` either way; only the meta-key is conditional. | `src/acp/auth.ts`. |
| `/export` reports "Nothing to export yet (no session messages)" | `state.messageCount === 0` or the session JSONL is empty/ missing. | `src/acp/agent.ts::prompt` (`/export` branch); guards against `export_html` throwing on empty sessions. |
| `/changelog` reports "Changelog not found (couldn't locate pi installation)" | `which pi` failed or the resolved path is not inside an npm install (e.g. installed via `npx` from a cache, not `npm i -g`). | `src/acp/agent.ts::prompt` (`/changelog` branch). |
| `unstable_listSessions` returns the wrong set | The request omitted `cwd` and `lastSessionCwd` defaulted to an old project. | `src/acp/agent.ts::unstable_listSessions`; `test/component/session-list-scoped.test.ts`. |
| `session/load` returns "Unknown sessionId" | The session wasn't created in this adapter instance (no entry in `~/.pi/pi-acp/session-map.json`) and the JSONL scan didn't find a file with that `id`. | `src/acp/session-store.ts` and `src/acp/pi-sessions.ts`. |
| Diff payload missing from `tool_call_update` for an `edit` | `tool_execution_start` for `edit` arrived without a `path` arg, or the file read failed before pi wrote. | `src/acp/session.ts::handlePiEvent` (`tool_execution_start` branch, `editSnapshots`). |
| Edit tool has no diff but content is unchanged | pi wrote the same content as before; the adapter sees `newText === oldText` and falls back to plain text. | `src/acp/session.ts` (`tool_execution_end` branch). |
| Built-in slash command not being intercepted | The message has leading whitespace or contains images (`promptToPiMessage` returns non-empty `images`); the adapter only intercepts `image-free` messages. | `src/acp/agent.ts::prompt` (`if (images.length === 0 && message.trimStart().startsWith('/'))`). |
| Smoke scripts fail with no `sessionId` | `pi` returned an error before `get_state`; check that provider env vars are exported in the smoke shell. | `src/pi-rpc/process.ts::spawn` (handshake `getState()`). |

## Reproducing

- **Auth gate.** Use `test/unit/pi-auth-gate-before-spawn.test.ts` as a template: empty `auth.json` + empty `models.json` + unset provider env vars, expect `auth_required` from `newSession`.
- **Spawn failure.** Set `PI_ACP_PI_COMMAND=pi-does-not-exist-12345` and call `newSession`; expect `InternalError` whose message contains `"executable not found"`.
- **Diff payload.** Use `test/component/session-diff.test.ts` as the smallest reproducible scenario: write `before\n`, emit `tool_execution_start{toolName:'edit', args:{path:'a.txt'}}`, write `after\n`, emit `tool_execution_end`; expect a `tool_call_update.content` whose first element is `{type:'diff', oldText:'before\n', newText:'after\n', path:'a.txt'}`.
- **Streaming.** Use `test/component/session-events.test.ts` for any event-handler branch: construct `FakeAgentSideConnection` + `FakePiRpcProcess`, instantiate `PiAcpSession`, call `proc.emit(...)`, and assert `conn.updates`.
- **Slash command expansion.** Use `test/component/session-slash-commands.test.ts` as a template: instantiate `PiAcpSession` with a `fileCommands` array, call `session.prompt('/hello world')`, fire `agent_start`/`turn_end`/`agent_end`, and assert `proc.prompts[0].message === 'Expanded world'`.
- **Websocket transport.** Use `node dist/index.js --ws --port=8765 &` then `curl http://127.0.0.1:8765/health`. The websocket frame format mirrors stdio (single JSON message per WS text frame, response JSON-RPC on the way back).

## Editor's design notes

The ACP adapter's design has three places where errors are fun to chase:

1. **The pre-spawn auth gate.** `hasAnyPiAuthConfigured()` is run before spawning pi but only checks *existence* of auth sources, not whether they actually work. If you have `OPENAI_API_KEY=invalid`, the gate passes and pi exits with `401`; `maybeAuthRequiredError` should catch it via substring matching, but only because it includes `"401"`. Check the surface; if your provider uses a different magic string (`quota_exceeded`, `rate_limit`), pi's error may fall through to `error`.
3. **The stdout writer.** `src/index.ts` wraps `process.stdout.write` in a try/catch and a `destroyed` check. If your test or client closes stdout abruptly, the adapter will not crash, but the request that was writing to it will fail silently. There's a regression test (`stdout-destroyed-does-not-crash.test.ts`).
4. **The session map fast path.** `SessionStore.get(sessionId)` is the fast path for `loadSession`; `findPiSessionFile(sessionId)` is the fallback. If you've been deleting `~/.pi/pi-acp/session-map.json` between adapter restarts (the adapter only writes there on `newSession`/`loadSession`/`forkSession`), the fallback path is exercised. If the JSONL scan can't find a matching `id` either, `loadSession` rejects with `"Unknown sessionId"`.

### Talk to the adapter by hand

```bash
# stdin/stdout NDJSON — initialize + new + first prompt
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}'
  echo '{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/tmp/proj","mcpServers":[]}}'
  # wait for response to id=2, then send the prompt with the returned sessionId
  echo '{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"<from-id-2>","prompt":[{"type":"text","text":"hi"}]}}'
} | node dist/index.js
```
