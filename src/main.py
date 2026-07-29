import time

from src import config
from src import discord_notifier as discord
from src import poller


def main() -> None:
    if not config.discord.bot_token or not config.discord.channel_id:
        print("Discord 설정이 없습니다. 먼저 `python -m src.setup_server` 로 봇 토큰/채널을 연결하세요.")
        raise SystemExit(1)

    if not config.google.enabled and not config.notion.enabled:
        print(
            "[poller] Google Drive / Notion 둘 다 연결되어 있지 않습니다. "
            "`python -m src.setup_server` 에서 최소 하나는 연결하세요."
        )

    me = discord.ready()
    print(f"[discord] {me['username']} 봇 토큰 확인 완료")
    print(f"[poller] {config.poll_interval_ms}ms 간격으로 감시를 시작합니다.")

    p = poller.start(config.poll_interval_ms)

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass
    finally:
        p.stop()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as err:
        print(f"시작 중 오류: {err}")
        raise SystemExit(1)
