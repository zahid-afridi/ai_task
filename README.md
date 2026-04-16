# AI Real-Time Canvas

A real-time collaborative canvas app built with React, TypeScript, React Konva, Node.js, and Socket.IO. Users enter a prompt, the backend converts it into strict shape JSON, the frontend renders the result, shapes are draggable, and updates sync across multiple tabs in real time.

## Overview

This project covers the requested task requirements:

- Prompt input for natural language canvas instructions
- Backend prompt-to-JSON generation
- Canvas rendering with `react-konva`
- Draggable shapes
- Real-time sync with Socket.IO
- Shape constraints for `circle` and `rectangle`
- Max 12 shapes
- Label length capped at 2 characters
- Shapes clamped inside the canvas
- Bonus persistence after refresh via `backend/canvas-state.json`

The app supports two generation modes:

- `LLM mode`: uses an OpenAI-compatible provider such as Groq
- `Structured fallback mode`: uses deterministic prompt parsing when no API key is available

## Tech Stack

### Frontend

- React
- TypeScript
- React Konva
- Basic React state

### Backend

- Node.js
- Express
- Socket.IO

### AI

- OpenAI-compatible chat completion API
- Groq works with the current setup
- Structured logic fallback is also supported

## Requirements

- Node.js 18+ for native `fetch`

## Install

```bash
cd backend && npm install
cd ../ai_task && npm install
```

## Configuration

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`.

Example with Groq:

```env
LLM_API_KEY=your_groq_key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

Notes:

- `LLM_API_KEY`: OpenAI-compatible API key
- `LLM_BASE_URL`: provider base URL
- `LLM_MODEL`: model name for the provider
- `CORS_ORIGIN`: frontend URL, default `http://localhost:5173`
- If `LLM_API_KEY` is empty, the app uses the built-in structured fallback mode

### Frontend (`ai_task/.env`)

This file is optional. Only create it if the backend is not running on `http://localhost:3000`.

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

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## How To Use

1. Enter a prompt in the input.
2. Click `Generate`.
3. Drag shapes on the canvas.
4. Open the app in another tab to see real-time sync.
5. Refresh the page to confirm persisted state.

Good prompt pattern:

`Create [count] [circles or rectangles] in a [layout]`

Sample prompts:

- `Create 5 circles in a star layout`
- `Create a star layout with 1 center node and 6 surrounding nodes`
- `Create a 3x4 grid of circles labeled A-L`
- `Create 4 rectangles in a row and 1 circle above center`

## Socket Events

| Event | Direction | Payload |
|---|---|---|
| `canvas:generate` | client -> server | `{ prompt: string }` |
| `canvas:generated` | server -> clients | `{ nodes: [...] }` |
| `node:move` | client -> server | `{ id, x, y, persist? }` |
| `node:moved` | server -> clients | `{ id, x, y }` |

## Constraints

- Only `circle` and `rectangle` are allowed
- Maximum 12 shapes
- Label length maximum is 2 characters
- AI output must be JSON only
- Shapes are kept inside the canvas bounds

## Architecture Notes

- The frontend sends prompt requests and movement events over Socket.IO
- The backend sanitizes all generated nodes before broadcasting
- During drag, position updates are synced live across tabs
- On drag end, the latest state is persisted to disk
- On reload, the backend restores the last saved canvas state

## Deliverables Notes

### AI Tool Used

- Cursor
- Groq-compatible LLM API support
- Structured fallback logic when no API key is available

### What I Would Improve

- Add request/schema validation for HTTP and socket payloads
- Add automated integration tests for generation and realtime sync
- Add a throttling strategy for high-frequency drag updates
- Improve prompt understanding for more layout types
- Persist state in a database for multi-instance deployment

## Final Checklist

- Prompt input
- Backend prompt to strict JSON flow
- React Konva rendering
- Draggable shapes
- Real-time sync across users/tabs
- Task constraints enforced
- JSON-only parsing for LLM mode
- Persistence after refresh

## Repository Notes

The repository is ready to run locally. For submission, include:

- GitHub repository
- This README with run instructions
- A short note covering the AI tool used and future improvements
