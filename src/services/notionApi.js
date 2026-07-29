/*
 * @notionhq/client SDK 없이 Notion REST API를 직접 호출한다.
 */
const API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function call(apiKey, endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Notion API ${endpoint} 실패 (${res.status})`);
  }
  return data;
}

function retrievePage(apiKey, pageId) {
  return call(apiKey, `/pages/${pageId}`);
}

function queryDatabase(apiKey, databaseId, startCursor) {
  return call(apiKey, `/databases/${databaseId}/query`, {
    method: 'POST',
    body: { page_size: 100, ...(startCursor ? { start_cursor: startCursor } : {}) },
  });
}

function search(apiKey, startCursor) {
  return call(apiKey, '/search', {
    method: 'POST',
    body: {
      page_size: 100,
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      ...(startCursor ? { start_cursor: startCursor } : {}),
    },
  });
}

function retrieveUser(apiKey, userId) {
  return call(apiKey, `/users/${userId}`);
}

module.exports = { retrievePage, queryDatabase, search, retrieveUser };
