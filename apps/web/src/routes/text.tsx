import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/text')({ component: TextPage });

// ─── 工具函数 ──────────────────────────────────────────────

/** 去重复行 */
function deduplicateLines(text: string, caseSensitive: boolean): string {
  const lines = text.split('\n');
  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = caseSensitive ? line : line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}

/** 去空行 */
function removeEmptyLines(text: string, trimLines: boolean): string {
  const lines = text.split('\n');
  return lines
    .filter((line) => (trimLines ? line.trim() !== '' : line !== ''))
    .join('\n');
}

/** 行排序 */
function sortLines(
  text: string,
  order: 'asc' | 'desc' | 'natural' | 'shuffle' | 'reverse',
  caseSensitive: boolean,
): string {
  const lines = text.split('\n');
  if (order === 'reverse') {
    return [...lines].reverse().join('\n');
  }
  if (order === 'shuffle') {
    const arr = [...lines];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('\n');
  }
  const compare = (a: string, b: string): number => {
    const ka = caseSensitive ? a : a.toLowerCase();
    const kb = caseSensitive ? b : b.toLowerCase();
    if (order === 'natural') {
      return ka.localeCompare(kb, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }
    if (ka < kb) return order === 'asc' ? -1 : 1;
    if (ka > kb) return order === 'asc' ? 1 : -1;
    return 0;
  };
  return [...lines].sort(compare).join('\n');
}

// ─── 行统计 / 词频 ─────────────────────────────────────────

type WordFreqEntry = { word: string; count: number };

function computeStats(text: string) {
  const lines = text.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim() !== '');
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const words = text.trim() === '' ? [] : text.trim().split(/\s+/);
  return {
    lines: lines.length,
    nonEmptyLines: nonEmptyLines.length,
    chars,
    charsNoSpace,
    wordCount: words.length,
  };
}

function computeWordFreq(text: string, topN: number): WordFreqEntry[] {
  if (text.trim() === '') return [];
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

// ─── 大小写转换 ────────────────────────────────────────────

type CaseMode =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant';

function convertCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    case 'sentence':
      return text
        .split(/([.!?]\s+)/)
        .map((seg, i) =>
          i % 2 === 0
            ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()
            : seg,
        )
        .join('');
    case 'camel': {
      const words = splitIntoWords(text);
      return words
        .map((w, i) =>
          i === 0
            ? w.toLowerCase()
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join('');
    }
    case 'pascal': {
      const words = splitIntoWords(text);
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    }
    case 'snake': {
      const words = splitIntoWords(text);
      return words.map((w) => w.toLowerCase()).join('_');
    }
    case 'kebab': {
      const words = splitIntoWords(text);
      return words.map((w) => w.toLowerCase()).join('-');
    }
    case 'constant': {
      const words = splitIntoWords(text);
      return words.map((w) => w.toUpperCase()).join('_');
    }
  }
}

/** 将文本按空格、驼峰、下划线、连字符拆词 */
function splitIntoWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// ─── 通用 PanelLayout ──────────────────────────────────────

function TextPanel({
  input,
  output,
  onInputChange,
  inputLabel,
  outputLabel,
  children,
  outputRows = 16,
  inputRows = 16,
}: {
  input: string;
  output: string;
  onInputChange: (v: string) => void;
  inputLabel?: string;
  outputLabel?: string;
  children?: React.ReactNode;
  outputRows?: number;
  inputRows?: number;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      {children}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
            {inputLabel ?? '输入'}
          </div>
          <textarea
            className="w-full p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            rows={inputRows}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="在此粘贴文本..."
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center bg-muted/50 px-3 py-1.5 border-b">
            <span className="text-xs text-muted-foreground flex-1">
              {outputLabel ?? '输出'}
            </span>
            <button
              onClick={copy}
              disabled={!output}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {copied ? '已复制 ✓' : '复制'}
            </button>
          </div>
          <textarea
            className="w-full p-3 font-mono text-sm bg-background resize-none focus:outline-none text-muted-foreground"
            rows={outputRows}
            value={output}
            readOnly
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: 去重复行 ─────────────────────────────────────────

function DedupeTab() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(true);

  const run = () => {
    setOutput(deduplicateLines(input, caseSensitive));
  };
  const clear = () => {
    setInput('');
    setOutput('');
  };

  const removedCount =
    input && output
      ? input.split('\n').length - output.split('\n').length
      : null;

  return (
    <TextPanel input={input} output={output} onInputChange={setInput}>
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={run}>
          去重
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          清空
        </Button>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            className="rounded"
          />
          区分大小写
        </label>
        {removedCount !== null && removedCount > 0 && (
          <span className="text-sm text-muted-foreground">
            已去除{' '}
            <span className="font-medium text-foreground">{removedCount}</span>{' '}
            行重复
          </span>
        )}
      </div>
    </TextPanel>
  );
}

// ─── Tab: 去空行 ───────────────────────────────────────────

function RemoveEmptyTab() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [trimLines, setTrimLines] = useState(true);

  const run = () => {
    setOutput(removeEmptyLines(input, trimLines));
  };
  const clear = () => {
    setInput('');
    setOutput('');
  };

  const removedCount =
    input && output
      ? input.split('\n').length - output.split('\n').length
      : null;

  return (
    <TextPanel input={input} output={output} onInputChange={setInput}>
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={run}>
          去空行
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          清空
        </Button>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trimLines}
            onChange={(e) => setTrimLines(e.target.checked)}
            className="rounded"
          />
          同时去除纯空白行（仅含空格/Tab）
        </label>
        {removedCount !== null && removedCount > 0 && (
          <span className="text-sm text-muted-foreground">
            已去除{' '}
            <span className="font-medium text-foreground">{removedCount}</span>{' '}
            行空行
          </span>
        )}
      </div>
    </TextPanel>
  );
}

