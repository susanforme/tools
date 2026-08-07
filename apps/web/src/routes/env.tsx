import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { diffEnv, formatEnv, isSensitiveEnvKey } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/env')({ component: EnvPage });

type Mode = 'format' | 'diff';
const SAMPLE =
  'API_URL=https://example.com\nAPI_TOKEN=secret\nNODE_ENV=production';

function EnvPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'format');
  const [left, setLeft] = useState(SAMPLE);
  const [right, setRight] = useState(
    'API_URL=https://dev.example.com\nNODE_ENV=development',
  );
  const [reveal, setReveal] = useState(false);
  const output = useMemo(() => formatEnv(left, reveal), [left, reveal]);
  const diff = useMemo(() => diffEnv(left, right), [left, right]);
  const displayValue = (key: string, value: string | null) =>
    value === null
      ? '—'
      : !reveal && isSensitiveEnvKey(key)
        ? '********'
        : value;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('envTool.title')}</h1>
      <div className="flex items-center justify-between gap-3">
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList>
            <TabsTrigger value="format">{t('envTool.format')}</TabsTrigger>
            <TabsTrigger value="diff">{t('envTool.diff')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReveal((value) => !value)}
        >
          {reveal ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {t(reveal ? 'envTool.hide' : 'envTool.reveal')}
        </Button>
      </div>
      {mode === 'format' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea
            value={left}
            onChange={(event) => setLeft(event.target.value)}
            className="min-h-[480px] font-mono text-xs"
          />
          <Textarea
            readOnly
            value={output}
            className="min-h-[480px] font-mono text-xs"
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Textarea
              value={left}
              onChange={(event) => setLeft(event.target.value)}
              className="min-h-56 font-mono text-xs"
            />
            <Textarea
              value={right}
              onChange={(event) => setRight(event.target.value)}
              className="min-h-56 font-mono text-xs"
            />
          </div>
          <div className="divide-y rounded-lg border">
            {diff.map((item) => (
              <div
                key={item.key}
                className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[180px_1fr_1fr]"
              >
                <span className="font-mono font-medium">{item.key}</span>
                <span
                  className={
                    item.status === 'right-only' ? 'text-muted-foreground' : ''
                  }
                >
                  {displayValue(item.key, item.left)}
                </span>
                <span
                  className={
                    item.status === 'left-only' ? 'text-muted-foreground' : ''
                  }
                >
                  {displayValue(item.key, item.right)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
