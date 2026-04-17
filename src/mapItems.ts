import OBR, {
  buildImage,
  buildShape,
  buildText,
  isImage,
  isShape,
  isText,
  type Image,
  type Item,
  type Text,
} from "@owlbear-rodeo/sdk";
import { assetUrl } from "./assetBase";
import { getPluginId } from "./getPluginId";
import { type BossBarData, type GameStyle } from "./types";

// ── Constants ──────────────────────────────────────────────────────────────

export const PLUGIN_ID = getPluginId("bar");

/** Width of the boss bar in OBR scene units (= 5 grid cells at default 150 dpi). */
const BAR_W = 750;

/** Extra scene units of dark background padding around the frame image. */
const BG_PAD = 8;

// ── Per-style layout ───────────────────────────────────────────────────────

interface StyleLayout {
  frameFile: string;
  nativeW: number;
  nativeH: number;
  /** Fill rect in native pixels (origin = image top-left). */
  fillX: number;
  fillY: number;
  fillH: number;
  fillMaxW: number;
  fillOffset: number;
  fillColor: string;
  /**
   * When true the frame image is the dark background track (drawn behind the fill).
   * When false (default) the frame is a decorative overlay with a transparent slot
   * and is drawn on top of the fill so the fill shows through.
   * DS1 = false (overlay), DS3 = true (background track).
   */
  frameIsBackground?: boolean;
  /**
   * Opacity for the HP fill rectangle (0–1). Defaults to 1.
   * Set < 1 to let the underlying frame texture show through the fill (e.g. DS3).
   */
  fillOpacity?: number;
  /** Native pixels of extra space ABOVE the frame for the boss name (DS2/DS3/ER). */
  nameAreaAbove: number;
  /** Native pixels of extra space BELOW the frame for the boss name (Sekiro name_bg). */
  nameAreaBelow: number;
  /** Name text top-left X in native pixels from bar left edge. */
  nameTX: number;
  /**
   * Name text top-left Y in native pixels from bar top edge.
   * Negative values place the text above the frame image (DS2/DS3/ER).
   * Values > nativeH place the text below (Sekiro).
   */
  nameTY: number;
  /** Font size in native pixels (scaled by s = BAR_W/nativeW to get scene units). */
  nameFontSize: number;
  nameFontFamily: string;
  nameColor: string;
}

const LAYOUTS: Record<GameStyle, StyleLayout> = {
  ds1: {
    frameFile: "boss_health_bar.png",
    nativeW: 1499, nativeH: 146,
    fillX: 80, fillY: 64, fillH: 25, fillMaxW: 1335, fillOffset: 0,
    fillColor: "#b01010",
    // Name sits above the frame in its own area; text baseline ~5px below area bottom.
    nameAreaAbove: 32, nameAreaBelow: 0,
    nameTX: 95, nameTY: -28,
    nameFontSize: 60, nameFontFamily: "Georgia", nameColor: "#1c1a13",
  },
  ds2: {
    frameFile: "boss_health_frame.png",
    nativeW: 692, nativeH: 28,
    fillX: 14, fillY: 9, fillH: 9, fillMaxW: 664, fillOffset: 0,
    fillColor: "#9b1b1b",
    // Name rendered above bar in a 24px area; baseline at nameH-4=20, font=30px
    // text top relative to barTLY = -(4 + fontSize) = -34
    frameIsBackground: true,
    nameAreaAbove: 24, nameAreaBelow: 0,
    nameTX: 4, nameTY: -34,
    nameFontSize: 30, nameFontFamily: "Georgia", nameColor: "#1c1a13",
  },
  ds3: {
    frameFile: "boss_health_frame.png",
    nativeW: 1017, nativeH: 50,
    // Frame is behind fill; red fill is centred on the rod (adjust fillY to fine-tune).
    fillX: 10, fillY: 18, fillH: 10, fillMaxW: 1002, fillOffset: -2,
    fillColor: "#b01010",
    // Semi-transparent fill lets the dark frame texture show through for a richer look.
    fillOpacity: 1,
    frameIsBackground: true,
    // Name above bar in 32px area; baseline at 28, font=39px (29*1.35)
    // text top = -(4 + 39) = -43
    nameAreaAbove: 32, nameAreaBelow: 0,
    nameTX: 4, nameTY: -45,
    nameFontSize: 43, nameFontFamily: "Georgia", nameColor: "#1c1a13",
  },
  eldenring: {
    frameFile: "boss_health_frame.png",
    nativeW: 2098, nativeH: 100,
    fillX: 50, fillY: 40, fillH: 20, fillMaxW: 1998, fillOffset: 0,
    fillColor: "#b81212",
    // base.png is the dark track background; fill (red) renders on top of it.
    frameIsBackground: false,
    // Name above bar in 30px area; font native = 24*(2098/900)≈56px
    // text top = -(4 + 56) = -60
    nameAreaAbove: 50, nameAreaBelow: 0,
    nameTX: 50, nameTY: -80,
    nameFontSize: 80, nameFontFamily: "Georgia", nameColor: "#1c1a13",
  },
};

