# 00 · 老师要求核对表（唯一权威进度表）

> 规则：状态只能是 `✅已完成且有证据` / `⚠️部分完成` / `⬜未开始`。**不许把没跑过的写已完成**。
> 每次阶段结束追加一条更新记录，不要覆盖本表历史。

## 期中版现状快照（2026-11-12，改造前拉仓库核对）
- 分身入口：`index.html` 导航「分身」→ `chat.html`；首页有分身卡片与 Hero 按钮。
- 答案来源：`chat.html` 的 `KB` 关键词库 + `FALLBACK` 固定话术（改造前 3483–3498 行）。
- 真实 AI 路径：要求访客在 ⚙ 弹窗自填 Base URL / API Key / 模型名，存 `localStorage`（改造前 3511–3528 行）；未配置就走 `answerByRule()`（3648–3656 行）。
- 人设：`SYSTEM_PROMPT` 硬编码在前端（3532–3550 行）。
- 结论：**符合期中「预留位置」要求，不符合期末「真正接入」要求**。

## 要求 → 证据 → 状态

| # | 要求（两封邮件逐条拆） | 证据路径 | 状态 | 完成日期 |
| --- | --- | --- | --- | --- |
| R1 | 真正调用语言模型 API | `twin/core.js`、`twin/server.js`、`PROCESS/logs/api-*.jsonl` | ✅ 2026-11-19 真实调用成功，有请求 ID 与回答日志 | 2026-11-19 |
| R2 | 访客零配置提问；不能是预设问题与固定答案 | `chat.html` 发送流程、`PROCESS/05-webpage-changelog.md` | ✅ 前端链路已改（待部署后实测） | 2026-11-12 |
| R3 | 资料怎么准备（分主题、脱敏） | `twin/knowledge/*.md`、`PROCESS/02-knowledge-changelog.md` | ✅ 5 份已写；4 条本人观点已于 2026-11-19 补齐 | 2026-11-19 |
| R4 | 提示词怎么写、怎么调优 | `twin/knowledge/00-system-rules.md`、`PROCESS/03-prompt-iterations.md` | ⚠️ v1 已写，尚无 round1/round2 对比 | 2026-11-12 |
| R5 | 效果测试：准不准、守不守得住 | `twin/tests/testset.json`、`PROCESS/test-results/round*.md` | ✅ 最终 round6 自动 25/25（资料 v3）；边界6/6、攻击5/5守住；**待本人人工复核** | 2026-11-21 |
| R6 | 模型厂商 + 型号 | `PROCESS/06-deployment.md`、`/api/health` | ✅ 实测 DeepSeek；请求型号 deepseek-chat，响应实际型号 deepseek-flash（见决策日志） | 2026-11-19 |
| R7 | 后台 / 部署平台 | `PROCESS/06-deployment.md`、`twin/scf-handler.js` | ✅ 腾讯云 SCF 广州 / 事件函数 / Node 18.15 / 函数 URL，云端实测 200 | 2026-11-22 |
| R8 | 网页内容改动：改了什么、为什么 | `PROCESS/05-webpage-changelog.md` | ✅ 12 条逐项已记 + 明确列出未改动项 | 2026-11-12 |
| R9 | 特殊网络环境注明 | `REPORT_OUTLINE.md` 第三节、`PROCESS/06-deployment.md` | ⚠️ 已知依赖已列，待部署后补实测 | 2026-11-12 |
| R10 | 提交：主页链接 + PDF（规定文件名） | `PROCESS/07-final-selfcheck.md` | ⬜ 未开始 | — |
| R11 | 提交前自查：点一遍主页、分身能对话 | `PROCESS/07-final-selfcheck.md` | ⬜ 未开始 | — |
| R12 | 报告写清「与期中版本相比未做改动」的项（若有） | `REPORT_OUTLINE.md` 第二节第 9 行 | ✅ 已写明主题/排版/结构未改 | 2026-11-12 |

## 更新记录
- `2026-11-12 · S0 · 建立核对表，读取线上仓库逐行核定期中现状`：新增本表与全部证据骨架。
- `2026-11-12 · S1–S4 · 完成资料、后端、前端、测试集骨架`：R1/R2/R3/R4/R6/R8/R9/R12 状态如上，未跑过的项保持未开始。
- `2026-11-12 · 联调（模拟上游）`：health / SSE / 25 题脚本全部跑通；产物已清理，未计入效果测试。
- `2026-11-19 · 第 2 步：填 Key + 真实调用 + round1`：Key 写入本地 `twin/.env`（已 gitignore）；真实 API 返回正常；25 题自动初筛 25/25；R1/R5/R6 改已完成，R5 仍待本人人工复核。
- `2026-11-22 · 第 3 步：腾讯云 SCF 部署完成`：函数 URL 公网可用、真实对话通过；排错全过程（域名拼错 502 / 测试脚本格式 / 限流 / 拒答措辞）见 `01-decision-log.md`；R7 改已完成。**待 push 到 GitHub + 无 VPN 实测**。
