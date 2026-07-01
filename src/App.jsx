import { useState, useEffect, useRef, useCallback } from "react";
import { AgentSocket } from "./api";
import ChatWindow from "./components/ChatWindow";
import ConversationList from "./components/ConversationList";
import SettingsPanel from "./components/SettingsPanel";
import PermissionModal from "./components/PermissionModal";

let _msgCounter = 0;
const nextId = () => String(++_msgCounter);

function makeSessionId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [pendingPermission, setPendingPermission] = useState(null);
  const [connected, setConnected] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]); // [{ data: base64, mime_type, previewUrl }]
  const [isDragging, setIsDragging] = useState(false);
  // sessionId is state so changing it triggers WS reconnect via useEffect
  const [sessionId, setSessionId] = useState(makeSessionId);
  // Conversation persistence
  const [conversationTitle, setConversationTitle] = useState(null);
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
  // Sidebar tabs
  const [activeTab, setActiveTab] = useState("history");

  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  // Holds the id of the currently-streaming AI message
  const streamingIdRef = useRef(null);
  // Ref to access latest conversation title inside stable WS callbacks
  const conversationTitleRef = useRef(null);
  useEffect(() => { conversationTitleRef.current = conversationTitle; }, [conversationTitle]);

  // Resizable sidebar (persisted)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("ai-agent-sidebar-width");
    return saved ? Math.max(160, Math.min(480, parseInt(saved, 10))) : 256;
  });
  const sidebarWidthRef = useRef(sidebarWidth);

  // Sidebar visibility (persisted)
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const saved = localStorage.getItem("ai-agent-sidebar-visible");
    return saved === null ? true : saved === "true";
  });

  // Resizable input area (persisted)
  const [inputHeight, setInputHeight] = useState(() => {
    const saved = localStorage.getItem("ai-agent-input-height");
    return saved ? Math.max(60, Math.min(400, parseInt(saved, 10))) : 120;
  });
  const inputHeightRef = useRef(inputHeight);

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const next = !v;
      localStorage.setItem("ai-agent-sidebar-visible", String(next));
      return next;
    });
  }, []);

  // Conversation handlers
  const handleSelectConversation = useCallback((id) => {
    setMessages([]);
    setConversationTitle(null);
    setIsThinking(false);
    streamingIdRef.current = null;
    setSessionId(id);
  }, []);

  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setConversationTitle(null);
    setIsThinking(false);
    streamingIdRef.current = null;
    setSessionId(makeSessionId());
  }, []);

  const handleRenameActive = useCallback((id, newTitle) => {
    setSessionId((current) => {
      if (id === current) setConversationTitle(newTitle);
      return current;
    });
  }, []);

  const handleSidebarDragStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;
    const onMouseMove = (me) => {
      const newWidth = Math.max(160, Math.min(480, startWidth + me.clientX - startX));
      sidebarWidthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      localStorage.setItem("ai-agent-sidebar-width", String(sidebarWidthRef.current));
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const handleInputDragStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = inputHeightRef.current;
    const onMouseMove = (me) => {
      const newHeight = Math.max(60, Math.min(400, startHeight + startY - me.clientY));
      inputHeightRef.current = newHeight;
      setInputHeight(newHeight);
    };
    const onMouseUp = () => {
      localStorage.setItem("ai-agent-input-height", String(inputHeightRef.current));
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateToolCallOutput = useCallback((tool, output, error = false) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].type === "tool" && next[i].tool === tool && next[i].pending) {
          next[i] = { ...next[i], output, pending: false, error };
          break;
        }
      }
      return next;
    });
  }, []);

  const closeStreamingMessage = useCallback(() => {
    if (!streamingIdRef.current) return;
    const id = streamingIdRef.current;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, streaming: false } : m))
    );
    streamingIdRef.current = null;
  }, []);

  useEffect(() => {
    const socket = new AgentSocket(sessionId, {
      onConnected: () => setConnected(true),

      onToken: (content) => {
        setMessages((prev) => {
          if (streamingIdRef.current) {
            return prev.map((m) =>
              m.id === streamingIdRef.current
                ? { ...m, content: m.content + content }
                : m
            );
          }
          // First token of a new AI turn — create the message
          const id = nextId();
          streamingIdRef.current = id;
          return [...prev, { id, type: "ai", content, streaming: true }];
        });
      },

      onToolStart: (tool, input) => {
        closeStreamingMessage();
        appendMessage({
          id: nextId(),
          type: "tool",
          tool,
          input,
          output: null,
          pending: true,
        });
      },

      onToolEnd: (tool, output, error) => {
        updateToolCallOutput(tool, output, error);
      },

      onPermissionRequest: (command) => {
        setPendingPermission({ command });
      },

      onDone: () => {
        streamingIdRef.current = null;
        setIsThinking(false);
        // Close any streaming message and save the finalized conversation in
        // one pass. Using the functional setState form guarantees we're
        // working from the latest messages array without needing a ref +
        // setTimeout(0) to wait for state to "settle".
        setMessages((prev) => {
          const finalMessages = prev.map((m) =>
            m.streaming ? { ...m, streaming: false } : m
          );
          const firstUserMsg = finalMessages.find((m) => m.type === "user");
          const autoTitle = (firstUserMsg?.content?.trim() || "New Conversation").slice(0, 40);
          const title = conversationTitleRef.current ?? autoTitle;
          if (!conversationTitleRef.current) {
            conversationTitleRef.current = autoTitle;
            setConversationTitle(autoTitle);
          }
          socketRef.current?.sendSaveMessages(finalMessages, title);
          setConversationRefreshKey((k) => k + 1);
          return finalMessages;
        });
      },

      onHistoryRestored: (restoredMessages, title) => {
        setMessages(restoredMessages);
        setConversationTitle(title || null);
      },

      onHistoryCompacted: (summary) => {
        appendMessage({ id: nextId(), type: "history_compacted", summary });
      },

      onError: (content) => {
        closeStreamingMessage();
        appendMessage({ id: nextId(), type: "error", content });
        setIsThinking(false);
      },

      onDisconnect: () => setConnected(false),
    });

    socketRef.current = socket;
    socket.connect();
    return () => socket.disconnect();
  }, [sessionId, appendMessage, updateToolCallOutput, closeStreamingMessage]);

  const _readImageFile = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const [header, data] = dataUrl.split(",");
        const mime_type = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
        resolve({ data, mime_type, previewUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    });

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const imgs = await Promise.all(files.map(_readImageFile));
    setSelectedImages((prev) => [...prev, ...imgs]);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const imgs = await Promise.all(files.map(_readImageFile));
    setSelectedImages((prev) => [...prev, ...imgs]);
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if ((!text && !selectedImages.length) || isThinking || !connected) return;
    const images = selectedImages.length
      ? selectedImages.map(({ data, mime_type }) => ({ data, mime_type }))
      : null;
    appendMessage({
      id: nextId(),
      type: "user",
      content: text,
      images: selectedImages.length ? selectedImages.map((i) => i.previewUrl) : null,
    });
    setInput("");
    setSelectedImages([]);
    setIsThinking(true);
    streamingIdRef.current = null;
    setScrollTrigger((n) => n + 1);
    socketRef.current?.sendMessage(text, images);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePermission = (approved) => {
    setPendingPermission(null);
    socketRef.current?.sendPermissionResponse(approved);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      {sidebarVisible && (
        <div
          className="flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col relative"
          style={{ width: sidebarWidth }}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <h1 className="text-lg font-semibold">AI Agent</h1>
            <p
              className={`text-xs mt-1 ${
                connected ? "text-green-400" : "text-gray-500"
              }`}
            >
              {connected ? "● Connected" : "○ Disconnected"}
            </p>
          </div>
          {/* Tabs */}
          <div className="flex border-b border-gray-800 flex-shrink-0">
            {["history", "settings"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs capitalize transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-blue-500 text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab === "history" ? "History" : "Settings"}
              </button>
            ))}
          </div>
          {/* Tab content */}
          <div className="flex-1 p-3 overflow-auto">
            {activeTab === "history" ? (
              <ConversationList
                activeSessionId={sessionId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                refreshTrigger={conversationRefreshKey}
                onRename={handleRenameActive}
              />
            ) : (
              <SettingsPanel />
            )}
          </div>
          {/* Sidebar resize handle */}
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500 hover:opacity-60 transition-colors z-10"
            onMouseDown={handleSidebarDragStart}
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="px-4 py-3 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            title={sidebarVisible ? "Hide panel" : "Show panel"}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-gray-100 transition-colors text-sm flex-shrink-0"
          >
            {sidebarVisible ? "◀" : "▶"}
          </button>
          <span className="text-xs text-gray-500">
            Session: {sessionId.slice(0, 8)}…
          </span>
        </header>

        <ChatWindow messages={messages} isThinking={isThinking} scrollTrigger={scrollTrigger} />

        {/* Input area */}
        <div
          className={`relative border-t border-gray-800 bg-gray-900 flex flex-col transition-colors ${isDragging ? "bg-blue-950 border-blue-600" : ""}`}
          style={{ height: inputHeight }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Input resize handle */}
          <div
            className="w-full h-1.5 cursor-row-resize hover:bg-blue-500 hover:opacity-60 transition-colors flex-shrink-0"
            onMouseDown={handleInputDragStart}
          />
          <div className="flex-1 px-4 pb-4 pt-2 flex flex-col min-h-0">
          {/* Drag overlay hint */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="text-blue-300 text-sm font-medium bg-blue-950 px-4 py-2 rounded-lg border border-blue-600">
                Drop images here
              </span>
            </div>
          )}
          {/* Image previews */}
          {selectedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={img.previewUrl}
                    alt={`Selected ${idx + 1}`}
                    className="h-16 w-16 object-cover rounded-lg border border-gray-600"
                  />
                  <button
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs flex items-center justify-center"
                    onClick={() => setSelectedImages((prev) => prev.filter((_, i) => i !== idx))}
                    title="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 flex-1 min-h-0">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            {/* Image upload button */}
            <button
              className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-lg transition-colors self-end"
              onClick={() => fileInputRef.current?.click()}
              disabled={isThinking || !connected}
              title="Upload image"
            >
              🖼
            </button>
            <textarea
              className="flex-1 resize-none rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
              style={{ minHeight: 0 }}
              placeholder={
                connected
                  ? "Ask anything… (Enter to send, Shift+Enter for newline)"
                  : "Reconnecting…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking || !connected}
            />
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors self-end"
              onClick={handleSend}
              disabled={isThinking || !connected || (!input.trim() && !selectedImages.length)}
              title={!connected ? "Waiting for connection…" : undefined}
            >
              Send
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Permission modal */}
      {pendingPermission && (
        <PermissionModal
          command={pendingPermission.command}
          onApprove={() => handlePermission(true)}
          onDeny={() => handlePermission(false)}
        />
      )}
    </div>
  );
}
