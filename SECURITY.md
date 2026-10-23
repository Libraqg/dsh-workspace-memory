# Security

## Reporting

Please report security issues privately through GitHub's **Security → Report a vulnerability** flow for this repository. Do not open a public issue for a vulnerability that could expose user data or credentials.

Include the DSH version, profile, plugin version, and a minimal reproduction. Please avoid including real API keys or private transcripts.

## Threat model

This is trusted Host code installed into a DSH profile. Like any DSH plugin, it runs with the user's permissions outside the agent tool sandbox. Review the source before installing, and pin a release if you need stability.

## Data flow

- Stored locally: `brief.md`, `notes.md`, `state.json` under `~/.dsh/workspace-memory/`.
- Read locally: earlier DSH session logs in the same project, compaction summaries, user notes.
- Sent to a model: only after the user clicks **Inject memory** and confirms. The dossier contains user notes, a previous brief, and bounded structured excerpts from earlier sessions. It may include file paths, commands, error strings, and user/assistant text.
- The selected model provider receives the dossier and produces the brief; that brief is then injected into the current conversation and becomes part of its prompt.
- No telemetry is sent by this plugin.

## Redaction

`redactPatterns` in `cordis.patch.yml` are applied to excerpts and the generated brief before storage/injection. Defaults cover common `sk-...` and `Bearer ...` shapes. Redaction is best-effort; users should not put secrets into notes or conversations they intend to send to a provider.

## Limitations

- The plugin cannot prevent a model provider from retaining the dossier according to its own policy.
- The plugin does not encrypt local memory files. Protect `~/.dsh/workspace-memory/` with your OS account permissions.
- The injected brief is untrusted historical background. The plugin frames it accordingly, but correctness still depends on the user and model verifying it against the files.
