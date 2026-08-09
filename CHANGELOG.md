# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow [semver](https://semver.org/)
— a breaking change to the `.pdcarc` schema or CLI argument surface is a major bump
(see [README.md](README.md#governance)).

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
