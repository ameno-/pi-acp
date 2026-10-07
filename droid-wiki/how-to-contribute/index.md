# How to contribute

## Pickup

1. Read `AGENTS.md` and `README.md` first — they capture the constraints that ship with the adapter (one ACP session ↔ one `pi --mode rpc` subprocess, no FS/terminal delegation, MCP servers accepted-but-ignored, single-channel streaming, `src/acp/*` vs `src/pi-rpc/*` separation).
2. Browse the open issues at <https://github.com/svkozak/pi-acp/issues>. There's no Beads tracker.
3. Comment on the issue before opening a PR so the maintainer can flag design conflicts.

## PR process

- Branch off `main`. Keep the diff focused: one protocol / slash-command / session-management concern per PR.
- Add or update tests in the matching tier:
  - Pure translation / utility changes → `test/unit/<name>.test.ts` (uses the `node --test` runner, see [Testing](testing.md)).
  - Behavior involving the `PiAcpSession` or `PiAcpAgent` with a `FakeAgentSideConnection` / `FakePiRpcProcess` → `test/component/<name>.test.ts`.
  - End-to-end via real `pi` (only meaningful when `pi` is installed and authed) → a smoke script under `scripts/smoke-<name>.mjs`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` from the repo root before pushing.
- `npm run prepublishOnly` runs `npm run test && npm run build`; respect the same gates locally.
- Reference the relevant code: `src/acp/agent.ts` for session lifecycle, `src/acp/session.ts` for per-session event translation, `src/acp/pi-sessions.ts` for the JSONL scanner, `src/pi-rpc/process.ts` for the pi subprocess wrapper.

## Review expectations

- One reviewer is enough for a docs change or a small fix.
- Changes to `src/acp/agent.ts` (the public ACP surface — `initialize`, `newSession`, `loadSession`, `listSessions`, `prompt`, `cancel`, `setSessionMode`, `unstable_*`) need a second pair of eyes because they shape the wire contract with the ACP client (Zed today).
- Changes to `src/pi-rpc/process.ts` need a review: mistakes leave the adapter in a wedged state (half-killed subprocesses, leaked handles, blocked stdin).
- Changes to `src/acp/protocol.ts` or `src/acp/errors.ts` need a bead-style discussion — the error codes are wire-visible.
- Adding a new built-in slash command (`builtinAvailableCommands` in `src/acp/agent.ts`) needs a test in `test/unit/builtin-commands.test.ts` plus a smoke script if it interacts with the subprocess.

## Source control

`AGENTS.md` says **"DO NOT commit unless explicitly asked!"** Open a PR; ask the maintainer to merge.

## Session completion checklist

The repo's `./AGENTS.md` and the local janitor `AGENTS.md` together imply: tests green, no uncommitted changes, no destructive actions against `git status`. For a pi-acp-specific change that ships a behavior:

1. `npm run typecheck && npm run lint && npm run test`
2. `npm run build` — confirm `dist/index.js` is regenerated (the bin is `dist/index.js`).
3. Smoke-test the diff scenario with `node scripts/smoke-<name>.mjs` if one applies, otherwise `npm run smoke`.
4. File any remaining work as a GitHub issue before handing the session back.

### Pre-flight command block

```bash
cd /path/to/pi-acp
npm run typecheck && \
  npm run lint && \
  npm run test && \
  npm run build && \
  echo "OK: pi-acp adapter ready for review"
```
