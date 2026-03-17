from __future__ import annotations

import asyncio

from agent import LoopData
from helpers import persist_chat, tokens
from helpers.extension import Extension
from usr.plugins.chat_rename.helpers.constants import MAX_AUTO_CHAT_NAME_LENGTH
from usr.plugins.chat_rename.helpers.state import is_manual_name_locked


class RenameChat(Extension):
    async def execute(self, loop_data: LoopData = LoopData(), **kwargs):
        asyncio.create_task(self.change_name())

    async def change_name(self):
        if not self.agent:
            return

        if is_manual_name_locked(self.agent.context):
            return

        try:
            history_text = self.agent.history.output_text()
            ctx_length = min(
                int(self.agent.config.utility_model.ctx_length * 0.7),
                5000,
            )
            history_text = tokens.trim_to_tokens(history_text, ctx_length, "start")

            system = self.agent.read_prompt("fw.rename_chat.sys.md")
            current_name = self.agent.context.name
            message = self.agent.read_prompt(
                "fw.rename_chat.msg.md",
                current_name=current_name,
                history=history_text,
            )
            new_name = await self.agent.call_utility_model(
                system=system,
                message=message,
                background=True,
            )

            if new_name:
                if len(new_name) > MAX_AUTO_CHAT_NAME_LENGTH:
                    new_name = new_name[:MAX_AUTO_CHAT_NAME_LENGTH] + "..."
                self.agent.context.name = new_name
                persist_chat.save_tmp_chat(self.agent.context)
        except Exception:
            pass
