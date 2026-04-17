import OBR, { type Item } from "@owlbear-rodeo/sdk";
import {
  createMapBar,
  getBarData,
  isBossBar,
  toggleBarVisibility,
  updateMapBar,
} from "./mapItems";
import { renderToCanvas, type DamageOverlay } from "./renderer";
import { type BossBarData } from "./types";
import "./style.css";

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_PLAYER_HEIGHT = 80;

const EYE_OPEN = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block" aria-hidden="true"><path d="M0.5 8 Q8 1.5 15.5 8 Q8 14.5 0.5 8Z"/><circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none"/></svg>`;
const EYE_SLASH = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block" aria-hidden="true"><path d="M0.5 8 Q8 1.5 15.5 8 Q8 14.5 0.5 8Z"/><circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none"/><line x1="2.5" y1="2.5" x2="13.5" y2="13.5"/></svg>`;

const DEFAULT_DATA: BossBarData = {
  bossName:  "Boss",
  currentHP: 100,
  maxHP:     100,
  gameStyle: "ds1",
  scale:     1,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ── Player popover ─────────────────────────────────────────────────────────

async function mountPlayerUI(app: HTMLElement, bars: Item[]): Promise<void> {
  app.classList.add("player-mode");

  if (bars.length === 0) {
    app.innerHTML = `
      <div class="player-empty">
        <span>No boss battles in progress.</span>
      </div>`;
    OBR.action.setHeight(MIN_PLAYER_HEIGHT);
    return;
  }

  app.innerHTML = `
    <div class="player-root">
      ${bars.map((_, i) => `<canvas class="player-canvas" id="pc-${i}"></canvas>`).join("")}
    </div>`;

  let totalHeight = 0;
  for (let i = 0; i < bars.length; i++) {
    const canvas = document.getElementById(`pc-${i}`) as HTMLCanvasElement;
    if (!canvas) continue;
    canvas.width = canvas.parentElement?.clientWidth || 460;
    await renderToCanvas(canvas, getBarData(bars[i]));
    totalHeight += canvas.height;
  }

  OBR.action.setHeight(Math.max(MIN_PLAYER_HEIGHT, totalHeight));
}

// ── GM popover ─────────────────────────────────────────────────────────────

let selectedId: string | null = null;

async function mountGMUI(app: HTMLElement, bars: Item[]): Promise<void> {
  if (selectedId && !bars.find(b => b.id === selectedId)) selectedId = null;
  if (!selectedId && bars.length > 0) selectedId = bars[0].id;

  const selected = selectedId ? (bars.find(b => b.id === selectedId) ?? null) : null;
  const data     = selected ? getBarData(selected) : null;

  app.innerHTML = `
    <div class="gm-root">

      <div class="bar-list">
        ${bars.map(b => {
          const d       = getBarData(b);
          const pct     = d.maxHP > 0 ? Math.round(d.currentHP / d.maxHP * 100) : 0;
          const visible = b.visible !== false;
          return `
            <div class="bar-list-item${b.id === selectedId ? " active" : ""}${!visible ? " bar-hidden" : ""}" data-id="${b.id}">
              <span class="bar-list-name">${escapeHtml(d.bossName)}</span>
              <span class="bar-list-hp">${pct}%</span>
              <button class="btn-icon btn-visibility${!visible ? " is-hidden" : ""}" data-id="${b.id}" title="${visible ? "Hide from players" : "Show to players"}">${visible ? EYE_OPEN : EYE_SLASH}</button>
              <button class="btn-icon btn-delete" data-id="${b.id}" title="Delete">&#10005;</button>
            </div>`;
        }).join("")}
        <button class="btn-add" id="btn-add">+ Add Boss Bar</button>
      </div>

      ${selected && data ? `
      <div class="editor" id="editor">

        <div class="preview-wrap">
          <canvas id="preview-canvas"></canvas>
        </div>

        <div class="section">
          <div class="control-row">
            <label for="boss-name">Boss Name</label>
            <input type="text" id="boss-name" value="${escapeHtml(data.bossName)}" maxlength="60" />
          </div>
          <div class="control-row">
            <label for="game-style">Game Style</label>
            <select id="game-style">
              <option value="ds1"       ${data.gameStyle === "ds1"       ? "selected" : ""}>Dark Souls</option>
              <option value="ds2"       ${data.gameStyle === "ds2"       ? "selected" : ""}>Dark Souls II</option>
              <option value="ds3"       ${data.gameStyle === "ds3"       ? "selected" : ""}>Dark Souls III</option>
              <option value="eldenring" ${data.gameStyle === "eldenring" ? "selected" : ""}>Elden Ring</option>
            </select>
          </div>
          <div class="control-row">
            <label for="bar-scale">Bar Size — <span id="scale-display">${(data.scale ?? 1).toFixed(2)}×</span></label>
            <input type="range" id="bar-scale" min="0.25" max="4" step="0.25" value="${data.scale ?? 1}" />
          </div>
        </div>

        <div class="section">
          <div class="control-row two-col">
            <div>
              <label for="current-hp">Current HP</label>
              <input type="number" id="current-hp" value="${data.currentHP}" min="0" max="9999999" />
            </div>
            <div>
              <label for="max-hp">Max HP</label>
              <input type="number" id="max-hp" value="${data.maxHP}" min="1" max="9999999" />
            </div>
          </div>
          <button class="btn-primary" id="btn-update">Update HP &amp; Name</button>
        </div>

        <div class="section">
          <label class="section-label">Damage / Heal</label>
          <div class="dmg-row">
            <button class="btn-dmg btn-damage" id="btn-damage">− Damage</button>
            <input type="number" id="dmg-amount" value="10" min="1" max="9999999" />
            <button class="btn-dmg btn-heal" id="btn-heal">+ Heal</button>
          </div>
        </div>

      </div>
      ` : `
      <div class="empty-state">
        <span>No boss bars yet.</span>
        <span>Click <strong>+ Add Boss Bar</strong> above.</span>
      </div>`}

    </div>
  `;

  // ── List interactions ──────────────────────────────────────────────────

  app.querySelectorAll<HTMLElement>(".bar-list-item").forEach(el => {
    el.addEventListener("click", e => {
      if ((e.target as HTMLElement).closest(".btn-delete")) return;
      if ((e.target as HTMLElement).closest(".btn-visibility")) return;
      selectedId = el.dataset.id ?? null;
      OBR.scene.items.getItems<Item>(isBossBar).then(items => mountGMUI(app, items));
    });
  });

  app.querySelectorAll<HTMLButtonElement>(".btn-visibility").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id      = btn.dataset.id!;
      const makeVisible = btn.classList.contains("is-hidden");
      await toggleBarVisibility(id, makeVisible);
    });
  });

  app.querySelectorAll<HTMLButtonElement>(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id!;
      if (selectedId === id) selectedId = null;
      const attachments = await OBR.scene.items.getItemAttachments([id]);
      await OBR.scene.items.deleteItems([id, ...attachments.map(a => a.id)]);
    });
  });

  const btnAdd = document.getElementById("btn-add") as HTMLButtonElement;
  btnAdd.addEventListener("click", async () => {
    btnAdd.disabled = true;
    btnAdd.textContent = "Creating…";
    try {
      selectedId = await createMapBar({ ...DEFAULT_DATA });
    } catch (err) {
      console.error("[Dark Souls Utility] createMapBar failed:", err);
      btnAdd.disabled = false;
      btnAdd.textContent = "+ Add Boss Bar";
    }
  });

  if (!selected || !data) return;

  // ── Preview canvas ─────────────────────────────────────────────────────

  const canvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
  const wrap   = canvas.parentElement!;
  canvas.width = wrap.clientWidth || 460;
  await renderToCanvas(canvas, data);

  let draft: BossBarData = { ...data };

  const refreshPreview = async () => {
    canvas.width = wrap.clientWidth || 460;
    await renderToCanvas(canvas, draft);
  };

  // ── Canvas preview animation + damage overlay ─────────────────────────
  let previewDisplayedHP = data.currentHP;
  let previewAnimTimer: ReturnType<typeof setInterval> | null = null;
  let damageOverlay: DamageOverlay | null = null;
  let damageHoldTimer: ReturnType<typeof setTimeout> | null = null;
  let damageFadeTimer: ReturnType<typeof setInterval> | null = null;

  function clearDamageOverlay(): void {
    if (damageHoldTimer) { clearTimeout(damageHoldTimer); damageHoldTimer = null; }
    if (damageFadeTimer) { clearInterval(damageFadeTimer); damageFadeTimer = null; }
    damageOverlay = null;
  }

  function scheduleDamageOverlayFade(): void {
    if (damageHoldTimer) clearTimeout(damageHoldTimer);
    if (damageFadeTimer) clearInterval(damageFadeTimer);
    damageHoldTimer = setTimeout(() => {
      damageHoldTimer = null;
      const FADE_STEPS = 10;
      let fadeStep = 0;
      damageFadeTimer = setInterval(() => {
        fadeStep++;
        if (damageOverlay) damageOverlay = { ...damageOverlay, alpha: 1 - fadeStep / FADE_STEPS };
        canvas.width = wrap.clientWidth || 460;
        renderToCanvas(canvas, draft, damageOverlay ?? undefined);
        if (fadeStep >= FADE_STEPS) {
          clearInterval(damageFadeTimer!);
          damageFadeTimer = null;
          damageOverlay = null;
        }
      }, 50); // 10 steps × 50 ms = 500 ms fade
    }, 4500); // 4.5 s hold before fade begins
  }

  function animatePreviewTo(targetHP: number): void {
    const prevHP = previewDisplayedHP;
    const isDamage = targetHP < prevHP && draft.maxHP > 0;

    if (isDamage) {
      // Accumulate damage: if an overlay is already showing, extend its prevRatio
      // to the larger of the two (so rapid clicks don't shrink the yellow zone).
      const newPrevRatio = prevHP / draft.maxHP;
      const existingPrevRatio = damageOverlay?.prevRatio ?? 0;
      damageOverlay = {
        prevRatio: Math.max(newPrevRatio, existingPrevRatio),
        damageAmount: (damageOverlay?.damageAmount ?? 0) + (prevHP - targetHP),
        alpha: 1.0,
      };
      scheduleDamageOverlayFade();
    } else {
      clearDamageOverlay();
    }

    if (previewAnimTimer) clearInterval(previewAnimTimer);
    const fromHP = prevHP;
    let step = 0;
    previewAnimTimer = setInterval(async () => {
      step++;
      const eased = 1 - (1 - step / 8) ** 2;
      previewDisplayedHP = fromHP + (targetHP - fromHP) * eased;
      canvas.width = wrap.clientWidth || 460;
      await renderToCanvas(canvas, { ...draft, currentHP: previewDisplayedHP }, damageOverlay ?? undefined);
      if (step >= 8) {
        clearInterval(previewAnimTimer!);
        previewAnimTimer = null;
        previewDisplayedHP = targetHP;
      }
    }, 75);
  }

  // ── Controls ───────────────────────────────────────────────────────────

  const nameEl    = document.getElementById("boss-name")   as HTMLInputElement;
  const styleEl   = document.getElementById("game-style")  as HTMLSelectElement;
  const scaleEl   = document.getElementById("bar-scale")   as HTMLInputElement;
  const scaleDisp = document.getElementById("scale-display") as HTMLSpanElement;
  const curHPEl   = document.getElementById("current-hp")  as HTMLInputElement;
  const maxHPEl   = document.getElementById("max-hp")      as HTMLInputElement;
  const dmgEl     = document.getElementById("dmg-amount")  as HTMLInputElement;

  nameEl.addEventListener("input", () => {
    draft = { ...draft, bossName: nameEl.value.trim() || "Boss" };
    refreshPreview();
  });

  styleEl.addEventListener("change", async () => {
    draft = { ...draft, gameStyle: styleEl.value as BossBarData["gameStyle"] };
    clearDamageOverlay();
    await refreshPreview();
    await updateMapBar(selected.id, draft);
  });

  scaleEl.addEventListener("input", () => {
    const s = parseFloat(scaleEl.value) || 1;
    scaleDisp.textContent = `${s.toFixed(2)}×`;
    draft = { ...draft, scale: s };
    clearDamageOverlay();
    refreshPreview();
  });

  scaleEl.addEventListener("change", async () => {
    await updateMapBar(selected.id, draft);
  });

  curHPEl.addEventListener("input", () => {
    draft = { ...draft, currentHP: Math.max(0, parseInt(curHPEl.value) || 0) };
    refreshPreview();
  });

  maxHPEl.addEventListener("input", () => {
    draft = { ...draft, maxHP: Math.max(1, parseInt(maxHPEl.value) || 1) };
    refreshPreview();
  });

  document.getElementById("btn-update")!.addEventListener("click", async () => {
    const newHP = Math.max(0, parseInt(curHPEl.value) || 0);
    draft = {
      ...draft,
      bossName:  nameEl.value.trim() || "Boss",
      currentHP: newHP,
      maxHP:     Math.max(1, parseInt(maxHPEl.value) || 1),
    };
    animatePreviewTo(newHP);
    await updateMapBar(selected.id, draft);
  });

  const applyDelta = async (sign: 1 | -1) => {
    const amount = Math.max(0, parseInt(dmgEl.value) || 0);
    const newHP  = Math.max(0, Math.min(draft.maxHP, draft.currentHP + sign * amount));
    draft        = { ...draft, currentHP: newHP };
    curHPEl.value = String(newHP);
    animatePreviewTo(newHP);
    await updateMapBar(selected.id, draft);
  };

  document.getElementById("btn-damage")!.addEventListener("click", () => applyDelta(-1));
  document.getElementById("btn-heal")!  .addEventListener("click", () => applyDelta(+1));
}

