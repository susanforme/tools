import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseCertificate, type CertificateInfo } from '@/lib/certificate';
import { createFileRoute } from '@tanstack/react-router';
import { FileKey, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/certificate-tool')({
  component: CertificateToolPage,
});

function CertificateToolPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState<string | ArrayBuffer>('');
  const [text, setText] = useState('');
  const [info, setInfo] = useState<CertificateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inspect = async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await parseCertificate(typeof input === 'string' ? text : input));
    } catch (cause) {
      setError(t('certificateTool.error', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };
  const loadFile = async (file: File) => {
    const content = await file.text();
    if (content.includes('-----BEGIN')) {
      setInput(content);
      setText(content);
    } else {
      setInput(await file.arrayBuffer());
      setText(file.name);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('certificateTool.title')}</h1>
      <FileDropzone
        accept=".pem,.crt,.cer,.csr,application/pkix-cert"
        onFiles={(files) => files[0] && void loadFile(files[0].file)}
        className="flex min-h-28 items-center justify-center rounded-xl p-5 text-center"
      >
        <div>
          <FileKey className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          {t('certificateTool.drop')}
        </div>
      </FileDropzone>
      <Textarea
        aria-label={t('certificateTool.title')}
        className="min-h-64 font-mono"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setInput(event.target.value);
        }}
      />
      <Button
        disabled={loading || (!text && !(input instanceof ArrayBuffer))}
        onClick={() => void inspect()}
      >
        {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {t('certificateTool.inspect')}
      </Button>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {info && (
        <div className="divide-y rounded-xl border">
          {Object.entries(info).map(([key, value]) => (
            <div
              key={key}
              className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[12rem_1fr]"
            >
              <span className="text-muted-foreground">
                {t(`certificateTool.fields.${key}`)}
              </span>
              <span className="break-all font-mono">
                {Array.isArray(value) ? value.join(', ') || '—' : value || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
