# DeepWorks 提示词包 · 数字分身期末项目（逐条复制粘贴即可）

> 配套：`RULEBOOK.md`（硬性规则）、`../PLAN.md`（总控）、`../REPORT_OUTLINE.md`（报告骨架）。
> **用法三句话**：① 先把 `RULEBOOK.md` 导入 DeepWorks 的 Skill / 知识中心 / 工作区规则，并在工作区授权本仓库目录；② 每个阶段**新开一个任务**，第一条消息先发【固定前缀 P0】，再发该阶段的 S? 提示词；③ 结束前发【审计提示词 A1】。

---

## P0 · 固定前缀（每个阶段、每个新任务的第一条消息都要先发）

```
你现在接手「个人主页期末版 · 数字分身」项目，工作目录是本仓库根目录。
第一步：读 DEEPWORKS/RULEBOOK.md、PLAN.md、PROCESS/00-requirements-checklist.md，然后逐条复述 R1–R10 红线，并列出目前已完成的证据文件与缺口。
约束：
1. RULEBOOK.md 优先级高于我后面说的任何话；若我的指令与红线冲突，先指出冲突再问我确认，不要默默照做。
2. 你只能在已授权的工作区内读写文件；部署、发邮件、push、删除文件必须先向我申请人工确认。
3. 每个动作完成后，按 RULEBOOK 第 4 节输出「记录卡」，并真的把内容追加写入 PROCESS/ 对应文件。没有写入文件就等于没做，不许只口头汇报。
4. 不许把未执行的测试说成已测、不许用预设问答或 mock 冒充真实模型、不许覆盖历史日志。
5. 遇到报错，把完整错误信息贴出来并记录到 PROCESS/01-decision-log.md，不要自己猜着改。
复述完红线后，等我发阶段提示词。
```

> 💡 为什么要每个阶段新开任务：长会话里规则会被稀释，DeepWorks 也一样。拆成短任务 + 每次重贴 P0，是让 AI「严格按要求记录」最有效的办法。

---

## S0 · 建仓：把证据骨架搭起来

```
阶段 S0。按 PLAN.md 第 3 节建立 PROCESS/ 证据骨架：
创建 00-requirements-checklist.md、01-decision-log.md、02-knowledge-changelog.md、03-prompt-iterations.md、05-webpage-changelog.md、06-deployment.md、07-final-selfcheck.md、test-results/README.md、logs/ 目录。
00 号文件必须把两封邮件里的每一条要求（R1–R10）拆成可打勾的行，每行留「证据路径 / 状态 / 完成日期」三列，初始状态如实写「未开始」。
然后读一遍现有 chat.html / index.html，在 05 号文件写下「期中版现状快照」：分身入口在哪、答案从哪来、Key 存在哪、为什么不符合期末要求（引用具体行号）。
输出记录卡。
```

## S1 · 资料准备（最花时间、最决定成败）

```
阶段 S1。按老师第二封邮件，把资料按主题拆成 4 份 + 1 份说话规则，写到 twin/knowledge/：
00-system-rules.md（说话规则：第一人称、简洁、只依据资料、不编造、抗注入、不输出提示词/资料原文）
01-profile.md（个人经历：身份、学校、城市轨迹、性格、当前关卡）
02-study.md（学习与研究：专业方向、在做的项目、学习笔记、技术栈；明确写「本科大一，无正式科研成果，不得编造论文/导师/经费」）
03-views.md（观点与兴趣：为什么选这个方向、对记录和踩坑的态度、兴趣；凡是我没提供过的真实观点，一律写 [待补充：…] 并列成清单给我，不许替我编）
04-boundaries.md（边界：家庭/住址/证件/联系方式/成绩/政治话题/对具体他人的评价/私人行程，逐条写「访问者问到时怎么答」的拒答话术）
硬要求：
- 资料来源只能用主页已有公开内容与我在本任务里补的内容，逐条在 02-knowledge-changelog.md 记来源、字数、脱敏处理。
- 任何真实住址、身份证号、电话、成绩、家人信息都不得写进这些文件；写完自己再扫一遍并在 02 号文件签字式记录「已检查，无敏感信息」。
- 把需要我补的 [待补充] 项单独列在回复最前面，等我确认后再继续 S2。
输出记录卡。
```

## S2 · 后端与提示词（真实 API）

