# Ready-to-paste listing entries

Replace `libraqg` if the repository lives under another account.

## Awesome DSH Plugin — Memory category

```markdown
- [libraqg/dsh-workspace-memory](https://github.com/libraqg/dsh-workspace-memory) - Explicit, user-triggered project memory for DSH: one confirmed model call curates earlier conversations into a bounded brief and injects it after the first message of a new conversation; no background capture or silent model calls.
```

## One-line repository description

```text
Explicit, project-scoped memory handoff for DeepSeek Harness — one confirmed model call, no silent background calls.
```

## Short launch post (Chinese)

```text
新对话总要从头交接？我写了一个 DSH 插件：dsh-workspace-memory。

它只在同一个项目里新开非首个对话时出现“注入记忆”按钮。点击后先看确认层：来源对话、整理模型、输入/输出/注入 token 估算，确认后才调用一次模型，把旧对话整理成一份 brief，等你发出第一条消息时注入。

- 没有后台捕获，没有每轮自动召回
- 一次确认 = 一次模型调用
- 项目级隔离，子目录共享
- 复用 DSH compaction summary
- notes 原样保留
- 零原生依赖，纯本地文件
- 失败不注入、不自动重试

开源 MIT：https://github.com/libraqg/dsh-workspace-memory

演示视频见仓库 README。它不是通用记忆 OS；如果你要自动召回/向量检索，MemOS 的 DSH 适配器更合适。这个插件解决的是“我明确想交接时才交接，且成本可见”。
```
