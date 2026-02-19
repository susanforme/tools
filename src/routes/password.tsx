import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, RefreshCw, Shield } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';

export const Route = createFileRoute('/password')({ component: PasswordPage });

// ─── 字符集常量 ────────────────────────────────────────────

const CHARSET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHARSET_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const CHARSET_DIGITS = '0123456789';
const CHARSET_SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';
const CHARSET_SIMILAR = 'iIlLoO01';

// ─── 强度评估 ──────────────────────────────────────────────

type Strength = 'weak' | 'fair' | 'good' | 'strong';

function calcStrength(password: string): Strength {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score === 3) return 'fair';
  if (score === 4) return 'good';
  return 'strong';
}

const STRENGTH_COLOR: Record<Strength, string> = {
  weak: 'bg-red-500',
  fair: 'bg-orange-400',
  good: 'bg-yellow-400',
  strong: 'bg-green-500',
};

const STRENGTH_BAR: Record<Strength, number> = {
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

// ─── 密码生成函数 ──────────────────────────────────────────

function generatePassword(
  length: number,
  useUpper: boolean,
  useLower: boolean,
  useDigits: boolean,
  useSymbols: boolean,
  excludeSimilar: boolean,
): string {
  let charset = '';
  const required: string[] = [];

  const filter = (s: string) =>
    excludeSimilar
      ? s
          .split('')
          .filter((c) => !CHARSET_SIMILAR.includes(c))
          .join('')
      : s;

  if (useUpper) {
    const s = filter(CHARSET_UPPER);
    if (s) {
      charset += s;
      required.push(s[Math.floor(Math.random() * s.length)]);
    }
  }
  if (useLower) {
    const s = filter(CHARSET_LOWER);
    if (s) {
      charset += s;
      required.push(s[Math.floor(Math.random() * s.length)]);
    }
  }
  if (useDigits) {
    const s = filter(CHARSET_DIGITS);
    if (s) {
      charset += s;
      required.push(s[Math.floor(Math.random() * s.length)]);
    }
  }
  if (useSymbols) {
    const s = filter(CHARSET_SYMBOLS);
    if (s) {
      charset += s;
      required.push(s[Math.floor(Math.random() * s.length)]);
    }
  }

  if (!charset) return '';

  // 使用 crypto.getRandomValues 保证密码学安全随机性
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  const chars = charset.split('');
  const result = required.map((c) => c);

  // 补齐剩余长度
  for (let i = required.length; i < length; i++) {
    result.push(chars[array[i] % chars.length]);
  }

  // Fisher-Yates 洗牌
  const shuffleArr = new Uint32Array(result.length);
  crypto.getRandomValues(shuffleArr);
  for (let i = result.length - 1; i > 0; i--) {
    const j = shuffleArr[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

// ─── 主组件 ───────────────────────────────────────────────

function PasswordPage() {
  const { t } = useTranslation();
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [count, setCount] = useState(1);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const generate = useCallback(() => {
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.push(
        generatePassword(
          length,
          useUpper,
          useLower,
          useDigits,
          useSymbols,
          excludeSimilar,
        ),
      );
    }
    setPasswords(list);
    setCopied(null);
  }, [
    length,
    useUpper,
    useLower,
    useDigits,
    useSymbols,
    excludeSimilar,
    count,
  ]);

  // 初始化时生成
  useEffect(() => {
    generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyOne = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const copyAll = () => {
    navigator.clipboard.writeText(passwords.join('\n')).then(() => {
      setCopied(-1);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const noneSelected = !useUpper && !useLower && !useDigits && !useSymbols;

  const strengthLabelKey: Record<Strength, string> = {
    weak: 'password.strengthWeak',
    fair: 'password.strengthFair',
    good: 'password.strengthGood',
    strong: 'password.strengthStrong',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          {t('password.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('password.desc')}
        </p>
      </div>

      {/* 选项卡 */}
      <div className="rounded-xl border bg-card p-5 space-y-5">
        {/* 密码长度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t('password.length')}
            </Label>
            <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
              {length}
            </span>
          </div>
          <Slider
            min={4}
            max={64}
            step={1}
            value={[length]}
            onValueChange={([v]) => setLength(v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>4</span>
            <span>64</span>
          </div>
        </div>

        {/* 字符集选项 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="upper"
              checked={useUpper}
              onCheckedChange={(v) => setUseUpper(!!v)}
            />
            <Label htmlFor="upper" className="cursor-pointer text-sm">
              {t('password.upperCase')}{' '}
              <span className="text-muted-foreground font-mono">A–Z</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="lower"
              checked={useLower}
              onCheckedChange={(v) => setUseLower(!!v)}
            />
            <Label htmlFor="lower" className="cursor-pointer text-sm">
              {t('password.lowerCase')}{' '}
              <span className="text-muted-foreground font-mono">a–z</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="digits"
              checked={useDigits}
              onCheckedChange={(v) => setUseDigits(!!v)}
            />
            <Label htmlFor="digits" className="cursor-pointer text-sm">
              {t('password.digits')}{' '}
              <span className="text-muted-foreground font-mono">0–9</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="symbols"
              checked={useSymbols}
              onCheckedChange={(v) => setUseSymbols(!!v)}
            />
            <Label htmlFor="symbols" className="cursor-pointer text-sm">
              {t('password.symbols')}{' '}
              <span className="text-muted-foreground font-mono">!@#…</span>
            </Label>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Checkbox
              id="similar"
              checked={excludeSimilar}
              onCheckedChange={(v) => setExcludeSimilar(!!v)}
            />
            <Label htmlFor="similar" className="cursor-pointer text-sm">
              {t('password.excludeSimilar')}{' '}
              <span className="text-muted-foreground font-mono">
                i I l L o O 0 1
              </span>
            </Label>
          </div>
        </div>

        {/* 生成数量 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              {t('password.batchCount')}
            </Label>
            <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
              {count}
            </span>
          </div>
          <Slider
            min={1}
            max={20}
            step={1}
            value={[count]}
            onValueChange={([v]) => setCount(v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        {noneSelected && (
          <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {t('password.noneSelected')}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={generate} disabled={noneSelected}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {t('password.generate')}
          </Button>
          {passwords.length > 1 && (
            <Button size="sm" variant="outline" onClick={copyAll}>
              {copied === -1 ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {copied === -1 ? t('password.copiedAll') : t('password.copyAll')}
            </Button>
          )}
        </div>
      </div>

      {/* 密码列表 */}
      {passwords.length > 0 && !noneSelected && (
        <div className="space-y-2">
          {passwords.map((pw, idx) => {
            const strength = calcStrength(pw);
            const barCount = STRENGTH_BAR[strength];
            return (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 group"
              >
                {/* 密码文本 */}
                <span className="flex-1 font-mono text-sm break-all select-all">
                  {pw}
                </span>

                {/* 强度指示器 */}
                <div className="flex items-center gap-1 shrink-0">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className={`h-1.5 w-5 rounded-full transition-colors ${
                        n <= barCount ? STRENGTH_COLOR[strength] : 'bg-muted'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 w-8">
                    {t(strengthLabelKey[strength])}
                  </span>
                </div>

                {/* 复制按钮 */}
                <button
                  onClick={() => copyOne(pw, idx)}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={t('password.copyPassword')}
                >
                  {copied === idx ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
