# Glossary

| Term | Definition |
| --- | --- |
| ACP | [Agent Client Protocol](https://agentclientprotocol.com/overview/introduction). A JSON-RPC 2.0-over-stdio (or websocket) protocol between an editor/IDE ("ACP client") and a coding agent ("ACP agent"). Spec docs are at `agentclientprotocol.com`. |
| ACP agent | The role `pi-acp` plays. Implemented by `PiAcpAgent implements AgentSideConnection` in `src/acp/agent.ts`. |
| ACP client | The editor invoking the agent. Today that is [Zed](https://zed.dev); other ACP clients may have partial compatibility. |
| ACP session | An ACP `sessionId` created by `session/new` (or `session/load` / `unstable_forkSession` / `unstable_resumeSession`). One-to-one with a `pi --mode rpc` subprocess inside `pi-acp`. |
| pi RPC mode | `pi --mode rpc` — the JSONL-RPC service exposed by the pi CLI. Driven by `PiRpcProcess` in `src/pi-rpc/process.ts`. Each command has a `{type, id?, ...}` payload and a correlated `{type:"response", id, success, data?, error?}` reply; everything else is an event. |
| NDJSON | Newline-delimited JSON. The encoding on both stdio sides — ACP <-> `pi-acp` (via `ndJsonStream`) and `pi-acp` <-> `pi` (via `JSON.stringify(cmd) + "\n"` in `PiRpcProcess.request`). |
| Session map | `~/.pi/pi-acp/session-map.json`. Versioned (`version: 1`) JSON file mapping ACP `sessionId` → `{cwd, sessionFile, updatedAt}`. Owned by `SessionStore` (`src/acp/session-store.ts`). |
| Session file | pi's `~/.pi/agent/sessions/**/*.jsonl` (overridable via `PI_CODING_AGENT_DIR`). The first entry is `{ type:"session", id, cwd }`; subsequent entries are `message`, `session_info`, etc. |
| Startup info | The markdown block `pi-acp` synthesizes for Zed after `session/new`. Includes `pi v<version>`, `## Context` (AGENTS.md in cwd), `## Skills` (user + project roots), `## Prompts` (`~/.pi/agent/prompts/*.md`), `## Extensions` (`~/.pi/agent/extensions/*.{ts,js}` + npm packages). Toggled by `PI_ACP_STARTUP_INFO`. See `buildStartupInfo` in `src/acp/agent.ts`. |
| Tool call snapshot | `editSnapshots: Map<toolCallId, {path, oldText}>` in `PiAcpSession`. Captured on `tool_execution_start` for the `edit` tool; used to emit a structured `{type:"diff", oldText, newText}` payload on `tool_execution_end`. Locked in by `test/component/session-diff.test.ts`. |
| Available command | ACP `AvailableCommand` — `{name, description, input?}` advertised via `session/update`'s `available_commands_update` after every `session/new` and `session/load`. Three sources are merged: pi RPC `get_commands`, file-based prompts, and built-ins from `builtinAvailableCommands`. |
| Built-in command | Adapter-handled slash command (does **not** go to pi). Defined inline in `src/acp/agent.ts::builtinAvailableCommands()`: `compact`, `autocompact`, `export`, `session`, `name`, `steering`, `follow-up`, `changelog`. |
| File-based slash command | Markdown file under `~/.pi/agent/prompts/**` (user) or `<cwd>/.pi/prompts/**` (project), parsed by `loadSlashCommands` and expanded in `PiAcpSession.prompt` before forwarding to pi. Supports bash-style `\$1` / `\$@` via `substituteArgs`. |
| Skill command | Slash command with the `skill:` prefix, sourced from pi skills. Visibility controlled by `enableSkillCommands` (or `skills.enableSkillCommands`) in `<agentDir>/settings.json` and `<cwd>/.pi/settings.json`. See `getEnableSkillCommands`. |
| Terminal auth | The [ACP Registry](https://agentclientprotocol.com/get-started/registry) auth method the adapter advertises as `pi_terminal_login`. The client launches `pi-acp --terminal-login` (which `spawnSync`'s `pi` with `stdio: 'inherit'`) so the actual interactive login happens in a real TTY. Surfaces as the "Authenticate" banner in Zed via `_meta["terminal-auth"]`. |
| Auth required | ACP JSON-RPC error code `-32000` (in `ErrorCode::ACP_AUTH_REQUIRED`) returned when `hasAnyPiAuthConfigured()` returns false or pi's `getAvailableModels()` returns an empty list. Includes `authMethods` so the client knows it can offer Terminal Auth. |
| Streaming serializer | `PiAcpSession.emit()` chains `lastEmit = lastEmit.then(() => conn.sessionUpdate(...))` so notifications arrive in order; `flushEmits()` is awaited in the `agent_end` handler before resolving the prompt. |
| Tool status map | `currentToolCalls: Map<toolCallId, 'pending' \| 'in_progress'>` ensures status is monotonic — we never re-emit `pending` after `tool_execution_start`. |
| Mode / thinking level | pi's thinking level (`off | minimal | low | medium | high | xhigh`). Mapped from ACP `session/set_mode` via `setSessionMode` → `proc.setThinkingLevel`. The adapter initializes on session creation by calling `getState().thinkingLevel`. |
| Queue mode | ACP `unstable_*` feature mapping `setFollowUpMode` / `setSteeringMode` to `all | one-at-a-time`. `/queue all|one-at-a-time` is the adapter-side slash command. |
| Fork | `unstable_forkSession` — copies the source JSONL, rewrites the `type:"session"` header to point at a fresh id and the new `cwd`, then spawns a new `pi --mode rpc --session <forkPath>`. See `createForkSessionFile` in `src/acp/agent.ts`. |
| Resume | `unstable_resumeSession` — thin wrapper around `loadSession` that returns `sessionId` in the response. |
| List | `unstable_listSessions` — reads `~/.pi/agent/sessions/**/*.jsonl` (1-line head + 256 KiB tail), filters by `cwd` (defaults to `lastSessionCwd` when the client omits it, to emulate pi's project-scoped `/resume`), and returns paged `SessionInfo[]` with a numeric `nextCursor`. |
| Load | `session/load` — reattaches to an existing JSONL. Looks up the session via `SessionStore` (fast path) or `findPiSessionFile` (full scan), spawns `pi --mode rpc --session <path>`, replays `get_messages` as `session/update` notifications, and (best-effort) emits a structured `tool_call` for every historic `toolResult`. |
| Auth methods | The list the adapter advertises in `initialize`. Always exactly one: `pi_terminal_login`, with the `_meta["terminal-auth"]` block iff `clientCapabilities._meta["terminal-auth"]` is `true`. |

### Examples

A session-map file (`SessionStore` format) and a built-in slash-command handler:

```json
{
  "version": 1,
  "sessions": {
    "f53e-0000-aaaa-bbbb": {
      "sessionId": "f53e-0000-aaaa-bbbb",
      "cwd": "/home/donatello/dev/janitor",
      "sessionFile": "/home/donatello/.pi/agent/sessions/--home--donatello--dev--janitor/0000_f53e.jsonl",
      "updatedAt": "2026-03-01T00:09:10.000Z"
    }
  }
}
```

```typescript
// src/acp/agent.ts (paraphrased `/name` branch)
if (cmd === 'name') {
  const name = args.join(' ').trim()
  if (!name) {
    await this.conn.sessionUpdate({
      sessionId: session.sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Usage: /name <name>' } }
    })
    return { stopReason: 'end_turn' }
  }
  await session.proc.setSessionName(name)
  await this.conn.sessionUpdate({
    sessionId: session.sessionId,
    update: { sessionUpdate: 'session_info_update', title: name, updatedAt: new Date().toISOString() }
  })
  return { stopReason: 'end_turn' }
}
```
