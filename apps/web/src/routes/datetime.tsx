import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowLeftRight,
  Calendar,
  CalendarClock,
  Clock,
  Copy,
  RefreshCw,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/datetime')({ component: DatetimePage });

// ─── 常量 ──────────────────────────────────────────────────

const TABS = ['unix', 'timezone', 'diff', 'iso'] as const;
type Tab = (typeof TABS)[number];

// 常用时区列表
const TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

// ─── 工具函数 ─────────────────────────────────────────────

/** 将时间戳（秒或毫秒）标准化为毫秒 */
function normalizeTs(raw: string): { ms: number; unit: 's' | 'ms' } | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  // 超过 1e12 视为毫秒级，否则视为秒级
  if (Math.abs(n) >= 1e12) return { ms: n, unit: 'ms' };
  return { ms: n * 1000, unit: 's' };
}

/** 将 Date 格式化为 "YYYY-MM-DD HH:mm:ss" 在指定时区 */
function formatInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('T', ' ');
}

/** 获取时区缩写+偏移，如 "CST (UTC+8)" */
function tzLabel(tz: string, date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    return `${tz} ${offset}`;
  } catch {
    return tz;
  }
}

/** 解析本地日期时间字符串为 UTC ms */
function parseDatetimeLocal(value: string, tz: string): number {
  // 利用 Intl 反向推算：在给定时区里 value 对应的 UTC 时刻
  // 先粗估，再微调（时区边界精确到分钟）
  const [datePart, timePart = '00:00:00'] = value.split(' ');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, s] = timePart.split(':').map(Number);
  // 构造一个"假" UTC Date 用于 Intl 格式化
  const rough = Date.UTC(y, mo - 1, d, h, mi, s ?? 0);
  // 在目标时区显示该时刻，得到偏移
  const displayed = formatInTz(new Date(rough), tz);
  const [dy, dmo, dd] = displayed.split(' ')[0].split('-').map(Number);
  const [dh, dmi, ds] = displayed.split(' ')[1].split(':').map(Number);
  const displayedUtc = Date.UTC(dy, dmo - 1, dd, dh, dmi, ds);
  // 偏移 = rough - displayedUtc
  return rough + (rough - displayedUtc);
}

