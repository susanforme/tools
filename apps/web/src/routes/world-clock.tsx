import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrayParam, StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { api } from '@/lib/api';
import {
  DEFAULT_WORLD_CITY_IDS,
  searchWorldCities,
  WORLD_CITIES,
  type WorldCity,
} from '@/lib/life-calculators';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  Check,
  Clock3,
  Globe2,
  Grid2X2,
  List,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/world-clock')({
  component: WorldClockPage,
});

type Layout = 'grid' | 'list';
type Sort = 'offset' | 'name' | 'added';

async function fetchUtcTime() {
  const requestStartedAt = Date.now();
  try {
    const response = await api.time.$get();
    if (!response.ok) throw new Error('UTC time request failed');
    const { utc } = await response.json();
    const receivedAt = Date.now();
    const utcMs = Date.parse(utc);
    if (Number.isNaN(utcMs)) throw new Error('Invalid UTC time');
    return {
      receivedAt,
      utcMs: utcMs + (receivedAt - requestStartedAt) / 2,
    };
  } catch {
    const now = Date.now();
    return { receivedAt: now, utcMs: now };
  }
}

function offsetLabel(date: Date, timeZone: string): string {
  return (
    new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  );
}

function offsetMinutes(date: Date, timeZone: string): number {
  const match = offsetLabel(date, timeZone).match(
    /(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/,
  );
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

function WorldClockPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith('zh') ? 'zh-CN' : 'en-US';
  const isChinese = locale === 'zh-CN';
  const [cityIds, setCityIds] = useQueryParam<string[]>(
    'cities',
    ArrayParam,
    DEFAULT_WORLD_CITY_IDS,
  );
  const [layoutValue, setLayout] = useQueryParam<Layout>(
    'layout',
    StringParam,
    'grid',
  );
  const [sortValue, setSort] = useQueryParam<Sort>(
    'sort',
    StringParam,
    'offset',
  );
  const layout: Layout = layoutValue === 'list' ? 'list' : 'grid';
  const sort: Sort = ['offset', 'name', 'added'].includes(sortValue)
    ? sortValue
    : 'offset';
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const clock = useQuery({
    queryKey: ['utc-time'],
    queryFn: fetchUtcTime,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const now = clock.data
    ? new Date(clock.data.utcMs + tick - clock.data.receivedAt)
    : null;
  const selectedIds = useMemo(() => new Set(cityIds), [cityIds]);
  const selectedCities = useMemo(() => {
    const byId = new Map<string, WorldCity>(
      WORLD_CITIES.map((city) => [city[0], city]),
    );
    const cities: WorldCity[] = cityIds.flatMap((id) => {
      const city = byId.get(id);
      return city ? [city] : [];
    });
    if (sort === 'name') {
      return cities.sort((left, right) =>
        left[isChinese ? 2 : 3].localeCompare(right[isChinese ? 2 : 3]),
      );
    }
    if (sort === 'offset' && now) {
      return cities.sort(
        (left, right) =>
          offsetMinutes(now, left[1]) - offsetMinutes(now, right[1]),
      );
    }
    return cities;
  }, [cityIds, isChinese, now, sort]);
  const suggestions = useMemo(() => searchWorldCities(search), [search]);

  const addCity = (id: string) => {
    setCityIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setSearch('');
    setPickerOpen(false);
  };

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <span className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Globe2 className="size-7" />
          </span>
          {t('worldClock.title')}
        </h1>
        <Button
          variant="outline"
          disabled={clock.isFetching}
          onClick={() => void clock.refetch()}
        >
          {clock.isFetching ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          {t('worldClock.sync')}
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-background to-background px-6 py-7 dark:border-sky-900 dark:from-sky-950/40 sm:px-10">
        <Globe2 className="pointer-events-none absolute top-1/2 right-24 hidden size-52 -translate-y-1/2 text-sky-200/50 lg:block dark:text-sky-900/40" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-medium tracking-wide text-muted-foreground">
              {t('worldClock.serverUtc')}
            </p>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-4xl lg:text-5xl">
              {now?.toISOString().replace('T', ' ').slice(0, 19) ?? '—'}{' '}
              <span className="text-sky-500">UTC</span>
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t('worldClock.utcDescription')}
            </p>
          </div>
          <div className="hidden size-28 shrink-0 items-center justify-center rounded-full border-8 border-sky-100 bg-background text-sky-500 shadow-sm sm:flex dark:border-sky-950">
            <Clock3 className="size-14" />
          </div>
        </div>
      </section>

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div
          className="relative w-full max-w-md"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPickerOpen(false);
            }
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            role="combobox"
            aria-expanded={pickerOpen}
            aria-controls="world-city-options"
            value={search}
            onFocus={() => setPickerOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setPickerOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setPickerOpen(false);
              if (event.key === 'Enter' && suggestions.length === 1) {
                addCity(suggestions[0][0]);
              }
            }}
            className="h-11 pl-10"
            placeholder={t('worldClock.searchPlaceholder')}
          />
          {pickerOpen && (
            <div
              id="world-city-options"
              role="listbox"
              className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {suggestions.length > 0 ? (
                suggestions.map((city) => {
                  const selected = selectedIds.has(city[0]);
                  return (
                    <button
                      key={city[0]}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={selected}
                      onClick={() => addCity(city[0])}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
                    >
                      <span className="text-xl" aria-hidden="true">
                        {city[4]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {city[isChinese ? 2 : 3]}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {city[1]}
                        </span>
                      </span>
                      {selected ? (
                        <Check className="size-4 text-sky-500" />
                      ) : (
                        <Plus className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('worldClock.noResults')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border bg-background p-1">
            <Button
              type="button"
              variant={layout === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label={t('worldClock.grid')}
              onClick={() => setLayout('grid')}
            >
              <Grid2X2 />
            </Button>
            <Button
              type="button"
              variant={layout === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label={t('worldClock.list')}
              onClick={() => setLayout('list')}
            >
              <List />
            </Button>
          </div>
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as Sort)}
          >
            <SelectTrigger className="h-10 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="offset">
                {t('worldClock.sortOffset')}
              </SelectItem>
              <SelectItem value="name">{t('worldClock.sortName')}</SelectItem>
              <SelectItem value="added">{t('worldClock.sortAdded')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCities.length > 0 ? (
        <div
          className={cn(
            layout === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'space-y-3',
          )}
        >
          {selectedCities.map((city) => (
            <CityClock
              key={city[0]}
              city={city}
              date={now}
              isChinese={isChinese}
              layout={layout}
              locale={locale}
              onRemove={() =>
                setCityIds((current) => current.filter((id) => id !== city[0]))
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {t('worldClock.empty')}
        </div>
      )}
    </div>
  );
}

function CityClock({
  city,
  date,
  isChinese,
  layout,
  locale,
  onRemove,
}: {
  city: WorldCity;
  date: Date | null;
  isChinese: boolean;
  layout: Layout;
  locale: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const time = date
    ? new Intl.DateTimeFormat(locale, {
        timeZone: city[1],
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(date)
    : '—';
  const day = date
    ? new Intl.DateTimeFormat(locale, {
        timeZone: city[1],
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        weekday: 'short',
      }).format(date)
    : '—';

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <CardContent
        className={cn(
          'p-5',
          layout === 'list' &&
            'flex flex-wrap items-center gap-x-8 gap-y-3 sm:px-6',
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-3',
            layout === 'list' && 'min-w-52 flex-1',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {city[4]}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold">
                {city[isChinese ? 2 : 3]}
              </h2>
              <p className="text-xs text-muted-foreground">
                {date ? offsetLabel(date, city[1]) : 'GMT'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('worldClock.remove', {
              city: city[isChinese ? 2 : 3],
            })}
            onClick={onRemove}
            className="text-muted-foreground opacity-70 group-hover:opacity-100"
          >
            <X />
          </Button>
        </div>
        <div className={cn(layout === 'grid' && 'mt-5')}>
          <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {time}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{day}</p>
        </div>
        <p
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            layout === 'grid' ? 'mt-4' : 'sm:ml-auto',
          )}
        >
          <MapPin className="size-3.5" />
          {city[1]}
        </p>
      </CardContent>
    </Card>
  );
}
