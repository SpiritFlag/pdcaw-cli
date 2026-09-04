# pdcaw

CLI for a self-hosted [PDCA-workspace](https://github.com/SpiritFlag/PDCA-workspace) server.
It syncs Markdown docs under `docs/`, creates releases, and reads/writes the backlog. It is
the only channel the [pdca-skill](https://github.com/SpiritFlag/PDCA-skill) Claude Code
skills use to reach the server, so they work without MCP (e.g. on accounts that cannot
attach connectors). Document bodies are read from disk and sent as-is; they never pass
through an LLM context.

> **Not a general-purpose tool.** It needs your own server instance and a PAT issued by
> it. There is no default server; `PDCAW_BASE_URL` must be set.

## Commands

```
pdcaw upload   [--version vX.Y.Z] [--all] [--path <file|dir>]...
pdcaw project  list
pdcaw cycle    list
pdcaw backlog  list   [--status s,...] [--stale <days>] [--q <text>]
pdcaw backlog  get    <id|8+ char prefix>
pdcaw backlog  create --title <t> --priority <p> --opened-on <YYYY-MM-DD> [--detail <t> | --detail-file <f>]
pdcaw backlog  update <id> [--status s] [--closed-on d] [--opened-on d] [--title t] [--priority p]
                           [--detail <t> | --detail-file <f> | --append-detail <t|@file>]
pdcaw doc      collect --stage <plan|design|do|analysis|report|release> [--major vN] --out <dir|file.md>
```

Every command accepts `--json` (structured stdout; progress goes to stderr) and
`--project <uuid>` / `--base-url <url>` overrides. `pdcaw <command> --help` prints details.

### upload

With no flags, uploads everything under `docs/` that changed since the latest git tag
(committed diff ∪ working tree). `--all` scans `docs/` without git; `--path` uploads exactly
the given files/folders and is mutually exclusive with the other two.

`--version vX.Y.Z` is the release step of `pdca-close`:

1. finds the cycle folder `docs/PDCA/*/{version}-*/` locally (fails if missing or ambiguous),
2. creates the release on the server with `{ version, name, dir }` (reuses it if it exists),
3. uploads the changed docs,
4. if `{stem}.release.md` exists in that folder, sets it as the release note.

### Path convention

```
docs/PDCA/v1/v1.2.0-enhance-lyric-sync/v1.2.0-enhance-lyric-sync.{plan,design,do,analysis,report,release}.md
```

The parser has one rule: **folder name == file stem**. The parent path is free, so the older
`docs/PDCA/2026-08/{name}/{name}.{stage}.md` layout still uploads (as a cycle without a
version prefix). Anything else under `docs/` is uploaded as `kind: "general"` with the first
heading as title.

### backlog

`list` returns summary rows (no `detail`) so large boards fit in a context window; `get`
returns one item with `detail`. `--stale <days>` keeps `todo` items untouched for at least
that long. `--append-detail` prepends a block and keeps the existing body verbatim.

`--status todo` is refused on purpose: reopening or reworking an item is a human decision
made in the web UI. Allowed targets are `doing | done | resolved | dropped`.

### doc collect

Local only. Gathers one stage across all cycles, sorted by version, into a folder
(`--out some/dir`) or one concatenated file (`--out all-reports.md`, each document preceded
by an HTML comment with its path). Useful when a GUI file picker cannot select across folders.

## Setup

**1. Get a PAT.** Issue one from the server's `/settings/tokens` page (shown once) and put it
in `.env.local` at your repo root — `pdcaw` loads that file automatically:

```
PDCAW_PAT=pdcaw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PDCAW_PROJECT_ID=00000000-0000-0000-0000-000000000000   # optional
PDCAW_BASE_URL=https://your-pdca-workspace.example.com    # required, no default
```

A PAT is tied to one server (Neon branch) — a token issued on dev won't authenticate against
prod, and vice versa.

**2. Add `.pdcarc.json`** at your repo root (safe to commit — no secrets):

```json
{
  "projectId": "00000000-0000-0000-0000-000000000000",
  "baseUrl": "https://your-pdca-workspace.example.com"
}
```

`pdcaw project list` prints the ids to paste here.

**Resolution order**: CLI flag > `PDCAW_*` env var > `.pdcarc.json`. `baseUrl` has no
default. `projectId` falls back to auto-detection when exactly one project is accessible.
The PAT is never read from `.pdcarc.json`; a `pat`/`token` key there is ignored with a warning.

## Server compatibility

| pdcaw | PDCA-workspace |
|---|---|
| 1.x | requires `cycles.dir` and the six-stage enum (pdca-skill v1 overhaul) |
| 0.x | four-stage enum, `cycles.yearMonth` |

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # vitest
npm run lint    # oxlint
```

Releases follow semver; a breaking change to the config schema or argument surface is a
major bump. See [CHANGELOG.md](CHANGELOG.md).
