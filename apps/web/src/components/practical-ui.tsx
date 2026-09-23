import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PracticalToolId } from '@/lib/practical-tool-catalog';
import { downloadBlob } from '@/lib/download';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

export function PracticalFrame({
  id,
  children,
  error,
}: {
  id: PracticalToolId;
  children: ReactNode;
  error?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">
          {t(`studio20.tools.${id}.title`)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`studio20.tools.${id}.description`)}
        </p>
      </header>
      {children}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t('studio20.error', {
            message: t(`studio20.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
    </div>
  );
}
export function PracticalText({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  maxLength = 100000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          className="min-h-40 font-mono"
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
export function ExportText({
  value,
  name,
  type = 'text/plain',
}: {
  value: string;
  name: string;
  type?: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={() => downloadBlob(new Blob([value], { type }), name)}
      >
        {t('studio20.download')}
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setStatus(t('studio20.copied'));
          } catch (cause) {
            setStatus(
              t('studio20.error', { message: (cause as Error).message }),
            );
          }
        }}
      >
        {t('studio20.copy')}
      </Button>
      <span role="status" className="text-sm">
        {status}
      </span>
    </div>
  );
}
/** 非 Worker 的浏览器 API 共用失效令牌，输入变更与离页后丢弃旧结果。 */
export function useLatestJob<T>(key: string) {
  const currentKey = useRef(key);
  const revision = useRef(0);
  if (currentKey.current !== key) {
    revision.current++;
    currentKey.current = key;
  }
  const mounted = useRef(true);
  const [state, setState] = useState<{
    key: string;
    result: T | null;
    error: string | null;
    busy: boolean;
    ticket: number;
  }>({ key, result: null, error: null, busy: false, ticket: 0 });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current++;
    };
  }, []);
  const run = async (work: () => Promise<T>): Promise<void> => {
    const ticket = ++revision.current;
    setState({ key, result: null, error: null, busy: true, ticket });
    try {
      const result = await work();
      if (
        mounted.current &&
        ticket === revision.current &&
        currentKey.current === key
      )
        setState({ key, result, error: null, busy: false, ticket });
    } catch (cause) {
      if (
        mounted.current &&
        ticket === revision.current &&
        currentKey.current === key
      )
        setState({
          key,
          result: null,
          error: (cause as Error).message,
          busy: false,
          ticket,
        });
    }
  };
  return {
    result:
      state.key === key && state.ticket === revision.current
        ? state.result
        : null,
    error:
      state.key === key && state.ticket === revision.current
        ? state.error
        : null,
    busy: state.key === key && state.ticket === revision.current && state.busy,
    run,
  };
}
