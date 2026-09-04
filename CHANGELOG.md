# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow [semver](https://semver.org/)
— a breaking change to the `.pdcarc` schema or CLI argument surface is a major bump
(see [README.md](README.md#governance)).

## v1.0.0 — 2026-09-04

**Breaking**: argument surface and path convention changed for the pdca-skill v1 system.
`pdcaw` is now the only channel Claude Code skills use to reach the server (no MCP), so it
grew from a single `upload` command into a small suite.

### Breaking

- **`upload --cycle` is gone.** `--version vX.Y.Z` alone identifies the cycle: the CLI
  looks for `docs/PDCA/*/{version}-*/` locally, derives the cycle name and folder from it,
  and refuses to run if the folder is missing or ambiguous. Partial sync uses `--path`.
  Passing `--cycle` now fails with a pointer to this note.
- **New path convention** `docs/PDCA/v{N}/{version}-{cycle}/{version}-{cycle}.{stage}.md`.
  The parser keeps a single rule (folder name == file stem, any parent path), so the old
  `docs/PDCA/{yearMonth}/{name}/…` layout still parses (with `version: null`).
- **Six stages**: `plan` `design` `do` `analysis` `report` `release` (was four).
- **Cycle creation contract** is `{ version, name, dir }` (was `{ version, name, yearMonth }`).
  Requires PDCA-workspace with the matching `cycles.dir` change. Cycle names are no longer
  unique, so the `409 target=name` branch was removed.
- `upload --version` now also sets the release note from `{stem}.release.md` when that
  file exists in the cycle folder (PATCH `/api/cycles/:id`).
- **`--version` combines with `--path`** (was mutually exclusive). This is the backfill
  path: `upload --version v0.1.1 --path docs/PDCA/v0/v0.1.1-x` creates the release and
  uploads only that folder, so retroactive releases no longer re-send every changed doc.
  `--path` and `--all` remain mutually exclusive.
- **The baseline tag excludes `--version`'s own tag.** If `v1.2.0` is already tagged at
  HEAD when `upload --version v1.2.0` runs (the close procedure tags first), the previous
  release is used as the baseline instead of an empty diff. Uses `git describe --exclude`.

### Added

- `pdcaw project list` — workspaces and projects (for `.pdcarc.json`).
- `pdcaw cycle list` — releases sorted by version, with `dir` and `hasReleaseNote`.
- `pdcaw backlog list [--status a,b] [--stale <days>] [--q <text>]` — summary rows without
  `detail` so 100+ items fit a context window. `--stale` applies to `todo` only. Filtering and
  summarizing happen server-side (`GET …/backlog/summary?status&stale&q`).
- `pdcaw backlog get <id|8+ char prefix>` — one item with `detail`.
- `pdcaw backlog create --title --priority --opened-on [--detail | --detail-file]`.
- `pdcaw backlog update <id> [--status] [--closed-on] [--opened-on] [--title] [--priority]
  [--detail | --detail-file | --append-detail <text|@file>]`. `--append-detail` prepends a
  block and keeps the existing body verbatim — sent as `appendDetail`, so the server owns the
  "원안 보존" rule and no read-modify-write happens on the client.
  `--status todo` is refused, mirroring the MCP policy: reopening is a human decision.
- `pdcaw doc collect --stage <s> [--major vN] --out <dir|file.md>` — local only; gathers
  one stage across all cycles into a folder or a single concatenated file (with a path
  comment before each document), for GUI upload pickers.
- `--json` on every command. Skills consume only this; human tables are for eyes.
- Question files (`*.qN.md`) left in a cycle folder are flagged during upload — they are
  supposed to be deleted after the answer is applied.

### Changed

- Uploading with `--version` and no changed docs no longer exits early: the release is still
  created and the release note applied.

## v0.2.0 — 2026-08-09

**Breaking**: `PDCAW_BASE_URL` no longer has a built-in default. Now that `pdcaw` is
published to npm, a hardcoded fallback to a specific production server misrepresented it
as a general-purpose tool — it is a client for a self-hosted PDCA-workspace server and has
never worked without one.

### Changed

- `baseUrl` is now required, exactly like `PDCAW_PAT` — if it's missing from CLI
  flag/env var/`.pdcarc.json`, `pdcaw` exits with a config error instead of silently
  falling back to a production URL.
- When both `PDCAW_PAT` and `baseUrl` are missing, the error message lists both at once
  (previously only the first missing field was reported, requiring a fix-and-rerun cycle
  to discover the second).
- `README.md`, `.pdcarc.example.json`, `.env.local.example` updated to reflect the
  required, no-default `baseUrl` contract; example values no longer reference the author's
  own production server.

## v0.1.0 — 2026-08-09

Initial release. Extracted from PDCA-workspace's `scripts/docs-upload.ts` (7th cycle,
`refine-cycle-closing`) into a standalone, installable CLI — plus two scope extensions
requested mid-cycle.

### Added

- `pdcaw upload` — sync Markdown docs to a PDCA-workspace server. Body content is read
  from disk and sent as-is; it never passes through an LLM context.
- **`docs/` is synced in full, not just `docs/PDCA/`.** Any `.md` under `docs/` that
  doesn't match the PDCA cycle-path shape is uploaded as `kind: "general"` (title = first
  heading, or filename if none) instead of being silently skipped. The server already
  supported `kind: "general"` — the original script simply never used it.
- **`--path <file|dir>` (repeatable).** Uploads exactly the given path(s), bypassing git
  change detection entirely. For callers (e.g. Claude Code) that already know which files
  changed from their own `git diff`, this skips a redundant re-scan. Mutually exclusive
  with `--all`/`--cycle`/`--version`.
- `.pdcarc.json` — optional, commit-safe project config (`projectId`, `baseUrl`). PATs are
  never read from it; a `pat`/`token` key present in the file is ignored with a warning.
- `.env.local` is loaded automatically (Node's built-in `process.loadEnvFile`) — no more
  shell wrapper (`set -a && . ./.env.local && set +a`) needed.
- Repo root is resolved by locating `.pdcarc.json` upward from `cwd`, falling back to
  `git rev-parse --show-toplevel`, falling back to `cwd` — works even outside a git repo,
  which `--path` mode requires.

### Changed from the original script

- `docs/PDCA` path prefix → `docs` (git pathspec and directory scan; the PDCA-path parser
  itself is untouched — see below).
- Usage text: `npm run docs:upload --` → `npx pdcaw upload`.
- Output gained three lines: resolved repo root (with source: `.pdcarc` / `git` / `cwd`),
  the `.env.local` path if one was loaded, and a `kind` column in the target list.

### Carried over unchanged

The path parser (`docs/PDCA/{yearMonth}/{name}/{name}.{stage}.md` ↔ cycle/stage), the
git diff/status interpreters, the JSON-RPC envelope parser, `--cycle`/`--version`
combination rules, delete/rename handling (warn only, no server call), empty-file
skipping, per-file failure isolation, and PAT-never-logged behavior are all unchanged
from the original — 19 of its test cases are ported verbatim (same IDs, same fixtures).

### Known gaps (carried forward, not addressed this cycle)

- The path parser is duplicated between this repo and PDCA-workspace (single-source
  consolidation is future work).
- PDCA-workspace's own `scripts/docs-upload.ts` and `npm run docs:upload` still exist
  side by side with this package — removing them is a separate, later change.
- No sub-command besides `upload`.
- 7th-cycle usability items (M-1–M-4, M-7) were intentionally left as-is per the porting
  instructions.
