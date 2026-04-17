import { assetUrl } from "./assetBase";
import { type BossBarData } from "./types";

// ── Damage overlay ─────────────────────────────────────────────────────────

/**
 * Optional overlay data for the damage-chip animation.
 * When provided, a yellow bar is drawn from the current HP edge to `prevRatio`,
 * and a damage number is rendered in the top-right corner.
 */
export interface DamageOverlay {
  /** Health ratio (0–1) before the damage was dealt. */
  prevRatio: number;
  /** Raw HP lost (positive number), shown as "−N" in the corner. */
  damageAmount: number;
  /** Fade factor 0–1 (0 = invisible, 1 = fully opaque). */
  alpha: number;
}

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
  overlay?: DamageOverlay,
) {
  const frame = await loadImage(assetUrl("ds1", "boss_health_bar.png"));
  await document.fonts.ready;

  const s    = canvas.width / frame.width;
  const barH = Math.round(frame.height * s);
  const fs   = Math.max(13, Math.round(58 * s));

  // The name baseline in canvas space sits at topPad + 42*s (native position
  // inside the DS1 frame's decorative name band).  topPad must be large
  // enough that the text ascenders (cap-height + half stroke) don't clip
  // above y=0, with at least 4 px of breathing room.
  const capHeight  = fs * 0.91;
  const strokeHalf = Math.max(1, fs * 0.06);
  const topPad     = Math.max(6, Math.ceil(10 + capHeight + strokeHalf - 42 * s));

  canvas.height = topPad + barH;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const health = clamp01(data);
  const bx = Math.round(80 * s);
  const by = topPad + Math.round(64 * s);
  const bw = Math.round(1335 * s);
  const bh = Math.round(25 * s);

  ctx.fillStyle = "#0d0800";
  ctx.fillRect(bx, by, bw, bh);

  // Yellow damage zone drawn before red so red sits on top of it.
  if (overlay && overlay.prevRatio > health && overlay.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = overlay.alpha;
    ctx.fillStyle = "#b87828";
    ctx.fillRect(bx + bw * health, by, Math.max(0, bw * (overlay.prevRatio - health)), bh);
    ctx.restore();
  }

  if (health > 0) {
    const g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, "#c01818");
    g.addColorStop(1, "#600808");
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw * health, bh);
  }

  ctx.drawImage(frame, 0, topPad, canvas.width, barH);

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
  overlay?: DamageOverlay,
) {
  const [frame, yellow, red] = await loadAll([
    assetUrl("ds2", "boss_health_frame.png"),
    assetUrl("ds2", "boss_health_yellow.png"),
    assetUrl("ds2", "boss_health_red.png"),
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
  // Fill area inside the frame: native fillX=14, fillY=9, fillH=9, fillMaxW=664
  const ix    = sidePad + Math.round(14 * s);
  const iw    = Math.round(664 * s);
  const fillY = topPad + nameH + Math.round(9 * s);
  const fillH = Math.max(1, Math.round(9 * s));

  // Frame is the background track.
  ctx.drawImage(frame, sidePad, topPad + nameH, drawW, barH);

  // Yellow damage zone drawn first so red sits on top.
  if (overlay && overlay.prevRatio > 0 && overlay.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = overlay.alpha;
    drawClipped(ctx, yellow, ix, fillY, iw, fillH, Math.round(iw * overlay.prevRatio));
    ctx.restore();
  }
  drawClipped(ctx, red, ix, fillY, iw, fillH, Math.round(iw * health));

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
  overlay?: DamageOverlay,
) {
  const [frame, yellow, red] = await loadAll([
    assetUrl("ds3", "boss_health_frame.png"),
    assetUrl("ds3", "boss_health_yellow.png"),
    assetUrl("ds3", "boss_health_red.png"),
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

  // Frame is the dark track background; fills are drawn on top.
  ctx.drawImage(frame, sidePad, topPad + nameH, drawW, barH);

  // Yellow damage zone drawn first so red sits on top.
  if (overlay && overlay.prevRatio > 0 && overlay.alpha > 0) {
    const prevFillPx = (7 + 1002 * overlay.prevRatio) / frame.width * drawW;
    ctx.save();
    ctx.globalAlpha = overlay.alpha;
    drawClipped(ctx, yellow, sidePad, topPad + nameH, drawW, barH, prevFillPx);
    ctx.restore();
  }
  if (health > 0) {
    drawClipped(ctx, red, sidePad, topPad + nameH, drawW, barH, fillPx);
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
  overlay?: DamageOverlay,
) {
  const [base, frame, yellow, red, tip] = await loadAll([
    assetUrl("eldenring", "boss_health_base.png"),
    assetUrl("eldenring", "boss_health_frame.png"),
    assetUrl("eldenring", "boss_health_yellow.png"),
    assetUrl("eldenring", "boss_health_red.png"),
    assetUrl("eldenring", "boss_health_tip.png"),
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
  // Yellow extends to the pre-damage HP when an overlay is active.
  const yellowFillPx = (overlay && overlay.prevRatio > 0 && overlay.alpha > 0)
    ? (50 + 1998 * overlay.prevRatio) / base.width * drawW
    : fillPx;

  ctx.drawImage(base, sidePad, topPad + nameH, drawW, barH);

  if (overlay && overlay.alpha > 0 && yellowFillPx > fillPx) {
    ctx.save();
    ctx.globalAlpha = overlay.alpha;
    drawClipped(ctx, yellow, sidePad, topPad + nameH, drawW, barH, yellowFillPx);
    ctx.restore();
  }
  drawClipped(ctx, red, sidePad, topPad + nameH, drawW, barH, fillPx);

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

/**
 * Draw the "-N" damage number in the top-right corner of the canvas.
 * Called after the style-specific draw so it always sits on top.
 */
function drawDamageNumber(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  overlay: DamageOverlay,
): void {
  ctx.save();
  ctx.globalAlpha = overlay.alpha;
  const text = `${Math.round(overlay.damageAmount)}`;
  const fs   = Math.max(11, Math.round(canvas.width * 0.038));
  ctx.font      = `bold ${fs}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign    = "right";
  ctx.textBaseline = "top";
  ctx.lineJoin     = "round";
  ctx.strokeStyle  = "rgba(0,0,0,0.85)";
  ctx.lineWidth    = Math.max(1.5, fs * 0.16);
  const tx = canvas.width - 8;
  const ty = 4;
  ctx.strokeText(text, tx, ty);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Render into an existing canvas element (used for the GM preview). */
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  data: BossBarData,
  overlay?: DamageOverlay,
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    switch (data.gameStyle) {
      case "ds1":       await drawDS1(ctx, canvas, data, overlay); break;
      case "ds2":       await drawDS2(ctx, canvas, data, overlay); break;
      case "ds3":       await drawDS3(ctx, canvas, data, overlay); break;
      case "eldenring": await drawEldenRing(ctx, canvas, data, overlay); break;
    }
    if (overlay && overlay.damageAmount > 0 && overlay.alpha > 0) {
      drawDamageNumber(ctx, canvas, overlay);
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
