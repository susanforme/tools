import { useTheme } from '@/hooks/use-theme';
import {
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { formatJson, summarizeDiff } from '@/lib/diff';
import { DiffEditor, type DiffOnMount } from '@monaco-editor/react';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeftRight, Braces, Columns2, Rows3, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import '../lib/monaco';

export const Route = createFileRoute('/diff')({ component: DiffPage });

const LANGUAGES = [
  { value: 'plaintext', labelKey: 'diff.languages.text' },
  { value: 'json', labelKey: 'diff.languages.json' },
  { value: 'javascript', labelKey: 'diff.languages.javascript' },
  { value: 'typescript', labelKey: 'diff.languages.typescript' },
  { value: 'html', labelKey: 'diff.languages.html' },
  { value: 'css', labelKey: 'diff.languages.css' },
  { value: 'markdown', labelKey: 'diff.languages.markdown' },
  { value: 'yaml', labelKey: 'diff.languages.yaml' },
  { value: 'sql', labelKey: 'diff.languages.sql' },
] as const;

type DiffLanguage = (typeof LANGUAGES)[number]['value'];
type DiffView = 'side-by-side' | 'inline';
type DiffQuery = {
  language: string;
  view: string;
  ignoreWhitespace: number;
};

const DIFF_QUERY_PARAMS = {
  language: withDefault<string>(StringParam, 'plaintext'),
  view: withDefault<string>(StringParam, 'side-by-side'),
  ignoreWhitespace: withDefault<number>(NumberParam, 1),
};

function isDiffLanguage(value: string | undefined): value is DiffLanguage {
  return LANGUAGES.some((language) => language.value === value);
}

function DiffPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [query, setQuery] = useQueryParams<DiffQuery>(DIFF_QUERY_PARAMS);
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [stats, setStats] = useState({ added: 0, removed: 0 });
  const [error, setError] = useState<string | null>(null);

  const language = isDiffLanguage(query.language)
    ? query.language
    : 'plaintext';
  const view: DiffView = query.view === 'inline' ? 'inline' : 'side-by-side';
  const ignoreWhitespace = query.ignoreWhitespace !== 0;

  const handleMount = useCallback<DiffOnMount>((editor) => {
    const originalEditor = editor.getOriginalEditor();
    const modifiedEditor = editor.getModifiedEditor();
    originalEditor.onDidChangeModelContent(() => {
      setOriginal(originalEditor.getValue());
    });
    modifiedEditor.onDidChangeModelContent(() => {
      setModified(modifiedEditor.getValue());
    });
    editor.onDidUpdateDiff(() => {
      setStats(summarizeDiff(editor.getLineChanges()));
    });
  }, []);

  const swap = () => {
    setOriginal(modified);
    setModified(original);
    setError(null);
  };

  const clear = () => {
    setOriginal('');
    setModified('');
    setStats({ added: 0, removed: 0 });
    setError(null);
  };

  const formatBothJson = () => {
    setError(null);
    try {
      const formattedOriginal = formatJson(original);
      const formattedModified = formatJson(modified);
      setOriginal(formattedOriginal);
      setModified(formattedModified);
    } catch (cause) {
      setError(`${t('diff.invalidJson')}：${(cause as Error).message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('diff.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('diff.desc')}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={language}
          onValueChange={(value) => setQuery({ language: value })}
        >
          <SelectTrigger size="sm" aria-label={t('diff.language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={swap}>
          <ArrowLeftRight />
          {t('diff.swap')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          <Trash2 />
          {t('diff.clear')}
        </Button>
        {language === 'json' && (
          <Button size="sm" variant="outline" onClick={formatBothJson}>
            <Braces />
            {t('diff.formatJson')}
          </Button>
        )}

        <div className="flex items-center rounded-md border p-0.5">
          <Button
            size="sm"
            variant={view === 'side-by-side' ? 'secondary' : 'ghost'}
            className="h-7 px-2"
            onClick={() => setQuery({ view: 'side-by-side' })}
          >
            <Columns2 />
            {t('diff.sideBySide')}
          </Button>
          <Button
            size="sm"
            variant={view === 'inline' ? 'secondary' : 'ghost'}
            className="h-7 px-2"
            onClick={() => setQuery({ view: 'inline' })}
          >
            <Rows3 />
            {t('diff.inline')}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={ignoreWhitespace}
            onCheckedChange={(checked) =>
              setQuery({ ignoreWhitespace: checked === true ? 1 : 0 })
            }
          />
          {t('diff.ignoreWhitespace')}
        </label>

        <span className="ml-auto text-sm text-muted-foreground">
          <span className="text-green-600 dark:text-green-400 font-medium">
            +{stats.added}
          </span>{' '}
          {t('diff.added')} ·{' '}
          <span className="text-red-600 dark:text-red-400 font-medium">
            -{stats.removed}
          </span>{' '}
          {t('diff.removed')}
        </span>
      </div>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 bg-muted/50 border-b text-xs text-muted-foreground">
          <div className="px-3 py-2 border-r">{t('diff.original')}</div>
          <div className="px-3 py-2">{t('diff.modified')}</div>
        </div>
        <DiffEditor
          height="620px"
          language={language}
          original={original}
          modified={modified}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onMount={handleMount}
          loading={t('diff.loading')}
          options={{
            originalEditable: true,
            renderSideBySide: view === 'side-by-side',
            useInlineViewWhenSpaceIsLimited: true,
            ignoreTrimWhitespace: ignoreWhitespace,
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: 'on',
            diffWordWrap: 'on',
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
