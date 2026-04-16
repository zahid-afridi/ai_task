export type ShapeType = "circle" | "rectangle";

export type CircleNode = {
  id: string;
  type: "circle";
  x: number;
  y: number;
  radius: number;
  label: string;
};

export type RectangleNode = {
  id: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
};

export type CanvasNode = CircleNode | RectangleNode;

export type CanvasGeneratedPayload = {
  nodes: CanvasNode[];
};

export type CanvasErrorPayload = {
  message: string;
};

export type NodeMovePayload = {
  id: string;
  x: number;
  y: number;
  persist?: boolean;
};

export type CanvasGeneratePayload = {
  prompt: string;
};
