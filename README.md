# Dark Souls Utility — Owlbear Rodeo Extension

An [Owlbear Rodeo](https://www.owlbear.rodeo) extension that lets a GM display an authentic-looking boss health bar on the shared map — styled after *Dark Souls*, *Dark Souls II*, *Dark Souls III*, and *Elden Ring*.

---

## Features

- **Authentic art** — each game style uses the real UI frame PNG, scaled and composited on the map in real time.
- **Live HP tracking** — apply damage or healing in one click; the bar on the map updates instantly for all players.
- **Multiple bars** — run several boss fights simultaneously; each bar is an independent scene object.
- **GM-only controls** — players see only the bars (or nothing, if the GM hides one); the editor popover is GM-exclusive.
- **Scalable** — resize any bar from 0.25× to 4× with a slider.
- **Show / hide per bar** — toggle individual bars invisible to players without deleting them.

---

## Game Styles

| Key | Game |
|---|---|
| `ds1` | Dark Souls |
| `ds2` | Dark Souls II |
| `ds3` | Dark Souls III |
| `eldenring` | Elden Ring |

---

## How It Works

Each boss bar is **four OBR scene items** placed on the map layer:

```
bg (RECTANGLE)       ← drag handle; stores all bar data in item metadata
 ├── __hp_fill       ← red HP fill; width scales with currentHP / maxHP
 ├── __frame         ← authentic PNG overlay, centred on the bar
 └── __name          ← boss name text, positioned above the frame
```

The GM's popover also renders a **Canvas 2D preview** of the bar so edits are reflected before the map is committed.

---

## GM Workflow

1. Open the **Boss Health Bar** action from the Owlbear toolbar.
2. Click **+ Add Boss Bar** — a bar appears at the centre of your current viewport.
3. Set the boss name, choose a game style, and adjust the bar size with the slider.
4. Enter the boss's max HP, then click **Update HP & Name**.
5. During the fight, use the **− Damage / + Heal** buttons (or edit Current HP directly) to update the bar in real time.
6. Use the eye icon in the bar list to show or hide individual bars from players.
7. Click **×** to delete a bar when the fight is over.

---

## Development

### Prerequisites

- Node.js 18+
- An Owlbear Rodeo account (free) with a scene open

### Setup

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` with CORS configured for `https://www.owlbear.rodeo`.

To load the extension in Owlbear Rodeo, go to **Settings → Extensions → Add** and enter `http://localhost:5173/manifest.json`.

### Build

```bash
npm run build
```

Output is in `dist/`. Host the folder at any static URL, then register that URL as the extension manifest in Owlbear Rodeo.

### Asset Source

PNG frames are fetched from GitHub raw URLs during development (`ASSET_SOURCE = "github"` in `src/assetBase.ts`). Switch to `"server"` for production so assets are served from the same origin as the extension.

---

## Project Structure

```
src/
  types.ts        — BossBarData type and GameStyle union
  assetBase.ts    — resolves PNG URLs for dev vs. production
  renderer.ts     — Canvas 2D preview (one drawXxx per style)
  mapItems.ts     — OBR scene item creation / update; per-style LAYOUTS config
  main.ts         — popover UI: GM editor + player view
  style.css       — popover styles (does not affect the map)
public/
  manifest.json   — Owlbear extension manifest
  assets/         — PNG frames (used in server mode)
```

---

## Adding a New Game Style

1. Add the key to `GameStyle` in `src/types.ts`.
2. Add a `StyleLayout` entry to `LAYOUTS` in `src/mapItems.ts`.
3. Add a `drawXxx(ctx, canvas, data)` function in `src/renderer.ts` and wire it in `renderToCanvas`.
4. Place PNG assets under `public/assets/<style>/` and add the matching GitHub path to `assetBase.ts`.
5. Add a `<option>` for the style in the GM editor select in `src/main.ts`.

---

## Tech Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [Owlbear Rodeo SDK](https://docs.owlbear.rodeo/extensions) v3
