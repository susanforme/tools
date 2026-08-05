import type { HistoryItem } from '@/hooks/useToolHistory';
import { useToolHistory } from '@/hooks/useToolHistory';
import { blobToObjectURL, MIME } from '@/lib/db';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  ImageIcon,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

// ─── 辅助函数 ──────────────────────────────────────────────────────────────

/** 判断 MIME 是否为图片类型 */
function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

/** 将时间戳转为时间差数据，供 t() 插值使用 */
function getRelativeTimeParts(ts: number): {
  key: string;
  options?: Record<string, number>;
} {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (diff < 60000) return { key: 'history.timeJustNow' };
  if (minutes < 60)
    return { key: 'history.timeMinutesAgo', options: { count: minutes } };
  if (hours < 24)
    return { key: 'history.timeHoursAgo', options: { count: hours } };
  if (days === 1) return { key: 'history.timeYesterday' };
  return { key: 'history.timeDaysAgo', options: { count: days } };
}

/** 截取文本摘要，超出显示省略号 */
function truncate(text: string, max = 80): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > max ? single.slice(0, max) + '…' : single;
}

/** 获取 MIME 类型的友好标签 */
function mimeLabel(mime: string): string {
  const map: Record<string, string> = {
    [MIME.TEXT]: 'TXT',
    [MIME.JSON]: 'JSON',
    [MIME.HTML]: 'HTML',
    [MIME.CSS]: 'CSS',
    [MIME.JS]: 'JS',
    [MIME.SVG]: 'SVG',
    [MIME.PNG]: 'PNG',
    [MIME.JPEG]: 'JPEG',
    [MIME.WEBP]: 'WEBP',
    [MIME.AVIF]: 'AVIF',
    [MIME.GIF]: 'GIF',
  };
  return map[mime] ?? mime.split('/')[1]?.toUpperCase() ?? '?';
}

// ─── 子组件：图片预览单元格 ────────────────────────────────────────────────

function ImageThumb({
  blob,
  alt,
  onClick,
}: {
  blob: Blob;
  alt: string;
  onClick: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = blobToObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!url) return null;
  return (
    <button
      type="button"
      onClick={() => onClick(url)}
      className="rounded overflow-hidden border border-border w-16 h-16 flex-shrink-0 hover:opacity-80 transition-opacity"
    >
      <img src={url} alt={alt} className="w-full h-full object-cover" />
    </button>
  );
}

// ─── 子组件：单条历史记录 ──────────────────────────────────────────────────