// ─── Tab: 行排序 ───────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'asc', label: '升序 A→Z' },
  { value: 'desc', label: '降序 Z→A' },
  { value: 'natural', label: '自然排序（数字感知）' },
  { value: 'reverse', label: '反转行顺序' },
  { value: 'shuffle', label: '随机打乱' },
] as const;

type SortOrder = (typeof SORT_OPTIONS)[number]['value'];

function SortTab() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [caseSensitive, setCaseSensitive] = useState(false);

  const run = () => {
    setOutput(sortLines(input, order, caseSensitive));
  };
  const clear = () => {
    setInput('');
    setOutput('');
  };

  return (
    <TextPanel input={input} output={output} onInputChange={setInput}>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as SortOrder)}
          className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={run}>
          排序
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          清空
        </Button>
        {order !== 'reverse' && order !== 'shuffle' && (
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded"
            />
            区分大小写
          </label>
        )}
      </div>
    </TextPanel>
  );
}

// ─── Tab: 行统计 / 词频 ────────────────────────────────────

function StatsTab() {
  const [input, setInput] = useState('');
  const [topN, setTopN] = useState(20);
  const [analysed, setAnalysed] = useState(false);

  const stats = computeStats(input);
  const freq = analysed ? computeWordFreq(input, topN) : [];
  const maxCount = freq[0]?.count ?? 1;

  const analyse = () => setAnalysed(true);
  const clear = () => {
    setInput('');
    setAnalysed(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={analyse}>
          分析词频
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          清空
        </Button>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Top
          <input
            type="number"
            min={5}
            max={200}
            value={topN}
            onChange={(e) =>
              setTopN(Math.max(1, parseInt(e.target.value) || 20))
            }
            className="w-16 border rounded-md px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          个词
        </label>
      </div>

      {/* 文本输入 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
          输入文本
        </div>
        <textarea
          className="w-full p-3 font-mono text-sm bg-background resize-none focus:outline-none"
          rows={8}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setAnalysed(false);
          }}
          placeholder="在此粘贴文本..."
          spellCheck={false}
        />
      </div>

      {/* 统计概览 */}
      {input && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: '总行数', value: stats.lines },
            { label: '非空行数', value: stats.nonEmptyLines },
            { label: '总字符数', value: stats.chars },
            { label: '非空字符', value: stats.charsNoSpace },
            { label: '词数（空格分隔）', value: stats.wordCount },
          ].map((item) => (
            <div
              key={item.label}
              className="border rounded-lg px-3 py-2 text-center"
            >
              <div className="text-lg font-bold tabular-nums">
                {item.value.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 词频列表 */}
      {analysed && freq.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
            词频 Top {topN}
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {freq.map(({ word, count }, i) => (
              <div key={word} className="flex items-center gap-3 px-3 py-1.5">
                <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                  {i + 1}
                </span>
                <span className="font-mono text-sm w-36 truncate shrink-0">
                  {word}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums w-10 text-right shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {analysed && freq.length === 0 && input && (
        <p className="text-sm text-muted-foreground">未找到有效词汇。</p>
      )}
    </div>
  );
}

// ─── Tab: 大小写转换 ───────────────────────────────────────

const CASE_OPTIONS: { value: CaseMode; label: string; example: string }[] = [
  { value: 'upper', label: '大写 UPPER CASE', example: 'HELLO WORLD' },
  { value: 'lower', label: '小写 lower case', example: 'hello world' },
  { value: 'title', label: '标题 Title Case', example: 'Hello World' },
  { value: 'sentence', label: '句式 Sentence case', example: 'Hello world' },
  { value: 'camel', label: '小驼峰 camelCase', example: 'helloWorld' },
  { value: 'pascal', label: '大驼峰 PascalCase', example: 'HelloWorld' },
  { value: 'snake', label: '下划线 snake_case', example: 'hello_world' },
  { value: 'kebab', label: '连字符 kebab-case', example: 'hello-world' },
  { value: 'constant', label: '常量 CONSTANT_CASE', example: 'HELLO_WORLD' },
];

function CaseTab() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<CaseMode>('title');
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    try {
      setOutput(convertCase(input, mode));
    } catch (e) {
      setError(`转换失败：${(e as Error).message}`);
    }
  };
  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <TextPanel input={input} output={output} onInputChange={setInput}>
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as CaseMode)}
          className="text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CASE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={run}>
          转换
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          清空
        </Button>
        <span className="text-xs text-muted-foreground">
          示例：{CASE_OPTIONS.find((o) => o.value === mode)?.example}
        </span>
      </div>
      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </TextPanel>
  );
}

// ─── 主页面 ────────────────────────────────────────────────

function TextPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">文本处理工具</h1>
      </div>

      <Tabs defaultValue="dedupe">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dedupe">去重复行</TabsTrigger>
          <TabsTrigger value="empty">去空行</TabsTrigger>
          <TabsTrigger value="sort">行排序</TabsTrigger>
          <TabsTrigger value="stats">行/词统计</TabsTrigger>
          <TabsTrigger value="case">大小写转换</TabsTrigger>
        </TabsList>

        <TabsContent value="dedupe" className="mt-4">
          <DedupeTab />
        </TabsContent>
        <TabsContent value="empty" className="mt-4">
          <RemoveEmptyTab />
        </TabsContent>
        <TabsContent value="sort" className="mt-4">
          <SortTab />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsTab />
        </TabsContent>
        <TabsContent value="case" className="mt-4">
          <CaseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
