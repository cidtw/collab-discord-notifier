# collab-discord-notifier

Google Drive / Notion 공유 문서가 수정되면 폴링으로 감지해서 Discord 채널에 알림을 보내는 봇.

## 상태

- 2026-07-30: 설정 마법사(웹 UI) 추가 — 관리자가 `.env`를 직접 편집하지 않고 브라우저에서 Discord/Google/Notion을 연결.
- 2026-07-30: Node.js → **Python 표준 라이브러리만 사용하는 구현으로 전환**. `pip install` 자체가 필요 없음 (외부 패키지 0개, venv도 필수 아님). Node.js 버전은 git 이력(`e951071` 커밋 이전)에 남아있음.
- 20명 내외 단일 팀·단일 서버 사용을 기준으로 만들었고, 향후 다른 팀에도 배포할 가능성을 염두에 두고 설정값 저장 구조를 분리해둠 (아래 "여러 팀으로 확장 시" 참고).
- 실제 자격 증명으로 end-to-end 검증은 아직 안 함.

## 왜 Python 표준 라이브러리만 쓰는가

Discord/Google/Notion은 전부 평범한 REST API + OAuth2라서, SDK 없이 `urllib.request` 하나로 다 호출된다.
외부 패키지가 하나도 없으니 `pip install`도, `requirements.txt`도, 가상환경도 필요 없다 — Python 3.9+ 표준
설치만 있으면 그대로 실행된다.

| 기능 | 쓰는 표준 라이브러리 |
|---|---|
| REST 호출 (Discord/Google/Notion) | `urllib.request`, `urllib.parse` |
| 설정 저장 (`data/config.json`, `data/state.json`) | `json`, `pathlib` |
| `.env` 파싱 | 직접 구현 (`src/load_env.py`, 20줄) |
| 설정 마법사 웹 서버 | `http.server.ThreadingHTTPServer` |
| 브라우저 자동 실행 | `webbrowser.open()` |
| 폴링 스케줄러 | `threading.Timer`/`Event` |

## 동작 방식

- **Google Drive**: Drive API의 [Changes](https://developers.google.com/drive/api/guides/manage-changes) 엔드포인트를 폴링. 관리자 한 명(또는 봇 전용 계정)이 팀 공유 폴더에 접근 가능한 계정으로 한 번만 로그인하면, 그 계정이 볼 수 있는 모든 변경 이력(=팀원 전체의 수정)을 감지함.
- **Notion**: 설정 마법사에서 고른 페이지/데이터베이스 ID의 `last_edited_time`을 이전 값과 비교. Notion Integration이 공유(Share)된 대상만 볼 수 있음 — 워크스페이스 전체 자동 감시는 안 됨.
- **Discord**: 실시간 이벤트를 듣는 게 아니라 REST로 메시지만 보내므로, 봇이 디스코드 멤버 목록에서는 "오프라인"으로 표시됨 (기능상 문제 없음).
- 세 서비스 모두 **최초 실행 시에는 기준선만 기록**하고 알림을 보내지 않음 (과거 이력 스팸 방지).

## 설정값이 두 종류로 나뉘는 이유

| 종류 | 저장 위치 | 누가, 언제 채우나 |
|---|---|---|
| 앱 공용 값 (Google OAuth 클라이언트) | `.env` (`GOOGLE_APP_CLIENT_ID/SECRET`) | 이 도구를 처음 세팅하는 사람이 **평생 한 번** Google Cloud Console에서 발급 |
| 설치별 값 (Discord 봇 토큰/채널, Notion 키, Google 리프레시 토큰) | `data/config.json` (gitignore됨) | 팀 관리자가 설정 마법사에서 브라우저로 연결 — 텍스트 파일 편집 없음 |

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

Python 3.9 이상만 있으면 된다 (`python --version` 으로 확인). 별도 설치 단계 없음.

```bash
cd D:\Dev\projects\collab-discord-notifier
# pip install 불필요 (의존성 없음)
copy .env.example .env   REM GOOGLE_APP_CLIENT_ID/SECRET 만 채우면 됨
python -m src.setup_server   REM 브라우저가 자동으로 열림 (http://localhost:4600)
```

설정 마법사에서:
1. **Discord**: Client ID + Bot Token 입력 → "봇 초대 링크 열기"로 서버에 봇 추가 → "토큰 저장 & 서버 불러오기" → 서버/채널 선택 후 저장
2. **Google**: "Google 계정으로 로그인" 클릭 → 팀 공유 폴더에 접근 가능한 계정으로 로그인/동의
3. **Notion**: Integration Secret 입력 → 목록에서 감시할 페이지/DB 체크 → 저장

세 단계가 모두 끝나면:

```bash
python -m src.main
```

- 브라우저를 못 여는 원격 서버 환경이라면 `python -m src.scripts.google_authorize` (CLI 버전, Google 단계만 대체 가능)를 대신 써도 됨.
- 폴링 주기는 `.env`의 `POLL_INTERVAL_MS` (기본 2분, 밀리초 단위)로 조절.
- `data/state.json`(폴링 진행 위치)과 `data/config.json`(연결 정보) 둘 다 지우면 완전 초기화됨.
- 명령은 프로젝트 루트(`D:\Dev\projects\collab-discord-notifier`)에서 `python -m src.xxx` 형태로 실행해야 함 (`python src/main.py` 처럼 직접 실행하면 패키지 상대 경로가 깨짐).

## 여러 팀으로 확장 시 (아직 구현 안 함, 방향만 기록)

지금은 `data/config.json` 하나에 팀 하나의 설정만 들어가는 구조. 나중에 서드파티로 다른 팀에도 배포하려면:

- **저장소**: `src/store.py`가 유일하게 config를 읽고 쓰는 모듈이라, 여기만 SQLite/Postgres 기반 "팀(workspace)별 row"로 바꾸면 나머지 코드(poller, notifier, services)는 거의 안 건드려도 됨.
- **호스팅**: 지금처럼 로컬 상시 실행이 아니라 공개 서버에 올려야 함 (OAuth 콜백 URL이 공인 도메인이어야 하고, 팀마다 별도 폴링 스케줄이 필요).
- **Notion**: 지금 쓰는 Internal Integration은 워크스페이스 하나에 종속됨. 여러 팀을 지원하려면 Notion **Public Integration**(OAuth, Notion 심사 필요)으로 바꿔야 함.
- **Google**: 테스트 사용자 100명을 넘기거나 민감한 스코프를 쓰게 되면 **OAuth 앱 검증**을 받아야 함 (지금 쓰는 `drive.metadata.readonly`는 민감 스코프까지는 아니라 검증 문턱이 상대적으로 낮음).
- **인증/권한**: "이 팀의 관리자만 설정을 바꿀 수 있어야 한다" 같은 멀티테넌트 권한 모델이 새로 필요함.

## 한계 / TODO

- Windows에서 상시 실행하려면 작업 스케줄러 또는 `nssm` 같은 서비스 등록 도구 필요 (아직 미설정).
- 실제 Discord 봇 토큰 / Google OAuth / Notion Integration으로 end-to-end 검증은 아직 안 함 — 자격 증명 준비 후 반드시 실제 문서 수정으로 테스트할 것.
