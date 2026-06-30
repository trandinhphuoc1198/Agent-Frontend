import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MessageBubble from "./MessageBubble";
import ToolCallCard from "./ToolCallCard";

function HistoryCompactedDivider({ msg }) {
  const [expanded, setExpanded] = useState(false);
  const hasSummary = !!msg.summary;

  return (
    <div key={msg.id} className="my-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-700" />
        <button
          onClick={() => hasSummary && setExpanded((v) => !v)}
          className={`text-xs whitespace-nowrap transition-colors ${
            hasSummary
              ? "text-gray-400 hover:text-gray-200 cursor-pointer"
              : "text-gray-500 cursor-default"
          }`}
        >
          Older messages summarized{hasSummary ? (expanded ? " ▲" : " ▼") : ""}
        </button>
        <div className="flex-1 h-px bg-gray-700" />
      </div>
      {expanded && hasSummary && (
        <div className="mt-2 mx-4 text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 leading-relaxed markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function ChatWindow({ messages, isThinking, scrollTrigger }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [scrollTrigger]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          Send a message to start chatting
        </div>
      )}

      {messages.map((msg) => {
        if (msg.type === "user" || msg.type === "ai") {
          return <MessageBubble key={msg.id} message={msg} />;
        }
        if (msg.type === "tool") {
          return <ToolCallCard key={msg.id} toolCall={msg} />;
        }
        if (msg.type === "history_compacted") {
          return <HistoryCompactedDivider key={msg.id} msg={msg} />;
        }
        if (msg.type === "error") {
          return (
            <div
              key={msg.id}
              className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2 border border-red-800"
            >
              Error: {msg.content}
            </div>
          );
        }
        return null;
      })}

      {isThinking && (
        <div className="flex gap-1 items-center pl-1">
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

