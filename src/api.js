/**
 * AgentSocket — WebSocket client for the AI Agent backend.
 *
 * Incoming message types:
 *   connected          — session established
 *   token              — streaming LLM text chunk      { content }
 *   tool_start         — tool invocation begins         { tool, input }
 *   tool_end           — tool invocation ends           { tool, output }
 *   permission_request — shell permission gate          { command }
 *   done               — turn complete
 *   history_compacted  — chat history was summarized
 *   history_restored   — saved conversation loaded      { messages, title }
 *   error              — backend error                  { content }
 *
 * Outgoing message types:
 *   message            — user chat message              { content }
 *   permission_response — shell gate answer             { approved }
 *   save_messages      — persist conversation           { messages, title }
 *   rename_conversation — rename active conversation    { title }
 */
export class AgentSocket {
  /**
   * @param {string} sessionId
   * @param {{
   *   onConnected?: () => void,
   *   onToken?: (content: string) => void,
   *   onToolStart?: (tool: string, input: object) => void,
   *   onToolEnd?: (tool: string, output: string) => void,
   *   onPermissionRequest?: (command: string) => void,
   *   onDone?: () => void,
   *   onHistoryCompacted?: (summary: string) => void,
   *   onHistoryRestored?: (messages: object[], title: string) => void,
   *   onError?: (content: string) => void,
   *   onDisconnect?: () => void,
   * }} callbacks
   */
  constructor(sessionId, callbacks = {}) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
    this.ws = null;
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/ws/${this.sessionId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      const { type } = msg;
      const cb = this.callbacks;
      if (type === "connected") cb.onConnected?.();
      else if (type === "token") cb.onToken?.(msg.content ?? "");
      else if (type === "tool_start") cb.onToolStart?.(msg.tool, msg.input ?? {});
      else if (type === "tool_end") cb.onToolEnd?.(msg.tool, msg.output ?? "");
      else if (type === "permission_request") cb.onPermissionRequest?.(msg.command ?? "");
      else if (type === "done") cb.onDone?.();
      else if (type === "history_compacted") cb.onHistoryCompacted?.(msg.summary ?? "");
      else if (type === "history_restored") cb.onHistoryRestored?.(msg.messages ?? [], msg.title ?? "");
      else if (type === "error") cb.onError?.(msg.content ?? "Unknown error");
    };

    this.ws.onclose = () => {
      this.callbacks.onDisconnect?.();
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.("WebSocket connection error");
    };
  }

  /**
   * Send a user message to the agent.
   * @param {string} content
   * @param {{ data: string, mime_type: string }[] | null} images  Optional base64 image payloads.
   */
  sendMessage(content, images = null) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload = { type: "message", content };
      if (images?.length) payload.images = images;
      this.ws.send(JSON.stringify(payload));
    }
  }

  /** Respond to a shell permission request. */
  sendPermissionResponse(approved) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "permission_response", approved }));
    }
  }

  /**
   * Persist the current conversation to the backend.
   * @param {object[]} messages  The full UI messages array.
   * @param {string} title       Conversation title.
   */
  sendSaveMessages(messages, title) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "save_messages", messages, title }));
    }
  }

  /**
   * Rename the active conversation on the backend.
   * @param {string} title  New title.
   */
  sendRenameConversation(title) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "rename_conversation", title }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
