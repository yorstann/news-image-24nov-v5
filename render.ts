// "THE WORLD TODAY" — Tuesday 24 November 2026
// A clean classic newspaper front page: light paper, serif typeface drawn
// by hand, strict hierarchy, generous white space.
// Self-contained rasterizer: RGB canvas, scanline polygon fill, and a
// serif stroke font (caps + lowercase + digits + punctuation) built here.
// No external images, no copied assets. Fully deterministic.

export const W = 1024;
export const H = 1024;

// ---- palette ----
export const C = {
  paperTop: [251, 247, 238],
  paperBot: [245, 238, 221],
  white: [255, 255, 255],
  ink: [27, 24, 21],
  red: [166, 30, 34],
  muted: [110, 103, 89],
  faint: [138, 130, 114],
  panel: [242, 236, 220],
  rule: [27, 24, 21],
  mapLand: [96, 104, 92],
  mapLand2: [84, 92, 82],
};

// ---- RGB canvas ----
export function createCanvas(w: number, h: number) {
  return { w, h, data: new Uint8Array(w * h * 3) };
}

export function setPx(cv: any, x: number, y: number, c: number[]) {
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) return;
  const i = (y * cv.w + x) * 3;
  cv.data[i] = c[0]; cv.data[i + 1] = c[1]; cv.data[i + 2] = c[2];
}

export function mix(a: number[], b: number[], t: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function fillRect(cv: any, x: number, y: number, w: number, h: number, c: number[]) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(cv.w, Math.round(x + w));
  const y1 = Math.min(cv.h, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * cv.w + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      cv.data[i] = c[0]; cv.data[i + 1] = c[1]; cv.data[i + 2] = c[2];
      i += 3;
    }
  }
}

export function vgrad(cv: any, x: number, y: number, w: number, h: number, c0: number[], c1: number[]) {
  for (let yy = 0; yy < h; yy++) {
    const c = mix(c0, c1, h <= 1 ? 0 : yy / (h - 1));
    fillRect(cv, x, y + yy, w, 1, c);
  }
}

// scanline polygon fill; pts = [[x,y],...]
export function fillPoly(cv: any, pts: number[][], c: number[]) {
  if (pts.length < 3) return;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(cv.h - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y + 0.5 - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + (b[0] - a[0]) * t);
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(cv.w - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) setPx(cv, x, y, c);
    }
  }
}

export function fillCircle(cv: any, cx: number, cy: number, r: number, c: number[]) {
  const rr = Math.round(r);
  for (let dy = -rr; dy <= rr; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let x = -dx; x <= dx; x++) setPx(cv, Math.round(cx) + x, Math.round(cy) + dy, c);
  }
}

// thick line segment as a quad + round caps
export function thickLine(cv: any, x0: number, y0: number, x1: number, y1: number, w: number, c: number[]) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) { fillCircle(cv, x0, y0, w / 2, c); return; }
  const nx = -dy / len * (w / 2), ny = dx / len * (w / 2);
  fillPoly(cv, [
    [x0 + nx, y0 + ny], [x1 + nx, y1 + ny],
    [x1 - nx, y1 - ny], [x0 - nx, y0 - ny],
  ], c);
  fillCircle(cv, x0, y0, w / 2, c);
  fillCircle(cv, x1, y1, w / 2, c);
}

export function polyline(cv: any, pts: number[][], w: number, c: number[]) {
  for (let i = 0; i + 1 < pts.length; i++) {
    thickLine(cv, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
  }
}

// thin 1px line (Bresenham-ish via sampling)
export function thinLine(cv: any, x0: number, y0: number, x1: number, y1: number, c: number[]) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    setPx(cv, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c);
  }
}

