import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { decryptTotpSecret, encryptTotpSecret } from '@/lib/totp-share';
import { base32 } from '@otplib/plugin-base32-scure';
import { crypto as webCrypto } from '@otplib/plugin-crypto-web';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Eye, EyeOff, Share2, Trash2 } from 'lucide-react';
import { generate } from 'otplib';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/totp')({ component: TotpPage });

const PERIOD_SECONDS = 30;

function normalizeSecret(secret: string): string {
  return secret.replace(/[\s-]/g, '').toUpperCase();
}

function TotpPage() {
  const { t } = useTranslation();
  const [sharedSecret, setSharedSecret] = useQueryParam('secret', StringParam);
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);

  const normalizedSecret = useMemo(() => normalizeSecret(secret), [secret]);
  const timeStep = Math.floor(now / PERIOD_SECONDS);
  const remaining = PERIOD_SECONDS - (now % PERIOD_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sharedSecret) return;
    let cancelled = false;
    decryptTotpSecret(sharedSecret)
      .then((value) => {
        if (!cancelled) {
          setSecret(value);
          setShareError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setShareError(t('totp.invalidShare'));
      });
    return () => {
      cancelled = true;
    };
  }, [sharedSecret, t]);

  useEffect(() => {
    if (!normalizedSecret) {
      setToken('');
      setError(null);
      return;
    }
    let cancelled = false;
    generate({
      secret: normalizedSecret,
      crypto: webCrypto,
      base32,
      epoch: timeStep * PERIOD_SECONDS,
    })
      .then((value) => {
        if (!cancelled) {
          setToken(value);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setToken('');
          setError(t('totp.generateError', { msg: (e as Error).message }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [normalizedSecret, timeStep, t]);

  const updateSecret = (value: string) => {
    setSecret(value);
    setShareError(null);
    setShared(false);
    if (sharedSecret) setSharedSecret(null);
  };

  const clear = () => {
    setSecret('');
    setToken('');
    setError(null);
    setShareError(null);
    setShared(false);
    setSharedSecret(null);
  };

  const copyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  const share = async () => {
    if (!normalizedSecret) return;
    setSharing(true);
    setShareError(null);
    try {
      const encrypted = await encryptTotpSecret(normalizedSecret);
      const url = new URL(window.location.href);
      url.searchParams.set('secret', encrypted);
      setSharedSecret(encrypted);
      await navigator.clipboard.writeText(url.toString());
      setShared(true);
      window.setTimeout(() => setShared(false), 2_000);
    } catch (e) {
      setShareError(t('totp.shareError', { msg: (e as Error).message }));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('totp.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('totp.desc')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="totp-secret">{t('totp.secret')}</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="totp-secret"
              type={showSecret ? 'text' : 'password'}
              value={secret}
              onChange={(event) => updateSecret(event.target.value)}
              placeholder={t('totp.secretPlaceholder')}
              className="pr-10 font-mono"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowSecret((value) => !value)}
              aria-label={
                showSecret ? t('totp.hideSecret') : t('totp.showSecret')
              }
              className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showSecret ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={clear}>
            <Trash2 />
            <span className="sr-only">{t('totp.clear')}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('totp.secretHint')}</p>
      </div>

      {(error || shareError) && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error || shareError}
        </div>
      )}

      <div className="border rounded-xl p-6 space-y-5 text-center bg-card">
        <div className="text-sm text-muted-foreground">{t('totp.code')}</div>
        <button
          type="button"
          onClick={copyToken}
          disabled={!token}
          className="font-mono text-4xl md:text-5xl font-bold tracking-[0.22em] tabular-nums disabled:text-muted-foreground"
        >
          {token ? `${token.slice(0, 3)} ${token.slice(3)}` : '——— ———'}
        </button>
        <div className="space-y-2">
          <progress
            value={remaining}
            max={PERIOD_SECONDS}
            className="w-full h-2 accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            {t('totp.remaining', { seconds: remaining })}
          </p>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={copyToken}
            disabled={!token}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? t('totp.copied') : t('totp.copy')}
          </Button>
          <Button type="button" onClick={share} disabled={!token || sharing}>
            {shared ? <Check /> : <Share2 />}
            {shared
              ? t('totp.shared')
              : sharing
                ? t('totp.sharing')
                : t('totp.share')}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {t('totp.securityNote')}
      </p>
    </div>
  );
}
