import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import type { FeedResult } from '@/lib/feed-inspector';
import type { ProtocolSource } from '@/lib/community-protocols';
import { FileDropzone } from '@/components/file-dropzone';
import { FormatActions } from '@/components/format-workbench';
import {
  CommunityError,
  createCommunityWorker,
} from '@/components/community-workbench';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { downloadBlob } from '@/lib/download';
export const Route = createFileRoute('/feed-inspector')({
  component: FeedInspectorPage,
});
function FeedInspectorPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ q: string }>({ q: StringParam });
  const [input, setInput] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [page, setPage] = useState(0);
  const task = useBoundedWorker<
    { kind: 'feed'; input: ProtocolSource },
    FeedResult
  >(createCommunityWorker, 10000);
  const clear = () => {
    task.clear();
    setPage(0);
  };
  const q = (query.q ?? '').toLocaleLowerCase();
  const result = task.result;
  const items =
    result?.items.filter((item) =>
      `${item.title} ${item.summary} ${item.author} ${item.id}`
        .toLocaleLowerCase()
        .includes(q),
    ) ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 min-w-0">
      <h1 className="text-2xl font-bold">{t('feed.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('feed.note')}</p>
      <FileDropzone
        accept=".xml,.rss,.atom,application/xml,text/xml"
        onFiles={(files) => {
          clear();
          setFile(files[0]?.file ?? null);
        }}
      >
        {file?.name ?? t('feed.upload')}
      </FileDropzone>
      <Textarea
        aria-label={t('feed.input')}
        value={input}
        onChange={(e) => {
          clear();
          setFile(null);
          setInput(e.target.value);
        }}
        className="h-64 font-mono text-sm"
      />
      <FormatActions
        busy={task.busy}
        run={() => {
          clear();
          task.run({ kind: 'feed', input: file ?? input });
        }}
        cancel={task.cancel}
        clear={() => {
          clear();
          setInput('');
          setFile(null);
        }}
        sample={() => {
          clear();
          setFile(null);
          setInput(
            '<rss version="2.0"><channel><title>Dev news</title><link>https://example.com/</link><description>Updates</description><item><guid>post-1</guid><title>Release</title><link>https://example.com/release</link><description><![CDATA[<b>New features</b>]]></description></item></channel></rss>',
          );
        }}
      />
      <CommunityError error={task.error} />
      {result && (
        <>
          <div className="rounded-md border p-4 space-y-2 break-words">
            <p>
              {result.format} ·{' '}
              {t('feed.count', { count: result.items.length })}
            </p>
            <h2 className="font-semibold">{result.title}</h2>
            <p className="whitespace-pre-wrap">{result.description}</p>
            <p>{result.updated}</p>
            {result.link && (
              <a
                className="text-primary underline break-all"
                href={result.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.link}
              </a>
            )}
          </div>
          <div className="space-y-2">
            <p>{t('feed.issues', { count: result.issues.length })}</p>
            {result.issues.length > 0 && (
              <Textarea
                readOnly
                aria-label={t('feed.validation')}
                className="h-40"
                value={result.issues
                  .map(
                    (issue) =>
                      `${issue.path}: ${t(`feed.issue.${issue.code}`)}`,
                  )
                  .join('\n')}
              />
            )}
          </div>
          <Input
            aria-label={t('feed.search')}
            placeholder={t('feed.search')}
            value={query.q ?? ''}
            onChange={(e) => {
              setQuery({ q: e.target.value });
              setPage(0);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              {t('community.previous')}
            </Button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(items.length / 25))}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={(page + 1) * 25 >= items.length}
              onClick={() => setPage(page + 1)}
            >
              {t('community.next')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(result, null, 2)], {
                    type: 'application/json',
                  }),
                  'feed.json',
                )
              }
            >
              {t('community.exportAll')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {items.slice(page * 25, page * 25 + 25).map((item, index) => (
              <article
                key={page * 25 + index}
                className="min-w-0 rounded-md border p-4 space-y-2 break-words"
              >
                <h3 className="font-semibold">
                  {item.title || item.id || '—'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {item.author} {item.date}
                </p>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary underline"
                  >
                    {item.link}
                  </a>
                )}
                <p className="whitespace-pre-wrap text-sm">{item.summary}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
