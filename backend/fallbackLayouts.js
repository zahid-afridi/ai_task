/**
 * Deterministic layout when no LLM API key is configured.
 * Parses common phrases from the task spec so the app works out of the box.
 */

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function makeId(type, suffix) {
  return `${type}-fallback-${suffix}-${Date.now().toString(36)}`;
}

/**
 * @param {string} prompt
 * @param {{ width: number; height: number; maxNodes: number }} canvas
 * @returns {Array<Record<string, unknown>>}
 */
export function generateFallbackNodes(prompt, canvas) {
  const p = String(prompt || "").toLowerCase();
  const { width: W, height: H, maxNodes: MAX } = canvas;

  // "3x4 grid" / "3 x 4"
  const gridMatch = p.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (p.includes("grid") || gridMatch) {
    let cols = 3;
    let rows = 4;
    if (gridMatch) {
      cols = Math.min(6, Math.max(1, parseInt(gridMatch[1], 10)));
      rows = Math.min(6, Math.max(1, parseInt(gridMatch[2], 10)));
    }
    const total = cols * rows;
    const count = Math.min(MAX, total);
    const padX = 60;
    const padY = 50;
    const cellW = (W - 2 * padX) / Math.max(cols - 1, 1);
    const cellH = (H - 2 * padY) / Math.max(rows - 1, 1);
    const r = clamp(Math.min(cellW, cellH) * 0.22, 12, 28);
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * cellW;
      const y = padY + row * cellH;
      const label = String.fromCharCode(65 + (i % 26));
      nodes.push({
        id: makeId("circle", `g${i}`),
        type: "circle",
        x: clamp(x, r, W - r),
        y: clamp(y, r, H - r),
        radius: r,
        label: label.length <= 2 ? label : label.slice(0, 2),
      });
    }
    return nodes;
  }

  // Star: "1 center" + "6 surrounding" / "star"
  const starMatch = p.match(/(\d+)\s*(?:node|nodes)?\s*(?:in\s+)?(?:the\s+)?center/);
  const surroundMatch = p.match(/(\d+)\s*surrounding/);
  let surrounding = 6;
  if (surroundMatch) {
    surrounding = clamp(parseInt(surroundMatch[1], 10), 1, MAX - 1);
  } else if (p.includes("star")) {
    const m = p.match(/(\d+)\s*(?:outer|around|surrounding|nodes)/);
    if (m) surrounding = clamp(parseInt(m[1], 10), 1, MAX - 1);
  }
  const hasCenter =
    p.includes("center") ||
    p.includes("star") ||
    (starMatch && parseInt(starMatch[1], 10) >= 1);

  if (p.includes("star") || (hasCenter && surrounding >= 1)) {
    const cx = W / 2;
    const cy = H / 2;
    const centerR = 32;
    const orbit = Math.min(W, H) * 0.32;
    const nodes = [];
    if (hasCenter && nodes.length < MAX) {
      nodes.push({
        id: makeId("circle", "c0"),
        type: "circle",
        x: cx,
        y: cy,
        radius: centerR,
        label: "S",
      });
    }
    const n = Math.min(surrounding, MAX - nodes.length);
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = cx + orbit * Math.cos(angle);
      const y = cy + orbit * Math.sin(angle);
      const r = 22;
      const label = String.fromCharCode(65 + i);
      nodes.push({
        id: makeId("circle", `s${i}`),
        type: "circle",
        x: clamp(x, r, W - r),
        y: clamp(y, r, H - r),
        radius: r,
        label,
      });
    }
    return nodes;
  }

  // "4 rectangles in a row and 1 circle above center"
  if (p.includes("rectangle") && (p.includes("row") || p.includes("line"))) {
    const numMatch = p.match(/(\d+)\s*rectangle/);
    const nRect = numMatch ? clamp(parseInt(numMatch[1], 10), 1, MAX - 1) : 4;
    const wantCircle =
      p.includes("circle") && (p.includes("above") || p.includes("top"));
    const nodes = [];
    const rw = 70;
    const rh = 46;
    const gap = 16;
    const totalW = nRect * rw + (nRect - 1) * gap;
    let startX = (W - totalW) / 2;
    const baseY = H * 0.62;
    for (let i = 0; i < nRect && nodes.length < MAX; i++) {
      nodes.push({
        id: makeId("rectangle", `r${i}`),
        type: "rectangle",
        x: startX + i * (rw + gap),
        y: baseY,
        width: rw,
        height: rh,
        label: String(i + 1),
      });
    }
    if (wantCircle && nodes.length < MAX) {
      nodes.unshift({
        id: makeId("circle", "top"),
        type: "circle",
        x: W / 2,
        y: H * 0.28,
        radius: 24,
        label: "O",
      });
    }
    return nodes;
  }

  // "5 circles" default horizontal
  const circlesMatch = p.match(/(\d+)\s*circle/);
  const count = circlesMatch
    ? clamp(parseInt(circlesMatch[1], 10), 1, MAX)
    : 5;
  const r = 24;
  const spacing = (W - 120) / Math.max(count - 1, 1);
  const y = H / 2;
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const x = 60 + i * spacing;
    nodes.push({
      id: makeId("circle", `d${i}`),
      type: "circle",
      x: clamp(x, r, W - r),
      y: clamp(y, r, H - r),
      radius: r,
      label: String.fromCharCode(65 + (i % 26)),
    });
  }
  return nodes;
}
