'use strict';
/**
 * 仅供「不消耗 token 的链路联调」使用的模拟上游。
 * ⚠️ 它的回复是写死的，绝不是模型回答。
 *    用它跑出来的结果文件名带 smoke，且不能写进期末报告的效果测试部分。
 *
 *   node twin/tests/mock-upstream.js &
 *   LLM_BASE_URL=http://127.0.0.1:8788/v1 LLM_API_KEY=mock node twin/server.js
 *   TWIN_TEST_LABEL=smoke node twin/tests/run-tests.js
 */
const http = require('node:http');
const PORT = Number(process.env.MOCK_PORT || 8788);

http.createServer(async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(404); return res.end(); }
  let body = '';
  for await (const c of req) body += c;
  let payload;
  try { payload = JSON.parse(body); } catch (e) { res.writeHead(400); return res.end('bad json'); }
  const msgs = payload.messages || [];
  const q = (msgs[msgs.length - 1]?.content || '').slice(0, 60);
  const text = `【模拟上游·联调专用，不是模型回答】我收到了：「${q}」。这条回复只用于验证前后端链路，不能写进报告。`;

  if (payload.stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    const parts = [text.slice(0, 20), text.slice(20)];
    for (const p of parts) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ usage: { mock: true } })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: text } }],
      usage: { mock: true }
    }));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-upstream] http://127.0.0.1:${PORT}/v1/chat/completions`);
  console.log('[mock-upstream] ⚠️ 这是假的 OpenAI 兼容上游，只用于联调，不能用来交作业。');
});
