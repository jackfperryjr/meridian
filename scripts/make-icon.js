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
  const W = 512
  const CX = 256, CY = 256, R = 240

  // Crystal hex points — SVG coords scaled 2×
  const crystal = [
    { x: 256, y:  88 }, { x: 344, y: 192 }, { x: 344, y: 356 },
    { x: 256, y: 448 }, { x: 168, y: 356 }, { x: 168, y: 192 }
  ]

  const img = new Jimp(W, W, 0x00000000)

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2)
      if (d > R + 1) continue

      // Outer border ring — bright white-blue
      if (d >= R - 6 && d <= R + 1) {
        const alpha = d > R ? Math.round(255 * (R + 1 - d)) : 255
        img.setPixelColor(px(192, 208, 255, alpha), x, y)
        continue
      }
      // Inner separation ring — dark navy
      if (d >= R - 14 && d < R - 6) {
        img.setPixelColor(px(14, 26, 56), x, y)
        continue
      }

      // Background fill — deep navy
      img.setPixelColor(px(4, 8, 15), x, y)

      if (!pointInPoly(x, y, crystal)) continue

      // Crystal faces — shade by quadrant
      const midX = 256, topY = 88, midY = 280
      const inTopFace = y < midY && Math.abs(x - midX) < ((y - topY) / (midY - topY)) * 88 + 40

      if (y < 192) {
        // Tip → shoulder: bright top-face
        const t = (y - 88) / 104
        img.setPixelColor(px(lerp(184, 80, t), lerp(220, 130, t), 255), x, y)
      } else if (inTopFace) {
        // Upper diamond face
        const t = (y - 192) / (midY - 192)
        img.setPixelColor(px(lerp(60, 18, t), lerp(152, 68, t), lerp(232, 180, t)), x, y)
      } else if (x < midX && y < midY) {
        img.setPixelColor(px(12, 38, 90), x, y)
      } else if (x >= midX && y < midY) {
        img.setPixelColor(px(18, 58, 148), x, y)
      } else if (x < midX) {
        img.setPixelColor(px(8, 26, 72), x, y)
      } else {
        img.setPixelColor(px(12, 38, 104), x, y)
      }

      // Specular highlight — top-left of crystal
      const hx = x - 216, hy = y - 164
      const hDist = Math.sqrt(hx * hx * 0.4 + hy * hy)
      if (hDist < 24) {
        const t = 1 - hDist / 24
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
  const sparkle = [[256,60],[242,72],[270,72],[228,84],[284,84],[256,48]]
  for (const [sx, sy] of sparkle) {
    const d2 = Math.sqrt((sx - CX) ** 2 + (sy - CY) ** 2)
    if (d2 < R) img.setPixelColor(px(210, 232, 255), sx, sy)
  }

  const out = path.join(__dirname, '..', 'resources', 'icon.png')
  await img.writeAsync(out)
  console.log('Written:', out)
}

main().catch(err => { console.error(err); process.exit(1) })
