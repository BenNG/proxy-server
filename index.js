const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5050;
const TARGET = 'https://aws-stage.wecasa.fr';

const configuration = {
  user: { isMocked: true, filename: 'user.json', statusCode: 200 },
  universes: { isMocked: true, filename: 'universes.json', statusCode: 200 },
  config: { isMocked: true, filename: 'config.json', statusCode: 200 },
};

// Helper pour lire les fichiers JSON mockés
const readMockFile = (filename, statusCode, path, res) => {
  const filePath = require('path').join(__dirname, 'data', filename);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`[LOCAL] Error reading ${filename}:`, err);
      return res.status(500).json({ error: 'Failed to read local data' });
    }
    console.log(`[LOCAL] ✓ GET ${path} - ${statusCode}`);
    res.status(statusCode).json(JSON.parse(data));
  });
};

// Middleware pour logger toutes les requêtes entrantes
app.use((req, res, next) => {
  console.log(`[INCOMING] ${req.method} ${req.originalUrl}`);
  next();
});

// Middleware CORS global
// sans les 3 commentaires lignes de headers la request universes ne passe pas mais les OPTIONS si
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Routes OPTIONS (CORS preflight)
app.options('/api/v1/universes', (req, res, next) => {
  if (!configuration.universes.isMocked) return next();
  console.log('[LOCAL] ✓ OPTIONS /api/v1/universes - 200');
  res.status(200).end();
});

app.options('/api/v1/config', (req, res, next) => {
  if (!configuration.config.isMocked) return next();
  console.log('[LOCAL] ✓ OPTIONS /api/v1/config - 200');
  res.status(200).end();
});

app.options('/api/v1/user', (req, res, next) => {
  if (!configuration.user.isMocked) return next();
  console.log('[LOCAL] ✓ OPTIONS /api/v1/user - 200');
  res.status(200).end();
});

// Route locale pour /api/v1/universes
app.get('/api/v1/universes', (req, res, next) => {
  if (!configuration.universes.isMocked) return next();
  readMockFile('universes.json', configuration.universes.statusCode, '/api/v1/universes', res);
});

// Route locale pour /api/v1/config
app.get('/api/v1/config', (req, res, next) => {
  if (!configuration.config.isMocked) return next();
  readMockFile('config.json', configuration.config.statusCode, '/api/v1/config', res);
});

// Route locale pour /api/v1/user
app.get('/api/v1/user', (req, res, next) => {
  if (!configuration.user.isMocked) return next();
  readMockFile('user.json', configuration.user.statusCode, '/api/v1/user', res);
});

const proxyMiddleware = createProxyMiddleware({
  target: TARGET,
  changeOrigin: true,
  secure: true,
  on: {
    proxyReq: (_proxyReq, req, _res) => {
      req['startTime'] = Date.now();
      console.log(`[PROXY] ➜ ${req.method} ${TARGET}${req.originalUrl}`);
    },
    proxyRes: (proxyRes, req, res) => {
      const duration = Date.now() - (req['startTime'] || Date.now());
      console.log(
        `[PROXY] ✓ ${req.method} ${TARGET}${req.originalUrl} - ${proxyRes.statusCode} (${duration}ms)`
      );
    },
    error: (err, req, res) => {
      console.error(`[PROXY ERROR] ${req.method} ${req.originalUrl}`, err.message);
      res.status(500).json({ error: 'Proxy error', message: err.message });
    },
  },
});

app.use('/', proxyMiddleware);

app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});
