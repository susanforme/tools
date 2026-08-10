import { parseOgMeta, type OgMeta } from '@/lib/og-meta';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/og-preview')({
  component: OgPreviewPage,
});

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Example Page</title>
  <meta property="og:title" content="Dev Tools — 分享预览示例" />
  <meta property="og:description" content="一站式开发者工具箱，快速处理 JSON、编码与更多日常任务。" />
  <meta property="og:image" content="https://picsum.photos/1200/630" />
  <meta property="og:url" content="https://example.com/tools" />
  <meta property="og:site_name" content="Dev Tools" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
</html>`;

const EMPTY_META: OgMeta = {
  title: '',
  description: '',
  image: '',
  url: '',
  siteName: '',
  type: 'website',
  twitterCard: 'summary',
  favicon: '',
};

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function OgPreviewPage() {
  const { t } = useTranslation();
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [manual, setManual] = useState<OgMeta>(EMPTY_META);
  const [useManual, setUseManual] = useState(false);

  const parsed = useMemo(() => {
    if (!html.trim()) return EMPTY_META;
    try {
      return parseOgMeta(html);
    } catch {
      return EMPTY_META;
    }
  }, [html]);

  const meta = useManual ? manual : parsed;

  const applyParsed = () => {
    setManual(parsed);
    setUseManual(true);
  };

  const hostname = (() => {
    try {
      return meta.url ? new URL(meta.url).hostname : meta.siteName || 'example.com';
    } catch {
      return meta.siteName || meta.url || 'example.com';
    }
  })();

  const fields: Array<{ key: keyof OgMeta; label: string }> = [
    { key: 'title', label: t('ogPreview.titleField') },
    { key: 'description', label: t('ogPreview.descriptionField') },
    { key: 'image', label: t('ogPreview.image') },
    { key: 'url', label: t('ogPreview.url') },
    { key: 'siteName', label: t('ogPreview.siteName') },
    { key: 'type', label: t('ogPreview.type') },
    { key: 'twitterCard', label: t('ogPreview.twitterCard') },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('ogPreview.title')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('ogPreview.html')}</Label>
            <Textarea
              value={html}
              onChange={(event) => {
                setHtml(event.target.value);
                setUseManual(false);
              }}
              rows={12}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setHtml(SAMPLE_HTML);
                setUseManual(false);
              }}
            >
              {t('ogPreview.sample')}
            </Button>
            <Button size="sm" variant="outline" onClick={applyParsed}>
              {t('ogPreview.editFields')}
            </Button>
          </div>
          {useManual && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t('ogPreview.titleField')}
                value={manual.title}
                onChange={(value) =>
                  setManual((prev) => ({ ...prev, title: value }))
                }
              />
              <Field
                label={t('ogPreview.siteName')}
                value={manual.siteName}
                onChange={(value) =>
                  setManual((prev) => ({ ...prev, siteName: value }))
                }
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('ogPreview.descriptionField')}</Label>
                <Textarea
                  value={manual.description}
                  onChange={(event) =>
                    setManual((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
              <Field
                label={t('ogPreview.image')}
                value={manual.image}
                onChange={(value) =>
                  setManual((prev) => ({ ...prev, image: value }))
                }
              />
              <Field
                label={t('ogPreview.url')}
                value={manual.url}
                onChange={(value) =>
                  setManual((prev) => ({ ...prev, url: value }))
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-5">
          {/* Facebook-like */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('ogPreview.facebook')}
            </p>
            <div className="overflow-hidden rounded-md border bg-background">
              {meta.image ? (
                <img
                  src={meta.image}
                  alt=""
                  className="aspect-[1.91/1] w-full object-cover bg-muted"
                />
              ) : (
                <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  {t('ogPreview.noImage')}
                </div>
              )}
              <div className="space-y-1 border-t px-3 py-2.5">
                <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                  {hostname}
                </p>
                <p className="line-clamp-2 text-[16px] font-semibold leading-snug">
                  {meta.title || t('ogPreview.untitled')}
                </p>
                <p className="line-clamp-2 text-[13px] text-muted-foreground">
                  {meta.description || t('ogPreview.noDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Twitter summary card */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('ogPreview.twitter')}
            </p>
            <div className="overflow-hidden rounded-2xl border bg-background">
              {meta.image ? (
                <img
                  src={meta.image}
                  alt=""
                  className="aspect-[2/1] w-full object-cover bg-muted"
                />
              ) : (
                <div className="flex aspect-[2/1] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                  {t('ogPreview.noImage')}
                </div>
              )}
              <div className="space-y-0.5 px-3 py-2.5">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">
                  {meta.title || t('ogPreview.untitled')}
                </p>
                <p className="line-clamp-2 text-[13px] text-muted-foreground">
                  {meta.description || t('ogPreview.noDescription')}
                </p>
                <p className="truncate pt-0.5 text-[13px] text-muted-foreground">
                  {hostname}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('ogPreview.fields')}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {fields.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 break-all font-mono text-xs">
                {meta[key] || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
