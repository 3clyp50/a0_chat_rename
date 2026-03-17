from __future__ import annotations

from usr.plugins.chat_rename.helpers.constants import MANUAL_LOCK_DATA_KEY


def is_manual_name_locked(context) -> bool:
    getter = getattr(context, "get_data", None)
    if callable(getter):
        return bool(getter(MANUAL_LOCK_DATA_KEY))

    data = getattr(context, "data", None)
    if isinstance(data, dict):
        return bool(data.get(MANUAL_LOCK_DATA_KEY))

    return False
