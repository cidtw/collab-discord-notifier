require('dotenv').config();
const path = require('path');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

function list(name) {
  const value = process.env[name] || '';
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const config = {
  discord: {
    botToken: required('DISCORD_BOT_TOKEN'),
    channelId: required('DISCORD_CHANNEL_ID'),
  },
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 120000,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:53682/oauth2callback',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    get enabled() {
      return Boolean(this.clientId && this.clientSecret && this.refreshToken);
    },
  },
  notion: {
    apiKey: process.env.NOTION_API_KEY || '',
    pageIds: list('NOTION_PAGE_IDS'),
    databaseIds: list('NOTION_DATABASE_IDS'),
    get enabled() {
      return Boolean(this.apiKey && (this.pageIds.length || this.databaseIds.length));
    },
  },
  stateFilePath: path.join(__dirname, '..', 'data', 'state.json'),
};

module.exports = config;