// ── Geometry ───────────────────────────────────────────────────────────────

/**
 * barCX / barCY = CENTER of the frame image.
 *
 * OBR shapes are positioned by their TOP-LEFT corner.
 * OBR images are positioned by their anchor (set to image center here).
 *
 * The background shape extends beyond the frame to cover name areas above/below.
 * `scale` multiplies the base BAR_W (750 units) and BG_PAD uniformly.
 */
function computeGeometry(
  layout: StyleLayout,
  health: number,
  barCX: number,
  barCY: number,
  scale: number,
) {
  const effectiveW = BAR_W * scale;
  const effectivePad = BG_PAD * scale;
  const s      = effectiveW / layout.nativeW;
  const sceneH = layout.nativeH * s;

  // Fill
  const fillWNative = health > 0
    ? layout.fillOffset + layout.fillMaxW * health
    : 0;
  const fillW = Math.max(0.01, fillWNative * s);
  const fillH = layout.fillH * s;

  // Frame (bar) top-left
  const barTLX = barCX - effectiveW / 2;
  const barTLY = barCY - sceneH / 2;

  // Fill top-left (shapes use top-left positioning)
  const fillTLX = barTLX + layout.fillX * s;
  const fillTLY = barTLY + layout.fillY * s;

  // Background shape — extends to cover name area above/below
  const nameAboveScene = layout.nameAreaAbove * s;
  const nameBelowScene = layout.nameAreaBelow * s;
  const bgW   = effectiveW + effectivePad * 2;
  const bgH   = sceneH + nameAboveScene + nameBelowScene + effectivePad * 2;
  const bgTLX = barCX - bgW / 2;
  const bgTLY = barTLY - nameAboveScene - effectivePad;

  // Name text top-left
  const nameTLX        = barTLX + layout.nameTX * s;
  const nameTLY        = barTLY + layout.nameTY * s;
  const nameFontScene  = layout.nameFontSize * s;

  return { sceneH, fillW, fillH, fillTLX, fillTLY, bgW, bgH, bgTLX, bgTLY, nameTLX, nameTLY, nameFontScene, effectiveW, effectivePad };
}

function healthRatio(data: BossBarData): number {
  if (data.maxHP <= 0) return 0;
  return Math.max(0, Math.min(1, data.currentHP / data.maxHP));
}

/** Recover the frame image center from a bg shape's top-left and the stored layout + scale. */
function barCenterFromBgTL(bgTL: { x: number; y: number }, layout: StyleLayout, scale: number): { x: number; y: number } {
  const effectiveW    = BAR_W * scale;
  const effectivePad  = BG_PAD * scale;
  const s             = effectiveW / layout.nativeW;
  const sceneH        = layout.nativeH * s;
  const nameAboveScene = layout.nameAreaAbove * s;
  return {
    x: bgTL.x + (effectiveW + effectivePad * 2) / 2,
    y: bgTL.y + effectivePad + nameAboveScene + sceneH / 2,
  };
}

// ── Animation state ────────────────────────────────────────────────────────

/** Timer handle per bar ID for any in-progress fill tween. */
const activeAnimations = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Currently displayed (possibly mid-tween) HP per bar.
 * Used as the `fromHP` start point when a new change interrupts a running animation.
 */
const animatedHP = new Map<string, number>();

/** Update only the fill shape's geometry (width / height / position). */
async function applyFillGeometry(
  fillId: string,
  layout: StyleLayout,
  health: number,
  barCenter: { x: number; y: number },
  scale: number,
): Promise<void> {
  const { fillW, fillH, fillTLX, fillTLY } = computeGeometry(layout, health, barCenter.x, barCenter.y, scale);
  await OBR.scene.items.updateItems(
    (i: Item) => i.id === fillId,
    (drafts) => {
      for (const d of drafts) {
        if (!isShape(d)) continue;
        d.width    = fillW;
        d.height   = fillH;
        d.position = { x: fillTLX, y: fillTLY };
      }
    },
  );
}

