# pdcaw

Sync PDCA documents (and any other Markdown under `docs/`) from a project repo to a
PDCA-workspace server. File contents are read straight from disk and sent as-is — they
never pass through an LLM context, so uploading a batch of design docs costs no tokens
and introduces no risk of retyping errors.

> **This is a client for a self-hosted [PDCA-workspace](https://github.com/SpiritFlag/PDCA-workspace)
> server — not a general-purpose upload tool.** Installing it gets you nothing without
> your own server instance and a PAT issued by that server. There is no built-in default
> server; `PDCAW_BASE_URL` must be set explicitly.

## Usage

No install needed — run it with `npx`:

```bash
npx pdcaw upload --cycle my-feature --version v0.1.0
```

```
usage: pdcaw upload [--cycle <name>] [--version vX.Y.Z] [--all]
                     [--path <file|dir>]... [--project <uuid>] [--base-url <url>]
```

| Flag | Meaning |
|------|---------|
| `--cycle <name>` | Filter to one PDCA cycle (alone), or the cycle to attach a release to (with `--version`) |
| `--version vX.Y.Z` | Create a release and sync **all** of `docs/` (requires `--cycle`) |
| `--all` | Scan all of `docs/` without consulting git |
| `--path <file\|dir>` | Upload exactly the given file(s)/folder(s), bypassing git detection entirely. Repeatable. Mutually exclusive with `--all`/`--cycle`/`--version` |
| `--project <uuid>` | Override the resolved project id |
| `--base-url <url>` | Override the resolved server URL |

With no flags, it uploads everything under `docs/` that changed since the latest git tag
(committed diff ∪ working tree). Non-`.md` files and files outside `docs/` are ignored.

PDCA-shaped paths (`docs/PDCA/{yearMonth}/{name}/{name}.{plan,design,analysis,report}.md`)
are uploaded as `kind: "pdca"`, title = cycle name. Every other `.md` under `docs/` is
uploaded as `kind: "general"`, title = the document's first heading (any level, front
matter and code fences ignored) or its filename if it has no heading.

## Setup

**1. Get a PAT.** Issue one from the server's `/tokens` page (shown once, at issue time)
and put it in `.env.local` at your repo root — `pdcaw` loads that file automatically:

```bash
cp .env.local.example .env.local
# then edit .env.local
```

```
PDCAW_PAT=pdcaw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PDCAW_PROJECT_ID=00000000-0000-0000-0000-000000000000   # optional
PDCAW_BASE_URL=https://your-pdca-workspace.example.com    # required, no default
```

A PAT is tied to one server (Neon branch) — a token issued on dev won't authenticate
against prod, and vice versa.

**2. Optionally add `.pdcarc.json`** at your repo root (safe to commit — no secrets):

```bash
cp .pdcarc.example.json .pdcarc.json
```

```json
{
  "projectId": "00000000-0000-0000-0000-000000000000",
  "baseUrl": "https://your-pdca-workspace.example.com"
}
```

**Resolution order**: CLI flag > `PDCAW_*` env var > `.pdcarc.json`. There is no built-in
default for `baseUrl` — if it's missing from all three sources, `pdcaw` exits with a
config error instead of guessing. `projectId` is the only field that falls back further,
to auto-detection via the server's project list when exactly one project is accessible.

The PAT itself is **never** read from `.pdcarc.json` — only `PDCAW_PAT`. If `.pdcarc.json`
contains a `pat`/`token` key it is ignored with a warning, and its value is never printed.

## Governance

This repo runs on two change tracks: ordinary patches go through backlog → commit → tag
→ CHANGELOG directly; only **structural** changes (`.pdcarc` schema, the CLI argument
surface, the upload protocol) go through a full PDCA cycle
(see [`docs/RULE.md`](docs/RULE.md)). Releases follow semver — a breaking change to the
config schema or argument surface is a major bump.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # vitest
npm run lint    # oxlint
```
