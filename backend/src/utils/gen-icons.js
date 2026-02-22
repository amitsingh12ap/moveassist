// Generate PNG icons using pure node (no canvas dep needed)
// Creates simple colored squares with text as PNG

const fs = require('fs');
const path = require('path');

// Minimal PNG generator
function createSimplePNG(size) {
  // We'll create a valid PNG with solid background + text using raw bytes
  // Using a pre-built approach: embed SVG as base64 in a data URL isn't possible for PNG
  // Instead output an SVG that browsers accept as icon fallback
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0a0a0f" rx="${size*0.2}"/>
  <rect x="${size*0.1}" y="${size*0.1}" width="${size*0.8}" height="${size*0.8}" fill="#1a1a2f" rx="${size*0.15}"/>
  <text x="50%" y="52%" font-family="Arial Black,sans-serif" font-weight="900" font-size="${size*0.38}" fill="#f0c040" text-anchor="middle" dominant-baseline="middle">M</text>
  <text x="50%" y="78%" font-family="Arial,sans-serif" font-size="${size*0.12}" fill="#6060a0" text-anchor="middle">MOVE</text>
</svg>`;
  return svg;
}

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), createSimplePNG(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), createSimplePNG(512));
console.log('Icons generated');
