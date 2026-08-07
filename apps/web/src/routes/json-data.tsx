import { MonacoTextEditor } from '@/components/monaco-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { jsonToNdjson, ndjsonToJson } from '@/lib/json-data-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/json-data')({ component: JsonDataPage });
type Tool = 'path' | 'lines' | 'patch';
type Direction = 'encode' | 'decode';
type PatchMode = 'generate' | 'apply';
type PathResult = 'value' | 'pointer';

function JsonDataPage() {
  const { t } = useTranslation();
  const [tool, setTool] = useQueryParam<Tool>('tool', StringParam, 'path');
  const [direction, setDirection] = useQueryParam<Direction>(
    'direction',
    StringParam,
    'encode',
  );
  const [patchMode, setPatchMode] = useQueryParam<PatchMode>(
    'patch',
    StringParam,
    'generate',
  );
  const [pathResult, setPathResult] = useQueryParam<PathResult>(
    'result',
    StringParam,
    'value',
  );
  const [input, setInput] = useState('{\n  "users": [{ "name": "Ada" }]\n}');
  const [secondary, setSecondary] = useState('');
  const [path, setPath] = useState('$.users[*].name');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      if (tool === 'path') {
        const { JSONPath } = await import('jsonpath-plus');
        const result = JSONPath({
          path,
          json: JSON.parse(input) as object,
          resultType: pathResult,
          eval: 'safe',
        });
        setOutput(JSON.stringify(result, null, 2));
      } else if (tool === 'lines') {
        setOutput(
          direction === 'encode'
            ? jsonToNdjson(JSON.parse(input))
            : JSON.stringify(ndjsonToJson(input), null, 2),
        );
      } else {
        const patch = await import('fast-json-patch');
        setOutput(
          patchMode === 'generate'
            ? JSON.stringify(
                patch.compare(JSON.parse(input), JSON.parse(secondary)),
                null,
                2,
              )
            : JSON.stringify(
                patch.applyPatch(
                  JSON.parse(input),
                  JSON.parse(secondary),
                  true,
                  false,
                ).newDocument,
                null,
                2,
              ),
        );
      }
    } catch (cause) {
      setError(t('jsonData.failed', { msg: (cause as Error).message }));
    }
  }

  const inputLanguage =
    tool === 'lines' && direction === 'decode' ? 'plaintext' : 'json';
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('jsonData.title')}</h1>
      <Tabs value={tool} onValueChange={(value) => setTool(value as Tool)}>
        <TabsList>
          <TabsTrigger value="path">JSONPath</TabsTrigger>
          <TabsTrigger value="lines">JSON Lines</TabsTrigger>
          <TabsTrigger value="patch">JSON Patch</TabsTrigger>
        </TabsList>
      </Tabs>
      {tool === 'lines' && (
        <Tabs
          value={direction}
          onValueChange={(value) => setDirection(value as Direction)}
        >
          <TabsList>
            <TabsTrigger value="encode">JSON → NDJSON</TabsTrigger>
            <TabsTrigger value="decode">NDJSON → JSON</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {tool === 'patch' && (
        <Tabs
          value={patchMode}
          onValueChange={(value) => setPatchMode(value as PatchMode)}
        >
          <TabsList>
            <TabsTrigger value="generate">{t('jsonData.generate')}</TabsTrigger>
            <TabsTrigger value="apply">{t('jsonData.apply')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {tool === 'path' && (
        <div className="flex max-w-3xl flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-2">
            <Label>JSONPath</Label>
            <Input
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
          </div>
          <Tabs
            value={pathResult}
            onValueChange={(value) => setPathResult(value as PathResult)}
          >
            <TabsList>
              <TabsTrigger value="value">{t('jsonData.values')}</TabsTrigger>
              <TabsTrigger value="pointer">JSON Pointer</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <Button onClick={() => void run()}>{t('jsonData.run')}</Button>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <MonacoTextEditor
            label={t('jsonData.input')}
            language={inputLanguage}
            height={tool === 'patch' ? '300px' : '620px'}
            value={input}
            onChange={setInput}
          />
          {tool === 'patch' && (
            <MonacoTextEditor
              label={
                patchMode === 'generate'
                  ? t('jsonData.target')
                  : t('jsonData.patch')
              }
              language="json"
              height="300px"
              value={secondary}
              onChange={setSecondary}
            />
          )}
        </div>
        <MonacoTextEditor
          readOnly
          label={t('jsonData.result')}
          language={
            tool === 'lines' && direction === 'encode' ? 'plaintext' : 'json'
          }
          height="620px"
          value={output}
        />
      </div>
    </div>
  );
}
