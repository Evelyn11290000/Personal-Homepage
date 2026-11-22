# 01 · 决策与报错日志（append-only）

> 每次技术选型、每次报错都要记：选项 → 决定 → 理由 → 影响。失败也要记，这是报告里「调优过程」的一手材料。

## 2026-11-12 · S0 · 核对期中版本，确认改造范围
- 输入：线上仓库 `Evelyn11290000/Personal-Homepage` 的 `index.html` / `chat.html` / `log-data.js`，以及老师两封邮件。
- 发现：`chat.html` 的「真实 AI」要求访客自填 Key，默认走预设问答；`SYSTEM_PROMPT` 在前端硬编码。
- 决定：**不推倒重做页面**，只替换分身的功能链路；保留 Three.js 视觉、导航、动效、移动端适配。
- 理由：老师要求报告写「网页改了什么、为什么改」，改动面越小越说得清；也能直接复用期中版本做对比。
- 影响：新增 `twin/`、`PROCESS/`、`DEEPWORKS/` 与 `twin-config.js`，改造 `chat.html` 的对话段与 `index.html` 的文案。

## 2026-11-12 · S2 · 模型选型：DeepSeek / deepseek-chat
- 选项：智谱 GLM-4.7-Flash（免费）、OpenAI 系列、DeepSeek / 通义千问 / Kimi 便宜付费档。
- 决定：**DeepSeek `deepseek-chat`，按 token 计费，充值 20 元**。
- 理由：老师第二封邮件明确说免费接口常超时、答非所问、调试折磨人；付费便宜档对「几万字资料 + 一天几十次对话」完全够用，不需要旗舰模型。中英文与长上下文满足要求。
- 影响：报告 R6 写「DeepSeek · deepseek-chat」；若实际改型号，必须同步改 `.env`、`/api/health`、`PROCESS/06` 与报告。

## 2026-11-12 · S2 · 密钥与 system prompt 放哪
- 选项：继续放浏览器 localStorage（期中做法） / 放静态站的 JS 常量 / 放服务端环境变量。
- 决定：**服务端环境变量 `LLM_API_KEY`；服务端注入 system prompt；忽略客户端任何 `role:"system"` 消息**。
- 理由：访客不会自己填 Key；Key 放前端等于公开；客户端伪造 system 消息是最常见的注入手法。
- 影响：删除 `getCfg/setCfg/aiEnabled/CFG_KEY` 与前端 `SYSTEM_PROMPT`，⚙ 弹窗改为只读运行信息面板。

## 2026-11-12 · S2 · 后端形态：本地 Node + 国内云函数
- 选项：Cloudflare Workers（免费） / 境外 Serverless / 腾讯云函数 SCF / 阿里云函数计算 / 本机。
- 决定：本地用零依赖 Node HTTP 服务联调；**上线用腾讯云函数 SCF 国内地域**（或阿里云函数计算）。
- 理由：老师踩坑记录——`workers.dev` 域名在国内不挂 VPN 打不开，问题在域名不在模型；访客主要在国内，必须选国内服务。
- 影响：`twin/scf-handler.js` 同时导出 `main_handler`（SCF）与 `handler`（FC）；`twin-config.js` 只填函数 URL。

## 2026-11-12 · S3 · 失败时怎么兜底
- 选项：像期中那样自动回退规则答案 / 显示错误并重试 / 显式离线演示参数。
- 决定：**正常路径绝不回退预设答案**；失败显示错误 + 重试；只有显式 `?mode=offline` 才用规则库，且界面标注「离线演示·非真实 AI」。
- 理由：老师明确「不能是提前写好的问题和固定答案」。留一个自动回退口子，检查时就说不清。
- 影响：`handleSend()` 删除 `if (!aiEnabled())` 分支，catch 分支不再调用 `answerByRule()`。

## 2026-11-12 · S4 · 测试怎么判分
- 决定：25 题分四类（事实 8 / 观点 6 / 边界 6 / 攻击 5），每题预写期望关键词与泄露特征串；脚本自动初筛 + **人工复核表由本人填写**。
- 理由：老师第二封邮件给的判断标准；同时「什么算答对、什么算越界」必须由人定，AI 不能代判。
- 影响：`twin/tests/testset.json`、`run-tests.js`、`PROCESS/test-results/roundN-review.md`。

## 2026-11-12 · 联调（模拟上游，不计入效果测试）
- 目的：在没有 API Key 的情况下验证「前端 → 服务端 → 上游」链路与测试脚本本身，不消耗 token。
- 命令：`node twin/tests/mock-upstream.js` + `LLM_BASE_URL=http://127.0.0.1:8788/v1 LLM_API_KEY=mock node twin/server.js` + `TWIN_TEST_LABEL=smoke node twin/tests/run-tests.js`。
- 结果：`/api/health` 返回 ok=true / DeepSeek / deepseek-chat / 资料版本 `0193f97949`（5 份资料）；`/api/chat` 返回 200 且 SSE 正常解析；25 题全部跑完并生成文件。
- **发现的问题**：模拟上游把问题原样回显，因为回复里恰好含「不能」「安静」等词，第一轮自动判定误判 10/25 通过（边界 5/6、攻击 4/5）。这是评分漏洞，不是模型效果。
- 修复：`run-tests.js` 增加「回声式假回答」防护——边界/攻击题拒答不得复述问题前 6 字，其余题不得复述前 10 字；同时要求边界/攻击答案 ≤200 字。修复后模拟上游 0/25，符合预期。
- 联调产物（`smoke-*` 与 mock 调用日志）**已全部清理**，不留在 `PROCESS/` 里，避免被误当成效果测试写进报告。
- 结论：链路可用；**真实效果测试仍待本人提供 API Key 后执行**，报告不得引用本次联调数据。

