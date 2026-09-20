import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropzone } from '../components/file-dropzone';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '../hooks/useQueryParams';
import type { TokensRequest, TokensResult } from '../lib/design-tokens';

export const Route = createFileRoute('/design-tokens')({
  component: DesignTokensPage,
});
const QUERY = {
  prefix: withDefault<string>(StringParam, 'token'),
  q: withDefault<string>(StringParam, ''),
};
const createWorker = () =>
  new Worker(new URL('../workers/design-tokens.worker.ts', import.meta.url), {
    type: 'module',
  });
const SAMPLE = JSON.stringify(
  {
    palette: {
      $type: 'color',
      blue: { $value: { colorSpace: 'srgb', components: [0.12, 0.36, 0.9] } },
      primary: { $value: '{palette.blue}' },
    },
    spacing: {
      $type: 'dimension',
      small: { $value: { value: 8, unit: 'px' } },
      medium: { $value: { value: 1, unit: 'rem' } },
    },
    border: {
      $type: 'border',
      $value: {
        color: '{palette.primary}',
        width: { value: 1, unit: 'px' },
        style: 'solid',
      },
    },
  },
  null,
  2,
);
function DesignTokensPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ prefix: string; q: string }>(
    QUERY,
  );
  const prefix = query.prefix ?? 'token';
  const search = query.q ?? '';
  const [text, setText] = useState(SAMPLE);
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const { result, error, busy, run, cancel, clear } = useBoundedWorker<
    TokensRequest,
    TokensResult
  >(createWorker, 15000);
  useEffect(() => {
    clear();
    setCopied(false);
  }, [prefix, clear]);
  useEffect(() => {
    setPage(0);
  }, [search, result]);
  const tokens =
    result?.tokens.filter((token) =>
      `${token.path} ${token.type}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(tokens.length / 40));
  const currentPage = Math.min(page, pages - 1);
  const updateText = (value: string) => {
    setText(value);
    setFile(null);
    clear();
    setCopied(false);
  };
  const download = () => {
    if (!result?.css) return;
    const url = URL.createObjectURL(
      new Blob([result.css], { type: 'text/css;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'design-tokens.css';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const errorText = (code: string) =>
    t(`designTokens.errors.${code}`, { defaultValue: code });
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('designTokens.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('designTokens.description')}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('designTokens.limits')}
      </p>
      <FileDropzone
        accept=".json,.tokens,application/json"
        onFiles={(files) => {
          const next = files[0]?.file;
          if (!next) return;
          setFile(next);
          setText('');
          setCopied(false);
          run({ file: next, prefix });
        }}
      >
        <span className="break-all">
          {file?.name ?? t('designTokens.upload')}
        </span>
      </FileDropzone>
      <div className="space-y-2">
        <Label htmlFor="tokens-json">{t('designTokens.input')}</Label>
        <Textarea
          id="tokens-json"
          className="min-h-60 font-mono text-xs"
          value={text}
          onChange={(event) => updateText(event.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full space-y-2 sm:w-60">
          <Label htmlFor="tokens-prefix">{t('designTokens.prefix')}</Label>
          <Input
            id="tokens-prefix"
            value={prefix}
            onChange={(event) => setQuery({ prefix: event.target.value })}
          />
        </div>
        <Button
          onClick={() => {
            setCopied(false);
            run(file ? { file, prefix } : { text, prefix });
          }}
          disabled={busy || (!file && !text.trim())}
        >
          {t(busy ? 'designTokens.busy' : 'designTokens.process')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {t('designTokens.cancel')}
          </Button>
        )}
        <Button variant="outline" onClick={() => updateText(SAMPLE)}>
          {t('designTokens.sample')}
        </Button>
        <Button variant="ghost" onClick={() => updateText('')}>
          {t('designTokens.clear')}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="break-all rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t('designTokens.failed', { message: errorText(error) })}
        </p>
      )}
      {result && (
        <>
          <p
            role="status"
            className={
              result.issues.length ? 'text-sm text-destructive' : 'text-sm'
            }
          >
            {t(
              result.issues.length
                ? 'designTokens.invalid'
                : 'designTokens.valid',
              { count: result.issues.length || result.tokens.length },
            )}
          </p>
          {!!result.issues.length && (
            <ul className="max-h-64 space-y-2 overflow-auto rounded-md border border-destructive/30 p-3 text-sm">
              {result.issues.map((issue, index) => (
                <li key={index} className="break-all">
                  <span className="font-mono">{issue.path || '/'}</span> —{' '}
                  {errorText(issue.code)}
                  {issue.detail && `: ${issue.detail}`}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            <Label htmlFor="tokens-search">{t('designTokens.preview')}</Label>
            <Input
              id="tokens-search"
              placeholder={t('designTokens.search')}
              value={search}
              onChange={(event) => setQuery({ q: event.target.value })}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tokens
              .slice(currentPage * 40, (currentPage + 1) * 40)
              .map((token) => (
                <div
                  key={token.path}
                  className="min-w-0 space-y-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="break-all font-mono text-sm">
                      {token.path}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {token.type}
                    </span>
                  </div>
                  {token.color && (
                    <svg
                      role="img"
                      aria-label={token.color}
                      width="100%"
                      height="36"
                    >
                      <rect
                        width="100%"
                        height="36"
                        rx="4"
                        fill={token.color}
                      />
                    </svg>
                  )}
                  {token.spacing !== null && (
                    <svg
                      role="img"
                      aria-label={`${token.spacing} px`}
                      width="100%"
                      height="18"
                    >
                      <rect
                        width={Math.min(240, Math.abs(token.spacing))}
                        height="18"
                        rx="2"
                        className="fill-primary"
                      />
                    </svg>
                  )}
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
                    {token.css}
                  </pre>
                </div>
              ))}
          </div>
          {!tokens.length && (
            <p className="text-sm text-muted-foreground">
              {t('designTokens.empty')}
            </p>
          )}
          {pages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                {t('designTokens.previous')}
              </Button>
              <span className="text-sm">
                {t('designTokens.page', {
                  page: currentPage + 1,
                  total: pages,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                {t('designTokens.next')}
              </Button>
            </div>
          )}
          {!!result.css && (
            <div className="space-y-2">
              <Label htmlFor="tokens-css">{t('designTokens.output')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('designTokens.exportHint')}
              </p>
              <Textarea
                id="tokens-css"
                readOnly
                value={result.css}
                className="min-h-48 font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(result.css)
                      .then(() => setCopied(true))
                      .catch(() => setCopied(false));
                  }}
                >
                  {t(copied ? 'designTokens.copied' : 'designTokens.copy')}
                </Button>
                <Button variant="outline" onClick={download}>
                  {t('designTokens.download')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
