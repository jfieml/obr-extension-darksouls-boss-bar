---
title: Dark Souls Utility
description: Display an authentic Dark Souls-style boss health bar on the shared map. Supports Dark Souls, Dark Souls II, Dark Souls III, and Elden Ring art styles.
author: Jannis Fieml
image: https://YOUR_HOST/dark-souls-utility/hero.png
icon: https://YOUR_HOST/dark-souls-utility/icon.svg
tags:
  - tool
  - combat
manifest: https://YOUR_HOST/dark-souls-utility/manifest.json
learn-more: https://github.com/jfieml/obr-extension-darksouls-boss-bar
---

# Dark Souls Utility

Bring the atmosphere of FromSoftware's legendary RPGs to your tabletop sessions. **Dark Souls Utility** lets a GM place an authentic-looking boss health bar directly on the Owlbear Rodeo map — visible to all players in real time.

---

## Features

- **Four authentic art styles** — Dark Souls, Dark Souls II, Dark Souls III, and Elden Ring, each using the real game frame artwork.
- **Live HP tracking** — apply damage or healing with one click; the bar updates on every player's screen instantly.
- **Multiple simultaneous bars** — run several boss encounters at once; each bar is an independent scene object that can be moved and resized independently.
- **Show / hide per bar** — toggle a bar invisible to players without deleting it. The GM always sees it semi-transparent.
- **Scalable** — resize any bar from 0.25× to 4× with a slider to fit your map and token scale.
- **Named bars** — each bar displays the boss name above the HP fill, styled to match the chosen game's UI.
- **GM-only controls** — the editor panel is visible only to the GM. Players see only the bars placed on the map.

---

## How to Use

### Adding a Bar

1. Open the **Boss Health Bar** action from the Owlbear toolbar.
2. Click **+ Add Boss Bar** — a bar appears at the centre of your current viewport.
3. Set the boss name and choose a game style from the dropdown.
4. Use the **Bar Size** slider to scale the bar to suit your map.
5. Enter the boss's Max HP value and click **Update HP & Name**.

### Tracking HP During Combat

Use the **− Damage** and **+ Heal** buttons with a damage amount to update the bar live. You can also edit the Current HP field directly and click **Update HP & Name**.

### Managing Multiple Bars

All active bars appear in a list at the top of the panel. Click any entry to select it and edit it. Use the eye icon to show or hide a bar from players, and the **×** button to delete it when the fight ends.

---

## Game Styles

| Style | Game |
|---|---|
| Dark Souls | *Dark Souls* (2011) |
| Dark Souls II | *Dark Souls II* (2014) |
| Dark Souls III | *Dark Souls III* (2016) |
| Elden Ring | *Elden Ring* (2022) |

---

## Credits

Boss health bar frame artwork sourced from the [FromSoftware Image Macro Creator](https://rezuaq.be/new-area/image-creator/) by [Rezuaq](https://github.com/Sibert-Aerts/sibert-aerts.github.io).  
All game assets remain the property of FromSoftware and their respective rights holders. This is a fan-made extension with no commercial intent.

---

## Support

If you run into a bug or have a feature request, please open an issue on [GitHub](https://github.com/YOUR_USERNAME/dark-souls-utility).
