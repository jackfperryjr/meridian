// Generates resources/icon.png from the crystal design in the SVG.
// Run with: node scripts/make-icon.js
const Jimp = require('jimp')
const path = require('path')

function px(r, g, b, a = 255) {
  return (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

function pointInPoly(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

async function main() {
  const W = 256
  const CX = 128, CY = 128, R = 120

  // Crystal hex points matching SVG
  const crystal = [
    { x: 128, y: 44 }, { x: 172, y: 96 }, { x: 172, y: 178 },
    { x: 128, y: 224 }, { x: 84, y: 178 }, { x: 84, y: 96 }
  ]

  const img = new Jimp(W, W, 0x00000000)

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2)
      if (d > R + 1) continue

      // Outer border ring — bright white-blue
      if (d >= R - 3 && d <= R + 1) {
        const alpha = d > R ? Math.round(255 * (R + 1 - d)) : 255
        img.setPixelColor(px(192, 208, 255, alpha), x, y)
        continue
      }
      // Inner separation ring — dark navy
      if (d >= R - 7 && d < R - 3) {
        img.setPixelColor(px(14, 26, 56), x, y)
        continue
      }

      // Background fill — deep navy
      img.setPixelColor(px(4, 8, 15), x, y)

      if (!pointInPoly(x, y, crystal)) continue

      // Crystal faces — shade by quadrant
      const midX = 128, topY = 44, midY = 140, botY = 224
      const inTopFace = y < midY && Math.abs(x - midX) < ((y - topY) / (midY - topY)) * 44 + 20

      if (y < 96) {
        // Tip → shoulder: bright top-face, light blue to deep blue
        const t = (y - 44) / 52
        img.setPixelColor(px(lerp(184, 80, t), lerp(220, 130, t), 255), x, y)
      } else if (inTopFace) {
        // Upper diamond face
        const t = (y - 96) / (midY - 96)
        img.setPixelColor(px(lerp(60, 18, t), lerp(152, 68, t), lerp(232, 180, t)), x, y)
      } else if (x < midX && y < midY) {
        img.setPixelColor(px(12, 38, 90), x, y)   // left upper — dark
      } else if (x >= midX && y < midY) {
        img.setPixelColor(px(18, 58, 148), x, y)  // right upper — mid blue
      } else if (x < midX) {
        img.setPixelColor(px(8, 26, 72), x, y)    // left lower — very dark
      } else {
        img.setPixelColor(px(12, 38, 104), x, y)  // right lower — dark blue
      }

      // Specular highlight — top-left of crystal
      const hx = x - 108, hy = y - 82
      const hDist = Math.sqrt(hx * hx * 0.4 + hy * hy) // stretched ellipse
      if (hDist < 12) {
        const t = 1 - hDist / 12
        const s = Math.round(t * t * 220)
        const cur = Jimp.intToRGBA(img.getPixelColor(x, y))
        img.setPixelColor(px(
          Math.min(255, cur.r + s),
          Math.min(255, cur.g + s),
          Math.min(255, cur.b + s)
        ), x, y)
      }
    }
  }

  // Sparkle at crystal tip
  const sparkle = [[128,30],[121,36],[135,36],[114,42],[142,42],[128,24]]
  for (const [sx, sy] of sparkle) {
    const d2 = Math.sqrt((sx - CX) ** 2 + (sy - CY) ** 2)
    if (d2 < R) img.setPixelColor(px(210, 232, 255), sx, sy)
  }

  const out = path.join(__dirname, '..', 'resources', 'icon.png')
  await img.writeAsync(out)
  console.log('Written:', out)
}

main().catch(err => { console.error(err); process.exit(1) })
