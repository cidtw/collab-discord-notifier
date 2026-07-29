const { Client } = require('@notionhq/client');
const config = require('../config');

let client = null;
function getClient() {
  if (!client) client = new Client({ auth: config.notion.apiKey });
  return client;
}

const userNameCache = new Map();
async function resolveUserName(userId) {
  if (!userId) return undefined;
  if (userNameCache.has(userId)) return userNameCache.get(userId);
  try {
    const user = await getClient().users.retrieve({ user_id: userId });
    const name = user.name || user.person?.email || userId;
    userNameCache.set(userId, name);
    return name;
  } catch {
    return undefined;
  }
}

function extractTitle(page) {
  const properties = page.properties || {};
  for (const prop of Object.values(properties)) {
    if (prop.type === 'title') {
      const text = (prop.title || []).map((t) => t.plain_text).join('');
      return text || '(제목 없음)';
    }
  }
  return '(제목 없음)';
}

async function pageToChange(page) {
  return {
    source: 'notion',
    title: extractTitle(page),
    url: page.url,
    editor: await resolveUserName(page.last_edited_by?.id),
    editedAt: page.last_edited_time,
  };
}

async function fetchAllDatabasePages(databaseId) {
  const pages = [];
  let cursor;
  do {
    const res = await getClient().databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/**
 * config.notion.pageIds / databaseIds 를 폴링해 last_edited_time 이 바뀐 항목을 찾는다.
 * @param {Record<string, string>} lastEditedTimes id -> 이전에 기록한 ISO 시간
 */
async function pollNotion(lastEditedTimes) {
  const changes = [];
  const updated = { ...lastEditedTimes };

  const allPages = [];

  for (const pageId of config.notion.pageIds) {
    try {
      const page = await getClient().pages.retrieve({ page_id: pageId });
      allPages.push(page);
    } catch (err) {
      console.warn(`[notion] 페이지 ${pageId} 조회 실패:`, err.message);
    }
  }

  for (const databaseId of config.notion.databaseIds) {
    try {
      const pages = await fetchAllDatabasePages(databaseId);
      allPages.push(...pages);
    } catch (err) {
      console.warn(`[notion] 데이터베이스 ${databaseId} 조회 실패:`, err.message);
    }
  }

  for (const page of allPages) {
    const prev = updated[page.id];
    if (prev !== page.last_edited_time) {
      if (prev !== undefined) {
        // 최초 실행이 아닐 때만 알림 (첫 실행은 기준선만 기록)
        changes.push(await pageToChange(page));
      }
      updated[page.id] = page.last_edited_time;
    }
  }

  return { changes, lastEditedTimes: updated };
}

module.exports = { pollNotion };
