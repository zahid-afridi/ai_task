# AI Real-Time Canvas

React + Konva frontend and Node + Express + Socket.IO backend. Prompts become `{ "nodes": [...] }` (circles and rectangles), shapes are draggable, and state syncs across tabs. Canvas state persists in `backend/canvas-state.json`.

## Requirements

- Node.js 18+ (global `fetch`)

## Install

```bash
cd backend && npm install
cd ../ai_task && npm install
```

## Configuration

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`.

- **`LLM_API_KEY`**: OpenAI-compatible API key (e.g. Groq). If **empty or omitted**, the server uses **built-in structured layouts** so the app runs without any API key (good for demos; your client can add a key later for real LLM output).
- **`LLM_BASE_URL`**: e.g. `https://api.groq.com/openai/v1` for Groq.
- **`LLM_MODEL`**: e.g. `llama-3.1-8b-instant`.
- **`CORS_ORIGIN`**: Vite dev server URL, default `http://localhost:5173`.

### Frontend (`ai_task/.env` optional)

Copy `ai_task/.env.example` to `ai_task/.env` if the backend is not on `http://localhost:3000`.

```env
VITE_BACKEND_URL=http://localhost:3000
```

## Run

Terminal 1:

```bash
cd backend && npm run dev
```

Terminal 2:

```bash
cd ai_task && npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). Use sample prompts from the task brief; with an API key, the model returns JSON-only `nodes`. Without a key, matching phrases use deterministic layouts (star, grid, row, etc.).

## Socket events

| Event             | Direction        | Payload                          |
|------------------|------------------|----------------------------------|
| `canvas:generate` | client → server | `{ prompt: string }`             |
| `canvas:generated`| server → clients| `{ nodes: [...] }`               |
| `node:move`       | client → server | `{ id, x, y, persist? }`        |
| `node:moved`      | server → clients| `{ id, x, y }`                  |

## Task checklist

- Prompt → JSON (LLM when configured; structured fallback otherwise)
- Konva rendering, draggable nodes
- Realtime sync via Socket.IO
- Live drag sync across tabs; state persisted on drag end
- Constraints: circles/rectangles only, max 12 nodes, labels max 2 chars, positions clamped to canvas
- Bonus: persistence via `backend/canvas-state.json`
