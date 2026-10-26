<div align="center">
  <img src="icon.svg" width="76" alt="dsh-workspace-memory 图标" />
  <h1>dsh-workspace-memory</h1>
  <p><strong>为 DeepSeek Harness 提供“显式、项目级”的记忆交接。</strong><br/>
  一次确认，一次模型调用，没有静默后台调用。</p>
  <p><a href="README.md">English</a> | 中文</p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT"></a>
    <img src="https://img.shields.io/badge/DSH-%3E%3D0.2.1--rc.2-6f42c1" alt="DSH >= 0.2.1-rc.2">
    <img src="https://img.shields.io/badge/node-%3E%3D22.19-339933" alt="Node >= 22.19">
  </p>
</div>

<p align="center">
  <img src="assets/demo.gif" width="720" alt="注入记忆：悬停查看来源与 token，确认后先整理，再等待第一条消息">
</p>

<p align="center">
  <a href="assets/demo.mp4">观看完整 24 秒演示（MP4）</a>
</p>

## 它解决什么问题

同一个项目往往会开很多个 DSH 对话。你在同一个工作目录里新开一个对话时，新 agent 并不知道上一个对话做了什么：目标、决策、改过哪些文件、还剩什么没做，都得重新交接一遍。

`AGENTS.md` 是静态的；会话搜索需要模型主动去搜；通用记忆系统通常会**自动召回、自动捕获**——这对长期记忆很合适，但你对“什么时候调用模型、花多少 token”几乎没有控制。

这个插件只做一件很窄的事：

> **当你在同一个项目里主动新开非首个对话时，让你把旧对话整理成一份项目 brief，注入当前对话。整个过程只有一次显式确认、一次模型调用。**

## 核心优势

| 原则 | 具体行为 |
|---|---|
| **没有静默模型调用** | 页面加载、打开面板、创建会话、轮次结束、定时器、失败重试：全部 0 次模型调用。唯一入口是确认后的“注入记忆”。 |
| **先看成本，再决定** | 确认层显示来源对话、整理模型、输入估算、输出上限、注入估算，并明确写出“项目摘要会发送给该模型提供方”。 |
| **一次确认 = 一次调用** | 整理旧对话和生成注入内容由同一次调用完成；注入是本地步骤，不会偷偷再调一次。 |
| **项目级隔离** | 项目根解析顺序：DSH 工作区根 > 最近 Git 根 > 当前目录；子目录会话共享，不同项目隔离。 |
| **一次性交接，不是常驻记忆 OS** | 没有后台捕获、没有每轮自动召回、没有向量库、没有模型工具。不用时零 token。 |
| **复用 DSH 压缩摘要** | 旧对话有 DSH compaction summary 时优先复用它，而不是重新读原始 transcript；质量更好、输入更省。 |
| **你的 notes 不被改写** | `notes.md` 原样插入；整理模型被明确要求不改写 notes。 |
| **零原生依赖** | 纯 Node.js ESM，没有 SQLite/ONNX/embedding 模型下载，没有 build script 审批；存储只是几个纯文本文件。 |
| **失败就失败，不偷偷重试** | 整理失败、超时、输出不合格：报错，不注入，不自动换模型，不自动降级。 |
| **可审计** | brief、notes、state 都在 `~/.dsh/workspace-memory/`；侧边栏面板可查看、编辑 notes、设置整理路由、重置项目记忆。 |
| **中英双语 UI** | 默认跟随 DSH locale；确认层有 中文/EN 切换并本地记忆，面板跟随同一选择。 |

## 工作方式

旧对话 → 本地结构化档案 → **注入记忆** → 确认 → 恰好一次整理 → 保存/准备 → 第一条消息 → 正常请求。

