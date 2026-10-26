# Publishing checklist

中文逐步说明（创建 GitHub 仓库、推送、添加 topic、提交 Hub）: [github-publish.zh.md](github-publish.zh.md)

This repository is ready to be published as a public GitHub repository and submitted to the DSH plugin ecosystem. The canonical GitHub owner is `Libraqg`; replace it if the repository moves.

## 1. Create the public repository

Recommended repository name: `dsh-workspace-memory`.

Description:

> Explicit, project-scoped memory handoff for DeepSeek Harness — one confirmed model call, no silent background calls.

Topics:

```text
dsh-plugin
deepseek-harness
dsh
memory
context
cordis
plugin
```

The first topic is the one DSH plugin indexers look for. Do not omit it.

## 2. Push this directory

```bash
cd dsh-workspace-memory
git init
git add .
git commit -m "Initial release: @libraqg/dsh-workspace-memory 0.1.1"
git branch -M main
git remote add origin git@github.com:Libraqg/dsh-workspace-memory.git
git push -u origin main
```

If you use HTTPS instead of SSH:

```bash
git remote add origin https://github.com/Libraqg/dsh-workspace-memory.git
```

## 3. Verify the install command

On a clean DSH profile, run the exact command from the README:

```bash
dsh plugin --profile web add github:Libraqg/dsh-workspace-memory
dsh plugin --profile desktop add github:Libraqg/dsh-workspace-memory
```

If `dsh` is not on `PATH`, use `npx --yes @deepseek-ai/dsh plugin ...` with the same arguments.

Then restart the profile, refresh the Web UI, and verify:

- the **Inject memory** button appears on a blank non-first conversation in a project with content;
- the confirmation layer shows sources, model, and token estimates;
- confirming performs exactly one model call and the button moves to the waiting state;
- the sidebar **Memory** panel opens and reads the project state;
- `dsh --profile desktop --dump-config` includes the `workspace-memory` row.

If your default profile is `web`, substitute `--profile web` in the README and test both profiles if you can.

## 4. Submit to DSH Plugin Hub

The repository already exists at <https://github.com/Libraqg/dsh-workspace-memory>. If you are starting from a fresh clone, skip the repository-creation steps and push `main` + tags.

The Hub auto-scans public repositories. Submission is free. A ready-to-submit issue (title, body, checklist) is in [submission/dsh-plugin-hub.md](../submission/dsh-plugin-hub.md).

1. Open <https://dsh-plugin.org/zh/submit> (or the English submit page linked from <https://dsh-plugin.org>).
2. Submit the repository URL.
3. Confirm the repository is public, has the `dsh-plugin` topic, and the README contains a copy-paste install command.
4. Keep the repository description, README, and release tag current. The Hub refreshes stars/forks/update time automatically.

New entries start as `unconfirmed` and become `verified` after community review. A precise README, screenshots, install command, license, and permission/privacy notes speed that up.

## 5. Add to Awesome DSH Plugin

Open a PR against <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> and add the entry under **Memory**. The ready-to-paste line is in [`submission/awesome-entry.md`](../submission/awesome-entry.md).

Before opening the PR, check the list's current contribution guide:

- <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md>

Keep the entry to one line: link + a factual description of what it does. Do not claim "official" or benchmark results you cannot show.

## 6. Publish to npm (required for the in-DSH Plugin Center)

The primary install path is GitHub. The in-DSH Plugin Center requires an npm package. The package is already prepared:

1. Sign in to npm and confirm the scope. The package name is `@libraqg/dsh-workspace-memory`; the npm account or organization must own `@libraqg`. If not, change the package name and the matching identities (`cordis.patch.yml` row name, `client.js` module id, test expectation, README commands).
2. ```bash
   npm login
   npm whoami
   npm view @libraqg/dsh-workspace-memory version
   ```
   A 404 on `npm view` means the name is available.
3. Inspect the tarball:
   ```bash
   npm pack --dry-run
   ```
   It should include `index.js`, `client.js`, `lib/`, `locale/`, `cordis.patch.yml`, `icon.svg`, `assets/*.png`, `assets/demo.gif`, README, and LICENSE. It must not include the 24-second MP4, the `.mov` recording, tests, or `node_modules`.
4. Publish:
   ```bash
   npm publish --access public
   ```
   If 2FA is enabled, add `--otp=123456`.
5. Verify and install:
   ```bash
   npm view @libraqg/dsh-workspace-memory version
   dsh plugin --profile web add @libraqg/dsh-workspace-memory
   dsh plugin --profile desktop add @libraqg/dsh-workspace-memory
   ```
6. Bump versions for future releases:
   ```bash
   npm version patch   # or minor/major
   npm publish --access public
   git push --follow-tags
   ```

`package.json` already has `publishConfig.access: public` and `prepublishOnly: npm test && npm run check`, so a broken test or syntax error blocks publication.

## 7. Release checklist

- [ ] `npm test` passes.
- [ ] `npm run check` passes.
- [ ] README has the actual install command and the current DSH version.
- [ ] `LICENSE` is present and `package.json` says `MIT`.
- [ ] `dsh-plugin` topic is set.
- [ ] Demo GIF and MP4 play and do not contain secrets.
- [ ] No local paths, API keys, or personal data in screenshots/video.
- [ ] `cordis.patch.yml` defaults are intentional.
- [ ] Tag `v0.1.0` and publish a GitHub Release with the MP4 as an optional asset.

## 8. What not to claim

This plugin is intentionally not a general memory OS. Do not describe it as automatic recall, background memory, vector search, or a MemOS replacement. Its differentiator is the opposite: explicit consent, one call, project scope, zero native dependencies, and no silent model calls.