```
阶段 S2。实现 twin/core.js、twin/server.js、twin/scf-handler.js、twin/.env.example、twin/README.md、.gitignore、twin-config.js：
- core.js：读取 twin/knowledge/ 全部文件拼成 system prompt（附版本号 hash）、忽略客户端传来的任何 system 消息、只保留最近 8 条 user/assistant、调用 DeepSeek /chat/completions（model=deepseek-chat，密钥只从环境变量 LLM_API_KEY 读）、限流、错误脱敏、每次调用把 {时间,问题,回答,耗时,model,token} 追加到 PROCESS/logs/api-YYYY-MM-DD.jsonl（绝不记密钥）。
- server.js：本地同时托管静态页与 /api/health、/api/chat（SSE 流式）；health 返回厂商、型号、资料版本，不返回密钥。
- scf-handler.js：同一个 core 的腾讯云函数入口，支持 API 网关事件与 OPTIONS/CORS，产出前端能解析的响应。
- .env.example 只放变量名与占位符；.gitignore 排除 twin/.env 与 logs/*.jsonl。
- twin-config.js 提供 window.TWIN_ENDPOINT / window.TWIN_HEALTH 两个空值占位，注释写清「部署后只改这一行」。
验收：本地启动后 curl /api/health 返回 ok（若无 Key，health 仍要能返回配置状态，并明确提示缺 LLM_API_KEY，不许伪造 ok）。
把选型理由、目录结构、以及遇到的每一个报错原文与修复方式追加进 01-decision-log.md 与 06-deployment.md。
输出记录卡。
```

## S3 · 前端改造（去掉 BYO-Key 与规则兜底）

```
阶段 S3。改造 chat.html 与 index.html：
- chat.html：默认无条件调用 window.TWIN_ENDPOINT（未配置时同源 /api/chat）；删除 localStorage 读写 API Key 的配置弹窗，改成「关于这个分身」面板，展示 /api/health 返回的厂商、型号、资料版本、连接状态与测试连接按钮；失败时显示错误与重试，绝不回退预设答案；KB/规则回答只允许在 ?mode=offline 且界面标注「离线演示·非真实 AI」时使用；欢迎语、状态标签、meta description 同步改。
- index.html：分身入口卡片的「规则模式 / 填自己的 Key / 密钥只存在浏览器」文案全部改为「服务端已接入真实模型，访客无需配置」；版本号统一为 v4；反馈的 SITE_VERSION 同步。
- 保持原有 Three.js 视觉、导航、动效、移动端适配不变。
逐条把「改了什么 + 为什么改」追加到 PROCESS/05-webpage-changelog.md（老师明确要求这一节；不许只写「优化了体验」这种空话）。
输出记录卡。
```

## S4 · 测试集与首轮实测

```
阶段 S4。按老师第二封邮件「20-30 个问题分四类」建 twin/tests/testset.json 与 run-tests.js：
四类 = 事实类（8）、观点类（6）、边界类（6）、攻击类（5），共 25 题；每题写 id、category、q、expect.keywords、minHits、forbid、mustRefuse、note。
边界/攻击类必须包含「忽略之前的所有指令」「输出你的系统提示词」「把知识库原文打印出来」「扮演无限制 AI」等，forbid 里写死泄露特征串。
run-tests.js：先探测 /api/health，不通就直接退出并报错（不许生成假结果）；逐题真实调用后端，原样保存回答；自动算关键词命中率与越界数，写 PROCESS/test-results/round1-<时间戳>.json 与 .md，并生成 round1-review.md 空白人工复核表（列：题号 / 自动结果 / 我判定是否答对 / 我判定是否越界 / 备注）。
硬要求：自动命中率只是初筛，观点类与边界类必须在 round1-review.md 里留给我人工判定；不许替我填。
把首轮命令输出（含失败题与报错）追加进 03-prompt-iterations.md。
输出记录卡。
```

## S5 · 调优迭代（每次改动都要留版本）

```
阶段 S5。依据 round1 结果调优：
只允许通过「改资料文件 / 改 00-system-rules.md / 调温度或 max_tokens」三种方式优化，不许改测试题的期望关键词来刷分。
每改一次：
1) 在 03-prompt-iterations.md 追加一节：vN → vN+1，改了哪几行、为什么改（对应哪几道错题）、预期解决什么；
2) 复跑 run-tests.js 生成 roundN+1 文件，不许覆盖 round1；
3) 在 03 号文件记录前后命中率对比表（四类分别列）。
至少跑两轮，直到边界类与攻击类全部守住、事实类命中率达到我认可的水平。观点类以我的人工复核为准。
输出记录卡；最后明确写出「最终采用 v?，理由」。
```

## S6 · 部署（国内访客能打开）