function HistoryRow({
  item,
  onRestore,
  onDelete,
  onPreviewImage,
}: {
  item: HistoryItem;
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: number) => void;
  onPreviewImage: (url: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'input' | 'output' | null>(null);
  const [expanded, setExpanded] = useState(false);

  const relTime = getRelativeTimeParts(item.createdAt);

  const params = (() => {
    try {
      return JSON.parse(item.params) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const paramEntries = Object.entries(params).filter(
    ([, v]) => v != null && v !== '',
  );

  const handleCopy = useCallback(
    async (which: 'input' | 'output') => {
      const text = which === 'input' ? item.inputText : item.outputText;
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    },
    [item.inputText, item.outputText],
  );

  return (
    <div className="group rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors px-3 py-2.5 space-y-2">
      {/* 头部：时间 + params badge + 操作按钮 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] text-muted-foreground flex-shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {t(relTime.key, relTime.options)}
        </span>

        {/* params 快照 badge */}
        {paramEntries.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {paramEntries.map(([k, v]) => (
              <Badge
                key={k}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4 font-normal"
              >
                {String(v)}
              </Badge>
            ))}
          </div>
        )}

        {/* label 摘要 */}
        {item.label && (
          <span className="text-[11px] text-muted-foreground truncate min-w-0 flex-1">
            {item.label}
          </span>
        )}

        {/* 操作按钮组（hover 显示） */}
        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onRestore(item)}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('history.restore')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => item.id != null && onDelete(item.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('history.delete')}</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* 收起态：input 文本单行预览 */}
      {!expanded && (
        <div className="flex items-center gap-2 min-w-0">
          {isImageMime(item.inputType) ? (
            <ImageThumb
              blob={item.input}
              alt="input"
              onClick={(url) => onPreviewImage(url, t('history.inputPreview'))}
            />
          ) : (
            <p className="text-xs text-foreground/80 truncate min-w-0 flex-1 font-mono leading-5">
              {item.inputText ? truncate(item.inputText) : '—'}
            </p>
          )}
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 h-4 flex-shrink-0"
          >
            {mimeLabel(item.inputType)}
          </Badge>
        </div>
      )}

      {/* 展开态：input + output 对比 */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* 输入 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground flex items-center gap-1">
                {isImageMime(item.inputType) ? (
                  <ImageIcon className="w-3 h-3" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {t('panel.input')}
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 ml-1"
                >
                  {mimeLabel(item.inputType)}
                </Badge>
              </span>
              {item.inputText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] gap-0.5"
                  onClick={() => handleCopy('input')}
                >
                  {copied === 'input' ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                  {copied === 'input' ? t('panel.copied') : t('panel.copy')}
                </Button>
              )}
            </div>
            {isImageMime(item.inputType) ? (
              <ImageThumb
                blob={item.input}
                alt="input"
                onClick={(url) =>
                  onPreviewImage(url, t('history.inputPreview'))
                }
              />
            ) : (
              <pre className="text-[11px] font-mono leading-relaxed text-foreground/80 bg-muted/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                {item.inputText ?? '—'}
              </pre>
            )}
          </div>

          {/* 输出 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground flex items-center gap-1">
                {isImageMime(item.outputType) ? (
                  <ImageIcon className="w-3 h-3" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {t('panel.output')}
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 ml-1"
                >
                  {mimeLabel(item.outputType)}
                </Badge>
              </span>
              {item.outputText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] gap-0.5"
                  onClick={() => handleCopy('output')}
                >
                  {copied === 'output' ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                  {copied === 'output' ? t('panel.copied') : t('panel.copy')}
                </Button>
              )}
            </div>
            {isImageMime(item.outputType) ? (
              <ImageThumb
                blob={item.output}
                alt="output"
                onClick={(url) =>
                  onPreviewImage(url, t('history.outputPreview'))
                }
              />
            ) : (
              <pre className="text-[11px] font-mono leading-relaxed text-foreground/80 bg-muted/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">
                {item.outputText ?? '—'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface HistoryPanelProps {
  /**
   * 点击"恢复"时的回调，将历史条目的 input/output 回填到工具页面。
   * 文本工具接收 inputText/outputText，二进制工具接收 input/output Blob。
   */
  onRestore: (item: HistoryItem) => void;
  /** 额外 className，用于调整外层容器布局 */
  className?: string;
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

/**
 * 历史记录面板，展示当前工具的操作历史。
 * tool 和 params 自动从路由状态获取，无需手动传入。
 *
 * @example
 * <HistoryPanel onRestore={({ inputText, outputText }) => {
 *   if (inputText) setInput(inputText);
 *   if (outputText) setOutput(outputText);
 * }} />
 */
export function HistoryPanel({ onRestore, className }: HistoryPanelProps) {
  const { t } = useTranslation();
  const { history, loading, clear, remove } = useToolHistory();

  // 图片大图预览
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const [collapsed, setCollapsed] = useState(false);

  /** 恢复并弹出提示 */
  const handleRestore = useCallback(
    (item: HistoryItem) => {
      onRestore(item);
      toast.success(t('history.restoreSuccess'));
    },
    [onRestore, t],
  );

  if (loading && history.length === 0) {
    return null;
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn('space-y-2', className)}>
        {/* 标题栏 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Clock className="w-4 h-4" />
            {t('history.title')}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {history.length}
            </Badge>
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>

          {!collapsed && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={clear}
                  >
                    <X className="w-3 h-3" />
                    {t('history.clearAll')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('history.clearAllTip')}</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* 历史列表 */}
        {!collapsed && (
          <div className="space-y-1.5">
            {history.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onDelete={remove}
                onPreviewImage={(url, title) => setPreviewImage({ url, title })}
              />
            ))}
          </div>
        )}
      </div>

      {/* 图片大图预览 Dialog */}
      <Dialog
        open={previewImage != null}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="w-full h-auto rounded-md object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