// ── Public helpers ─────────────────────────────────────────────────────────

const DEFAULT_DATA: BossBarData = {
  bossName: "Boss", currentHP: 100, maxHP: 100, gameStyle: "ds1", scale: 1,
};

export function isBossBar(item: Item): boolean {
  return Boolean(item.metadata[PLUGIN_ID]);
}

export function getBarData(item: Item): BossBarData {
  return { ...DEFAULT_DATA, ...(item.metadata[PLUGIN_ID] as Partial<BossBarData>) };
}

/**
 * Show or hide a boss bar for players.
 * visible=false → GM sees it semi-transparent, players see nothing.
 * visible=true  → visible to everyone.
 * Applies to the bg item and all its attachments (fill, frame, name).
 */
export async function toggleBarVisibility(itemId: string, visible: boolean): Promise<void> {
  const attachments = await OBR.scene.items.getItemAttachments([itemId]);
  const allIds = new Set([itemId, ...attachments.map(a => a.id)]);
  await OBR.scene.items.updateItems(
    (i: Item) => allIds.has(i.id),
    (drafts) => {
      for (const d of drafts) {
        d.visible = visible;
      }
    },
  );
}

// ── Scene item management ──────────────────────────────────────────────────

/**
 * Create a boss bar at the centre of the visible viewport as four items:
 *
 *   1. Background SHAPE  – dark rect with padding; the GM drag handle; holds metadata
 *   2. Fill SHAPE        – red HP fill; attached to bg
 *   3. Frame IMAGE       – authentic PNG overlay; attached to bg; on top
 *   4. Name TEXT         – boss name, per-style font/colour/position; attached to bg
 *
 * Shapes use top-left positioning; the frame image uses a center anchor.
 *
 * IMAGE anchor:
 *   offset = { nativeW/2, nativeH/2 }  → OBR places the centre pixel of the image
 *                                          at item.position (= barCenter).
 *   dpi    = nativeW * sceneDpi / effectiveW → image is exactly effectiveW scene units wide.
 */
export async function createMapBar(data: BossBarData): Promise<string> {
  const layout = LAYOUTS[data.gameStyle];
  const health = healthRatio(data);
  const scale  = data.scale ?? 1;

  const [vpW, vpH, sceneDpi] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
    OBR.scene.grid.getDpi(),
  ]);
  const barCenter = await OBR.viewport.inverseTransformPoint({ x: vpW / 2, y: vpH / 2 });

  const { fillW, fillH, fillTLX, fillTLY, bgW, bgH, bgTLX, bgTLY, nameTLX, nameTLY, nameFontScene, effectiveW } =
    computeGeometry(layout, health, barCenter.x, barCenter.y, scale);

  // Z-index assignments guarantee correct stacking regardless of insertion order,
  // so updating an existing bar (which can't change array order) always renders correctly.
  // frameIsBackground=true (e.g. DS3): frame=1, fill=2  → fill on top of frame
  // frameIsBackground=false (default): fill=1, frame=2  → frame overlay on top of fill
  const fillZ  = layout.frameIsBackground ? 2 : 1;
  const frameZ = layout.frameIsBackground ? 1 : 2;

  // 1 – background rectangle (dark, padded, draggable)
  const bg = buildShape()
    .shapeType("RECTANGLE")
    .width(bgW).height(bgH)
    .fillColor("#ede2db")
    .fillOpacity(0.8)
    .strokeColor("#6b5010")
    .strokeOpacity(0.5)
    .strokeWidth(1)
    .layer("NOTE")
    .zIndex(0)
    .name(data.bossName)
    .locked(false)
    .position({ x: bgTLX, y: bgTLY })
    .metadata({ [PLUGIN_ID]: data })
    .build();

  // 2 – red HP fill (top-left positioned)
  const fill = buildShape()
    .shapeType("RECTANGLE")
    .width(fillW).height(fillH)
    .fillColor(layout.fillColor)
    .fillOpacity(layout.fillOpacity ?? 1)
    .strokeOpacity(0)
    .layer("NOTE")
    .zIndex(fillZ)
    .name("__hp_fill")
    .locked(true)
    .disableHit(true)
    .attachedTo(bg.id)
    .disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"])
    .position({ x: fillTLX, y: fillTLY })
    .build();

  // 3 – frame PNG, centred at barCenter
  const frameDpi = layout.nativeW * sceneDpi / effectiveW;
  const frameUrl = assetUrl(data.gameStyle, layout.frameFile);
  const frame = buildImage(
    { width: layout.nativeW, height: layout.nativeH, mime: "image/png", url: frameUrl },
    { offset: { x: layout.nativeW / 2, y: layout.nativeH / 2 }, dpi: frameDpi },
  )
    .layer("NOTE")
    .zIndex(frameZ)
    .name("__frame")
    .locked(true)
    .disableHit(true)
    .attachedTo(bg.id)
    .disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"])
    .position(barCenter)
    .build();

  // 4 – boss name text
  const nameItem = buildText()
    .layer("NOTE")
    .zIndex(3)
    .name("__name")
    .locked(true)
    .disableHit(true)
    .attachedTo(bg.id)
    .disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"])
    .position({ x: nameTLX, y: nameTLY })
    .textType("PLAIN")
    .plainText(data.bossName)
    .fontFamily(layout.nameFontFamily)
    .fontSize(nameFontScene)
    .fontWeight(400)
    .fillColor(layout.nameColor)
    .fillOpacity(1)
    .strokeColor("#000000")
    .strokeOpacity(0.65)
    .strokeWidth(Math.max(1, nameFontScene * 0.06))
    .padding(0)
    .build();

  const items = layout.frameIsBackground
    ? [bg, frame, fill, nameItem]
    : [bg, fill, frame, nameItem];
  await OBR.scene.items.addItems(items);
  return bg.id;
}

