import { MonacoTextEditor } from '@/components/monaco-editor';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  buildJsonGraph,
  createSandboxDocument,
  simulateImagePixels,
  type ColorVisionMode,
  type JsonGraphNode,
} from '@/lib/community-tools';
import { bytesToBase64 } from '@/lib/developer-tools';
import { Download, LoaderCircle, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlistValue } from 'plist';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';

function ErrorText({ value }: { value: string | null }) {
  return value ? (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {value}
    </div>
  ) : null;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function svgPngBlob(svg: string): Promise<Blob> {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  const viewBox = root.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
  const width = Math.max(viewBox?.[2] ?? Number(root.getAttribute('width')), 1);
  const height = Math.max(
    viewBox?.[3] ?? Number(root.getAttribute('height')),
    1,
  );
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('CANVAS_UNAVAILABLE');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVG_LOAD_FAILED'));
      image.src = url;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('PNG_EXPORT_FAILED');
  return blob;
}

export function JqPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<'json' | 'raw'>(
    'jqOutput',
    StringParam,
    'json',
  );
  const [input, setInput] = useState(
    '[{"name":"Ada","score":98},{"name":"Grace","score":91}]',
  );
  const [query, setQuery] = useState('map(select(.score >= 95)) | .[].name');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const parsed = JSON.parse(input) as object;
      const jq = await import('jq-wasm');
      if (mode === 'raw') {
        const result = await jq.raw(parsed, query, ['-r']);
        if (result.exitCode !== 0) throw new Error(result.stderr.trim());
        setOutput(result.stdout.trimEnd());
      } else {
        const result = await jq.json(parsed, query);
        setOutput(
          result.map((value) => JSON.stringify(value, null, 2)).join('\n'),
        );
      }
    } catch (cause) {
      setOutput('');
      setError(t('communityTools.failed', { msg: (cause as Error).message }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-2">
          <Label>{t('communityTools.jqQuery')}</Label>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="font-mono"
          />
        </div>
        <Select
          value={mode}
          onValueChange={(value) => setMode(value as 'json' | 'raw')}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="raw">Raw (-r)</SelectItem>
          </SelectContent>
        </Select>
        <Button disabled={running || !query.trim()} onClick={() => void run()}>
          {running && <LoaderCircle className="animate-spin" />}
          {t('communityTools.run')}
        </Button>
      </div>
      <ErrorText value={error} />
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
          language={mode === 'json' ? 'json' : 'plaintext'}
          height="520px"
          value={output}
        />
      </div>
    </div>
  );
}

function graphNodeColors(kind: JsonGraphNode['kind']): {
  fill: string;
  stroke: string;
} {
  if (kind === 'object' || kind === 'array')
    return { fill: '#eff6ff', stroke: '#93c5fd' };
  if (kind === 'number' || kind === 'boolean')
    return { fill: '#fffbeb', stroke: '#fcd34d' };
  return { fill: '#ffffff', stroke: '#cbd5e1' };
}

export function JsonGraphPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    '{\n  "user": { "name": "Ada", "roles": ["admin", "editor"] },\n  "active": true\n}',
  );
  const [graph, setGraph] = useState(() => buildJsonGraph(JSON.parse(input)));
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodesById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );

  const render = () => {
    setError(null);
    try {
      setGraph(buildJsonGraph(JSON.parse(input)));
    } catch (cause) {
      setError(t('communityTools.failed', { msg: (cause as Error).message }));
    }
  };

  const download = () => {
    if (!svgRef.current) return;
    downloadBlob(
      new Blob([svgRef.current.outerHTML], { type: 'image/svg+xml' }),
      'json-graph.svg',
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={render}>{t('communityTools.render')}</Button>
        <Label htmlFor="json-graph-zoom">{t('communityTools.zoom')}</Label>
        <input
          id="json-graph-zoom"
          type="range"
          min="0.5"
          max="1.75"
          step="0.05"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="w-40"
        />
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="outline" onClick={download}>
          <Download /> SVG
        </Button>
      </div>
      <ErrorText value={error} />
      {graph.truncated && (
        <p className="text-sm text-amber-600">
          {t('communityTools.graphTruncated')}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_1.2fr]">
        <MonacoTextEditor
          label={t('jsonData.input')}
          language="json"
          height="560px"
          value={input}
          onChange={setInput}
        />
        <div className="h-[560px] overflow-auto rounded-xl border bg-muted/20">
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            width={graph.width * zoom}
            height={graph.height * zoom}
            viewBox={`0 0 ${graph.width} ${graph.height}`}
          >
            {graph.nodes.map((node) => {
              const parent = node.parentId
                ? nodesById.get(node.parentId)
                : null;
              if (!parent) return null;
              return (
                <path
                  key={`${parent.id}-${node.id}`}
                  d={`M ${parent.depth * 240 + 210} ${parent.row * 68 + 42} C ${parent.depth * 240 + 225} ${parent.row * 68 + 42}, ${node.depth * 240 + 5} ${node.row * 68 + 42}, ${node.depth * 240 + 20} ${node.row * 68 + 42}`}
                  fill="none"
                  stroke="#94a3b8"
                />
              );
            })}
            {graph.nodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.depth * 240 + 20} ${node.row * 68 + 20})`}
              >
                <rect
                  width="190"
                  height="44"
                  rx="8"
                  {...graphNodeColors(node.kind)}
                />
                <text x="10" y="18" fill="#0f172a" fontSize="12">
                  {node.label}
                </text>
                <text x="10" y="34" fill="#64748b" fontSize="10">
                  {node.detail}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

type MermaidTheme = 'default' | 'neutral' | 'dark' | 'forest';

export function MermaidPanel() {
  const { t } = useTranslation();
  const [theme, setTheme] = useQueryParam<MermaidTheme>(
    'mermaidTheme',
    StringParam,
    'default',
  );
  const [source, setSource] = useState(
    'flowchart LR\n  A[需求] --> B{评审}\n  B -->|通过| C[开发]\n  B -->|修改| A\n  C --> D[发布]',
  );
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const renderId = useRef(0);

  useEffect(() => {
    const current = ++renderId.current;
    const timeout = window.setTimeout(async () => {
      if (!source.trim()) {
        setSvg('');
        setError(null);
        return;
      }
      setLoading(true);
      try {
        const [{ default: mermaid }, { default: DOMPurify }] =
          await Promise.all([import('mermaid'), import('dompurify')]);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme,
        });
        const rendered = await mermaid.render(
          `mermaid-${crypto.randomUUID()}`,
          source,
        );
        if (renderId.current !== current) return;
        setSvg(
          DOMPurify.sanitize(rendered.svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          }),
        );
        setError(null);
      } catch (cause) {
        if (renderId.current !== current) return;
        setSvg('');
        setError(t('communityTools.failed', { msg: (cause as Error).message }));
      } finally {
        if (renderId.current === current) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [source, t, theme]);

  const downloadSvg = () => {
    if (svg)
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'diagram.svg');
  };

  const downloadPng = async () => {
    try {
      downloadBlob(await svgPngBlob(svg), 'diagram.png');
    } catch (cause) {
      setError(t('communityTools.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={theme}
          onValueChange={(value) => setTheme(value as MermaidTheme)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['default', 'neutral', 'dark', 'forest'] as const).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={!svg} onClick={downloadSvg}>
          <Download /> SVG
        </Button>
        <Button
          variant="outline"
          disabled={!svg}
          onClick={() => void downloadPng()}
        >
          <Download /> PNG
        </Button>
        {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      </div>
      <ErrorText value={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label="Mermaid"
          language="markdown"
          height="620px"
          value={source}
          onChange={setSource}
        />
        <div className="h-[620px] overflow-auto rounded-xl border bg-white p-4">
          {svg ? (
            <div
              className="flex min-h-full min-w-max items-center justify-center"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('communityTools.preview')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ImageSource = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  name: string;
};

export function ColorVisionPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<ColorVisionMode>(
    'vision',
    StringParam,
    'deuteranopia',
  );
  const [source, setSource] = useState<ImageSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);
  const resultRef = useRef<HTMLCanvasElement | null>(null);

  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(Math.round(bitmap.width * scale), 1);
      const height = Math.max(Math.round(bitmap.height * scale), 1);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('CANVAS_UNAVAILABLE');
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      setSource({
        pixels: context.getImageData(0, 0, width, height).data,
        width,
        height,
        name: file.name,
      });
    } catch (cause) {
      setSource(null);
      setError(t('communityTools.failed', { msg: (cause as Error).message }));
    }
  };

  useEffect(() => {
    if (!source) return;
    const original = originalRef.current?.getContext('2d');
    const result = resultRef.current?.getContext('2d');
    if (!original || !result) return;
    const sourceImage = new ImageData(
      new Uint8ClampedArray(source.pixels),
      source.width,
      source.height,
    );
    original.putImageData(sourceImage, 0, 0);
    result.putImageData(
      new ImageData(
        Uint8ClampedArray.from(simulateImagePixels(source.pixels, mode)),
        source.width,
        source.height,
      ),
      0,
      0,
    );
  }, [mode, source]);

  const download = () => {
    resultRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `vision-${mode}.png`);
    }, 'image/png');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void load(event)}
          className="max-w-md"
        />
        <Select
          value={mode}
          onValueChange={(value) => setMode(value as ColorVisionMode)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                'protanopia',
                'deuteranopia',
                'tritanopia',
                'achromatopsia',
              ] as const
            ).map((item) => (
              <SelectItem key={item} value={item}>
                {t(`communityTools.vision.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={!source} onClick={download}>
          <Download /> {t('communityTools.download')}
        </Button>
      </div>
      <ErrorText value={error} />
      {source ? (
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="space-y-2">
            <figcaption className="text-sm text-muted-foreground">
              {t('communityTools.original')} · {source.name}
            </figcaption>
            <div className="overflow-auto rounded-xl border bg-black/5 p-2">
              <canvas
                ref={originalRef}
                width={source.width}
                height={source.height}
                className="h-auto max-w-full"
              />
            </div>
          </figure>
          <figure className="space-y-2">
            <figcaption className="text-sm text-muted-foreground">
              {t(`communityTools.vision.${mode}`)}
            </figcaption>
            <div className="overflow-auto rounded-xl border bg-black/5 p-2">
              <canvas
                ref={resultRef}
                width={source.width}
                height={source.height}
                className="h-auto max-w-full"
              />
            </div>
          </figure>
        </div>
      ) : (
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          {t('communityTools.imagePrompt')}
        </div>
      )}
    </div>
  );
}

