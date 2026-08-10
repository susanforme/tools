import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { DataUriPanel } from '@/components/extra-tool-panels';
import { BaseEncodingPanel } from '@/components/protocol-tool-panels';
import { base64ToBytes, bytesToBase64 } from '@/lib/developer-tools';
import { base32 } from '@otplib/plugin-base32-scure';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/base64')({ component: Base64Page });

function useTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };
  return { input, setInput, output, setOutput, error, setError, clear };
}

type TabType =
  | 'encode'
  | 'decode'
  | 'base32-encode'
  | 'base32-decode'
  | 'file'
  | 'data-uri'
  | 'base-extended';

function FileBase64Panel() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [name, setName] = useState('download.bin');
  const [mime, setMime] = useState('application/octet-stream');
  const [error, setError] = useState<string | null>(null);

  const load = async (file: File) => {
    setError(null);
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error(t('base64.fileLimit'));
      setValue(bytesToBase64(new Uint8Array(await file.arrayBuffer())));
      setName(file.name);
      setMime(file.type || 'application/octet-stream');
    } catch (cause) {
      setError(t('base64.fileError', { msg: (cause as Error).message }));
    }
  };

  const download = () => {
    setError(null);
    try {
      const url = URL.createObjectURL(
        new Blob([base64ToBytes(value).buffer as ArrayBuffer], { type: mime }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = name || 'download.bin';
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(t('base64.fileError', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <Input
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void load(file);
        }}
      />
      <Textarea
        className="min-h-72 font-mono text-xs"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('base64.filePlaceholder')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('base64.fileName')}</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>MIME</Label>
          <Input
            value={mime}
            onChange={(event) => setMime(event.target.value)}
          />
        </div>
      </div>
      <Button disabled={!value.trim()} onClick={download}>
        {t('base64.downloadFile')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Base64Panel({
  state,
  placeholder,
  outputPlaceholder,
  onAction,
  actionLabel,
  copied,
  onCopy,
}: {
  state: ReturnType<typeof useTool>;
  placeholder: string;
  outputPlaceholder: string;
  onAction: () => void;
  actionLabel: string;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={state.clear}>
          {t('base64.clear')}
        </Button>
      </div>
      {state.error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
            {t('base64.input')}
          </div>
          <textarea
            className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            value={state.input}
            onChange={(event) => state.setInput(event.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b">
            <span className="text-xs text-muted-foreground">
              {t('base64.output')}
            </span>
            {state.output && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onCopy(state.output)}
              >
                {copied ? t('base64.copied') : t('base64.copy')}
              </button>
            )}
          </div>
          <textarea
            readOnly
            className="w-full h-48 p-3 font-mono text-sm bg-muted/20 resize-none focus:outline-none"
            value={state.output}
            placeholder={outputPlaceholder}
          />
        </div>
      </div>
    </div>
  );
}

function Base64Page() {
  const { t } = useTranslation();
  const enc = useTool();
  const dec = useTool();
  const base32Enc = useTool();
  const base32Dec = useTool();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'encode');

  const encode = () => {
    enc.setError(null);
    try {
      enc.setOutput(btoa(unescape(encodeURIComponent(enc.input))));
    } catch (e) {
      enc.setError(t('base64.encodeError', { msg: (e as Error).message }));
    }
  };

  const decode = () => {
    dec.setError(null);
    try {
      dec.setOutput(decodeURIComponent(escape(atob(dec.input.trim()))));
    } catch (e) {
      dec.setError(t('base64.decodeError', { msg: (e as Error).message }));
    }
  };

  const encodeBase32 = () => {
    base32Enc.setError(null);
    try {
      base32Enc.setOutput(
        base32.encode(new TextEncoder().encode(base32Enc.input), {
          padding: true,
        }),
      );
    } catch (e) {
      base32Enc.setError(
        t('base64.base32EncodeError', { msg: (e as Error).message }),
      );
    }
  };

  const decodeBase32 = () => {
    base32Dec.setError(null);
    try {
      base32Dec.setOutput(
        new TextDecoder('utf-8', { fatal: true }).decode(
          base32.decode(base32Dec.input.trim()),
        ),
      );
    } catch (e) {
      base32Dec.setError(
        t('base64.base32DecodeError', { msg: (e as Error).message }),
      );
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('base64.title')}</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="encode">
            {t('base64.tabBase64Encode')}
          </TabsTrigger>
          <TabsTrigger value="decode">
            {t('base64.tabBase64Decode')}
          </TabsTrigger>
          <TabsTrigger value="base32-encode">
            {t('base64.tabBase32Encode')}
          </TabsTrigger>
          <TabsTrigger value="base32-decode">
            {t('base64.tabBase32Decode')}
          </TabsTrigger>
          <TabsTrigger value="file">{t('base64.tabFile')}</TabsTrigger>
          <TabsTrigger value="data-uri">Data URI</TabsTrigger>
          <TabsTrigger value="base-extended">Base58 / 85 / Bech32</TabsTrigger>
        </TabsList>
        <TabsContent value="encode" className="mt-4">
          <Base64Panel
            state={enc}
            placeholder={t('base64.encodePlaceholder')}
            outputPlaceholder={t('base64.encodeOutputPlaceholder')}
            onAction={encode}
            actionLabel={t('base64.encode')}
            copied={copied}
            onCopy={copy}
          />
        </TabsContent>
        <TabsContent value="decode" className="mt-4">
          <Base64Panel
            state={dec}
            placeholder={t('base64.decodePlaceholder')}
            outputPlaceholder={t('base64.decodeOutputPlaceholder')}
            onAction={decode}
            actionLabel={t('base64.decode')}
            copied={copied}
            onCopy={copy}
          />
        </TabsContent>
        <TabsContent value="base32-encode" className="mt-4">
          <Base64Panel
            state={base32Enc}
            placeholder={t('base64.encodePlaceholder')}
            outputPlaceholder={t('base64.base32EncodeOutputPlaceholder')}
            onAction={encodeBase32}
            actionLabel={t('base64.encode')}
            copied={copied}
            onCopy={copy}
          />
        </TabsContent>
        <TabsContent value="base32-decode" className="mt-4">
          <Base64Panel
            state={base32Dec}
            placeholder={t('base64.base32DecodePlaceholder')}
            outputPlaceholder={t('base64.decodeOutputPlaceholder')}
            onAction={decodeBase32}
            actionLabel={t('base64.decode')}
            copied={copied}
            onCopy={copy}
          />
        </TabsContent>
        <TabsContent value="file" className="mt-4">
          <FileBase64Panel />
        </TabsContent>
        <TabsContent value="data-uri" className="mt-4">
          <DataUriPanel />
        </TabsContent>
        <TabsContent value="base-extended" className="mt-4">
          <BaseEncodingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
