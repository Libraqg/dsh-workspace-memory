# 把 dsh-workspace-memory 发布到 GitHub（中文步骤）

目标：创建一个公开仓库，把本地代码推上去，加上 `dsh-plugin` topic，然后提交到 DSH Plugin Hub / Awesome DSH Plugin。

> 先确认 GitHub 用户名。本仓库里的链接目前按本机 git 配置写成了 `libraqg`。如果你的用户名不是 `libraqg`，先把下面文件里的 `libraqg` 换成你的用户名：
>
> `README.md`、`README.zh.md`、`package.json`、`docs/publishing.md`、`docs/launch-post.md`、`submission/awesome-entry.md`
>
> macOS 可以这样替换（把 `YOUR_NAME` 换成你的 GitHub 用户名）：
>
> ```bash
> cd /Users/ganquan/Documents/deepseek-harness/default-workspace/dsh-workspace-memory
> for f in README.md README.zh.md package.json docs/publishing.md docs/launch-post.md submission/awesome-entry.md; do
>   sed -i '' 's/libraqg/YOUR_NAME/g' "$f"
> done
> ```

## 1. 在 GitHub 创建一个空仓库

1. 打开 <https://github.com/new>。
2. **Repository name** 填 `dsh-workspace-memory`。
3. 选择 **Public**（必须是公开仓库，插件索引才能扫描）。
4. **不要**勾选 “Add a README file”、`.gitignore` 或 license。
   - 本地已经有 README、LICENSE 和提交历史；空仓库推送最干净。
5. 点 **Create repository**。

创建完成后页面会显示一段命令。先不要点 “uploading an existing file”，用下面的 git 命令推送。

## 2. 把本地代码推上去

```bash
cd /Users/ganquan/Documents/deepseek-harness/default-workspace/dsh-workspace-memory

# 确认本地提交和 tag
git log --oneline --decorate -1
git status

# 添加远端（把 YOUR_NAME 换成你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_NAME/dsh-workspace-memory.git

# 推送 main 和 v0.1.0 tag
git push -u origin main --tags
```

如果 `git push` 要求登录：

- **HTTPS**：GitHub 不接受账号密码。请用 Personal Access Token（PAT）作为密码，或改用 SSH。
- **SSH**：需要先把 SSH 公钥加到 GitHub；首次连接会提示确认 `github.com` 的 host key。
- **不想用命令行**：安装 GitHub Desktop → 登录 → File → Add Local Repository → 选择这个目录 → Publish repository → **取消勾选 “Keep this code private”** → Publish。发布后再去网页加 topic。

如果推送被拒绝，最常见原因是创建仓库时勾选了 README，远端已有一个提交。两种处理：

```bash
# 推荐：删掉远端仓库，重新创建一个完全空的仓库
# 或者把远端已有提交拉下来再推（可能出现 unrelated histories）
git pull --rebase origin main
git push -u origin main --tags
```

## 3. 添加 `dsh-plugin` topic（这是“挂到话题下”的关键）

GitHub 的 **Topics** 是给仓库打的发现标签，不是文件夹。DSH 生态主要认 **`dsh-plugin`** 这个 topic。

1. 打开仓库主页 `https://github.com/YOUR_NAME/dsh-workspace-memory`。
2. 右侧 **About** 区域，点齿轮图标（Edit repository details）。
3. 在 **Topics** 里输入 `dsh-plugin`，按回车。
4. 建议再加：
   - `deepseek-harness`
   - `dsh`
   - `memory`
   - `cordis`
   - `plugin`
5. 点 **Save changes**。

保存后可以打开 <https://github.com/topics/dsh-plugin> 检查；GitHub 的 topic 页面可能需要一点时间刷新。

## 4. 验证安装命令

README 里的安装命令必须和实际仓库一致。推送后在一台干净的 DSH 环境里试：

```bash
dsh plugin --profile desktop add github:YOUR_NAME/dsh-workspace-memory
```

重启 DSH profile、刷新 Web UI，确认：

- 新空白对话出现 **注入记忆**；
- 确认层显示来源、模型、token 估算；
- 确认后只调用一次模型；
- 侧边栏 **记忆** 面板可打开。

如果 `dsh` 不在 PATH，可在 DSH 的 **设置 → 插件 → 安装** 里填 GitHub 地址。

## 5. 提交到 DSH Plugin Hub（插件市场）

GitHub topic 只是“被扫描到”的标记；要出现在插件市场的列表里，还需要提交一次：

1. 打开 <https://dsh-plugin.org/zh/submit>。
2. 填入仓库地址 `https://github.com/YOUR_NAME/dsh-workspace-memory`。
3. 确认公开仓库、`dsh-plugin` topic、README 安装命令、`apply(ctx)` 导出都满足。
4. 提交后自动扫描；新条目通常先是 `unconfirmed`，社区复核后变 `verified`。

这一步免费，不需要上传代码包。README 质量（截图、安装命令、权限说明、许可证）会直接影响通过和转化。

## 6. 提交到 Awesome DSH Plugin（精选列表）

打开 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>，按它的 `contributing.md` 提 PR，在 **Memory** 分类加入：

```markdown
- [YOUR_NAME/dsh-workspace-memory](https://github.com/YOUR_NAME/dsh-workspace-memory) - Explicit, user-triggered project memory for DSH: one confirmed model call curates earlier conversations into a bounded brief and injects it after the first message of a new conversation; no background capture or silent model calls.
```

`submission/awesome-entry.md` 里已经准备好了这段文字，把 `libraqg` 换成你的用户名即可。

## 7. 发布 Release（可选但推荐）

1. 仓库右侧 **Releases** → **Create a new release**。
2. Tag 选 `v0.1.0`（本地已经创建）。
3. 标题：`v0.1.0 — initial release`。
4. 描述可以复制 `CHANGELOG.md` 和 `docs/launch-post.md`。
5. 可把 `assets/demo.mp4` 作为 Release asset 上传，方便别人下载。

Release 不是收录的硬性条件，但能让插件看起来更正式，也方便固定版本。

## 8. 常见问题

- **搜索不到我的插件**：先确认仓库是 Public，且 `dsh-plugin` topic 已保存在 About 里；topic 页面刷新有延迟。
- **README 的安装命令 404**：把 `YOUR_NAME` 或 `libraqg` 换成实际用户名，确认仓库名拼写一致。
- **插件能装但市场没收录**：topic 只是扫描入口；还要到 <https://dsh-plugin.org/zh/submit> 提交。
- **推送时提示 non-fast-forward**：远端仓库不是空的；重新建一个空仓库，或先 `git pull --rebase origin main`。
- **不想公开**：DSH Plugin Hub 只收录公开仓库；私有仓库无法被自动扫描。

更完整的维护者清单见 [publishing.md](publishing.md)。
