// From the Windows icon (assets/icon.ico, PNG pictures from 16 to 256 pixels)
// takes assets/icon.png for Linux and puts together assets/icon.icns for macOS.
// Use: node tools/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PNG_SIGNATURE = '89504e47'

/** Each picture in the ICO: its width and its PNG (every one here is a PNG). */
function pngsInIco(ico) {
  const count = ico.readUInt16LE(4)

  return Array.from({ length: count }, (_, index) => {
    const entry = 6 + index * 16
    const size = ico.readUInt32LE(entry + 8)
    const offset = ico.readUInt32LE(entry + 12)
    const png = ico.subarray(offset, offset + size)

    if (png.subarray(0, 4).toString('hex') !== PNG_SIGNATURE) {
      throw new Error(`picture ${index} in the icon is not a PNG`)
    }

    return { width: ico[entry] || 256, png }
  })
}

// The ICNS picture types and their widths in pixels (the @2x ones take a
// picture twice as wide).
const ICNS_TYPES = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
]

function icns(pngs) {
  const byWidth = new Map(pngs.map(({ width, png }) => [width, png]))
  const entries = ICNS_TYPES.filter(([, width]) => byWidth.has(width)).map(([type, width]) => {
    const png = byWidth.get(width)
    const header = Buffer.alloc(8)
    header.write(type, 0, 'ascii')
    header.writeUInt32BE(png.length + 8, 4)

    return Buffer.concat([header, png])
  })
  const body = Buffer.concat(entries)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)

  return Buffer.concat([header, body])
}

const pngs = pngsInIco(readFileSync(join(root, 'assets', 'icon.ico')))
const largest = pngs.reduce((best, item) => (item.width > best.width ? item : best))
writeFileSync(join(root, 'assets', 'icon.png'), largest.png)
writeFileSync(join(root, 'assets', 'icon.icns'), icns(pngs))
process.stdout.write(`assets/icon.png: ${largest.width} pixels; assets/icon.icns: ${pngs.length} sizes\n`)
