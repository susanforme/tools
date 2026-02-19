import { createFileRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';

export const Route = createFileRoute('/http-status')({
  component: HttpStatusPage,
});

type StatusCode = {
  code: number;
  name: string;
};

const STATUS_CODES: StatusCode[] = [
  // 1xx
  { code: 100, name: 'Continue' },
  { code: 101, name: 'Switching Protocols' },
  { code: 102, name: 'Processing' },
  { code: 103, name: 'Early Hints' },
  // 2xx
  { code: 200, name: 'OK' },
  { code: 201, name: 'Created' },
  { code: 202, name: 'Accepted' },
  { code: 203, name: 'Non-Authoritative Information' },
  { code: 204, name: 'No Content' },
  { code: 205, name: 'Reset Content' },
  { code: 206, name: 'Partial Content' },
  { code: 207, name: 'Multi-Status' },
  { code: 208, name: 'Already Reported' },
  { code: 226, name: 'IM Used' },
  // 3xx
  { code: 300, name: 'Multiple Choices' },
  { code: 301, name: 'Moved Permanently' },
  { code: 302, name: 'Found' },
  { code: 303, name: 'See Other' },
  { code: 304, name: 'Not Modified' },
  { code: 305, name: 'Use Proxy' },
  { code: 307, name: 'Temporary Redirect' },
  { code: 308, name: 'Permanent Redirect' },
  // 4xx
  { code: 400, name: 'Bad Request' },
  { code: 401, name: 'Unauthorized' },
  { code: 402, name: 'Payment Required' },
  { code: 403, name: 'Forbidden' },
  { code: 404, name: 'Not Found' },
  { code: 405, name: 'Method Not Allowed' },
  { code: 406, name: 'Not Acceptable' },
  { code: 407, name: 'Proxy Authentication Required' },
  { code: 408, name: 'Request Timeout' },
  { code: 409, name: 'Conflict' },
  { code: 410, name: 'Gone' },
  { code: 411, name: 'Length Required' },
  { code: 412, name: 'Precondition Failed' },
  { code: 413, name: 'Content Too Large' },
  { code: 414, name: 'URI Too Long' },
  { code: 415, name: 'Unsupported Media Type' },
  { code: 416, name: 'Range Not Satisfiable' },
  { code: 417, name: 'Expectation Failed' },
  { code: 418, name: "I'm a Teapot" },
  { code: 421, name: 'Misdirected Request' },
  { code: 422, name: 'Unprocessable Content' },
  { code: 423, name: 'Locked' },
  { code: 424, name: 'Failed Dependency' },
  { code: 425, name: 'Too Early' },
  { code: 426, name: 'Upgrade Required' },
  { code: 428, name: 'Precondition Required' },
  { code: 429, name: 'Too Many Requests' },
  { code: 431, name: 'Request Header Fields Too Large' },
  { code: 451, name: 'Unavailable For Legal Reasons' },
  // 5xx
  { code: 500, name: 'Internal Server Error' },
  { code: 501, name: 'Not Implemented' },
  { code: 502, name: 'Bad Gateway' },
  { code: 503, name: 'Service Unavailable' },
  { code: 504, name: 'Gateway Timeout' },
  { code: 505, name: 'HTTP Version Not Supported' },
  { code: 506, name: 'Variant Also Negotiates' },
  { code: 507, name: 'Insufficient Storage' },
  { code: 508, name: 'Loop Detected' },
  { code: 510, name: 'Not Extended' },
  { code: 511, name: 'Network Authentication Required' },
];

function getCategory(code: number) {
  if (code < 200) return '1xx';
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

function categoryColor(cat: string) {
  switch (cat) {
    case '1xx':
      return 'text-sky-600 bg-sky-500/10 border-sky-500/30';
    case '2xx':
      return 'text-green-600 bg-green-500/10 border-green-500/30';
    case '3xx':
      return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    case '4xx':
      return 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    default:
      return 'text-red-600 bg-red-500/10 border-red-500/30';
  }
}

function HttpStatusPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  function categoryLabel(cat: string) {
    const map: Record<string, string> = {
      '1xx': t('httpStatus.cat1xx'),
      '2xx': t('httpStatus.cat2xx'),
      '3xx': t('httpStatus.cat3xx'),
      '4xx': t('httpStatus.cat4xx'),
      '5xx': t('httpStatus.cat5xx'),
    };
    return map[cat] ?? cat;
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return STATUS_CODES.filter((s) => {
      if (catFilter !== 'all' && getCategory(s.code) !== catFilter)
        return false;
      if (!q) return true;
      const desc = t(`httpStatus.codes.${s.code}`).toLowerCase();
      return (
        String(s.code).includes(q) ||
        s.name.toLowerCase().includes(q) ||
        desc.includes(q)
      );
    });
  }, [search, catFilter, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, StatusCode[]>();
    filtered.forEach((s) => {
      const cat = getCategory(s.code);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return map;
  }, [filtered]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('httpStatus.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('httpStatus.desc')}
        </p>
      </div>

      {/* 搜索与分类筛选 */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('httpStatus.searchPlaceholder')}
            className="w-full h-9 pl-8 pr-3 text-sm rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', '1xx', '2xx', '3xx', '4xx', '5xx'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                catFilter === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'all' ? t('httpStatus.all') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* 结果列表 */}
      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="outline"
                className={`text-xs font-mono ${categoryColor(cat)}`}
              >
                {categoryLabel(cat)}
              </Badge>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="divide-y border rounded-lg overflow-hidden">
              {items.map((s) => (
                <div
                  key={s.code}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <span
                    className={`font-mono font-bold text-sm shrink-0 ${
                      categoryColor(
                        s.code < 200
                          ? '1xx'
                          : s.code < 300
                            ? '2xx'
                            : s.code < 400
                              ? '3xx'
                              : s.code < 500
                                ? '4xx'
                                : '5xx',
                      ).split(' ')[0]
                    }`}
                  >
                    {s.code}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`httpStatus.codes.${s.code}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('httpStatus.noMatch')}
          </p>
        )}
      </div>
    </div>
  );
}
