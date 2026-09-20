import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import type {
  SchemaKind,
  SchemaRequest,
  SchemaResult,
} from '../lib/schema-workbench';
import { FileDropzone } from './file-dropzone';
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
const createWorker = () =>
  new Worker(
    new URL('../workers/schema-workbench.worker.ts', import.meta.url),
    { type: 'module' },
  );
const SAMPLES = {
  asyncapi: `asyncapi: 3.0.0\ninfo:\n  title: Orders API\n  version: 1.0.0\nchannels:\n  orders:\n    address: orders.created\n    messages:\n      created:\n        $ref: '#/components/messages/Created'\noperations:\n  sendOrder:\n    action: send\n    channel:\n      $ref: '#/channels/orders'\ncomponents:\n  messages:\n    Created:\n      payload:\n        type: object\n        properties:\n          id:\n            type: string`,
  cel: 'user.active && user.roles.exists(r, r == "admin") && size(user.roles) > 0',
  spdx: 'MIT OR (Apache-2.0 AND GPL-2.0-only WITH Classpath-exception-2.0)',
};
export default function SchemaWorkbenchPanel({ kind }: { kind: SchemaKind }) {
  const { t } = useTranslation();
  const [source, setSource] = useState(SAMPLES[kind]);
  const [data, setData] = useState(
    '{"user":{"active":true,"roles":["admin","reader"]}}',
  );
  const [numbers, setNumbers] = useQueryParam<string>(
    'numbers',
    StringParam,
    'double',
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const { result, error, busy, run, clear, cancel } = useBoundedWorker<
    SchemaRequest,
    SchemaResult
  >(createWorker, 25000);
  useEffect(() => {
    clear();
  }, [numbers, clear]);
  const reset = () => {
    generation.current++;
    clear();
    setFileError(null);
  };
  const errorMessage = error ?? fileError;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(`communitySchema.${kind}Hint`)}
      </p>
      {kind === 'asyncapi' && (
        <FileDropzone
          accept=".json,.yaml,.yml,application/json"
          onFiles={(files) => {
            const file = files[0]?.file;
            if (!file) return;
            reset();
            if (file.size > 1024 * 1024) {
              setFileError('LIMIT');
              return;
            }
            const id = generation.current;
            void file
              .text()
              .then((text) => {
                if (id === generation.current) setSource(text);
              })
              .catch((cause: unknown) => {
                if (id === generation.current)
                  setFileError((cause as Error).message);
              });
          }}
        >
          <span>{t('communitySchema.upload')}</span>
        </FileDropzone>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${kind}-source`}>{t('communitySchema.source')}</Label>
        <Textarea
          id={`${kind}-source`}
          value={source}
          onChange={(event) => {
            reset();
            setSource(event.target.value);
          }}
          spellCheck={false}
          className="min-h-48 font-mono text-xs"
        />
      </div>
      {kind === 'cel' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="cel-data">{t('communitySchema.bindings')}</Label>
            <Textarea
              id="cel-data"
              value={data}
              onChange={(event) => {
                reset();
                setData(event.target.value);
              }}
              spellCheck={false}
              className="min-h-32 font-mono text-xs"
            />
          </div>
          <Select
            value={numbers}
            onValueChange={(value) => {
              reset();
              setNumbers(value);
            }}
          >
            <SelectTrigger
              className="w-full sm:w-80"
              aria-label={t('communitySchema.numberType')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="double">
                {t('communitySchema.double')}
              </SelectItem>
              <SelectItem value="int">{t('communitySchema.int')}</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !source.trim()}
          onClick={() => {
            generation.current++;
            setFileError(null);
            run({ kind, source, data, integers: numbers === 'int' });
          }}
        >
          {t(busy ? 'communitySchema.running' : 'communitySchema.analyze')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {t('communitySchema.cancel')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            reset();
            setSource(SAMPLES[kind]);
          }}
        >
          {t('communitySchema.sample')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            reset();
            setSource('');
          }}
        >
          {t('communitySchema.clear')}
        </Button>
      </div>
      {errorMessage && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('communitySchema.failed', {
            message: t(`communitySchema.errors.${errorMessage}`, {
              defaultValue: errorMessage,
            }),
          })}
        </p>
      )}
      {result && (
        <div className="space-y-2">
          <p
            role="status"
            className={
              result.valid === false ? 'text-sm text-destructive' : 'text-sm'
            }
          >
            {t(
              result.valid === false
                ? 'communitySchema.invalid'
                : 'communitySchema.complete',
            )}
          </p>
          {result.tree && (
            <pre
              aria-label={t('communitySchema.tree')}
              className="max-h-96 overflow-auto rounded-md border p-3 font-mono text-sm"
            >
              {result.tree}
            </pre>
          )}
          <Label htmlFor={`${kind}-output`}>
            {t('communitySchema.output')}
          </Label>
          <Textarea
            id={`${kind}-output`}
            readOnly
            value={result.output}
            className="min-h-80 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}
