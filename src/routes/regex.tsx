import { createFileRoute } from '@tanstack/react-router';
import { Check, ChevronDown, ChevronRight, Copy, Wand2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';

export const Route = createFileRoute('/regex')({ component: RegexPage });

// ─── 常用模式库 ────────────────────────────────────────────────────────────────

interface PatternEntry {
  labelKey: string;
  pattern: string;
  flags: string;
  sampleKey: string;
}

const PATTERN_LIBRARY: PatternEntry[] = [
  {
    labelKey: 'regex.patternEmail',
    pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
    flags: 'g',
    sampleKey: 'regex.sampleEmail',
  },
  {
    labelKey: 'regex.patternPhone',
    pattern: '1[3-9]\\d{9}',
    flags: 'g',
    sampleKey: 'regex.samplePhone',
  },
  {
    labelKey: 'regex.patternIPv4',
    pattern:
      '(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)',
    flags: 'g',
    sampleKey: 'regex.sampleIPv4',
  },
  {
    labelKey: 'regex.patternDate',
    pattern: '\\d{4}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\\d|3[01])',
    flags: 'g',
    sampleKey: 'regex.sampleDate',
  },
  {
    labelKey: 'regex.patternURL',
    pattern: 'https?://[^\\s/$.?#].[^\\s]*',
    flags: 'gi',
    sampleKey: 'regex.sampleURL',
  },
  {
    labelKey: 'regex.patternHex',
    pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b',
    flags: 'g',
    sampleKey: 'regex.sampleHex',
  },
  {
    labelKey: 'regex.patternInteger',
    pattern: '-?\\b\\d+\\b',
    flags: 'g',
    sampleKey: 'regex.sampleInteger',
  },
  {
    labelKey: 'regex.patternFloat',
    pattern: '-?\\b\\d+\\.\\d+\\b',
    flags: 'g',
    sampleKey: 'regex.sampleFloat',
  },
  {
    labelKey: 'regex.patternChineseMobile',
    pattern: '(?:\\+?86)?1[3-9]\\d{9}',
    flags: 'g',
    sampleKey: 'regex.sampleChineseMobile',
  },
  {
    labelKey: 'regex.patternIdCard',
    pattern:
      '[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]',
    flags: 'g',
    sampleKey: 'regex.sampleIdCard',
  },
  {
    labelKey: 'regex.patternPostcode',
    pattern: '[1-9]\\d{5}',
    flags: 'g',
    sampleKey: 'regex.samplePostcode',
  },
  {
    labelKey: 'regex.patternHtmlTag',
    pattern: '<[^>]+>',
    flags: 'g',
    sampleKey: 'regex.sampleHtmlTag',
  },
];

// 高亮颜色循环
const HIGHLIGHT_COLORS = [
  'bg-yellow-200 text-yellow-900 dark:bg-yellow-700/60 dark:text-yellow-100',
  'bg-blue-200 text-blue-900 dark:bg-blue-700/60 dark:text-blue-100',
  'bg-green-200 text-green-900 dark:bg-green-700/60 dark:text-green-100',
  'bg-pink-200 text-pink-900 dark:bg-pink-700/60 dark:text-pink-100',
  'bg-orange-200 text-orange-900 dark:bg-orange-700/60 dark:text-orange-100',
  'bg-purple-200 text-purple-900 dark:bg-purple-700/60 dark:text-purple-100',
];

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

interface MatchResult {
  match: string;
  index: number;
  end: number;
  groups: string[];
}

function runMatch(
  pattern: string,
  flags: string,
  text: string,
): { matches: MatchResult[]; error: string | null } {
  if (!pattern) return { matches: [], error: null };
  try {
    // 确保包含 g 标志以能遍历所有匹配
    const safeFlags = flags.includes('g') ? flags : flags + 'g';
    const re = new RegExp(pattern, safeFlags);
    const matches: MatchResult[] = [];
    let m: RegExpExecArray | null;
    let safeguard = 0;
    while ((m = re.exec(text)) !== null && safeguard < 10000) {
      safeguard++;
      matches.push({
        match: m[0],
        index: m.index,
        end: m.index + m[0].length,
        groups: m.slice(1),
      });
      // 避免零宽匹配死循环
      if (m[0].length === 0) re.lastIndex++;
    }
    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: (e as Error).message };
  }
}

