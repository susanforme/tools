import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { ProtobufRequest, ProtobufResult } from '@/lib/protobuf-schema';
import { downloadBlob } from '@/lib/download';
import { FormatActions } from './format-workbench';
import {
  CommunityError,
  CommunityOutput,
  createCommunityWorker,
} from './community-workbench';
import { FileDropzone, type DroppedFile } from './file-dropzone';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
const Wire = lazy(() =>
  import('./extra-tool-panels').then((module) => ({
    default: module.ProtobufPanel,
  })),
);
export default function ProtobufWorkbench() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    protoMode: string;
    protoAction: string;
    protoMessage: string;
    protoEncoding: string;
  }>({
    protoMode: StringParam,
    protoAction: StringParam,
    protoMessage: StringParam,
    protoEncoding: StringParam,
  });
  const mode = query.protoMode === 'schema' ? 'schema' : 'wire';
  const action = query.protoAction === 'decode' ? 'decode' : 'encode';
  const encoding = query.protoEncoding === 'base64' ? 'base64' : 'hex';
  const [schema, setSchema] = useState(''),
    [input, setInput] = useState(''),
    [imports, setImports] = useState<DroppedFile[]>([]),
    [messages, setMessages] = useState<string[]>([]);
  const task = useBoundedWorker<ProtobufRequest, ProtobufResult>(
    createCommunityWorker,
    10000,
  );
  const available = task.result?.messages ?? messages;
  const message = query.protoMessage ?? '';
  const invalidate = () => {
    task.clear();
    setMessages([]);
  };
  const run = (mode: ProtobufRequest['mode']) => {
    setMessages(available);
    task.run({
      kind: 'protobuf',
      schema,
      imports: imports.map((item) => ({ path: item.path, source: item.file })),
      message,
      mode,
      input,
      encoding,
    });
  };
  return (
    <div className="space-y-4 min-w-0">
      <Tabs
        value={mode}
        onValueChange={(value) => {
          task.clear();
          setQuery({ protoMode: value });
        }}
      >
        <TabsList>
          <TabsTrigger value="wire">{t('protoSchema.wire')}</TabsTrigger>
          <TabsTrigger value="schema">{t('protoSchema.title')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'wire' ? (
        <Suspense fallback={<p>{t('formats.running')}</p>}>
          <Wire />
        </Suspense>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('protoSchema.note')}
          </p>
          <Label htmlFor="proto-schema">{t('protoSchema.schema')}</Label>
          <Textarea
            id="proto-schema"
            className="h-48 font-mono text-sm"
            value={schema}
            onChange={(e) => {
              invalidate();
              setSchema(e.target.value);
            }}
          />
          <FileDropzone
            multiple
            directory
            accept=".proto"
            onFiles={(files) => {
              invalidate();
              setImports(files);
            }}
          >
            {t('protoSchema.imports', { count: imports.length })}
          </FileDropzone>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={task.busy}
              onClick={() => run('inspect')}
            >
              {t('protoSchema.inspect')}
            </Button>
            <Select
              value={message}
              onValueChange={(value) => {
                setMessages(available);
                task.clear();
                setQuery({ protoMessage: value });
              }}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder={t('protoSchema.message')} />
              </SelectTrigger>
              <SelectContent>
                {available.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={action}
              onValueChange={(value) => {
                setMessages(available);
                task.clear();
                setQuery({ protoAction: value });
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encode">
                  {t('protoSchema.encode')}
                </SelectItem>
                <SelectItem value="decode">
                  {t('protoSchema.decode')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={encoding}
              onValueChange={(value) => {
                setMessages(available);
                task.clear();
                setQuery({ protoEncoding: value });
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            aria-label={t('protoSchema.input')}
            value={input}
            onChange={(e) => {
              setMessages(available);
              task.clear();
              setInput(e.target.value);
            }}
            className="h-48 font-mono text-sm"
          />
          <FormatActions
            busy={task.busy}
            run={() => run(action)}
            cancel={task.cancel}
            clear={() => {
              invalidate();
              setSchema('');
              setInput('');
              setImports([]);
            }}
            sample={() => {
              invalidate();
              setImports([]);
              setSchema(
                'syntax = "proto3";\npackage demo;\nmessage Person { string name = 1; int64 id = 2; repeated string tags = 3; }',
              );
              setInput('{"name":"Ada","id":"9007199254740993","tags":["dev"]}');
              setMessages(['demo.Person']);
              setQuery({ protoMessage: 'demo.Person', protoAction: 'encode' });
            }}
          />
          <CommunityError error={task.error} />
          <CommunityOutput output={task.result?.output ?? ''} />
          {task.result?.binary && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([task.result!.binary!.slice().buffer]),
                  'message.bin',
                )
              }
            >
              {t('formats.downloadBinary')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
