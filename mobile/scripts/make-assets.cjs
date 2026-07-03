// Rasterizes assets/icon.svg into the source PNGs that `capacitor-assets
// generate` consumes, plus the Play Store feature graphic.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ASSETS = path.join(__dirname, "..", "assets");
const BG = "#1e1e1e";
const GLYPH = fs
  .readFileSync(path.join(ASSETS, "icon.svg"), "utf8")
  .match(/<path[\s\S]*?(?=<\/svg>)/)[0];

// Glyph viewBox is 220x120.
function svg(size, glyphWidth, { background = true, width = size } = {}) {
  const h = (glyphWidth * 120) / 220;
  const x = (width - glyphWidth) / 2;
  const y = (size - h) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size}">
      ${background ? `<rect width="${width}" height="${size}" fill="${BG}"/>` : ""}
      <svg x="${x}" y="${y}" width="${glyphWidth}" height="${h}" viewBox="0 0 220 120">${GLYPH}</svg>
    </svg>`,
  );
}

async function main() {
  const out = (name) => path.join(ASSETS, name);
  await sharp(svg(1024, 660)).removeAlpha().png().toFile(out("icon-only.png"));
  await sharp(svg(1024, 520, { background: false })).png().toFile(out("icon-foreground.png"));
  await sharp(svg(1024, 0)).removeAlpha().png().toFile(out("icon-background.png"));
  await sharp(svg(2732, 760)).removeAlpha().png().toFile(out("splash.png"));
  fs.copyFileSync(out("splash.png"), out("splash-dark.png"));
  fs.mkdirSync(out("store"), { recursive: true });
  await sharp(svg(500, 300, { width: 1024 })).removeAlpha().png().toFile(out("store/feature-graphic.png"));
  await sharp(svg(512, 330)).removeAlpha().png().toFile(out("store/play-icon-512.png"));
  console.log("assets written to", ASSETS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
