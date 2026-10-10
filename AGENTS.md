# AGENTS.md — collab-discord-notifier

Google Drive / Notion 공유 문서 변경을 폴링으로 감지해 Discord로 알리는 봇. Python 3.9+ 표준 라이브러리만 사용.

워크스페이스 공통 규칙: `D:\Dev\AGENTS.md`

## 실행

```
python -m src.setup_server   # 설정 UI (http://localhost:4600)
python -m src.main
```

## 검증 (완료 선언 전 실행)

```
python -m src.main 을 짧게 실행해 폴링 1회와 Discord 전송 로그 확인 (자동 테스트 없음)
```

## 구조

- `src/` — 폴러·알림·설정 서버
- `public/` — 설정 UI

## 금지

- 사용자 요청 없는 커밋/푸시
- 비밀 파일(.env, *.pem, 토큰) 커밋
- 외부 패키지 의존성 추가 (stdlib only 원칙)

## 인수인계

진행 상황·남은 일은 `HANDOFF.md` (`handoff` 스킬로 작성).
