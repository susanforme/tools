import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createEpub,
  importBookDraft,
  type BookDraft,
} from '@/lib/epub-authoring';
import { downloadBytes } from '@/lib/download';
import { PracticalText, useLatestJob } from './practical-ui';
import { DocumentError } from './document-workspace-ui';
import { Input } from './ui/input';
import { Button } from './ui/button';
const EMPTY: BookDraft = {
  title: '',
  author: '',
  language: 'zh',
  description: '',
  chapters: [{ title: '1', text: '' }],
  assets: {},
  cover: null,
  coverType: 'image/png',
};
export function EpubMaker() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<BookDraft>(EMPTY),
    [revision, setRevision] = useState(0),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const job = useLatestJob<Uint8Array>(String(revision));
  const update = (patch: Partial<BookDraft>) => {
    request.current++;
    setBusy(false);
    setDraft((prev) => ({ ...prev, ...patch }));
    setRevision((v) => v + 1);
  };
  const importFile = async (file: File) => {
    const ticket = ++request.current;
    setBusy(true);
    setError(null);
    try {
      const result = await importBookDraft(file);
      if (ticket !== request.current) return;
      setDraft(result);
      setRevision((v) => v + 1);
    } catch (cause) {
      if (ticket === request.current) setError((cause as Error).message);
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('documentWorkspaces.epubHint')}
      </p>
      <Input
        type="file"
        accept=".txt,.md,.epub"
        aria-label={t('documentWorkspaces.importBook')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
        }}
      />
      {busy && <p>{t('documentWorkspaces.processing')}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {(['title', 'author', 'language'] as const).map((field) => (
          <PracticalText
            key={field}
            label={t(`documentWorkspaces.${field}`)}
            value={draft[field]}
            onChange={(value) => update({ [field]: value })}
            maxLength={field === 'language' ? 30 : 300}
          />
        ))}
      </div>
      <PracticalText
        label={t('documentWorkspaces.description')}
        value={draft.description}
        onChange={(description) => update({ description })}
        multiline
        maxLength={3000}
      />
      <label className="block space-y-2 text-sm">
        <span>{t('documentWorkspaces.cover')}</span>
        <Input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ticket = ++request.current;
            void (async () => {
              try {
                if (
                  file.size > 5 * 1024 * 1024 ||
                  !['image/png', 'image/jpeg'].includes(file.type)
                )
                  throw new Error('size');
                const bitmap = await createImageBitmap(file);
                bitmap.close();
                const cover = new Uint8Array(await file.arrayBuffer());
                if (ticket === request.current)
                  update({ cover, coverType: file.type });
              } catch (cause) {
                if (ticket === request.current)
                  setError((cause as Error).message);
              }
            })();
          }}
        />
      </label>
      {draft.cover && (
        <Button variant="outline" onClick={() => update({ cover: null })}>
          {t('documentWorkspaces.removeCover')}
        </Button>
      )}
      {draft.chapters.map((chapter, i) => (
        <section key={i} className="space-y-3 rounded border p-3">
          <PracticalText
            label={`${t('documentWorkspaces.chapter')} ${i + 1}`}
            value={chapter.title}
            maxLength={300}
            onChange={(title) =>
              update({
                chapters: draft.chapters.map((c, n) =>
                  n === i ? { ...c, title } : c,
                ),
              })
            }
          />
          <PracticalText
            label={t('documentWorkspaces.body')}
            value={chapter.text}
            onChange={(text) =>
              update({
                chapters: draft.chapters.map((c, n) =>
                  n === i ? { ...c, text } : c,
                ),
              })
            }
            multiline
            maxLength={200000}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={i === 0}
              onClick={() => {
                const chapters = [...draft.chapters];
                [chapters[i - 1], chapters[i]] = [chapters[i], chapters[i - 1]];
                update({ chapters });
              }}
            >
              {t('documentWorkspaces.up')}
            </Button>
            <Button
              variant="outline"
              disabled={i === draft.chapters.length - 1}
              onClick={() => {
                const chapters = [...draft.chapters];
                [chapters[i + 1], chapters[i]] = [chapters[i], chapters[i + 1]];
                update({ chapters });
              }}
            >
              {t('documentWorkspaces.down')}
            </Button>
            <Button
              variant="outline"
              disabled={draft.chapters.length === 1}
              onClick={() =>
                update({ chapters: draft.chapters.filter((_, n) => n !== i) })
              }
            >
              {t('documentWorkspaces.remove')}
            </Button>
          </div>
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={draft.chapters.length >= 100}
          onClick={() =>
            update({
              chapters: [
                ...draft.chapters,
                { title: String(draft.chapters.length + 1), text: '' },
              ],
            })
          }
        >
          {t('documentWorkspaces.addChapter')}
        </Button>
        <Button
          disabled={job.busy || busy}
          onClick={() => void job.run(() => createEpub(draft))}
        >
          {t(
            job.busy
              ? 'documentWorkspaces.processing'
              : 'documentWorkspaces.generate',
          )}
        </Button>
        {job.result && (
          <Button
            onClick={() =>
              downloadBytes(job.result!, 'book.epub', 'application/epub+zip')
            }
          >
            {t('documentWorkspaces.download')}
          </Button>
        )}
      </div>
      <DocumentError error={error ?? job.error} />
    </div>
  );
}
