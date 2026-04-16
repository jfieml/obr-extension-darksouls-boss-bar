import { type BossBarData } from "./types";

// ── Image cache ────────────────────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

function loadAll(srcs: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(srcs.map(loadImage));
}

/**
 * Draw `img` stretched to (dx, dy, dw, dh) but clip it to `clipW` px from dx.
 */
function drawClipped(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number,
  clipW: number,
): void {
  if (clipW <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, Math.min(clipW, dw), dh);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// ── DS1 ───────────────────────────────────────────────────────────────────
// frame: 1499×146 — single composite PNG; fill is drawn behind it

async function drawDS1(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: BossBarData,
) {
  const frame = await loadImage("/assets/ds1/boss_health_bar.png");

  const s      = canvas.width / frame.width;
  const topPad = 12; // empty space above the boss name
  const barH   = Math.round(frame.height * s);
  canvas.height = topPad + barH;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const health = clamp01(data);
  const bx = Math.round(80 * s);
  const by = topPad + Math.round(64 * s);
  const bw = Math.round(1335 * s);
  const bh = Math.round(25 * s);

  ctx.fillStyle = "#0d0800";
  ctx.fillRect(bx, by, bw, bh);

  if (health > 0) {
    const g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, "#c01818");
    g.addColorStop(1, "#600808");
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw * health, bh);
  }

  ctx.drawImage(frame, 0, topPad, canvas.width, barH);

  await document.fonts.ready;
  const fs = Math.max(13, Math.round(58 * s));
  ctx.font = `${fs}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = Math.max(1, fs * 0.12);
  const textX = Math.round(95 * s);
  const textY = topPad + Math.round(42 * s);
  ctx.strokeText(data.bossName, textX, textY);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(data.bossName, textX, textY);
}

// ── DS2 ───────────────────────────────────────────────────────────────────
// frame: 692×28 | red/yellow: 9×9 tiles

async function drawDS2(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: BossBarData,
) {
  const [frame, yellow, red] = await loadAll([
    "/assets/ds2/boss_health_frame.png",
    "/assets/ds2/boss_health_yellow.png",
    "/assets/ds2/boss_health_red.png",
  ]);

  const sidePad = 24;
  const drawW = canvas.width - 2 * sidePad;
  const s = drawW / frame.width;
  const topPad = 12;
  const bottomPad = 10;
  const nameH = Math.max(20, Math.round(24 * s));
  const barH = Math.round(frame.height * s);
  canvas.height = topPad + nameH + barH + bottomPad;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const health = clamp01(data);
  const ix = sidePad + Math.round(14 * s);
  const iw = Math.round(664 * s);

  drawClipped(ctx, yellow, ix, topPad + nameH, iw, barH, iw);
  drawClipped(ctx, red,    ix, topPad + nameH, iw, barH, Math.round(iw * health));
  ctx.drawImage(frame, sidePad, topPad + nameH, drawW, barH);

  await document.fonts.ready;
  const fs = Math.max(13, Math.round(30 * s));
  ctx.font = `${fs}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeText(data.bossName, sidePad + 4, topPad + nameH - 4);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillText(data.bossName, sidePad + 4, topPad + nameH - 4);
}

// ── DS3 ───────────────────────────────────────────────────────────────────
// frame / red: 1017×50 | fill = 7 + 1002 * health

