import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/cipher')({ component: CipherPage });

type Algorithm = 'AES' | 'DES' | 'TripleDES';
type Mode = 'CBC' | 'ECB' | 'CTR';

function useTool() {
  const [input, setInput] = useState('');
  const [key, setKey] = useState('');
  const [iv, setIv] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const clear = () => {
    setInput('');
    setKey('');
    setIv('');
    setOutput('');
    setError(null);
  };
  return {
    input,
    setInput,
    key,
    setKey,
    iv,
    setIv,
    output,
    setOutput,
    error,
    setError,
    loading,
    setLoading,
    clear,
  };
}

async function cipherWithCryptoJs(
  mode: 'encrypt' | 'decrypt',
  algo: Algorithm,
  text: string,
  key: string,
  ivStr: string,
  cipherMode: Mode,
) {
  const CryptoJS = (await import('crypto-js')).default;
  const algoMap = {
    AES: CryptoJS.AES,
    DES: CryptoJS.DES,
    TripleDES: CryptoJS.TripleDES,
  };
  const keyParsed = CryptoJS.enc.Utf8.parse(key);
  const ivParsed = CryptoJS.enc.Utf8.parse(ivStr);
  const cipherMode_ = CryptoJS.mode[cipherMode];
  const cfg =
    cipherMode === 'ECB'
      ? { mode: cipherMode_, padding: CryptoJS.pad.Pkcs7 }
      : { mode: cipherMode_, padding: CryptoJS.pad.Pkcs7, iv: ivParsed };

  if (mode === 'encrypt') {
    const encrypted = algoMap[algo].encrypt(text, keyParsed, cfg);
    return encrypted.toString();
  } else {
    const decrypted = algoMap[algo].decrypt(text, keyParsed, cfg);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      disabled={!text}
      className="shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function CipherPanel({
  op,
  algo,
  cipherMode,
  setCipherMode,
}: {
  op: 'encrypt' | 'decrypt';
  algo: Algorithm;
  cipherMode: Mode;
  setCipherMode: (m: Mode) => void;
}) {
  const { t } = useTranslation();
  const state = useTool();

  const run = async () => {
    if (!state.input.trim() || !state.key.trim()) return;
    state.setLoading(true);
    state.setError(null);
    try {
      const result = await cipherWithCryptoJs(
        op,
        algo,
        state.input,
        state.key,
        state.iv,
        cipherMode,
      );
      if (!result) throw new Error('结果为空，请检查密钥或输入内容');
      state.setOutput(result);
    } catch (e) {
      state.setError(
        t(op === 'encrypt' ? 'cipher.encryptError' : 'cipher.decryptError', {
          msg: (e as Error).message,
        }),
      );
    } finally {
      state.setLoading(false);
    }
  };

  const MODES: Mode[] = ['CBC', 'ECB', 'CTR'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-muted-foreground">{t('cipher.mode')}:</span>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setCipherMode(m)}
              className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                cipherMode === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {t('cipher.key')}
          </label>
          <input
            type="text"
            value={state.key}
            onChange={(e) => state.setKey(e.target.value)}
            placeholder={t('cipher.keyPlaceholder')}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            spellCheck={false}
          />
        </div>
        {cipherMode !== 'ECB' && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {t('cipher.iv')}
            </label>
            <input
              type="text"
              value={state.iv}
              onChange={(e) => state.setIv(e.target.value)}
              placeholder={t('cipher.ivPlaceholder')}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
            {op === 'encrypt' ? t('cipher.plaintext') : t('cipher.ciphertext')}
          </div>
          <textarea
            className="w-full h-40 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            value={state.input}
            onChange={(e) => state.setInput(e.target.value)}
            placeholder={
              op === 'encrypt'
                ? t('cipher.plaintextPlaceholder')
                : t('cipher.ciphertextPlaceholder')
            }
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center bg-muted/50 px-3 py-1.5 border-b">
            <span className="text-xs text-muted-foreground flex-1">
              {op === 'encrypt'
                ? t('cipher.ciphertext')
                : t('cipher.plaintext')}
            </span>
            <CopyButton text={state.output} />
          </div>
          <textarea
            className="w-full h-40 p-3 font-mono text-sm bg-background resize-none focus:outline-none text-muted-foreground"
            value={state.output}
            readOnly
            spellCheck={false}
          />
        </div>
      </div>

      {state.error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={run}
          disabled={state.loading || !state.input.trim() || !state.key.trim()}
        >
          {state.loading
            ? t('cipher.processing')
            : op === 'encrypt'
              ? t('cipher.encrypt')
              : t('cipher.decrypt')}
        </Button>
        <Button size="sm" variant="outline" onClick={state.clear}>
          {t('cipher.clear')}
        </Button>
      </div>
    </div>
  );
}

type CipherTabType = 'encrypt' | 'decrypt';

function CipherPage() {
  const { t } = useTranslation();
  const [algo, setAlgo] = useState<Algorithm>('AES');
  const [cipherMode, setCipherMode] = useState<Mode>('CBC');
  const [tab, setTab] = useQueryParam<CipherTabType>(
    'tab',
    StringParam,
    'encrypt',
  );

  const ALGOS: Algorithm[] = ['AES', 'DES', 'TripleDES'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('cipher.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('cipher.desc')}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-muted-foreground">{t('cipher.algorithm')}:</span>
        <div className="flex gap-1">
          {ALGOS.map((a) => (
            <button
              key={a}
              onClick={() => setAlgo(a)}
              className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                algo === a
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {a === 'TripleDES' ? '3DES' : a}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CipherTabType)}>
        <TabsList>
          <TabsTrigger value="encrypt">{t('cipher.tabEncrypt')}</TabsTrigger>
          <TabsTrigger value="decrypt">{t('cipher.tabDecrypt')}</TabsTrigger>
        </TabsList>
        <TabsContent value="encrypt" className="mt-4">
          <CipherPanel
            op="encrypt"
            algo={algo}
            cipherMode={cipherMode}
            setCipherMode={setCipherMode}
          />
        </TabsContent>
        <TabsContent value="decrypt" className="mt-4">
          <CipherPanel
            op="decrypt"
            algo={algo}
            cipherMode={cipherMode}
            setCipherMode={setCipherMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
