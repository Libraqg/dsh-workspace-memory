# Changelog

## 0.1.2 — 2026-10-26

- npm packaging readiness: `publishConfig.access: public`, `prepublishOnly` checks, and README/GIF assets included in the package.
- Added npm install instructions for both Web and Desktop profiles.
- No runtime behavior change.

## 0.1.1 — 2026-10-26

- Removed automatic status queries on Hero/composer mount, which could create two `memory` command rows before the user clicked anything.
- Status reads are now on-demand (hover/click/panel open) and shared through a short-lived client cache.
- Documented that status checks are local DSH commands, not model calls, and may appear as command rows in the detailed transcript.

## 0.1.0 — 2026-10-24

- Initial public release.
- Project-scoped, explicitly confirmed memory handoff for DeepSeek Harness.
- One curator model call per confirmed injection; no background or silent calls.
- Confirmation layer with source conversations, curator route, input/output/injection token estimates, and a privacy notice.
- Bilingual Chinese/English UI.
- Sidebar memory panel for brief preview, notes editing, project curator route, and reset.
- Compaction-summary-aware dossiers; bounded brief and injection budgets.
- Zero native dependencies; plain local files under `~/.dsh/workspace-memory/`.
- Test suite covering configuration, digest extraction, injection framing, brief validation, Client slot registration, and Host single-call integration.
