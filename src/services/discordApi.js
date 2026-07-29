/*
 * discord.js 없이 Discord REST API를 직접 호출한다. 이 봇은 게이트웨이(실시간 이벤트)를
 * 들을 필요가 없고 메시지 전송/조회만 하면 되므로 discord.js(+관련 패키지 ~17MB)가 필요 없다.
 */
const API_BASE = 'https://discord.com/api/v10';

const TEXTLIKE_CHANNEL_TYPES = new Set([0, 5]); // GUILD_TEXT, GUILD_ANNOUNCEMENT

async function callDiscordApi(botToken, endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bot ${botToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord API ${endpoint} 실패 (${res.status}): ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** 토큰 유효성 확인 + 봇 자신의 정보 */
async function getSelf(botToken) {
  return callDiscordApi(botToken, '/users/@me');
}

/** 봇이 초대되어 있는 서버 목록 */
async function listGuilds(botToken) {
  const guilds = await callDiscordApi(botToken, '/users/@me/guilds');
  return guilds.map((g) => ({ id: g.id, name: g.name }));
}

/** 특정 서버의 텍스트 채널 목록 */
async function listTextChannels(botToken, guildId) {
  const channels = await callDiscordApi(botToken, `/guilds/${guildId}/channels`);
  return channels
    .filter((c) => TEXTLIKE_CHANNEL_TYPES.has(c.type))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((c) => ({ id: c.id, name: c.name }));
}

/** 채널에 메시지(임베드 포함) 전송 */
async function sendMessage(botToken, channelId, payload) {
  return callDiscordApi(botToken, `/channels/${channelId}/messages`, { method: 'POST', body: payload });
}

module.exports = { getSelf, listGuilds, listTextChannels, sendMessage };
