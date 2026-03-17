from __future__ import annotations

from agent import AgentContext
from helpers.api import ApiHandler, Input, Output, Request, Response
from helpers.persist_chat import save_tmp_chat
from helpers.state_monitor_integration import mark_dirty_all
from usr.plugins.chat_rename.helpers.constants import (
    MANUAL_LOCK_DATA_KEY,
    MAX_MANUAL_CHAT_NAME_LENGTH,
)


class RenameChat(ApiHandler):
    async def process(self, input: Input, request: Request) -> Output:
        action = str(input.get("action", "")).strip().lower()
        ctxid = str(input.get("context", "")).strip()

        if not ctxid:
            return Response("Missing context id", 400)

        context = AgentContext.get(ctxid)
        if not context:
            return Response("Context not found", 404)

        if action == "set":
            raw_name = input.get("name")
            if not isinstance(raw_name, str):
                return Response("Missing chat name", 400)

            name = raw_name.strip()[:MAX_MANUAL_CHAT_NAME_LENGTH]
            if not name:
                return Response("Chat name cannot be empty", 400)

            context.name = name
            context.data[MANUAL_LOCK_DATA_KEY] = True
            save_tmp_chat(context)
            mark_dirty_all(reason="plugins.chat_rename.rename_chat.set")

            return {
                "ok": True,
                "context": context.id,
                "name": context.name,
                "manual_lock": True,
            }

        if action == "clear":
            context.name = None
            context.data.pop(MANUAL_LOCK_DATA_KEY, None)
            save_tmp_chat(context)
            mark_dirty_all(reason="plugins.chat_rename.rename_chat.clear")

            return {
                "ok": True,
                "context": context.id,
                "name": None,
                "manual_lock": False,
            }

        return Response("Unknown action", 400)
