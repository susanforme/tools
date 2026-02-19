import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';

export const Route = createFileRoute('/number-base')({
  component: NumberBasePage,
});

// ─── 进制类型 ──────────────────────────────────────────────────────────────────
const BASES = [
  { value: '2', label: '二进制 (Binary, Base 2)' },
  { value: '8', label: '八进制 (Octal, Base 8)' },
  { value: '10', label: '十进制 (Decimal, Base 10)' },
  { value: '16', label: '十六进制 (Hex, Base 16)' },
] as const;

type Base = '2' | '8' | '10' | '16';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 解析整数文本 → BigInt（支持各进制前缀） */
function parseValue(input: string, base: Base): bigint {
  const s = input.trim().replace(/\s+/g, '');
  if (s === '' || s === '-' || s === '+') throw new Error('请输入有效数值');
  return BigInt(parseInt(s, parseInt(base)));
}

/** BigInt → 指定进制字符串 */
function toBase(val: bigint, base: Base): string {
  const neg = val < 0n;
  const abs = neg ? -val : val;
  return (neg ? '-' : '') + abs.toString(parseInt(base));
}

/** 格式化输出：hex 大写、二进制每 4 位加空格 */
function formatOutput(val: string, base: Base): string {
  if (base === '16') return val.toUpperCase();
  if (base === '2') {
    // 每 8 位加空格
    const sign = val.startsWith('-') ? '-' : '';
    const digits = val.replace('-', '');
    const padded = digits.padStart(Math.ceil(digits.length / 8) * 8, '0');
    return sign + padded.replace(/(.{8})/g, '$1 ').trim();
  }
  return val;
}

// ─── 转换结果行 ────────────────────────────────────────────────────────────────
type ConvertResult = { base: Base; prefix: string; value: string };

const BASE_PREFIXES: Record<Base, string> = {
  '2': '0b',
  '8': '0o',
  '10': '',
  '16': '0x',
};

// ─── component ────────────────────────────────────────────────────────────────
function NumberBasePage() {
  const { t } = useTranslation();
  const [inputBase, setInputBase] = useState<Base>('10');
  const [inputValue, setInputValue] = useState('255');
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedBase, setCopiedBase] = useState<Base | null>(null);

  const convert = () => {
    setError(null);
    try {
      const val = parseValue(inputValue, inputBase);
      const all = (['2', '8', '10', '16'] as Base[]).map((b) => ({
        base: b,
        prefix: BASE_PREFIXES[b],
        value: formatOutput(toBase(val, b), b),
      }));
      setResults(all);
    } catch (e) {
      setError(t('numberBase.convertError', { msg: (e as Error).message }));
      setResults([]);
    }
  };

  const clear = () => {
    setInputValue('');
    setResults([]);
    setError(null);
  };

  const copyResult = (b: Base, val: string) => {
    void navigator.clipboard.writeText(val).then(() => {
      setCopiedBase(b);
      setTimeout(() => setCopiedBase(null), 1500);
    });
  };

  const BASE_LABELS: Record<Base, string> = {
    '2': t('numberBase.binary'),
    '8': t('numberBase.octal'),
    '10': t('numberBase.decimal'),
    '16': t('numberBase.hex'),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('numberBase.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('numberBase.desc')}
        </p>
      </div>

      {/* 输入区 */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground shrink-0">
            {t('numberBase.inputBase')}
          </span>
          <Select
            value={inputBase}
            onValueChange={(v) => {
              setInputBase(v as Base);
              setResults([]);
              setError(null);
            }}
          >
            <SelectTrigger className="h-8 w-60 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASES.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6" />
          <Button size="sm" onClick={convert}>
            {t('numberBase.convert')}
          </Button>
          <Button size="sm" variant="outline" onClick={clear}>
            {t('numberBase.clear')}
          </Button>
        </div>

        {/* 数值输入框 */}
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">
            {BASE_LABELS[inputBase]}
          </span>
          <input
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('numberBase.inputPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') convert();
            }}
          />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* 转换结果 */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('numberBase.results')}
          </h2>
          <div className="space-y-2">
            {results.map(({ base, prefix, value }) => (
              <div
                key={base}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                  base === inputBase
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                {/* 进制标签 */}
                <div className="w-28 shrink-0">
                  <div className="text-sm font-medium">{BASE_LABELS[base]}</div>
                  <div className="text-xs text-muted-foreground">{`Base ${base}`}</div>
                </div>

                {/* 前缀 + 值 */}
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm text-muted-foreground">
                    {prefix}
                  </span>
                  <span className="font-mono text-sm break-all">{value}</span>
                </div>

                {/* 复制按钮 */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 h-7 text-xs"
                  onClick={() =>
                    copyResult(base, prefix + value.replace(/\s/g, ''))
                  }
                >
                  {copiedBase === base
                    ? t('numberBase.copied')
                    : t('numberBase.copy')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-3 space-y-1">
        <div className="font-medium mb-2">{t('numberBase.tipsTitle')}</div>
        <div>{t('numberBase.tip1')}</div>
        <div>{t('numberBase.tip2')}</div>
        <div>{t('numberBase.tip3')}</div>
      </div>
    </div>
  );
}
