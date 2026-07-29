const { google } = require('googleapis');
const config = require('../config');

const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  if (config.google.refreshToken) {
    client.setCredentials({ refresh_token: config.google.refreshToken });
  }
  return client;
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getOAuthClient() });
}

async function getStartPageToken() {
  const drive = getDrive();
  const res = await drive.changes.getStartPageToken({});
  return res.data.startPageToken;
}

/**
 * 저장된 pageToken 이후의 변경 사항을 모두 가져오고, 다음에 사용할 pageToken을 함께 반환한다.
 * @param {string} pageToken
 */
async function pollChanges(pageToken) {
  const drive = getDrive();
  const changes = [];
  let token = pageToken;
  let newStartPageToken = null;

  do {
    const res = await drive.changes.list({
      pageToken: token,
      pageSize: 100,
      fields:
        'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, webViewLink, trashed, lastModifyingUser))',
    });

    for (const change of res.data.changes || []) {
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

    token = res.data.nextPageToken;
    if (res.data.newStartPageToken) newStartPageToken = res.data.newStartPageToken;
  } while (token);

  return { changes, newPageToken: newStartPageToken };
}

module.exports = { SCOPES, getOAuthClient, getStartPageToken, pollChanges };
