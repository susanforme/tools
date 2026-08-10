import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  cssToTailwindClasses,
  tailwindClassesToCss,
} from '@/lib/css-tailwind';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from '../components/monaco-editor';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/css-tailwind')({
  component: CssTailwindPage,
});

type Mode = 'toCss' | 'toTw';

const SAMPLE_TW =
  'flex items-center justify-between gap-4 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium shadow-md';
const SAMPLE_CSS = `display: flex;
align-items: center;
justify-content: space-between;
gap: 1rem;
padding-left: 1rem;
padding-right: 1rem;
padding-top: 0.5rem;
padding-bottom: 0.5rem;
border-radius: 0.5rem;
background-color: #3b82f6;
color: #ffffff;
font-weight: 500;`;

function CssTailwindPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'toCss');
  const [input, setInput] = useState(SAMPLE_TW);

  const { output, unknown } = useMemo(() => {
    if (mode === 'toCss') {
      const result = tailwindClassesToCss(input);
      return { output: result.css, unknown: result.unknown };
    }
    const result = cssToTailwindClasses(input);
    return { output: result.classes, unknown: result.unknown };
  }, [input, mode]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setInput(next === 'toCss' ? SAMPLE_TW : SAMPLE_CSS);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('cssTailwind.title')}</h1>
      </div>
      <Tabs value={mode} onValueChange={(value) => switchMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="toCss">{t('cssTailwind.toCss')}</TabsTrigger>
          <TabsTrigger value="toTw">{t('cssTailwind.toTw')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setInput(mode === 'toCss' ? SAMPLE_TW : SAMPLE_CSS)}
      >
        {t('cssTailwind.sample')}
      </Button>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={
            mode === 'toCss'
              ? t('cssTailwind.classes')
              : t('cssTailwind.css')
          }
          language={mode === 'toCss' ? 'plaintext' : 'css'}
          height="360px"
          value={input}
          onChange={setInput}
        />
        <MonacoTextEditor
          readOnly
          label={
            mode === 'toCss'
              ? t('cssTailwind.css')
              : t('cssTailwind.classes')
          }
          language={mode === 'toCss' ? 'css' : 'plaintext'}
          height="360px"
          value={output}
        />
      </div>
      {unknown.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('cssTailwind.unknown')}: {unknown.join(', ')}
        </p>
      )}
    </div>
  );
}
