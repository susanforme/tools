import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
const PostgresExplainPanel = lazy(
  () => import('@/components/postgres-explain-panel'),
);
const SqlStructurePanel = lazy(
  () => import('@/components/sql-structure-panel'),
);
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export const Route = createFileRoute('/sql')({ component: SqlPage });

type SqlDialect = 'sql' | 'mysql' | 'postgresql' | 'sqlite' | 'transactsql';

const SAMPLE_SQL = `SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count, SUM(o.amount) AS total_amount FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.created_at >= '2024-01-01' AND u.status = 'active' GROUP BY u.id, u.name, u.email HAVING COUNT(o.id) > 0 ORDER BY total_amount DESC LIMIT 20`;

function SqlPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState(SAMPLE_SQL);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useQueryParams<{ tab: string; dialect: string }>({
    tab: StringParam,
    dialect: StringParam,
  });
  const dialect: SqlDialect = [
    'sql',
    'mysql',
    'postgresql',
    'sqlite',
    'transactsql',
  ].includes(query.dialect ?? '')
    ? (query.dialect as SqlDialect)
    : 'sql';
  const setDialect = (dialect: SqlDialect) => setQuery({ dialect });

  const format = async () => {
    setError(null);
    setLoading(true);
    try {
      const { format: sqlFormat } = await import('sql-formatter');
      const result = sqlFormat(input, {
        language: dialect,
        tabWidth: 2,
        keywordCase: 'upper',
        indentStyle: 'standard',
      });
      setOutput(result);
    } catch (e) {
      setError(t('sql.formatError', { msg: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  const minify = () => {
    setError(null);
    try {
      const result = input
        .replace(/--[^\n]*/g, '') // 移除单行注释
        .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
        .replace(/\s+/g, ' ') // 合并空白
        .trim();
      setOutput(result);
    } catch (e) {
      setError(t('sql.minifyError', { msg: (e as Error).message }));
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('sql.title')}</h1>
      </div>
      <Tabs
        value={
          ['explain', 'dependencies', 'ddl'].includes(query.tab ?? '')
            ? query.tab!
            : 'format'
        }
        onValueChange={(tab) => setQuery({ tab })}
      >
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="format">{t('sql.format')}</TabsTrigger>
          <TabsTrigger value="explain">{t('postgresExplain.tab')}</TabsTrigger>
          <TabsTrigger value="dependencies">
            {t('communitySchema.dependenciesTitle')}
          </TabsTrigger>
          <TabsTrigger value="ddl">{t('communitySchema.ddlTitle')}</TabsTrigger>
        </TabsList>
        <TabsContent value="explain">
          <Suspense fallback={<p>{t('observability.loading')}</p>}>
            <PostgresExplainPanel />
          </Suspense>
        </TabsContent>
        {(['dependencies', 'ddl'] as const).map((mode) => (
          <TabsContent key={mode} value={mode}>
            {query.tab === mode && (
              <Suspense fallback={<p>{t('communitySchema.running')}</p>}>
                <SqlStructurePanel key={mode} mode={mode} />
              </Suspense>
            )}
          </TabsContent>
        ))}
        <TabsContent value="format" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {t('sql.dialect')}
            </span>
            <Select
              value={dialect}
              onValueChange={(v) => setDialect(v as SqlDialect)}
            >
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sql">Standard SQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
                <SelectItem value="transactsql">T-SQL</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={format} disabled={loading}>
              {loading ? t('sql.processing') : t('sql.format')}
            </Button>
            <Button size="sm" variant="outline" onClick={minify}>
              {t('sql.minify')}
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              {t('sql.clear')}
            </Button>
          </div>
          <CodePanel
            input={input}
            output={output}
            onInputChange={setInput}
            error={error}
            language="sql"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