/** 将匹配区间渲染为带高亮的 span 片段 */
function buildHighlightedSegments(text: string, matches: MatchResult[]) {
  if (matches.length === 0) return [{ text, highlight: false, colorIdx: 0 }];

  const segments: { text: string; highlight: boolean; colorIdx: number }[] = [];
  let cursor = 0;

  matches.forEach((m, i) => {
    if (m.index > cursor) {
      segments.push({
        text: text.slice(cursor, m.index),
        highlight: false,
        colorIdx: 0,
      });
    }
    if (m.end > m.index) {
      segments.push({
        text: text.slice(m.index, m.end),
        highlight: true,
        colorIdx: i % HIGHLIGHT_COLORS.length,
      });
    }
    cursor = m.end;
  });

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: false, colorIdx: 0 });
  }

  return segments;
}

// ─── 组件 ──────────────────────────────────────────────────────────────────────

function RegexPage() {
  const { t } = useTranslation();

  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testText, setTestText] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  const [replaceResult, setReplaceResult] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [copiedReplace, setCopiedReplace] = useState(false);

  // 实时匹配（useMemo 自动响应状态变化）
  const { matches, error } = useMemo(
    () => runMatch(pattern, flags, testText),
    [pattern, flags, testText],
  );

  const segments = useMemo(
    () => buildHighlightedSegments(testText, matches),
    [testText, matches],
  );

  // 切换 flags
  const toggleFlag = (f: string) => {
    setFlags((prev) => (prev.includes(f) ? prev.replace(f, '') : prev + f));
  };

  // 加载模式库条目
  const loadPattern = (entry: PatternEntry) => {
    setPattern(entry.pattern);
    setFlags(entry.flags);
    setTestText(t(entry.sampleKey));
    setReplaceResult(null);
  };

  // 生成测试样例（使用当前模式库中匹配的条目）
  const generateSample = () => {
    const matched = PATTERN_LIBRARY.find((e) => e.pattern === pattern);
    if (matched) {
      setTestText(t(matched.sampleKey));
    }
  };

  // 执行替换
  const doReplace = useCallback(() => {
    if (!pattern) return;
    try {
      const safeFlags = flags.includes('g') ? flags : flags + 'g';
      const re = new RegExp(pattern, safeFlags);
      setReplaceResult(testText.replace(re, replaceStr));
    } catch {
      setReplaceResult(null);
    }
  }, [pattern, flags, testText, replaceStr]);

  // 复制替换结果
  const copyReplace = () => {
    if (replaceResult == null) return;
    navigator.clipboard.writeText(replaceResult).then(() => {
      setCopiedReplace(true);
      setTimeout(() => setCopiedReplace(false), 1500);
    });
  };

  const clear = () => {
    setPattern('');
    setFlags('g');
    setTestText('');
    setReplaceStr('');
    setReplaceResult(null);
  };

  const allFlags = ['g', 'i', 'm', 's'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('regex.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('regex.desc')}</p>
      </div>

      {/* 正则输入区 */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground text-sm font-mono select-none">
            /
          </span>
          <input
            className="flex-1 min-w-0 font-mono text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary py-1 placeholder:text-muted-foreground/50"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={t('regex.patternPlaceholder')}
            spellCheck={false}
          />
          <span className="text-muted-foreground text-sm font-mono select-none">
            /
          </span>
          {/* 标志切换 */}
          <div className="flex items-center gap-1">
            {allFlags.map((f) => (
              <button
                key={f}
                onClick={() => toggleFlag(f)}
                className={`w-7 h-7 rounded text-xs font-mono font-semibold transition-colors ${
                  flags.includes(f)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
                title={t(`regex.flag_${f}`)}
              >
                {f}
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-6" />
          <Button size="sm" variant="outline" onClick={generateSample}>
            <Wand2 className="w-3.5 h-3.5 mr-1" />
            {t('regex.genSample')}
          </Button>
          <Button size="sm" variant="ghost" onClick={clear}>
            {t('regex.clear')}
          </Button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 font-mono">
            {t('regex.invalidPattern')}：{error}
          </div>
        )}

        {/* 匹配统计 */}
        {!error && pattern && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {matches.length > 0 ? (
              <Badge
                variant="secondary"
                className="text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300"
              >
                {t('regex.matchCount', { count: matches.length })}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-muted-foreground">
                {t('regex.noMatch')}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* 测试文本 + 高亮预览（两栏） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左：输入 */}
        <div className="border rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground font-medium">
            {t('regex.testText')}
          </div>
          <textarea
            className="flex-1 min-h-[200px] p-3 font-mono text-sm bg-transparent resize-none focus:outline-none"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder={t('regex.testTextPlaceholder')}
            spellCheck={false}
          />
        </div>

        {/* 右：高亮结果 */}
        <div className="border rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground font-medium">
            {t('regex.highlightResult')}
          </div>
          <div className="flex-1 min-h-[200px] p-3 font-mono text-sm whitespace-pre-wrap break-words overflow-auto">
            {testText === '' ? (
              <span className="text-muted-foreground/40">
                {t('regex.highlightEmpty')}
              </span>
            ) : (
              segments.map((seg, i) =>
                seg.highlight ? (
                  <mark
                    key={i}
                    className={`rounded px-0.5 ${HIGHLIGHT_COLORS[seg.colorIdx]}`}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )
            )}
          </div>
        </div>
      </div>

      {/* 匹配详情列表 */}
      {matches.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground font-medium">
            {t('regex.matchDetails')}
          </div>
          <div className="max-h-52 overflow-y-auto divide-y">
            {matches.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 text-sm font-mono hover:bg-muted/30 transition-colors"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]}`}
                >
                  #{i + 1}
                </span>
                <span className="font-semibold truncate">{m.match}</span>
                <span className="text-muted-foreground text-xs ml-auto shrink-0">
                  [{m.index}, {m.end})
                </span>
                {m.groups.length > 0 && (
                  <span className="text-muted-foreground text-xs shrink-0">
                    {t('regex.groups')}：
                    {m.groups
                      .map((g, gi) => `$${gi + 1}=${g ?? 'undefined'}`)
                      .join(' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 替换工具 */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('regex.replaceTitle')}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="flex-1 min-w-[200px] font-mono text-sm bg-muted/30 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            value={replaceStr}
            onChange={(e) => setReplaceStr(e.target.value)}
            placeholder={t('regex.replacePlaceholder')}
            spellCheck={false}
          />
          <Button
            size="sm"
            onClick={doReplace}
            disabled={!pattern || !testText}
          >
            {t('regex.doReplace')}
          </Button>
        </div>
        {replaceResult !== null && (
          <div className="relative border rounded-md bg-muted/20 p-3 font-mono text-sm whitespace-pre-wrap break-words max-h-40 overflow-auto">
            {replaceResult}
            <button
              onClick={copyReplace}
              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title={t('panel.copy')}
            >
              {copiedReplace ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* 常用模式库 */}
      <div className="border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
          onClick={() => setShowLibrary((v) => !v)}
        >
          {showLibrary ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {t('regex.libraryTitle')}
          <Badge variant="secondary" className="ml-1 text-xs">
            {PATTERN_LIBRARY.length}
          </Badge>
        </button>
        {showLibrary && (
          <div className="divide-y">
            {PATTERN_LIBRARY.map((entry) => (
              <div
                key={entry.pattern}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => loadPattern(entry)}
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-sm font-medium">{t(entry.labelKey)}</div>
                  <div className="font-mono text-xs text-muted-foreground truncate">
                    /{entry.pattern}/{entry.flags}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadPattern(entry);
                  }}
                >
                  {t('regex.usePattern')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
