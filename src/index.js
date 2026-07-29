const config = require('./config');
const discord = require('./discordNotifier');
const poller = require('./poller');

async function main() {
  if (!config.discord.botToken || !config.discord.channelId) {
    console.error('Discord 설정이 없습니다. 먼저 `npm run setup` 으로 봇 토큰/채널을 연결하세요.');
    process.exit(1);
  }
  if (!config.google.enabled && !config.notion.enabled) {
    console.warn(
      '[poller] Google Drive / Notion 둘 다 연결되어 있지 않습니다. `npm run setup` 에서 최소 하나는 연결하세요.'
    );
  }

  const me = await discord.ready();
  console.log(`[discord] ${me.username} 봇 토큰 확인 완료`);
  console.log(`[poller] ${config.pollIntervalMs}ms 간격으로 감시를 시작합니다.`);

  const interval = poller.start();

  const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('시작 중 오류:', err);
  process.exit(1);
});
