import { downloadBlob } from '@/lib/download';
import { readTracks, trackDistances, type Track } from '@/lib/media-tracks';
import { utmToWgs84, wgs84ToUtm } from '@/lib/utm-coordinates';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

export function ElevationProfile() {
  const { t } = useTranslation();
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const distances = useMemo(
    () => (track ? trackDistances(track.points) : []),
    [track],
  );
  const ascent =
    track?.points.reduce(
      (total, point, index) =>
        total +
        Math.max(
          0,
          (point[2] ?? 0) - (track.points[index - 1]?.[2] ?? point[2] ?? 0),
        ),
      0,
    ) ?? 0;
  const elevations =
    track?.points
      .map((point) => point[2])
      .filter((value): value is number => value !== undefined) ?? [];
  const min = elevations.length ? Math.min(...elevations) : 0,
    max = elevations.length ? Math.max(...elevations) : 1;
  const grade =
    track?.points.slice(1).map((point, index) => {
      const previous = track.points[index]!;
      const meters = (distances[index + 1]! - distances[index]!) * 1000;
      return meters > 0 && point[2] !== undefined && previous[2] !== undefined
        ? (100 * (point[2] - previous[2])) / meters
        : 0;
    }) ?? [];
  const polyline =
    track?.points
      .filter(
        (_, index) =>
          index % Math.max(1, Math.ceil(track.points.length / 300)) === 0,
      )
      .map(
        (point, index, sampled) =>
          `${((index / Math.max(sampled.length - 1, 1)) * 500).toFixed(1)},${(150 - (((point[2] ?? min) - min) / Math.max(max - min, 1)) * 140).toFixed(1)}`,
      )
      .join(' ') ?? '';
  async function load(file: File) {
    setError(null);
    try {
      const next = await readTracks(await file.text(), file.name);
      setTrack(next[0] ?? null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <Input
        aria-label={t('newTools.trackFile')}
        type="file"
        accept=".gpx,.kml,.geojson,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void load(file);
        }}
      />
      {track && (
        <>
          <p>
            {track.name} · {(distances.at(-1) ?? 0).toFixed(2)} km ·{' '}
            {t('newTools.ascent')} {ascent.toFixed(0)} m ·{' '}
            {t('newTools.maxGrade')} {Math.max(0, ...grade).toFixed(1)}%
          </p>
          {elevations.length > 1 && (
            <svg
              role="img"
              aria-label={t('newTools.elevation')}
              viewBox="0 0 500 160"
              className="w-full rounded-md border bg-background"
            >
              <polyline
                points={polyline}
                fill="none"
                stroke="#0d9488"
                strokeWidth="2"
              />
            </svg>
          )}
          <div className="max-h-40 overflow-auto rounded-md border p-2 font-mono text-xs">
            {grade.map(
              (value, index) =>
                value >= 10 && (
                  <p key={index}>
                    {(distances[index] ?? 0).toFixed(2)} km: {value.toFixed(1)}%
                  </p>
                ),
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CoordinateConverter() {
  const { t } = useTranslation();
  const [direction, setDirection] = useQueryParam<'toUtm' | 'toWgs'>(
    'direction',
    StringParam,
    'toUtm',
  );
  const [source, setSource] = useState('lon,lat\n121.4737,31.2304');
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  function convert() {
    setError(null);
    try {
      const parsed = Papa.parse<Record<string, string>>(source, {
        header: true,
        skipEmptyLines: 'greedy',
      });
      if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
      if (!parsed.data.length) throw new Error(t('newTools.emptyTable'));
      const output = parsed.data.map((row) => {
        if (direction === 'toUtm' && (!row.lon?.trim() || !row.lat?.trim()))
          throw new Error(t('newTools.invalidCoordinate'));
        if (
          direction === 'toWgs' &&
          (!row.zone?.trim() ||
            !row.hemisphere?.trim() ||
            !row.easting?.trim() ||
            !row.northing?.trim())
        )
          throw new Error(t('newTools.invalidCoordinate'));
        return direction === 'toUtm'
          ? wgs84ToUtm(Number(row.lon), Number(row.lat))
          : utmToWgs84({
              zone: Number(row.zone),
              hemisphere: row.hemisphere as 'N' | 'S',
              easting: Number(row.easting),
              northing: Number(row.northing),
            });
      });
      setResult(Papa.unparse(output));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          variant={direction === 'toUtm' ? 'default' : 'outline'}
          onClick={() => {
            setDirection('toUtm');
            setSource('lon,lat\n121.4737,31.2304');
            setResult('');
          }}
        >
          WGS84 → UTM
        </Button>
        <Button
          variant={direction === 'toWgs' ? 'default' : 'outline'}
          onClick={() => {
            setDirection('toWgs');
            setSource(
              'zone,hemisphere,easting,northing\n51,N,354633.649,3456140.53',
            );
            setResult('');
          }}
        >
          UTM → WGS84
        </Button>
      </div>
      <Textarea
        aria-label="CSV"
        className="min-h-40 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <Button onClick={convert}>{t('newTools.convert')}</Button>
      {result && (
        <Textarea
          readOnly
          className="min-h-40 font-mono text-xs"
          value={result}
        />
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function MidiMonitor() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const access = useRef<MIDIAccess | null>(null);
  const [connected, setConnected] = useState(false);
  function disconnect() {
    access.current?.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    access.current = null;
    setConnected(false);
    setDevices([]);
  }
  useEffect(
    () => () => {
      access.current?.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    },
    [],
  );
  async function connect() {
    setError(null);
    try {
      if (typeof navigator.requestMIDIAccess !== 'function')
        throw new Error(t('newTools.midiUnavailable'));
      const next = await navigator.requestMIDIAccess();
      access.current?.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      access.current = next;
      setConnected(true);
      setDevices(
        [...next.inputs.values()].map(
          (input) => input.name ?? t('newTools.unknownDevice'),
        ),
      );
      next.inputs.forEach((input) => {
        input.onmidimessage = (event) => {
          const [status = 0, note = 0, value = 0] = event.data ?? [];
          const kind =
            (status & 0xf0) === 0x90 && value > 0
              ? 'Note On'
              : (status & 0xf0) === 0x80 || (status & 0xf0) === 0x90
                ? 'Note Off'
                : (status & 0xf0) === 0xb0
                  ? 'CC'
                  : 'MIDI';
          setEvents((current) => [
            ...current.slice(-999),
            `${new Date().toISOString()},"${(input.name ?? '').replaceAll('"', '""')}",${kind},${status & 0x0f},${note},${value}`,
          ]);
        };
      });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function exportCsv() {
    downloadBlob(
      new Blob(
        [
          `time,device,type,channel,note_or_controller,value\n${events.join('\n')}`,
        ],
        { type: 'text/csv' },
      ),
      'midi-events.csv',
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button onClick={() => void (connected ? disconnect() : connect())}>
          {t(connected ? 'newTools.disconnect' : 'newTools.connect')}
        </Button>
        <Button variant="outline" disabled={!events.length} onClick={exportCsv}>
          {t('newTools.export')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {devices.join(', ') || t('newTools.noDevices')}
      </p>
      <Textarea
        readOnly
        aria-label={t('newTools.midiEvents')}
        className="min-h-64 font-mono text-xs"
        value={events.join('\n')}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
