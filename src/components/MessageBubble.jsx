import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function MessageBubble({ message }) {
  const isUser = message.type === "user";
  const content = message.content ?? "";

  const linkRenderer = ({ href, children, ...props }) => {
    const isAnchorLink = href?.startsWith("#");

    return (
      <a
        {...props}
        href={href}
        target={isAnchorLink ? undefined : "_blank"}
        rel={isAnchorLink ? undefined : "noreferrer"}
      >
        {children}
      </a>
    );
  };

  const codeRenderer = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={oneDark}
            language={match[1]}
            PreTag="div"
            customStyle={{
              background: "transparent",   // ✅ remove dark background
              borderRadius: "0",           // ✅ remove rounded frame
              margin: "0",                 // ✅ remove outer spacing
              padding: "0",                // ✅ remove inner padding
              fontSize: "1.0rem",
            }}
            codeTagProps={{
              style: {
                background: "transparent", // ✅ ensure inner code has no bg
              }
            }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      );
    }

    // Inline code — keep existing styling
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-center"}`}>
      <div
        className={`rounded-2xl px-4 py-2 text-sm break-words ${
          isUser
            ? "max-w-[75%] bg-blue-600 text-white rounded-br-sm"
            : "w-full bg-gray-800 text-gray-100 rounded-bl-sm"
        }`}
      >
        {/* Image previews inside bubble */}
        {isUser && message.images?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`Uploaded ${idx + 1}`}
                className="max-h-48 max-w-full rounded-lg object-contain"
              />
            ))}
          </div>
        )}
        {isUser ? (
          content && <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ a: linkRenderer, code: codeRenderer }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {message.streaming && (
          <span className="inline-block w-0.5 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
