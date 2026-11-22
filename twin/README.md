# twin/ · 数字分身服务端

零第三方依赖，Node ≥ 18。目录结构：

```
twin/
├── core.js          资料拼装 / 消息清洗 / 真实 API 调用 / 限流 / 证据日志
├── server.js        本地：静态主页 + /api/health + /api/chat（SSE 流式）
├── scf-handler.js   线上：腾讯云函数 SCF / 阿里云函数计算入口
├── knowledge/       00 说话规则 + 01 个人经历 + 02 学习研究 + 03 观点兴趣 + 04 边界
├── tests/           25 题测试集与评分脚本
└── .env.example     环境变量模板（复制成 .env，不要提交）
```

## 1. 本地跑通（不花钱的联调）

```bash
cp twin/.env.example twin/.env      # 编辑 .env，填 LLM_API_KEY
node --env-file=twin/.env twin/server.js
# 浏览器打开 http://127.0.0.1:8787/chat.html
curl http://127.0.0.1:8787/api/health
```

`health` 返回厂商、型号、资料版本 `knowledgeVersion`、是否已配置密钥；**不返回密钥**。
没有 Key 时 `status: missing_key`，前端会显示「服务未配置」，不会假装能用。

## 2. 跑测试集

```bash
node twin/tests/run-tests.js                       # 默认打本地 8787
TWIN_BASE=https://<函数URL> node twin/tests/run-tests.js   # 打线上
```

结果写入 `PROCESS/test-results/roundN-<时间戳>.json/.md`，并生成 `roundN-review.md` 空白人工复核表。
脚本会先探测 health，不通就直接退出——**不会生成假结果**。

只想验证链路、不想烧 token 时，可用模拟上游（结果明确标注「联调，不计入效果测试」）：

```bash
node twin/tests/mock-upstream.js &                # 8788 端口
LLM_BASE_URL=http://127.0.0.1:8788/v1 LLM_API_KEY=mock \
  node twin/server.js
TWIN_TEST_LABEL=smoke node twin/tests/run-tests.js
```

## 3. 部署到腾讯云函数 SCF（国内访客可直连）

> 老师第二封邮件的坑：`workers.dev` 在国内不挂 VPN 打不开，问题在域名不在模型。**不要用 Cloudflare**。

1. 控制台新建函数 → 运行环境 Node.js 18/20 → 地域选**国内**（广州/上海等）。
2. 打包上传：保持 `twin/` 目录结构，至少包含 `core.js`、`scf-handler.js`、`knowledge/` 全部 md。
   本地日志目录在云函数里可能是只读的，`core.logRecord()` 已做容错，不会因此中断对话。
3. 执行入口填 `scf-handler.main_handler`（阿里云 FC 用 `scf-handler.handler`）。
4. 环境变量：`LLM_API_KEY`（必填）、`LLM_MODEL=deepseek-chat`、`LLM_BASE_URL=https://api.deepseek.com/v1`。
5. 创建**函数 URL**或 API 网关触发器，放行 `GET/POST/OPTIONS`，响应头已带 CORS。
6. 把地址填进仓库根目录 `twin-config.js`：`window.TWIN_ENDPOINT = '<地址>/api/chat'`，push。
7. 用**手机流量、不挂 VPN** 实测：打开主页 → 不填任何配置提问 → 问边界题 → 记录到 `PROCESS/06-deployment.md`。
8. 平台侧再配一层限流/配额，防止 Key 被刷（内存限流只管单实例）。

## 4. 密钥与隐私

- Key 只在服务端环境变量；前端 `chat.html`、仓库、`PROCESS/`、报告里都不出现。
- 客户端传来的 `role: "system"` 消息会被 `core.prepare()` 丢弃，system prompt 只由服务端注入。
- 资料文件不含住址、证件、电话、成绩、家人信息；见 `knowledge/04-boundaries.md`。
- 每次真实调用会往 `PROCESS/logs/api-YYYY-MM-DD.jsonl` 追加一行（问题、回答、耗时、模型、token），供报告引用；`LOG_FULL=0` 可只留摘要。

## 5. 改了资料或提示词之后

服务端每次请求都会重读 `knowledge/`，**不需要重启**（云函数需重新上传）。
但按 `DEEPWORKS/RULEBOOK.md`：每次改动都要追加到 `PROCESS/03-prompt-iterations.md`，并复跑一轮测试生成新的 `roundN` 文件，不许覆盖旧轮次。

## 6. 常见报错

| 现象 | 原因 / 处理 |
| --- | --- |
| `服务端未配置 LLM_API_KEY` | `.env` 没填或云函数环境变量没设；别把 Key 塞进前端 |
| `上游返回 HTTP 401` | Key 无效或欠费；去 DeepSeek 控制台核对 |
| `上游返回 HTTP 429` | 触发上游限流；等一会儿，或降低 `RATE_LIMIT` |
| 页面显示「服务未连接」 | `twin-config.js` 地址没填/填错，或云函数没放行 OPTIONS/CORS |
| 回答像客服 / 编造经历 | 改 `knowledge/00-system-rules.md` 与 `01/02`，记进提示词迭代日志再复测 |
| 国内打不开 | 检查是不是用了境外域名；换国内函数服务并用手机流量实测 |
