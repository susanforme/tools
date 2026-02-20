import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/url-encode')({
  component: UrlEncodePage,
});

type TabType = 'encode' | 'decode' | 'parse';

function useTool(init = '') {
  const [input, setInput] = useState(init);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };
  return { input, setInput, output, setOutput, error, setError, clear };
}

function UrlEncodePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'encode');
  const enc = useTool(
    'Hello World! 你好世界 https://example.com/search?q=foo&page=1',
  );
  const dec = useTool();
  const parse = useTool(
    'https://example.com/search?q=hello+world&lang=zh-CN&page=1',
  );
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const encode = () => {
    enc.setError(null);
    try {
      enc.setOutput(encodeURIComponent(enc.input));
    } catch (e) {
      enc.setError(t('urlEncode.encodeError', { msg: (e as Error).message }));
    }
  };

  const decode = () => {
    dec.setError(null);
    try {
      dec.setOutput(decodeURIComponent(dec.input));
    } catch (e) {
      dec.setError(t('urlEncode.decodeError', { msg: (e as Error).message }));
    }
  };

  const parseUrl = () => {
    parse.setError(null);
    try {
      const url = new URL(parse.input);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        params[k] = v;
      });
      const result = {
        protocol: url.protocol,
        host: url.host,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        params,
      };
      parse.setOutput(JSON.stringify(result, null, 2));
    } catch (e) {
      parse.setError(t('urlEncode.parseError', { msg: (e as Error).message }));
    }
  };

  const IOPanel = ({
    state,
    inputLabel,
    outputLabel,
    placeholder,
    onAction,
    actionLabel,
  }: {
    state: ReturnType<typeof useTool>;
    inputLabel: string;
    outputLabel: string;
    placeholder: string;
    onAction: () => void;
    actionLabel: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={state.clear}>
          {t('urlEncode.clear')}
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
            {inputLabel}
          </div>
          <textarea
            className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            value={state.input}
            onChange={(e) => state.setInput(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b">
            <span className="text-xs text-muted-foreground">{outputLabel}</span>
            {state.output && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => copy(state.output)}
              >
                {copied ? t('urlEncode.copied') : t('urlEncode.copy')}
              </button>
            )}
          </div>
          <textarea
            readOnly
            className="w-full h-48 p-3 font-mono text-sm bg-muted/20 resize-none focus:outline-none"
            value={state.output}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('urlEncode.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('urlEncode.desc')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="encode">{t('urlEncode.tabEncode')}</TabsTrigger>
          <TabsTrigger value="decode">{t('urlEncode.tabDecode')}</TabsTrigger>
          <TabsTrigger value="parse">{t('urlEncode.tabParse')}</TabsTrigger>
        </TabsList>
        <TabsContent value="encode" className="mt-4">
          <IOPanel
            state={enc}
            inputLabel={t('urlEncode.rawText')}
            outputLabel={t('urlEncode.encoded')}
            placeholder={t('urlEncode.encodePlaceholder')}
            onAction={encode}
            actionLabel={t('urlEncode.encode')}
          />
        </TabsContent>
        <TabsContent value="decode" className="mt-4">
          <IOPanel
            state={dec}
            inputLabel={t('urlEncode.encoded')}
            outputLabel={t('urlEncode.rawText')}
            placeholder={t('urlEncode.decodePlaceholder')}
            onAction={decode}
            actionLabel={t('urlEncode.decode')}
          />
        </TabsContent>
        <TabsContent value="parse" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={parseUrl}>
                {t('urlEncode.parse')}
              </Button>
              <Button size="sm" variant="outline" onClick={parse.clear}>
                {t('urlEncode.clear')}
              </Button>
            </div>
            {parse.error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {parse.error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
                  {t('urlEncode.urlInput')}
                </div>
                <textarea
                  className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
                  value={parse.input}
                  onChange={(e) => parse.setInput(e.target.value)}
                  placeholder="https://example.com/path?key=value"
                  spellCheck={false}
                />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
                  {t('urlEncode.parsed')}
                </div>
                <textarea
                  readOnly
                  className="w-full h-48 p-3 font-mono text-sm bg-muted/20 resize-none focus:outline-none"
                  value={parse.output}
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
