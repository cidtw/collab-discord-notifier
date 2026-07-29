const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const config = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const SOURCE_STYLE = {
  google_drive: { label: 'Google Drive', color: 0x1a73e8, emoji: '📄' },
  notion: { label: 'Notion', color: 0x000000, emoji: '📝' },
};

function ready() {
  return new Promise((resolve, reject) => {
    client.once('ready', () => resolve(client));
    client.once('error', reject);
    client.login(config.discord.botToken).catch(reject);
  });
}

/**
 * @param {{ source: 'google_drive'|'notion', title: string, url?: string, editor?: string, editedAt?: string }} change
 */
async function notifyChange(change) {
  const channel = await client.channels.fetch(config.discord.channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`채널 ${config.discord.channelId} 을(를) 찾을 수 없거나 텍스트 채널이 아닙니다.`);
  }

  const style = SOURCE_STYLE[change.source];
  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setTitle(`${style.emoji} ${change.title || '(제목 없음)'}`)
    .setDescription('문서가 수정되었습니다.')
    .addFields({ name: '출처', value: style.label, inline: true })
    .setTimestamp(change.editedAt ? new Date(change.editedAt) : new Date());

  if (change.url) embed.setURL(change.url);
  if (change.editor) embed.addFields({ name: '수정한 사람', value: change.editor, inline: true });

  await channel.send({ embeds: [embed] });
}

module.exports = { ready, notifyChange, client };