async function drawDS3(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: BossBarData,
) {
  const [frame, red] = await loadAll([
    "/assets/ds3/boss_health_frame.png",
    "/assets/ds3/boss_health_red.png",
  ]);

  const sidePad = 24;
  const drawW = canvas.width - 2 * sidePad;
  const s = drawW / frame.width;
  const topPad = 12;
  const bottomPad = 10;
  const nameH = Math.max(22, Math.round(32 * s));
  const barH = Math.round(frame.height * s);
  canvas.height = topPad + nameH + barH + bottomPad;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const health = clamp01(data);
  const fillPx = health > 0 ? (7 + 1002 * health) / frame.width * drawW : 0;

  // Frame is the dark track background; red fill is semi-transparent on top
  // so the track texture remains visible through the vibrant red.
  ctx.drawImage(frame, sidePad, topPad + nameH, drawW, barH);
  if (health > 0) {
    ctx.save();
    ctx.globalAlpha = 1;
    drawClipped(ctx, red, sidePad, topPad + nameH, drawW, barH, fillPx);
    ctx.restore();
  }

  await document.fonts.ready;
  const fs = Math.max(13, Math.round(29 * s * 1.35));
  ctx.font = `${fs}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillText(data.bossName, sidePad + 4, topPad + nameH - 4);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ── Elden Ring ─────────────────────────────────────────────────────────────
// all images: 2098×100 | tip: 107×100 | fill = 50 + 1998 * health

async function drawEldenRing(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: BossBarData,
) {
  const [base, frame, yellow, red, tip] = await loadAll([
    "/assets/eldenring/boss_health_base.png",
    "/assets/eldenring/boss_health_frame.png",
    "/assets/eldenring/boss_health_yellow.png",
    "/assets/eldenring/boss_health_red.png",
    "/assets/eldenring/boss_health_tip.png",
  ]);

  const sidePad = 24;
  const drawW = canvas.width - 2 * sidePad;
  const s = drawW / base.width;
  const topPad = 12;
  const bottomPad = 10;
  const nameH = Math.max(22, Math.round(30 * s));
  const barH = Math.round(base.height * s);
  canvas.height = topPad + nameH + barH + bottomPad;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const health = clamp01(data);
  const fillPx = health > 0 ? (50 + 1998 * health) / base.width * drawW : 0;

  ctx.drawImage(base, sidePad, topPad + nameH, drawW, barH);
  drawClipped(ctx, yellow, sidePad, topPad + nameH, drawW, barH, fillPx);
  drawClipped(ctx, red,    sidePad, topPad + nameH, drawW, barH, fillPx);

  if (health > 0) {
    const tipW = (tip.width  / base.width)  * drawW;
    const tipH = (tip.height / base.height) * barH;
    const tipX = sidePad + fillPx - (53 / base.width) * drawW;
    ctx.drawImage(tip, tipX, topPad + nameH, tipW, tipH);
  }

  ctx.drawImage(frame, sidePad, topPad + nameH, drawW, barH);

  await document.fonts.ready;
  const fs = Math.max(13, Math.round(40 * s * (2098 / 900)));
  ctx.font = `${fs}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeText(data.bossName, sidePad + 4, topPad + nameH - 4);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(data.bossName, sidePad + 4, topPad + nameH - 4);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp01(data: BossBarData): number {
  if (data.maxHP <= 0) return 0;
  return Math.max(0, Math.min(1, data.currentHP / data.maxHP));
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Render into an existing canvas element (used for the GM preview). */
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  data: BossBarData,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    switch (data.gameStyle) {
      case "ds1":       return await drawDS1(ctx, canvas, data);
      case "ds2":       return await drawDS2(ctx, canvas, data);
      case "ds3":       return await drawDS3(ctx, canvas, data);
      case "eldenring": return await drawEldenRing(ctx, canvas, data);
    }
  } catch (err) {
    console.error("[Dark Souls Utility] Render error:", err);
  }
}

/**
 * Render into an off-screen canvas and return { dataURL, width, height }.
 * Used when creating/updating the OBR scene image item.
 */
export async function renderToDataURL(
  data: BossBarData,
  displayWidth = 800,
): Promise<{ dataURL: string; width: number; height: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = displayWidth;
  canvas.height = 1; // will be set by the draw function
  await renderToCanvas(canvas, data);
  return { dataURL: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

/**
 * Render into an off-screen canvas and return { blob, width, height }.
 * Used for uploading via OBR.assets.uploadImages (avoids data-URL CSP issues).
 */
export async function renderToBlob(
  data: BossBarData,
  displayWidth = 800,
): Promise<{ blob: Blob; width: number; height: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = displayWidth;
  canvas.height = 1; // will be set by the draw function
  await renderToCanvas(canvas, data);
  const { width, height } = canvas;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve({ blob, width, height });
        else reject(new Error("[Dark Souls Utility] Failed to create blob from canvas"));
      },
      "image/png",
    );
  });
}
