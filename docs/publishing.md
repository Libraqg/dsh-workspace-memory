# Publishing checklist

中文逐步说明（创建 GitHub 仓库、推送、添加 topic、提交 Hub）: [github-publish.zh.md](github-publish.zh.md)

This repository is ready to be published as a public GitHub repository and submitted to the DSH plugin ecosystem. Replace `libraqg` with your GitHub username or organization if it differs.

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
git commit -m "Initial release: dsh-workspace-memory 0.1.0"
git branch -M main
git remote add origin git@github.com:libraqg/dsh-workspace-memory.git
git push -u origin main
```

If you use HTTPS instead of SSH:

```bash
git remote add origin https://github.com/libraqg/dsh-workspace-memory.git
```

## 3. Verify the install command

On a clean DSH profile, run the exact command from the README:

```bash
dsh plugin --profile desktop add github:libraqg/dsh-workspace-memory
```

Then restart the profile, refresh the Web UI, and verify:

- the **Inject memory** button appears on a blank non-first conversation in a project with content;
- the confirmation layer shows sources, model, and token estimates;
- confirming performs exactly one model call and the button moves to the waiting state;
- the sidebar **Memory** panel opens and reads the project state;
- `dsh --profile desktop --dump-config` includes the `workspace-memory` row.

If your default profile is `web`, substitute `--profile web` in the README and test both profiles if you can.

## 4. Submit to DSH Plugin Hub

The Hub auto-scans public repositories. Submission is free.

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

## 6. Optional: publish to npm / dsh-market

The primary install path is GitHub. If you also want npm and dsh-market discovery:

1. Choose a scoped package name, for example `@libraqg/dsh-workspace-memory` (the unscoped `dsh-workspace-memory` may be taken).
2. Update `package.json` `name`, repository, and README install commands.
3. `npm publish --access public`.
4. Add the npm package to dsh-market's index flow if that market asks for npm packages with a known version.

Do not change the package name in the middle of a release without updating the README, `dsh.bundle` row, and install command.

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
