# Chat Rename

Chat Rename adds a rename action to every chat row in the sidebar.

## Features

- Rename any chat directly from the sidebar
- Persist manual chat titles across refreshes and restarts
- Lock manual titles so the built-in automatic chat renamer does not overwrite them
- Reset a chat back to automatic naming when needed

## How It Works

- A WebUI extension enhances the existing sidebar chat list and injects a rename button beside the built-in close button.
- A small modal lets the user save a manual title or reset the chat back to auto mode.
- A plugin API handler persists the chosen title in the chat context and broadcasts state updates to every tab.
- A shadowed `monologue_start/_60_rename_chat.py` extension preserves the core auto-title behavior unless a manual lock is set.
