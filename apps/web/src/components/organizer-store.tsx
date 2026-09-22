import { downloadBlob } from '@/lib/download';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function useOrganizerStore<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [data, updateState] = useState(initial);
  const current = useRef(initial);
  const usable = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const storedRaw = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    try {
      const raw = localStorage.getItem(key);
      storedRaw.current = raw;
      if (raw) {
        const envelope: unknown = JSON.parse(raw);
        if (!isBackup(envelope, key) || !validate(envelope.data))
          throw new Error('backupInvalid');
        current.current = envelope.data;
        updateState(envelope.data);
      }
      usable.current = true;
      setReady(true);
    } catch {
      setError('loadFailed');
    }
    return () => {
      usable.current = false;
      mounted.current = false;
      revision.current++;
    };
  }, [key, validate]);
  const setData = useCallback(
    (next: T | ((previous: T) => T)): boolean => {
      try {
        if (!usable.current) throw new Error('loadFailed');
        if (localStorage.getItem(key) !== storedRaw.current)
          throw new Error('changedElsewhere');
        const value =
          typeof next === 'function'
            ? (next as (previous: T) => T)(current.current)
            : next;
        if (!validate(value)) throw new Error('invalid');
        const raw = JSON.stringify({ version: 1, tool: key, data: value });
        localStorage.setItem(key, raw);
        storedRaw.current = raw;
        revision.current++;
        current.current = value;
        updateState(value);
        setError(null);
        return true;
      } catch (cause) {
        setError(
          (cause as Error).message === 'invalid'
            ? 'invalid'
            : (cause as Error).message === 'changedElsewhere'
              ? 'changedElsewhere'
              : 'saveFailed',
        );
        return false;
      }
    },
    [key, validate],
  );
  const backup = () => {
    try {
      const raw =
        localStorage.getItem(key) ??
        JSON.stringify({ version: 1, tool: key, data: current.current });
      downloadBlob(
        new Blob([raw], { type: 'application/json' }),
        `${key}.json`,
      );
    } catch {
      setError('saveFailed');
    }
  };
  const restore = async (file: File) => {
    const operation = ++revision.current;
    try {
      if (file.size > 2_000_000) throw new Error('backupInvalid');
      const raw = await file.text();
      if (!mounted.current || operation !== revision.current) return;
      const envelope: unknown = JSON.parse(raw);
      if (!isBackup(envelope, key) || !validate(envelope.data))
        throw new Error('backupInvalid');
      const serialized = JSON.stringify(envelope);
      localStorage.setItem(key, serialized);
      storedRaw.current = serialized;
      current.current = envelope.data;
      updateState(envelope.data);
      usable.current = true;
      setReady(true);
      setError(null);
    } catch (cause) {
      if (!mounted.current || operation !== revision.current) return;
      setError(
        (cause as Error).message === 'backupInvalid' ||
          cause instanceof SyntaxError
          ? 'backupInvalid'
          : 'saveFailed',
      );
    }
  };
  return { data, setData, ready, error, backup, restore };
}
function isBackup(
  value: unknown,
  key: string,
): value is { version: 1; tool: string; data: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'tool' in value &&
    value.tool === key &&
    'data' in value
  );
}
export function OrganizerFrame({
  title,
  children,
  store,
}: {
  title: string;
  children: ReactNode;
  store: {
    ready: boolean;
    error: string | null;
    backup: () => void;
    restore: (file: File) => Promise<void>;
  };
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={store.backup}>
          {t('organizer.backup')}
        </Button>
        <Button
          variant="outline"
          onClick={() => document.getElementById(id)?.click()}
        >
          {t('organizer.restore')}
        </Button>
        <Input
          id={id}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void store.restore(file);
            event.target.value = '';
          }}
        />
      </div>
      {store.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t(`organizer.${store.error}`)}
        </p>
      )}
      <fieldset disabled={!store.ready} className="min-w-0 space-y-5">
        {children}
      </fieldset>
    </div>
  );
}
export function OrganizerInput({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input {...props} id={id} />
    </div>
  );
}
