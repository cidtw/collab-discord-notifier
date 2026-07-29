require('./loadEnv').loadEnv();
const path = require('path');
const store = require('./store');

const config = {
  // 앱을 배포/유지하는 사람이 딱 한 번 .env 에 채워두는 값 (Google Cloud Console에서 발급).
  // 이 값 하나를 여러 설치/팀이 재사용한다 — 팀마다 새로 만들 필요 없음.
  googleApp: {
    clientId: process.env.GOOGLE_APP_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_APP_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_APP_REDIRECT_URI || 'http://localhost:4600/auth/google/callback',
  },

  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 120000,

  setup: {
    port: Number(process.env.SETUP_PORT) || 4600,
  },

  // 아래 세 항목은 설치마다 다른 값이라 setup 마법사가 data/config.json 에 저장한 것을 읽는다.
  get discord() {
    const d = store.load().discord || {};
    return {
      clientId: d.clientId || '',
      botToken: d.botToken || '',
      channelId: d.channelId || '',
      get enabled() {
        return Boolean(d.botToken && d.channelId);
      },
    };
  },

  get google() {
    const g = store.load().google || {};
    const app = this.googleApp;
    return {
      refreshToken: g.refreshToken || '',
      get enabled() {
        return Boolean(app.clientId && app.clientSecret && g.refreshToken);
      },
    };
  },

  get notion() {
    const n = store.load().notion || {};
    const pageIds = n.pageIds || [];
    const databaseIds = n.databaseIds || [];
    return {
      apiKey: n.apiKey || '',
      pageIds,
      databaseIds,
      get enabled() {
        return Boolean(n.apiKey && (pageIds.length || databaseIds.length));
      },
    };
  },

  stateFilePath: path.join(__dirname, '..', 'data', 'state.json'),
};

module.exports = config;
