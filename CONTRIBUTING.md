# Contributing

Thanks for taking a look. This project is deliberately small; the constraints below are part of the product, not incidental implementation details.

## Design constraints

1. **No silent model calls.** A model may be called only from the confirmed **Inject memory** action. Do not add timers, automatic recall, background summarization, or retry loops that call `ctx.llm`.
2. **One confirmation = one curator call.** The curator call produces the brief; injection is local. Do not split curation and injection into separate hidden calls.
3. **Fail closed.** If the curator fails, times out, or returns an invalid brief, report the error and inject nothing. No automatic model switch, retry, or deterministic fallback that silently sends data.
4. **Project-scoped.** Do not widen memory to a global or cross-project scope without an explicit, reviewed design change.
5. **No native dependencies.** Keep the bundle runnable from plain Node.js ESM. Avoid SQLite, ONNX, embedding models, and build steps.
6. **User notes are owned by the user.** Never let the curator rewrite or delete `notes.md`.
7. **Keep the injected block bounded and clearly untrusted.** Preserve the `<system-reminder>` framing and escape attempts to close it.

## Development

Requirements: Node.js `>=22.19.0`. There is no build step and no runtime dependency.

```bash
git clone https://github.com/libraqg/dsh-workspace-memory.git
cd dsh-workspace-memory
npm test
npm run check
```

To try a local change in DSH:

```bash
dsh plugin --profile desktop add "$PWD"
# restart the DSH profile, then refresh the Web UI
```

The package is a DSH bundle: `package.json` declares `dsh.bundle.patch` and a Web client module.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Add or update tests for logic changes. The Host integration test in `test/host.test.js` is the guard for the single-call policy.
- Do not add telemetry.
- If you change the injected format, update the README examples and the design note.
- If a DSH preview changes an API, state the exact DSH version you tested.

## Publishing

Maintainers: the GitHub / DSH Plugin Hub / Awesome DSH Plugin checklist is in [docs/publishing.md](docs/publishing.md).

## Reporting bugs

Open a GitHub issue with:

- DSH version and profile (`desktop`, `web`, …)
- Node version and OS
- The exact error text from the confirmation layer or Host log
- Whether the bug reproduces with a fresh project and a fresh conversation

For security issues, follow [SECURITY.md](SECURITY.md).
