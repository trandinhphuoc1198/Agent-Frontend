# AI Agent — Frontend

A React (Vite + Tailwind) chat UI for a tool-calling AI agent backend. Streams
LLM tokens and tool-call events over WebSocket, gates shell commands behind a
permission modal, and persists conversation history via a small REST API.

## Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** for styling
- **react-markdown** + **remark-gfm** + **react-syntax-highlighter** for
  rendering assistant messages
- **Vitest** + **React Testing Library** for tests

## Directory Layout

```
frontend/
├── src/
│   ├── main.jsx                    # React root
│   ├── App.jsx                     # top-level state: messages, streaming,
│   │                                #   permissions, session, sidebar/input resize
│   ├── api.js                      # AgentSocket — WebSocket client class
│   ├── index.css                   # Tailwind entrypoint + markdown styles
│   └── components/
│       ├── ChatWindow.jsx          # message list, autoscroll, "thinking" dots
│       ├── MessageBubble.jsx       # user/assistant message rendering (markdown, code)
│       ├── ToolCallCard.jsx        # collapsible tool call input/output
│       ├── PermissionModal.jsx     # shell command approve/deny dialog
│       ├── ConversationList.jsx    # sidebar history: list/select/rename/delete
│       └── SettingsPanel.jsx       # model, command mode, tool toggles
├── tests/                          # Vitest specs, one per component + api.js
├── index.html
├── vite.config.js                  # dev server + proxy to backend on :8000
├── tailwind.config.js
├── postcss.config.js
├── Dockerfile                      # multi-stage build → nginx runtime
├── nginx.conf                      # reverse proxy template (${BACKEND_URL})
└── package.json
```

## Dev Setup

Requires Node 20+ and a running backend (see the backend's own README) on
`http://localhost:8000`.

```bash
npm install
npm run dev   # http://localhost:5173, proxies /api and /ws to :8000
```

Other scripts:

```bash
npm run build          # production build → dist/
npm run preview        # preview the production build locally
npm test                # run tests once (Vitest)
npm run test:watch      # watch mode
npm run test:ui         # Vitest UI
npm run test:coverage   # coverage report
```

## WebSocket Protocol

The frontend talks to the backend over a single WebSocket per conversation at
`/ws/{session_id}` (see `src/api.js` for the full client implementation).

**Server → Client**

| Type | Payload | Meaning |
|---|---|---|
| `connected` | — | session established |
| `token` | `{ content }` | streaming LLM text chunk |
| `tool_start` | `{ tool, input }` | tool invocation begins |
| `tool_end` | `{ tool, output, error? }` | tool invocation ends; `error: true` marks a failed call |
| `permission_request` | `{ command }` | shell command awaiting approval |
| `done` | — | turn complete |
| `history_compacted` | `{ summary }` | older messages were summarized |
| `history_restored` | `{ messages, title }` | saved conversation loaded |
| `error` | `{ content }` | backend error |

**Client → Server**

| Type | Payload | Meaning |
|---|---|---|
| `message` | `{ content, images? }` | user chat message (images as base64) |
| `permission_response` | `{ approved }` | answer to a shell permission gate |
| `save_messages` | `{ messages, title }` | persist the current conversation |
| `rename_conversation` | `{ title }` | rename the active conversation |

## REST API (used by the sidebar/settings)

| Endpoint | Used for |
|---|---|
| `GET /api/conversations` | list saved conversations |
| `PATCH /api/conversations/:id` | rename a conversation |
| `DELETE /api/conversations/:id` | delete a conversation |
| `GET /api/config`, `PUT /api/config` | model, command mode |
| `GET /api/tools` | available tools + enabled state |

## Behavior Notes

- Input, image upload, and send are all disabled while the WebSocket is
  disconnected (`connected === false`); the textarea placeholder switches to
  "Reconnecting…" so the UI never silently drops a message.
- Sidebar width and input box height are resizable and persisted to
  `localStorage` (`ai-agent-sidebar-width`, `ai-agent-input-height`,
  `ai-agent-sidebar-visible`).
- On `done`, the frontend closes the streaming message and auto-saves the
  conversation (auto-titled from the first user message unless renamed) via
  `save_messages`.
- Failed tool calls (`tool_end` with `error: true`) render with a red
  **error** badge in `ToolCallCard` instead of the green **done** badge.

## Tests

```bash
npm test
```

Covers every component plus the `AgentSocket` WebSocket client (message
dispatch, tool call lifecycle including the error flag, permission flow).

## Docker

```bash
docker build -t ai-agent-frontend .
docker run -p 80:80 -e BACKEND_URL=http://backend:8000 ai-agent-frontend
```

The image is a multi-stage build: `npm run build` in a Node 20 Alpine stage,
served by nginx in the runtime stage. `BACKEND_URL` is substituted into
`nginx.conf` at container start (via `envsubst`) to reverse-proxy `/api/*`
and `/ws/*` to the backend service, with all other routes falling back to
`index.html` for client-side routing.