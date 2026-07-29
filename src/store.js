/*
 * 설정 마법사(setup wizard)가 저장하는 인스턴스별 자격 증명 저장소.
 * .env 는 앱을 배포하는 사람이 "한 번" 채우는 값(Google 공용 OAuth 클라이언트 등)만 담고,
 * 팀 봇 토큰/채널/리프레시 토큰/Notion 키처럼 설치마다 달라지는 값은 여기 JSON 파일에 저장한다.
 * 나중에 여러 팀을 한 서버에서 서비스하게 되면 이 모듈만 DB 기반으로 교체하면 된다.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

/** section 하나만 읽어서 수정한 뒤 다시 저장하는 편의 함수 (discord/google/notion 등) */
function updateSection(section, patch) {
  const current = load();
  const next = { ...current, [section]: { ...current[section], ...patch } };
  save(next);
  return next[section];
}

module.exports = { load, save, updateSection };
