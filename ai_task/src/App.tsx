import { useEffect, useMemo, useState } from "react";
import { Group, Layer, Rect, Stage, Text, Circle } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import "./App.css";
import { socket } from "./lib/socket";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clampMove,
  sanitizeNodes,
} from "./lib/canvasRules";
import type {
  CanvasErrorPayload,
  CanvasGeneratedPayload,
  CanvasNode,
  NodeMovePayload,
} from "./types/canvas";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
const promptExamples = [
  "Create 5 circles in a star layout",
  "Create a star layout with 1 center node and 6 surrounding nodes",
  "Create a 3x4 grid of circles labeled A-L",
  "Create 4 rectangles in a row and 1 circle above center",
];

function App() {
  const [prompt, setPrompt] = useState("");
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [error, setError] = useState("");
  const [generationMode, setGenerationMode] = useState<"llm" | "structured_fallback">(
    "structured_fallback"
  );

  useEffect(() => {
    const onConnect = () => setStatus("Connected");
    const onDisconnect = () => setStatus("Disconnected");
    const onGenerated = (payload: CanvasGeneratedPayload) => {
      setNodes(sanitizeNodes(payload.nodes || []));
      setIsGenerating(false);
      setError("");
    };
    const onMoved = (payload: NodeMovePayload) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === payload.id ? { ...node, x: payload.x, y: payload.y } : node
        )
      );
    };
    const onCanvasError = (payload: CanvasErrorPayload) => {
      setError(payload.message || "Canvas operation failed");
      setIsGenerating(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("canvas:generated", onGenerated);
    socket.on("node:moved", onMoved);
    socket.on("canvas:error", onCanvasError);

    void fetch(`${backendUrl}/api/canvas/state`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load canvas state");
        }
        const data = (await response.json()) as CanvasGeneratedPayload & {
          generationMode?: "llm" | "structured_fallback";
        };
        setNodes(sanitizeNodes(data.nodes || []));
        if (data.generationMode) {
          setGenerationMode(data.generationMode);
        }
      })
      .catch(() => {
        // Keep silent because socket snapshot can still recover.
      });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("canvas:generated", onGenerated);
      socket.off("node:moved", onMoved);
      socket.off("canvas:error", onCanvasError);
    };
  }, []);

  const canGenerate = useMemo(
    () => Boolean(prompt.trim()) && !isGenerating,
    [prompt, isGenerating]
  );

  const syncNodePosition = (
    nodeId: string,
    nextX: number,
    nextY: number,
    persist: boolean
  ) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, x: nextX, y: nextY } : node
      )
    );
    socket.emit("node:move", { id: nodeId, x: nextX, y: nextY, persist });
  };

  const onGenerate = () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Please enter a prompt.");
      return;
    }
    if (!socket.connected) {
      setError("Socket disconnected. Check backend connection.");
      return;
    }

    setError("");
    setIsGenerating(true);
    socket.emit("canvas:generate", { prompt: trimmedPrompt });
  };

  const onDragMove = (
    nodeId: string,
    event: KonvaEventObject<DragEvent>,
    currentNode: CanvasNode
  ) => {
    const nextPos = clampMove(currentNode, event.target.x(), event.target.y());
    event.target.position(nextPos);
    syncNodePosition(nodeId, nextPos.x, nextPos.y, false);
  };

  const onDragEnd = (
    nodeId: string,
    event: KonvaEventObject<DragEvent>,
    currentNode: CanvasNode
  ) => {
    const nextPos = clampMove(currentNode, event.target.x(), event.target.y());
    event.target.position(nextPos);
    syncNodePosition(nodeId, nextPos.x, nextPos.y, true);
  };

  return (
    <main className="app">
      <header className="toolbar">
        <h1>AI Real-Time Canvas</h1>
        <p className="hint">
          Write a simple layout instruction. Mention the shape type, how many shapes
          you want, and the layout.
        </p>
        <div className="promptGuide">
          <span className="promptGuideTitle">Good prompt pattern:</span>
          <span className="promptGuideText">
            "Create [count] [circles or rectangles] in a [layout]"
          </span>
        </div>
        <div className="controls">
          <input
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Try: Create 5 circles in a star layout"
          />
          <button disabled={!canGenerate} onClick={onGenerate}>
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
        <div className="examples">
          {promptExamples.map((example) => (
            <button
              key={example}
              type="button"
              className="exampleChip"
              onClick={() => setPrompt(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <div className="meta">
          <span>Status: {status}</span>
          <span>Nodes: {nodes.length}/12</span>
          <span>
            AI:{" "}
            {generationMode === "llm"
              ? "LLM (API key set)"
              : "Structured fallback (no API key)"}
          </span>
        </div>
        {error ? <p className="error">{error}</p> : null}
      </header>

      <section className="canvasWrapper">
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
          <Layer>
            <Rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill="#faf7f5"
              cornerRadius={10}
              stroke="#d9d2ca"
              strokeWidth={1}
            />
            {nodes.map((node) => {
              if (node.type === "circle") {
                return (
                  <Group
                    key={node.id}
                    x={node.x}
                    y={node.y}
                    draggable
                    onDragMove={(event) => onDragMove(node.id, event, node)}
                    onDragEnd={(event) => onDragEnd(node.id, event, node)}
                  >
                    <Circle
                      radius={node.radius}
                      fill="#66b529"
                      stroke="#4a9120"
                      strokeWidth={2}
                      shadowBlur={8}
                      shadowColor="#00000022"
                    />
                    <Text
                      text={node.label}
                      fill="#ffffff"
                      fontSize={18}
                      fontStyle="bold"
                      width={node.radius * 2}
                      x={-node.radius}
                      y={-10}
                      align="center"
                    />
                  </Group>
                );
              }

              return (
                <Group
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  draggable
                  onDragMove={(event) => onDragMove(node.id, event, node)}
                  onDragEnd={(event) => onDragEnd(node.id, event, node)}
                >
                  <Rect
                    width={node.width}
                    height={node.height}
                    fill="#66b529"
                    stroke="#4a9120"
                    strokeWidth={2}
                    cornerRadius={8}
                    shadowBlur={8}
                    shadowColor="#00000022"
                  />
                  <Text
                    text={node.label}
                    fill="#ffffff"
                    fontSize={18}
                    fontStyle="bold"
                    width={node.width}
                    y={node.height / 2 - 10}
                    align="center"
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </section>
    </main>
  );
}

export default App;
