# collab-discord-notifier

Google Drive / Notion 공유 문서가 수정되면 폴링으로 감지해서 Discord 채널에 알림을 보내는 봇.

## 상태

- 최초 구현 완료 (2026-07-29). 실제 자격 증명으로 아직 동작 검증 전.
- 로컬 상시 실행 + 폴링 방식 (공개 웹훅 서버 불필요).

## 동작 방식

- **Google Drive**: Drive API의 [Changes](https://developers.google.com/drive/api/guides/manage-changes) 엔드포인트를 폴링. `pageToken`을 `data/state.json`에 저장해 두고, 그 이후 변경분만 조회.
- **Notion**: `.env`에 명시한 페이지/데이터베이스 ID를 폴링해서 `last_edited_time`을 이전 값과 비교. Notion API 특성상 워크스페이스 전체를 자동 감시할 수 없고, Integration이 공유(Share)된 대상만 볼 수 있음.
- 두 서비스 모두 **최초 실행 시에는 기준선만 기록**하고 알림을 보내지 않음 (과거 이력 스팸 방지). 그 다음 폴링부터 변경 알림 시작.

## 준비물

### 1. Discord 봇

1. https://discord.com/developers/applications 에서 New Application 생성
2. Bot 탭 → Reset Token 으로 토큰 발급 → `DISCORD_BOT_TOKEN`
3. OAuth2 → URL Generator: scope `bot` 체크, 권한 `Send Messages`, `Embed Links` 체크 → 생성된 URL로 봇을 서버에 초대
4. Discord 앱에서 설정 → 고급 → 개발자 모드 켜기 → 알림 받을 채널 우클릭 → **채널 ID 복사** → `DISCORD_CHANNEL_ID`

### 2. Google Drive (OAuth)

Drive는 서비스 계정으로는 개인 파일에 접근할 수 없으므로 OAuth 사용자 인증 방식을 씁니다.

1. https://console.cloud.google.com 에서 프로젝트 생성
2. "API 및 서비스 → 라이브러리"에서 **Google Drive API** 활성화
3. "API 및 서비스 → OAuth 동의 화면" 구성 (User Type: 외부/테스트, 본인 이메일을 테스트 사용자로 추가)
4. "API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID" → 애플리케이션 유형 **데스크톱 앱**
5. 발급된 클라이언트 ID/보안 비밀번호를 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력
6. `npm run google:authorize` 실행 → 콘솔에 뜨는 URL을 브라우저로 열어 로그인/동의 → 자동으로 `.env`에 `GOOGLE_REFRESH_TOKEN`이 채워짐

> 감시 범위: Drive Changes API는 **내 계정이 접근 가능한 전체 드라이브의 변경 이력**을 반환합니다. 특정 폴더만 보고 싶다면 `src/services/googleDrive.js`의 `pollChanges`에서 `change.file.parents` 등을 이용해 필터를 추가하세요.

### 3. Notion

1. https://www.notion.so/my-integrations 에서 새 Integration 생성 → **Internal Integration Secret** 발급 → `NOTION_API_KEY`
2. 감시하고 싶은 페이지 또는 데이터베이스를 열고 우측 상단 `...` → **연결 추가(Add connections)** → 방금 만든 Integration 선택 (공유하지 않으면 API로 보이지 않음)
3. 페이지 ID는 페이지 URL 끝의 32자리 문자열, 데이터베이스 ID는 데이터베이스를 전체 화면으로 열었을 때 URL에 있는 32자리 문자열
4. `.env`의 `NOTION_PAGE_IDS`, `NOTION_DATABASE_IDS`에 쉼표로 구분해 입력 (둘 중 하나만 있어도 됨)

## 설치 및 실행

```bash
cd D:\Dev\projects\collab-discord-notifier
npm install
cp .env.example .env   # 값 채우기
npm run google:authorize   # Google Drive 감시할 때만, 최초 1회
npm start
```

- 폴링 주기는 `.env`의 `POLL_INTERVAL_MS` (기본 120000 = 2분)로 조절.
- `data/state.json`에 진행 상태(Google pageToken, Notion 마지막 수정 시각)가 저장됨. 이 파일을 지우면 다음 실행 시 다시 기준선부터 시작(과거 변경 알림 없음).
- Google Drive 또는 Notion 둘 중 하나만 설정해도 동작함 (`.env`에 필요한 값이 없는 쪽은 자동으로 건너뜀).

## 한계 / TODO

- Windows에서 상시 실행하려면 작업 스케줄러 또는 `pm2` 같은 프로세스 매니저 등록 필요 (아직 미설정).
- Notion 워크스페이스 전체 자동 탐색은 미지원 (감시 대상을 ID로 명시해야 함).
- 실제 Discord 봇 토큰 / Google OAuth / Notion Integration으로 end-to-end 검증은 아직 안 함 — 자격 증명 준비 후 반드시 실제 문서 수정으로 테스트할 것.
