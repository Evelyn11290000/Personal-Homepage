'use strict';
/**
 * 数字分身 · 本地服务器（同时托管静态主页 + /api 接口）
 *   node --env-file=twin/.env twin/server.js
 *   然后打开 http://127.0.0.1:8787/chat.html
 * 云函数部署请用 twin/scf-handler.js；两者共用 twin/core.js。
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core');

const PORT = Number(process.env.PORT || 8787);
const REPO = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf'
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...core.CORS_HEADERS });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > limit) { reject(new core.TwinError('请求体过大', 413)); req.destroy(); }
    });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

/* ---------------- 静态文件（仅本地开发用；线上仍由 GitHub Pages 托管） ---------------- */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.resolve(REPO, '.' + rel);

  // 目录穿越 / 敏感文件拦截
  if (!full.startsWith(REPO + path.sep) && full !== REPO) return sendJson(res, 403, { error: 'forbidden' });
  if (/(^|\/)\.git(\/|$)|(^|\/)\.env(\/|$)|(^|\/)PROCESS\/logs(\/|$)|(^|\/)node_modules(\/|$)/.test(rel)) {
    return sendJson(res, 403, { error: 'forbidden' });
  }
  let stat;
  try { stat = fs.statSync(full); } catch (e) { return sendJson(res, 404, { error: 'not found' }); }
  if (stat.isDirectory()) return serveStatic(req, res, rel.replace(/\/$/, '') + '/index.html');

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    ...core.CORS_HEADERS
  });
  fs.createReadStream(full).pipe(res);
}

/* ---------------- /api/health ---------------- */
function handleHealth(res) {
  try { sendJson(res, 200, core.health()); }
  catch (e) { const p = core.publicError(e); sendJson(res, p.status, { ok: false, error: p.message }); }
}

/* ---------------- /api/chat（SSE 流式转发真实模型输出） ---------------- */
async function handleChat(req, res, ip) {
  const started = Date.now();
  let prepared;
  try {
    const raw = await readBody(req);
    let payload;
    try { payload = JSON.parse(raw || '{}'); }
    catch (e) { throw new core.TwinError('请求体不是合法 JSON', 400); }

    const rate = core.checkRate(ip);
    if (!rate.allowed) throw new core.TwinError('提问太频繁了，稍等一分钟再试～', 429);

    prepared = core.prepare(payload);
    const upstream = await core.upstreamStream(prepared.messages);

    if (!upstream.ok) {
      const detail = (await upstream.text().catch(() => '')).slice(0, 200)
        .replace(/sk-[A-Za-z0-9_\-]{6,}/g, 'sk-***');
      core.logRecord({
        ok: false, question: prepared.question, answer: '',
        ms: Date.now() - started, knowledgeVersion: prepared.knowledgeVersion,
        error: `上游 HTTP ${upstream.status}: ${detail}`
      });
      return sendJson(res, 502, { error: `模型接口返回 HTTP ${upstream.status}`, detail });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...core.CORS_HEADERS
    });

    let full = '', usage = null, sseBuf = '';
    try {
      for await (const chunk of upstream.body) {
        res.write(chunk);                       // 原样透传给浏览器
        sseBuf += Buffer.from(chunk).toString('utf8');
        const lines = sseBuf.split('\n');
        sseBuf = lines.pop() || '';
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const d = s.slice(5).trim();
          if (!d || d === '[DONE]') continue;
          try {
            const j = JSON.parse(d);
            const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta) full += delta;
            if (j.usage) usage = j.usage;
          } catch (e) { /* 忽略半包 / 非 JSON 分片 */ }
        }
      }
    } catch (e) {
      core.logRecord({
        ok: false, question: prepared.question, answer: full,
        ms: Date.now() - started, knowledgeVersion: prepared.knowledgeVersion,
        error: '流式传输中断：' + core.publicError(e).message
      });
      if (!res.writableEnded) res.end();
      return;
    }

    if (!res.writableEnded) res.end();
    core.logRecord({
      ok: true, question: prepared.question, answer: full,
      ms: Date.now() - started, usage, knowledgeVersion: prepared.knowledgeVersion
    });
  } catch (err) {
    const p = core.publicError(err);
    core.logRecord({
      ok: false,
      question: prepared ? prepared.question : '',
      answer: '', ms: Date.now() - started,
      knowledgeVersion: prepared ? prepared.knowledgeVersion : null,
      error: p.message
    });
    if (!res.headersSent) sendJson(res, p.status, { error: p.message });
    else if (!res.writableEnded) res.end();
  }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'local';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, core.CORS_HEADERS);
    return res.end();
  }
  if (u.pathname === '/api/health' && req.method === 'GET') return handleHealth(res);
  if (u.pathname === '/api/chat' && req.method === 'POST') return handleChat(req, res, ip);
  if (u.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown api' });
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, u.pathname);
  sendJson(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, '127.0.0.1', () => {
  const h = core.health();
  console.log(`[twin] http://127.0.0.1:${PORT}/chat.html`);
  console.log(`[twin] provider=${h.provider} model=${h.model} knowledge=${h.knowledgeVersion} files=${h.knowledgeFiles.length}`);
  console.log(`[twin] key=${h.keyConfigured ? '已配置' : '❌ 未配置 LLM_API_KEY（见 twin/.env.example）'}`);
  console.log(`[twin] 证据日志目录：PROCESS/logs/`);
});

module.exports = server;
