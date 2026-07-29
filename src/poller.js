const config = require('./config');
const state = require('./state');
const discord = require('./discordNotifier');
const googleDrive = require('./services/googleDrive');
const notion = require('./services/notion');

async function checkGoogleDrive(current) {
  if (!config.google.enabled) return current;

  let pageToken = current.google.pageToken;
  if (!pageToken) {
    // 최초 실행: 지금 이 시점을 기준선으로 잡고, 과거 변경 이력은 알리지 않는다.
    pageToken = await googleDrive.getStartPageToken();
    console.log('[google-drive] 최초 실행: 기준 pageToken 확보, 이후 변경분부터 알림');
    return { ...current, google: { ...current.google, pageToken } };
  }

  const { changes, newPageToken } = await googleDrive.pollChanges(pageToken);
  for (const change of changes) {
    await discord.notifyChange(change);
  }
  if (changes.length) console.log(`[google-drive] ${changes.length}건 알림 전송`);

  return {
    ...current,
    google: { ...current.google, pageToken: newPageToken || pageToken },
  };
}

async function checkNotion(current) {
  if (!config.notion.enabled) return current;

  const isFirstRun = Object.keys(current.notion.lastEditedTimes).length === 0;
  const { changes, lastEditedTimes } = await notion.pollNotion(current.notion.lastEditedTimes);

  for (const change of changes) {
    await discord.notifyChange(change);
  }
  if (isFirstRun) console.log('[notion] 최초 실행: 기준선 기록, 이후 변경분부터 알림');
  if (changes.length) console.log(`[notion] ${changes.length}건 알림 전송`);

  return { ...current, notion: { ...current.notion, lastEditedTimes } };
}

async function tick() {
  let current = state.load();
  try {
    current = await checkGoogleDrive(current);
  } catch (err) {
    console.error('[google-drive] 폴링 실패:', err.message);
  }

  try {
    current = await checkNotion(current);
  } catch (err) {
    console.error('[notion] 폴링 실패:', err.message);
  }

  state.save(current);
}

function start() {
  tick(); // 시작 즉시 1회 실행
  return setInterval(tick, config.pollIntervalMs);
}

module.exports = { start, tick };
