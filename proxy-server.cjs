const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors'); // ✅ ADD THIS
require('dotenv').config();

const app = express();

app.use(cors()); // ✅ ENABLE CORS FOR ALL ORIGINS

app.use(
  '/api/claude',
  createProxyMiddleware({
    target: 'https://openrouter.ai',
    changeOrigin: true,
    pathRewrite: { '^/api/claude': '/api/v1/chat/completions' },
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', `Bearer ${process.env.VITE_OPENROUTER_API_KEY}`);
      proxyReq.setHeader('Content-Type', 'application/json');
    },
  })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🛡️ Proxy server running on http://localhost:${PORT}`);
});
