import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '../hooks/useQueryParams';
import type { AvroMode, AvroRequest } from '../lib/avro-tool';
import { bytesToBase64 } from '../lib/developer-tools';
import { downloadBlob } from '../lib/download';
import type { FormatResult } from '../lib/format-input';
import { CodePanel } from './code-panel';
import { FileDropzone } from './file-dropzone';
import {
  createFormatWorker,
  FormatActions,
  FormatFeedback,
} from './format-workbench';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
const MODES: AvroMode[] = [
  'schema',
  'validate',
  'encode',
  'decode',
  'compatible',
];
const SCHEMA =
  '{"type":"record","name":"Person","fields":[{"name":"name","type":"string"},{"name":"age","type":"int"}]}';
const READER =
  '{"type":"record","name":"Person","fields":[{"name":"name","type":"string"},{"name":"age","type":"long"},{"name":"country","type":"string","default":"CN"}]}';
export default function AvroPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ avroMode: string }>({
    avroMode: StringParam,
  });
  const mode: AvroMode = MODES.includes(query.avroMode as AvroMode)
    ? (query.avroMode as AvroMode)
    : 'validate';
  const [schema, setSchema] = useState('');
  const [reader, setReader] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  const task = useBoundedWorker<AvroRequest, FormatResult>(
    createFormatWorker,
    10000,
  );
  useEffect(() => {
    epoch.current++;
    setReading(false);
    task.clear();
    setError(null);
  }, [mode, task.clear]);
  const clearResult = (): void => {
    epoch.current++;
    setReading(false);
    task.clear();
    setError(null);
  };
  const load = async (file: File): Promise<void> => {
    clearResult();
    const current = epoch.current;
    setReading(true);
    try {
      if (file.size > 1.5 * 1024 * 1024) throw new Error('BINARY_TOO_LARGE');
      const value = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      if (current === epoch.current) setInput(value);
    } catch (cause) {
      if (current === epoch.current) setError((cause as Error).message);
    } finally {
      if (current === epoch.current) setReading(false);
    }
  };
  return (
    <section className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t('avro.note')}</p>
      <div className="flex items-center gap-2">
        <Label>{t('formats.mode')}</Label>
        <Select
          value={mode}
          onValueChange={(avroMode) => {
            clearResult();
            setQuery({ avroMode });
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`avro.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="avro-schema">{t('avro.writer')}</Label>
          <Textarea
            id="avro-schema"
            className="min-h-40 font-mono text-xs"
            value={schema}
            onChange={(event) => {
              clearResult();
              setSchema(event.target.value);
            }}
            spellCheck={false}
          />
        </div>
        {mode === 'compatible' && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor="avro-reader">{t('avro.reader')}</Label>
            <Textarea
              id="avro-reader"
              className="min-h-40 font-mono text-xs"
              value={reader}
              onChange={(event) => {
                clearResult();
                setReader(event.target.value);
              }}
              spellCheck={false}
            />
          </div>
        )}
      </div>
      {mode === 'decode' && (
        <FileDropzone
          onFiles={(files) => {
            if (files[0]) void load(files[0].file);
          }}
          className="flex min-h-20 items-center justify-center rounded-md p-3 text-sm"
        >
          {t('avro.upload')}
        </FileDropzone>
      )}
      <FormatActions
        busy={task.busy || reading}
        run={() => task.run({ kind: 'avro', mode, schema, reader, input })}
        cancel={() => {
          epoch.current++;
          setReading(false);
          task.cancel();
        }}
        clear={() => {
          clearResult();
          setSchema('');
          setReader('');
          setInput('');
        }}
        sample={() => {
          clearResult();
          setSchema(SCHEMA);
          setReader(READER);
          setInput(mode === 'decode' ? 'BkFkYQo=' : '{"name":"Ada","age":5}');
        }}
      />
      <FormatFeedback error={error ?? task.error} info={task.result?.info} />
      {task.result?.binary && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadBlob(
              new Blob([Uint8Array.from(task.result!.binary!)]),
              'datum.avro',
            )
          }
        >
          {t('formats.downloadBinary')}
        </Button>
      )}
      {mode === 'schema' || mode === 'compatible' ? (
        <Textarea
          aria-label={t('formats.output')}
          className="min-h-64 font-mono text-xs"
          readOnly
          value={task.result?.output ?? ''}
        />
      ) : (
        <>
          <Label>{t(mode === 'decode' ? 'formats.base64' : 'avro.data')}</Label>
          <CodePanel
            input={input}
            output={task.result?.output ?? ''}
            language={mode === 'decode' ? 'plaintext' : 'json'}
            outputLanguage={mode === 'encode' ? 'plaintext' : 'json'}
            onInputChange={(value) => {
              clearResult();
              setInput(value);
            }}
          />
        </>
      )}
    </section>
  );
}
