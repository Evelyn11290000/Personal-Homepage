'use strict';
/**
 * 数字分身 · 服务端核心
 * ------------------------------------------------------------------
 * 职责：拼装 system prompt（资料 + 说话规则）、清洗客户端消息、
 *       调用真实大模型 API、限流、记录调用证据。
 * 红线：密钥只在服务端；忽略客户端 system 消息；资料不下发浏览器；
 *       日志绝不记录密钥。详见 ../DEEPWORKS/RULEBOOK.md。
 * 依赖：Node >= 18（使用内置 fetch），零第三方包。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const KDIR = path.join(__dirname, 'knowledge');
const LOG_DIR = path.join(REPO, 'PROCESS', 'logs');

const PROVIDER = process.env.LLM_PROVIDER || 'DeepSeek';
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const UPSTREAM = (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 30000);
const TEMPERATURE = Number(process.env.LLM_TEMPERATURE || 0.7);
const MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || 400);
const LOG_FULL = process.env.LOG_FULL !== '0';

class TwinError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/* ---------------- 资料：按主题分文件，每次请求重新读，便于调优免重启 ---------------- */
function readKnowledge() {
  const files = fs.readdirSync(KDIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  if (!files.length) throw new TwinError('knowledge/ 目录为空，资料未准备', 503);

  const parts = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(KDIR, f), 'utf8').trim();
    parts.push(`\n===== 资料文件：${f} =====\n${text}`);
  }
  const system = parts.join('\n');
  const version = crypto.createHash('sha256').update(system).digest('hex').slice(0, 10);
  return { system, version, files };
}

/* ---------------- 健康检查（不返回密钥） ---------------- */
function health() {
  const k = readKnowledge();
  const keyConfigured = !!(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY);
  return {
    ok: keyConfigured,
    status: keyConfigured ? 'ready' : 'missing_key',
    provider: PROVIDER,
    model: MODEL,
    upstream: UPSTREAM,
    keyConfigured,
    knowledgeVersion: k.version,
    knowledgeFiles: k.files,
    stream: true,
    time: new Date().toISOString()
  };
}

/* ---------------- 消息清洗：服务端注入 system，忽略客户端 system ---------------- */
function prepare(payload) {
  const raw = payload && Array.isArray(payload.messages) ? payload.messages : [];
  if (!raw.length) throw new TwinError('缺少 messages', 400);

  const last = raw[raw.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string') {
    throw new TwinError('最后一条消息必须是 user 的文本', 400);
  }
  const question = last.content.trim();
  if (!question) throw new TwinError('问题不能为空', 400);
  if (question.length > 500) throw new TwinError('问题过长（上限 500 字）', 400);

  // 只保留 user / assistant，丢弃客户端伪造的 system / tool 消息
  const history = raw.slice(0, -1)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const k = readKnowledge();
  return {
    messages: [
      { role: 'system', content: k.system },
      ...history,
      { role: 'user', content: question }
    ],
    question,
    knowledgeVersion: k.version
  };
}

/* ---------------- 真实 API 调用 ---------------- */
function upstreamRequest(messages, stream) {
  const key = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  if (!key) {
    throw new TwinError('服务端未配置 LLM_API_KEY：请在 twin/.env 或云函数环境变量中设置（不要把密钥放进前端）', 503);
  }
  return fetch(`${UPSTREAM}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: !!stream,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
}

async function upstreamStream(messages) {
  return upstreamRequest(messages, true);
}

async function chatOnce(messages) {
  const res = await upstreamRequest(messages, false);
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new TwinError(`上游返回 HTTP ${res.status}${detail ? ' · ' + detail : ''}`, 502);
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : '';
  return { text: text || '', usage: data.usage || null };
}

/* ---------------- 证据日志（append-only，绝不记录密钥） ---------------- */
function logRecord(rec) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const line = {
      at: new Date().toISOString(),
      provider: PROVIDER,
      model: MODEL,
      knowledgeVersion: rec.knowledgeVersion || null,
      ok: rec.ok !== false,
      ...rec
    };
    if (!LOG_FULL) {
      if (typeof line.question === 'string') line.question = line.question.slice(0, 40) + '…';
      if (typeof line.answer === 'string') line.answer = line.answer.slice(0, 40) + '…';
    }
    fs.appendFileSync(path.join(LOG_DIR, `api-${day}.jsonl`), JSON.stringify(line) + '\n', 'utf8');
    return true;
  } catch (e) {
    // 云函数文件系统可能只读：记录失败不能影响对话，但要把原因交给调用方
    return false;
  }
}

/* ---------------- 简易限流（单实例内存版；云函数请再配平台侧限流） ---------------- */
const buckets = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.RATE_LIMIT || 30);
function checkRate(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.start > WINDOW_MS) {
    b = { start: now, count: 0 };
    buckets.set(ip, b);
  }
  b.count += 1;
  // 定期清理，避免 Map 无限增长
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) if (now - v.start > WINDOW_MS * 2) buckets.delete(k);
  }
  return { allowed: b.count <= MAX_PER_WINDOW, remaining: Math.max(0, MAX_PER_WINDOW - b.count) };
}

/* ---------------- 对外错误脱敏：不把密钥 / 上游细节原样回给浏览器 ---------------- */
function publicError(err) {
  const msg = (err && err.message) || '未知错误';
  const safe = msg
    .replace(/sk-[A-Za-z0-9_\-]{6,}/g, 'sk-***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***');
  return { status: err && err.status ? err.status : 500, message: safe };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

module.exports = {
  TwinError, readKnowledge, health, prepare,
  upstreamStream, chatOnce, logRecord, checkRate, publicError,
  CORS_HEADERS, MODEL, PROVIDER, UPSTREAM
};
