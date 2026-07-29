/*
 * 최초 1회 실행하는 Google OAuth 인가 스크립트.
 * 브라우저에서 로그인/동의를 완료하면 refresh_token을 발급받아
 * .env 파일의 GOOGLE_REFRESH_TOKEN 값을 자동으로 채워준다.
 */
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { google } = require('googleapis');
const { SCOPES } = require('../services/googleDrive');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`환경변수 ${name} 이 없습니다. .env 에 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 을 먼저 입력하세요.`);
    process.exit(1);
  }
  return value;
}

function saveRefreshToken(token) {
  let content = '';
  try {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    console.warn('.env 파일이 없어 새로 만들지 않습니다. 아래 값을 직접 .env 에 추가하세요:');
    console.log(`GOOGLE_REFRESH_TOKEN=${token}`);
    return;
  }

  if (/^GOOGLE_REFRESH_TOKEN=.*$/m.test(content)) {
    content = content.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${token}`);
  } else {
    content += `\nGOOGLE_REFRESH_TOKEN=${token}\n`;
  }
  fs.writeFileSync(ENV_PATH, content, 'utf8');
  console.log('.env 파일에 GOOGLE_REFRESH_TOKEN 을 저장했습니다.');
}

async function main() {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:53682/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { port, pathname } = new URL(redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('아래 URL을 브라우저에서 열어 Google 계정으로 로그인/동의를 완료하세요:\n');
  console.log(authUrl, '\n');
  console.log(`(로컬 ${redirectUri} 로 리디렉션을 기다리는 중...)`);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== pathname) {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400).end('code 파라미터가 없습니다.');
        return;
      }
      const { tokens } = await oAuth2Client.getToken(code);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>인증 완료</h1>이 창은 닫아도 됩니다.');
      server.close();

      if (!tokens.refresh_token) {
        console.error(
          '\nrefresh_token 이 발급되지 않았습니다. 이미 한 번 인가한 계정이면 Google 계정 설정에서' +
            ' 이 앱의 액세스 권한을 제거한 뒤 다시 시도하세요.'
        );
        process.exit(1);
      }

      console.log('\nrefresh_token 발급 완료.');
      saveRefreshToken(tokens.refresh_token);
      process.exit(0);
    } catch (err) {
      console.error('토큰 교환 중 오류:', err.message);
      res.writeHead(500).end('토큰 교환 실패');
      server.close();
      process.exit(1);
    }
  });

  server.listen(Number(port) || 80);
}

main();
