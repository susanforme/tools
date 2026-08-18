import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadMonaco } from '../lib/monaco';
import { Button } from './ui/button';

type MonacoTextEditorProps = {
  value: string;
  label: string;
  language?: string;
  height?: string;
  readOnly?: boolean;
  className?: string;
  onChange?: (value: string) => void;
};

export function MonacoTextEditor({
  value,
  label,
  language = 'plaintext',
  height = '480px',
  readOnly = false,
  className,
  onChange,
}: MonacoTextEditorProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [monacoReady, setMonacoReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadMonaco().then(() => {
      if (active) setMonacoReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex h-6 items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            disabled={!value}
            onClick={() => void copy()}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {t(copied ? 'panel.copied' : 'panel.copy')}
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-input">
        {monacoReady ? (
          <Editor
            height={height}
            language={language}
            value={value}
            onChange={readOnly ? undefined : (next) => onChange?.(next ?? '')}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={{
              ariaLabel: label,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderLineHighlight: 'all',
              readOnly,
            }}
          />
        ) : (
          <div className="min-h-80 bg-muted/20" aria-label={label} />
        )}
      </div>
    </div>
  );
}
