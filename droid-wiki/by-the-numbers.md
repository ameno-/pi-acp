# By the numbers

Data collected on 2026-10-05 from the working tree at `/tmp/janitor-work/pi-acp/`. Run `git -C /tmp/janitor-work/pi-acp log --reverse --format='%cI' -n 1` and `git -C /tmp/janitor-work/pi-acp log --format='%H' -n 1` to refresh the dates and head; rerun the recursive file listing to update the counts.

## Repository

| Metric | Value |
| --- | --- |
| Description (from `./package.json`) | "ACP adapter for pi coding agent" |
| License | MIT (declared in `./package.json`; copyright Sergii Kozak in `./LICENSE`) |
| Primary language | TypeScript |
| Package manager | npm (`package-lock.json` committed) |
| Module system | ESM (`"type": "module"` in `./package.json`) |
| Engines | `node >= 20` (TypeScript compiles to ES2022; tsup targets `node22`) |
| Total commits | 1 |
| Contributors | 1 (`Ameno Osman <ameno.osman13@gmail.com>`) |
| First commit | `2026-03-01T00:09:10-08:00` |
| Last commit | `2026-03-01T00:09:10-08:00` |
| Default branch | `main` |
| Head | `f53eb8c2dd0ea4bb35ab3a1c5933232c3a36c9f1` |
| Git remote | `git@github.com:ameno-/pi-acp.git` |

## File tree

| Metric | Value |
| --- | --- |
| Files (excluding `.git`, `node_modules`, `droid-wiki`, `dist`) | 68 |
| `ts` files | 46 |
| `mjs` files | 11 (10 under `scripts/` smoke tests + `.prettierrc.mjs`) |
| `json` files | 3 (`package.json`, `package-lock.json`, `.prettierrc` is mjs) |
| `md` files | 2 (`README.md`, `AGENTS.md`) |
| `js` files | 1 (`eslint.config.js`) |
| `yml` files | 2 (`.github/workflows/github-release.yml`, `npm-publish.yml`) |
| `gitignore` files | 1 |

The 46 TypeScript files break down as: 16 under `src/acp/` (one of them is `translate/`), 1 `src/pi-rpc/process.ts`, 1 `src/pi-auth/status.ts`, 1 `src/server/ws.ts`, 1 `src/index.ts`, and 26 under `test/` (15 unit + 10 component + 1 helpers). The 11 `mjs` files are: 10 in `scripts/` (`smoke-acp.mjs`, `smoke-acp-load.mjs`, `smoke-changelog.mjs`, `smoke-compact.mjs`, `smoke-export.mjs`, `smoke-modes.mjs`, `smoke-newsession-intro.mjs`, `smoke-queue.mjs`, `smoke-session.mjs`, `smoke-startupinfo.mjs`) plus `.prettierrc.mjs`.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Entry point. Dispatches to stdio mode (`AgentSideConnection`), `--ws` mode (`startWsServer`), or `--terminal-login` (`spawnSync('pi', …)`). |
| `src/acp/agent.ts` | `PiAcpAgent implements ACPAgent`. Handles `initialize`, `newSession`, `unstable_loadSession`, `unstable_resumeSession`, `unstable_listSessions`, `unstable_forkSession`, `prompt`, `cancel`, `setSessionMode`, `unstable_setSessionModel`, `authenticate`. ~1410 lines. |
| `src/acp/session.ts` | `SessionManager` + `PiAcpSession`. Owns the in-memory turn queue, tool-call status map, edit snapshots, and `session/update` serializer. ~604 lines. |
| `src/acp/session-store.ts` | `SessionStore` writing to `~/.pi/pi-acp/session-map.json` so `session/load` can reattach to the right pi JSONL. |
| `src/acp/pi-sessions.ts` | `listPiSessions`, `findPiSessionFile`. Scans `~/.pi/agent/sessions/**/*.jsonl`, reads only the first 64 KiB and the last 256 KiB per file to pick titles and `updatedAt`. |
| `src/acp/slash-commands.ts` | File-based slash commands: `loadSlashCommands`, `parseCommandArgs`, `substituteArgs`, `expandSlashCommand`. Mirrors pi's prompt template semantics. |
| `src/acp/pi-commands.ts` | Translates pi RPC `get_commands` response into ACP `AvailableCommand[]`. Hides `extension` source unless explicitly enabled; filters `skill:*` by the settings flag. |
| `src/acp/pi-settings.ts` | `getEnableSkillCommands(cwd)` — reads `<agentDir>/settings.json` and `<cwd>/.pi/settings.json` (deep-merge, project overrides global). |
| `src/acp/auth.ts` | `getAuthMethods(opts)` and `PI_SETUP_METHOD_ID = 'pi_terminal_login'`. |
| `src/acp/auth-required.ts` | Substring-based detector for the most common missing-credential errors. |
| `src/acp/protocol.ts` | `ACPMethods` const map + `ErrorCode` enum (standard JSON-RPC + ACP extensions). |
| `src/acp/errors.ts` | `ACPError`, `InvalidParamsError`, `InternalError`, `AuthRequiredError`, `MethodNotFoundError`. `toJSON()` returns a JSON-RPC error object. |
| `src/acp/paths.ts` | `getPiAcpDir()` → `~/.pi/pi-acp`; `getPiAcpSessionMapPath()`. |
| `src/acp/translate/pi-messages.ts` | `normalizePiMessageText`, `normalizePiAssistantText` — collapse pi content blocks into a single string. |
| `src/acp/translate/pi-tools.ts` | `toolResultToText(result)` — handles `content[]`, `details.{stdout,stderr,exitCode,diff}`, JSON fallback. |
| `src/acp/translate/prompt.ts` | `promptToPiMessage(blocks)` — ACP `ContentBlock[]` → `{message, images}`. |
| `src/pi-rpc/process.ts` | `PiRpcProcess.spawn({cwd, piCommand?, sessionPath?})` and the per-command helpers (`prompt`, `abort`, `getState`, `setModel`, `compact`, etc.). |
| `src/pi-auth/status.ts` | `hasAnyPiAuthConfigured()` — checks `auth.json`, `models.json`, and ~20 known provider env vars. |
| `src/server/ws.ts` | `startWsServer({host, port})` — websocket ACP server with ping/pong, idle and rate limits, `/health` endpoint. |

