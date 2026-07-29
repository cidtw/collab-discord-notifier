from datetime import datetime, timezone

from src import config
from src.services import discord_api

SOURCE_STYLE = {
    "google_drive": {"label": "Google Drive", "color": 0x1A73E8, "emoji": "📄"},
    "notion": {"label": "Notion", "color": 0x000000, "emoji": "📝"},
}


def ready() -> dict:
    """봇 토큰이 유효한지 확인하고, 봇 자신의 정보를 반환한다."""
    return discord_api.get_self(config.discord.bot_token)


def notify_change(change: dict) -> None:
    """change: { source, title, url?, editor?, editedAt? }"""
    style = SOURCE_STYLE[change["source"]]
    fields = [{"name": "출처", "value": style["label"], "inline": True}]
    if change.get("editor"):
        fields.append({"name": "수정한 사람", "value": change["editor"], "inline": True})

    edited_at = change.get("editedAt")
    timestamp = edited_at if edited_at else datetime.now(timezone.utc).isoformat()

    embed = {
        "color": style["color"],
        "title": f"{style['emoji']} {change.get('title') or '(제목 없음)'}",
        "description": "문서가 수정되었습니다.",
        "timestamp": timestamp,
        "fields": fields,
    }
    if change.get("url"):
        embed["url"] = change["url"]

    discord_api.send_message(config.discord.bot_token, config.discord.channel_id, {"embeds": [embed]})
