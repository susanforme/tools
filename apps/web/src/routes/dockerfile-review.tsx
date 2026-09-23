import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/dockerfile-review')({
  component: DockerfileReview,
});

function DockerfileReview() {
  const { t } = useTranslation();
  const [source, setSource] = useState(
    'FROM node:22 AS build\nWORKDIR /app\nCOPY package.json bun.lock ./\nRUN bun install\nCOPY . .\nRUN bun run build',
  );
  const [changed, setChanged] = useState(4);
  const instructions = useMemo(
    () =>
      source
        .replace(/\\\r?\n/g, ' ')
        .split(/\r?\n/)
        .map((text, index) => ({ text: text.trim(), line: index + 1 }))
        .filter(
          ({ text }) =>
            text && !text.startsWith('#') && /^[A-Za-z]+\s/.test(text),
        ),
    [source],
  );
  const selected = Math.min(Math.max(changed, 1), instructions.length);
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('newTools.dockerfile')}</h1>
      <Textarea
        aria-label="Dockerfile"
        className="min-h-64 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <div className="max-w-52 space-y-2">
        <Label htmlFor="changed-layer">{t('newTools.changedLayer')}</Label>
        <Input
          id="changed-layer"
          type="number"
          min={1}
          max={instructions.length || 1}
          value={changed}
          onChange={(event) => setChanged(Number(event.target.value))}
        />
      </div>
      <div className="space-y-2">
        {instructions.map(({ text, line }, index) => (
          <div
            key={line}
            className={`rounded-md border p-3 font-mono text-xs ${index + 1 >= selected ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : ''}`}
          >
            <span className="mr-3 text-muted-foreground">{line}</span>
            {text}
            <span className="ml-3 font-sans">
              {index + 1 >= selected
                ? t('newTools.cacheInvalidated')
                : t('newTools.cacheReusable')}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('newTools.dockerCaveat')}
      </p>
    </main>
  );
}
