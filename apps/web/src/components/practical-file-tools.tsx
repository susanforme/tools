import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  TEXT_ENCODINGS,
  type FileTask,
  type FileTaskResult,
} from '@/lib/practical-files';
import { downloadBytes } from '@/lib/download';
import { FileDropzone, type DroppedFile } from './file-dropzone';
import { ChoiceField } from './calculator-ui';
import { PracticalFrame, ExportText } from './practical-ui';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
const createWorker = (): Worker =>
  new Worker(new URL('../workers/practical-files.worker.ts', import.meta.url), {
    type: 'module',
  });
export function PracticalFileTools({
  kind,
}: {
  kind: 'folder-compare' | 'duplicate-files' | 'text-encoding';
}) {
  const { t } = useTranslation();
  const [first, setFirst] = useState<DroppedFile[]>([]),
    [second, setSecond] = useState<DroppedFile[]>([]);
  const [query, setQuery] = useQueryParams<{
    source: string;
    target: string;
    bom: string;
    ending: string;
  }>({
    source: StringParam,
    target: StringParam,
    bom: StringParam,
    ending: StringParam,
  });
  const source = query.source ?? 'utf-8',
    target = query.target ?? 'utf-8',
    bom = query.bom ?? 'no',
    ending = query.ending ?? 'keep';
  const worker = useBoundedWorker<FileTask, FileTaskResult>(
    createWorker,
    120000,
  );
  useEffect(
    () => worker.clear(),
    [first, second, source, target, bom, ending, worker.clear],
  );
  const encoding = kind === 'text-encoding';
  const result = worker.result;
  return (
    <PracticalFrame id={kind} error={worker.error}>
      <div className="grid gap-4 md:grid-cols-2">
        <FileDropzone
          directory={kind === 'folder-compare'}
          dropDirectories
          multiple={!encoding}
          onFiles={setFirst}
          className="block rounded-lg p-8 text-center"
        >
          {t(kind === 'folder-compare' ? 'studio20.before' : 'studio20.files')}{' '}
          ({first.length})
        </FileDropzone>
        {kind === 'folder-compare' && (
          <FileDropzone
            directory
            multiple
            onFiles={setSecond}
            className="block rounded-lg p-8 text-center"
          >
            {t('studio20.after')} ({second.length})
          </FileDropzone>
        )}
      </div>
      {kind === 'folder-compare' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFirst([])}>
            {t('studio20.before')} · {t('studio20.emptyFolder')}
          </Button>
          <Button variant="outline" onClick={() => setSecond([])}>
            {t('studio20.after')} · {t('studio20.emptyFolder')}
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {encoding ? '5 MB' : t('studio20.limitFiles')}
      </p>
      {encoding && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <ChoiceField
              label={t('studio20.inputEncoding')}
              value={source}
              onChange={(source) => setQuery({ source })}
              options={TEXT_ENCODINGS.map((value) => ({ value, label: value }))}
            />
            <ChoiceField
              label={t('studio20.outputEncoding')}
              value={target}
              onChange={(target) => setQuery({ target, bom: 'no' })}
              options={TEXT_ENCODINGS.map((value) => ({ value, label: value }))}
            />
            <ChoiceField
              label={t('studio20.bom')}
              value={bom}
              onChange={(bom) => setQuery({ bom })}
              options={[
                'no',
                ...(target.startsWith('utf-') ? ['yes'] : []),
              ].map((value) => ({ value, label: t(`studio20.${value}`) }))}
            />
            <ChoiceField
              label={t('studio20.lineEnding')}
              value={ending}
              onChange={(ending) => setQuery({ ending })}
              options={['keep', 'lf', 'crlf'].map((value) => ({
                value,
                label:
                  value === 'keep' ? t('studio20.keep') : value.toUpperCase(),
              }))}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('studio20.encodingNote')}
          </p>
        </>
      )}
      <div className="flex gap-2">
        <Button
          disabled={
            worker.busy ||
            (kind === 'folder-compare'
              ? !first.length && !second.length
              : !first.length)
          }
          onClick={() =>
            worker.run(
              kind === 'folder-compare'
                ? { kind: 'compare', before: first, after: second }
                : kind === 'duplicate-files'
                  ? { kind: 'duplicates', files: first }
                  : {
                      kind: 'encoding',
                      file: first[0].file,
                      source,
                      target,
                      bom: bom === 'yes',
                      lineEnding: ending,
                    },
            )
          }
        >
          {t(worker.busy ? 'studio20.busy' : 'studio20.run')}
        </Button>
        {worker.busy && (
          <Button variant="outline" onClick={worker.cancel}>
            {t('studio20.cancel')}
          </Button>
        )}
      </div>
      {result?.kind === 'compare' && (
        <>
          <ExportText
            value={JSON.stringify(result.changes, null, 2)}
            name="folder-comparison.json"
            type="application/json"
          />
          <Table>
            <TableHeader>
              <TableRow>
                {['path', 'status', 'before', 'after'].map((key) => (
                  <TableHead key={key}>{t(`studio20.${key}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.changes.map((row) => (
                <TableRow key={row.path}>
                  <TableCell className="max-w-64 break-all">
                    {row.path}
                  </TableCell>
                  <TableCell>{t(`studio20.${row.status}`)}</TableCell>
                  <TableCell>{row.before}</TableCell>
                  <TableCell>{row.after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
      {result?.kind === 'duplicates' && (
        <>
          <p>
            {t('studio20.duplicateBytes')}:{' '}
            {result.groups.reduce(
              (sum, group) => sum + group.size * (group.paths.length - 1),
              0,
            )}
          </p>
          <ExportText
            value={JSON.stringify(result.groups, null, 2)}
            name="duplicate-files.json"
            type="application/json"
          />
          {result.groups.map((group, index) => (
            <details key={group.hash} open className="rounded-lg border p-3">
              <summary>
                {t('studio20.group')} {index + 1} · {group.size} B ×{' '}
                {group.paths.length}
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {group.paths.map((path) => (
                  <li className="break-all" key={path}>
                    {path}
                  </li>
                ))}
              </ul>
            </details>
          ))}
          {!result.groups.length && <p>{t('studio20.none')}</p>}
        </>
      )}
      {result?.kind === 'encoding' && (
        <>
          <Button
            onClick={() =>
              downloadBytes(
                result.bytes,
                `${target}-${first[0].file.name}`,
                'application/octet-stream',
              )
            }
          >
            {t('studio20.download')}
          </Button>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-4">
            {result.text.slice(0, 20000)}
          </pre>
        </>
      )}
    </PracticalFrame>
  );
}
