# Architecture

`dsh-workspace-memory` is a small DSH bundle with a Host half and a Web Client half. Its job is deliberately narrow: curate earlier conversations in one project into a bounded brief and inject that brief into a newly opened conversation after an explicit confirmation.

## File map

| Path | Role |
|---|---|
| `index.js` | Host plugin entry: commands, confirmation tokens, curator call, pending injection, `agent/pre-step` insertion |
| `lib/config.js` | Config normalization and bounds |
| `lib/paths.js` | DSH home, project-root resolution, path containment, project key |
| `lib/store.js` | Plain-file storage, atomic writes, per-project queue |
| `lib/digest.js` | Session-log extraction: requests, outcomes, files, errors, compaction summary, delta |
| `lib/curator.js` | Curator route resolution, prompt, one `llm.stream` call, output validation |
| `lib/inject.js` | Injected block composition, frame escaping, frozen user message |
| `lib/redact.js` | Configured redaction and UTF-8 truncation |
| `client.js` | Web Client bundle: Hero button, overlay fallback, confirmation dialog, sidebar panel |
| `cordis.patch.yml` | Default bundle row and budgets |

## Host flow

### 1. Resolve the project root

`resolveProjectRoot` starts from the session's current working directory and resolves:

1. the exact registered DSH workspace;
2. the longest registered workspace ancestor;
3. the nearest ancestor containing `.git`;
4. the directory itself.

The canonical path is hashed (`sha256`, 16 hex chars) into a project key. The project record is stored under `$DSH_HOME/workspace-memory/<key>/`.

### 2. Scan earlier conversations

For the current project, the Host lists sessions and filters:

- not the current session;
- not a subagent (unless configured);
- has a `cwd`;
- canonical `cwd` is inside the project root.

Each candidate is read through `ctx.sessionQuery.readSession`, then `extractDigest` produces a bounded dossier:

- latest `compaction/summary` text, if any;
- direct user requests;
- final assistant text per turn;
- file paths from tool calls;
- tool errors;
- turn count and timestamps.

A session with no direct user content is not a source. The first `maxSessions` content-bearing sessions are used; older ones may be dropped for the input budget.

### 3. Compose the dossier

The dossier contains:

```json
{
  "projectRoot": "…",
  "generatedAt": "…",
  "notes": "redacted user notes",
  "previousBrief": "redacted previous brief",
  "sessions": [
    {
      "id": "…",
      "title": "…",
      "updatedAt": 0,
      "hasCompactionSummary": true,
      "compactionSummary": "…",
      "requests": ["…"],
      "outcomes": ["…"],
      "files": [{ "tool": "write", "path": "src/a.ts" }],
      "errors": ["…"],
      "turns": 4
    }
  ],
  "omittedSessions": 0
}
```

If a session's `briefCovers` watermark is set, only content after that sequence is included. This is the "delta" for the next curation. If there is no previous brief, all earlier content is the delta. If the dossier exceeds `curator.maxInputBytes`, older sessions are dropped first; the plugin never adds a map-reduce model call to compensate.

### 4. The single curator call

`/memory inject-status --json` is local: it scans sources, builds the dossier, estimates tokens, resolves the curator route, and issues a one-time confirmation token. It does not call `ctx.llm`.

`/memory inject --confirm <token>`:

1. validates the token, blank conversation, non-first project conversation, non-subagent rule, and in-flight guard;
2. builds the dossier again with fresh reads;
3. calls `ctx.llm.stream` exactly once with the selected route;
4. validates the output (required headings, non-empty, `maxBriefBytes`), redacts it, writes `brief.md`, updates `briefCovers`, and records usage;
5. prepares the injected text in memory for the first step.

The curator route resolution is: project override → global config → current session route → deployment default. The plugin never stores credentials.

### 5. Pre-step insertion

`agent/pre-step` runs after the first user message is claimed. It:

