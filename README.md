# collab-discord-notifier

Google Drive / Notion 공유 문서가 수정되면 폴링으로 감지해서 Discord 채널에 알림을 보내는 봇.

## 상태

- 2026-07-30: 설정 마법사(웹 UI) 추가 — 관리자가 `.env`를 직접 편집하지 않고 브라우저에서 Discord/Google/Notion을 연결.
- 2026-07-30: **제로 의존성(zero-dependency)으로 전환** — `googleapis`(114MB), `discord.js`, `express`, `@notionhq/client`, `dotenv`, `open`을 전부 걷어내고 Node 내장 `fetch`/`http`/`fs`만으로 재작성. `npm install` 자체가 필요 없음 (`node_modules` 없음).
- 20명 내외 단일 팀·단일 서버 사용을 기준으로 만들었고, 향후 다른 팀에도 배포할 가능성을 염두에 두고 설정값 저장 구조를 분리해둠 (아래 "여러 팀으로 확장 시" 참고).
- 실제 자격 증명으로 end-to-end 검증은 아직 안 함.

## 왜 제로 의존성인가

npm 저장 공간이 부족한 환경에서도 돌아가야 한다는 요구로, 라이브러리를 전부 REST 직접 호출로 바꿨다.

| 걷어낸 패키지 | 용량 | 대체 방법 |
|---|---|---|
| `googleapis` + `google-auth-library` | 114MB+ | OAuth 토큰 발급/갱신, Drive Changes API를 `fetch`로 직접 호출 (`src/services/googleDrive.js`) |
| `discord.js` + 관련 패키지 | ~17MB | 이 봇은 실시간 이벤트를 듣지 않고 메시지만 보내므로 게이트웨이 연결 자체가 불필요. REST로 메시지 전송/토큰 검증만 함 (`src/services/discordApi.js`) |
| `express` | ~1MB+ | Node 내장 `http` 모듈로 라우팅 (`src/setupServer.js`) |
| `@notionhq/client` | ~1MB | Notion REST API 직접 호출 (`src/services/notionApi.js`) |
| `dotenv` | 작음 | `.env` 파서 20줄 직접 구현 (`src/loadEnv.js`) |
| `open` | 작음 | OS별 명령(`start`/`open`/`xdg-open`)을 `child_process.exec`로 실행 |

결과: `node_modules` 자체가 생기지 않음. `npm install` 없이 `node src/setupServer.js`, `node src/index.js` 만으로 실행 가능 (Node 18+ 필요 — 내장 `fetch` 때문).

## 동작 방식

