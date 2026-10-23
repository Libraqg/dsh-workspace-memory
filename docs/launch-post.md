# 新对话不必从头交接：dsh-workspace-memory

> 一个为 DeepSeek Harness 做的显式项目记忆插件：一次确认，一次模型调用，没有静默后台调用。

## 问题

同一个项目里，工作往往分散在很多个 DSH 对话里。你在同一个工作目录新开一个对话时，新 agent 不知道上一个对话做了什么：目标、决策、改过哪些文件、还剩什么没做，都得重新讲一遍。

`AGENTS.md` 是静态的；会话搜索要模型主动去搜；通用记忆系统通常会自动召回、自动捕获——这对长期记忆很好，但你对“什么时候调用模型、花多少 token”几乎没有控制。

## 这个插件做什么

当同一个项目里已经有对话，你再新开一个非首个对话时，页面会出现 **注入记忆** 按钮：

1. 悬停：看来源对话、整理模型、输入/输出/注入 token 估算。
2. 点击：确认层，仍然不会调用模型。
3. 确认：**恰好一次**模型调用，把旧对话整理成一份项目 brief。
4. 你发送第一条消息：brief 插到消息之后，随正常请求发送。

## 核心优势

- **没有静默模型调用**：页面加载、打开面板、创建会话、轮次结束、定时器、失败重试，全部 0 次模型调用。
- **先看成本，再决定**：确认层明确显示来源、模型、输入估算、输出上限、注入估算，以及“摘要会发送给模型提供方”。
- **一次确认 = 一次调用**：整理和生成注入内容由同一次调用完成；注入是本地步骤。没有隐藏的第二次调用，也没有 maxTokens 截断后的偷偷重试。
- **项目级隔离**：工作区根 > 最近 Git 根 > 当前目录；子目录会话共享，不同项目隔离。
- **复用 DSH 压缩摘要**：旧对话有 compaction summary 时优先复用它，质量更好、输入更省。
- **notes 不被改写**：`notes.md` 原样插入；整理模型被明确要求不要改写。
- **零原生依赖**：纯 Node.js ESM，没有 SQLite/ONNX/embedding 下载，没有 build script 审批；存储只是几个本地文件。
- **失败就失败，不偷偷重试**：失败、超时、输出不合格：报错，不注入，不换模型，不自动降级。
- **可审计**：brief、notes、state 在 `~/.dsh/workspace-memory/`；侧边栏面板可查看、编辑、重置。
- **中英双语 UI**：确认层和面板跟随 DSH locale。

## 安装

```bash
dsh plugin --profile desktop add github:libraqg/dsh-workspace-memory
```

Web profile 把 `desktop` 换成 `web`。安装后重启 DSH profile，刷新页面。

无原生依赖，无需 build script 审批。

## 它不是什么

它不是通用记忆 OS：没有自动召回、后台捕获、向量检索、多模态、模型记忆工具、技能演化、多 Agent 共享、云同步。

如果你需要这些能力，可以使用 [MemOS 的 DSH 适配器](https://github.com/MemTensor/MemOS/blob/main/apps/memos-local-plugin/adapters/deepseek-harness/README.md) 或其他 [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 里的记忆插件。

这个插件解决的是相反的问题：**我明确想交接时才交接，且成本可见。**

## 链接

- 仓库：<https://github.com/libraqg/dsh-workspace-memory>
- 演示：仓库 README 中的 GIF / MP4
- 许可证：MIT

如果这个插件对你有帮助，欢迎 Star、试用、提 Issue，或者把它推荐给同样被“新对话从头交接”困扰的人。
