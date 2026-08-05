import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/rot13')({ component: Rot13Page });

function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

const HTML_ENTITIES: [string, string][] = [
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
];

function encodeHtmlEntities(str: string): string {
  return HTML_ENTITIES.reduce((s, [ch, ent]) => s.replaceAll(ch, ent), str);
}

function decodeHtmlEntities(str: string): string {
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.innerText;
}

function usePair() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };
  return { input, setInput, output, setOutput, error, setError, clear };
}

function PanelLayout({
  state,
  onAction,
  onReverse,
  onClear,
  inputLabel,
  outputLabel,
  inputPlaceholder,
  actionLabel,
  reverseLabel,
}: {
  state: ReturnType<typeof usePair>;
  onAction: () => void;
  onReverse?: () => void;
  onClear: () => void;
  inputLabel: string;
  outputLabel: string;
  inputPlaceholder: string;
  actionLabel: string;
  reverseLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!state.output) return;
    await navigator.clipboard.writeText(state.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
        {reverseLabel && onReverse && (
          <Button size="sm" variant="outline" onClick={onReverse}>
            {reverseLabel}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onClear}>
          清空
        </Button>
      </div>
      {state.error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
            {inputLabel}
          </div>
          <textarea
            className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            value={state.input}
            onChange={(e) => state.setInput(e.target.value)}
            placeholder={inputPlaceholder}
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center bg-muted/50 px-3 py-1.5 border-b">
            <span className="text-xs text-muted-foreground flex-1">
              {outputLabel}
            </span>
            <button
              onClick={copy}
              disabled={!state.output}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {copied ? '已复制 ✓' : '复制'}
            </button>
          </div>
          <textarea
            className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none text-muted-foreground"
            value={state.output}
            readOnly
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

type TabType = 'rot13' | 'entity';

function Rot13Page() {
  const { t } = useTranslation();
  const rot = usePair();
  const entity = usePair();
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'rot13');

  const applyRot13 = () => {
    rot.setError(null);
    try {
      rot.setOutput(rot13(rot.input));
    } catch (e) {
      rot.setError(`ROT13 失败：${(e as Error).message}`);
    }
  };

  const encodeEntity = () => {
    entity.setError(null);
    try {
      entity.setOutput(encodeHtmlEntities(entity.input));
    } catch (e) {
      entity.setError(`编码失败：${(e as Error).message}`);
    }
  };

  const decodeEntity = () => {
    entity.setError(null);
    try {
      entity.setOutput(decodeHtmlEntities(entity.input));
    } catch (e) {
      entity.setError(`解码失败：${(e as Error).message}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('rot13.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('rot13.desc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="rot13">{t('rot13.tabRot13')}</TabsTrigger>
          <TabsTrigger value="entity">{t('rot13.tabEntity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="rot13" className="mt-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('rot13.rot13Note')}
            </p>
            <PanelLayout
              state={rot}
              onAction={applyRot13}
              onClear={rot.clear}
              inputLabel={t('rot13.input')}
              outputLabel={t('rot13.output')}
              inputPlaceholder={t('rot13.rot13Placeholder')}
              actionLabel={t('rot13.applyRot13')}
            />
          </div>
        </TabsContent>

        <TabsContent value="entity" className="mt-4">
          <PanelLayout
            state={entity}
            onAction={encodeEntity}
            onReverse={decodeEntity}
            onClear={entity.clear}
            inputLabel={t('rot13.input')}
            outputLabel={t('rot13.output')}
            inputPlaceholder={t('rot13.entityPlaceholder')}
            actionLabel={t('rot13.encodeEntity')}
            reverseLabel={t('rot13.decodeEntity')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
