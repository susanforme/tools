import { downloadBlob, downloadBytes } from '@/lib/download';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { parseSubtitles } from '@/lib/subtitles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export function SvgMorph() {
  const { t } = useTranslation();
  const [from, setFrom] = useState('M 20 20 L 80 20 L 80 80 L 20 80 Z');
  const [to, setTo] = useState('M 50 5 L 95 50 L 50 95 L 5 50 Z');
  const [seconds, setSeconds] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const commands = (path: string) => path.match(/[a-zA-Z]/g)?.join('') ?? '';
  const numbers = (path: string) =>
    path.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)?.length ?? 0;
  const valid =
    commands(from) === commands(to) &&
    numbers(from) === numbers(to) &&
    /^[Mm]/.test(from.trim()) &&
    seconds > 0 &&
    seconds <= 60;
  function exportSvg() {
    if (!valid) {
      setError(t('newTools.morphMismatch'));
      return;
    }
    const safeFrom = from.replace(/[&"<>]/g, ''),
      safeTo = to.replace(/[&"<>]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#8b5cf6" d="${safeFrom}"><animate attributeName="d" values="${safeFrom};${safeTo};${safeFrom}" dur="${seconds * 2}s" repeatCount="indefinite"/></path></svg>`;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'path-morph.svg');
    setError(null);
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="morph-from">{t('newTools.startPath')}</Label>
      <Textarea
        id="morph-from"
        value={from}
        onChange={(event) => setFrom(event.target.value)}
        className="font-mono"
      />
      <Label htmlFor="morph-to">{t('newTools.endPath')}</Label>
      <Textarea
        id="morph-to"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        className="font-mono"
      />
      <Label htmlFor="morph-duration">{t('newTools.duration')}</Label>
      <Input
        id="morph-duration"
        type="number"
        min={0.1}
        max={60}
        step={0.1}
        value={seconds}
        onChange={(event) => setSeconds(Number(event.target.value))}
        className="max-w-32"
      />
      <Button disabled={!valid} onClick={exportSvg}>
        {t('newTools.exportSvg')}
      </Button>
      {!valid && (
        <p className="text-sm text-destructive">
          {t('newTools.morphMismatch')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {valid && (
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={t('newTools.morph')}
          className="h-56 w-56 rounded-md border bg-background"
        >
          <path fill="#8b5cf6" d={from}>
            <animate
              attributeName="d"
              values={`${from};${to};${from}`}
              dur={`${seconds * 2}s`}
              repeatCount="indefinite"
            />
          </path>
        </svg>
      )}
    </div>
  );
}

export function FontSubset() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [characters, setCharacters] = useState('中文 ABC 0123456789');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function createSubset() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (file.size > 8_000_000 || !/\.(ttf|otf|woff2?)$/i.test(file.name))
        throw new Error(t('newTools.invalidFont'));
      const { create } = await import('fontkit');
      const parsed = create(
        new Uint8Array(await file.arrayBuffer()) as unknown as Buffer,
      );
      const font = 'fonts' in parsed ? parsed.fonts[0] : parsed;
      if (!font) throw new Error(t('newTools.invalidFont'));
      const subset = font.createSubset();
      for (const glyph of font.layout(characters).glyphs)
        subset.includeGlyph(glyph);
      const bytes = subset.encode();
      const isOpenType =
        new TextDecoder().decode(bytes.subarray(0, 4)) === 'OTTO';
      downloadBytes(
        bytes,
        `${file.name.replace(/\.[^.]+$/, '')}-subset.${isOpenType ? 'otf' : 'ttf'}`,
        isOpenType ? 'font/otf' : 'font/ttf',
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="subset-font">{t('newTools.fontFile')}</Label>
      <Input
        id="subset-font"
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Label htmlFor="subset-chars">{t('newTools.characters')}</Label>
      <Textarea
        id="subset-chars"
        value={characters}
        onChange={(event) => setCharacters(event.target.value)}
      />
      <Button
        disabled={!file || !characters || busy}
        onClick={() => void createSubset()}
      >
        {t('newTools.exportSubset')}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const loudnessWorker = () =>
  new Worker(
    new URL('../../workers/audio-loudness.worker.ts', import.meta.url),
    { type: 'module' },
  );

export function LoudnessMeter() {
  const { t } = useTranslation();
  const task = useBoundedWorker<
    { channels: Float32Array[]; sampleRate: number },
    { lufs: number; truePeakDb: number }
  >(loudnessWorker, 45000);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function inspect(file: File) {
    setDecoding(true);
    setError(null);
    task.clear();
    let context: AudioContext | null = null;
    try {
      if (file.size > 40_000_000) throw new Error(t('newTools.fileTooLarge'));
      context = new AudioContext();
      const audio = await context.decodeAudioData(await file.arrayBuffer());
      task.run({
        channels: Array.from({ length: audio.numberOfChannels }, (_, channel) =>
          audio.getChannelData(channel),
        ),
        sampleRate: audio.sampleRate,
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      await context?.close();
      setDecoding(false);
    }
  }
  return (
    <div className="space-y-3">
      <Input
        aria-label={t('newTools.audioFile')}
        type="file"
        accept="audio/*"
        disabled={decoding || task.busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void inspect(file);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('newTools.loudnessEstimate')}
      </p>
      {(decoding || task.busy) && <p role="status">{t('newTools.loading')}</p>}
      {task.result && (
        <pre className="rounded-md border p-3 text-sm">
          {t('newTools.estimatedLoudness')}: {task.result.lufs.toFixed(1)} LUFS
          {'\n'}
          {t('newTools.estimatedPeak')}: {task.result.truePeakDb.toFixed(1)}{' '}
          dBTP
        </pre>
      )}
      {(error || task.error) && (
        <p role="alert" className="text-destructive">
          {error || task.error}
        </p>
      )}
    </div>
  );
}

export function SubtitleQuality() {
  const { t } = useTranslation();
  const [source, setSource] = useState('');
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  function inspect() {
    setError(null);
    try {
      const cues = parseSubtitles(source);
      const warnings: string[] = [];
      cues.forEach((cue, index) => {
        const duration = cue.end - cue.start;
        const cps = [...cue.text.replace(/\s/g, '')].length / duration;
        const longest = Math.max(
          ...cue.text.split('\n').map((line) => [...line].length),
        );
        const flags = [
          cue.start < (cues[index - 1]?.end ?? 0) ? t('newTools.overlap') : '',
          duration < 1 ? t('newTools.shortCue') : '',
          cps > 20 ? `CPS ${cps.toFixed(1)}` : '',
          longest > 42 ? `CPL ${longest}` : '',
        ].filter(Boolean);
        if (flags.length) warnings.push(`${index + 1}: ${flags.join(', ')}`);
      });
      setReport(warnings.join('\n') || t('newTools.noIssues'));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="qc-subtitles">SRT / VTT</Label>
      <Textarea
        id="qc-subtitles"
        className="min-h-56 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <Button onClick={inspect}>{t('newTools.analyze')}</Button>
      {report && (
        <Textarea
          readOnly
          className="min-h-36 font-mono text-xs"
          value={report}
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
