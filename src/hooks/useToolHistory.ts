import type { HistoryRecord } from '@/lib/db';
import { blobToText, db, MIME, textToBlob } from '@/lib/db';
import { useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

// ─── 类型 ──────────────────────────────────────────────────────────────────

export interface AddHistoryOptions {
  /** 输入内容：文本直接传 string，二进制传 Blob */
  input: string | Blob;
  /** 输出内容：文本直接传 string，二进制传 Blob */
  output: string | Blob;
  /** 输入 MIME 类型，文本工具可省略（默认 text/plain） */
  inputType?: string;
  /** 输出 MIME 类型，文本工具可省略（默认 text/plain） */
  outputType?: string;
  /** 列表摘要，可选；文本工具建议传输入前 60 字符 */
  label?: string;
}

/** 历史记录条目，附带解析后的文本内容（仅文本类型时有值） */
export interface HistoryItem extends HistoryRecord {
  inputText?: string;
  outputText?: string;
}

// ─── 每工具最多保留条数 ────────────────────────────────────────────────────
const MAX_HISTORY_PER_TOOL = 50;

// ─── 辅助 ─────────────────────────────────────────────────────────────────

/** 将 string | Blob 标准化为 Blob */
function normalizeBlob(value: string | Blob, mime: string): Blob {
  if (value instanceof Blob) return value;
  return textToBlob(value, mime);
}

/** 从路由 pathname 中提取工具名，如 '/json' → 'json' */
function pathnameToTool(pathname: string): string {
  return pathname.replace(/^\//, '').split('/')[0] || 'root';
}

/** 判断 MIME 是否为文本类型 */
function isTextMime(mime: string): boolean {
  return (
    mime === MIME.TEXT ||
    mime === MIME.JSON ||
    mime === MIME.HTML ||
    mime === MIME.CSS ||
    mime === MIME.JS
  );
}

// ─── 核心操作函数（不依赖 React，可在按钮回调中直接 await） ────────────────

/**
 * 添加一条历史记录，并自动清理超出上限的最旧记录
 * @param tool    路由名，如 'json'
 * @param params  URL query 状态快照（直接传 s.location.search 对象）
 * @param opts    输入输出内容及元信息
 */
export async function addHistory(
  tool: string,
  params: Record<string, unknown>,
  opts: AddHistoryOptions,
): Promise<void> {
  const inputType = opts.inputType ?? MIME.TEXT;
  const outputType = opts.outputType ?? MIME.TEXT;

  const record: HistoryRecord = {
    tool,
    input: normalizeBlob(opts.input, inputType),
    output: normalizeBlob(opts.output, outputType),
    inputType,
    outputType,
    params: JSON.stringify(params),
    label: opts.label,
    createdAt: Date.now(),
  };

  await db.history.add(record);

  // 清理超出上限的最旧记录
  const count = await db.history.where('tool').equals(tool).count();
  if (count > MAX_HISTORY_PER_TOOL) {
    const overflow = count - MAX_HISTORY_PER_TOOL;
    const oldest = await db.history
      .where('tool')
      .equals(tool)
      .sortBy('createdAt');
    const toDelete = oldest.slice(0, overflow).map((r) => r.id!);
    await db.history.bulkDelete(toDelete);
  }
}

/**
 * 获取某工具的历史记录（按时间倒序）
 * @param tool   路由名
 * @param limit  最多返回条数，默认 20
 */
export async function getHistory(
  tool: string,
  limit = 20,
): Promise<HistoryRecord[]> {
  const records = await db.history
    .where('tool')
    .equals(tool)
    .reverse()
    .sortBy('createdAt');
  return records.slice(0, limit);
}

/** 删除单条历史记录 */
export async function deleteHistory(id: number): Promise<void> {
  await db.history.delete(id);
}

/** 清空某工具的全部历史记录 */
export async function clearHistory(tool: string): Promise<void> {
  await db.history.where('tool').equals(tool).delete();
}

// ─── React Hook ────────────────────────────────────────────────────────────

/**
 * 在组件中使用历史记录，自动从路由状态获取当前工具名和 query 参数快照。
 *
 * - `add(opts)` 写入一条历史，tool 和 params 自动注入，无需手动传入
 * - `history` 列表按时间倒序，文本类型附带 inputText / outputText
 * - `remove(id)` 删除单条，`clear()` 清空当前工具所有记录
 *
 * @example
 * const { history, add, remove, clear } = useToolHistory();
 *
 * // 点击处理按钮时
 * await add({ input, output, label: input.slice(0, 60) });
 *
 * // 图片工具
 * await add({ input: file, output: blob, inputType: MIME.PNG, outputType: MIME.WEBP, label: file.name });
 */
export function useToolHistory(limit = 20) {
  // 从路由状态自动获取工具名和当前 query 参数
  const tool = useRouterState({
    select: (s) => pathnameToTool(s.location.pathname),
  });
  const params = useRouterState({
    select: (s) => s.location.search as Record<string, unknown>,
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const records = await getHistory(tool, limit);
      // 对文本类型异步解析出 inputText / outputText，方便列表直接展示
      const items = await Promise.all(
        records.map(async (r) => ({
          ...r,
          inputText: isTextMime(r.inputType)
            ? await blobToText(r.input)
            : undefined,
          outputText: isTextMime(r.outputType)
            ? await blobToText(r.output)
            : undefined,
        })),
      );
      setHistory(items);
    } finally {
      setLoading(false);
    }
  }, [tool, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** 添加一条历史记录，tool 和 params 自动注入 */
  const add = useCallback(
    async (opts: AddHistoryOptions) => {
      await addHistory(tool, params, opts);
      await refresh();
    },
    [tool, params, refresh],
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteHistory(id);
      await refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    await clearHistory(tool);
    await refresh();
  }, [tool, refresh]);

  return { history, loading, tool, add, refresh, remove, clear };
}