## Tests and smoke scripts

| Metric | Value |
| --- | --- |
| Unit tests | 15 (`test/unit/*.test.ts`) |
| Component tests | 10 (`test/component/*.test.ts`) |
| Test helpers | 1 (`test/helpers/fakes.ts` — `FakeAgentSideConnection`, `FakePiRpcProcess`) |
| Test runner | `node --test` via `node --import tsx --test test/**/*.test.ts` (`npm run test`) |
| Smoke scripts | 10 (one per feature under `scripts/smoke-*.mjs`); invoked by `npm run smoke` |
| CI | 2 GH Actions workflows (`github-release.yml`, `npm-publish.yml`); no `lint` / `test` workflow committed |

The unit suite covers: `auth-methods-terminal-auth-meta`, `builtin-commands`, `merge-commands`, `new-session-auth-required-when-no-models`, `new-session-pi-not-found`, `pi-auth-gate-before-spawn`, `pi-commands`, `pi-messages`, `pi-tools`, `prompt-to-pi-message`, `slash-commands`, `startup-info-env`, `startup-info-load-session`, `stdout-destroyed-does-not-crash`. The component suite covers: `agent-steering-followup-modes`, `session-diff`, `session-events`, `session-list-and-load`, `session-list-scoped`, `session-load-toolresult`, `session-queue-cancel`, `session-slash-commands`, `session-thinking-modes`, `session-title-long-session`, `session-updatedAt-message-only`.

## Runtime dependencies

| Dependency | Declared in | Used by |
| --- | --- | --- |
| `@agentclientprotocol/sdk` `^0.12.0` | `dependencies` | `AgentSideConnection`, `ndJsonStream`, all ACP types in `src/acp/*.ts` |
| `ws` `^8.18.3` | `dependencies` | `src/server/ws.ts` (experimental websocket transport) |
| `zod` `^3.25.0` | `dependencies` | Reserved for runtime schema validation (transitive via ACP SDK too) |

`tsx`, `tsup`, `eslint`, `typescript`, `@types/node`, `@types/ws`, `typescript-eslint`, `@eslint/js`, `globals` are devDependencies only.

### Working-tree quick check

```bash
git -C /tmp/janitor-work/pi-acp log --reverse --format='%cI' -n 1
git -C /tmp/janitor-work/pi-acp log --format='%H' -n 1
git -C /tmp/janitor-work/pi-acp branch --show-current
find /tmp/janitor-work/pi-acp -type f \
  -not -path '*/.git/*' -not -path '*/node_modules/*' \
  -not -path '*/droid-wiki/*' -not -path '*/dist/*' | wc -l
```

## External pi-side details

| Detail | Value |
| --- | --- |
| Pi package | `@mariozechner/pi-coding-agent` |
| Pi RPC entry | `pi --mode rpc` (newline-delimited JSON over stdio) |
| Pi session root | `~/.pi/agent/sessions/.../<id>.jsonl` (overridable via `PI_CODING_AGENT_DIR`) |
| pi-acp own state | `~/.pi/pi-acp/session-map.json` |
| Auth sources recognized | `~/.pi/agent/auth.json`, `~/.pi/agent/models.json`, env vars in `src/pi-auth/status.ts` |
| Slash command roots | `~/.pi/agent/prompts/**/*.md` (user) + `<cwd>/.pi/prompts/**/*.md` (project) |
| Skills roots (skill) | `~/.pi/agent/skills/**` + `~/.agents/skills/**` + `<cwd>/.pi/skills/**` |

## Issue tracker and source control

| Metric | Value |
| --- | --- |
| Issue tracker | GitHub (`svkozak/pi-acp/issues`) |
| Beads | not used |
| Branch discipline | `main` only; `AGENTS.md` instructs agents **not to commit unless explicitly asked** |

## Counts in this snapshot (LOC by file)

Use `wc -l src/**/*.ts src/*.ts src/*.ts test/**/*.ts scripts/*.mjs | sort -nr` against the working tree to recompute. As collected on 2026-10-05:

| Bucket | Approx. lines |
| --- | --- |
| `src/acp/agent.ts` | ~1,410 |
| `src/acp/session.ts` | ~604 |
| `src/pi-rpc/process.ts` | ~370 |
| `src/server/ws.ts` | ~260 |
| All other `src/**/*.ts` | ~600 |
| `test/**/*.ts` (26 files) | ~1,600 |
| `scripts/smoke-*.mjs` (10 files) | ~480 |
