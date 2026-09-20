import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { downloadBlob } from '@/lib/download';
import {
  ACCESSIBILITY_TIMEOUT_MS,
  MAX_ACCESSIBILITY_HTML,
  createAccessibilityDocument,
  readAccessibilityMessage,
  type AccessibilityReport,
  type AccessibilityRule,
} from '@/lib/html-accessibility';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SAMPLE_HTML = `<!doctype html>
<html lang="zh-CN">
<head><title>示例页面</title></head>
<body>
  <main>
    <h1>联系我们</h1>
    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
    <input type="email">
    <button></button>
  </main>
</body>
</html>`;

export default function HtmlAccessibilityPanel() {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState(SAMPLE_HTML);
  const [busy, setBusy] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ nonce: string; source: string } | null>(
    null,
  );
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const nonceRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = (): void => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const reset = (): void => {
    nonceRef.current = null;
    clearTimer();
    setFrame(null);
    setReport(null);
    setError(null);
    setBusy(false);
    setCanceled(false);
  };

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>): void => {
      if (!nonceRef.current) return;
      const message = readAccessibilityMessage(
        event,
        iframeRef.current?.contentWindow ?? null,
        nonceRef.current,
      );
      if (!message) return;
      clearTimer();
      setBusy(false);
      if (message.type === 'accessibility-result') setReport(message.report);
      else {
        setError(
          t('htmlAccessibility.failed', {
            message:
              message.error === 'TOO_MANY_NODES'
                ? t('htmlAccessibility.tooMany')
                : message.error,
          }),
        );
        nonceRef.current = null;
        setFrame(null);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [t]);
  useEffect(
    () => () => {
      nonceRef.current = null;
      clearTimer();
    },
    [],
  );

  const run = async (): Promise<void> => {
    reset();
    if (input.length > MAX_ACCESSIBILITY_HTML) {
      setError(
        t('htmlAccessibility.failed', {
          message: t('htmlAccessibility.tooLarge'),
        }),
      );
      return;
    }
    const nonce = crypto.randomUUID();
    nonceRef.current = nonce;
    setBusy(true);
    timerRef.current = setTimeout(() => {
      if (nonceRef.current !== nonce) return;
      nonceRef.current = null;
      timerRef.current = null;
      setBusy(false);
      setFrame(null);
      setError(
        t('htmlAccessibility.failed', {
          message: t('htmlAccessibility.timeout'),
        }),
      );
    }, ACCESSIBILITY_TIMEOUT_MS);
    try {
      const [axe, purifier, locale] = await Promise.all([
        // 保留官方浏览器包源码，避免生产 minifier 改写 axe.source 闭包。
        import('axe-core/axe.min.js?raw'),
        import('dompurify/purify.min.js?raw'),
        i18n.resolvedLanguage?.startsWith('zh')
          ? import('axe-core/locales/zh_CN.json')
          : Promise.resolve(null),
      ]);
      if (nonceRef.current !== nonce) return;
      const source = createAccessibilityDocument({
        html: input,
        nonce,
        axeSource: axe.default,
        purifierSource: purifier.default,
        locale: locale?.default ?? null,
      });
      setFrame({ nonce, source });
    } catch (caught) {
      if (nonceRef.current !== nonce) return;
      nonceRef.current = null;
      clearTimer();
      setBusy(false);
      setFrame(null);
      setError(
        t('htmlAccessibility.failed', { message: (caught as Error).message }),
      );
    }
  };

  const rules = (items: AccessibilityRule[]): React.ReactNode =>
    items.map((rule) => (
      <details
        key={rule.id}
        className="rounded-md border p-3"
        open={items.length <= 3}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {rule.help}{' '}
          <Badge variant="secondary">
            {t(`htmlAccessibility.${rule.impact ?? 'unknown'}`)}
          </Badge>
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <code>{rule.id}</code>
            <span>
              {t('htmlAccessibility.nodes', { count: rule.nodeCount })}
            </span>
            {/^https:\/\/dequeuniversity\.com\//.test(rule.helpUrl) && (
              <a
                className="underline"
                href={rule.helpUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('htmlAccessibility.docs')}
              </a>
            )}
          </div>
          {rule.nodes.map((node, index) => (
            <div key={index} className="space-y-2 rounded-md bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <code className="break-all text-xs">
                  {node.target.join(' → ')}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!nonceRef.current) return;
                    iframeRef.current?.scrollIntoView({ block: 'nearest' });
                    iframeRef.current?.contentWindow?.postMessage(
                      {
                        type: 'accessibility-locate',
                        nonce: nonceRef.current,
                        target: node.target,
                      },
                      '*',
                    );
                  }}
                >
                  {t('htmlAccessibility.locate')}
                </Button>
              </div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all text-xs">
                {node.html}
              </pre>
              <p className="whitespace-pre-wrap text-sm">{node.summary}</p>
            </div>
          ))}
          {rule.nodeCount > rule.nodes.length && (
            <p className="text-xs text-muted-foreground">
              {t('htmlAccessibility.truncated', { count: rule.nodes.length })}
            </p>
          )}
        </div>
      </details>
    ));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="accessibility-html">
          {t('htmlAccessibility.input')}
        </Label>
        <Textarea
          id="accessibility-html"
          value={input}
          onChange={(event) => {
            reset();
            setInput(event.target.value);
          }}
          className="min-h-64 font-mono text-sm"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !input.trim()} onClick={() => void run()}>
          {t(busy ? 'htmlAccessibility.checking' : 'htmlAccessibility.run')}
        </Button>
        {busy && (
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setCanceled(true);
            }}
          >
            {t('htmlAccessibility.cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            reset();
            setInput('');
          }}
        >
          {t('htmlAccessibility.clear')}
        </Button>
        {report && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(report, null, 2)], {
                  type: 'application/json',
                }),
                'html-accessibility.json',
              )
            }
          >
            {t('htmlAccessibility.export')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('htmlAccessibility.note')}
      </p>
      <p className="text-xs text-muted-foreground">
        {t('htmlAccessibility.limits')}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {canceled && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('htmlAccessibility.canceled')}
        </p>
      )}
      {frame && (
        <iframe
          key={frame.nonce}
          ref={iframeRef}
          title={t('htmlAccessibility.preview')}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={frame.source}
          className="h-80 w-full rounded-md border bg-white"
        />
      )}
      {report && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('htmlAccessibility.passes', {
              count: report.passes,
              version: report.version,
            })}
          </p>
          <h2 className="font-semibold">
            {t('htmlAccessibility.violations', {
              count: report.violations.length,
            })}
          </h2>
          {report.violations.length ? (
            rules(report.violations)
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('htmlAccessibility.empty')}
            </p>
          )}
          <h2 className="font-semibold">
            {t('htmlAccessibility.incomplete', {
              count: report.incomplete.length,
            })}
          </h2>
          {rules(report.incomplete)}
        </div>
      )}
    </div>
  );
}