/** 计算两日期之间的差值 */
function dateDiff(ms1: number, ms2: number) {
  const diff = Math.abs(ms2 - ms1);
  const totalSeconds = Math.floor(diff / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  return {
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
    weeks,
    days,
    hours,
    minutes,
    seconds,
  };
}

/** 校验 ISO 8601 字符串 */
function validateIso(s: string): {
  valid: boolean;
  parsed: Date | null;
  notes: string[];
} {
  const str = s.trim();
  if (!str) return { valid: false, parsed: null, notes: [] };
  const d = new Date(str);
  if (isNaN(d.getTime())) return { valid: false, parsed: null, notes: [] };
  const notes: string[] = [];
  // 检测是否含时区信息
  if (!/Z|[+-]\d{2}:\d{2}$/.test(str)) {
    notes.push('no-tz');
  }
  // 检测是否含时间
  if (!/T/.test(str)) {
    notes.push('date-only');
  }
  return { valid: true, parsed: d, notes };
}

// ─── 复制按钮 ─────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title={copied ? t('panel.copied') : t('panel.copy')}
    >
      {copied ? (
        <ShieldCheck className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

// ─── 结果行 ───────────────────────────────────────────────

function ResultRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-sm truncate ${mono ? 'font-mono' : ''}`}
          title={value}
        >
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// ─── Tab: Unix 时间戳 ↔ 日期时间 ─────────────────────────

function UnixTab() {
  const { t } = useTranslation();
  const [tsInput, setTsInput] = useState('');
  const [dtInput, setDtInput] = useState('');
  const [tz, setTz] = useState('Asia/Shanghai');
  const [tsResult, setTsResult] = useState<{
    utc: string;
    local: string;
    iso: string;
    unit: string;
  } | null>(null);
  const [dtResult, setDtResult] = useState<{
    unix_s: string;
    unix_ms: string;
  } | null>(null);
  const [tsError, setTsError] = useState<string | null>(null);
  const [dtError, setDtError] = useState<string | null>(null);

  const nowTs = () => {
    const now = Math.floor(Date.now() / 1000);
    setTsInput(String(now));
    setTsResult(null);
    setTsError(null);
  };

  const nowDt = () => {
    const now = new Date();
    setDtInput(
      formatInTz(now, tz).replace(' ', 'T').slice(0, 16).replace('T', ' '),
    );
    setDtResult(null);
    setDtError(null);
  };

  const convertTs = () => {
    setTsError(null);
    setTsResult(null);
    const result = normalizeTs(tsInput);
    if (!result) {
      setTsError(t('datetime.invalidTs'));
      return;
    }
    const date = new Date(result.ms);
    setTsResult({
      utc: formatInTz(date, 'UTC') + ' UTC',
      local: formatInTz(date, tz),
      iso: date.toISOString(),
      unit:
        result.unit === 's'
          ? t('datetime.unitSeconds')
          : t('datetime.unitMilliseconds'),
    });
  };

  const convertDt = () => {
    setDtError(null);
    setDtResult(null);
    const v = dtInput.trim();
    if (!v) {
      setDtError(t('datetime.emptyInput'));
      return;
    }
    try {
      const ms = parseDatetimeLocal(v, tz);
      if (!Number.isFinite(ms)) throw new Error('invalid');
      setDtResult({
        unix_s: String(Math.floor(ms / 1000)),
        unix_ms: String(ms),
      });
    } catch {
      setDtError(t('datetime.invalidDatetime'));
    }
  };

  return (
    <div className="space-y-6">
      {/* 时区选择 */}
      <div className="flex items-center gap-3">
        <label className="shrink-0 text-sm">{t('datetime.timezone')}</label>
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 时间戳 → 日期 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            {t('datetime.tsToDate')}
          </h3>
          <div className="flex gap-2">
            <input
              value={tsInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTsInput(e.target.value)
              }
              placeholder={t('datetime.tsPlaceholder')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                e.key === 'Enter' && convertTs()
              }
            />
            <Button
              size="sm"
              variant="outline"
              onClick={nowTs}
              title={t('datetime.useNow')}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" onClick={convertTs}>
            {t('datetime.convert')}
          </Button>
          {tsError && (
            <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {tsError}
            </div>
          )}
          {tsResult && (
            <div className="rounded-lg border bg-muted/30 px-4 py-1">
              <ResultRow
                label={t('datetime.detectedUnit')}
                value={tsResult.unit}
                mono={false}
              />
              <ResultRow label="UTC" value={tsResult.utc} />
              <ResultRow label={tz} value={tsResult.local} />
              <ResultRow label="ISO 8601" value={tsResult.iso} />
            </div>
          )}
        </div>

        {/* 日期 → 时间戳 */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-500" />
            {t('datetime.dateToTs')}
          </h3>
          <div className="flex gap-2">
            <input
              value={dtInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDtInput(e.target.value)
              }
              placeholder="YYYY-MM-DD HH:mm:ss"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                e.key === 'Enter' && convertDt()
              }
            />
            <Button
              size="sm"
              variant="outline"
              onClick={nowDt}
              title={t('datetime.useNow')}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm" onClick={convertDt}>
            {t('datetime.convert')}
          </Button>
          {dtError && (
            <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {dtError}
            </div>
          )}
          {dtResult && (
            <div className="rounded-lg border bg-muted/30 px-4 py-1">
              <ResultRow
                label={t('datetime.unixSeconds')}
                value={dtResult.unix_s}
              />
              <ResultRow
                label={t('datetime.unixMilliseconds')}
                value={dtResult.unix_ms}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: 时区转换 ────────────────────────────────────────

function TimezoneTab() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [fromTz, setFromTz] = useState('Asia/Shanghai');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { tz: string; time: string; label: string }[]
  >([]);

  const nowInput = () => {
    const now = new Date();
    setInput(formatInTz(now, fromTz).replace('T', ' '));
    setResults([]);
    setError(null);
  };

  const convert = () => {
    setError(null);
    setResults([]);
    const v = input.trim();
    if (!v) {
      setError(t('datetime.emptyInput'));
      return;
    }
    try {
      const ms = parseDatetimeLocal(v, fromTz);
      if (!Number.isFinite(ms)) throw new Error('invalid');
      const date = new Date(ms);
      setResults(
        TIMEZONES.map((tz) => ({
          tz,
          time: formatInTz(date, tz),
          label: tzLabel(tz, date),
        })),
      );
    } catch {
      setError(t('datetime.invalidDatetime'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm">{t('datetime.fromTimezone')}</label>
          <Select
            value={fromTz}
            onValueChange={(v) => {
              setFromTz(v);
              setResults([]);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex-1 min-w-48">
          <label className="text-sm">{t('datetime.inputDatetime')}</label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInput(e.target.value)
              }
              placeholder="YYYY-MM-DD HH:mm:ss"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                e.key === 'Enter' && convert()
              }
            />
            <Button
              size="sm"
              variant="outline"
              onClick={nowInput}
              title={t('datetime.useNow')}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={convert} className="shrink-0">
          <ArrowLeftRight className="w-4 h-4 mr-1.5" />
          {t('datetime.convertAll')}
        </Button>
      </div>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground grid grid-cols-[1fr_auto] gap-4">
            <span>{t('datetime.timezone')}</span>
            <span>{t('datetime.localTime')}</span>
          </div>
          {results.map(({ tz, time, label }) => (
            <div
              key={tz}
              className={`px-4 py-2.5 grid grid-cols-[1fr_auto] gap-4 items-center border-t first:border-t-0 ${
                tz === fromTz ? 'bg-primary/5 font-medium' : ''
              }`}
            >
              <span className="text-sm truncate" title={label}>
                {label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">{time}</span>
                <CopyButton text={time} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: 日期差计算 ──────────────────────────────────────

function DiffTab() {
  const { t } = useTranslation();
  const [date1, setDate1] = useState('');
  const [date2, setDate2] = useState('');
  const [tz, setTz] = useState('Asia/Shanghai');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof dateDiff> | null>(
    null,
  );
  const [sign, setSign] = useState<1 | -1>(1);

  const setNow = (which: 1 | 2) => {
    const now = formatInTz(new Date(), tz).replace('T', ' ');
    if (which === 1) setDate1(now);
    else setDate2(now);
    setResult(null);
    setError(null);
  };

  const calc = () => {
    setError(null);
    setResult(null);
    const v1 = date1.trim();
    const v2 = date2.trim();
    if (!v1 || !v2) {
      setError(t('datetime.emptyInput'));
      return;
    }
    try {
      const ms1 = parseDatetimeLocal(v1, tz);
      const ms2 = parseDatetimeLocal(v2, tz);
      if (!Number.isFinite(ms1) || !Number.isFinite(ms2))
        throw new Error('invalid');
      setSign(ms2 >= ms1 ? 1 : -1);
      setResult(dateDiff(ms1, ms2));
    } catch {
      setError(t('datetime.invalidDatetime'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="shrink-0 text-sm">{t('datetime.timezone')}</label>
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* 日期 1 */}
        <div className="space-y-1.5">
          <label className="text-sm">{t('datetime.date1')}</label>
          <div className="flex gap-2">
            <input
              value={date1}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDate1(e.target.value)
              }
              placeholder="YYYY-MM-DD HH:mm:ss"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNow(1)}
              title={t('datetime.useNow')}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 日期 2 */}
        <div className="space-y-1.5">
          <label className="text-sm">{t('datetime.date2')}</label>
          <div className="flex gap-2">
            <input
              value={date2}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDate2(e.target.value)
              }
              placeholder="YYYY-MM-DD HH:mm:ss"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNow(2)}
              title={t('datetime.useNow')}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Button size="sm" onClick={calc}>
        <Timer className="w-4 h-4 mr-1.5" />
        {t('datetime.calculate')}
      </Button>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {sign === -1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('datetime.diffNegativeNote')}
            </p>
          )}
          {/* 概览卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: t('datetime.totalDays'), value: result.totalDays },
              { label: t('datetime.totalHours'), value: result.totalHours },
              { label: t('datetime.totalMinutes'), value: result.totalMinutes },
              { label: t('datetime.totalSeconds'), value: result.totalSeconds },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border bg-muted/30 p-3 text-center"
              >
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {label}
                </div>
              </div>
            ))}
          </div>
          {/* 分解 */}
          <div className="rounded-lg border bg-muted/30 px-4 py-1">
            <ResultRow
              label={t('datetime.breakdown')}
              value={`${result.weeks} ${t('datetime.weeks')} ${result.days} ${t('datetime.days')} ${result.hours} ${t('datetime.hours')} ${result.minutes} ${t('datetime.minutes')} ${result.seconds} ${t('datetime.seconds')}`}
              mono={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: ISO 格式校验 ────────────────────────────────────

function IsoTab() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ReturnType<typeof validateIso> | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const validate = () => {
    setResult(validateIso(input));
  };

  const clear = () => {
    setInput('');
    setResult(null);
  };

  const insertNow = () => {
    setInput(new Date().toISOString());
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm">{t('datetime.isoInputLabel')}</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('datetime.isoPlaceholder')}
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={validate}>
          <ShieldCheck className="w-4 h-4 mr-1.5" />
          {t('datetime.isoValidate')}
        </Button>
        <Button size="sm" variant="outline" onClick={insertNow}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          {t('datetime.useNow')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          {t('datetime.clear')}
        </Button>
      </div>

      {result && (
        <div className="space-y-3">
          {/* 有效/无效标志 */}
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              result.valid
                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30'
                : 'bg-destructive/10 text-destructive border border-destructive/30'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            {result.valid ? t('datetime.isoValid') : t('datetime.isoInvalid')}
          </div>

          {/* 注意事项 */}
          {result.valid && result.notes.length > 0 && (
            <div className="space-y-1.5">
              {result.notes.includes('no-tz') && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-1.5">
                  {t('datetime.isoNoTz')}
                </div>
              )}
              {result.notes.includes('date-only') && (
                <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-3 py-1.5">
                  {t('datetime.isoDateOnly')}
                </div>
              )}
            </div>
          )}

          {/* 解析结果 */}
          {result.parsed && (
            <div className="rounded-lg border bg-muted/30 px-4 py-1">
              <ResultRow label="UTC" value={result.parsed.toUTCString()} />
              <ResultRow label="ISO 8601" value={result.parsed.toISOString()} />
              <ResultRow
                label={t('datetime.unixSeconds')}
                value={String(Math.floor(result.parsed.getTime() / 1000))}
              />
              <ResultRow
                label={t('datetime.unixMilliseconds')}
                value={String(result.parsed.getTime())}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 实时时钟 ─────────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono tabular-nums">
      <CalendarClock className="w-3.5 h-3.5" />
      <span>{now.toISOString()}</span>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────

function DatetimePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('unix');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* 标题 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t('datetime.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('datetime.desc')}
          </p>
        </div>
        <LiveClock />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="unix">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            {t('datetime.tabUnix')}
          </TabsTrigger>
          <TabsTrigger value="timezone">
            <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
            {t('datetime.tabTimezone')}
          </TabsTrigger>
          <TabsTrigger value="diff">
            <Timer className="w-3.5 h-3.5 mr-1.5" />
            {t('datetime.tabDiff')}
          </TabsTrigger>
          <TabsTrigger value="iso">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            {t('datetime.tabIso')}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="unix">
            <UnixTab />
          </TabsContent>
          <TabsContent value="timezone">
            <TimezoneTab />
          </TabsContent>
          <TabsContent value="diff">
            <DiffTab />
          </TabsContent>
          <TabsContent value="iso">
            <IsoTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
