# pi-acp

ACP ([Agent Client Protocol](https://agentclientprotocol.com/overview/introduction)) adapter for the [`pi` coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) (fka "shitty coding agent"). `pi-acp` speaks ACP JSON-RPC 2.0 over stdio (with an experimental websocket transport), spawns `pi --mode rpc` once per ACP session, and bridges events between the editor side and pi's newline-delimited-JSON RPC stream. Current ACP client target is the [Zed](https://zed.dev) editor; other ACP clients may work with varying fidelity.

## At a glance

- Repo: `pi-acp`
- Description (from `./package.json`): "ACP adapter for pi coding agent"
- License: MIT (declared in `./package.json` and `./LICENSE`)
- Primary language: TypeScript (ESM, `node >= 20`, `tsup` builds to `node22`)
- Total commits: 1
- Contributors: 1 (`Ameno Osman <ameno.osman13@gmail.com>`)
- Default branch: `main`
- Head commit: `f53eb8c2dd0ea4bb35ab3a1c5933232c3a36c9f1`
- First and last commit: 2026-03-01T00:09:10-08:00
- Files under the working tree (excluding `.git`, `node_modules`, `droid-wiki`, `dist`): 68
- File-extension breakdown: `ts:46`, `mjs:11`, `json:3`, `md:2`, `js:1`, `yml:2`, `gitignore:1`
- Public runtime deps: `@agentclientprotocol/sdk@^0.12.0`, `ws@^8.18.3`, `zod@^3.25.0`
- Runtime deps the adapter spawns: `@mariozechner/pi-coding-agent` (the `pi` binary on `PATH`)
- Tests: 15 unit + 10 component (`node --test` via `npm run test`); 10 smoke scripts (`npm run smoke`)
- CI: `github-release.yml` + `npm-publish.yml` only; no `lint` / `test` workflow committed
- Issue tracker: GitHub (`svkozak/pi-acp/issues`)
- Beads: not used
- Source control: `AGENTS.md` instructs agents **not to commit unless explicitly asked**

## What the adapter actually does

`pi-acp` is a single `npm install -g pi-acp` away from being wired into an editor. From a UX standpoint, the user types into an ACP client (today: Zed), the request flows:

1. ACP client opens a stdio child (`pi-acp`) and sends `initialize`.
2. The client calls `session/new` with a `cwd`. `pi-acp` checks that `pi` has *some* provider available (`hasAnyPiAuthConfigured()`), spawns a dedicated `pi --mode rpc` subprocess, points it at `<cwd>/.pi/sessions/<id>.jsonl`, and registers it in `SessionManager`. If pi has no models available (e.g. nothing in `~/.pi/agent/auth.json`, no provider env vars set, no `models.json` `apiKey` configured), `pi-acp` returns an `auth_required` JSON-RPC error with a Terminal-Auth `authMethods` payload so the client can show an "Authenticate" banner and re-launch the agent with `--terminal-login` for the user to log in.
3. The client sends `session/prompt`. `pi-acp` translates the ACP `ContentBlock[]` to pi's `{message, images}` shape (text, resource links, embedded resources, images — but not audio), expands any leading `/command` against the file-based slash-command set, and forwards it to pi.
4. Pi streams events back as newline-delimited JSON. The session handler in `src/acp/session.ts` translates each event into one or more ACP `session/update` notifications: `agent_message_chunk` for `text_delta`, `agent_thought_chunk` for `thinking_delta`, `tool_call` + `tool_call_update` for tool execution. The adapter snapshots a file before `edit` runs so it can emit a structured `{type:"diff", oldText, newText}` payload when the tool completes.
5. `session/load` reattaches to a previous session by mapping the ACP `sessionId` back to pi's JSONL file (either via the local `~/.pi/pi-acp/session-map.json` or by scanning `~/.pi/agent/sessions/**/<id>.jsonl`), spawning a fresh `pi --mode rpc --session <path>`, and replaying the conversation via `session/update` before responding.

## Sections

- [Architecture](architecture.md) — ACP server wiring, per-session pi subprocess, file-snapshot diff path, slash-command flow, mermaid diagrams.
- [Getting started](getting-started.md) — install, Zed configuration (`npx`, global, from source), prerequisites.
- [Glossary](glossary.md) — terms used in the source and the protocol mapping.
- [By the numbers](../by-the-numbers.md)
- [Lore](../lore.md)
- [How to contribute](../how-to-contribute/index.md)
- [Packages](../packages/index.md)
- [Reference](../reference/index.md)

## Quick install (Zed)

Add to Zed `settings.json`:

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

The `--terminal-login` entry point launches `pi` directly in a terminal for ACP Registry Terminal Auth:

```bash
pi-acp --terminal-login
```

Zed renders this as an **Authenticate** banner via the `_meta["terminal-auth"]` block on the `AuthMethod`.