// ---- serif stroke font ----
// Grid: x 0..6, y 0..10 (y=0 top, y=10 baseline); lowercase uses x-height
// top y=4.8 and descenders to y=12.4. Each glyph: advance width (units) +
// strokes separated by '|'. A stroke is space-separated "x,y" points, or
// "o x,y,r" for a filled circle. Serifs are baked in as short horizontal
// bars at the tops and feet of vertical stems.
const FONT: Record<string, [number, string]> = {
  A: [7, "0,10 3,0 6,10|1.7,6.5 4.3,6.5|-0.8,10 0.8,10|5.2,10 6.8,10"],
  B: [7, "0,10 0,0 4.2,0 5.6,1.4 5.6,3.4 4.2,5 0,5|4.2,5 5.6,6.6 5.6,8.6 4.2,10 0,10|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  C: [7, "5.6,2.4 4,0.6 2,0.6 0.6,2 0.6,8 2,9.4 4,9.4 5.6,7.6"],
  D: [7, "0,10 0,0 4,0 6,2.5 6,7.5 4,10 0,10|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  E: [7, "5.6,0 0,0 0,10 5.6,10|0,5 4.2,5|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  F: [7, "5.6,0 0,0 0,10|0,5 4.2,5|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  G: [7, "5.6,2.4 4,0.6 2,0.6 0.6,2 0.6,8 2,9.4 4,9.4 6,8 6,5.6 3.6,5.6"],
  H: [7, "0,0 0,10|6,0 6,10|0,5 6,5|-0.8,0 0.8,0|-0.8,10 0.8,10|5.2,0 6.8,0|5.2,10 6.8,10"],
  I: [5, "2,0 4,0|3,0 3,10|2,10 4,10"],
  J: [6, "5,0 5,7.5 4,9.5 2,9.5 0.6,8|4.2,0 5.8,0"],
  K: [7, "0,0 0,10|5.6,0 0.6,5|2.2,6.4 5.6,10|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  L: [7, "0,0 0,10 5.6,10|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  M: [7, "0,10 0,0 3,6.5 6,0 6,10|-0.8,0 0.8,0|-0.8,10 0.8,10|5.2,0 6.8,0|5.2,10 6.8,10"],
  N: [7, "0,10 0,0 6,10 6,0|-0.8,0 0.8,0|-0.8,10 0.8,10|5.2,0 6.8,0|5.2,10 6.8,10"],
  O: [7, "2,0.6 3,0.2 4,0.6 5.2,1.4 5.6,2.6 5.6,7.4 5.2,8.6 4,9.4 3,9.8 2,9.4 0.8,8.6 0.6,7.4 0.6,2.6 0.8,1.4 2,0.6"],
  P: [7, "0,10 0,0 4,0 5.6,1.5 5.6,3.5 4,5 0,5|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  Q: [7, "2,0.6 3,0.2 4,0.6 5.2,1.4 5.6,2.6 5.6,7.4 5.2,8.6 4,9.4 3,9.8 2,9.4 0.8,8.6 0.6,7.4 0.6,2.6 0.8,1.4 2,0.6|3.6,7 6,10"],
  R: [7, "0,10 0,0 4,0 5.6,1.5 5.6,3.5 4,5 0,5|2.6,5 6,10|-0.8,0 0.8,0|-0.8,10 0.8,10"],
  S: [7, "5,2 4,0.6 2,0.6 0.6,2 0.6,3.6 2,5 4,5 5.6,6.4 5.6,8 4,9.4 2,9.4 0.6,8"],
  T: [7, "0,0 6,0|3,0 3,10|2.2,10 3.8,10"],
  U: [7, "0,0 0,7.5 1,9.4 5,9.4 6,7.5 6,0|-0.8,0 0.8,0|5.2,0 6.8,0"],
  V: [7, "0,0 3,10 6,0"],
  W: [7, "0,0 1.5,10 3,4.5 4.5,10 6,0"],
  X: [7, "0,0 6,10|6,0 0,10"],
  Y: [7, "0,0 3,5 6,0|3,5 3,10|2.2,10 3.8,10"],
  Z: [7, "0,0 6,0 0,10 6,10"],
  "0": [7, "2,0.6 3,0.2 4,0.6 5.2,1.4 5.6,2.6 5.6,7.4 5.2,8.6 4,9.4 3,9.8 2,9.4 0.8,8.6 0.6,7.4 0.6,2.6 0.8,1.4 2,0.6"],
  "1": [5, "1.5,2 3,0.6 3,10|1,10 5,10"],
  "2": [7, "0.6,2 2,0.6 4,0.6 5.6,2 5.6,3.6 3.6,6 0.6,10 5.6,10"],
  "3": [7, "1,0.6 4,0.6 5.6,2 5.6,3.6 4,5 1.6,5|4,5 5.6,6.4 5.6,8 4,9.4 1,9.4"],
  "4": [7, "5,0 5,10|0.6,7 5.6,7|5,0 0.6,7"],
  "5": [7, "5.6,0.6 0.6,0.6 0.6,4.6 4,4.6 5.6,6 5.6,8 4,9.4 1.6,9.4 0,8"],
  "6": [7, "5.6,1.6 4,0.6 2,0.6 0.6,2 0.6,8 1.6,9.4 4,9.4 5.6,8 5.6,6.4 4,5 1.6,5"],
  "7": [7, "0,0.6 6,0.6 2.6,10"],
  "8": [7, "2,0.6 4,0.6 5.6,2 5.6,3.6 4,5 2,5 0.6,3.6 0.6,2 2,0.6|4,5 5.6,6.4 5.6,8 4,9.4 2,9.4 0.6,8 0.6,6.4 2,5"],
  "9": [7, "0.6,8.4 1.6,9.4 4,9.4 5.6,8 5.6,2 4,0.6 2,0.6 0.6,2 0.6,3.6 2,5 4,5"],
  ".": [3.5, "o3,9.2,0.9"],
  ",": [3.5, "o2.8,9.2,0.9|2.8,9.2 1.8,11"],
  ":": [3.5, "o3,3.5,0.9|o3,8,0.9"],
  "!": [3.5, "3,0.6 3,7|o3,9.2,0.9"],
  "?": [7, "1,2.6 2,0.6 4,0.6 5,2 5,3.6 3.6,5.6 3,6.6|o3,9.2,0.9"],
  "%": [8, "6.4,0.8 0.8,9.2|o1.9,2.2,1|o5.3,7.8,1"],
  "+": [7, "0.6,5 5.6,5|3.1,2.6 3.1,7.4"],
  "-": [5, "1,5 5,5"],
  "—": [7, "0,5 6,5"],
  "•": [4, "o2,5,1.1"],
  "/": [5, "1.4,10 4.6,0"],
  "(": [4.5, "4.2,0 2,2.6 2,7.4 4.2,10"],
  ")": [4.5, "1.2,0 3.4,2.6 3.4,7.4 1.2,10"],
  "'": [3, "3,0 2.4,2.6"],
  '"': [5, "1.8,0 1.2,2.6|4.2,0 3.6,2.6"],
  "$": [7, "5,2 4,0.6 2,0.6 0.6,2 0.6,3.6 2,5 4,5 5.6,6.4 5.6,8 4,9.4 2,9.4 0.6,8|3,0 3,10"],
  " ": [3.5, ""],
  a: [6, "1.2,6 2,4.8 4,4.8 5,6 5,8.4 4,9.8 2,9.8 1.2,8.6 1.2,6|5,4.8 5,10"],
  b: [6, "1,0 1,10|1,6 2,4.8 4,4.8 5,6 5,8.4 4,9.8 2,9.8 1,8.6|0.2,0 1.8,0|0.2,10 1.8,10"],
  c: [6, "5,6 4,4.8 2,4.8 1,6 1,8.4 2,9.8 4,9.8 5,8.6"],
  d: [6, "5,0 5,10|5,6 4,4.8 2,4.8 1,6 1,8.4 2,9.8 4,9.8 5,8.6|4.2,0 5.8,0|4.2,10 5.8,10"],
  e: [6, "4.8,6.4 3.4,4.8 1.8,4.8 1,6.2 1,8.4 2,9.8 4,9.8 5,8.6|1,6.8 4.6,6.8"],
  f: [5, "4.4,0 4.4,10|4.4,0 2.6,0.8 2.2,2.4|2.2,6.4 4.6,6.4"],
  g: [6, "1.2,6 2,4.8 4,4.8 5,6 5,8.4 4,9.8 2,9.8 1.2,8.6 1.2,6|5,4.8 5,9.6 4.2,11.4 2.4,12.4 1,11.8"],
  h: [6, "1,0 1,10|1,4.8 2.4,4.8 3.6,6 3.6,10|0.2,0 1.8,0|0.2,10 1.8,10"],
  i: [3, "1.6,4.8 1.6,10|o1.6,2.2,0.9|0.8,10 2.4,10"],
  j: [4, "2.8,4.8 2.8,10 2,12 1,12.2|o2.8,2.2,0.9"],
  k: [6, "1,0 1,10|4.8,4.8 1.4,7|2.4,8 4.8,10|0.2,0 1.8,0|0.2,10 1.8,10"],
  l: [3.5, "1.8,0 1.8,10|1,0 2.6,0|1,10 2.6,10"],
  m: [8, "1,10 1,4.8 2.4,4.8 3.4,6 3.4,10|3.4,4.8 4.8,4.8 5.8,6 5.8,10|0.2,10 1.8,10|5,10 6.6,10"],
  n: [6, "1,10 1,4.8 2.4,4.8 3.6,6 3.6,10|0.2,10 1.8,10|2.8,10 4.4,10"],
  o: [6, "2,4.8 3,4.6 4,4.8 4.8,6 4.8,8.4 4,9.8 3,10 2,9.8 1.2,8.4 1.2,6 2,4.8"],
  p: [6, "1,4.8 1,12.4|1,6 2,4.8 4,4.8 5,6 5,8.4 4,9.8 2,9.8 1,8.6"],
  q: [6, "5,4.8 5,12.4|5,6 4,4.8 2,4.8 1,6 1,8.4 2,9.8 4,9.8 5,8.6"],
  r: [5, "1,10 1,4.8|1,4.8 2.2,4.8 3.2,6 3.2,7.4|0.2,10 1.8,10"],
  s: [6, "4.6,6 3.6,4.8 2,4.8 1.2,6 1.2,7 2.4,7.8 3.6,7.8 4.8,8.6 4.8,9.2 3.8,9.8 2,9.8 1.2,9"],
  t: [4.5, "2.4,0 2.4,10|1,6.4 3.8,6.4|2.4,10 3.4,11.6"],
  u: [6, "1,4.8 1,8 2,9.8 4,9.8 5,8 5,4.8"],
  v: [6, "1,4.8 3,10 5,4.8"],
  w: [8, "1,4.8 2,10 3.2,6.6 4.4,10 5.6,4.8"],
  x: [6, "1,4.8 5,10|5,4.8 1,10"],
  y: [6, "1,4.8 3,10 5,4.8|3,10 3,12.4"],
  z: [6, "1,4.8 5,4.8 1,10 5,10"],
};

function glyph(ch: string): [number, string] {
  return FONT[ch] || FONT["?"];
}

// width of text in px at given cap-height size
export function measure(text: string, size: number, tracking = 0.6): number {
  const sc = size / 10;
  let w = 0;
  const t = String(text);
  for (let i = 0; i < t.length; i++) {
    w += glyph(t[i])[0] * sc;
    if (i + 1 < t.length) w += tracking * sc;
  }
  return w;
}

// shrink size until text fits maxW (never below minSize)
export function fitSize(text: string, size: number, maxW: number, tracking = 0.6, minSize = 8): number {
  let s = size;
  while (s > minSize && measure(text, s, tracking) > maxW) s -= 1;
  return s;
}

// greedy word wrap; returns array of lines
export function wrap(text: string, size: number, maxW: number, tracking = 0.6): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (measure(cand, size, tracking) <= maxW || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// draw text; x = anchor (left/center/right), y = baseline
export function drawText(cv: any, text: string, x: number, y: number, size: number, color: number[], opts: { tracking?: number; weight?: number; align?: string } = {}) {
  const tracking = opts.tracking ?? 0.6;
  const weight = opts.weight ?? 0.14;
  const align = opts.align ?? "left";
  const t = String(text);
  const sc = size / 10;
  const w = measure(t, size, tracking);
  let cx = x;
  if (align === "center") cx = x - w / 2;
  if (align === "right") cx = x - w;
  const sw = Math.max(1, size * weight);
  for (const ch of t) {
    const g = glyph(ch);
    if (g[1]) {
      for (const stroke of g[1].split("|")) {
        if (!stroke) continue;
        if (stroke[0] === "o") {
          const parts = stroke.slice(1).split(",").map(Number);
          fillCircle(cv, cx + parts[0] * sc, y - (10 - parts[1]) * sc, parts[2] * sc, color);
        } else {
          const pts = stroke.split(" ").map((p) => {
            const q = p.split(",").map(Number);
            return [cx + q[0] * sc, y - (10 - q[1]) * sc];
          });
          polyline(cv, pts, sw, color);
        }
      }
    }
    cx += (g[0] + tracking) * sc;
  }
  return w;
}

// draw wrapped lines, centered on cx, first baseline at y, line height lh
export function drawLines(cv: any, lines: string[], cx: number, y: number, size: number, color: number[], lh: number, opts: { tracking?: number; weight?: number } = {}) {
  for (let i = 0; i < lines.length; i++) {
    drawText(cv, lines[i], cx, y + i * lh, size, color, { ...opts, align: "center" });
  }
}

// ---- layout ----

// coarse continent outlines, [lon, lat] — stylised flat map, equirectangular
const CONTINENTS: number[][][] = [
  // North America
  [[-168, 66], [-150, 60], [-140, 70], [-125, 71], [-110, 68], [-95, 69], [-85, 66], [-80, 73], [-75, 62], [-65, 60], [-60, 47], [-70, 42], [-75, 35], [-80, 32], [-81, 26], [-90, 21], [-97, 16], [-105, 20], [-114, 28], [-125, 40], [-125, 49], [-135, 58], [-155, 58], [-168, 66]],
  // Greenland
  [[-58, 64], [-45, 60], [-32, 68], [-22, 70], [-30, 76], [-55, 76], [-58, 64]],
  // South America
  [[-80, 10], [-75, 5], [-70, 0], [-60, -2], [-50, -5], [-35, -8], [-40, -20], [-48, -28], [-57, -35], [-65, -45], [-70, -54], [-73, -40], [-72, -20], [-77, -12], [-80, 10]],
  // Africa
  [[-17, 15], [-10, 30], [-5, 35], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [51, 11], [48, 0], [40, -10], [36, -18], [32, -29], [20, -35], [15, -30], [12, -18], [9, -2], [9, 4], [-8, 5], [-17, 15]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 48], [2, 51], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 59], [30, 62], [25, 65], [20, 70], [15, 70], [12, 66], [10, 62], [5, 58], [0, 54], [-5, 50], [-10, 48], [-10, 36]],
  // Asia
  [[30, 62], [40, 68], [55, 69], [70, 72], [90, 75], [110, 74], [130, 72], [150, 70], [170, 67], [178, 65], [170, 60], [160, 55], [142, 50], [140, 40], [135, 35], [127, 33], [120, 30], [110, 20], [105, 10], [100, 8], [95, 15], [90, 22], [80, 20], [75, 10], [70, 20], [60, 25], [55, 26], [50, 29], [48, 30], [43, 28], [40, 32], [35, 36], [30, 36], [30, 42], [30, 48], [30, 55], [30, 62]],
  // Indonesia blobs
  [[95, -2], [102, -4], [106, -6], [100, -8], [95, -5], [95, -2]],
  [[112, -2], [120, -3], [126, -5], [120, -8], [114, -6], [112, -2]],
  // Australia
  [[113, -22], [114, -30], [115, -35], [124, -33], [130, -32], [137, -35], [140, -38], [145, -38], [150, -37], [153, -32], [150, -25], [146, -20], [142, -15], [142, -11], [136, -12], [132, -11], [126, -14], [122, -17], [118, -20], [113, -22]],
];

function project(lon: number, lat: number, mx: number, my: number, mw: number, mh: number): [number, number] {
  return [mx + ((lon + 180) / 360) * mw, my + ((75 - lat) / 135) * mh];
}

export function render() {
  const cv = createCanvas(W, H);
  vgrad(cv, 0, 0, W, H, C.paperTop, C.paperBot);
  const MX = 46;
  const RX = 978;
  const CW = RX - MX;

  // ---- top rules + masthead ----
  fillRect(cv, MX, 26, CW, 2, C.rule);
  fillRect(cv, MX, 31, CW, 1, C.rule);
  drawText(cv, "THE WORLD TODAY", 512, 88, 60, C.ink, { align: "center", weight: 0.17, tracking: 1.0 });
  fillRect(cv, MX, 100, CW, 1, C.rule);
  drawText(cv, "TUESDAY, 24 NOVEMBER 2026", MX, 122, 16, C.ink, { weight: 0.15, tracking: 0.6 });
  drawText(cv, "WORLD EDITION", 512, 122, 16, C.ink, { align: "center", weight: 0.15, tracking: 1.2 });
  drawText(cv, "No. 24,111", RX, 122, 16, C.ink, { align: "right", weight: 0.15, tracking: 0.6 });
  fillRect(cv, MX, 132, CW, 3, C.rule);

  // ---- lead story ----
  drawText(cv, "CLIMATE SUMMIT — ANTALYA", MX, 160, 15, C.red, { weight: 0.16, tracking: 1.4 });
  drawText(cv, "COP31 TALKS", MX, 228, 64, C.ink, { weight: 0.16, tracking: 0.9 });
  drawText(cv, "COLLAPSE", MX, 296, 64, C.ink, { weight: 0.16, tracking: 0.9 });
  drawText(cv, "The Antalya summit ends with no deal after oil states", MX, 326, 18, C.ink, { weight: 0.14, tracking: 0.4 });
  drawText(cv, "block a fossil-fuel phase-out.", MX, 352, 18, C.ink, { weight: 0.14, tracking: 0.4 });
  fillRect(cv, MX, 366, CW, 1, C.rule);

  // ---- three columns ----
  // Col A: the summit (body text)
  const colAX = MX, colAW = 300;
  drawText(cv, "THE SUMMIT", colAX, 398, 12, C.red, { weight: 0.16, tracking: 1.2 });
  const bodyLines = wrap("Negotiators left Antalya without an agreement on Tuesday, after producers resisted any language on ending fossil fuels. The talks collapsed into deadlock.", 15, colAW, 0.4);
  for (let i = 0; i < bodyLines.length; i++) {
    drawText(cv, bodyLines[i], colAX, 424 + i * 21, 15, C.ink, { weight: 0.13, tracking: 0.4 });
  }
  const bodyEnd = 424 + bodyLines.length * 21;
  drawText(cv, "Deals signed: none.", colAX, bodyEnd + 22, 15, C.ink, { weight: 0.16, tracking: 0.4 });

  // Col B: globe illustration (cracked earth)
  const gcX = 512, gcY = 468, gR = 70;
  fillCircle(cv, gcX, gcY, gR + 3, C.ink);
  fillCircle(cv, gcX, gcY, gR, C.paperTop);
  // longitude arcs (vertical ellipses, approximated by polylines)
  for (const rx of [24, 48]) {
    const pts: number[][] = [];
    for (let a = 0; a <= 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      pts.push([gcX + rx * Math.cos(t), gcY + gR * Math.sin(t)]);
    }
    polyline(cv, pts, 1.5, C.muted);
  }
  // latitude chords
  for (const dy of [-36, 0, 36]) {
    const hw = Math.sqrt(Math.max(0, gR * gR - dy * dy));
    thinLine(cv, gcX - hw, gcY + dy, gcX + hw, gcY + dy, C.muted);
  }
  // the crack, in red
  polyline(cv, [[gcX - 8, gcY - 62], [gcX + 6, gcY - 34], [gcX - 10, gcY - 6], [gcX + 8, gcY + 22], [gcX - 4, gcY + 48], [gcX + 2, gcY + 66]], 4, C.red);
  drawText(cv, "The summit ended in deadlock.", gcX, 566, 13, C.muted, { align: "center", weight: 0.14, tracking: 0.4 });

  // Col C: hero 2 — Benghazi
  const colCX = 678, colCW = 300;
  drawText(cv, "UKRAINE — BLACK SEA", colCX, 398, 12, C.red, { weight: 0.16, tracking: 1.2 });
  drawText(cv, "WARSHIP SUNK", colCX, 446, 30, C.ink, { weight: 0.17, tracking: 0.4 });
  drawText(cv, "OFF BENGHAZI", colCX, 480, 30, C.ink, { weight: 0.17, tracking: 0.4 });
  const deck2 = wrap("Kyiv says its forces struck a Russian corvette off the Libyan coast. A cargo ship was also hit in the Gulf of Finland.", 15, colCW, 0.4);
  for (let i = 0; i < deck2.length; i++) {
    drawText(cv, deck2[i], colCX, 510 + i * 21, 15, C.ink, { weight: 0.13, tracking: 0.4 });
  }

  // ---- section: AROUND THE WORLD ----
  fillRect(cv, MX, 584, CW, 1, C.rule);
  drawText(cv, "AROUND THE WORLD", MX, 612, 18, C.ink, { weight: 0.16, tracking: 1.0 });
  fillRect(cv, MX, 624, CW, 1, C.rule);

  // ---- boxes: 2 rows x 3 cols ----
  const boxW = 296, boxH = 110;
  const boxX = [46, 364, 682];
  const boxY = [640, 762];
  const boxes: { label: string; head: string; deck: string }[] = [
    { label: "POLAND", head: "3 MISSILES BREACH POLISH AIRSPACE", deck: "NATO scrambles early-warning jets." },
    { label: "MARKETS", head: "NVIDIA REBOUNDS 31.5%", deck: "Monday surge worth $34 billion." },
    { label: "INDONESIA", head: "INDONESIA SEALS TRADE DEAL", deck: "A rare deal on a day of deadlock." },
    { label: "WASHINGTON", head: "U.S.—IRAN TENSIONS RISE", deck: "Leaders trade warnings on a tense day." },
    { label: "THE DAY IN NUMBERS", head: "", deck: "" },
    { label: "WHERE IT HAPPENED", head: "", deck: "" },
  ];
  for (let i = 0; i < 6; i++) {
    const bx = boxX[i % 3], by = boxY[Math.floor(i / 3)];
    const b = boxes[i];
    fillRect(cv, bx, by, boxW, 3, C.red);
    drawText(cv, b.label, bx, by + 20, 12, C.red, { weight: 0.16, tracking: 1.0 });
    if (i === 4) {
      // numbers box
      const stats = ["3 — missiles over Poland", "2 — Russian ships struck", "+31.5% — Nvidia rebound", "$34B — Monday surge"];
      for (let s = 0; s < stats.length; s++) {
        drawText(cv, stats[s], bx, by + 44 + s * 17, 14, C.ink, { weight: 0.14, tracking: 0.4 });
      }
    } else if (i === 5) {
      // map box
      const mx = bx + 8, my = by + 26, mw = 280, mh = 62;
      for (const cont of CONTINENTS) {
        fillPoly(cv, cont.map(([lo, la]) => project(lo, la, mx, my, mw, mh)), C.mapLand);
      }
      const pins: { n: string; lo: number; la: number; dx: number; dy: number }[] = [
        { n: "1", lo: 30.7, la: 36.9, dx: 16, dy: -13 },
        { n: "2", lo: 20.1, la: 32.1, dx: -16, dy: 12 },
        { n: "3", lo: 21.0, la: 52.2, dx: 15, dy: 13 },
        { n: "4", lo: 106.8, la: -6.2, dx: 0, dy: 0 },
        { n: "5", lo: -122.0, la: 37.4, dx: 0, dy: 0 },
      ];
      for (const p of pins) {
        const [px, py] = project(p.lo, p.la, mx, my, mw, mh);
        fillCircle(cv, px, py, 2, C.ink);
        const bx2 = px + p.dx, by2 = py + p.dy;
        if (p.dx !== 0 || p.dy !== 0) thinLine(cv, px, py, bx2, by2, C.ink);
        fillCircle(cv, bx2, by2, 6.5, C.white);
        fillCircle(cv, bx2, by2, 5.5, C.red);
        drawText(cv, p.n, bx2, by2 + 3, 8, C.white, { align: "center", weight: 0.2, tracking: 0 });
      }
      const legend = "1 Antalya • 2 Benghazi • 3 Poland • 4 Jakarta • 5 Silicon Valley";
      const legendSize = fitSize(legend, 11, boxW - 16, 0.3, 9);
      drawText(cv, legend, bx, by + 102, legendSize, C.muted, { weight: 0.14, tracking: 0.3 });
    } else {
      const headLines = wrap(b.head, 18, boxW - 32, 0.5);
      for (let li = 0; li < headLines.length; li++) {
        drawText(cv, headLines[li], bx, by + 44 + li * 22, 18, C.ink, { weight: 0.15, tracking: 0.5 });
      }
      const deckLines = wrap(b.deck, 13, boxW - 32, 0.4);
      for (let li = 0; li < deckLines.length; li++) {
        drawText(cv, deckLines[li], bx, by + 88 + li * 16, 13, C.muted, { weight: 0.13, tracking: 0.4 });
      }
    }
  }

  // ---- ticker ----
  fillRect(cv, MX, 888, CW, 1, C.rule);
  drawText(cv, "ALSO:", MX, 912, 15, C.red, { weight: 0.17, tracking: 0.6 });
  const tickX = MX + measure("ALSO: ", 15, 0.6) + 8;
  drawText(cv, "NATO jets scramble • Kyiv hits a second ship • Nvidia surges $34B • Jakarta seals a trade deal", tickX, 912, 14, C.ink, { weight: 0.13, tracking: 0.4 });

  // ---- footer ----
  fillRect(cv, MX, 936, CW, 1, C.rule);
  drawText(cv, "THE WORLD TODAY • TUESDAY 24 NOVEMBER 2026 • LATE EDITION", 512, 960, 12, C.faint, { align: "center", weight: 0.14, tracking: 0.5 });

  return cv;
}