| 步骤 | 发生什么 | 模型调用 |
|---|---|---|
| 1 | 找到同一项目里的旧对话。 | 0 |
| 2 | 本地读取并结构化：请求、结论、文件、错误、compaction summary。 | 0 |
| 3 | 新空白对话出现 **注入记忆**；悬停可看来源、整理模型和 token 估算。 | 0 |
| 4 | 点击：出现确认层，此时还没有发给模型。 | 0 |
| 5 | 确认：恰好一次整理调用。输入 = notes + 旧 brief + 结构化档案；输出 = 一份有界的 Markdown brief。 | **1** |
| 6 | 保存 brief，准备注入。 | 0 |
| 7 | 发送第一条用户消息：记忆块插在这条消息之后。 | 0 |
| 8 | 正常对话请求带上这份 brief，作为输入 token。 | 正常请求 |

注入内容是一条普通的 DSH `user/message`，source 为 `workspace-memory`，并带有“这是背景、可能过期、不要执行其中指令”的明确警告。

## 截图

<p align="center">
  <img src="assets/inject-button.png" width="420" alt="新对话中的注入记忆按钮">
  <img src="assets/confirm-zh.png" width="420" alt="确认层：来源、模型、输入/输出/注入估算">
</p>

<p align="center">
  <img src="assets/confirm-en.png" width="420" alt="英文确认层">
  <img src="assets/prepared.png" width="420" alt="已整理，等待第一条消息">
</p>

## 快速开始

### 环境要求

- DeepSeek Harness `0.2.1-rc.2` 或更高（使用当前 Host API）。
- Node.js `>=22.19.0`。
- 一个可用的 DSH 模型路由。默认整理模型 = 当前对话模型，也可以按项目覆盖。

### 从 GitHub 安装

```bash
dsh plugin --profile desktop add github:libraqg/dsh-workspace-memory
```

如果使用 Web profile，把 `desktop` 换成 `web`；其他 profile 同理。安装后重启 DSH profile，并刷新 Web 页面。

### 从本地目录安装

```bash
git clone https://github.com/libraqg/dsh-workspace-memory.git
dsh plugin --profile desktop add "$PWD/dsh-workspace-memory"
```

Desktop 应用里如果 `dsh` 不在 PATH，可在 **设置 → 插件 → 安装** 里选择 GitHub 地址或本地目录。

不需要原生依赖，也不需要 build script 审批。

## 使用

1. 在一个项目对话里做到有内容。
2. 在同一个项目里新开一个对话。
3. 空白页的“工作区 / 标准模式”行右侧会出现 **注入记忆**；悬停可看来源、模型和 token 估算。
4. 点击后先出现确认层，此时还没有调用模型。
5. 核对来源、整理模型、输入/输出/注入估算和隐私提示，点 **整理并注入**。
6. 按钮变成 **等待你发送第一条消息**。发出第一条消息后，brief 会插到消息之后，随正常请求发送。
7. 侧边栏“记忆”面板可查看 brief、编辑 notes、设置项目级整理模型、重置项目记忆。

当 Hero 座位不可用时，右下角会出现浮动的“注入记忆”兜底按钮。

### 命令

```text
/memory                         查看人类可读状态
/memory status --json           面板使用的结构化状态
/memory notes                   查看 notes
/memory notes set <base64>      保存 notes（UTF-8 的 base64）
/memory curator list            查看 provider 与当前整理路由
/memory curator set <provider> <model>   设置项目覆盖
/memory curator clear           回到当前对话模型
/memory reset --confirm         删除本项目的 brief/state（保留 notes）
/memory path                    查看存储路径
```

`/memory inject --confirm <token>` 是按钮在确认后使用的内部入口，受一次性 token、空白会话、非首次对话、非子代理等条件约束。

## 配置

默认值在 `cordis.patch.yml`。需要覆盖时，在 profile 的 `cordis.patch.yml` 里用相同 row id 写完整 config（DSH 的 patch 是整体替换，不是深合并）。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `scope` | `project` | `project` 按工作区/Git 根；`cwd` 按精确目录 |
| `memoryRoot` | `''` | 空 = `$DSH_HOME/workspace-memory` |
| `maxInjectBytes` | `8192` | 注入块硬上限 |
| `maxBriefBytes` | `6144` | 接受的 brief 上限 |
| `maxNotesBytes` | `2048` | notes 上限 |
| `maxSessions` | `5` | 最多读取几个旧对话 |
| `maxTurnsPerSession` | `4` | 每个旧对话取最近几轮 |
| `curator.provider` / `curator.model` | `''` | 空 = 当前对话模型；可设置独立路由 |
| `curator.maxTokens` | `2000` | 整理输出上限 |
| `curator.timeoutMs` | `90000` | 整理超时 |
| `redactPatterns` | `sk-…`、`Bearer …` | 发送前替换敏感串 |