/**
 * Update an existing boss bar.
 * bg.position is the TOP-LEFT of the background shape.
 * barCenter is recovered from bg.position using the stored (old) layout.
 *
 * Pass `options.animate = true` to tween the HP fill from the currently
 * displayed HP to `data.currentHP` over 600 ms (8 steps, ease-out quadratic).
 * All other fields (bg, frame, name) update immediately regardless.
 */
export async function updateMapBar(
  itemId: string,
  data: BossBarData,
  options?: { animate?: boolean },
): Promise<void> {
  const [bgList, sceneDpi] = await Promise.all([
    OBR.scene.items.getItems((i: Item) => i.id === itemId),
    OBR.scene.grid.getDpi(),
  ]);
  if (bgList.length === 0) return;

  // Recover frame-image center from the stored bg top-left using the OLD layout + scale
  const bgTL       = bgList[0].position;
  const storedData = getBarData(bgList[0]);
  const oldLayout  = LAYOUTS[storedData.gameStyle];
  const oldScale   = storedData.scale ?? 1;
  const barCenter  = barCenterFromBgTL(bgTL, oldLayout, oldScale);

  const layout = LAYOUTS[data.gameStyle];
  const scale  = data.scale ?? 1;

  // Cancel any in-progress fill animation for this bar before proceeding.
  const existingTimer = activeAnimations.get(itemId);
  if (existingTimer !== undefined) {
    clearInterval(existingTimer);
    activeAnimations.delete(itemId);
  }

  const shouldAnimate = (options?.animate ?? false) && Boolean(await OBR.scene.items.getItemAttachments([itemId]).then(a => a.find(x => x.name === "__hp_fill")));

  // When animating, start the fill from the last displayed HP (mid-tween position)
  // so a rapid second click continues smoothly rather than jumping.
  const fromHP = shouldAnimate
    ? (animatedHP.get(itemId) ?? storedData.currentHP)
    : data.currentHP;

  // Geometry for the immediate (non-fill) updates uses the final target HP.
  const health = healthRatio(data);
  const { fillW, fillH, fillTLX, fillTLY, bgW, bgH, bgTLX, bgTLY, nameTLX, nameTLY, nameFontScene, effectiveW } =
    computeGeometry(layout, health, barCenter.x, barCenter.y, scale);

  const frameDpi    = layout.nativeW * sceneDpi / effectiveW;
  const attachments = await OBR.scene.items.getItemAttachments([itemId]);
  const fillItem    = attachments.find(a => a.name === "__hp_fill");
  const frameItem   = attachments.find(a => a.name === "__frame");
  const nameItm     = attachments.find(a => a.name === "__name");

  const fillZ  = layout.frameIsBackground ? 2 : 1;
  const frameZ = layout.frameIsBackground ? 1 : 2;

  // Geometry for the fill's starting frame (fromHP) when animating.
  const fromHealth    = healthRatio({ ...data, currentHP: fromHP });
  const fromFillGeom  = shouldAnimate
    ? computeGeometry(layout, fromHealth, barCenter.x, barCenter.y, scale)
    : null;

  await Promise.all([
    // Update bg: metadata, name, dimensions, position
    OBR.scene.items.updateItems(
      (i: Item) => i.id === itemId,
      (drafts) => {
        for (const d of drafts) {
          d.metadata[PLUGIN_ID] = data;
          d.name = data.bossName;
          d.zIndex = 0;
          if (isShape(d)) {
            d.width    = bgW;
            d.height   = bgH;
            d.position = { x: bgTLX, y: bgTLY };
          }
        }
      },
    ),

    // Update fill — if animating, snap to fromHP first; the tween handles the rest.
    fillItem
      ? OBR.scene.items.updateItems(
          (i: Item) => i.id === fillItem.id,
          (drafts) => {
            for (const d of drafts) {
              if (!isShape(d)) continue;
              d.zIndex            = fillZ;
              d.style.fillColor   = layout.fillColor;
              d.style.fillOpacity = layout.fillOpacity ?? 1;
              if (fromFillGeom) {
                d.width    = fromFillGeom.fillW;
                d.height   = fromFillGeom.fillH;
                d.position = { x: fromFillGeom.fillTLX, y: fromFillGeom.fillTLY };
              } else {
                d.width    = fillW;
                d.height   = fillH;
                d.position = { x: fillTLX, y: fillTLY };
              }
            }
          },
        )
      : Promise.resolve(),

    // Update frame image — also sets zIndex to fix stacking on legacy bars
    frameItem
      ? OBR.scene.items.updateItems(
          (i: Item) => i.id === frameItem.id,
          (drafts) => {
            for (const d of drafts) {
              if (!isImage(d)) continue;
              d.zIndex         = frameZ;
              const img        = d as Image;
              img.image.url    = assetUrl(data.gameStyle, layout.frameFile);
              img.image.width  = layout.nativeW;
              img.image.height = layout.nativeH;
              img.grid.dpi     = frameDpi;
              img.grid.offset  = { x: layout.nativeW / 2, y: layout.nativeH / 2 };
              img.position     = barCenter;
            }
          },
        )
      : Promise.resolve(),

    // Update name text
    nameItm
      ? OBR.scene.items.updateItems(
          (i: Item) => i.id === nameItm.id,
          (drafts) => {
            for (const d of drafts) {
              if (!isText(d)) continue;
              d.zIndex                     = 3;
              const t = d as Text;
              t.position                   = { x: nameTLX, y: nameTLY };
              t.text.plainText             = data.bossName;
              t.text.style.fontSize        = nameFontScene;
              t.text.style.fontFamily      = layout.nameFontFamily;
              t.text.style.fillColor       = layout.nameColor;
              t.text.style.strokeColor     = "#000000";
              t.text.style.strokeOpacity   = 0.65;
              t.text.style.strokeWidth     = Math.max(1, nameFontScene * 0.06);
            }
          },
        )
      : Promise.resolve(),
  ]);

  // ── Fill tween ──────────────────────────────────────────────────────────
  if (!shouldAnimate || !fillItem) return;

  const toHP   = data.currentHP;
  const fillId = fillItem.id;
  const STEPS  = 8;
  const INTERVAL_MS = 600 / STEPS; // 75 ms per step
  let step = 0;

  animatedHP.set(itemId, fromHP);

  const timer = setInterval(async () => {
    step++;
    const t      = step / STEPS;
    const eased  = 1 - (1 - t) ** 2; // ease-out quadratic
    const interpHP = fromHP + (toHP - fromHP) * eased;
    animatedHP.set(itemId, interpHP);

    const interpHealth = healthRatio({ ...data, currentHP: interpHP });
    await applyFillGeometry(fillId, layout, interpHealth, barCenter, scale);

    if (step >= STEPS) {
      clearInterval(timer);
      activeAnimations.delete(itemId);
      animatedHP.set(itemId, toHP);
    }
  }, INTERVAL_MS);

  activeAnimations.set(itemId, timer);
}
