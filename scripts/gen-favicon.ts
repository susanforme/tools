#!/usr/bin/env bun
/**
 * 将 favicon.svg 转换为 favicon.ico（包含 16x16、32x32、48x48）
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const svgPath = join(ROOT, 'public', 'favicon.svg')
const icoPath = join(ROOT, 'public', 'favicon.ico')

// ---------------------------------------------------------------------------
// 用 sharp 把 SVG 渲染为各尺寸 PNG Buffer
// ---------------------------------------------------------------------------
let sharp: typeof import('sharp')
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('请先安装 sharp：bun add -d sharp')
  process.exit(1)
}

const svgBuffer = readFileSync(svgPath)

async function svgToPng(size: number): Promise<Buffer> {
  return sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toBuffer()
}

const sizes = [16, 32, 48]
const pngs = await Promise.all(sizes.map(svgToPng))

// ---------------------------------------------------------------------------
// 手工构造 ICO 文件
// ICO 格式: ICONDIR(6) + N×ICONDIRENTRY(16) + N×PNG-data
// ---------------------------------------------------------------------------
function buildIco(images: { size: number; data: Buffer }[]): Buffer {
  const count = images.length
  const headerSize = 6 + count * 16 // ICONDIR + ICONDIRENTRYs
  const offsets: number[] = []
  let offset = headerSize
  for (const img of images) {
    offsets.push(offset)
    offset += img.data.length
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)     // reserved
  header.writeUInt16LE(1, 2)     // type = 1 (icon)
  header.writeUInt16LE(count, 4) // image count

  const entries = images.map((img, i) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0) // width (0 = 256)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1) // height
    entry.writeUInt8(0, 2)   // color palette
    entry.writeUInt8(0, 3)   // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(img.data.length, 8)  // size of image data
    entry.writeUInt32LE(offsets[i], 12)       // offset of image data
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
}

const icoBuffer = buildIco(sizes.map((size, i) => ({ size, data: pngs[i] })))
writeFileSync(icoPath, icoBuffer)

console.log(`✅ favicon.ico 已生成：${icoPath}`)
console.log(`   包含尺寸：${sizes.join(', ')} px`)
