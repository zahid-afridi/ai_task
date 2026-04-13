import type { CanvasNode } from "../types/canvas";

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 560;
export const MAX_NODES = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeLabel = (label: string) =>
  label.trim().slice(0, 2).toUpperCase() || "N";

export function sanitizeNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.slice(0, MAX_NODES).map((node) => {
    if (node.type === "circle") {
      const radius = clamp(node.radius || 20, 10, 60);
      return {
        ...node,
        radius,
        label: normalizeLabel(node.label),
        x: clamp(node.x, radius, CANVAS_WIDTH - radius),
        y: clamp(node.y, radius, CANVAS_HEIGHT - radius),
      };
    }

    const width = clamp(node.width || 70, 30, 200);
    const height = clamp(node.height || 50, 24, 150);
    return {
      ...node,
      width,
      height,
      label: normalizeLabel(node.label),
      x: clamp(node.x, 0, CANVAS_WIDTH - width),
      y: clamp(node.y, 0, CANVAS_HEIGHT - height),
    };
  });
}

export function clampMove(node: CanvasNode, x: number, y: number) {
  if (node.type === "circle") {
    return {
      x: clamp(x, node.radius, CANVAS_WIDTH - node.radius),
      y: clamp(y, node.radius, CANVAS_HEIGHT - node.radius),
    };
  }

  return {
    x: clamp(x, 0, CANVAS_WIDTH - node.width),
    y: clamp(y, 0, CANVAS_HEIGHT - node.height),
  };
}
