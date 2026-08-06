import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  generatePoetryNames,
  loadPoetryBook,
  POETRY_BOOKS,
  type PoetryBookId,
  type PoetryName,
  type PoetryPassage,
} from '@/lib/gushi-namer';
import { createFileRoute } from '@tanstack/react-router';
import { BookOpen, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/gushi-namer')({
  component: GushiNamerPage,
});

function GushiNamerPage() {
  const { t } = useTranslation();
  const [bookQuery, setBook] = useQueryParam<PoetryBookId>(
    'book',
    StringParam,
    'shijing',
  );
  const book = POETRY_BOOKS.some((item) => item.id === bookQuery)
    ? bookQuery
    : 'shijing';
  const [familyName, setFamilyName] = useState('苏');
  const [passages, setPassages] = useState<PoetryPassage[]>([]);
  const [names, setNames] = useState<PoetryName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadPoetryBook(book)
      .then((source) => {
        if (cancelled) return;
        setPassages(source);
        setNames(generatePoetryNames(source));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(t('gushiNamer.loadError', { msg: String(cause) }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">{t('gushiNamer.title')}</h1>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600" />
              {t('gushiNamer.source')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('gushiNamer.book')}</p>
              <div className="grid grid-cols-2 gap-2">
                {POETRY_BOOKS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={book === item.id ? 'default' : 'outline'}
                    disabled={loading}
                    onClick={() => setBook(item.id)}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="family-name" className="text-sm font-medium">
                {t('gushiNamer.familyName')}
              </label>
              <Input
                id="family-name"
                value={familyName}
                maxLength={2}
                className="text-center text-lg"
                placeholder={t('gushiNamer.familyNamePlaceholder')}
                onChange={(event) => setFamilyName(event.target.value)}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={loading || passages.length === 0}
              onClick={() => setNames(generatePoetryNames(passages))}
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading ? t('gushiNamer.loading') : t('gushiNamer.refresh')}
            </Button>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {loading
                ? t('gushiNamer.reading')
                : t('gushiNamer.resultCount', { count: names.length })}
            </h2>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {t('gushiNamer.filtered')}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="h-72 animate-pulse rounded-xl border bg-muted/50"
                  />
                ))
              : names.map((item, index) => (
                  <NameCard
                    key={`${item.name}-${index}`}
                    familyName={familyName}
                    item={item}
                  />
                ))}
          </div>
        </section>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t('gushiNamer.reference')}{' '}
        <a
          href="https://github.com/holynova/gushi_namer"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          holynova/gushi_namer
        </a>
      </p>
    </div>
  );
}

function NameCard({
  familyName,
  item,
}: {
  familyName: string;
  item: PoetryName;
}) {
  const { t } = useTranslation();
  const nameCharacters = new Set(item.name.split(''));
  return (
    <Card className="h-full transition-colors hover:border-emerald-500/50">
      <CardHeader>
        <CardTitle className="text-3xl">
          {familyName}
          {item.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {item.dynasty ? `${item.dynasty} · ` : ''}
          {item.author || t('gushiNamer.unknownAuthor')} · {item.title}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <blockquote className="border-l-2 border-emerald-600 pl-4 leading-7">
          {item.sentence.split('').map((character, index) => (
            <span
              key={index}
              className={
                nameCharacters.has(character)
                  ? 'font-bold text-emerald-600 dark:text-emerald-400'
                  : undefined
              }
            >
              {character}
            </span>
          ))}
        </blockquote>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">《{item.title}》</Badge>
          <Badge variant="outline">{item.book}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
