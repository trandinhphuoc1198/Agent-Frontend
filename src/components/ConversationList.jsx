import { useState, useEffect, useRef } from "react";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function ConversationList({
  activeSessionId,
  onSelect,
  onNew,
  refreshTrigger,
  onRename,
}) {
  const [conversations, setConversations] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setConversations)
      .catch(() => setError("Failed to load conversations"));
  }, [refreshTrigger]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeSessionId) onNew();
    } catch {
      setError("Failed to delete");
      setTimeout(() => setError(null), 2000);
    }
  };

  const handleRenameStart = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  };

  const handleRenameSubmit = async (id) => {
    // Guards against double submission: Enter calls this directly and then
    // triggers a blur, which would otherwise call this a second time.
    if (editingId !== id) return;
    setEditingId(null);
    const title = editTitle.trim() || "Untitled";
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
      onRename?.(id, title);
    } catch {
      setError("Rename failed");
      setTimeout(() => setError(null), 2000);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={onNew}
        className="w-full text-xs py-1.5 px-2 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
      >
        + New Conversation
      </button>

      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      {conversations.length === 0 && !error && (
        <p className="text-xs text-gray-500 text-center py-6">
          No conversations yet
        </p>
      )}

      <div className="space-y-0.5">
        {conversations.map((conv) => {
          const isActive = conv.id === activeSessionId;
          const isEditing = editingId === conv.id;
          return (
            <div
              key={conv.id}
              className={`rounded px-2 py-2 group flex items-start gap-1 transition-colors ${
                isActive
                  ? "bg-blue-600/20 border border-blue-600/40"
                  : "hover:bg-gray-800 border border-transparent cursor-pointer"
              }`}
              onClick={() => !isEditing && onSelect(conv.id)}
            >
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    ref={inputRef}
                    className="w-full text-xs bg-gray-800 border border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500 text-gray-100"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRenameSubmit(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameSubmit(conv.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p className="text-xs text-gray-200 truncate leading-snug">
                      {conv.title || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">
                      {formatDate(conv.updated_at)}
                    </p>
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                  <button
                    onClick={(e) => handleRenameStart(e, conv)}
                    className="p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-xs leading-none"
                    title="Rename"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 text-xs leading-none"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
