import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '../hooks/useQueryParams';
import { bytesToBase64 } from '../lib/developer-tools';
import { downloadBlob } from '../lib/download';
import type { FormatResult } from '../lib/format-input';
import type { WasmRequest } from '../lib/wasm-tool';
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
export default function WasmPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ wasmMode: string }>({
    wasmMode: StringParam,
  });
  const mode = query.wasmMode === 'binary' ? 'binary' : 'wat';
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
  const task = useBoundedWorker<WasmRequest, FormatResult>(
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
      const isWat = file.name.toLowerCase().endsWith('.wat');
      const value = isWat
        ? await file.text()
        : bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      if (current === epoch.current) {
        setInput(value);
        setQuery({ wasmMode: isWat ? 'wat' : 'binary' });
      }
    } catch (cause) {
      if (current === epoch.current) setError((cause as Error).message);
    } finally {
      if (current === epoch.current) setReading(false);
    }
  };
  return (
    <section className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t('wasm.note')}</p>
      <div className="flex items-center gap-2">
        <Label>{t('formats.mode')}</Label>
        <Select
          value={mode}
          onValueChange={(wasmMode) => {
            clearResult();
            setQuery({ wasmMode });
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wat">WAT → WASM</SelectItem>
            <SelectItem value="binary">WASM → WAT</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <FileDropzone
        accept=".wasm,.wat"
        onFiles={(files) => {
          if (files[0]) void load(files[0].file);
        }}
        className="flex min-h-20 items-center justify-center rounded-md p-3 text-sm"
      >
        {t('wasm.upload')}
      </FileDropzone>
      <FormatActions
        busy={task.busy || reading}
        run={() => task.run({ kind: 'wasm', mode, input })}
        cancel={() => {
          epoch.current++;
          setReading(false);
          task.cancel();
        }}
        clear={() => {
          clearResult();
          setInput('');
        }}
        sample={() => {
          clearResult();
          setQuery({ wasmMode: 'wat' });
          setInput(
            '(module\n  (import "env" "log" (func $log (param i32)))\n  (func (export "answer") (result i32)\n    i32.const 42))',
          );
        }}
      />
      <FormatFeedback error={error ?? task.error} info={task.result?.info} />
      {task.result?.binary && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([Uint8Array.from(task.result!.binary!)], {
                  type: 'application/wasm',
                }),
                'module.wasm',
              )
            }
          >
            {t('wasm.downloadWasm')}
          </Button>
          {mode === 'binary' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([task.result!.output], { type: 'text/plain' }),
                  'module.wat',
                )
              }
            >
              {t('wasm.downloadWat')}
            </Button>
          )}
        </div>
      )}
      <Label>{t(mode === 'binary' ? 'formats.base64' : 'wasm.wat')}</Label>
      <CodePanel
        input={input}
        output={task.result?.output ?? ''}
        language="plaintext"
        onInputChange={(value) => {
          clearResult();
          setInput(value);
        }}
      />
    </section>
  );
}
