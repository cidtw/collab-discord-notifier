/*
 * 브라우저 없이(원격 서버 등) Google Drive 연결을 해야 할 때 쓰는 CLI 대안.
 * 평소에는 `npm run setup` 웹 마법사의 "Google 계정으로 로그인" 버튼을 쓰면 된다.
 */
require('../loadEnv').loadEnv();
const http = require('http');
const { URL } = require('url');
const config = require('../config');
const store = require('../store');
const googleDrive = require('../services/googleDrive');

async function main() {
  if (!config.googleApp.clientId || !config.googleApp.clientSecret) {
    console.error(
      '.env 에 GOOGLE_APP_CLIENT_ID / GOOGLE_APP_CLIENT_SECRET 이 없습니다. README를 참고해 먼저 발급하세요.'
    );
    process.exit(1);
  }

  const redirectUri = config.googleApp.redirectUri;
  const { port, pathname } = new URL(redirectUri);
  const authUrl = googleDrive.generateAuthUrl();

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
      const tokens = await googleDrive.exchangeCode(code);
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

      store.updateSection('google', { refreshToken: tokens.refresh_token });
      console.log('\nrefresh_token 을 data/config.json 에 저장했습니다.');
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