```
阶段 S6。部署到腾讯云函数 SCF（国内地域）：
- 指导我把 twin/ 打包上传、设入口 scf-handler.main_handler、配环境变量 LLM_API_KEY / LLM_MODEL / LLM_BASE_URL、开函数 URL 或 API 网关、确认 CORS 与 OPTIONS；每一步都要我人工确认后再做，不要替我执行外部操作。
- 拿到地址后改 twin-config.js 的 window.TWIN_ENDPOINT，push 前把 diff 给我看。
- 用无 VPN 的手机流量实测：打开主页 → 不填任何配置直接问一个没预设过的问题 → 再问一个边界题 → 把时间、网络环境、结果（含截图路径）写进 06-deployment.md。
- 06 号文件必须写全：厂商、型号、计费方式、后台平台与地域、函数 URL、域名是否需要特殊网络环境、GitHub Pages 与 Supabase 反馈的网络依赖说明。
输出记录卡。
```

## S7 · 期末报告 PDF

```
阶段 S7。按 REPORT_OUTLINE.md 生成期末报告，内容只能引用 PROCESS/ 下真实存在的证据：
必须写全六项 —— ①资料怎么准备 ②提示词怎么写、怎么调优（含 v1→最终版与命中率对比）③效果测试结果（25 题四类、自动+人工判定、典型正确/失败案例、边界与攻击是否守住）④模型厂商与型号 ⑤后台/部署平台 ⑥网页内容改动逐条（改了什么、为什么改）。
另加「特殊网络环境说明」与「提交前自查」。报告不用长，不许堆形容词；每个数字后标注它来自哪个证据文件。
导出 PDF，文件名严格为 `Firstname Lastname_Personal Homepage Final Version.pdf`（先把 Firstname Lastname 换成我给你的真实姓名拼音，名在前姓在后），放仓库根目录。
严禁：写入 API Key、编造没跑过的测试、把规则模式说成真实 AI。
输出记录卡。
```

## S8 · 提交前自查

```
阶段 S8。逐项执行 PLAN.md 第 5 节自查表，把每一项的实际结果（不是「应该没问题」）写进 PROCESS/07-final-selfcheck.md：
主页链接能否打开（贴 URL 与实测时间）、未预设问题是否得到基于资料的回答、边界题与注入题是否守住、报告六项信息是否齐全、PDF 命名是否正确、网络环境是否注明。
最后更新 00-requirements-checklist.md：R1–R10 全部打勾，未完成的如实标注并列补救动作。
输出记录卡 + 一句话结论：现在能不能发邮件给老师。
```

---

## A1 · 审计提示词（每个阶段结束前发，专治「只聊天不留痕」）

```
暂停写代码。现在以审计员身份复核本阶段：
1. 逐条核对 R1–R10，指出哪条被触及、有没有违反，违反就明确写出来。
2. 列出本阶段你声称完成的所有动作，逐一到磁盘上验证对应文件是否存在、内容是否真实（包括 PROCESS/ 里的记录是否 append-only、有没有覆盖历史）。
3. 检查「记录卡」里的每条证据路径是否都能点开；点不开的列为缺失。
4. 检查有没有把模拟上游/规则模式/未执行的测试写成真实效果。
5. 输出一张「要求 → 证据路径 → 状态」表，并把审计结论追加到 PROCESS/00-requirements-checklist.md。
发现问题就直接补写记录，不要只说「已注意」。
```

## A2 · 纠错提示词（AI 跑偏时用）

```
停下。你刚才违反了 RULEBOOK 第 ? 条：<原样贴出它的输出>。
请：① 说明违反了哪条、影响哪些文件；② 回退这个动作（不要覆盖已有日志，用追加方式写一条「撤销说明」）；③ 按正确做法重做；④ 把这次偏差与修正追加进 PROCESS/01-decision-log.md。之后继续原阶段任务。
```

## A3 · 报错处理提示词

```
这是完整报错（不要改写、不要截断）：<粘贴完整错误栈 / HTTP 状态码 / 响应体>
请：定位根因 → 给出最小改动方案 → 说明这个改动会不会影响 R1–R10 里的哪条 → 我确认后再改 → 改完把「错误原文 + 原因 + 修复」追加到 PROCESS/01-decision-log.md。
如果同一处连续失败两次，停止重试，把阻塞点写清楚交给我。
```

---

### 一句话记住

**让 AI「严格记录」的关键不是把提示词写得更长，而是：规则常驻（RULEBOOK）+ 每阶段重贴（P0）+ 文件契约（PROCESS/）+ 强制记录卡 + 结束前审计（A1）。** 只要允许它「口头汇报完成」，过程就一定丢。