// ── Entry point ────────────────────────────────────────────────────────────

OBR.onReady(async () => {
  const app  = document.querySelector<HTMLDivElement>("#app")!;

  // Apply OBR dark/light theme to the document so CSS variables switch.
  const applyTheme = (mode: "DARK" | "LIGHT") => {
    document.body.dataset.theme = mode === "LIGHT" ? "light" : "dark";
  };
  try {
    applyTheme((await OBR.theme.getTheme()).mode);
  } catch {
    applyTheme("DARK");
  }
  OBR.theme.onChange(t => applyTheme(t.mode));

  const role = await OBR.player.getRole();

  // Track the items-change subscription so it can be torn down when the
  // scene closes (onReadyChange fires false) and re-established on reopen.
  let unsubItems: (() => void) | null = null;

  const handleReadyChange = async (ready: boolean) => {
    unsubItems?.();
    unsubItems = null;

    if (!ready) {
      app.innerHTML = `
        <div class="no-scene">
          <span>No scene is open.</span>
          <span>Open or load a scene to use boss bars.</span>
        </div>`;
      // Player popovers are dynamically sized; collapse to a compact height.
      if (role !== "GM") OBR.action.setHeight(100);
      return;
    }

    const bars = await OBR.scene.items.getItems<Item>(isBossBar);
    if (role === "GM") {
      await mountGMUI(app, bars);
      let latestGMItems: Item[] = [];
      let gmRebuildTimer: ReturnType<typeof setTimeout> | null = null;
      unsubItems = OBR.scene.items.onChange((items: Item[]) => {
        latestGMItems = items;
        if (gmRebuildTimer) clearTimeout(gmRebuildTimer);
        gmRebuildTimer = setTimeout(() => {
          gmRebuildTimer = null;
          mountGMUI(app, latestGMItems.filter(isBossBar));
        }, 750);
      });
    } else {
      await mountPlayerUI(app, bars.filter(b => b.visible !== false));
      let latestPlayerItems: Item[] = [];
      let playerRebuildTimer: ReturnType<typeof setTimeout> | null = null;
      unsubItems = OBR.scene.items.onChange((items: Item[]) => {
        latestPlayerItems = items;
        if (playerRebuildTimer) clearTimeout(playerRebuildTimer);
        playerRebuildTimer = setTimeout(() => {
          playerRebuildTimer = null;
          mountPlayerUI(app, latestPlayerItems.filter(isBossBar).filter(b => b.visible !== false));
        }, 750);
      });
    }
  };

  // Wire up ready-state listener before the initial check to avoid a race
  // where the scene changes between the isReady call and onReadyChange.
  OBR.scene.onReadyChange(handleReadyChange);
  await handleReadyChange(await OBR.scene.isReady());
});
