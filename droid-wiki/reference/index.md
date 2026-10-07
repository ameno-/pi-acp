# Reference

The reference pages point at the canonical sources for configuration, protocol constants, ACP method handlers, and external dependencies. Each item below names the file you should open first; the linked files contain the full surface area.

## Configuration

- `./package.json` — package metadata, `"type": "module"`, `"engines": { "node": ">=20" }`, `bin`, `main`, `files: ["dist"]`, scripts (`dev`, `build`, `start`, `typecheck`, `lint`, `test`, `smoke`, `prepack`, `prepublishOnly`), dependencies, devDependencies. License: MIT. Repository: `https://github.com/svkozak/pi-acp.git`. Publish config: `access: public, provenance: true`.
- `./tsconfig.json` — `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `lib: ['ES2022']`, `types: ['node']`, `outDir: dist`, `include: src/**/*.ts, test/**/*.ts`.
- `./tsup.config.ts` — `entry: src/index.ts`, `format: ['esm']`, `platform: 'node'`, `target: 'node22'`, `sourcemap: true`, `clean: true`, `dts: false`, `banner: { js: '#!/usr/bin/env node' }`.
- `./eslint.config.js` — flat config; `@eslint/js` + `typescript-eslint` recommended; ignores `dist/`, `node_modules/`, `.dist/`, `.dist-cache/`; `no-console: off`, `no-explicit-any: off`, `no-unused-vars` with `^_` ignore.
- `./.prettierrc.mjs` — `trailingComma: 'none'`, `tabWidth: 2`, `semi: false`, `bracketSpacing: true`, `printWidth: 120`, `singleQuote: true`, `singleAttributePerLine: true`, `arrowParens: 'avoid'`.
- `./.github/workflows/github-release.yml`, `./.github/workflows/npm-publish.yml` — release and publish workflows (no `lint`/`test` CI).
- `./AGENTS.md` — repository-level agent rules; constraint mapping, coding guidelines, source-control policy.
- `./README.md` — user-facing quick start; Zed configuration; slash-command inventory; limitations.

## Environment variables

| Variable | Default | Read at |
| --- | --- | --- |
| `PI_ACP_PI_COMMAND` | `pi` | `src/acp/agent.ts::newSession`, `unstable_forkSession`, `loadSession` |
| `PI_ACP_STARTUP_INFO` | `true` | `src/acp/agent.ts::newSession` (`booleanEnv('PI_ACP_STARTUP_INFO', true)`) |
| `PI_ACP_WS_HOST` | `127.0.0.1` | `src/index.ts` (`--ws` mode) |
| `PI_ACP_WS_PORT` | `8765` | `src/index.ts` (`--ws` mode) |
| `PI_CODING_AGENT_DIR` | `~/.pi/agent` | `src/pi-auth/status.ts`, `src/acp/pi-sessions.ts`, `src/acp/pi-settings.ts` |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `AI_GATEWAY_API_KEY`, `ZAI_API_KEY`, `MISTRAL_API_KEY`, `MINIMAX_API_KEY`, `MINIMAX_CN_API_KEY`, `HF_TOKEN`, `OPENCODE_API_KEY`, `KIMI_API_KEY`, `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`, `ANTHROPIC_OAUTH_TOKEN`, `AZURE_OPENAI_API_KEY` | unset | `src/pi-auth/status.ts::hasAnyPiAuthConfigured` |
| `HOME` | unset | `src/acp/agent.ts::buildStartupInfo` (skill / extension / prompts roots) |

## ACP method handlers

| Method | Handler | File |
| --- | --- | --- |
| `initialize` | `PiAcpAgent.initialize` | `src/acp/agent.ts` |
| `authenticate` | `PiAcpAgent.authenticate` (no-op; Terminal Auth handled out-of-band) | `src/acp/agent.ts` |
| `session/new` | `PiAcpAgent.newSession` | `src/acp/agent.ts` |
| `session/load` | `PiAcpAgent.loadSession` | `src/acp/agent.ts` |
| `session/cancel` | `PiAcpAgent.cancel` | `src/acp/agent.ts` |
| `session/prompt` | `PiAcpAgent.prompt` | `src/acp/agent.ts` |
| `session/set_mode` | `PiAcpAgent.setSessionMode` | `src/acp/agent.ts` |
| `unstable_listSessions` | `PiAcpAgent.unstable_listSessions` | `src/acp/agent.ts` |
| `unstable_resumeSession` | `PiAcpAgent.unstable_resumeSession` | `src/acp/agent.ts` |
| `unstable_forkSession` | `PiAcpAgent.unstable_forkSession` | `src/acp/agent.ts` |
| `unstable_setSessionModel` | `PiAcpAgent.unstable_setSessionModel` | `src/acp/agent.ts` |

The method names are also declared as `ACPMethods` in `src/acp/protocol.ts` (alongside `ErrorCode` for the JSON-RPC 2.0 standard codes and the ACP extension codes `-32001` ... `-32010`).

## ACP capabilities advertised

```typescript
return {
  protocolVersion: requested === 1 ? requested : 1,
  agentInfo: { name: 'pi-acp', title: 'pi ACP adapter', version: '0.0.20' },
  authMethods: getAuthMethods({
    supportsTerminalAuthMeta: clientCapabilities?._meta?.['terminal-auth'] === true
  }),
  agentCapabilities: {
    loadSession: true,
    mcpCapabilities: { http: false, sse: false },
    promptCapabilities: { image: true, audio: false, embeddedContext: false },
    sessionCapabilities: { list: {}, resume: {}, fork: {} }
  }
}
```

`authMethods` always contains a single entry: `pi_terminal_login` with `type: 'terminal', args: ['--terminal-login']`. The `_meta["terminal-auth"]` block is conditional on the client opting in via `clientCapabilities._meta["terminal-auth"]`.

## ACP error code table

| Class | Code | Source |
| --- | --- | --- |
| `ParseError` | `-32700` | `ErrorCode` enum in `src/acp/protocol.ts` |
| `InvalidRequest` | `-32600` | `ErrorCode` |
| `MethodNotFound` | `-32601` | `ErrorCode` |
| `InvalidParams` | `-32602` | `ErrorCode`, `InvalidParamsError` in `src/acp/errors.ts` |
| `InternalError` | `-32603` | `ErrorCode`, `InternalError` in `src/acp/errors.ts` |
| `ServerError` | `-32000` | `ErrorCode`, `AuthRequiredError` in `src/acp/errors.ts` |
| `SessionNotFound` | `-32001` | `ErrorCode` (declared, not raised in MVP) |
| `SessionAlreadyExists` | `-32002` | `ErrorCode` (declared, not raised) |
| `SessionExpired` | `-32003` | `ErrorCode` (declared, not raised) |
| `NotInitialized` | `-32004` | `ErrorCode` (declared, not raised) |
| `AlreadyInitialized` | `-32005` | `ErrorCode` (declared, not raised) |
| `Unauthorized` | `-32006` | `ErrorCode` (declared, not raised) |
| `ToolNotFound` | `-32007` | `ErrorCode` (declared, not raised) |
| `ApprovalDenied` | `-32008` | `ErrorCode` (declared, not raised) |
| `UserInputTimeout` | `-32009` | `ErrorCode` (declared, not raised) |
| `GenUIActionFailed` | `-32010` | `ErrorCode` (declared, not raised) |

## Pi RPC protocol

`src/pi-rpc/process.ts` documents the wire format. Pi is invoked as `pi --mode rpc` (with optional `--session <path>`). Each line on stdin is one JSON command; each line on stdout is either a `{"type":"response","id","success","data?","error?"}` (correlated by `id`) or an event object.

| Command | Request payload | Response |
| --- | --- | --- |
| `prompt` | `{type:"prompt", id?, message, images?}` | `data` echo / error |
| `abort` | `{type:"abort", id?}` | `data` echo / error |
| `get_state` | `{type:"get_state", id?}` | state object |
| `get_available_models` | `{type:"get_available_models", id?}` | `{models:[{provider,id,name}]}` |
| `set_model` | `{type:"set_model", id?, provider, modelId}` | `data` echo / error |
| `set_thinking_level` | `{type:"set_thinking_level", id?, level}` | `data` echo / error |
| `set_follow_up_mode` | `{type:"set_follow_up_mode", id?, mode}` | `data` echo / error |
| `set_steering_mode` | `{type:"set_steering_mode", id?, mode}` | `data` echo / error |
| `compact` | `{type:"compact", id?, customInstructions?}` | `{tokensBefore, summary, ...}` |
| `set_auto_compaction` | `{type:"set_auto_compaction", id?, enabled}` | `data` echo / error |
| `get_session_stats` | `{type:"get_session_stats", id?}` | `{sessionId, sessionFile, totalMessages, cost, tokens:{input,output,cacheRead,cacheWrite,total}, ...}` |
| `set_session_name` | `{type:"set_session_name", id?, name}` | `data` echo / error |
| `export_html` | `{type:"export_html", id?, outputPath?}` | `{path}` |
| `switch_session` | `{type:"switch_session", id?, sessionPath}` | `data` echo / error |
| `get_messages` | `{type:"get_messages", id?}` | `{messages:[{role, content, ...}]}` |
| `get_commands` | `{type:"get_commands", id?}` | `{commands:[{name, description, source, location, ...}]}` |

Events emitted by pi (consumed in `PiAcpSession.handlePiEvent`):

| Event | Adapter action |
| --- | --- |
| `message_update` + `assistantMessageEvent.type === "text_delta"` | `agent_message_chunk {type:"text", text}` |
| `message_update` + `assistantMessageEvent.type === "thinking_delta"` (or `reasoning_delta`, `thought_delta`) | `agent_thought_chunk {type:"text", text}` |
| `message_update` + `assistantMessageEvent.type === "toolcall_start\|toolcall_delta\|toolcall_end"` | `tool_call` or `tool_call_update` (monotonic status, best-effort `rawInput` merge from `partialArgs`) |
| `tool_execution_start` | snapshot file if `toolName === 'edit'`; `tool_call`/`tool_call_update` with status `in_progress` |
| `tool_execution_update` | `tool_call_update {status:'in_progress', content:[{type:'content', content:{type:'text', text}}]}` |
| `tool_execution_end` | emit structured diff if `edit`; else plain text; status `completed` or `failed` |
| `agent_start` | mark `inAgentLoop = true` |
| `turn_end` | ignored (pi emits multiple per user prompt) |
| `agent_end` | flush emits, resolve prompt with `end_turn` (or `cancelled` if `cancel()` was called), start next queued turn |

## Slash command reference

| Command | Source | Handler | Notes |
| --- | --- | --- | --- |
| `compact` | built-in | `PiAcpAgent.prompt` | Optional `customInstructions`. Returns `tokensBefore` + `summary`. |
| `autocompact` | built-in | `PiAcpAgent.prompt` | `on/off/toggle` (default `toggle`); sets `pi set_auto_compaction`. |
| `export` | built-in | `PiAcpAgent.prompt` | Always exports to `<session.cwd>/pi-session-<safeSessionId>.html`; guards against empty sessions. |
| `session` | built-in | `PiAcpAgent.prompt` | Renders `session/msg`, session file, message count, cost, and token breakdown. |
| `name` | built-in | `PiAcpAgent.prompt` | `setSessionName`; emits `session_info_update`. |
| `steering` | built-in | `PiAcpAgent.prompt` | Reads/writes `setSteeringMode` to `all`/`one-at-a-time`. |
| `follow-up` | built-in | `PiAcpAgent.prompt` | Reads/writes `setFollowUpMode` to `all`/`one-at-a-time`. |
| `changelog` | built-in | `PiAcpAgent.prompt` | Locates `CHANGELOG.md` via `which pi` → `<pkgRoot>/CHANGELOG.md`, falls back to `npm root -g`. Truncated to 20 000 chars. |
| `model` | selector | ACP `unstable_setSessionModel` | `providore/modelId` shape. |
| `thinking` | selector | ACP `session/set_mode` | Maps to pi's `setThinkingLevel`; enum `off/minimal/low/medium/high/xhigh`. |
| `queue` | (removed in MVP) | — | Reserved — see limitations. |
| `clear` | (not implemented) | — | Use ACP client "new" command. |
| File-based commands | `~/.pi/agent/prompts/**/*.md` + `<cwd>/.pi/prompts/**/*.md` | `expandSlashCommand` | `$1`..`$9` and `$@`; subdirs become `name:subdir`. |
| Skill commands | pi skills | `toAvailableCommandsFromPiGetCommands` | `skill:<name>`; controlled by `enableSkillCommands` setting. |
| Extension commands | pi extensions | `toAvailableCommandsFromPiGetCommands` | Hidden by default; pass `includeExtensionCommands: true` to show. |

## Storage paths

| Path | Owner | Schema | Writer |
| --- | --- | --- | --- |
| `~/.pi/agent/sessions/**/*.jsonl` | pi | newline-delimited JSON | pi RPC mode |
| `~/.pi/agent/auth.json` | pi | `Record<string, ...>` | `pi` login (out of band) |
| `~/.pi/agent/models.json` | pi | `{providers: Record<string, {apiKey?, ...}>}` | user / `pi` |
| `~/.pi/agent/settings.json` | pi | `{enableSkillCommands?, skills?: {...}, packages?: string[]}` | user |
| `~/.pi/agent/prompts/**/*.md` | pi | markdown with optional frontmatter | user |
| `~/.pi/agent/extensions/*.{ts,js}` | pi | TypeScript / JavaScript | user |
| `~/.pi/agent/skills/**/SKILL.md` | pi | SKILL.md convention | user |
| `~/.agents/skills/**/SKILL.md` | pi (legacy) | `SKILL.md` convention | user |
| `<cwd>/.pi/prompts/**/*.md` | project | markdown with optional frontmatter | user |
| `<cwd>/.pi/skills/**/SKILL.md` | project | `SKILL.md` convention | user |
| `<cwd>/.pi/settings.json` | project | (subset of `~/.pi/agent/settings.json`) | user |
| `~/.pi/pi-acp/session-map.json` | `pi-acp` | `{version: 1, sessions: Record<sessionId, {sessionId, cwd, sessionFile, updatedAt}>}` | `SessionStore` |

## External dependencies

| Dependency | Declared in | Why it is there |
| --- | --- | --- |
| `@agentclientprotocol/sdk` `^0.12.0` | `dependencies` | The ACP SDK. `AgentSideConnection`, `ndJsonStream`, all `Agent` / `AvailableCommand` / `ToolCallContent` / `SessionUpdate` types. |
| `ws` `^8.18.3` | `dependencies` | The websocket transport in `src/server/ws.ts`. |
| `zod` `^3.25.0` | `dependencies` | Reserved (transitive via ACP SDK); not directly used in the adapter source today. |
| `@mariozechner/pi-coding-agent` (external) | n/a | The `pi` executable on `PATH` (or `PI_ACP_PI_COMMAND`). Not declared in `package.json` — install separately with `npm install -g @mariozechner/pi-coding-agent`. |
| `tsx` `^4` | devDependencies | ESM/TS loader for `npm run dev` and `npm run test` (`node --import tsx --test`). |
| `tsup` `^8` | devDependencies | The bundler. |
| `typescript` `^5.6` | devDependencies | Type-check + `tsconfig.json`. |
| `eslint` `^9.17.0` | devDependencies | `npm run lint`. |
| `@eslint/js` `^9.17.0` | devDependencies | The recommended rule bundle. |
| `typescript-eslint` `^8.18.0` | devDependencies | Type-aware lint rules. |
| `globals` `^15.14.0` | devDependencies | The `globals.node` bundle for the flat config. |
| `@types/node` `^22` | devDependencies | Node types (process, fs, os, readline). |
| `@types/ws` `^8.18.1` | devDependencies | `ws` types for `src/server/ws.ts`. |
