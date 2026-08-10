import { FileDropzone } from '@/components/file-dropzone';
import { ProtobufPanel } from '@/components/extra-tool-panels';
import { CodePanel } from '@/components/code-panel';
import { MonacoTextEditor } from '@/components/monaco-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  detectBinaryFormat,
  extractAsciiStrings,
  findMimeTypes,
  findBytes,
  hexDump,
  parseHexPattern,
  readBinaryValue,
} from '@/lib/binary-inspector';
import { base64ToBytes, bytesToBase64 } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Binary } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/hex-inspector')({
  component: HexInspectorPage,
});
type ValueType = 'uint16' | 'uint32' | 'int32' | 'float32' | 'float64';
const PAGE_SIZE = 64 * 1024;

function HexInspectorPage() {
  const { t } = useTranslation();
  const [endian, setEndian] = useQueryParam<'little' | 'big'>(
    'endian',
    StringParam,
    'little',
  );
  const [tab, setTab] = useQueryParam<
    'inspect' | 'mime' | 'codec' | 'protobuf'
  >('tab', StringParam, 'inspect');
  const [mimeQuery, setMimeQuery] = useState('json');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState<ValueType>('uint32');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const format = useMemo(
    () => (bytes ? detectBinaryFormat(bytes) : null),
    [bytes],
  );
  const pageCount = bytes
    ? Math.max(Math.ceil(bytes.length / PAGE_SIZE), 1)
    : 1;
  const pageBytes = bytes
    ? bytes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : new Uint8Array();

  async function load(file: File) {
    setError(null);
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error(t('hexInspector.limit'));
      setBytes(new Uint8Array(await file.arrayBuffer()));
      setName(file.name);
      setResult('');
      setPage(0);
    } catch (cause) {
      setError(t('hexInspector.failed', { msg: (cause as Error).message }));
    }
  }

  function search() {
    if (!bytes) return;
    try {
      const offsets = findBytes(bytes, parseHexPattern(pattern));
      setResult(JSON.stringify({ offsets, count: offsets.length }, null, 2));
      setError(null);
    } catch (cause) {
      setError(t('hexInspector.failed', { msg: (cause as Error).message }));
    }
  }

  function read() {
    if (!bytes) return;
    try {
      setResult(
        JSON.stringify(
          {
            offset,
            type,
            endian,
            value: readBinaryValue(bytes, offset, type, endian === 'little'),
          },
          null,
          2,
        ),
      );
      setError(null);
    } catch (cause) {
      setError(t('hexInspector.failed', { msg: (cause as Error).message }));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('hexInspector.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as 'inspect' | 'mime' | 'codec' | 'protobuf')
        }
      >
        <TabsList>
          <TabsTrigger value="inspect">
            {t('hexInspector.tabInspect')}
          </TabsTrigger>
          <TabsTrigger value="mime">{t('hexInspector.tabMime')}</TabsTrigger>
          <TabsTrigger value="codec">MessagePack / CBOR</TabsTrigger>
          <TabsTrigger value="protobuf">Protobuf</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'protobuf' ? (
        <ProtobufPanel />
      ) : tab === 'codec' ? (
        <BinaryCodecPanel />
      ) : tab === 'mime' ? (
        <div className="space-y-4">
          <Input
            value={mimeQuery}
            onChange={(event) => setMimeQuery(event.target.value)}
            placeholder={t('hexInspector.mimePlaceholder')}
          />
          <div className="divide-y rounded-xl border">
            {findMimeTypes(mimeQuery).map((entry) => (
              <div
                key={entry.mime}
                className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[10rem_1fr_1fr]"
              >
                <code>.{entry.extension.replaceAll(',', ', .')}</code>
                <code className="break-all text-blue-600 dark:text-blue-400">
                  {entry.mime}
                </code>
                <span className="text-muted-foreground">
                  {entry.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <FileDropzone
            onFiles={(files) => files[0] && void load(files[0].file)}
            className="flex min-h-28 items-center justify-center rounded-xl p-5 text-center"
          >
            <div>
              <Binary className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              {t('hexInspector.drop')}
            </div>
          </FileDropzone>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {bytes && (
            <>
              <div className="flex flex-wrap gap-3 rounded-xl border p-3 text-sm">
                <span>{name}</span>
                <span>{bytes.length} B</span>
                <span>{format?.name}</span>
                <span className="text-muted-foreground">{format?.mime}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <MonacoTextEditor
                    readOnly
                    label={`${t('hexInspector.hex')} ${page + 1}/${pageCount}`}
                    height="520px"
                    value={hexDump(pageBytes, 16, page * PAGE_SIZE)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      {t('hexInspector.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={page + 1 >= pageCount}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      {t('hexInspector.next')}
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2 rounded-xl border p-4">
                    <Label>{t('hexInspector.search')}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={pattern}
                        onChange={(event) => setPattern(event.target.value)}
                        placeholder="89 50 4E 47"
                      />
                      <Button onClick={search}>{t('hexInspector.run')}</Button>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t('hexInspector.offset')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={offset}
                        onChange={(event) =>
                          setOffset(Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('hexInspector.type')}</Label>
                      <Select
                        value={type}
                        onValueChange={(value) => setType(value as ValueType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            [
                              'uint16',
                              'uint32',
                              'int32',
                              'float32',
                              'float64',
                            ] as const
                          ).map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('hexInspector.endian')}</Label>
                      <Select
                        value={endian}
                        onValueChange={(value) =>
                          setEndian(value as 'little' | 'big')
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="little">Little Endian</SelectItem>
                          <SelectItem value="big">Big Endian</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="sm:col-span-3" onClick={read}>
                      {t('hexInspector.read')}
                    </Button>
                  </div>
                  <MonacoTextEditor
                    readOnly
                    label={t('hexInspector.result')}
                    language="json"
                    height="180px"
                    value={result}
                  />
                  <MonacoTextEditor
                    readOnly
                    label={t('hexInspector.strings')}
                    height="220px"
                    value={extractAsciiStrings(pageBytes).join('\n')}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

type CodecFormat = 'msgpack' | 'cbor';
type CodecDirection = 'encode' | 'decode';

function BinaryCodecPanel() {
  const { t } = useTranslation();
  const [format, setFormat] = useQueryParam<CodecFormat>(
    'format',
    StringParam,
    'msgpack',
  );
  const [direction, setDirection] = useQueryParam<CodecDirection>(
    'direction',
    StringParam,
    'encode',
  );
  const [input, setInput] = useState('{"name":"tools","count":12}');
  const [output, setOutput] = useState('');
  const [encoded, setEncoded] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      if (direction === 'encode') {
        const value: unknown = JSON.parse(input);
        const bytes =
          format === 'msgpack'
            ? (await import('@msgpack/msgpack')).encode(value)
            : (await import('cbor-x')).encode(value);
        setEncoded(bytes);
        setOutput(bytesToBase64(bytes));
      } else {
        const bytes = base64ToBytes(input.trim());
        const value: unknown =
          format === 'msgpack'
            ? (await import('@msgpack/msgpack')).decode(bytes)
            : (await import('cbor-x')).decode(bytes);
        setEncoded(null);
        setOutput(
          JSON.stringify(
            value,
            (_, item: unknown) =>
              typeof item === 'bigint' ? item.toString() : item,
            2,
          ),
        );
      }
    } catch (cause) {
      setOutput('');
      setError(
        t('hexInspector.codecFailed', { msg: (cause as Error).message }),
      );
    }
  };
  const download = () => {
    if (!encoded) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([new Uint8Array(encoded).buffer]));
    link.download = `data.${format === 'msgpack' ? 'msgpack' : 'cbor'}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['msgpack', 'cbor'] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={format === item ? 'default' : 'outline'}
            onClick={() => setFormat(item)}
          >
            {item === 'msgpack' ? 'MessagePack' : 'CBOR'}
          </Button>
        ))}
        {(['encode', 'decode'] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={direction === item ? 'default' : 'outline'}
            onClick={() => setDirection(item)}
          >
            {t(`hexInspector.${item}`)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void run()}>{t('hexInspector.run')}</Button>
        {encoded && (
          <Button variant="outline" onClick={download}>
            {t('hexInspector.download')}
          </Button>
        )}
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        error={error}
        language={direction === 'encode' ? 'json' : 'plaintext'}
        outputLanguage={direction === 'decode' ? 'json' : 'plaintext'}
      />
    </div>
  );
}
