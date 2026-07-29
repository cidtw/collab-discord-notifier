/*
 * googleapis / google-auth-library SDK 없이 OAuth2 + Drive REST API를 직접 호출한다.
 * (googleapis 패키지 하나가 node_modules의 114MB를 차지해서 통째로 걷어냄)
 */
const config = require('../config');
const { httpJson } = require('../util/httpJson');

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

function generateAuthUrl() {
  const params = new URLSearchParams({
    client_id: config.googleApp.clientId,
    redirect_uri: config.googleApp.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES.join(' '),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postForm(body) {
  return httpJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

/** OAuth 콜백에서 받은 code를 access_token/refresh_token으로 교환한다. */
async function exchangeCode(code) {
  return postForm({
    code,
    client_id: config.googleApp.clientId,
    client_secret: config.googleApp.clientSecret,
    redirect_uri: config.googleApp.redirectUri,
    grant_type: 'authorization_code',
  });
}

let cachedAccessToken = null;
let cachedExpiresAt = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedExpiresAt - 60_000) return cachedAccessToken;

  const refreshToken = config.google.refreshToken;
  if (!refreshToken) {
    throw new Error('Google 계정이 연결되어 있지 않습니다. npm run setup 으로 연결하세요.');
  }

  const data = await postForm({
    client_id: config.googleApp.clientId,
    client_secret: config.googleApp.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  cachedAccessToken = data.access_token;
  cachedExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedAccessToken;
}

async function driveGet(endpoint, params) {
  const token = await getAccessToken();
  const qs = new URLSearchParams(params).toString();
  return httpJson(`${DRIVE_API}${endpoint}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getStartPageToken() {
  const data = await driveGet('/changes/startPageToken', {});
  return data.startPageToken;
}

/**
 * 저장된 pageToken 이후의 변경 사항을 모두 가져오고, 다음에 사용할 pageToken을 함께 반환한다.
 * @param {string} pageToken
 */
async function pollChanges(pageToken) {
  const changes = [];
  let token = pageToken;
  let newStartPageToken = null;

  do {
    const res = await driveGet('/changes', {
      pageToken: token,
      pageSize: 100,
      fields:
        'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, webViewLink, trashed, lastModifyingUser))',
    });

    for (const change of res.changes || []) {
      if (change.removed || !change.file || change.file.trashed) continue;
      if (change.file.mimeType === 'application/vnd.google-apps.folder') continue;

      changes.push({
        source: 'google_drive',
        title: change.file.name,
        url: change.file.webViewLink,
        editor: change.file.lastModifyingUser?.displayName,
        editedAt: change.file.modifiedTime,
      });
    }

    token = res.nextPageToken;
    if (res.newStartPageToken) newStartPageToken = res.newStartPageToken;
  } while (token);

  return { changes, newPageToken: newStartPageToken };
}

module.exports = { SCOPES, generateAuthUrl, exchangeCode, getStartPageToken, pollChanges };
