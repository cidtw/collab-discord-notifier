/*
 * fetch 로 JSON API를 호출하는 공용 헬퍼. googleAuth/discordApi/notionApi 세 곳에서 재사용한다.
 */
async function httpJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const message = data.error_description || data.message || data.error || data.raw || `HTTP ${res.status}`;
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

module.exports = { httpJson };
