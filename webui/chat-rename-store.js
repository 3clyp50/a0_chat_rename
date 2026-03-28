import { createStore } from "/js/AlpineStore.js";
import { callJsonApi } from "/js/api.js";
import { openModal, closeModal } from "/js/modals.js";
import {
  toastFrontendError,
  toastFrontendSuccess,
} from "/components/notifications/notification-store.js";
import { store as chatsStore } from "/components/sidebar/chats/chats-store.js";

const RENAME_MODAL_PATH = "/plugins/chat_rename/webui/rename-modal.html";
const MAX_CHAT_NAME_LENGTH = 120;

const model = {
  targetContextId: "",
  draftName: "",
  isSaving: false,
  _sidebarMounted: false,
  _sidebarObserver: null,
  _syncScheduled: false,

  mountSidebarEnhancer() {
    if (this._sidebarMounted) {
      this.scheduleSidebarSync();
      return;
    }

    this._sidebarMounted = true;
    this._sidebarObserver = new MutationObserver(() => {
      this.scheduleSidebarSync();
    });
    this._sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    this.scheduleSidebarSync();
  },

  cleanupSidebarEnhancer() {
    if (this._sidebarObserver) {
      this._sidebarObserver.disconnect();
      this._sidebarObserver = null;
    }
    this._sidebarMounted = false;
    this._syncScheduled = false;
  },

  scheduleSidebarSync() {
    if (this._syncScheduled) return;

    this._syncScheduled = true;
    globalThis.requestAnimationFrame(() => {
      this._syncScheduled = false;
      this.syncSidebarButtons();
    });
  },

  syncSidebarButtons() {
    const list = document.querySelector(".chats-config-list");
    if (!list) return;

    const rows = Array.from(list.querySelectorAll(".chat-container"));
    const contexts = Array.isArray(chatsStore.contexts) ? chatsStore.contexts : [];

    rows.forEach((row, index) => {
      const context = contexts[index];
      const existing = row.querySelector(".chat-rename-action-btn");

      if (!context) {
        existing?.remove();
        row.querySelector(".chat-more-actions-btn")?.remove();
        row.classList.remove("chat-actions-expanded");
        delete row.dataset.chatRenameContextId;
        return;
      }

      row.dataset.chatRenameContextId = context.id;

      if (existing?.dataset.contextId === context.id) {
        this._ensureDotButton(row);
        return;
      }

      existing?.remove();

      const button = this.createRenameButton(context.id);
      const closeButton = this.findCloseButton(row);
      if (closeButton?.parentElement === row) {
        row.insertBefore(button, closeButton);
      } else {
        row.appendChild(button);
      }

      this._ensureDotButton(row);
    });
  },

  createRenameButton(contextId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "btn-icon-action chat-list-action-btn chat-rename-action-btn";
    button.dataset.contextId = contextId;
    button.setAttribute("title", "Rename chat");
    button.setAttribute("aria-label", "Rename chat");
    button.innerHTML =
      '<span class="material-symbols-outlined">drive_file_rename_outline</span>';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.openRenameModal(contextId);
    });
    return button;
  },

  findCloseButton(row) {
    return Array.from(row.querySelectorAll("button.chat-list-action-btn")).find(
      (button) =>
        !button.classList.contains("chat-rename-action-btn") &&
        button
          .querySelector(".material-symbols-outlined")
          ?.textContent?.trim() === "close",
    );
  },

  _ensureDotButton(row) {
    if (row.querySelector(".chat-more-actions-btn")) return;

    const dotBtn = document.createElement("button");
    dotBtn.type = "button";
    dotBtn.className =
      "btn-icon-action chat-list-action-btn chat-more-actions-btn";
    dotBtn.setAttribute("title", "More actions");
    dotBtn.setAttribute("aria-label", "More actions");
    dotBtn.setAttribute("aria-expanded", "false");
    dotBtn.innerHTML =
      '<span class="material-symbols-outlined">more_vert</span>';

    dotBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasExpanded = row.classList.contains("chat-actions-expanded");
      const nextExpanded = !wasExpanded;
      document.querySelectorAll(".chat-actions-expanded").forEach((r) => {
        r.classList.remove("chat-actions-expanded");
        const btn = r.querySelector(".chat-more-actions-btn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
      if (nextExpanded) {
        row.classList.add("chat-actions-expanded");
      }
      dotBtn.setAttribute("aria-expanded", String(nextExpanded));
    });

    row.appendChild(dotBtn);
  },


  getContextById(contextId) {
    return (
      (Array.isArray(chatsStore.contexts) ? chatsStore.contexts : []).find(
        (context) => context.id === contextId,
      ) || null
    );
  },

  getChatLabel(contextId) {
    const context = this.getContextById(contextId);
    return context ? context.name || `Chat #${context.no}` : "Chat";
  },

  async openRenameModal(contextId) {
    const context = this.getContextById(contextId);
    if (!context) {
      await toastFrontendError("Chat not found.", "Chat Rename");
      return;
    }

    this.targetContextId = contextId;
    this.draftName = context.name || "";
    this.isSaving = false;
    await openModal(RENAME_MODAL_PATH);
  },

  closeRenameModal() {
    closeModal(RENAME_MODAL_PATH);
  },

  normalizeDraftName() {
    const normalized = (this.draftName || "").trim().slice(0, MAX_CHAT_NAME_LENGTH);
    if (normalized !== this.draftName) {
      this.draftName = normalized;
    }
    return normalized;
  },

  async saveRename() {
    if (this.isSaving || !this.targetContextId) return;

    const normalized = this.normalizeDraftName();
    if (!normalized) {
      await toastFrontendError("Chat name is required.", "Chat Rename");
      return;
    }

    this.isSaving = true;
    try {
      const result = await callJsonApi("/plugins/chat_rename/rename_chat", {
        action: "set",
        context: this.targetContextId,
        name: normalized,
      });
      this.applyLocalRename(result.context || this.targetContextId, result.name);
      this.scheduleSidebarSync();
      await toastFrontendSuccess("Chat renamed.", "Chat Rename");
      this.closeRenameModal();
    } catch (error) {
      await toastFrontendError(
        error?.message || "Failed to rename chat.",
        "Chat Rename",
      );
    } finally {
      this.isSaving = false;
    }
  },

  async resetToAuto() {
    if (this.isSaving || !this.targetContextId) return;

    this.isSaving = true;
    try {
      const result = await callJsonApi("/plugins/chat_rename/rename_chat", {
        action: "clear",
        context: this.targetContextId,
      });
      this.applyLocalRename(result.context || this.targetContextId, null);
      this.scheduleSidebarSync();
      await toastFrontendSuccess(
        "Chat reset to automatic naming.",
        "Chat Rename",
      );
      this.closeRenameModal();
    } catch (error) {
      await toastFrontendError(
        error?.message || "Failed to reset chat name.",
        "Chat Rename",
      );
    } finally {
      this.isSaving = false;
    }
  },

  applyLocalRename(contextId, name) {
    const contexts = Array.isArray(chatsStore.contexts)
      ? [...chatsStore.contexts]
      : [];
    const contextIndex = contexts.findIndex((context) => context.id === contextId);

    if (contextIndex === -1) return;

    contexts[contextIndex] = {
      ...contexts[contextIndex],
      name,
    };
    chatsStore.contexts = contexts;

    if (chatsStore.selectedContext?.id === contextId) {
      chatsStore.selectedContext = contexts[contextIndex];
    }
  },
};

export const store = createStore("chatRename", model);
