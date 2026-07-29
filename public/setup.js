const DISCORD_INVITE_PERMISSIONS = 18432; // Send Messages + Embed Links

function $(id) { return document.getElementById(id); }

function setMsg(id, text, kind) {
  const el = $(id);
  el.textContent = text || '';
  el.className = `msg ${kind || ''}`;
}

function markDone(step) {
  const el = $(`badge-${step}`);
  el.classList.add('done');
  el.textContent = '✓';
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

async function loadStatus() {
  const status = await api('GET', '/api/status');

  if (status.discord.configured) {
    markDone('discord');
    $('d-clientId').value = status.discord.clientId;
  }

  if (!status.google.appConfigured) {
    $('google-help').textContent =
      '.env 에 GOOGLE_APP_CLIENT_ID / GOOGLE_APP_CLIENT_SECRET 이 아직 없습니다. README를 참고해 관리자가 먼저 발급해야 합니다.';
    $('g-login').disabled = true;
  } else if (status.google.connected) {
    $('google-help').textContent = '연결된 Google 계정으로 Drive 변경 사항을 감시합니다.';
    markDone('google');
  } else {
    $('google-help').textContent = '팀 공유 폴더에 접근 가능한 Google 계정으로 로그인하세요.';
  }

  if (status.notion.configured) {
    markDone('notion');
  }

  const params = new URLSearchParams(location.search);
  if (params.get('connected') === 'google') {
    setMsg('g-msg', 'Google 계정 연결 완료.', 'ok');
    markDone('google');
  }

  updateDoneBanner(status);
}

function updateDoneBanner(status) {
  const allDone = status.discord.configured && status.google.connected && status.notion.configured;
  $('done-banner').style.display = allDone ? 'block' : 'none';
}

// ---- Discord ----

$('d-invite').addEventListener('click', () => {
  const clientId = $('d-clientId').value.trim();
  if (!clientId) return setMsg('d-msg', 'Client ID를 먼저 입력하세요.', 'err');
  const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot&permissions=${DISCORD_INVITE_PERMISSIONS}`;
  window.open(url, '_blank');
});

$('d-save').addEventListener('click', async () => {
  const clientId = $('d-clientId').value.trim();
  const botToken = $('d-token').value.trim();
  if (!botToken) return setMsg('d-msg', 'Bot Token을 입력하세요.', 'err');
  try {
    const { guilds } = await api('POST', '/api/discord/token', { clientId, botToken });
    if (!guilds.length) {
      return setMsg('d-msg', '토큰은 유효하지만 봇이 아직 어느 서버에도 없습니다. 먼저 봇을 초대하세요.', 'err');
    }
    const guildSelect = $('d-guild');
    guildSelect.innerHTML = guilds.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
    guildSelect.style.display = 'block';
    setMsg('d-msg', '서버를 선택하세요.', 'ok');
    await loadChannels(guilds[0].id);
  } catch (err) {
    setMsg('d-msg', err.message, 'err');
  }
});

async function loadChannels(guildId) {
  const { channels } = await api('GET', `/api/discord/channels?guildId=${encodeURIComponent(guildId)}`);
  const channelSelect = $('d-channel');
  channelSelect.innerHTML = channels.map((c) => `<option value="${c.id}">#${c.name}</option>`).join('');
  channelSelect.style.display = 'block';
  $('d-channel-save').style.display = 'inline-block';
}

$('d-guild').addEventListener('change', (e) => loadChannels(e.target.value));

$('d-channel-save').addEventListener('click', async () => {
  const channelId = $('d-channel').value;
  const channelName = $('d-channel').selectedOptions[0]?.textContent || '';
  try {
    await api('POST', '/api/discord/channel', { channelId, channelName });
    setMsg('d-msg', `#${channelName} 채널로 알림을 보냅니다.`, 'ok');
    markDone('discord');
    loadStatus();
  } catch (err) {
    setMsg('d-msg', err.message, 'err');
  }
});

// ---- Google ----

$('g-login').addEventListener('click', () => {
  window.location.href = '/auth/google/start';
});

// ---- Notion ----

$('n-save').addEventListener('click', async () => {
  const apiKey = $('n-key').value.trim();
  if (!apiKey) return setMsg('n-msg', 'Integration Secret을 입력하세요.', 'err');
  try {
    const { targets } = await api('POST', '/api/notion/key', { apiKey });
    renderTargets(targets);
    setMsg('n-msg', targets.length ? '감시할 항목을 선택하세요.' : '연결에 성공했지만 공유된 페이지가 없습니다. Notion에서 연결 추가를 먼저 하세요.', targets.length ? 'ok' : 'err');
  } catch (err) {
    setMsg('n-msg', err.message, 'err');
  }
});

function renderTargets(targets) {
  const box = $('n-targets');
  box.innerHTML = targets
    .map(
      (t) => `<label>
        <input type="checkbox" value="${t.id}" data-type="${t.type}" />
        ${t.title} <small>(${t.type === 'database' ? 'DB' : '페이지'})</small>
      </label>`
    )
    .join('');
  box.style.display = targets.length ? 'block' : 'none';
  $('n-targets-save').style.display = targets.length ? 'inline-block' : 'none';
}

$('n-targets-save').addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('#n-targets input:checked')];
  const pageIds = checked.filter((c) => c.dataset.type === 'page').map((c) => c.value);
  const databaseIds = checked.filter((c) => c.dataset.type === 'database').map((c) => c.value);
  try {
    await api('POST', '/api/notion/targets', { pageIds, databaseIds });
    setMsg('n-msg', `${checked.length}개 항목을 감시 대상으로 저장했습니다.`, 'ok');
    markDone('notion');
    loadStatus();
  } catch (err) {
    setMsg('n-msg', err.message, 'err');
  }
});

loadStatus();
