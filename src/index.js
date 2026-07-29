const config = require('./config');
const discord = require('./discordNotifier');
const poller = require('./poller');

async function main() {
  const client = await discord.ready();
  console.log(`[discord] ${client.user.tag} 로 로그인 완료`);
  console.log(`[poller] ${config.pollIntervalMs}ms 간격으로 감시를 시작합니다.`);

  const interval = poller.start();

  const shutdown = () => {
    clearInterval(interval);
    client.destroy();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('시작 중 오류:', err);
  process.exit(1);
});
