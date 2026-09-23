import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  parseOutline,
  visibleOutline,
  escapeHtml,
  slideDocument,
} from '@/lib/practical-outline';
import { downloadBlob } from '@/lib/download';
import {
  PracticalFrame,
  PracticalText,
  ExportText,
  useLatestJob,
} from './practical-ui';
import { ChoiceField } from './calculator-ui';
import { Button } from './ui/button';
export function MindMap() {
  const { t } = useTranslation();
  const [source, setSource] = useState(
      '# 项目计划\n- 设计\n  - 原型\n  - 评审\n- 开发\n  - 实现\n  - 测试\n- 发布',
    ),
    [collapsed, setCollapsed] = useState<number[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  let error: string | null = null,
    nodes: ReturnType<typeof parseOutline> = [];
  try {
    nodes = parseOutline(source);
  } catch (cause) {
    error = t(`studio20.${(cause as Error).message}`);
  }
  const visible = visibleOutline(nodes, collapsed),
    width = Math.max(600, ...visible.map((n) => n.x + 230)),
    height = Math.max(200, visible.length * 56 + 40);
  const html = () => {
    const tree = (parent: number | null): string =>
      nodes
        .filter((n) => n.parent === parent)
        .map(
          (n) =>
            `<li>${nodes.some((child) => child.parent === n.id) ? `<details open><summary>${escapeHtml(n.label)}</summary><ul>${tree(n.id)}</ul></details>` : escapeHtml(n.label)}</li>`,
        )
        .join('');
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>Mind map</title><style>body{font:18px/1.8 system-ui;padding:2rem}li{margin:.5rem}summary{cursor:pointer}</style><ul>${tree(null)}</ul>`;
  };
  return (
    <PracticalFrame id="mind-map" error={error}>
      <PracticalText
        label={t('studio20.outlineHint')}
        value={source}
        multiline
        onChange={(value) => {
          setSource(value);
          setCollapsed([]);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setCollapsed([])}>
          {t('studio20.expandAll')}
        </Button>
        <Button
          disabled={!!error}
          onClick={() => {
            if (svg.current)
              downloadBlob(
                new Blob([new XMLSerializer().serializeToString(svg.current)], {
                  type: 'image/svg+xml',
                }),
                'mind-map.svg',
              );
          }}
        >
          {t('studio20.svg')}
        </Button>
        <Button
          disabled={!!error}
          variant="outline"
          onClick={() =>
            downloadBlob(
              new Blob([html()], { type: 'text/html' }),
              'mind-map.html',
            )
          }
        >
          {t('studio20.html')}
        </Button>
      </div>
      <div className="overflow-auto rounded-xl border">
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          role="img"
          aria-label={t('studio20.preview')}
        >
          <rect width="100%" height="100%" fill="#f8fafc" />
          {visible.map((n) => {
            const parent = visible.find((p) => p.id === n.parent);
            return (
              parent && (
                <path
                  key={n.id}
                  d={`M${parent.x + 210} ${parent.y + 20} C${parent.x + 225} ${parent.y + 20},${n.x - 15} ${n.y + 20},${n.x} ${n.y + 20}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                />
              )
            );
          })}
          {visible.map((n) => (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${n.label} ${t('studio20.collapse')}`}
              onClick={() =>
                setCollapsed((old) =>
                  old.includes(n.id)
                    ? old.filter((id) => id !== n.id)
                    : [...old, n.id],
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setCollapsed((old) =>
                    old.includes(n.id)
                      ? old.filter((id) => id !== n.id)
                      : [...old, n.id],
                  );
                }
              }}
            >
              <rect
                x={n.x}
                y={n.y}
                width="210"
                height="40"
                rx="8"
                fill={collapsed.includes(n.id) ? '#ddd6fe' : '#fff'}
                stroke="#8b5cf6"
              />
              <text x={n.x + 10} y={n.y + 25} fill="#111827" fontSize="14">
                {n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label}
              </text>
              <title>{n.label}</title>
            </g>
          ))}
        </svg>
      </div>
    </PracticalFrame>
  );
}
export function MarkdownSlides() {
  const { t } = useTranslation();
  const [source, setSource] = useState(
    '# 演示文稿\n\n开始介绍你的想法\n\n???\n演讲备注\n\n---\n\n## 下一步\n\n- 计划\n- 行动',
  );
  const [query, setQuery] = useQueryParams<{ theme: string; page: number }>({
    theme: StringParam,
    page: NumberParam,
  });
  const theme = query.theme ?? 'light',
    parts = source.split(/^\s*---\s*$/m),
    page = Math.max(0, Math.min(parts.length - 1, Math.trunc(query.page ?? 0)));
  const parsed = parts.map((part) => part.split(/^\s*\?\?\?\s*$/m));
  const job = useLatestJob<string[]>(source);
  const iframe = useRef<HTMLIFrameElement>(null),
    id = useId();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        void job.run(async () => {
          if (parsed.length > 100) throw new Error('slideLimit');
          const { renderMarkdown } = await import('@/lib/markdown');
          return parsed.map(([body]) => renderMarkdown(body));
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [source]);
  return (
    <PracticalFrame id="markdown-slides" error={error || job.error}>
      <div className="grid gap-4 md:grid-cols-2">
        <PracticalText
          label={t('studio20.slideHint')}
          value={source}
          onChange={(value) => {
            setSource(value);
            setQuery({ page: 0 });
          }}
          multiline
        />
        <div className="space-y-3">
          <ChoiceField
            label={t('studio20.theme')}
            value={theme}
            options={['light', 'dark', 'blue'].map((value) => ({
              value,
              label: t(`studio20.${value}`),
            }))}
            onChange={(theme) => setQuery({ theme })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setQuery({ page: page - 1 })}
            >
              {t('studio20.previous')}
            </Button>
            <span>
              {page + 1}/{parts.length}
            </span>
            <Button
              variant="outline"
              disabled={page === parts.length - 1}
              onClick={() => setQuery({ page: page + 1 })}
            >
              {t('studio20.next')}
            </Button>
            <Button
              disabled={!job.result}
              onClick={() =>
                void iframe.current
                  ?.requestFullscreen()
                  .catch((cause) => setError((cause as Error).message))
              }
            >
              {t('studio20.fullscreen')}
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {t('studio20.notes')}: {parsed[page]?.slice(1).join('\n')}
          </p>
        </div>
      </div>
      {job.result && (
        <>
          <iframe
            key={`${id}:${page}:${theme}`}
            ref={iframe}
            title={t('studio20.preview')}
            sandbox="allow-scripts"
            srcDoc={
              slideDocument(job.result, theme) +
              `<script>location.hash='slide-${page}';i=${page};<\/script>`
            }
            className="aspect-video w-full rounded-xl border"
          />
          <ExportText
            value={slideDocument(job.result, theme)}
            name="slides.html"
            type="text/html"
          />
          <Button
            variant="outline"
            onClick={() => {
              const popup = window.open('', '_blank');
              if (!popup) {
                setError(t('studio20.popupBlocked'));
                return;
              }
              popup.opener = null;
              popup.document.write(slideDocument(job.result!, theme));
              popup.document.close();
              popup.focus();
              popup.print();
            }}
          >
            {t('studio20.print')}
          </Button>
        </>
      )}
    </PracticalFrame>
  );
}
