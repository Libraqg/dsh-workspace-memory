# Changelog

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
