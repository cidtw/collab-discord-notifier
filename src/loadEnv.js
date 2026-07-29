/*
 * dotenv 없이 .env 를 읽는 최소 구현. KEY=VALUE, # 주석, 빈 줄만 지원하면 충분하다.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(filePath = path.join(__dirname, '..', '.env')) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) value = value.slice(1, -1);

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

module.exports = { loadEnv };
