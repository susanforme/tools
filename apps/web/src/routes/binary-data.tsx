import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '../hooks/useQueryParams';
import { bytesToBase64 } from '../lib/developer-tools';
import { downloadBytes } from '../lib/download';
export const Route = createFileRoute('/binary-data')({
  component: BinaryDataPage,
});
function BinaryDataPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    format: string;
    direction: string;
  }>({
    format: withDefault<string>(StringParam, 'bson'),
    direction: withDefault<string>(StringParam, 'encode'),
  });
  const kind = query.format === 'ion' ? 'ion' : 'bson';
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const invalidate = () => {
    generation.current++;
    setOutput('');
    setBytes(null);
    setError(null);
    setLoading(false);
  };
  const run = async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    setOutput('');
    setBytes(null);
    try {
      const { convertBinaryData } = await import('../lib/binary-data');
      const result = await convertBinaryData(
        kind,
        query.direction === 'decode' ? 'decode' : 'encode',
        input,
      );
      if (version === generation.current) {
        setOutput(result.text);
        setBytes(result.bytes);
      }
    } catch (cause) {
      if (version === generation.current)
        setError(
          t('dataTools.failed', {
            defaultValue: '处理失败：{{message}}',
            message: (cause as Error).message,
          }),
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  };
  const loadFile = async (file: File | null) => {
    invalidate();
    const version = generation.current;
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error(
          t('dataTools.fileLimit', { defaultValue: '文件不能超过 2 MB' }),
        );
      const data = new Uint8Array(await file.arrayBuffer());
      if (version === generation.current) {
        setInput(bytesToBase64(data));
        setQuery({ direction: 'decode' });
      }
    } catch (cause) {
      if (version === generation.current)
        setError(
          t('dataTools.failed', {
            defaultValue: '处理失败：{{message}}',
            message: (cause as Error).message,
          }),
        );
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('dataTools.binaryTitle', { defaultValue: 'BSON / Amazon Ion 转换' })}
      </h1>
      <Tabs
        value={kind}
        onValueChange={(format) => {
          invalidate();
          setInput('');
          setQuery({ format });
        }}
      >
        <TabsList>
          <TabsTrigger value="bson">BSON / EJSON</TabsTrigger>
          <TabsTrigger value="ion">Amazon Ion</TabsTrigger>
        </TabsList>
      </Tabs>
      <Tabs
        value={query.direction === 'decode' ? 'decode' : 'encode'}
        onValueChange={(direction) => {
          invalidate();
          setInput('');
          setQuery({ direction });
        }}
      >
        <TabsList>
          <TabsTrigger value="encode">
            {t('dataTools.encode', { defaultValue: '文本 → 二进制 Base64' })}
          </TabsTrigger>
          <TabsTrigger value="decode">
            {t('dataTools.decode', { defaultValue: '二进制 Base64 → 文本' })}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        {t('dataTools.binaryLimit', {
          defaultValue:
            '最多 2 MB。BSON 使用规范 Extended JSON；Ion 保留类型与注解。',
        })}
      </p>
      <Label htmlFor="binary-file">
        {t('dataTools.binaryFile', { defaultValue: '导入二进制文件' })}
      </Label>
      <Input
        id="binary-file"
        type="file"
        accept={kind === 'bson' ? '.bson' : '.ion,.10n'}
        onChange={(event) => {
          void loadFile(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={loading}>
          {loading
            ? t('dataTools.processing', { defaultValue: '处理中…' })
            : t('dataTools.convert', { defaultValue: '转换' })}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setQuery({ direction: 'encode' });
            setInput(
              kind === 'bson'
                ? '{"_id":{"$oid":"507f1f77bcf86cd799439011"},"count":{"$numberLong":"9007199254740993"}}'
                : 'user::{name:"Alice",created:2026-01-01T,amount:123.45d0}',
            );
          }}
        >
          {t('dataTools.sample', { defaultValue: '填入示例' })}
        </Button>
        <Button
          variant="outline"
          disabled={!bytes}
          onClick={() =>
            bytes &&
            downloadBytes(bytes, `output.${kind === 'ion' ? '10n' : 'bson'}`)
          }
        >
          {t('dataTools.downloadBinary', { defaultValue: '下载二进制' })}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setInput('');
          }}
        >
          {t('dataTools.clear', { defaultValue: '清空' })}
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={(value) => {
          invalidate();
          setInput(value);
        }}
        error={error}
        language={
          kind === 'bson' && query.direction !== 'decode' ? 'json' : 'plaintext'
        }
        outputLanguage={
          kind === 'bson' && query.direction === 'decode' ? 'json' : 'plaintext'
        }
      />
    </div>
  );
}
