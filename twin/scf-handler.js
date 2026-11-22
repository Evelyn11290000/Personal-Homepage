'use strict';
/**
 * 数字分身 · 云函数入口（腾讯云函数 SCF / 阿里云函数计算通用）
 * ------------------------------------------------------------------
 * 与 scf 部署相关的要点：
 *  - 打包内容：本文件 + core.js + knowledge/ 整个目录（路径结构必须保持 twin/ 下不变）
 *  - 入口：scf-handler.main_handler（阿里云 FC 可用 scf-handler.handler）
 *  - 环境变量：LLM_API_KEY（必填）、LLM_MODEL、LLM_BASE_URL、LLM_TIMEOUT_MS、RATE_LIMIT
 *  - 触发器：函数 URL 或 API 网关，放行 GET / POST / OPTIONS，开启 CORS
 *  - 前端把 twin-config.js 的 window.TWIN_ENDPOINT 填成 <函数地址>/api/chat
 * 说明：云函数侧用非流式上游调用，再封装成前端可解析的 SSE 响应体，
 *       所以 chat.html 的解析逻辑在本地与线上完全一致。
 */
const core = require('./core');

const BASE_HEADERS = {
  ...core.CORS_HEADERS,
  'Cache-Control': 'no-store'
};

function reply(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false
  };
}

function sseFromText(text) {
  // 复用 OpenAI SSE 结构，前端 streamAI() 无需分支
  const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return `data: ${chunk}\n\ndata: [DONE]\n\n`;
}

function parseEvent(event) {
  const headers = event.headers || event.header || {};
  const method = (event.httpMethod || event.requestContext?.httpMethod || (event.requestContext?.http?.method) || 'GET').toUpperCase();
  const pathname = event.path || event.requestContext?.path || event.requestContext?.http?.path || '/';
  let raw = event.body || '';
  if (event.isBase64Encoded && raw) raw = Buffer.from(raw, 'base64').toString('utf8');
  return { method, pathname, raw, headers };
}

async function main_handler(event = {}, context) {
  const { method, pathname, raw } = parseEvent(event);
  const cleanPath = pathname.replace(/^\/(?:test|release|prod)\b/, '') || '/'; // 部分网关会带环境前缀

  if (method === 'OPTIONS') return reply(204, '');

  if (cleanPath.endsWith('/api/health') && method === 'GET') {
    try { return reply(200, core.health(), { 'Content-Type': 'application/json; charset=utf-8' }); }
    catch (e) { return reply(500, { ok: false, error: core.publicError(e).message }, { 'Content-Type': 'application/json; charset=utf-8' }); }
  }

  if (cleanPath.endsWith('/api/chat') && method === 'POST') {
    const started = Date.now();
    let prepared;
    try {
      let payload;
      try { payload = JSON.parse(raw || '{}'); }
      catch (e) { throw new core.TwinError('请求体不是合法 JSON', 400); }

      const ip = (event.requestContext?.sourceIp || event.requestContext?.identity?.sourceIp || 'scf');
      const rate = core.checkRate(String(ip));
      if (!rate.allowed) throw new core.TwinError('提问太频繁了，稍等一分钟再试～', 429);

      prepared = core.prepare(payload);
      const { text, usage } = await core.chatOnce(prepared.messages);
      core.logRecord({
        ok: true, question: prepared.question, answer: text,
        ms: Date.now() - started, usage, knowledgeVersion: prepared.knowledgeVersion
      });
      return reply(200, sseFromText(text), { 'Content-Type': 'text/event-stream; charset=utf-8' });
    } catch (err) {
      const p = core.publicError(err);
      core.logRecord({
        ok: false, question: prepared ? prepared.question : '', answer: '',
        ms: Date.now() - started, knowledgeVersion: prepared ? prepared.knowledgeVersion : null,
        error: p.message
      });
      return reply(p.status, { error: p.message }, { 'Content-Type': 'application/json; charset=utf-8' });
    }
  }

  return reply(404, { error: 'unknown api', path: cleanPath }, { 'Content-Type': 'application/json; charset=utf-8' });
}

exports.main_handler = main_handler;
exports.handler = main_handler; // 阿里云函数计算常用入口名
