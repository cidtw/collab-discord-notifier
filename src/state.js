const fs = require('fs');
const path = require('path');
const config = require('./config');

const DEFAULT_STATE = {
  google: {
    pageToken: null,
  },
  notion: {
    // pageId/databaseItemId -> ISO last_edited_time 문자열
    lastEditedTimes: {},
  },
};

function load() {
  try {
    const raw = fs.readFileSync(config.stateFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      google: { ...DEFAULT_STATE.google, ...parsed.google },
      notion: {
        ...DEFAULT_STATE.notion,
        ...parsed.notion,
        lastEditedTimes: { ...parsed.notion?.lastEditedTimes },
      },
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[state] 기존 상태 파일을 읽는 중 문제가 발생해 기본값으로 시작합니다:', err.message);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function save(state) {
  const dir = path.dirname(config.stateFilePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = { load, save };