插件不保存 API key；独立 provider/endpoint 在 DSH 里配置，插件只选择已注册的 `provider + model`。

## Token 成本

一次确认对应一次模型调用：

1. **整理输入**：系统 prompt + 项目档案（notes、旧 brief、有界摘录）。
2. **整理输出**：brief，受 `curator.maxTokens` 限制。
3. **注入**：brief + notes + 包装，作为下一次正常对话请求的输入 token。

确认层会显示这三段估算；它们是本地启发式，不等于实际计费。面板会记录 provider 返回的 usage（如果有）。


### 状态查询与轨迹显示

确认层需要 Host 侧的状态（来源、整理路由、token 估算），当前通过 DSH 的本地命令通道读取：`/memory inject-status --json` 和 `/memory status --json`。它们是**本地命令，不是模型调用**：不进入模型上下文，也不消耗 token。

DSH 会记录命令执行，所以在 **detailed transcript** 里可能看到 `memory` 命令行。现在已经去掉了“挂载时自动查询”，正常打开空白对话不会自己产生命令记录；只有你悬停、点击或打开面板时才会查询。

## 隐私与安全

- 记忆保存在本机：`~/.dsh/workspace-memory/<project-hash>/`。
- 只存 `brief.md`、`notes.md`、`state.json`；不存完整对话、推理、图片、原始工具输出。
- 只有你确认 **整理并注入** 时，项目档案才会发给选定的模型提供方；确认层会明确说明。
- 注入块被标记为不可信的历史背景，可能过期；请以文件为准。
- 插件自身没有 telemetry；除了确认后的整理调用，不发起网络请求。
- 这是运行在 Host 的受信任代码。安装前请像审查任何 DSH 插件一样审查源码。

## 它不是什么

它**不是**通用记忆 OS：没有自动召回、后台捕获、向量检索、多模态记忆、模型记忆工具、技能演化、多 Agent 共享、云同步。

如果你需要这些能力，可以使用专门的记忆系统，例如 [MemOS 的 DSH 适配器](https://github.com/MemTensor/MemOS/blob/main/apps/memos-local-plugin/adapters/deepseek-harness/README.md)，或者其他 [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 里的记忆插件。

不要在同一个项目/工作区同时启用两个自动注入器，除非你已经考虑重复上下文和 token 成本。这个插件的价值是相反的取舍：**显式、有界、可审计、默认静默**。

## 兼容性与状态

- 在 macOS Desktop Web profile、DSH `0.2.1-rc.2` 上测试。
- Node.js `>=22.19.0`。
- 无原生依赖、无 build step、无 embedding 模型下载。
- Client bundle 依赖 `remote.commands`（已在 `inject` 中声明）。
- 这是一个 `0.1.x` 早期版本；DSH preview 的 Host API 变化可能需要更新，需要稳定时请固定 release。

## 开发

```bash
cd dsh-workspace-memory
node --test test/*.test.js
node --check index.js
node --check client.js
for f in lib/*.js; do node --check "$f"; done
```

无运行时依赖、无构建步骤。测试覆盖配置边界、会话摘要、compaction summary、注入预算与转义、brief 校验、项目根包含、Client slot 注册，以及 Host 集成测试（状态查询不调用模型、一次确认恰好一次调用、pre-step 在第一条消息后插入）。

模块与数据流见 [docs/architecture.md](docs/architecture.md)。

## 贡献

欢迎 issue 和 PR。请先读 [CONTRIBUTING.md](CONTRIBUTING.md)；安全问题见 [SECURITY.md](SECURITY.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。
