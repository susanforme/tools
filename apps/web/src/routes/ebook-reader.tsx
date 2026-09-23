import { DocumentSection } from '@/components/document-workspace-ui';
import { EpubMaker } from '@/components/epub-authoring';
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
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import { readBook, type ReaderBook } from '@/lib/ebook-reader';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/ebook-reader')({
  component: () => (
    <DocumentSection
      original="ebookReader.title"
      name="epubTitle"
      base={<EbookReaderPage />}
      extra={<EpubMaker />}
    />
  ),
});
type Position = { chapter: number; block: number };
type Bookmark = Position & { label: string };
type Saved = { position: Position; bookmarks: Bookmark[] };
const FONT_CLASSES: Record<number, string> = {
  16: 'text-base',
  20: 'text-xl',
  24: 'text-2xl',
  28: 'text-[28px]',
};
const LINE_CLASSES: Record<number, string> = {
  1.5: 'leading-normal',
  1.8: 'leading-[1.8]',
  2.2: 'leading-[2.2]',
};
function EbookReaderPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ font: number; line: number }>({
    font: NumberParam,
    line: NumberParam,
  });
  const font = query.font != null && FONT_CLASSES[query.font] ? query.font : 20;
  const line =
    query.line != null && LINE_CLASSES[query.line] ? query.line : 1.8;
  const [book, setBook] = useState<ReaderBook | null>(null);
  const [position, setPosition] = useState<Position>({ chapter: 0, block: 0 });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<Position | null>(null);
  const request = useRef(0);
  const bookRef = useRef<ReaderBook | null>(null);
  const savedRef = useRef<Saved>({
    position: { chapter: 0, block: 0 },
    bookmarks: [],
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const flush = () => {
      const id = bookRef.current?.id;
      if (id) {
        try {
          localStorage.setItem(
            `tools-book-${id}`,
            JSON.stringify(savedRef.current),
          );
        } catch {
          /* 正常保存失败已在页面提示；卸载时不再更新状态。 */
        }
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      request.current++;
      bookRef.current?.urls.forEach(URL.revokeObjectURL);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function persist(next: Saved) {
    savedRef.current = next;
    if (timer.current) clearTimeout(timer.current);
    const id = bookRef.current?.id;
    if (id) {
      try {
        localStorage.setItem(`tools-book-${id}`, JSON.stringify(next));
      } catch {
        setError(t('ebookReader.storageError'));
      }
    }
  }
  async function open(file: File | null) {
    if (!file) return;
    const generation = ++request.current;
    setBusy(true);
    setError(null);
    try {
      const next = await readBook(file);
      if (generation !== request.current) {
        next.urls.forEach(URL.revokeObjectURL);
        return;
      }
      persist(savedRef.current);
      bookRef.current?.urls.forEach(URL.revokeObjectURL);
      bookRef.current = next;
      const validPosition = (value: unknown): value is Position =>
        typeof value === 'object' &&
        value !== null &&
        'chapter' in value &&
        typeof value.chapter === 'number' &&
        Number.isInteger(value.chapter) &&
        value.chapter >= 0 &&
        value.chapter < next.chapters.length &&
        'block' in value &&
        typeof value.block === 'number' &&
        Number.isInteger(value.block) &&
        value.block >= 0 &&
        value.block < next.chapters[value.chapter]!.blocks.length;
      let restored: Saved = {
        position: { chapter: 0, block: 0 },
        bookmarks: [],
      };
      try {
        const raw: unknown = JSON.parse(
          localStorage.getItem(`tools-book-${next.id}`) ?? 'null',
        );
        if (typeof raw === 'object' && raw !== null) {
          if ('position' in raw && validPosition(raw.position))
            restored.position = raw.position;
          if ('bookmarks' in raw && Array.isArray(raw.bookmarks))
            restored.bookmarks = raw.bookmarks
              .filter(
                (v: unknown): v is Bookmark =>
                  validPosition(v) &&
                  'label' in v &&
                  typeof v.label === 'string',
              )
              .slice(0, 100);
        }
      } catch {
        setError(t('ebookReader.storageError'));
      }
      savedRef.current = restored;
      pendingScroll.current = restored.position;
      setPosition(restored.position);
      setBookmarks(restored.bookmarks);
      setBook(next);
      setSearch('');
    } catch (cause) {
      if (generation === request.current) {
        const key = (cause as Error).message;
        setError(
          t('ebookReader.openError', {
            message: t(`ebookReader.errors.${key}`, {
              defaultValue: t('ebookReader.errors.invalidBook'),
            }),
          }),
        );
      }
    } finally {
      if (generation === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    const dest = pendingScroll.current;
    if (!dest || !viewport.current) return;
    const block = viewport.current.querySelector<HTMLElement>(
      `[data-block="${dest.block}"]`,
    );
    if (block) viewport.current.scrollTop = Math.max(0, block.offsetTop - 20);
    pendingScroll.current = null;
  }, [book, position]);
  function jump(next: Position) {
    pendingScroll.current = next;
    setPosition(next);
    persist({ ...savedRef.current, position: next });
  }
  const results =
    search.trim() && book
      ? book.chapters
          .flatMap((chapter, ci) =>
            chapter.blocks.flatMap((block, bi) =>
              block.text
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase())
                ? [{ chapter: ci, block: bi, label: block.text }]
                : [],
            ),
          )
          .slice(0, 100)
      : [];
  return (
    <div
      className="mx-auto max-w-6xl space-y-4 px-4 py-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void open(e.dataTransfer.files[0] ?? null);
      }}
    >
      <h1 className="text-2xl font-bold">{t('ebookReader.title')}</h1>
      <div className="space-y-2 rounded-lg border border-dashed p-4">
        <Label htmlFor="ebook-file">{t('ebookReader.file')}</Label>
        <Input
          id="ebook-file"
          type="file"
          accept=".txt,.epub"
          disabled={busy}
          onChange={(e) => {
            void open(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <p className="text-sm text-muted-foreground">
          {t('ebookReader.limit')}
        </p>
      </div>
      {busy && <p role="status">{t('ebookReader.loading')}</p>}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {book && (
        <>
          <h2 className="text-lg font-semibold">{book.title}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Label>
              {t('ebookReader.font')}
              <Select
                value={String(font)}
                onValueChange={(v) => setQuery({ font: Number(v) })}
              >
                <SelectTrigger
                  className="w-24"
                  aria-label={t('ebookReader.font')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(FONT_CLASSES).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              {t('ebookReader.line')}
              <Select
                value={String(line)}
                onValueChange={(v) => setQuery({ line: Number(v) })}
              >
                <SelectTrigger
                  className="w-24"
                  aria-label={t('ebookReader.line')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(LINE_CLASSES).map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Button
              variant="outline"
              disabled={bookmarks.length >= 100}
              onClick={() => {
                const p = savedRef.current.position;
                if (
                  bookmarks.some(
                    (b) => b.chapter === p.chapter && b.block === p.block,
                  )
                )
                  return;
                const next = [
                  ...bookmarks,
                  {
                    ...p,
                    label: `${book.chapters[p.chapter]!.title} · ${p.block + 1}`,
                  },
                ];
                setBookmarks(next);
                persist({ ...savedRef.current, bookmarks: next });
              }}
            >
              {t('ebookReader.addBookmark')}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <aside className="space-y-4">
              <Label>
                {t('ebookReader.contents')}
                <Select
                  value={String(position.chapter)}
                  onValueChange={(v) => jump({ chapter: Number(v), block: 0 })}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={t('ebookReader.contents')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {book.chapters.map((chapter, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {chapter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
              <div className="space-y-2">
                <Label htmlFor="ebook-search">{t('ebookReader.search')}</Label>
                <Input
                  id="ebook-search"
                  value={search}
                  maxLength={200}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {t('ebookReader.results', { count: results.length })}
                  </p>
                )}
                <ul className="max-h-64 space-y-1 overflow-auto">
                  {results.map((r) => (
                    <li key={`${r.chapter}-${r.block}`}>
                      <Button
                        className="h-auto w-full justify-start whitespace-normal text-left"
                        variant="ghost"
                        onClick={() => jump(r)}
                      >
                        {r.label.slice(
                          Math.max(
                            0,
                            r.label
                              .toLowerCase()
                              .indexOf(search.toLowerCase()) - 20,
                          ),
                          Math.max(
                            0,
                            r.label
                              .toLowerCase()
                              .indexOf(search.toLowerCase()) - 20,
                          ) + 90,
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium">{t('ebookReader.bookmarks')}</h3>
                <ul className="max-h-64 overflow-auto">
                  {bookmarks.map((b, i) => (
                    <li
                      className="flex items-center"
                      key={`${b.chapter}-${b.block}`}
                    >
                      <Button
                        className="min-w-0 flex-1 justify-start truncate"
                        variant="ghost"
                        onClick={() => jump(b)}
                      >
                        {b.label}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('ebookReader.removeBookmark')}
                        onClick={() => {
                          const next = bookmarks.filter(
                            (_, index) => index !== i,
                          );
                          setBookmarks(next);
                          persist({ ...savedRef.current, bookmarks: next });
                        }}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
            <div className="space-y-3">
              <div
                ref={viewport}
                tabIndex={0}
                aria-label={t('ebookReader.content')}
                className={`relative h-[65vh] overflow-auto rounded-lg border p-5 ${FONT_CLASSES[font]} ${LINE_CLASSES[line]}`}
                onScroll={() => {
                  const root = viewport.current;
                  if (!root || pendingScroll.current) return;
                  const top = root.getBoundingClientRect().top;
                  const nodes =
                    root.querySelectorAll<HTMLElement>('[data-block]');
                  let block = 0;
                  for (const node of nodes) {
                    if (node.getBoundingClientRect().bottom > top + 24) {
                      block = Number(node.dataset.block);
                      break;
                    }
                  }
                  savedRef.current = {
                    ...savedRef.current,
                    position: { chapter: position.chapter, block },
                  };
                  if (timer.current) clearTimeout(timer.current);
                  timer.current = setTimeout(
                    () => persist(savedRef.current),
                    200,
                  );
                }}
              >
                {book.chapters[position.chapter]!.blocks.map((block, i) => (
                  <div
                    key={`${position.chapter}-${i}`}
                    data-block={i}
                    className="mb-4 scroll-mt-5"
                  >
                    {block.image ? (
                      <img
                        src={block.image}
                        alt={block.text}
                        className="mx-auto max-h-[60vh] max-w-full object-contain"
                      />
                    ) : (
                      <p
                        className={`whitespace-pre-wrap break-words ${search.trim() && block.text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) ? 'bg-primary/10' : ''}`}
                      >
                        {block.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={position.chapter === 0}
                  onClick={() =>
                    jump({ chapter: position.chapter - 1, block: 0 })
                  }
                >
                  {t('ebookReader.previous')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {position.chapter + 1} / {book.chapters.length}
                </span>
                <Button
                  variant="outline"
                  disabled={position.chapter + 1 === book.chapters.length}
                  onClick={() =>
                    jump({ chapter: position.chapter + 1, block: 0 })
                  }
                >
                  {t('ebookReader.next')}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
