const config = require('./config');
const discordApi = require('./services/discordApi');

const SOURCE_STYLE = {
  google_drive: { label: 'Google Drive', color: 0x1a73e8, emoji: '📄' },
  notion: { label: 'Notion', color: 0x000000, emoji: '📝' },
};

/** 봇 토큰이 유효한지 확인하고, 봇 자신의 정보를 반환한다. */
async function ready() {
  return discordApi.getSelf(config.discord.botToken);
}

/**
 * @param {{ source: 'google_drive'|'notion', title: string, url?: string, editor?: string, editedAt?: string }} change
 */
async function notifyChange(change) {
  const style = SOURCE_STYLE[change.source];
  const fields = [{ name: '출처', value: style.label, inline: true }];
  if (change.editor) fields.push({ name: '수정한 사람', value: change.editor, inline: true });

  const embed = {
    color: style.color,
    title: `${style.emoji} ${change.title || '(제목 없음)'}`,
    description: '문서가 수정되었습니다.',
    url: change.url || undefined,
    timestamp: new Date(change.editedAt || Date.now()).toISOString(),
    fields,
  };

  await discordApi.sendMessage(config.discord.botToken, config.discord.channelId, { embeds: [embed] });
}

module.exports = { ready, notifyChange };
