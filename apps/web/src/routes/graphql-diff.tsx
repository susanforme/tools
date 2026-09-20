import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import type { SchemaChange, SchemaDiffRequest } from '@/lib/graphql-diff';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/graphql-diff')({
  component: GraphqlDiffPage,
});
const LEVELS = ['all', 'BREAKING', 'DANGEROUS', 'NON_BREAKING'] as const;
const EXAMPLE = [
  'enum Role { USER }\ntype Query { user(id: ID): String old: Int role: Role }',
  'enum Role { USER ADMIN }\ntype Query { user(id: ID!): String added: Int role: Role }',
];
const MAX_BYTES = 2 * 1024 * 1024;
const createWorker = (): Worker =>
  new Worker(new URL('../workers/graphql-diff.worker.ts', import.meta.url), {
    type: 'module',
  });

function GraphqlDiffPage() {
  const { t, i18n } = useTranslation();
  const [level, setLevel] = useQueryParam<string>('level', StringParam, 'all');
  const [inputs, setInputs] = useState(['', '']);
  const task = useBoundedWorker<SchemaDiffRequest, SchemaChange[]>(
    createWorker,
    30_000,
  );
  const { result: changes, busy } = task;
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? task.error;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const fileRevisions = useRef([0, 0]);
  useEffect(
    () => () => {
      fileRevisions.current = fileRevisions.current.map((value) => value + 1);
    },
    [],
  );
  function edit(index: number, value: string) {
    task.clear();
    fileRevisions.current[index]++;
    setInputs((previous) =>
      previous.map((item, i) => (i === index ? value : item)),
    );
    setLocalError(null);
  }
  async function loadFile(index: number, file: File | undefined) {
    if (!file) return;
    const current = ++fileRevisions.current[index];
    task.clear();
    setLocalError(null);
    try {
      if (file.size > MAX_BYTES) throw new Error('sizeLimit');
      const text = await file.text();
      if (current === fileRevisions.current[index]) edit(index, text);
    } catch (cause) {
      if (current === fileRevisions.current[index])
        setLocalError((cause as Error).message);
    }
  }
  function compare() {
    task.clear();
    setLocalError(null);
    setPage(0);
    try {
      if (inputs.some((input) => new Blob([input]).size > MAX_BYTES))
        throw new Error('sizeLimit');
      if (inputs.some((input) => !input.trim())) throw new Error('emptyInput');
      task.run({ before: inputs[0], after: inputs[1] });
    } catch (cause) {
      task.clear();
      setLocalError((cause as Error).message);
    }
  }
  const selectedLevel = LEVELS.find((value) => value === level) ?? 'all';
  const filtered = (changes ?? []).filter(
    (change) =>
      (selectedLevel === 'all' || change.level === selectedLevel) &&
      `${change.path} ${change.message} ${change.type}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 100));
  const currentPage = Math.min(page, pages - 1);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('graphqlDiff.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('graphqlDiff.limit')}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {inputs.map((input, index) => (
          <div key={index} className="space-y-2">
            <Label htmlFor={`schema-${index}`}>
              {t(index ? 'graphqlDiff.after' : 'graphqlDiff.before')}
            </Label>
            <FileDropzone
              accept=".graphql,.graphqls,.gql,.json"
              onFiles={(files) => void loadFile(index, files[0]?.file)}
              className="block rounded-md p-3 text-center text-sm"
            >
              {t('graphqlDiff.upload')}
            </FileDropzone>
            <Textarea
              id={`schema-${index}`}
              value={input}
              onChange={(event) => edit(index, event.target.value)}
              className="h-56 font-mono text-sm"
              spellCheck={false}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || inputs.some((input) => !input.trim())}
          onClick={compare}
        >
          {t('graphqlDiff.compare')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            edit(0, EXAMPLE[0]);
            edit(1, EXAMPLE[1]);
          }}
        >
          {t('graphqlDiff.sample')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            edit(0, '');
            edit(1, '');
          }}
        >
          {t('graphqlDiff.clear')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={task.cancel}>
            {t('graphqlDiff.cancel')}
          </Button>
        )}
        {changes !== null && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob([JSON.stringify(changes, null, 2)], {
                  type: 'application/json',
                }),
                'graphql-schema-diff.json',
              )
            }
          >
            {t('graphqlDiff.export')}
          </Button>
        )}
      </div>
      {busy && <p role="status">{t('graphqlDiff.loading')}</p>}
      {error && (
        <p
          role="alert"
          className="whitespace-pre-wrap text-sm text-destructive"
        >
          {t('graphqlDiff.failed', {
            msg: t(`graphqlDiff.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      {changes !== null && (
        <>
          <p className="text-sm">
            {t('graphqlDiff.summary', {
              breaking: changes.filter((c) => c.level === 'BREAKING').length,
              dangerous: changes.filter((c) => c.level === 'DANGEROUS').length,
              safe: changes.filter((c) => c.level === 'NON_BREAKING').length,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedLevel}
              onValueChange={(value) => {
                setLevel(value);
                setPage(0);
              }}
            >
              <SelectTrigger
                className="w-48"
                aria-label={t('graphqlDiff.level')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`graphqlDiff.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="max-w-sm"
              aria-label={t('graphqlDiff.search')}
              placeholder={t('graphqlDiff.search')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </div>
          {!filtered.length && <p>{t('graphqlDiff.empty')}</p>}
          <div className="space-y-2">
            {filtered
              .slice(currentPage * 100, (currentPage + 1) * 100)
              .map((change, index) => (
                <article
                  key={index}
                  className="space-y-1 rounded-md border p-3 text-sm"
                >
                  <p className="break-all font-medium">
                    {t(`graphqlDiff.${change.level}`)} ·{' '}
                    {change.path || change.type}
                  </p>
                  <p className="break-words">
                    {i18n.resolvedLanguage?.startsWith('zh')
                      ? change.type
                          .split('_')
                          .map((part) =>
                            t(`graphqlDiff.parts.${part}`, {
                              defaultValue: part,
                            }),
                          )
                          .join('')
                      : change.message}
                  </p>
                  <details className="text-muted-foreground">
                    <summary className="cursor-pointer">
                      {t('graphqlDiff.rawDiagnostic')}
                    </summary>
                    <p className="mt-2 break-words">{change.message}</p>
                    {change.reason && (
                      <p className="mt-1 break-words">{change.reason}</p>
                    )}
                  </details>
                </article>
              ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                {t('graphqlDiff.previous')}
              </Button>
              <span>
                {currentPage + 1} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage + 1 === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                {t('graphqlDiff.next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
