import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { SnowflakePanel } from '@/components/protocol-tool-panels';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { customAlphabet, nanoid } from 'nanoid';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ulid } from 'ulid';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/uuid')({ component: UuidPage });

type TabType = 'uuid' | 'nanoid' | 'ulid' | 'snowflake';

const NANO_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
const makeNanoid = customAlphabet(NANO_ALPHABET);

function generateUUID(): string {
  return crypto.randomUUID();
}

function generateNanoid(length: number): string {
  return length === 21 ? nanoid() : makeNanoid(length);
}

function CopyButton({
  text,
  size = 'sm',
}: {
  text: string;
  size?: 'sm' | 'xs';
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const cls = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <Check className={`${cls} text-green-500`} />
      ) : (
        <Copy className={cls} />
      )}
    </button>
  );
}

function IdList({
  ids,
  display,
  resultLabel,
}: {
  ids: string[];
  display: (id: string) => string;
  resultLabel: string;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{resultLabel}</span>
      </div>
      <div className="divide-y max-h-[60vh] overflow-y-auto">
        {ids.map((id, i) => (
          <div
            key={i}
            className="flex items-center px-3 py-2 hover:bg-muted/30 group"
          >
            <span className="text-xs text-muted-foreground/50 w-8 shrink-0 tabular-nums">
              {i + 1}
            </span>
            <span className="font-mono text-sm flex-1 select-all">
              {display(id)}
            </span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={display(id)} size="xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UuidTab() {
  const { t } = useTranslation();
  const [uuids, setUuids] = useState<string[]>(() => [generateUUID()]);
  const [count, setCount] = useState(1);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [allCopied, setAllCopied] = useState(false);

  const transformUuid = (uuid: string) => {
    let result = uuid;
    if (!hyphens) result = result.replace(/-/g, '');
    if (uppercase) result = result.toUpperCase();
    return result;
  };

  const generate = () => {
    setUuids(Array.from({ length: count }, () => generateUUID()));
  };

  const addMore = () => {
    const newOnes = Array.from({ length: count }, () => generateUUID());
    setUuids((prev) => [...prev, ...newOnes]);
  };

  const clear = () => setUuids([]);

  const copyAll = async () => {
    await navigator.clipboard.writeText(uuids.map(transformUuid).join('\n'));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            {t('uuid.count')}:
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) =>
              setCount(
                Math.max(1, Math.min(100, parseInt(e.target.value) || 1)),
              )
            }
            className="w-20 px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={uppercase}
            onChange={(e) => setUppercase(e.target.checked)}
          />
          {t('uuid.uppercase')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hyphens}
            onChange={(e) => setHyphens(e.target.checked)}
          />
          {t('uuid.hyphens')}
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {t('uuid.generate')}
        </Button>
        <Button size="sm" variant="outline" onClick={addMore}>
          {t('uuid.addMore')}
        </Button>
        {uuids.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={copyAll}>
              {allCopied ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t('uuid.copyAll')}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('uuid.clear')}
            </Button>
          </>
        )}
      </div>

      <IdList
        ids={uuids}
        display={transformUuid}
        resultLabel={t('uuid.result', { count: uuids.length })}
      />
    </div>
  );
}

function NanoidTab() {
  const { t } = useTranslation();
  const [ids, setIds] = useState<string[]>(() => [generateNanoid(21)]);
  const [count, setCount] = useState(1);
  const [length, setLength] = useState(21);
  const [allCopied, setAllCopied] = useState(false);

  const clampLength = (value: number) => Math.max(8, Math.min(64, value));

  const generate = () => {
    const size = clampLength(length);
    setIds(Array.from({ length: count }, () => generateNanoid(size)));
  };

  const addMore = () => {
    const size = clampLength(length);
    const newOnes = Array.from({ length: count }, () => generateNanoid(size));
    setIds((prev) => [...prev, ...newOnes]);
  };

  const clear = () => setIds([]);

  const copyAll = async () => {
    await navigator.clipboard.writeText(ids.join('\n'));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            {t('uuid.count')}:
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) =>
              setCount(
                Math.max(1, Math.min(100, parseInt(e.target.value) || 1)),
              )
            }
            className="w-20 px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            {t('uuid.length')}:
          </label>
          <input
            type="number"
            min={8}
            max={64}
            value={length}
            onChange={(e) =>
              setLength(clampLength(parseInt(e.target.value) || 21))
            }
            className="w-20 px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">8–64</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {t('uuid.generate')}
        </Button>
        <Button size="sm" variant="outline" onClick={addMore}>
          {t('uuid.addMore')}
        </Button>
        {ids.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={copyAll}>
              {allCopied ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t('uuid.copyAll')}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('uuid.clear')}
            </Button>
          </>
        )}
      </div>

      <IdList
        ids={ids}
        display={(id) => id}
        resultLabel={t('uuid.result', { count: ids.length })}
      />
    </div>
  );
}

function UlidTab() {
  const { t } = useTranslation();
  const [ids, setIds] = useState<string[]>(() => [ulid()]);
  const [count, setCount] = useState(1);
  const [allCopied, setAllCopied] = useState(false);

  const generate = () => {
    setIds(Array.from({ length: count }, () => ulid()));
  };

  const addMore = () => {
    const newOnes = Array.from({ length: count }, () => ulid());
    setIds((prev) => [...prev, ...newOnes]);
  };

  const clear = () => setIds([]);

  const copyAll = async () => {
    await navigator.clipboard.writeText(ids.join('\n'));
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            {t('uuid.count')}:
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) =>
              setCount(
                Math.max(1, Math.min(100, parseInt(e.target.value) || 1)),
              )
            }
            className="w-20 px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {t('uuid.generate')}
        </Button>
        <Button size="sm" variant="outline" onClick={addMore}>
          {t('uuid.addMore')}
        </Button>
        {ids.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={copyAll}>
              {allCopied ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t('uuid.copyAll')}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('uuid.clear')}
            </Button>
          </>
        )}
      </div>

      <IdList
        ids={ids}
        display={(id) => id}
        resultLabel={t('uuid.result', { count: ids.length })}
      />
    </div>
  );
}

function UuidPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'uuid');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('uuid.title')}</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="uuid">UUID</TabsTrigger>
          <TabsTrigger value="nanoid">NanoID</TabsTrigger>
          <TabsTrigger value="ulid">ULID</TabsTrigger>
          <TabsTrigger value="snowflake">Snowflake</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'uuid' && <UuidTab />}
      {tab === 'nanoid' && <NanoidTab />}
      {tab === 'ulid' && <UlidTab />}
      {tab === 'snowflake' && <SnowflakePanel />}
    </div>
  );
}
