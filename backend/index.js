import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { generateFallbackNodes } from "./fallbackLayouts.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 560;
const MAX_NODES = 12;
const STATE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "canvas-state.json"
);

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json());

const canvasState = {
  nodes: [],
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeLabel(value) {
  return String(value || "")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

function sanitizeNode(node, fallbackLabel = "N") {
  if (!node || (node.type !== "circle" && node.type !== "rectangle")) {
    return null;
  }

  const label = normalizeLabel(node.label || fallbackLabel) || fallbackLabel;
  const id =
    typeof node.id === "string" && node.id.trim()
      ? node.id.trim()
      : `${node.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (node.type === "circle") {
    const radius = clamp(Number(node.radius || 20), 10, 60);
    const x = clamp(Number(node.x || 40), radius, CANVAS_WIDTH - radius);
    const y = clamp(Number(node.y || 40), radius, CANVAS_HEIGHT - radius);
    return { id, type: "circle", x, y, radius, label };
  }

  const width = clamp(Number(node.width || 70), 30, 200);
  const height = clamp(Number(node.height || 50), 24, 150);
  const x = clamp(Number(node.x || 10), 0, CANVAS_WIDTH - width);
  const y = clamp(Number(node.y || 10), 0, CANVAS_HEIGHT - height);
  return { id, type: "rectangle", x, y, width, height, label };
}

function sanitizeNodes(rawNodes) {
  if (!Array.isArray(rawNodes)) {
    return [];
  }

  const seen = new Set();
  const sanitized = [];

  for (const [index, node] of rawNodes.entries()) {
    if (sanitized.length >= MAX_NODES) {
      break;
    }
    const nextNode = sanitizeNode(node, String.fromCharCode(65 + (index % 26)));
    if (!nextNode || seen.has(nextNode.id)) {
      continue;
    }
    seen.add(nextNode.id);
    sanitized.push(nextNode);
  }

  return sanitized;
}

async function saveState() {
  await fs.writeFile(STATE_FILE, JSON.stringify(canvasState, null, 2), "utf8");
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    canvasState.nodes = sanitizeNodes(parsed?.nodes || []);
  } catch {
    canvasState.nodes = [];
    await saveState();
  }
}

function extractJsonObject(rawText) {
  const trimmed = rawText.trim();
  return JSON.parse(trimmed);
}

function isLlmConfigured() {
  return Boolean(String(process.env.LLM_API_KEY || "").trim());
}

async function promptToNodes(prompt) {
  const apiKey = String(process.env.LLM_API_KEY || "").trim();
  const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    const raw = generateFallbackNodes(prompt, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      maxNodes: MAX_NODES,
    });
    return sanitizeNodes(raw);
  }

  const systemPrompt =
    "You are a JSON-only generator for canvas nodes. Return ONLY valid JSON in this exact shape: {\"nodes\":[...]} with no markdown or explanation. Allowed node.type values: circle, rectangle. Maximum 12 nodes. label must be 1-2 characters. Keep all nodes inside width 900 and height 560. Circle fields: type,x,y,radius,label. Rectangle fields: type,x,y,width,height,label.";

  const body = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };

  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status === 400) {
    const retryBody = { ...body };
    delete retryBody.response_format;
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(retryBody),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM returned empty content");
  }

  const parsed = extractJsonObject(content);
  return sanitizeNodes(parsed?.nodes);
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Realtime canvas backend is running",
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    llmConfigured: isLlmConfigured(),
    generationMode: isLlmConfigured() ? "llm" : "structured_fallback",
  });
});

app.get("/api/canvas/state", (req, res) => {
  res.json({
    nodes: canvasState.nodes,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    llmConfigured: isLlmConfigured(),
    generationMode: isLlmConfigured() ? "llm" : "structured_fallback",
  });
});

app.post("/api/canvas/generate", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const nodes = await promptToNodes(prompt);
    if (!nodes.length) {
      return res.status(422).json({ error: "No valid nodes generated" });
    }

    canvasState.nodes = nodes;
    await saveState();
    io.emit("canvas:generated", { nodes: canvasState.nodes });
    return res.json({ nodes: canvasState.nodes });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

io.on("connection", (socket) => {
  socket.emit("canvas:generated", { nodes: canvasState.nodes });

  socket.on("canvas:generate", async (payload) => {
    try {
      const prompt = String(payload?.prompt || "").trim();
      if (!prompt) {
        socket.emit("canvas:error", { message: "prompt is required" });
        return;
      }

      const nodes = await promptToNodes(prompt);
      if (!nodes.length) {
        socket.emit("canvas:error", { message: "No valid nodes generated" });
        return;
      }

      canvasState.nodes = nodes;
      await saveState();
      io.emit("canvas:generated", { nodes: canvasState.nodes });
    } catch (error) {
      socket.emit("canvas:error", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  socket.on("node:move", async (payload) => {
    const id = String(payload?.id || "");
    const target = canvasState.nodes.find((node) => node.id === id);
    if (!target) {
      socket.emit("canvas:error", { message: `Node ${id} not found` });
      return;
    }

    const nextX = Number(payload?.x);
    const nextY = Number(payload?.y);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      socket.emit("canvas:error", { message: "Invalid node coordinates" });
      return;
    }

    if (target.type === "circle") {
      target.x = clamp(nextX, target.radius, CANVAS_WIDTH - target.radius);
      target.y = clamp(nextY, target.radius, CANVAS_HEIGHT - target.radius);
    } else {
      target.x = clamp(nextX, 0, CANVAS_WIDTH - target.width);
      target.y = clamp(nextY, 0, CANVAS_HEIGHT - target.height);
    }

    if (payload?.persist !== false) {
      await saveState();
    }
    io.emit("node:moved", { id: target.id, x: target.x, y: target.y });
  });
});

await loadState();

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});