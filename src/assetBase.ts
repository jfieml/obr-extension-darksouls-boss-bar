// ── Asset source configuration ─────────────────────────────────────────────
//
// Change ASSET_SOURCE to "server" once the extension is hosted at its own URL.
//   "github"  → images from raw.githubusercontent.com (works during development)
//   "server"  → images from the same origin as the extension (production)

type AssetSource = "github" | "server";

const ASSET_SOURCE: AssetSource = "github";

const GITHUB_BASE =
  "https://raw.githubusercontent.com/Sibert-Aerts/sibert-aerts.github.io" +
  "/master/new-area/image-creator/assets";

/**
 * Returns a public HTTPS URL for a bar asset.
 *
 * @param style     GameStyle key  ("ds1" | "ds2" | "ds3" | "eldenring" | "sekiro")
 * @param filename  Local filename with underscores, e.g. "boss_health_bar.png"
 */
export function assetUrl(style: string, filename: string): string {
  if (ASSET_SOURCE === "github") {
    // GitHub uses camelCase "eldenRing" and spaces instead of underscores
    const ghStyle    = style === "eldenring" ? "eldenRing" : style;
    const ghFilename = filename.replace(/_/g, " ");
    return `${GITHUB_BASE}/${ghStyle}/${encodeURIComponent(ghFilename)}`;
  }
  return `${window.location.origin}/assets/${style}/${filename}`;
}
