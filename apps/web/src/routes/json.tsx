import { HistoryPanel } from '@/components/history-panel';
import { JqPanel, JsonGraphPanel } from '@/components/community-tool-panels';
import { MonacoTextEditor } from '@/components/monaco-editor';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { JsonSchemaExamplePanel } from '@/components/protocol-tool-panels';
import { JcsPanel } from '@/components/modern-web-tool-panels';
import { useToolHistory } from '@/hooks/useToolHistory';
import { useToolPreference } from '@/hooks/useToolPreference';
import {
  exampleFromSchema,
  inferJsonSchema,
  jsonSchemaToInterface,
  jsonSchemaToTypeScript,
  jsonSchemaToZod,
} from '@/lib/developer-tools';
import { jsonToLanguageTypes, type CodeLanguage } from '@/lib/advanced-tools';
import { jsonToNdjson, ndjsonToJson } from '@/lib/json-data-tools';
import { createFileRoute } from '@tanstack/react-router';
import type { AnySchema } from 'ajv';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';

export const Route = createFileRoute('/json')({
  component: JsonPage,
});

// ─── types ─────────────────────────────────────────────────

type Tab =
  | 'format'
  | 'tree'
  | 'schema'
  | 'path'
  | 'lines'
  | 'patch'
  | 'example'
  | 'jcs'
  | 'jq'
  | 'graph';
type Indent = '2' | '4' | 'tab';
type SchemaMode = 'infer' | 'validate' | 'types';
type SchemaSource = 'json' | 'schema';
type SchemaOutput = 'typescript' | 'interface' | 'zod' | CodeLanguage;
type Direction = 'encode' | 'decode';
type PatchMode = 'generate' | 'apply';
type PathResult = 'value' | 'pointer';
type OnSuccessCallback = (input: string, output: string) => void;

const DEFAULT_JSON = `{
  "name": "Alice",
  "age": 30,
  "skills": ["TypeScript", "React"],
  "address": { "city": "Shanghai", "zip": "200000" }
}`;

const SAMPLE_SCHEMA_JSON = JSON.stringify(
  { id: 1, name: 'Breeze', active: true, tags: ['tools'] },
  null,
  2,
);

const SEGMENT_ITEM_CLASS =
  'px-4 data-[state=on]:border-blue-500 data-[state=on]:bg-blue-50 data-[state=on]:text-blue-600 dark:data-[state=on]:bg-blue-950/40 dark:data-[state=on]:text-blue-400';

// ─── page ──────────────────────────────────────────────────

function JsonPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<Tab>('tab', StringParam, 'format');

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('json.title')}</h1>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList variant="line" className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="format">{t('json.tabFormat')}</TabsTrigger>
          <TabsTrigger value="tree">{t('json.tabTree')}</TabsTrigger>
          <TabsTrigger value="schema">{t('json.tabSchema')}</TabsTrigger>
          <TabsTrigger value="path">{t('json.tabPath')}</TabsTrigger>
          <TabsTrigger value="lines">{t('json.tabLines')}</TabsTrigger>
          <TabsTrigger value="patch">{t('json.tabPatch')}</TabsTrigger>
          <TabsTrigger value="example">
            {t('protocol.tabs.schemaExample')}
          </TabsTrigger>
          <TabsTrigger value="jcs">JCS</TabsTrigger>
          <TabsTrigger value="jq">jq</TabsTrigger>
          <TabsTrigger value="graph">{t('json.tabGraph')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'format' && <FormatPanel />}
      {tab === 'tree' && <TreePanel />}
      {tab === 'schema' && <SchemaPanel />}
      {tab === 'path' && <PathPanel />}
      {tab === 'lines' && <LinesPanel />}
      {tab === 'patch' && <PatchPanel />}
      {tab === 'example' && <JsonSchemaExamplePanel />}
      {tab === 'jcs' && <JcsPanel />}
      {tab === 'jq' && <JqPanel />}
      {tab === 'graph' && <JsonGraphPanel />}
    </div>
  );
}

function JsonTreeNode({
  name,
  value,
  depth = 0,
}: {
  name: string;
  value: unknown;
  depth?: number;
}) {
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    const bracket = Array.isArray(value) ? '[]' : '{}';
    return (
      <details open={depth === 0} className="ml-4 border-l pl-3">
        <summary className="cursor-pointer py-1 font-mono text-sm">
          <span className="text-blue-600 dark:text-blue-400">{name}</span>{' '}
          <span className="text-muted-foreground">
            {bracket} {entries.length}
          </span>
        </summary>
        {entries.map(([key, item]) => (
          <JsonTreeNode key={key} name={key} value={item} depth={depth + 1} />
        ))}
      </details>
    );
  }
  return (
    <div className="ml-4 border-l py-1 pl-3 font-mono text-sm">
      <span className="text-blue-600 dark:text-blue-400">{name}</span>
      <span className="text-muted-foreground">: </span>
      <span className="break-all text-emerald-600 dark:text-emerald-400">
        {JSON.stringify(value)}
      </span>
    </div>
  );
}

function TreePanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(DEFAULT_JSON);
  const [value, setValue] = useState<unknown>(JSON.parse(DEFAULT_JSON));
  const [error, setError] = useState<string | null>(null);
  const render = () => {
    setError(null);
    try {
      setValue(JSON.parse(input));
    } catch (cause) {
      setError(t('json.parseError', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Button size="sm" onClick={render}>
        {t('json.renderTree')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('jsonData.input')}
          language="json"
          height="520px"
          value={input}
          onChange={setInput}
        />
        <div className="h-[520px] overflow-auto rounded-xl border p-4">
          <JsonTreeNode name="$" value={value} />
        </div>
      </div>
    </div>
  );
}

// ─── format ────────────────────────────────────────────────

function FormatPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(DEFAULT_JSON);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const {
    pref: [preference, setPreference],
    ready,
  } = useToolPreference({
    indent: '2',
  });
  const { indent } = preference;
  const { add } = useToolHistory();

  if (!ready) return null;

  const parse = () => {
    try {
      return JSON.parse(input);
    } catch (e) {
      setError(t('json.parseError', { msg: (e as Error).message }));
      setOutput('');
      return null;
    }
  };

  const format = (callback: OnSuccessCallback) => {
    setError(null);
    const parsed = parse();
    if (parsed === null && input.trim() !== 'null') return;
    try {
      const indentValue = indent === 'tab' ? '\t' : Number(indent);
      const next = JSON.stringify(parsed, null, indentValue);
      setOutput(next);
      callback(input, next);
    } catch (e) {
      setError(t('json.formatError', { msg: (e as Error).message }));
    }
  };

  const minify = (callback: OnSuccessCallback) => {
    setError(null);
    const parsed = parse();
    if (parsed === null && input.trim() !== 'null') return;
    try {
      const next = JSON.stringify(parsed);
      setOutput(next);
      callback(input, next);
    } catch (e) {
      setError(t('json.minifyError', { msg: (e as Error).message }));
    }
  };

  const validate = () => {
    setError(null);
    try {
      JSON.parse(input);
      setOutput(t('json.valid'));
    } catch (e) {
      setError(t('json.validateError', { msg: (e as Error).message }));
      setOutput('');
    }
  };

  const wrappedFn = (fn: (callback: OnSuccessCallback) => void) => () => {
    fn((nextInput, nextOutput) => {
      add({
        input: nextInput,
        output: nextOutput,
        preference,
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('json.indent')}
          </span>
          <Select
            value={indent}
            onValueChange={(value) => {
              setPreference({ indent: value as Indent });
            }}
          >
            <SelectTrigger className="h-8 w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">{t('json.spaces', { n: 2 })}</SelectItem>
              <SelectItem value="4">{t('json.spaces', { n: 4 })}</SelectItem>
              <SelectItem value="tab">{t('json.tab')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" onClick={wrappedFn(format)}>
          {t('json.format')}
        </Button>
        <Button size="sm" variant="secondary" onClick={wrappedFn(minify)}>
          {t('json.minify')}
        </Button>
        <Button size="sm" variant="outline" onClick={validate}>
          {t('json.validate')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setInput('');
            setOutput('');
            setError(null);
          }}
        >
          {t('json.clear')}
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder={'{ "key": "value" }'}
        error={error}
        language="json"
      />
      <HistoryPanel
        onRestore={(item) => {
          setInput(item.inputText || '');
          setOutput(item.outputText || '');
          setPreference(item.preference);
        }}
      />
    </div>
  );
}

// ─── schema / types ────────────────────────────────────────

function resolveSchema(
  source: SchemaSource,
  data: string,
  schema: string,
): unknown {
  if (source === 'json') return inferJsonSchema(JSON.parse(data));
  return JSON.parse(schema);
}

function SchemaPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<SchemaMode>(
    'mode',
    StringParam,
    'infer',
  );
  const [source, setSource] = useQueryParam<SchemaSource>(
    'from',
    StringParam,
    'json',
  );
  const [out, setOut] = useQueryParam<SchemaOutput>(
    'out',
    StringParam,
    'typescript',
  );
  const [data, setData] = useState(SAMPLE_SCHEMA_JSON);
  const [schema, setSchema] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeMode: SchemaMode =
    mode === 'infer' || mode === 'validate' || mode === 'types'
      ? mode
      : 'infer';
  const activeSource: SchemaSource = source === 'schema' ? 'schema' : 'json';
  const activeOut: SchemaOutput =
    out === 'interface' ||
    out === 'zod' ||
    out === 'typescript' ||
    out === 'go' ||
    out === 'rust' ||
    out === 'python' ||
    out === 'kotlin'
      ? out
      : 'typescript';

  const showData =
    activeMode === 'infer' ||
    activeMode === 'validate' ||
    (activeMode === 'types' && activeSource === 'json');
  const showSchema =
    activeMode === 'validate' ||
    (activeMode === 'types' && activeSource === 'schema');

  const run = async () => {
    setError(null);
    try {
      if (activeMode === 'infer') {
        const next = JSON.stringify(inferJsonSchema(JSON.parse(data)), null, 2);
        setSchema(next);
        setOutput(next);
        return;
      }
      if (activeMode === 'types') {
        const parsedSchema = resolveSchema(activeSource, data, schema);
        if (activeSource === 'json') {
          setSchema(JSON.stringify(parsedSchema, null, 2));
        }
        if (activeOut === 'typescript') {
          setOutput(jsonSchemaToTypeScript(parsedSchema));
          return;
        }
        if (activeOut === 'interface') {
          setOutput(jsonSchemaToInterface(parsedSchema));
          return;
        }
        if (
          activeOut === 'go' ||
          activeOut === 'rust' ||
          activeOut === 'python' ||
          activeOut === 'kotlin'
        ) {
          setOutput(
            jsonToLanguageTypes(
              activeSource === 'json'
                ? JSON.parse(data)
                : exampleFromSchema(parsedSchema),
              activeOut,
            ),
          );
          return;
        }
        setOutput(jsonSchemaToZod(parsedSchema));
        return;
      }
      const parsedSchema: unknown = JSON.parse(schema);
      const Ajv2020 = (await import('ajv/dist/2020')).default;
      const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
        parsedSchema as AnySchema,
      );
      const valid = validate(JSON.parse(data));
      setOutput(
        valid
          ? t('jsonSchema.valid')
          : JSON.stringify(validate.errors ?? [], null, 2),
      );
    } catch (cause) {
      setError(t('jsonSchema.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-base font-semibold">{t('json.tabSchema')}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={activeMode}
            onValueChange={(value) => setMode(value as SchemaMode)}
          >
            <TabsList variant="line" className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="infer">{t('json.schemaInfer')}</TabsTrigger>
              <TabsTrigger value="validate">
                {t('json.schemaValidate')}
              </TabsTrigger>
              <TabsTrigger value="types">{t('json.schemaTypes')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" className="shrink-0" onClick={() => void run()}>
            {t('jsonSchema.run')}
          </Button>
        </div>
      </div>

      {activeMode === 'types' && (
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {t('json.inputFormat')}
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={activeSource}
              onValueChange={(value) => {
                if (value) setSource(value as SchemaSource);
              }}
            >
              <ToggleGroupItem value="json" className={SEGMENT_ITEM_CLASS}>
                JSON
              </ToggleGroupItem>
              <ToggleGroupItem value="schema" className={SEGMENT_ITEM_CLASS}>
                JSON Schema
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {t('json.outputFormat')}
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={activeOut}
              onValueChange={(value) => {
                if (value) setOut(value as SchemaOutput);
              }}
            >
              <ToggleGroupItem
                value="typescript"
                className={SEGMENT_ITEM_CLASS}
              >
                TypeScript
              </ToggleGroupItem>
              <ToggleGroupItem value="interface" className={SEGMENT_ITEM_CLASS}>
                Interface
              </ToggleGroupItem>
              <ToggleGroupItem value="zod" className={SEGMENT_ITEM_CLASS}>
                Zod
              </ToggleGroupItem>
              {(['go', 'rust', 'python', 'kotlin'] as const).map((language) => (
                <ToggleGroupItem
                  key={language}
                  value={language}
                  className={SEGMENT_ITEM_CLASS}
                >
                  {language[0].toUpperCase() + language.slice(1)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {showData && (
            <MonacoTextEditor
              label={t('jsonSchema.data')}
              language="json"
              height={showSchema ? '300px' : '520px'}
              value={data}
              onChange={setData}
            />
          )}
          {showSchema && (
            <MonacoTextEditor
              label={t('jsonSchema.schema')}
              language="json"
              height={showData ? '300px' : '520px'}
              value={schema}
              onChange={setSchema}
            />
          )}
        </div>
        <MonacoTextEditor
          readOnly
          label={t('jsonSchema.result')}
          language={
            activeMode === 'types'
              ? activeOut === 'python'
                ? 'python'
                : activeOut === 'go'
                  ? 'go'
                  : activeOut === 'rust'
                    ? 'rust'
                    : activeOut === 'kotlin'
                      ? 'kotlin'
                      : 'typescript'
              : 'json'
          }
          height="630px"
          value={output}
        />
      </div>
      {output === t('jsonSchema.valid') && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {output}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ─── path / lines / patch ──────────────────────────────────

function PathPanel() {
  const { t } = useTranslation();
  const [pathResult, setPathResult] = useQueryParam<PathResult>(
    'result',
    StringParam,
    'value',
  );
  const [input, setInput] = useState('{\n  "users": [{ "name": "Ada" }]\n}');
  const [path, setPath] = useState('$.users[*].name');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    try {
      const { JSONPath } = await import('jsonpath-plus');
      const result = JSONPath({
        path,
        json: JSON.parse(input) as object,
        resultType: pathResult,
        eval: 'safe',
      });
      setOutput(JSON.stringify(result, null, 2));
    } catch (cause) {
      setError(t('jsonData.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4">
          <div className="min-w-64 max-w-xl flex-1 space-y-2">
            <Label>JSONPath</Label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {t('json.outputFormat')}
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={pathResult}
              onValueChange={(value) => {
                if (value) setPathResult(value as PathResult);
              }}
            >
              <ToggleGroupItem value="value" className={SEGMENT_ITEM_CLASS}>
                {t('jsonData.values')}
              </ToggleGroupItem>
              <ToggleGroupItem value="pointer" className={SEGMENT_ITEM_CLASS}>
                JSON Pointer
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <Button className="shrink-0" onClick={() => void run()}>
          {t('jsonData.run')}
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('jsonData.input')}
          language="json"
          height="520px"
          value={input}
          onChange={setInput}
        />
        <MonacoTextEditor
          readOnly
          label={t('jsonData.result')}
          language="json"
          height="520px"
          value={output}
        />
      </div>
    </div>
  );
}

function LinesPanel() {
  const { t } = useTranslation();
  const [direction, setDirection] = useQueryParam<Direction>(
    'direction',
    StringParam,
    'encode',
  );
  const [input, setInput] = useState(
    '[\n  { "name": "Ada" },\n  { "name": "Grace" }\n]',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    try {
      setOutput(
        direction === 'encode'
          ? jsonToNdjson(JSON.parse(input))
          : JSON.stringify(ndjsonToJson(input), null, 2),
      );
    } catch (cause) {
      setError(t('jsonData.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">
            {t('json.convertDirection')}
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={direction}
            onValueChange={(value) => {
              if (value) setDirection(value as Direction);
            }}
          >
            <ToggleGroupItem value="encode" className={SEGMENT_ITEM_CLASS}>
              JSON → NDJSON
            </ToggleGroupItem>
            <ToggleGroupItem value="decode" className={SEGMENT_ITEM_CLASS}>
              NDJSON → JSON
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button className="shrink-0" onClick={run}>
          {t('jsonData.run')}
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('jsonData.input')}
          language={direction === 'decode' ? 'plaintext' : 'json'}
          height="520px"
          value={input}
          onChange={setInput}
        />
        <MonacoTextEditor
          readOnly
          label={t('jsonData.result')}
          language={direction === 'encode' ? 'plaintext' : 'json'}
          height="520px"
          value={output}
        />
      </div>
    </div>
  );
}

function PatchPanel() {
  const { t } = useTranslation();
  const [patchMode, setPatchMode] = useQueryParam<PatchMode>(
    'patch',
    StringParam,
    'generate',
  );
  const [input, setInput] = useState('{\n  "name": "Ada"\n}');
  const [secondary, setSecondary] = useState('{\n  "name": "Grace"\n}');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    try {
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
    } catch (cause) {
      setError(t('jsonData.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">{t('json.patchMode')}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={patchMode}
            onValueChange={(value) => {
              if (value) setPatchMode(value as PatchMode);
            }}
          >
            <ToggleGroupItem value="generate" className={SEGMENT_ITEM_CLASS}>
              {t('jsonData.generate')}
            </ToggleGroupItem>
            <ToggleGroupItem value="apply" className={SEGMENT_ITEM_CLASS}>
              {t('jsonData.apply')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button className="shrink-0" onClick={() => void run()}>
          {t('jsonData.run')}
        </Button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <MonacoTextEditor
            label={t('jsonData.input')}
            language="json"
            height="300px"
            value={input}
            onChange={setInput}
          />
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
        </div>
        <MonacoTextEditor
          readOnly
          label={t('jsonData.result')}
          language="json"
          height="620px"
          value={output}
        />
      </div>
    </div>
  );
}
