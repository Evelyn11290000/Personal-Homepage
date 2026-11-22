/* ============================================================
   数字分身 · 前端唯一的后端配置
   ------------------------------------------------------------
   本地开发：保持下方两个值为空字符串，用 `node --env-file=twin/.env twin/server.js`
             启动本地服务，页面会自动请求同源 /api/chat。
   部署上线：把云函数地址填进 window.TWIN_ENDPOINT（必须以 /api/chat 结尾），
             TWIN_HEALTH 留空即可自动推导；然后 git push 到 GitHub Pages。
   ⚠️ 这里只放地址，永远不要放 API Key —— 密钥只在服务端环境变量里。
   ============================================================ */
window.TWIN_ENDPOINT = 'https://1538277307-00401nev3x.ap-guangzhou.tencentscf.com/api/chat';
window.TWIN_HEALTH   = 'https://1538277307-00401nev3x.ap-guangzhou.tencentscf.com/api/health';
