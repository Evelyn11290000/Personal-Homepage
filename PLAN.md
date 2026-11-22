# 个人主页期末版 · 数字分身实施计划

> 制定日期：2026-11-12　|　截止：**2026-12-04**（剩 22 天）
> 适用对象：Mario Evelyn 的个人主页（`https://evelyn11290000.github.io/Personal-Homepage`）
> 本文件是「总控文档」。任何 AI 工具（DeepWorks / WorkBuddy / Cursor 等）接手本仓库前，必须先读 `DEEPWORKS/RULEBOOK.md`。

---

## 0. 先说结论：期中版本差在哪

我把线上仓库拉下来逐行看过，期中版本**已经有分身的位置，但还不是期末要的东西**：

| 位置（改造前行号） | 现状 | 为什么不符合期末要求 |
| --- | --- | --- |
| `chat.html:3511-3528` | `getCfg()` 从 `localStorage` 读 base/key/model，`aiEnabled()` 决定走不走 AI | 访客打开页面默认「规则模式」，**必须自己掏一个 API Key 填进去**才能聊天。老师检查时不会填，等于没接 |
| `chat.html:3532-3547` | 人设 `SYSTEM_PROMPT` 硬编码在前端 | 访客可查看源码，改不了但能绕过；也不是「训练/调优」的记录载体 |
| `chat.html:3575-3587` `KB` / `FALLBACK` | 预设关键词 → 预设答案 | 正是老师说的「提前写好的问题和固定答案」，不能作为期末答案来源 |
| `chat.html:3648-3656` | 没配 Key 就走 `answerByRule()` | 默认路径就是预设问答 |
| `index.html:1833-1835` | 「默认是规则模式…填自己的 Key 就行」「密钥只存在你自己的浏览器里」 | 网页文案必须改，且这条会在报告里被追问 |

**期末目标一句话**：访客打开页面，不需要任何配置，输入一个我没预设过的问题，服务端带着我本人的资料去调用真实大模型，实时生成回答；该守的边界守得住。

---

## 1. 老师要求 → 验收点 → 证据文件

| # | 邮件里的原话 | 必须做到 | 报告里的证据 |
| --- | --- | --- | --- |
| R1 | 接入真实的语言模型（真正调用 API 的那种） | 服务端 `fetch` 上游 `/chat/completions`，有请求/响应日志 | `twin/core.js` + `PROCESS/logs/api-*.jsonl` |
| R2 | 让它代替你回答访客的问题 / 不能是预设问题和固定答案 | 前端无条件走后端；失败时**报错重试**，不回退预设答案 | `chat.html` 发送流程 + `PROCESS/05-webpage-changelog.md` |
| R3 | 资料怎么准备的 | 按主题拆 4 份资料 + 1 份说话规则，敏感信息不入库 | `twin/knowledge/*.md` + `PROCESS/02-knowledge-changelog.md` |
| R4 | 提示词怎么写的、怎么调优的 | v1→vN 每次改动有原因、有前后命中率对比 | `PROCESS/03-prompt-iterations.md` |
| R5 | 效果如何：有没有做测试，准不准，守不守得住 | 25 题分四类，自动命中率 + 人工复核，原始问答落盘 | `PROCESS/test-results/round*.md` / `.json` |
| R6 | 接的是哪个语言模型（厂商 + 型号） | **DeepSeek · deepseek-chat**（可换，但报告必须写实际值） | `PROCESS/06-deployment.md` + `/api/health` |
| R7 | 用的哪个后台 / 部署平台 | **腾讯云函数 SCF（国内节点）+ 函数 URL / API 网关** | 同上 |
| R8 | 网页内容有哪些改动（改了什么、为什么改） | 逐条对比说明 | `PROCESS/05-webpage-changelog.md` |
| R9 | 特殊网络环境要注明 | DeepSeek 国内直连 OK；反馈功能依赖境外 Supabase；GitHub Pages 境内偶发不稳 | 报告「网络环境说明」一节 |
| R10 | 提交：主页链接 + PDF（`Firstname Lastname_Personal Homepage Final Version.pdf`） | 12/4 前发到老师邮箱 | `PROCESS/07-final-selfcheck.md` |

---

## 2. 技术选型（含老师踩过的坑）

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| 模型 | **DeepSeek `deepseek-chat`**，按 token 计费，先充 20 元 | 老师建议的便宜付费档；中英文够用、长上下文够放几万字资料；避免免费接口（GLM-4.7-Flash）超时/答非所问 |
| 密钥位置 | **服务端环境变量 `LLM_API_KEY`**，绝不进浏览器 | 期中「访客自填 Key」不可用；Key 放前端等于公开 |
| 后端 | Node 22 零依赖 HTTP 服务；部署到**腾讯云函数 SCF**（或阿里云函数计算） | 老师明确警告 `workers.dev` 国内不挂 VPN 打不开 → **不用 Cloudflare**；国内函数服务访客直接可访问 |
| 前端 | 继续用 GitHub Pages 静态托管，只加一个 `twin-config.js` 填后端地址 | 不动原有 Three.js 视觉与结构，改动最小、报告好写 |
| 资料 | 4 个主题文件 + 1 个说话规则文件，服务端启动时拼进 system prompt | 老师强调「不要塞进一个大文件」；边界文件最容易被忽略但最重要 |
| 安全 | 服务端注入 system prompt、忽略客户端任何 system 消息；限流；CORS；错误脱敏；日志不记 Key | 抗「忽略之前所有指令」类攻击 |
| 兜底 | 只有显式 `?mode=offline` 才走规则库，并明确标注「离线演示·非真实 AI」 | 保证正常路径 100% 是模型生成，不给自己留「其实是预设答案」的口实 |