type PlistDirection = 'plist-json' | 'json-plist';
type PlistOutput = 'xml' | 'binary';

function plistJsonReplacer(_key: string, value: unknown): unknown {
  return value instanceof Uint8Array ? { $data: bytesToBase64(value) } : value;
}

export function PlistPanel() {
  const { t } = useTranslation();
  const [direction, setDirection] = useQueryParam<PlistDirection>(
    'plistDirection',
    StringParam,
    'plist-json',
  );
  const [format, setFormat] = useQueryParam<PlistOutput>(
    'plistOutput',
    StringParam,
    'xml',
  );
  const [input, setInput] = useState(
    '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n  <dict>\n    <key>CFBundleName</key>\n    <string>Example</string>\n    <key>CFBundleVersion</key>\n    <string>1.0</string>\n  </dict>\n</plist>',
  );
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [output, setOutput] = useState('');
  const [binaryOutput, setBinaryOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasBinaryInput =
    fileBytes !== null &&
    new TextDecoder().decode(fileBytes.slice(0, 8)) === 'bplist00';

  const changeDirection = (value: PlistDirection) => {
    setDirection(value);
    setFileBytes(null);
    setBinaryOutput(null);
    setOutput('');
    setInput(
      value === 'plist-json'
        ? '<plist version="1.0"><dict><key>name</key><string>Example</string></dict></plist>'
        : '{\n  "name": "Example",\n  "version": 1\n}',
    );
  };

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      setError(t('communityTools.failed', { msg: 'FILE_TOO_LARGE' }));
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    setFileBytes(bytes);
    setInput(
      new TextDecoder().decode(bytes.slice(0, 8)) === 'bplist00'
        ? `${file.name} · ${bytes.length} B`
        : new TextDecoder().decode(bytes),
    );
  };

  const convert = async () => {
    setError(null);
    setBinaryOutput(null);
    try {
      const plist = await import('plist');
      if (direction === 'plist-json') {
        const value = plist.parse(fileBytes ?? input);
        setOutput(JSON.stringify(value, plistJsonReplacer, 2));
        return;
      }
      const value = JSON.parse(input) as PlistValue;
      if (format === 'binary') {
        const bytes = plist.buildBinary(value);
        setBinaryOutput(bytes);
        setOutput(`bplist00 · ${bytes.length} B`);
      } else {
        setOutput(plist.build(value));
      }
    } catch (cause) {
      setOutput('');
      setError(t('communityTools.failed', { msg: (cause as Error).message }));
    }
  };

  const download = () => {
    if (binaryOutput) {
      downloadBlob(
        new Blob([Uint8Array.from(binaryOutput).buffer], {
          type: 'application/x-plist',
        }),
        'Info.plist',
      );
    } else if (output) {
      downloadBlob(
        new Blob([output], {
          type:
            direction === 'plist-json'
              ? 'application/json'
              : 'application/x-plist',
        }),
        direction === 'plist-json' ? 'Info.json' : 'Info.plist',
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={direction}
          onValueChange={(value) => changeDirection(value as PlistDirection)}
        >
          <TabsList>
            <TabsTrigger value="plist-json">Plist → JSON</TabsTrigger>
            <TabsTrigger value="json-plist">JSON → Plist</TabsTrigger>
          </TabsList>
        </Tabs>
        {direction === 'plist-json' ? (
          <Input
            type="file"
            accept=".plist,application/x-plist"
            onChange={(event) => void loadFile(event)}
            className="max-w-xs"
          />
        ) : (
          <Select
            value={format}
            onValueChange={(value) => setFormat(value as PlistOutput)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xml">XML Plist</SelectItem>
              <SelectItem value="binary">Binary Plist</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => void convert()}>
          {t('communityTools.convert')}
        </Button>
        <Button variant="outline" disabled={!output} onClick={download}>
          <Download /> {t('communityTools.download')}
        </Button>
      </div>
      <ErrorText value={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setFileBytes(null);
          }}
          className="min-h-[520px] font-mono text-xs"
          readOnly={hasBinaryInput}
        />
        <Textarea
          readOnly
          value={output}
          className="min-h-[520px] font-mono text-xs"
        />
      </div>
    </div>
  );
}

type SandboxFile = 'html' | 'css' | 'javascript';
type SandboxLog = { level: string; values: string[] };

export function WebSandboxPanel() {
  const { t } = useTranslation();
  const [file, setFile] = useQueryParam<SandboxFile>(
    'sandboxFile',
    StringParam,
    'html',
  );
  const [html, setHtml] = useState(
    '<main>\n  <h1>浏览器沙箱</h1>\n  <button id="hello">点击我</button>\n</main>',
  );
  const [css, setCss] = useState(
    'body { font-family: system-ui; padding: 2rem; }\nbutton { padding: .5rem 1rem; }',
  );
  const [javascript, setJavascript] = useState(
    "document.querySelector('#hello').addEventListener('click', () => console.log('Hello'));",
  );
  const channel = useMemo(() => crypto.randomUUID(), []);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [logs, setLogs] = useState<SandboxLog[]>([]);
  const [source, setSource] = useState(() =>
    createSandboxDocument({ html, css, javascript, channel }),
  );

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || typeof event.data !== 'object') return;
      const data = event.data as Partial<{
        channel: string;
        type: string;
        level: string;
        values: string[];
      }>;
      if (
        data.channel !== channel ||
        data.type !== 'console' ||
        !data.level ||
        !Array.isArray(data.values)
      )
        return;
      setLogs((current) =>
        [...current, { level: data.level!, values: data.values! }].slice(-100),
      );
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [channel]);

  const run = () => {
    setLogs([]);
    setSource(createSandboxDocument({ html, css, javascript, channel }));
  };

  const value = file === 'html' ? html : file === 'css' ? css : javascript;
  const setValue =
    file === 'html' ? setHtml : file === 'css' ? setCss : setJavascript;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={file}
          onValueChange={(value) => setFile(value as SandboxFile)}
        >
          <TabsList>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="css">CSS</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={run}>
          <Play /> {t('communityTools.run')}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={file === 'javascript' ? 'JavaScript' : file.toUpperCase()}
          language={file}
          height="560px"
          value={value}
          onChange={setValue}
        />
        <div className="grid h-[560px] grid-rows-[1fr_10rem] overflow-hidden rounded-xl border">
          <iframe
            ref={iframeRef}
            title={t('communityTools.sandboxPreview')}
            sandbox="allow-scripts"
            srcDoc={source}
            className="h-full w-full bg-white"
          />
          <div className="overflow-auto border-t bg-neutral-950 p-3 font-mono text-xs text-neutral-100">
            {logs.length ? (
              logs.map((log, index) => (
                <div
                  key={`${index}-${log.level}`}
                  className={
                    log.level === 'error'
                      ? 'text-red-400'
                      : log.level === 'warn'
                        ? 'text-amber-300'
                        : ''
                  }
                >
                  [{log.level}] {log.values.join(' ')}
                </div>
              ))
            ) : (
              <span className="text-neutral-500">
                {t('communityTools.consoleEmpty')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
