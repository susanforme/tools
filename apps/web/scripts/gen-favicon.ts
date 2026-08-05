#!/usr/bin/env bun
/**
 * 将任意 SVG 转换为指定尺寸的图片格式，或打包为 ico。
 * 示例：bun ./test.ts -i ./assets/test.svg -o 216,512.png
 */
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { parseArgs } from 'util';

// ---------------------------------------------------------------------------
// 1. 解析命令行参数
// ---------------------------------------------------------------------------
const { values } = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
    output: { type: 'string', short: 'o' },
  },
  strict: false, // 允许忽略其他未知参数
});

if (!values.input || !values.output) {
  console.error('❌ 参数缺失！');
  console.error('👉 用法示例: bun ./test.ts -i test.svg -o 216,512.png');
  process.exit(1);
}

const inputPath = resolve(values.input as string);
// 解析类似 "216,512.png" 或 "16,32,48.ico"
const match = (values.output as string).match(/^([\d,]+)\.([a-zA-Z0-9]+)$/);

if (!match) {
  console.error('❌ -o 参数格式错误！请使用类似 "16,32.png" 的格式。');
  process.exit(1);
}

const sizes: number[] = match[1].split(',').map(Number);
const format = match[2].toLowerCase();

// 获取输入文件所在的目录和纯文件名
const outDir = dirname(inputPath);
const baseName = basename(inputPath, extname(inputPath));

// ---------------------------------------------------------------------------
// 2. 加载 sharp 并读取输入文件
// ---------------------------------------------------------------------------
let sharp: typeof import('sharp');
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('❌ 请先安装 sharp：bun add -d sharp');
  process.exit(1);
}

let svgBuffer: Buffer;
try {
  svgBuffer = readFileSync(inputPath);
} catch (error) {
  console.error(`❌ 无法读取文件: ${inputPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. 核心转换与生成逻辑
// ---------------------------------------------------------------------------

// 借助 sharp 生成单张指定尺寸与格式的 Buffer
async function generateImage(size: number, fmt: string): Promise<Buffer> {
  // ICO 本身由 PNG 数据构成，因此如果是 ico 格式，sharp 需要输出 png
  const targetFormat = fmt === 'ico' ? 'png' : fmt;
  return sharp(svgBuffer)
    .resize(size, size)
    .toFormat(targetFormat as keyof import('sharp').FormatEnum)
    .toBuffer();
}

// 手工构造 ICO 文件 (保留原始逻辑)
function buildIco(images: { size: number; data: Buffer }[]): Buffer {
  const count = images.length;
  const headerSize = 6 + count * 16;
  const offsets: number[] = [];
  let offset = headerSize;

  for (const img of images) {
    offsets.push(offset);
    offset += img.data.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = images.map((img, i) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(offsets[i], 12);
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// ---------------------------------------------------------------------------
// 4. 执行输出
// ---------------------------------------------------------------------------
try {
  if (format === 'ico') {
    // ICO 模式：生成多个尺寸的 PNG 并打包进一个 ICO
    const pngs = await Promise.all(
      sizes.map((size) => generateImage(size, 'png')),
    );
    const icoBuffer = buildIco(
      sizes.map((size, i) => ({ size, data: pngs[i] })),
    );
    const outPath = join(outDir, `${baseName}.ico`);

    writeFileSync(outPath, icoBuffer);
    console.log(`✅ ${baseName}.ico 已打包生成：${outPath}`);
    console.log(`   包含尺寸：${sizes.join(', ')} px`);
  } else {
    // 普通图片模式：遍历所有尺寸，输出多张独立图片
    await Promise.all(
      sizes.map(async (size) => {
        const buffer = await generateImage(size, format);
        const outPath = join(outDir, `${baseName}-${size}.${format}`);
        writeFileSync(outPath, buffer);
        console.log(`✅ 已生成：${outPath}`);
      }),
    );
  }
} catch (error: any) {
  console.error(`❌ 转换过程中发生错误: ${error.message}`);
  process.exit(1);
}