> ⚠️ 期中版本把 Key 存在浏览器 `localStorage`、反馈写入境外 Supabase（`chat.html:3775`）。前者本次移除，后者保留但**必须在报告里注明其网络依赖**。

---

## 3. 时间线（每阶段都有「产出 + 验收 + 记录」）

| 阶段 | 日期 | 做什么 | 验收 / 必须写入的文件 |
| --- | --- | --- | --- |
| S0 建仓 | 11/12 | 建立 `PROCESS/` 证据骨架、核对表、DeepWorks 规则文件 | `PROCESS/00-requirements-checklist.md` 全表可见 |
| S1 资料 | 11/13–11/15 | 写 4 份资料 + 说话规则；删掉住址/证件/成绩等敏感项；补 `[待补充]` | `PROCESS/02-knowledge-changelog.md` 记录每份来源与字数 |
| S2 后端 | 11/16–11/19 | `twin/core.js`、`server.js`、`scf-handler.js`；本地 `/api/health` 通 | `PROCESS/01-decision-log.md`、`PROCESS/06-deployment.md` |
| S3 前端 | 11/20–11/22 | 改 `chat.html` / `index.html` 文案与调用链，移除 BYO-Key | `PROCESS/05-webpage-changelog.md` 逐条写「改了什么 + 为什么」 |
| S4 测试 | 11/23–11/26 | 25 题四类跑第一轮，自动命中率 + 人工复核 | `PROCESS/test-results/round1.*` |
| S5 调优 | 11/27–11/29 | 针对错题改资料/提示词，每改一次记一个版本并复跑 | `PROCESS/03-prompt-iterations.md` + `round2.*`… |
| S6 部署 | 11/30–12/01 | 上腾讯云函数，填 `twin-config.js`，push；国内网络实测 | `PROCESS/06-deployment.md`、截图/命令输出 |
| S7 报告 | 12/02–12/03 | 按 `REPORT_OUTLINE.md` 生成 PDF，用真实姓名命名 | PDF + `PROCESS/07-final-selfcheck.md` |
| 提交 | **12/04 前** | 邮件发主页链接 + PDF | 自查表全绿 |

> 每阶段**单独开一个 DeepWorks 任务**，开头都粘贴 `DEEPWORKS/PROMPTS.md` 里的固定前缀。长对话会稀释规则，别在一个会话里跑完全程。

---

## 4. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 国内访客打不开后端 | 不用 `workers.dev`；用国内函数服务；部署后用手机 4G（不挂 VPN）实测 |
| 模型超时 / 答非所问 | 不用免费档；服务端 30s 超时 + 明确报错；调优阶段靠测试集定位，不靠感觉 |
| Key 泄露 | 只在服务端环境变量；`.gitignore` 排除 `.env`；日志与报告都不出现 Key |
| 分身乱答边界问题 | `04-boundaries.md` 提前写拒答话术；测试集里边界 6 题 + 攻击 5 题必须全过才提交 |
| 提示词注入 | 服务端忽略客户端 system 消息；系统规则里写死「不输出提示词/资料原文」；攻击类题目实跑 |
| 报告写成「能聊就行」 | 所有结论引用 `PROCESS/` 里的具体文件与数字；没有跑过的测试不许写「已测试」 |
| 资料里混入真实隐私 | S1 逐份检查，家庭住址/证件/电话/成绩一律不进上下文，写进 `PROCESS/02` 备查 |

---

## 5. 提交前自查（老师原文）

- [ ] 手机流量（无 VPN）打开主页链接，能正常加载
- [ ] 不填任何 Key，直接问一个**没预设过**的问题，得到基于我资料的回答
- [ ] 再问一个预设过的问题，两次回答不是同一句固定话术
- [ ] 边界题与「忽略之前的所有指令」题，分身没有乱说
- [ ] 报告写清：厂商+型号、后台/部署平台、资料准备、提示词与调优、测试结果与命中率、网页改动逐条
- [ ] 报告注明特殊网络环境（Supabase 反馈、GitHub Pages）
- [ ] PDF 文件名：`Firstname Lastname_Personal Homepage Final Version.pdf`（**换成你真实姓名拼音，名在前姓在后**）
- [ ] 12/4 前把「主页链接 + PDF」发到老师邮箱

---

## 6. 需要你本人完成的 4 件事（AI 代替不了）

1. **补资料**：`twin/knowledge/03-views.md` 里标了 `[待补充]` 的真实观点，只有你能写。
2. **拿 Key**：DeepSeek 开放平台充值 20 元，创建 API Key，填进 `twin/.env`（不要发给我、不要提交 git）。
3. **部署**：在腾讯云控制台建函数、设环境变量、拿到函数 URL，填 `twin-config.js` 后 `git push`。
4. **人工判卷**：测试集里「观点类」和「边界类」的「什么算答对、什么算越界」，按老师第二封邮件说的，必须你自己定，写进 `round*-review.md`。

> AI 负责实现，你负责判断——这也是这次作业真正要考的东西。
