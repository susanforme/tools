import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import {
  CreativePage,
  CreativeProjectActions,
  CreativeTextField,
} from '@/components/creative-tool-controls';
import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  canvasPng,
  decodeCreativeImage,
  isHex,
  readCreativeImage,
  type CreativeImage,
} from '@/lib/creative-tools';
import { downloadBlob } from '@/lib/download';
import { boundedNumber } from '@/lib/focus-tools';
import {
  drawScreenshot,
  validateScreenshotProject,
  type Annotation,
  type ScreenshotProject,
} from '@/lib/screenshot-annotator';

export const Route = createFileRoute('/screenshot-annotator')({
  component: ScreenshotAnnotatorPage,
});
function ScreenshotAnnotatorPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    tool: string;
    padding: number;
    radius: number;
    background: string;
    color: string;
    size: number;
  }>({
    tool: StringParam,
    padding: NumberParam,
    radius: NumberParam,
    background: StringParam,
    color: StringParam,
    size: NumberParam,
  });
  const tool: Annotation['kind'] = ['number', 'text', 'block'].includes(
    query.tool ?? '',
  )
    ? (query.tool as Annotation['kind'])
    : 'arrow';
  const padding = Math.round(boundedNumber(query.padding, 40, 0, 200)),
    radius = boundedNumber(query.radius, 16, 0, 160),
    size = boundedNumber(query.size, 36, 4, 160);
  const background = isHex(query.background) ? query.background : '#e2e8f0',
    color = isHex(query.color) ? query.color : '#ef4444';
  const [source, setSource] = useState<CreativeImage | null>(null);
  const [marks, setMarks] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null);
  const generation = useRef(0),
    alive = useRef(true),
    loading = useRef(false);
  const project: ScreenshotProject = {
    version: 1,
    image: source,
    marks,
    padding,
    radius,
    background,
  };
  const projectRef = useRef(project);
  projectRef.current = project;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (canvas.current && image.current) {
      try {
        drawScreenshot(canvas.current, image.current, {
          ...projectRef.current,
          marks: draft ? [...marks, draft] : marks,
        });
      } catch (cause) {
        setError(t((cause as Error).message));
      }
    }
  }, [source, marks, draft, padding, radius, background, t]);
  const commit = (next: Annotation[]) => {
    setHistory((previous) => [...previous.slice(-29), marks]);
    setMarks(next);
  };
  const load = async (file: File) => {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    setError(null);
    const ticket = ++generation.current;
    try {
      const next = await readCreativeImage(file);
      const decoded = await decodeCreativeImage(next);
      if (!alive.current || ticket !== generation.current) return;
      image.current = decoded;
      setSource(next);
      setMarks([]);
      setHistory([]);
    } catch (cause) {
      if (alive.current && ticket === generation.current)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.imageError'),
          }),
        );
    } finally {
      loading.current = false;
      if (alive.current && ticket === generation.current) setBusy(false);
    }
  };
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith('image/'))
        ?.getAsFile();
      if (file) {
        event.preventDefault();
        void loadRef.current(file);
      }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          source?.width ?? 0,
          ((event.clientX - rect.left) * event.currentTarget.width) /
            rect.width -
            padding,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          source?.height ?? 0,
          ((event.clientY - rect.top) * event.currentTarget.height) /
            rect.height -
            padding,
        ),
      ),
    };
  };
  const addAt = (x: number, y: number) => {
    if (!source || marks.length >= 500) return;
    const next: Annotation = {
      kind: tool,
      x,
      y,
      endX: Math.min(source.width, x + 100),
      endY: Math.min(source.height, y + 100),
      color,
      size,
      text:
        tool === 'number'
          ? String(marks.filter((mark) => mark.kind === 'number').length + 1)
          : text,
    };
    commit([...marks, next]);
  };
  return (
    <CreativePage title={t('screenshotAnnotator.title')}>
      <FileDropzone
        accept="image/*"
        disabled={busy}
        onFiles={(files) => {
          if (files[0]) void load(files[0].file);
        }}
        className="flex min-h-24 items-center justify-center rounded-xl p-4"
      >
        {t('screenshotAnnotator.upload')}
      </FileDropzone>
      <p className="text-xs text-muted-foreground">
        {t('creativeCommon.imageLimit')}
      </p>
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('screenshotAnnotator.tool')}
          value={tool}
          onChange={(value) => setQuery({ tool: value })}
          options={['arrow', 'number', 'text', 'block'].map((value) => ({
            value,
            label: t(`screenshotAnnotator.${value}`),
          }))}
        />
        <CreativeTextField
          label={t('creativeCommon.color')}
          type="color"
          value={color}
          onChange={(value) => setQuery({ color: value })}
        />
        <NumberField
          label={t('screenshotAnnotator.size')}
          value={size}
          min={4}
          onChange={(value) =>
            setQuery({ size: boundedNumber(value, 36, 4, 160) })
          }
        />
        {tool === 'text' && (
          <CreativeTextField
            label={t('screenshotAnnotator.text')}
            value={text}
            onChange={setText}
          />
        )}
        <NumberField
          label={t('screenshotAnnotator.padding')}
          value={padding}
          onChange={(value) =>
            setQuery({ padding: Math.round(boundedNumber(value, 40, 0, 200)) })
          }
        />
        <NumberField
          label={t('screenshotAnnotator.radius')}
          value={radius}
          onChange={(value) =>
            setQuery({ radius: boundedNumber(value, 16, 0, 160) })
          }
        />
        <CreativeTextField
          label={t('creativeCommon.background')}
          type="color"
          value={background}
          onChange={(value) => setQuery({ background: value })}
        />
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !source ||
            busy ||
            marks.length >= 500 ||
            (tool === 'text' && !text.trim())
          }
          variant="outline"
          onClick={() =>
            addAt((source?.width ?? 0) / 2, (source?.height ?? 0) / 2)
          }
        >
          {t('screenshotAnnotator.addCenter')}
        </Button>
        <Button
          disabled={!history.length || busy}
          variant="outline"
          onClick={() => {
            setMarks(history.at(-1)!);
            setHistory(history.slice(0, -1));
          }}
        >
          {t('creativeCommon.undo')}
        </Button>
        <Button
          disabled={!marks.length || busy}
          variant="outline"
          onClick={() => commit([])}
        >
          {t('screenshotAnnotator.clear')}
        </Button>
        <Button
          disabled={!source || busy}
          onClick={async () => {
            try {
              if (canvas.current) {
                const blob = await canvasPng(canvas.current);
                if (alive.current) downloadBlob(blob, 'annotated.png');
              }
            } catch {
              if (alive.current) setError(t('creativeCommon.saveError'));
            }
          }}
        >
          {t('creativeCommon.png')}
        </Button>
      </div>
      {source && (
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label={t('screenshotAnnotator.canvas')}
          className="max-h-[70vh] max-w-full touch-none rounded border object-contain"
          onPointerDown={(event) => {
            if (
              busy ||
              marks.length >= 500 ||
              (tool === 'text' && !text.trim())
            )
              return;
            const p = point(event);
            if (tool === 'text' || tool === 'number') {
              addAt(p.x, p.y);
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraft({
              kind: tool,
              ...p,
              endX: p.x,
              endY: p.y,
              color,
              size,
              text: '',
            });
          }}
          onPointerMove={(event) => {
            if (draft) {
              const p = point(event);
              setDraft({ ...draft, endX: p.x, endY: p.y });
            }
          }}
          onPointerUp={() => {
            if (draft) {
              commit([...marks, draft]);
              setDraft(null);
            }
          }}
          onPointerCancel={() => setDraft(null)}
        />
      )}
      {marks.length > 0 && (
        <details>
          <summary>
            {t('screenshotAnnotator.objects')} ({marks.length})
          </summary>
          <div className="max-h-72 space-y-3 overflow-auto py-3">
            {marks.map((mark, index) => (
              <div
                key={index}
                className="grid gap-2 rounded border p-3 md:grid-cols-5"
              >
                <span>
                  {index + 1}. {t(`screenshotAnnotator.${mark.kind}`)}
                </span>
                {(['x', 'y', 'endX', 'endY'] as const).map((key) => (
                  <NumberField
                    key={key}
                    label={t(`screenshotAnnotator.${key}`)}
                    value={mark[key]}
                    onChange={(value) =>
                      commit(
                        marks.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                [key]: boundedNumber(
                                  value,
                                  0,
                                  0,
                                  key.toLowerCase().includes('x')
                                    ? source!.width
                                    : source!.height,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                ))}
                <Button
                  variant="outline"
                  onClick={() => commit(marks.filter((_, i) => i !== index))}
                >
                  {t('creativeCommon.remove')}
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
      <CreativeProjectActions
        name="screenshot-project"
        value={project}
        disabled={busy}
        onImport={async (value) => {
          if (!validateScreenshotProject(value))
            throw new Error('creativeCommon.invalidProject');
          const ticket = ++generation.current;
          const decoded = value.image
            ? await decodeCreativeImage(value.image)
            : null;
          if (!alive.current || ticket !== generation.current) return;
          image.current = decoded;
          setSource(value.image);
          setMarks(value.marks);
          setHistory([]);
          setQuery({
            padding: value.padding,
            radius: value.radius,
            background: value.background,
          });
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </CreativePage>
  );
}
