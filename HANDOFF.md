# HANDOFF — collab-discord-notifier

최신 항목이 위. 새 항목은 `handoff` 스킬 형식으로 맨 위에 추가.

## Handoff — 2026-07-30 — collab-discord-notifier

### 컨텍스트

- 프로젝트: `projects/collab-discord-notifier`
- 목표(한 줄): Google Drive / Notion 공유 문서 수정 시 Discord 채널로 알림을 보내는 봇 (20명 내외 벤처팀, 단일 서버)
- 세션 cwd: `D:\Dev\projects\collab-discord-notifier`
- 원격: https://github.com/cidtw/collab-discord-notifier (private)

### 한 일

- **1차 구현 (Node.js + discord.js)**: Google Drive Changes API 폴링, Notion 페이지/DB 폴링, Discord 임베드 알림. `.env`에 모든 값을 직접 입력하는 방식으로 시작. 커밋·푸시.
- **설정 마법사 추가**: `.env` 직접 편집이 번거롭다는 피드백 → "Discord 권한으로 Google/Notion 계정 연결 가능한가?" 질문에 Discord OAuth와 Google/Notion 인증은 별개임을 설명. 20명 단일 팀 조건 확인 후 "관리자 1명만 연결하면 팀 전체 변경사항이 보인다"는 구조를 설명. 브라우저 기반 설정 마법사(Express)를 구축해 Discord 봇 토큰/채널 드롭다운 선택, Google OAuth 로그인 버튼, Notion 키 입력 + 공유 페이지 체크박스 선택 흐름 구현. 향후 여러 팀 배포 가능성을 대비해 `store.js`로 설정 저장 로직 분리. 커밋·푸시.
- **제로 의존성 전환**: "npm 필수인가, 용량 부족 상황 고려" 질문 → `node_modules` 145MB 중 `googleapis`가 114MB임을 측정해 확인. `googleapis`/`discord.js`/`express`/`@notionhq/client`/`dotenv`/`open`을 전부 제거하고 Node 내장 `fetch`/`http`/`fs`로 재작성. `node_modules` 0MB, `npm install` 불필요 상태로 전환. 커밋·푸시.
- **Python 전환**: "Node는 Docker 필요"라는 전제를 정정(Node는 Docker 없이 네이티브 실행됨)했으나 사용자가 그래도 Python 전환 요청. Python 3.9+ 표준 라이브러리(`urllib.request`, `http.server`, `webbrowser`, `threading`)만으로 전체 재작성, 외부 패키지 0개. 검증 중 실제 버그 발견·수정: Discord API가 Cloudflare 뒤에 있어 `urllib` 기본 User-Agent를 봇 트래픽으로 오인해 403(에러코드 1010) 차단 → Discord 권장 형식의 User-Agent 헤더 추가로 해결. 커밋·푸시 (최신: `da568e6`).

### 남은 일

- [ ] 실제 Discord 봇 토큰 / Google OAuth / Notion Integration 자격 증명으로 end-to-end 테스트 (지금까지는 더미 값으로 오류 처리 경로만 검증함)
- [ ] Windows 상시 실행용 프로세스 등록 (작업 스케줄러 또는 서비스 등록 도구, 아직 미설정)
- [ ] `projects/README.md` 인덱스에 이미 등록되어 있음 (첫 커밋 시 `sync-index.ps1` 실행 완료) — 추가 조치 불필요

### 블로커 / 결정 필요

- 없음. 다음 세션에서 실제 자격 증명 준비되면 바로 end-to-end 테스트 진행 가능.

### 참고 파일

- `projects/collab-discord-notifier/README.md` — 설정 마법사 사용법, Google/Discord/Notion 자격 증명 발급 절차, "왜 Python 표준 라이브러리만 쓰는가", "여러 팀으로 확장 시" 방향 정리
- `projects/collab-discord-notifier/src/` — Python 소스 (config/store/state/load_env, services/{google_drive,discord_api,notion,notion_api}, setup_server, poller, main)
- `projects/collab-discord-notifier/public/setup.html`, `setup.js` — 설정 마법사 프론트엔드 (백엔드 언어 무관, Node→Python 전환에도 그대로 재사용됨)

_원본: `D:/Dev/handoff/archive/2026-Q3/2026-07-30_collab-discord-notifier.md`_

---
