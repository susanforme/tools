import Dexie, { type Table } from 'dexie';

// ─── 类型定义 ──────────────────────────────────────────────────────────────

/**
 * 操作历史记录
 * input/output 统一用 Blob 存储：
 *   - 文本：new Blob([text], { type: 'text/plain' })
 *   - 图片：canvas.toBlob() / File 对象
 *   - 其他二进制：原始 Blob / ArrayBuffer 转 Blob
 */
export interface HistoryRecord {
  id?: number;
  /** 路由名，如 'json'、'image'、'base64' */
  tool: string;
  /** 用户输入内容 */
  input: Blob;
  /** 处理结果 */
  output: Blob;
  /** 输入 MIME 类型，如 'text/plain'、'image/png' */
  inputType: string;
  /** 输出 MIME 类型 */
  outputType: string;
  /** URL query 状态快照，JSON 字符串，如 '{"tab":"minify"}' */
  params: string;
  /** 列表摘要：文本工具取前 30 字符，图片工具取文件名 */
  label?: string;
  /** 创建时间戳，Date.now() */
  createdAt: number;
}

/**
 * 工具页面偏好配置
 * 以 tool 为主键，每个工具只有一条记录，写入时自动 upsert
 */
export interface Preference {
  /** 路由名，主键 */
  tool: string;
  /** 任意结构的 JSON 字符串，由各工具自行定义 */
  data: string;
  updatedAt: number;
}

// ─── 数据库 ────────────────────────────────────────────────────────────────

class AppDB extends Dexie {
  history!: Table<HistoryRecord>;
  preferences!: Table<Preference>;

  constructor() {
    super('tools-app');
    this.version(1).stores({
      // history: 自增主键，按 tool + createdAt 索引以支持分页查询
      history: '++id, tool, createdAt',
      // preferences: tool 即主键，天然 upsert 语义
      preferences: 'tool',
    });
  }
}

export const db = new AppDB();

// ─── MIME 类型常量 ─────────────────────────────────────────────────────────

/** 常用 MIME 类型，避免各工具硬编码字符串 */
export const MIME = {
  TEXT: 'text/plain',
  JSON: 'application/json',
  HTML: 'text/html',
  CSS: 'text/css',
  JS: 'application/javascript',
  SVG: 'image/svg+xml',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  AVIF: 'image/avif',
  GIF: 'image/gif',
  BINARY: 'application/octet-stream',
} as const;

export type MimeType = (typeof MIME)[keyof typeof MIME];

// ─── Blob 工具函数 ─────────────────────────────────────────────────────────

/** 将文本内容包装为 Blob */
export function textToBlob(text: string, mime: string = MIME.TEXT): Blob {
  return new Blob([text], { type: mime });
}

/** 从 Blob 读取文本内容 */
export async function blobToText(blob: Blob): Promise<string> {
  return blob.text();
}

/** 从 Blob 创建可用于 <img src> 或下载的临时 URL（用完记得 revokeObjectURL） */
export function blobToObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * 生成历史记录的文本摘要
 * - 文本内容：截取前 60 个字符
 * - 二进制/图片：返回 MIME 类型 + 文件大小描述
 */
export function makeLabel(blob: Blob, mime: string): string {
  if (
    mime === MIME.TEXT ||
    mime === MIME.JSON ||
    mime === MIME.HTML ||
    mime === MIME.CSS ||
    mime === MIME.JS
  ) {
    // 文本类型在调用方通过 blob.text() 异步获取后传入，此处兜底返回大小
    return `${(blob.size / 1024).toFixed(1)} KB`;
  }
  const sizeStr =
    blob.size < 1024
      ? `${blob.size} B`
      : blob.size < 1024 * 1024
        ? `${(blob.size / 1024).toFixed(1)} KB`
        : `${(blob.size / 1024 / 1024).toFixed(2)} MB`;
  return `${mime} · ${sizeStr}`;
}
