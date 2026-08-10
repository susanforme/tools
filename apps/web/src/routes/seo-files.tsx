import { Badge } from '@/components/ui/badge';
import { SecurityTxtPanel } from '@/components/extra-tool-panels';
import { HreflangPanel } from '@/components/protocol-tool-panels';
import { AppLinksPanel } from '@/components/modern-web-tool-panels';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  inspectRobotsTxt,
  inspectSitemapXml,
  type SeoFileReport,
} from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/seo-files')({ component: SeoFilesPage });

type Tab = 'robots' | 'sitemap' | 'security' | 'hreflang' | 'app-links';

function SeoFilesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<Tab>('tab', StringParam, 'robots');
  const [robots, setRobots] = useState('');
  const [sitemap, setSitemap] = useState('');
  const [report, setReport] = useState<SeoFileReport | null>(null);
  const input = tab === 'robots' ? robots : sitemap;

  const changeTab = (value: string) => {
    setTab(value as Tab);
    setReport(null);
  };
  const inspect = () =>
    setReport(
      tab === 'robots' ? inspectRobotsTxt(robots) : inspectSitemapXml(sitemap),
    );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('seoFiles.title')}</h1>
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="robots">robots.txt</TabsTrigger>
          <TabsTrigger value="sitemap">sitemap.xml</TabsTrigger>
          <TabsTrigger value="security">security.txt</TabsTrigger>
          <TabsTrigger value="hreflang">hreflang</TabsTrigger>
          <TabsTrigger value="app-links">App Links</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'app-links' ? (
        <AppLinksPanel />
      ) : tab === 'security' ? (
        <SecurityTxtPanel />
      ) : tab === 'hreflang' ? (
        <HreflangPanel />
      ) : (
        <>
          <Textarea
            value={input}
            onChange={(event) => {
              if (tab === 'robots') setRobots(event.target.value);
              else setSitemap(event.target.value);
              setReport(null);
            }}
            placeholder={t(`seoFiles.${tab}Placeholder`)}
            className="min-h-80 font-mono text-xs"
            spellCheck={false}
          />
          <Button disabled={!input.trim()} onClick={inspect}>
            {t('seoFiles.inspect')}
          </Button>
          {report && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {t(tab === 'robots' ? 'seoFiles.rules' : 'seoFiles.urls', {
                    count: report.entries,
                  })}
                </Badge>
                <Badge variant="secondary">
                  {t('seoFiles.sitemaps', { count: report.sitemaps })}
                </Badge>
                <Badge
                  variant={report.issues.length ? 'destructive' : 'secondary'}
                >
                  {t('seoFiles.issues', { count: report.issues.length })}
                </Badge>
              </div>
              {report.issues.length === 0 ? (
                <p className="text-sm text-emerald-600">
                  {t('seoFiles.valid')}
                </p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {report.issues.map((issue, index) => (
                    <div
                      key={`${issue.code}-${issue.line ?? index}`}
                      className="p-3 text-sm"
                    >
                      <Badge
                        variant={
                          issue.level === 'error' ? 'destructive' : 'secondary'
                        }
                        className="mr-2"
                      >
                        {t(`seoFiles.${issue.level}`)}
                      </Badge>
                      {issue.line &&
                        `${t('seoFiles.line', { line: issue.line })}：`}
                      {t(`seoFiles.issueCodes.${issue.code}`)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
