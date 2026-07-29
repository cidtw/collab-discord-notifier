const config = require('../config');
const notionApi = require('./notionApi');

const userNameCache = new Map();
async function resolveUserName(apiKey, userId) {
  if (!userId) return undefined;
  if (userNameCache.has(userId)) return userNameCache.get(userId);
  try {
    const user = await notionApi.retrieveUser(apiKey, userId);
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

async function pageToChange(apiKey, page) {
  return {
    source: 'notion',
    title: extractTitle(page),
    url: page.url,
    editor: await resolveUserName(apiKey, page.last_edited_by?.id),
    editedAt: page.last_edited_time,
  };
}

async function fetchAllDatabasePages(apiKey, databaseId) {
  const pages = [];
  let cursor;
  do {
    const res = await notionApi.queryDatabase(apiKey, databaseId, cursor);
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/**
 * 이 Integration이 현재 공유(Share)받은 페이지/데이터베이스 목록을 가져온다.
 * setup 마법사에서 "감시할 대상 고르기" 화면에 쓴다.
 */
async function listAccessibleTargets(apiKey) {
  const results = [];
  let cursor;
  do {
    const res = await notionApi.search(apiKey, cursor);
    for (const item of res.results) {
      if (item.object === 'database') {
        const title = (item.title || []).map((t) => t.plain_text).join('') || '(제목 없음)';
        results.push({ id: item.id, type: 'database', title, url: item.url });
      } else if (item.object === 'page') {
        results.push({ id: item.id, type: 'page', title: extractTitle(item), url: item.url });
      }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return results;
}

/**
 * config.notion.pageIds / databaseIds 를 폴링해 last_edited_time 이 바뀐 항목을 찾는다.
 * @param {Record<string, string>} lastEditedTimes id -> 이전에 기록한 ISO 시간
 */
async function pollNotion(lastEditedTimes) {
  const apiKey = config.notion.apiKey;
  const changes = [];
  const updated = { ...lastEditedTimes };
  const allPages = [];

  for (const pageId of config.notion.pageIds) {
    try {
      allPages.push(await notionApi.retrievePage(apiKey, pageId));
    } catch (err) {
      console.warn(`[notion] 페이지 ${pageId} 조회 실패:`, err.message);
    }
  }

  for (const databaseId of config.notion.databaseIds) {
    try {
      const pages = await fetchAllDatabasePages(apiKey, databaseId);
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
        changes.push(await pageToChange(apiKey, page));
      }
      updated[page.id] = page.last_edited_time;
    }
  }

  return { changes, lastEditedTimes: updated };
}

module.exports = { pollNotion, listAccessibleTargets };
