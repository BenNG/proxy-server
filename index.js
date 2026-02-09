const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5050;
const TARGET = 'https://aws-stage.wecasa.fr';

const mocks = [
  {
    enabled: true,
    file: 'create_with_token_not_with_valid_data.json',
    method: 'POST',
    path: '/api/v1/user/create_with_token',
    status: 422,
  },
  { path: '/api/v1/universes', file: 'universes.json', status: 200, enabled: true },
  { path: '/api/v1/config', file: 'config.json', status: 200, enabled: true },
  {
    enabled: true,
    file: 'user-post.json',
    method: 'POST',
    path: '/api/v1/user',
    status: 200,
  },
  { path: '/api/v1/user', file: 'user-signed-in.json', status: 401, enabled: true },
  { path: '/api/v1/prestations', file: 'prestations.json', status: 200, enabled: true },
  {
    path: '/api/v1/customer/previous_addresses',
    file: 'previous_addresses.json',
    status: 200,
    enabled: true,
  },
];

// Helper pour lire les fichiers JSON mockés
const readMockFile = (filename, statusCode, routePath, res, method = 'GET') => {
  const filePath = path.join(__dirname, 'data', filename);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`[LOCAL] Error reading ${filename}:`, err);
      return res.status(500).json({ error: 'Failed to read local data' });
    }
    console.log(`[LOCAL] ✓ ${method} ${routePath} - ${statusCode}`);
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

const registerMockRoutes = (appInstance, mockList) => {
  for (const mock of mockList) {
    const method = (mock.method || 'GET').toLowerCase();

    appInstance.options(mock.path, (req, res, next) => {
      if (!mock.enabled) return next();
      console.log(`[LOCAL] ✓ OPTIONS ${mock.path} - 200`);
      res.status(200).end();
    });

    appInstance[method](mock.path, (req, res, next) => {
      if (!mock.enabled) return next();
      readMockFile(mock.file, mock.status, mock.path, res, (mock.method || 'GET').toUpperCase());
    });
  }
};

registerMockRoutes(app, mocks);

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
        `[PROXY] ✓ ${req.method} ${TARGET}${req.originalUrl} - ${proxyRes.statusCode} (${duration}ms)`,
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
