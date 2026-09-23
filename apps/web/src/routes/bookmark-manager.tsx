import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  bookmarkKey,
  exportBookmarks,
  mergeBookmarks,
  parseBookmarks,
  validateBookmarks,
  type Bookmark,
  type BookmarkData,
  type BookmarkFolder,
} from '@/lib/productivity-data';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import {
  ProductivityError,
  ProductivityImport,
  saveProductivityText,
} from '@/components/productivity-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export const Route = createFileRoute('/bookmark-manager')({
  component: BookmarkManager,
});
const INITIAL: BookmarkData = { folders: [], bookmarks: [] };
function BookmarkManager() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'bookmark-manager-v1',
    INITIAL,
    validateBookmarks,
  );
  const data = store.data;
  const [query, setQuery] = useQueryParams<{
    q: string;
    folder: string;
    move: string;
    duplicates: string;
    page: number;
  }>({
    q: StringParam,
    folder: StringParam,
    move: StringParam,
    duplicates: StringParam,
    page: NumberParam,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Bookmark | null>(null);
  const [folderDraft, setFolderDraft] = useState<BookmarkFolder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = (id: string): string => {
    const parts: string[] = [];
    let current = data.folders.find((f) => f.id === id);
    while (current) {
      parts.unshift(current.name);
      current = data.folders.find((f) => f.id === current!.parent);
    }
    return parts.join(' / ');
  };
  const folderOptions = [
    { value: '__root', label: t('productivity.root') },
    ...data.folders
      .map((f) => ({ value: f.id, label: path(f.id) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const folder =
    query.folder === '__root'
      ? ''
      : data.folders.some((f) => f.id === query.folder)
        ? query.folder
        : null;
  const target = data.folders.some((f) => f.id === query.move)
    ? query.move!
    : '';
  const counts = new Map<string, number>();
  data.bookmarks.forEach((b) =>
    counts.set(bookmarkKey(b.url), (counts.get(bookmarkKey(b.url)) ?? 0) + 1),
  );
  const duplicates = [...counts.values()].reduce(
    (n, count) => n + Math.max(0, count - 1),
    0,
  );
  const filtered = data.bookmarks.filter(
    (b) =>
      (folder === null || b.folder === folder) &&
      [b.title, b.url, path(b.folder)].some((v) =>
        v.toLowerCase().includes((query.q ?? '').toLowerCase()),
      ) &&
      (query.duplicates !== 'yes' || (counts.get(bookmarkKey(b.url)) ?? 0) > 1),
  );
  const page = Math.max(
    0,
    Math.min(
      Math.floor(query.page ?? 0) || 0,
      Math.ceil(filtered.length / 50) - 1,
    ),
  );
  const shown = filtered.slice(page * 50, page * 50 + 50);
  const picked = selected.filter((id) =>
    data.bookmarks.some((b) => b.id === id),
  );
  const save = (next: BookmarkData) => {
    if (!validateBookmarks(next)) {
      setError('invalid');
      return false;
    }
    if (store.setData(next)) {
      setError(null);
      return true;
    }
    return false;
  };
  return (
    <OrganizerFrame
      title={t('productivity.tools.bookmark-manager.title')}
      store={store}
    >
      <p className="text-sm text-muted-foreground">{t('productivity.limit')}</p>
      <ProductivityImport<BookmarkData>
        accept=".html,.htm,text/html"
        parse={parseBookmarks}
        onImport={(incoming) => {
          if (!store.setData((previous) => mergeBookmarks(previous, incoming)))
            throw new Error('invalid');
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={data.bookmarks.length >= 2000}
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              title: '',
              url: '',
              folder: folder ?? '',
            })
          }
        >
          {t('productivity.add')}
        </Button>
        <Button
          variant="outline"
          disabled={data.folders.length >= 500}
          onClick={() =>
            setFolderDraft({
              id: crypto.randomUUID(),
              name: '',
              parent: folder ?? '',
            })
          }
        >
          {t('productivity.newFolder')}
        </Button>
        <Button
          variant="outline"
          disabled={!duplicates}
          onClick={() => {
            const seen = new Set<string>();
            save({
              ...data,
              bookmarks: data.bookmarks.filter((b) => {
                const key = bookmarkKey(b.url);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }),
            });
          }}
        >
          {t('productivity.removeDuplicates')} ({duplicates})
        </Button>
        <Button
          variant="outline"
          disabled={!data.bookmarks.length && !data.folders.length}
          onClick={() => {
            try {
              saveProductivityText(
                exportBookmarks(data),
                'bookmarks.html',
                'text/html',
              );
              setError(null);
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          {t('productivity.exportBookmarks')}
        </Button>
      </div>
      {folderDraft && (
        <section className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <OrganizerInput
              label={t('productivity.name')}
              value={folderDraft.name}
              maxLength={200}
              onChange={(e) =>
                setFolderDraft({ ...folderDraft, name: e.target.value })
              }
            />
            <ChoiceField
              label={t('productivity.folder')}
              value={folderDraft.parent || '__root'}
              options={folderOptions.filter((f) => f.value !== folderDraft.id)}
              onChange={(v) =>
                setFolderDraft({
                  ...folderDraft,
                  parent: v === '__root' ? '' : v,
                })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (
                  save({
                    ...data,
                    folders: data.folders.some((f) => f.id === folderDraft.id)
                      ? data.folders.map((f) =>
                          f.id === folderDraft.id ? folderDraft : f,
                        )
                      : [...data.folders, folderDraft],
                  })
                )
                  setFolderDraft(null);
              }}
            >
              {t('productivity.save')}
            </Button>
            <Button variant="outline" onClick={() => setFolderDraft(null)}>
              {t('productivity.cancel')}
            </Button>
          </div>
        </section>
      )}
      {draft && (
        <section className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <OrganizerInput
              label={t('productivity.title')}
              value={draft.title}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <OrganizerInput
              label={t('productivity.url')}
              value={draft.url}
              maxLength={10000}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
            <ChoiceField
              label={t('productivity.folder')}
              value={draft.folder || '__root'}
              options={folderOptions}
              onChange={(v) =>
                setDraft({ ...draft, folder: v === '__root' ? '' : v })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (
                  save({
                    ...data,
                    bookmarks: data.bookmarks.some((b) => b.id === draft.id)
                      ? data.bookmarks.map((b) =>
                          b.id === draft.id ? draft : b,
                        )
                      : [...data.bookmarks, draft],
                  })
                )
                  setDraft(null);
              }}
            >
              {t('productivity.save')}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('productivity.cancel')}
            </Button>
          </div>
        </section>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <OrganizerInput
          label={t('productivity.search')}
          value={query.q ?? ''}
          maxLength={200}
          onChange={(e) => setQuery({ q: e.target.value, page: 0 })}
        />
        <ChoiceField
          label={t('productivity.folder')}
          value={folder === null ? '__all' : folder || '__root'}
          options={[
            { value: '__all', label: t('productivity.all') },
            ...folderOptions,
          ]}
          onChange={(folder) => setQuery({ folder, page: 0 })}
        />
        <ChoiceField
          label={t('productivity.duplicates')}
          value={query.duplicates === 'yes' ? 'yes' : 'no'}
          options={[
            { value: 'no', label: t('productivity.all') },
            { value: 'yes', label: t('productivity.duplicates') },
          ]}
          onChange={(duplicates) => setQuery({ duplicates, page: 0 })}
        />
      </div>
      {folder && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setFolderDraft({ ...data.folders.find((f) => f.id === folder)! })
            }
          >
            {t('productivity.renameFolder')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const parent = data.folders.find((f) => f.id === folder)!.parent;
              if (
                save({
                  folders: data.folders
                    .filter((f) => f.id !== folder)
                    .map((f) => (f.parent === folder ? { ...f, parent } : f)),
                  bookmarks: data.bookmarks.map((b) =>
                    b.folder === folder ? { ...b, folder: parent } : b,
                  ),
                })
              )
                setQuery({ folder: parent || '__root' });
              setFolderDraft(null);
            }}
          >
            {t('productivity.remove')} {t('productivity.folder')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('productivity.folderHint')}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <span>{t('productivity.selected', { count: picked.length })}</span>
        <ChoiceField
          label={t('productivity.moveTo')}
          value={target || '__root'}
          options={folderOptions}
          onChange={(move) => setQuery({ move })}
        />
        <Button
          disabled={!picked.length}
          onClick={() =>
            save({
              ...data,
              bookmarks: data.bookmarks.map((b) =>
                picked.includes(b.id) ? { ...b, folder: target } : b,
              ),
            })
          }
        >
          {t('productivity.apply')}
        </Button>
        <Button
          variant="outline"
          disabled={!picked.length}
          onClick={() => {
            if (
              save({
                ...data,
                bookmarks: data.bookmarks.filter((b) => !picked.includes(b.id)),
              })
            )
              setSelected([]);
          }}
        >
          {t('productivity.remove')}
        </Button>
      </div>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={
            shown.length > 0 && shown.every((b) => selected.includes(b.id))
          }
          onCheckedChange={(v) =>
            setSelected(
              v === true
                ? [...new Set([...selected, ...shown.map((b) => b.id)])]
                : selected.filter((id) => !shown.some((b) => b.id === id)),
            )
          }
        />
        {t('productivity.all')} ({shown.length})
      </label>
      <div className="space-y-3">
        {shown.map((bookmark) => (
          <article
            key={bookmark.id}
            className="flex items-start gap-3 rounded-lg border p-4"
          >
            <Checkbox
              aria-label={`${t('productivity.select')} ${bookmark.title}`}
              checked={selected.includes(bookmark.id)}
              onCheckedChange={(v) =>
                setSelected(
                  v === true
                    ? [...selected, bookmark.id]
                    : selected.filter((id) => id !== bookmark.id),
                )
              }
            />
            <div className="min-w-0 flex-1">
              <a
                className="break-all font-medium text-primary underline"
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bookmark.title || bookmark.url}
              </a>
              <p className="break-all text-sm text-muted-foreground">
                {bookmark.url}
              </p>
              <p className="text-xs text-muted-foreground">
                {path(bookmark.folder) || t('productivity.root')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft({ ...bookmark })}
            >
              {t('productivity.edit')}
            </Button>
          </article>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setQuery({ page: page - 1 })}
        >
          ←
        </Button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(filtered.length / 50))} (
          {filtered.length})
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 50 >= filtered.length}
          onClick={() => setQuery({ page: page + 1 })}
        >
          →
        </Button>
      </div>
      <ProductivityError error={error} />
    </OrganizerFrame>
  );
}
