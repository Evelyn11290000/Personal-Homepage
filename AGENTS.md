# AGENTS.md · 仓库级智能体规则（给任何 AI 工具读）

> DeepWorks / WorkBuddy / Cursor / Claude Code 等接手本仓库时，请先读本文件。
> 完整约束见 `DEEPWORKS/RULEBOOK.md`，排期与验收见 `PLAN.md`，提示词见 `DEEPWORKS/PROMPTS.md`。

## 项目
个人主页**期末版**数字分身，截止 2026-12-04。要求：真实调用大模型 API、访客零配置提问、未预设问题也能基于本人资料作答；报告必须写清资料准备、提示词与调优、测试结果、模型厂商型号、后台平台、网页改动。

## 不可违反
1. 正常回答必须来自服务端真实 API 调用，禁止预设问答 / 关键词库 / mock 冒充（离线演示只允许 `?mode=offline` 且显式标注）。
2. API 失败时报错重试，**不回退规则答案**。
3. 密钥只在服务端环境变量 `LLM_API_KEY`；不得进入前端、git、日志、报告。
4. system prompt 由服务端注入，忽略客户端 `role:"system"` 消息；资料不下发浏览器。
5. 资料分层存放于 `twin/knowledge/`，含边界文件；住址/证件/电话/成绩/家庭/对他人的评价不得入库。
6. 后端面向国内访客：不用 `workers.dev` / 需 VPN 的境外免费服务。
7. 一切「已测试 / 已调优 / 命中率」结论必须有 `PROCESS/` 里的原始证据；未跑过就写未执行。
8. `PROCESS/` 记录 **append-only**，禁止覆盖历史版本与日志。
9. 每个动作结束必须输出「记录卡」并真的写入 `PROCESS/`，没有文件写入 = 未完成。
10. 「什么算答对、什么算越界」由人判定，AI 只做自动初筛。

## 目录约定
- `twin/` 后端与 `twin/knowledge/` 资料、`twin/tests/` 测试集
- `twin-config.js` 前端唯一的后端地址配置（部署后只改这一行）
- `chat.html` / `index.html` 前端页面（保留原 Three.js 视觉与结构）
- `PROCESS/` 过程证据，`DEEPWORKS/` 提示词与规则，`REPORT_OUTLINE.md` 报告骨架

## 需要人工确认的动作
部署到云函数、`git push`、发邮件、删除文件。未经确认不得执行。