- **Google Drive**: Drive API의 [Changes](https://developers.google.com/drive/api/guides/manage-changes) 엔드포인트를 폴링. 관리자 한 명(또는 봇 전용 계정)이 팀 공유 폴더에 접근 가능한 계정으로 한 번만 로그인하면, 그 계정이 볼 수 있는 모든 변경 이력(=팀원 전체의 수정)을 감지함.
- **Notion**: `.env`가 아니라 설정 마법사에서 고른 페이지/데이터베이스 ID의 `last_edited_time`을 이전 값과 비교. Notion Integration이 공유(Share)된 대상만 볼 수 있음 — 워크스페이스 전체 자동 감시는 안 됨.
- 두 서비스 모두 **최초 실행 시에는 기준선만 기록**하고 알림을 보내지 않음 (과거 이력 스팸 방지).

## 설정값이 두 종류로 나뉘는 이유

| 종류 | 저장 위치 | 누가, 언제 채우나 |
|---|---|---|
| 앱 공용 값 (Google OAuth 클라이언트) | `.env` (`GOOGLE_APP_CLIENT_ID/SECRET`) | 이 도구를 처음 세팅하는 사람이 **평생 한 번** Google Cloud Console에서 발급 |
| 설치별 값 (Discord 봇 토큰/채널, Notion 키, Google 리프레시 토큰) | `data/config.json` (gitignore됨) | 팀 관리자가 `npm run setup` 마법사에서 브라우저로 연결 — 텍스트 파일 편집 없음 |

## 준비 (관리자 1회 작업)

### 1. Google OAuth 클라이언트 발급 (아직 없다면 딱 한 번)

1. https://console.cloud.google.com 에서 프로젝트 생성
2. "API 및 서비스 → 라이브러리"에서 **Google Drive API** 활성화
3. "API 및 서비스 → OAuth 동의 화면" 구성 (User Type: 외부, 테스트 사용자에 팀 공유 폴더 접근 가능한 계정 추가)
4. "사용자 인증 정보 만들기 → OAuth 클라이언트 ID" → 애플리케이션 유형 **데스크톱 앱**
5. 발급된 값을 `.env`의 `GOOGLE_APP_CLIENT_ID`, `GOOGLE_APP_CLIENT_SECRET`에 입력 (`.env.example` 복사해서 시작)

### 2. Discord 애플리케이션 생성 (봇 자체는 여전히 필요)

1. https://discord.com/developers/applications 에서 New Application
2. Bot 탭 → Reset Token으로 토큰 발급 (마법사에 붙여넣을 값)
3. 상단 Application ID(Client ID)도 같이 복사 (마법사가 초대 링크를 만들어줌)

### 3. Notion Integration 생성

1. https://www.notion.so/my-integrations 에서 새 Integration 생성 → Secret 발급 (마법사에 붙여넣을 값)
2. 감시하고 싶은 페이지/데이터베이스를 열고 `...` → **연결 추가(Add connections)** → 방금 만든 Integration 선택

## 설치 및 실행

```bash
cd D:\Dev\projects\collab-discord-notifier
# npm install 불필요 (의존성 없음)
cp .env.example .env   # GOOGLE_APP_CLIENT_ID/SECRET 만 채우면 됨
npm run setup           # 또는 node src/setupServer.js — 브라우저가 자동으로 열림 (http://localhost:4600)
```

설정 마법사에서:
1. **Discord**: Client ID + Bot Token 입력 → "봇 초대 링크 열기"로 서버에 봇 추가 → "토큰 저장 & 서버 불러오기" → 서버/채널 선택 후 저장
2. **Google**: "Google 계정으로 로그인" 클릭 → 팀 공유 폴더에 접근 가능한 계정으로 로그인/동의
3. **Notion**: Integration Secret 입력 → 목록에서 감시할 페이지/DB 체크 → 저장

세 단계가 모두 끝나면:

```bash
npm start   # 또는 node src/index.js
```

- 브라우저를 못 여는 원격 서버 환경이라면 `npm run google:authorize` (CLI 버전, Google 단계만 대체 가능)를 대신 써도 됨.
- 폴링 주기는 `.env`의 `POLL_INTERVAL_MS` (기본 2분)로 조절.
- `data/state.json`(폴링 진행 위치)과 `data/config.json`(연결 정보) 둘 다 지우면 완전 초기화됨.

## 여러 팀으로 확장 시 (아직 구현 안 함, 방향만 기록)

지금은 `data/config.json` 하나에 팀 하나의 설정만 들어가는 구조. 나중에 서드파티로 다른 팀에도 배포하려면:

- **저장소**: `src/store.js`가 유일하게 config를 읽고 쓰는 모듈이라, 여기만 SQLite/Postgres 기반 "팀(workspace)별 row"로 바꾸면 나머지 코드(poller, notifier, services)는 거의 안 건드려도 됨.
- **호스팅**: 지금처럼 로컬 상시 실행이 아니라 공개 서버에 올려야 함 (OAuth 콜백 URL이 공인 도메인이어야 하고, 팀마다 별도 폴링 스케줄이 필요).
- **Notion**: 지금 쓰는 Internal Integration은 워크스페이스 하나에 종속됨. 여러 팀을 지원하려면 Notion **Public Integration**(OAuth, Notion 심사 필요)으로 바꿔야 함.
- **Google**: 테스트 사용자 100명을 넘기거나 민감한 스코프를 쓰게 되면 **OAuth 앱 검증**을 받아야 함 (지금 쓰는 `drive.metadata.readonly`는 민감 스코프까지는 아니라 검증 문턱이 상대적으로 낮음).
- **인증/권한**: "이 팀의 관리자만 설정을 바꿀 수 있어야 한다" 같은 멀티테넌트 권한 모델이 새로 필요함.

## 한계 / TODO

- Windows에서 상시 실행하려면 작업 스케줄러 또는 `pm2` 같은 프로세스 매니저 등록 필요 (아직 미설정).
- 실제 Discord 봇 토큰 / Google OAuth / Notion Integration으로 end-to-end 검증은 아직 안 함 — 자격 증명 준비 후 반드시 실제 문서 수정으로 테스트할 것.
