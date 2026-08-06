import {
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import {
  formatCodePoint,
  formatFileSize,
  FONT_PAGE_SIZE,
  getPageCount,
  isSupportedFontFile,
  MAX_FONT_FILE_SIZE,
  type FontMetadata,
  type FontWorkerResponse,
  type GlyphPreview,
} from '@/lib/font-inspector';
import { db } from '@/lib/db';
import { createFileRoute } from '@tanstack/react-router';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/font')({ component: FontPage });

const PREVIEW_FONT_FAMILY = 'ToolsFontInspector';
const DEFAULT_PREVIEW_TEXT = '字体预览 Font Preview 0123456789';

type FontQuery = { page: number; q: string };

const FONT_QUERY_PARAMS = {
  page: withDefault<number>(NumberParam, 1),
  q: withDefault<string>(StringParam, ''),
};

function FontPage() {
  const { t } = useTranslation();
  const workerRef = useRef<Worker | null>(null);
  const fontFaceRef = useRef<FontFace | null>(null);
  const loadIdRef = useRef(0);
  const pageRef = useRef(1);
  const searchRef = useRef('');
  const pendingCacheRef = useRef<File | null>(null);
  const [query, setQuery] = useQueryParams<FontQuery>(FONT_QUERY_PARAMS);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<FontMetadata | null>(null);
  const [glyphs, setGlyphs] = useState<GlyphPreview[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/font-inspector.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    worker.addEventListener(
      'message',
      (event: MessageEvent<FontWorkerResponse>) => {
        const response = event.data;
        if (response.loadId !== loadIdRef.current) return;
        if (response.type === 'error') {
          pendingCacheRef.current = null;
          setLoading(false);
          setPageLoading(false);
          setError(t('fontTool.loadError', { msg: response.error }));
          return;
        }
        if (response.type === 'loaded') {
          const nextCachedFile = pendingCacheRef.current;
          pendingCacheRef.current = null;
          if (nextCachedFile) {
            void db.fontCache
              .put({
                id: 'latest',
                name: nextCachedFile.name,
                type: nextCachedFile.type,
                lastModified: nextCachedFile.lastModified,
                data: nextCachedFile,
              })
              .catch((cause) =>
                setError(t('fontTool.cacheError', { msg: String(cause) })),
              );
          }
          setMetadata(response.metadata);
          setLoading(false);
          return;
        }
        if (response.type === 'search') {
          if (
            response.query.trim() !== searchRef.current ||
            response.page !== pageRef.current
          )
            return;
          setSearchTotal(response.total);
          setGlyphs(response.glyphs);
          setPageLoading(false);
          return;
        }
        if (response.page !== pageRef.current) return;
        setGlyphs(response.glyphs);
        setPageLoading(false);
      },
    );
    worker.addEventListener('error', (event) => {
      pendingCacheRef.current = null;
      setLoading(false);
      setPageLoading(false);
      setError(
        t('fontTool.loadError', {
          msg: event.message || 'Font Worker failed',
        }),
      );
    });

    let disposed = false;
    void db.fontCache
      .get('latest')
      .then((cached) => {
        if (disposed || !cached || loadIdRef.current !== 0) return;
        void loadFile(
          new File([cached.data], cached.name, {
            type: cached.type,
            lastModified: cached.lastModified,
          }),
          false,
        );
      })
      .catch((cause) => {
        if (!disposed) {
          setError(t('fontTool.cacheError', { msg: String(cause) }));
        }
      });

    return () => {
      disposed = true;
      workerRef.current = null;
      worker.terminate();
      if (fontFaceRef.current) document.fonts.delete(fontFaceRef.current);
    };
  }, []);

  const searchQuery = (query.q ?? '').trim();
  searchRef.current = searchQuery;

  useEffect(() => {
    const worker = workerRef.current;
    if (!metadata || !worker) return;
    setPageLoading(true);
    pageRef.current = 1;
    setQuery({ page: 1 });
    if (searchQuery) {
      worker.postMessage({
        type: 'search',
        loadId: loadIdRef.current,
        query: searchQuery,
        page: 1,
      });
      return;
    }
    worker.postMessage({
      type: 'page',
      loadId: loadIdRef.current,
      page: 1,
    });
  }, [metadata, searchQuery]);

  const loadFile = async (nextFile: File, cache = true) => {
    if (!isSupportedFontFile(nextFile.name)) {
      setError(t('fontTool.unsupportedFormat'));
      return;
    }
    if (nextFile.size > MAX_FONT_FILE_SIZE) {
      setError(t('fontTool.fileTooLarge'));
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setPageLoading(false);
    setError(null);
    setMetadata(null);
    setGlyphs([]);
    setFile(nextFile);
    pendingCacheRef.current = cache ? nextFile : null;

    try {
      const buffer = await nextFile.arrayBuffer();
      const workerBuffer = buffer.slice(0);
      const nextFace = new FontFace(PREVIEW_FONT_FAMILY, buffer);
      await nextFace.load();
      if (loadId !== loadIdRef.current) return;
      if (fontFaceRef.current) document.fonts.delete(fontFaceRef.current);
      document.fonts.add(nextFace);
      fontFaceRef.current = nextFace;
      worker.postMessage({ type: 'load', loadId, buffer: workerBuffer }, [
        workerBuffer,
      ]);
    } catch (cause) {
      if (loadId !== loadIdRef.current) return;
      pendingCacheRef.current = null;
      setLoading(false);
      setError(t('fontTool.loadError', { msg: (cause as Error).message }));
    }
  };

  const pageCount = getPageCount(
    searchQuery ? searchTotal : (metadata?.numGlyphs ?? 0),
  );
  const page = Math.min(pageCount, Math.max(1, Math.trunc(query.page ?? 1)));

  const goToPage = (nextPage: number) => {
    if (!metadata || !workerRef.current) return;
    const target = Math.min(pageCount, Math.max(1, Math.trunc(nextPage)));
    setQuery({ page: target });
    pageRef.current = target;
    setPageLoading(true);
    workerRef.current.postMessage(
      searchQuery
        ? {
            type: 'search',
            loadId: loadIdRef.current,
            query: searchQuery,
            page: target,
          }
        : {
            type: 'page',
            loadId: loadIdRef.current,
            page: target,
          },
    );
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) void loadFile(droppedFile);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('fontTool.title')}</h1>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 transition-colors ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {loading ? (
          <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="size-8 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">
          {loading ? t('fontTool.parsing') : t('fontTool.upload')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('fontTool.formats')}
        </span>
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
          className="hidden"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) void loadFile(selectedFile);
            event.target.value = '';
          }}
        />
      </label>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && metadata && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetadataCard label={t('fontTool.file')} value={file.name} />
            <MetadataCard
              label={t('fontTool.fontName')}
              value={metadata.fullName || metadata.familyName}
            />
            <MetadataCard
              label={t('fontTool.glyphCount')}
              value={metadata.numGlyphs.toLocaleString()}
            />
            <MetadataCard
              label={t('fontTool.characters')}
              value={metadata.characterCount.toLocaleString()}
            />
          </section>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{metadata.type}</Badge>
            <span>{metadata.subfamilyName}</span>
            <span>·</span>
            <span>{formatFileSize(file.size)}</span>
            <span>·</span>
            <span>{metadata.unitsPerEm} units/em</span>
          </div>

          <section className="space-y-3 rounded-lg border bg-card p-4">
            <div>
              <h2 className="font-semibold">{t('fontTool.previewTitle')}</h2>
              <p className="text-xs text-muted-foreground">
                {t('fontTool.previewHint')}
              </p>
            </div>
            <Textarea
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              placeholder={t('fontTool.previewPlaceholder')}
              className="min-h-20"
            />
            <div className="min-h-32 overflow-auto rounded-md border bg-background p-5 text-5xl leading-tight font-['ToolsFontInspector']">
              {previewText || t('fontTool.emptyPreview')}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t('fontTool.allGlyphs')}</h2>
                <p className="text-xs text-muted-foreground">
                  {searchQuery
                    ? t('fontTool.searchResults', { count: searchTotal })
                    : t('fontTool.glyphRange', {
                        start: (page - 1) * FONT_PAGE_SIZE + 1,
                        end: Math.min(
                          page * FONT_PAGE_SIZE,
                          metadata.numGlyphs,
                        ),
                        total: metadata.numGlyphs,
                      })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query.q ?? ''}
                    onChange={(event) =>
                      setQuery({ q: event.target.value, page: 1 })
                    }
                    placeholder={t('fontTool.searchPlaceholder')}
                    className="w-64 pl-8"
                  />
                </div>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  disabled={pageLoading}
                  onChange={goToPage}
                />
              </div>
            </div>

            {pageLoading && glyphs.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center rounded-lg border">
                <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchQuery && glyphs.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                {t('fontTool.noSearchResults')}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
                {glyphs.map((glyph) => (
                  <GlyphCard key={glyph.id} glyph={glyph} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function MetadataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium" title={value}>
        {value || '—'}
      </p>
    </div>
  );
}

function GlyphCard({ glyph }: { glyph: GlyphPreview }) {
  const { t } = useTranslation();
  const codePoint = glyph.codePoints[0];
  const character =
    codePoint === undefined ? null : String.fromCodePoint(codePoint);
  const codePointLabel =
    glyph.codePoints.length === 0
      ? t('fontTool.unencoded')
      : glyph.codePoints.slice(0, 2).map(formatCodePoint).join(', ');

  return (
    <div className="min-w-0 rounded-lg border bg-card p-2 text-center">
      <div className="flex h-20 items-center justify-center overflow-hidden text-5xl font-['ToolsFontInspector']">
        {character && glyph.path ? (
          character
        ) : glyph.path ? (
          <svg
            viewBox={glyph.viewBox}
            className="size-16 fill-current"
            aria-hidden="true"
          >
            <path d={glyph.path} transform="scale(1 -1)" />
          </svg>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
      <p className="truncate text-xs font-medium" title={glyph.name}>
        {glyph.name}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
        gid {glyph.id} · {codePointLabel}
      </p>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  disabled,
  onChange,
}: {
  page: number;
  pageCount: number;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        disabled={disabled || page === 1}
        onClick={() => onChange(1)}
        aria-label={t('fontTool.firstPage')}
      >
        <ChevronsLeft />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        disabled={disabled || page === 1}
        onClick={() => onChange(page - 1)}
        aria-label={t('fontTool.previousPage')}
      >
        <ChevronLeft />
      </Button>
      <Input
        key={page}
        type="number"
        min={1}
        max={pageCount}
        defaultValue={page}
        className="h-8 w-20 text-center"
        aria-label={t('fontTool.page')}
        onBlur={(event) => onChange(Number(event.currentTarget.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onChange(Number(event.currentTarget.value));
          }
        }}
      />
      <span className="whitespace-nowrap px-1 text-sm text-muted-foreground">
        / {pageCount}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        disabled={disabled || page === pageCount}
        onClick={() => onChange(page + 1)}
        aria-label={t('fontTool.nextPage')}
      >
        <ChevronRight />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        disabled={disabled || page === pageCount}
        onClick={() => onChange(pageCount)}
        aria-label={t('fontTool.lastPage')}
      >
        <ChevronsRight />
      </Button>
    </div>
  );
}
