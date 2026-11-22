# 06 · 模型、后台与部署记录

> 老师关注点：接的是哪个厂商的哪个型号、用的哪个后台/部署平台、是否需要特殊网络环境。
> 未部署的字段保持「待填」，不许提前写「已上线」。

## 已确定（2026-11-12）

| 项 | 值 | 证据 |
| --- | --- | --- |
| 语言模型厂商 | **DeepSeek（深度求索）** | `twin/core.js` 默认 `LLM_PROVIDER` |
| 具体型号 | **`deepseek-chat`** | `twin/.env.example`、`/api/health` |
| 接口 | `https://api.deepseek.com/v1/chat/completions` | `twin/core.js` 的 `UPSTREAM` |
| 计费方式 | 按 token 计费；建议先充值 20 元，按老师建议不凑免费档 | `PLAN.md` 第 2 节、`PROCESS/01-decision-log.md` |
| 生成参数 | temperature 0.7 / max_tokens 400 / 超时 30s / 保留最近 8 条对话 | `PROCESS/03-prompt-iterations.md` |
| 密钥存放 | 服务端环境变量 `LLM_API_KEY`（本地 `twin/.env`，线上云函数环境变量） | `.gitignore`、`twin/README.md` |
| 后端实现 | Node.js 零依赖：`twin/core.js` + `twin/server.js`（本地）/ `twin/scf-handler.js`（线上） | 源码 |
| 部署平台（计划） | **腾讯云函数 SCF，国内地域**；备选阿里云函数计算 | `PROCESS/01-decision-log.md` |
| 前端托管 | GitHub Pages（静态），`twin-config.js` 指向函数 URL | `twin-config.js` |
| 不采用 | Cloudflare Workers / `workers.dev` 等境内需 VPN 的境外免费域名 | 老师第二封邮件的踩坑记录 |

## 2026-11-19 · 本地实测（第 2 步，已完成）
- 本地服务：`node --env-file=twin/.env twin/server.js` → `http://127.0.0.1:8787/chat.html`（仅本机可用，别人打不开）。
- `/api/health`：ok=true、provider=DeepSeek、请求型号 deepseek-chat、**响应实际模型 deepseek-flash**、资料版本 `acf8f19b39`。
- 真实对话与 25 题测试均通过；未出现超时、401、429。
- 花费：round1 共 25 次调用，耗时约 25 秒；token 消耗以 DeepSeek 账单为准（金额很小）。

## 2026-11-22 · 云端部署已完成（第 3 步）

| 项 | 值 |
| --- | --- |
| 平台 | 腾讯云函数 SCF，**广州**地域 |
| 函数名称 / 类型 | `evelyn-twin` / 事件函数 |
| 运行环境 | Node.js 18.15 |
| 执行入口 | `scf-handler.main_handler` |
| 代码包 | `twin-deploy.zip`（core.js + scf-handler.js + knowledge/ 5 份） |
| 对外方式 | **函数 URL**：公网访问开启、CORS 全开（Origin/Methods/Headers/Expose 均为 `*`）、参数兼容开启、授权类型开放、日志投递关闭 |
| **函数 URL** | `https://1538277307-00401nev3x.ap-guangzhou.tencentscf.com` |
| 环境变量 | `LLM_API_KEY`（在云函数控制台填，显示星号；值不写进本文件） |
| 校验 | `/api/health` 200、keyConfigured=true、资料版本 `6356db945c`；真实对话正常 |
| 注意 | 域名拼写是 `tencentscf`（不是 `tencentcsf`），拼错会 502 |

## 待填（push 与本人实测）

- [x] 云函数地域 / 函数 URL / 执行入口 / 环境变量 —— 2026-11-22 已完成
- [x] `twin-config.js` 已填函数 URL —— 2026-11-22 已完成（本地）
- [ ] `twin-config.js` **push 到 GitHub**，commit：`___`
- [ ] 无 VPN 手机流量打开主页实测：时间 ___、网络 ___、结果 ___、截图路径 ___
- [ ] 实际消耗（看 DeepSeek 账单）：___ 元
- [ ] 平台侧限流/配额：`___`（可选，代码里已有每分钟 30 次限流）

## 网络环境说明（报告第三节要写）

| 组件 | 位置 | 境内访客是否需要特殊网络 |
| --- | --- | --- |
| 模型接口 `api.deepseek.com` | 国内 | 否，可直连（以实测为准） |
| 分身后端（云函数国内地域） | 国内 | 否 —— 这正是避开 `workers.dev` 的原因 |
| 前端 GitHub Pages `github.io` | 境外 | 个别网络下加载偏慢或偶发不稳，需实测记录 |
| 反馈功能 Supabase（`powpjlyhnyenmdinimzq.supabase.co`） | 境外 | 可能提交失败；**不影响数字分身对话**，但必须在报告注明 |
| 本地联调 `127.0.0.1:8787` | 本机 | 仅开发用，不作为线上后台 |

## 部署实测记录（append-only）
```
## YYYY-MM-DD · 第 ? 次实测
- 网络环境（是否挂 VPN / 设备 / 运营商）：
- 主页链接能否打开：
- 未预设问题 → 回答是否基于资料：
- 边界题是否守住：
- 报错与修复（完整原文）：
```