- awaits an in-flight curator job for this session (bounded), so a message sent during curation can still receive the brief;
- checks that the step is the first step (`step === 1`);
- refuses to inject if the session already contains a `workspace-memory` message;
- inserts the block immediately after the last claimed user message.

If curation is still running past the bounded wait, or the user has already moved past step 1, the brief is saved but not injected. The plugin does not inject mid-conversation.

## Client flow

The client bundle registers:

- `conversation.hero.options` — the primary **Inject memory** button on a blank project conversation;
- `shell.overlay` — a fixed fallback button when the Hero seat is not rendered;
- `sidebar.panellist` + `main` — the **Memory** panel.

The button first calls `inject-status` (local). If a source/model exists, it shows the button and a tooltip. Clicking opens the confirmation dialog with sources, model, input estimate, output limit, injection estimate, and a privacy note. Confirming calls `inject --confirm` with the token. The button then shows **Waiting for your first message**.

The panel is read/manage-only and never calls a model: brief preview, notes editor, curator route, reset, storage path, and last usage.

The client declares `remote.commands` in its `inject` list. Accessing `ctx.remote.commands` without that declaration fails with `cannot get property "remote.commands" without inject`.

## Status reads and transcript rows

The confirmation layer reads host-side status through DSH commands (`inject-status`/`status`). These are local commands, not model calls; they never enter model context or cost tokens. DSH logs command executions, so a `memory` row can appear in the detailed transcript when the user hovers, clicks, or opens the panel. The client no longer queries status on mount; a blank conversation by itself should not create a status row. This is a deliberate trade-off of the current command-based data channel; a future Host Remote/HTTP endpoint would remove the rows entirely.

## Storage

```text
$DSH_HOME/workspace-memory/
  index.json                 # project title, curator override, last injection metadata
  <projectKey>/
    brief.md                 # last accepted curated brief
    notes.md                 # user-owned pinned notes
    state.json               # briefCovers, digest cache, last injection
```

Writes are atomic (`writeFile` to a temp path, then `rename`) and serialized per project by an in-process promise queue. Corrupt JSON is backed up and treated as empty.

## Budgets

- `maxInjectBytes` (8192): hard cap on the user-visible block.
- `maxBriefBytes` (6144): the curator output must fit; otherwise the call fails.
- `maxNotesBytes` (2048): notes are clipped when shown/estimated; saving larger notes is rejected.
- `curator.maxTokens` (2000): output cap.
- `curator.maxInputBytes` (16384): dossier cap; older sessions are dropped.
- `maxSessions` (5) and `maxTurnsPerSession` (4): dossier breadth.

The injected block prioritizes notes, then the brief; if the wrapper and notes alone exceed the cap, the text is clipped by UTF-8 boundary.

## Failure policy

- No curator route: the button is hidden and the status explains why.
- Curator timeout or provider error: no injection, no retry, no model switch.
- Invalid output (missing sections or over budget): no save, no injection.
- Source scan failure: skip that source; if none remain, no injection.
- Late curation: the brief is saved for a future conversation, but not injected mid-turn.
- Pre-step waits for an in-flight curator only up to the configured timeout plus a small margin.

## Security notes

- Only the confirmed curator call reaches a provider; status, panel, notes, route changes, and reset are local.
- The dossier redacts configured secret-like patterns before the call.
- `notes.md` is inserted verbatim into the injected block; it is not sent through the curator output path.
- The injected block is framed as untrusted historical background, with `</system-reminder>` escaped.
- The plugin adds no telemetry.

## Known limitations

- It is not a general memory index and does no retrieval; the full brief is injected.
- It does not inject after compaction if the memory message later disappears; open a new conversation to inject again.
- It does not automatically re-run after a failed curator call.
- It uses a project-root scope, not per-user or per-agent-preset namespaces.
- It is built against DSH `0.2.1-rc.2`; newer preview APIs may require changes.
