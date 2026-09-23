import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { searchDocuments } from '@/lib/document-workspace-core';
import { extractSearchDocument } from '@/lib/document-search-extraction';
import { PracticalText, useLatestJob } from '@/components/practical-ui';
import { ChoiceField } from '@/components/calculator-ui';
import { DocumentError } from '@/components/document-workspace-ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/document-search')({
  component: DocumentSearch,
});
function DocumentSearch() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useQueryParam<string>('type', StringParam, 'all');
  const job = useLatestJob<{
    docs: Awaited<ReturnType<typeof extractSearchDocument>>[];
    failures: { name: string; error: string }[];
  }>(String(revision));
  const hits = searchDocuments(job.result?.docs ?? [], query, type);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('documentWorkspaces.searchTitle')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('documentWorkspaces.searchLimit')}
      </p>
      <Input
        aria-label={t('documentWorkspaces.files')}
        type="file"
        accept=".txt,.md,.pdf,.docx"
        multiple
        onChange={(e) => {
          setFiles(Array.from(e.target.files ?? []));
          setRevision((v) => v + 1);
        }}
      />
      <Button
        disabled={!files.length || job.busy}
        onClick={() =>
          void job.run(async () => {
            if (
              files.length > 30 ||
              files.reduce((sum, f) => sum + f.size, 0) > 60 * 1024 * 1024
            )
              throw new Error('size');
            const docs: Awaited<ReturnType<typeof extractSearchDocument>>[] =
              [];
            const failures: { name: string; error: string }[] = [];
            for (const file of files) {
              try {
                docs.push(await extractSearchDocument(file));
              } catch (e) {
                failures.push({ name: file.name, error: (e as Error).message });
              }
            }
            return { docs, failures };
          })
        }
      >
        {t(job.busy ? 'documentWorkspaces.processing' : 'documentWorkspaces.index')}
      </Button>
      <DocumentError error={job.error} />
      {job.result && (
        <>
          <p>
            {t('documentWorkspaces.indexed', { count: job.result.docs.length })}
          </p>
          {job.result.failures.map((failure, i) => (
            <div key={i}>
              <span className="break-all text-sm">{failure.name}</span>
              <DocumentError error={failure.error} />
            </div>
          ))}
          <div className="grid gap-3 md:grid-cols-2">
            <PracticalText
              label={t('documentWorkspaces.keyword')}
              value={query}
              onChange={setQuery}
              maxLength={200}
            />
            <ChoiceField
              label={t('documentWorkspaces.fileType')}
              value={type}
              onChange={setType}
              options={['all', 'txt', 'md', 'pdf', 'docx'].map((value) => ({
                value,
                label:
                  value === 'all'
                    ? t('documentWorkspaces.all')
                    : value.toUpperCase(),
              }))}
            />
          </div>
          {query.trim() && (
            <p>{t('documentWorkspaces.hits', { count: hits.length })}</p>
          )}
          <div className="space-y-3">
            {hits.map((hit, i) => (
              <article key={i} className="rounded border p-3">
                <h2 className="break-all font-medium">
                  {hit.name} {hit.label && `· ${hit.label}`}
                </h2>
                <p className="break-words text-sm">
                  {hit.before}
                  <mark className="bg-yellow-200 text-black">{hit.hit}</mark>
                  {hit.after}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
