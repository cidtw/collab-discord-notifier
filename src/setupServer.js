/*
 * 로컬에서만 띄우는 1회성 설정 마법사. 관리자가 브라우저로 Discord 봇 토큰/채널,
 * Google 계정, Notion Integration을 연결하면 data/config.json 에 저장된다.
 * express 없이 Node 내장 http 모듈로 직접 라우팅한다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { exec } = require('child_process');
const config = require('./config');
const store = require('./store');
const discordApi = require('./services/discordApi');
const googleDrive = require('./services/googleDrive');
const notion = require('./services/notion');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATIC_FILES = {
  '/': { file: 'setup.html', type: 'text/html; charset=utf-8' },
  '/setup.html': { file: 'setup.html', type: 'text/html; charset=utf-8' },
  '/setup.js': { file: 'setup.js', type: 'application/javascript; charset=utf-8' },
};

function mask(secret) {
  if (!secret) return '';
  return secret.length <= 8 ? '••••' : `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(new Error('요청 본문이 너무 큽니다.'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('잘못된 JSON 본문입니다.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const entry = STATIC_FILES[pathname];
  if (!entry) return false;
  try {
    const body = fs.readFileSync(path.join(PUBLIC_DIR, entry.file));
    res.writeHead(200, { 'Content-Type': entry.type });
    res.end(body);
  } catch {
    sendText(res, 404, 'not found');
  }
  return true;
}

async function handleApi(req, res, pathname, query) {
  if (pathname === '/api/status' && req.method === 'GET') {
    const c = store.load();
    return sendJson(res, 200, {
      discord: {
        configured: Boolean(config.discord.botToken && config.discord.channelId),
        clientId: c.discord?.clientId || '',
        botTokenMasked: mask(c.discord?.botToken),
        channelId: c.discord?.channelId || '',
        channelName: c.discord?.channelName || '',
      },
      google: {
        appConfigured: Boolean(config.googleApp.clientId && config.googleApp.clientSecret),
        connected: Boolean(config.google.refreshToken),
      },
      notion: {
        configured: config.notion.enabled,
        apiKeyMasked: mask(c.notion?.apiKey),
        pageIds: config.notion.pageIds,
        databaseIds: config.notion.databaseIds,
      },
    });
  }

  if (pathname === '/api/discord/token' && req.method === 'POST') {
    const { clientId, botToken } = await readJsonBody(req);
    if (!botToken) return sendJson(res, 400, { error: 'botToken 이 필요합니다.' });
    try {
      const guilds = await discordApi.listGuilds(botToken);
      store.updateSection('discord', { clientId: clientId || '', botToken });
      return sendJson(res, 200, { guilds });
    } catch (err) {
      return sendJson(res, 400, { error: `봇 토큰 확인 실패: ${err.message}` });
    }
  }

  if (pathname === '/api/discord/guilds' && req.method === 'GET') {
    const botToken = store.load().discord?.botToken;
    if (!botToken) return sendJson(res, 400, { error: '먼저 봇 토큰을 저장하세요.' });
    try {
      return sendJson(res, 200, { guilds: await discordApi.listGuilds(botToken) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/discord/channels' && req.method === 'GET') {
    const botToken = store.load().discord?.botToken;
    const guildId = query.get('guildId');
    if (!botToken) return sendJson(res, 400, { error: '먼저 봇 토큰을 저장하세요.' });
    if (!guildId) return sendJson(res, 400, { error: 'guildId 가 필요합니다.' });
    try {
      return sendJson(res, 200, { channels: await discordApi.listTextChannels(botToken, guildId) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/discord/channel' && req.method === 'POST') {
    const { channelId, channelName } = await readJsonBody(req);
    if (!channelId) return sendJson(res, 400, { error: 'channelId 가 필요합니다.' });
    store.updateSection('discord', { channelId, channelName: channelName || '' });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/notion/key' && req.method === 'POST') {
    const { apiKey } = await readJsonBody(req);
    if (!apiKey) return sendJson(res, 400, { error: 'apiKey 가 필요합니다.' });
    try {
      const targets = await notion.listAccessibleTargets(apiKey);
      store.updateSection('notion', { apiKey });
      return sendJson(res, 200, { targets });
    } catch (err) {
      return sendJson(res, 400, { error: `Notion 키 확인 실패: ${err.message}` });
    }
  }

  if (pathname === '/api/notion/targets/available' && req.method === 'GET') {
    const apiKey = store.load().notion?.apiKey;
    if (!apiKey) return sendJson(res, 400, { error: '먼저 Notion API 키를 저장하세요.' });
    try {
      return sendJson(res, 200, { targets: await notion.listAccessibleTargets(apiKey) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/notion/targets' && req.method === 'POST') {
    const { pageIds = [], databaseIds = [] } = await readJsonBody(req);
    store.updateSection('notion', { pageIds, databaseIds });
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 404, { error: 'not found' });
}

async function handleGoogleAuthStart(res) {
  if (!config.googleApp.clientId || !config.googleApp.clientSecret) {
    return sendText(
      res,
      400,
      'GOOGLE_APP_CLIENT_ID / GOOGLE_APP_CLIENT_SECRET 이 .env 에 없습니다. README를 참고해 먼저 발급하세요.'
    );
  }
  res.writeHead(302, { Location: googleDrive.generateAuthUrl() });
  res.end();
}

async function handleGoogleAuthCallback(res, url) {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) return sendText(res, 400, `Google 인증 실패: ${error}`);
  if (!code) return sendText(res, 400, 'code 파라미터가 없습니다.');

  try {
    const tokens = await googleDrive.exchangeCode(code);
    if (!tokens.refresh_token) {
      return sendText(
        res,
        400,
        '이 계정은 이전에 이미 동의를 완료해 refresh_token이 재발급되지 않았습니다. ' +
          'Google 계정 설정 → 보안 → 타사 앱 액세스에서 이 앱 연결을 해제한 뒤 다시 시도하세요.'
      );
    }
    store.updateSection('google', { refreshToken: tokens.refresh_token });
    res.writeHead(302, { Location: '/?connected=google' });
    res.end();
  } catch (err) {
    sendText(res, 500, `토큰 교환 중 오류: ${err.message}`);
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${config.setup.port}`);
    const { pathname } = url;

    try {
      if (pathname === '/auth/google/start' && req.method === 'GET') {
        return await handleGoogleAuthStart(res);
      }
      if (pathname === '/auth/google/callback' && req.method === 'GET') {
        return await handleGoogleAuthCallback(res, url);
      }
      if (pathname.startsWith('/api/')) {
        return await handleApi(req, res, pathname, url.searchParams);
      }
      if (serveStatic(res, pathname)) return;

      sendText(res, 404, 'not found');
    } catch (err) {
      console.error('[setup] 처리 중 오류:', err);
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
    }
  });
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function start() {
  const server = createServer();
  server.listen(config.setup.port, () => {
    const url = `http://localhost:${config.setup.port}`;
    console.log(`[setup] 설정 마법사: ${url}`);
    openBrowser(url);
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createServer, start };