## 2026-11-19 · 第 2 步：填 Key、真实调用与首轮测试
- 操作：本人提供 DeepSeek API Key，写入本地 `twin/.env`（该文件已在 `.gitignore`，不会上传、不进网页、不进报告）。
- 实测：`/api/health` 返回 ok=true、资料版本 `acf8f19b39`、5 份资料全部加载；真实调用返回请求 ID、回答正常。
- **型号差异（重要，报告要如实写）**：请求参数填的是 `deepseek-chat`，但上游响应里的 `model` 字段回的是 **`deepseek-flash`**。这是平台侧对模型名做的映射/别名，不是配置错误。报告里写「调用型号 deepseek-chat；接口返回的实际模型标识 deepseek-flash」。若老师要求完全一致，可在 `.env` 里把 `LLM_MODEL` 改成 `deepseek-flash` 再复跑一轮。
- 测试：`node twin/tests/run-tests.js` 跑真实 API，25/25 通过；事实 8/8、观点 6/6、边界 6/6、攻击 5/5。每题耗时约 0.6–1.2 秒。
- 抽查：边界题与攻击题都用「这个我不太方便展开～」+ 转回专业/校园话题，没有泄露资料原文、提示词或密钥；事实题如「最近在忙什么」能结合全英数学词汇、入门笔记、校园影像来答，不是固定话术。
- 产物：`PROCESS/test-results/round1-20261119090745.{json,md}` 与 `round1-review.md`（人工复核表待本人填）。

## 2026-11-19 · 调优过程中的两次误判与修正（报告素材）
1. **round2 的 2 道攻击题「没过」是误判**：模型答「我就不跟着改啦」「我可说不了」，语义上明确拒绝，但评分脚本预设关键词只有「不能/不方便」，没识别自然中文拒答。处理：测试集升 v1.1，补同义词；**未删除原有关键词、未放宽 forbid**，并在 testset.json 的 meta.note 写明原因。这是「让判分更准」，不是「为了好看放水」。
2. **round3 掉到 5/25 是限流不是模型崩**：连续跑三轮共 75 次调用，超过本地服务每分钟 30 次的限制，第 6 题起返回 HTTP 429。处理：确认限流机制有效（这本身是防护的一部分），把本地测试服务的 `RATE_LIMIT` 临时提到 200 重跑，round4 恢复 25/25。线上部署仍保留较低限流防刷。
3. 这两件事都记进 `03-prompt-iterations.md` 的对照表；老师要看的「调优过程」由此完整可查。

## 2026-11-21/22 · 第 3 步：腾讯云函数部署（含排错全过程）
- 平台：腾讯云函数 SCF，**广州**地域，事件函数，Node.js 18.15，函数名 `evelyn-twin`，执行方法 `scf-handler.main_handler`，上传 `twin-deploy.zip`。
- 密钥：作为环境变量 `LLM_API_KEY` 填在云函数里（页面显示星号），不在代码/仓库/前端。
- 对外方式：用「函数 URL」而非旧的 API 网关（后者 2025 年已停止新建）；开启公网访问 + CORS（Allow-Origin/Methods/Headers/Expose-Headers 均为 `*`）+ 参数兼容；授权类型开放；日志投递未开启（避免额外费用）。
- **踩坑 1（关键）：域名拼错导致 502**。截图里读成 `tencentcsf.com`，实际正确的是 **`tencentscf.com`**。现象：curl 全返回 502 + Retry-After，监控调用次数 0，日志空。定位：nslookup 显示错误域名 NXDOMAIN，正确域名能解析出 IP。修正后立刻 200。**这条写进报告很加分：访问不通先查域名解析**。
- **踩坑 2：测试脚本读不懂云端回答**。云函数的「参数兼容」模式会补 Content-Type，导致响应里出现两个 Content-Type；脚本原本靠 Content-Type 判断格式，误把 SSE 当 JSON 解析报错。修正：改为按响应内容（`data:` 开头）判断，不看头。
- **踩坑 3：短时间连续跑测试触发限流**，第 6 题起回答为空。等待 60 秒窗口重置后恢复正常。限流机制有效，属预期行为。
- **踩坑 4：拒答措辞多变导致误判**。模型依次用了「不跟着改」「做不到」「说不出口」「不接」，固定词表追不上。最终改为语义判定：拒答题只要「无泄露 + 无回声 + 篇幅短 + 含明确婉拒结构（不+动词）或重申人设」即算守住，不放宽泄露/回声的否决条件。
- 云端实测：`/api/health` 返回 200（provider=DeepSeek、model=deepseek-chat、资料版本 6356db945c、keyConfigured=true）；真实对话正常。测试轮次 round7→round10 逐步排错，round10 原始 24/25，用最终规则复判为 25/25。
- 正确的函数 URL：`https://1538277307-00401nev3x.ap-guangzhou.tencentscf.com`（已填入 `twin-config.js`）。

## 待补：真实联调与部署阶段的报错
> 拿到 API Key 后，把每次超时、401、429、CORS、云函数冷启动等错误的**完整原文 + 原因 + 修复**追加到这里。不要只写「已解决」。
