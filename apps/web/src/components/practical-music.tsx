import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  NOTE_NAMES,
  CHORD_INTERVALS,
  chordNotes,
  guitarShapes,
  transposeChart,
  playTone,
  drumHit,
  DRUM_TRACKS,
  stepTime,
  encodeWav,
  validateDrum,
  type DrumPattern,
} from '@/lib/practical-music';
import { downloadBytes } from '@/lib/download';
import {
  PracticalFrame,
  PracticalText,
  ExportText,
  useLatestJob,
} from './practical-ui';
import { OrganizerFrame, useOrganizerStore } from './organizer-store';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
function useInstrument() {
  const context = useRef<AudioContext | null>(null),
    revision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const stop = useCallback(() => {
    revision.current++;
    const old = context.current;
    context.current = null;
    if (old) void old.close().catch(() => {});
  }, []);
  useEffect(() => stop, [stop]);
  const get = async () => {
    const token = revision.current;
    try {
      const audio = context.current ?? new AudioContext();
      context.current = audio;
      await audio.resume();
      if (token !== revision.current) throw new Error('CANCELLED');
      setError(null);
      return audio;
    } catch (cause) {
      if (token === revision.current) setError((cause as Error).message);
      throw cause;
    }
  };
  return { get, stop, error };
}
type NoteEvent = { note: number; start: number; duration: number };
export function PianoTool() {
  const { t } = useTranslation();
  const audio = useInstrument();
  const [query, setQuery] = useQueryParams<{ octave: number; volume: number }>({
    octave: NumberParam,
    volume: NumberParam,
  });
  const octave = Math.max(1, Math.min(7, Math.trunc(query.octave ?? 4))),
    volume = Math.max(0, Math.min(1, query.volume ?? 0.3));
  const [active, setActive] = useState<number[]>([]),
    [recording, setRecording] = useState(false),
    [events, setEvents] = useState<NoteEvent[]>([]),
    [playing, setPlaying] = useState(false);
  const held = useRef(new Map<number, { stop: () => void; start: number }>()),
    pressed = useRef(new Set<number>()),
    recordStart = useRef<number | null>(null),
    recorded = useRef<NoteEvent[]>([]),
    generation = useRef(0),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const release = (note: number) => {
    pressed.current.delete(note);
    const entry = held.current.get(note);
    if (!entry) return;
    entry.stop();
    held.current.delete(note);
    setActive([...held.current.keys()]);
    if (recordStart.current !== null) {
      recorded.current.push({
        note,
        start: Math.max(0, entry.start - recordStart.current) / 1000,
        duration: Math.min(60, (performance.now() - entry.start) / 1000),
      });
      setEvents([...recorded.current]);
    }
  };
  const press = async (note: number) => {
    if (pressed.current.has(note) || playing) return;
    pressed.current.add(note);
    const token = generation.current;
    try {
      const context = await audio.get();
      if (token !== generation.current || !pressed.current.has(note)) return;
      held.current.set(note, {
        stop: playTone(context, note, context.currentTime, 60, volume),
        start: performance.now(),
      });
      setActive([...held.current.keys()]);
    } catch {
      pressed.current.delete(note);
    }
  };
  const stop = () => {
    generation.current++;
    [...held.current.keys()].forEach(release);
    pressed.current.clear();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    audio.stop();
    setActive([]);
    setPlaying(false);
    recordStart.current = null;
    setRecording(false);
  };
  const current = useRef({ press, release, stop });
  current.current = { press, release, stop };
  useEffect(() => {
    const keys = 'awsedftgyhujk',
      down = (e: KeyboardEvent) => {
        if (
          e.repeat ||
          e.ctrlKey ||
          e.metaKey ||
          e.altKey ||
          (e.target instanceof HTMLElement &&
            e.target.closest('input,textarea,select,button,[role="combobox"]'))
        )
          return;
        const i = keys.indexOf(e.key.toLowerCase());
        if (i >= 0) {
          e.preventDefault();
          void current.current.press((octave + 1) * 12 + i);
        }
      },
      up = (e: KeyboardEvent) => {
        const i = keys.indexOf(e.key.toLowerCase());
        if (i >= 0) current.current.release((octave + 1) * 12 + i);
      },
      blur = () => current.current.stop();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      current.current.stop();
    };
  }, [octave]);
  const record = () => {
    if (recording) {
      [...held.current.keys()].forEach(release);
      recordStart.current = null;
      setRecording(false);
      timers.current.forEach(clearTimeout);
    } else {
      stop();
      recorded.current = [];
      setEvents([]);
      recordStart.current = performance.now();
      setRecording(true);
      timers.current.push(setTimeout(() => current.current.stop(), 60000));
    }
  };
  const playback = async () => {
    stop();
    const token = generation.current;
    try {
      const context = await audio.get();
      if (token !== generation.current) return;
      setPlaying(true);
      events.forEach((e) =>
        playTone(
          context,
          e.note,
          context.currentTime + 0.05 + e.start,
          e.duration,
          volume,
        ),
      );
      timers.current.push(
        setTimeout(
          () => {
            setPlaying(false);
            audio.stop();
          },
          (Math.max(...events.map((e) => e.start + e.duration)) + 0.2) * 1000,
        ),
      );
    } catch {
      /* 错误由音频 Hook 展示 */
    }
  };
  return (
    <PracticalFrame id="piano" error={audio.error}>
      <div className="grid gap-3 md:grid-cols-2">
        <NumberField
          label={t('studio20.octave')}
          value={octave}
          min={1}
          max={7}
          step={1}
          onChange={(octave) => setQuery({ octave })}
        />
        <NumberField
          label={t('studio20.volume')}
          value={volume}
          min={0}
          max={1}
          step={0.05}
          onChange={(volume) => setQuery({ volume })}
        />
      </div>
      <div className="flex gap-1 overflow-auto rounded-xl bg-muted p-3">
        {Array.from({ length: 13 }, (_, i) => {
          const note = (octave + 1) * 12 + i;
          return (
            <button
              key={note}
              className={`h-48 min-w-12 flex-1 touch-none rounded-b-lg border p-1 text-sm ${active.includes(note) ? 'bg-blue-500 text-white' : [1, 3, 6, 8, 10].includes(i) ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}
              aria-label={`${NOTE_NAMES[i % 12]}${octave + Math.floor(i / 12)}`}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                void press(note);
              }}
              onPointerUp={() => release(note)}
              onPointerCancel={() => release(note)}
              onKeyDown={(event) => {
                if (['Enter', ' '].includes(event.key)) {
                  event.preventDefault();
                  void press(note);
                }
              }}
              onKeyUp={(event) => {
                if (['Enter', ' '].includes(event.key)) release(note);
              }}
            >
              {NOTE_NAMES[i % 12]}
              <br />
              {'awsedftgyhujk'[i]}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={record}>
          {t(`studio20.${recording ? 'stop' : 'record'}`)}
        </Button>
        <Button
          variant="outline"
          disabled={!events.length || recording || playing}
          onClick={() => void playback()}
        >
          {t('studio20.playback')}
        </Button>
        <Button variant="outline" onClick={stop}>
          {t('studio20.stop')}
        </Button>
      </div>
      <p role="status">
        {t('studio20.recordLimit')} · {events.length}
        {recording ? ' · ' + t('studio20.recording') : ''}
      </p>
      {events.length > 0 && (
        <ExportText
          value={JSON.stringify(events, null, 2)}
          name="piano-recording.json"
          type="application/json"
        />
      )}
    </PracticalFrame>
  );
}
export function ChordTool() {
  const { t } = useTranslation(),
    audio = useInstrument();
  const [query, setQuery] = useQueryParams<{
    root: number;
    quality: string;
    shift: number;
    capo: number;
  }>({
    root: NumberParam,
    quality: StringParam,
    shift: NumberParam,
    capo: NumberParam,
  });
  const root = Math.max(0, Math.min(11, Math.trunc(query.root ?? 0))),
    quality = CHORD_INTERVALS[query.quality ?? ''] ? query.quality! : 'major',
    shift = query.shift ?? 0,
    capo = query.capo ?? 0;
  const [chart, setChart] = useState('C  Am  F  G\nDm7  G7  Cmaj7');
  const notes = chordNotes(root, quality),
    shapes = guitarShapes(notes);
  let output = '',
    error: string | null = null;
  try {
    if (!Number.isInteger(capo) || capo < 0 || capo > 12)
      throw new Error('invalid');
    output = transposeChart(chart, shift - capo);
  } catch (cause) {
    error = t(`studio20.${(cause as Error).message}`);
  }
  return (
    <PracticalFrame id="chord-tool" error={error || audio.error}>
      <div className="grid gap-3 md:grid-cols-4">
        <ChoiceField
          label={t('studio20.root')}
          value={String(root)}
          options={NOTE_NAMES.map((label, i) => ({ label, value: String(i) }))}
          onChange={(root) => setQuery({ root: Number(root) })}
        />
        <ChoiceField
          label={t('studio20.quality')}
          value={quality}
          options={Object.keys(CHORD_INTERVALS).map((value) => ({
            value,
            label: t(`studio20.${value}`),
          }))}
          onChange={(quality) => setQuery({ quality })}
        />
        <NumberField
          label={t('studio20.semitones')}
          value={shift}
          min={-12}
          max={12}
          step={1}
          onChange={(shift) => setQuery({ shift })}
        />
        <NumberField
          label={t('studio20.capo')}
          value={capo}
          min={0}
          max={12}
          step={1}
          onChange={(capo) => setQuery({ capo })}
        />
      </div>
      <div className="flex gap-1">
        {NOTE_NAMES.map((note, i) => (
          <span
            key={note}
            className={`flex h-24 min-w-0 flex-1 items-end justify-center rounded border pb-2 text-xs ${notes.includes(i) ? 'bg-lime-400 text-black' : 'bg-muted'}`}
          >
            {note}
          </span>
        ))}
      </div>
      <Button
        onClick={async () => {
          try {
            audio.stop();
            const context = await audio.get();
            CHORD_INTERVALS[quality].forEach((n) =>
              playTone(context, 60 + root + n, context.currentTime, 1.5, 0.15),
            );
          } catch {
            /* Hook 展示 */
          }
        }}
      >
        {t('studio20.play')}
      </Button>
      <section>
        <h2 className="mb-3 font-semibold">{t('studio20.fingerings')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {shapes.map((shape, index) => (
            <svg
              key={index}
              viewBox="0 0 140 130"
              role="img"
              aria-label={shape.map((n) => (n < 0 ? '×' : n)).join(' ')}
              className="w-full rounded border bg-white"
            >
              <text x="10" y="12" fontSize="9" fill="#111827">
                E A D G B e ·{' '}
                {shape.some((n) => n > 0)
                  ? Math.min(...shape.filter((n) => n > 0))
                  : 1}
                fr
              </text>
              {Array.from({ length: 6 }, (_, i) => (
                <line
                  key={i}
                  x1={25 + i * 18}
                  y1="30"
                  x2={25 + i * 18}
                  y2="110"
                  stroke="#9ca3af"
                />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line
                  key={i}
                  x1="25"
                  y1={30 + i * 20}
                  x2="115"
                  y2={30 + i * 20}
                  stroke="#9ca3af"
                />
              ))}
              {shape.map((fret, i) =>
                fret <= 0 ? (
                  <text
                    key={i}
                    x={21 + i * 18}
                    y="25"
                    fontSize="10"
                    fill="#111827"
                  >
                    {fret < 0 ? '×' : '○'}
                  </text>
                ) : (
                  <circle
                    key={i}
                    cx={25 + i * 18}
                    cy={
                      40 +
                      (fret -
                        (shape.some((n) => n > 0)
                          ? Math.min(...shape.filter((n) => n > 0))
                          : 1)) *
                        20
                    }
                    r="6"
                    fill="#65a30d"
                  />
                ),
              )}
            </svg>
          ))}
        </div>
      </section>
      <PracticalText
        label={t('studio20.chart')}
        value={chart}
        onChange={setChart}
        multiline
      />
      <pre className="overflow-auto rounded-lg bg-muted p-3">{output}</pre>
      <ExportText value={output} name="chords.txt" />
    </PracticalFrame>
  );
}
const INITIAL_DRUM: DrumPattern = {
  bpm: 120,
  swing: 0,
  steps: [
    Array.from({ length: 16 }, (_, i) => i % 4 === 0),
    Array.from({ length: 16 }, (_, i) => i % 8 === 4),
    Array.from({ length: 16 }, (_, i) => i % 2 === 0),
    Array<boolean>(16).fill(false),
  ],
};
export function DrumMachine() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
      'practical-drums',
      INITIAL_DRUM,
      validateDrum,
    ),
    audio = useInstrument();
  const [playing, setPlaying] = useState(false),
    [step, setStep] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null),
    revision = useRef(0);
  const { bpm, swing, steps } = store.data;
  const job = useLatestJob<Uint8Array>(JSON.stringify(store.data));
  const stop = useCallback(() => {
    revision.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    audio.stop();
    setPlaying(false);
    setStep(-1);
  }, [audio.stop]);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    stop();
  }, [bpm, swing, steps, stop]);
  const play = async () => {
    stop();
    const token = revision.current;
    try {
      const context = await audio.get();
      if (token !== revision.current) return;
      setPlaying(true);
      const started = context.currentTime + 0.05;
      let next = 0;
      const schedule = () => {
        const now = context.currentTime;
        if (started + stepTime(next, bpm, swing) < now - 0.25)
          next = Math.max(next, Math.floor(((now - started) * bpm * 4) / 60));
        while (started + stepTime(next, bpm, swing) < now + 0.12) {
          const when = started + stepTime(next, bpm, swing);
          steps.forEach((row, track) => {
            if (row[next % 16]) drumHit(context, track, Math.max(now, when));
          });
          next++;
        }
        let current = Math.max(0, Math.floor(((now - started) * bpm * 4) / 60));
        if (started + stepTime(current, bpm, swing) > now) current--;
        setStep(Math.max(0, current) % 16);
      };
      schedule();
      timer.current = setInterval(schedule, 25);
    } catch {
      /* Hook 展示 */
    }
  };
  const exportWav = () =>
    void job.run(async () => {
      const seconds = (16 * 60) / bpm / 4 + 0.5,
        context = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100);
      steps.forEach((row, track) =>
        row.forEach((on, i) => {
          if (on) drumHit(context, track, stepTime(i, bpm, swing));
        }),
      );
      return encodeWav(await context.startRendering());
    });
  return (
    <OrganizerFrame
      title={t('studio20.tools.drum-machine.title')}
      store={store}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <NumberField
          label={t('studio20.bpm')}
          value={bpm}
          min={30}
          max={300}
          onChange={(bpm) => store.setData({ ...store.data, bpm })}
        />
        <NumberField
          label={t('studio20.swing')}
          value={swing * 100}
          min={0}
          max={75}
          step={5}
          onChange={(swing) =>
            store.setData({ ...store.data, swing: swing / 100 })
          }
        />
      </div>
      <div className="overflow-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              <th colSpan={16}>{t('studio20.steps')}</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((row, track) => (
              <tr key={track}>
                <th className="pr-2 text-left text-sm">
                  {t(`studio20.${DRUM_TRACKS[track]}`)}
                </th>
                {row.map((on, i) => (
                  <td key={i}>
                    <Button
                      size="icon"
                      variant={on ? 'default' : 'outline'}
                      aria-label={`${t(`studio20.${DRUM_TRACKS[track]}`)} ${i + 1}`}
                      aria-pressed={on}
                      className={i === step ? 'ring-2 ring-amber-500' : ''}
                      onClick={() =>
                        store.setData({
                          ...store.data,
                          steps: steps.map((old, r) =>
                            r === track
                              ? old.map((value, c) =>
                                  c === i ? !value : value,
                                )
                              : old,
                          ),
                        })
                      }
                    >
                      {i + 1}
                    </Button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => (playing ? stop() : void play())}>
          {t(`studio20.${playing ? 'stop' : 'play'}`)}
        </Button>
        <Button variant="outline" onClick={exportWav} disabled={job.busy}>
          {t('studio20.wav')}
        </Button>
        {job.result && (
          <Button
            variant="outline"
            onClick={() => downloadBytes(job.result!, 'drums.wav', 'audio/wav')}
          >
            {t('studio20.download')}
          </Button>
        )}
      </div>
      {(audio.error || job.error) && (
        <p role="alert" className="text-destructive">
          {audio.error || job.error}
        </p>
      )}
    </OrganizerFrame>
  );
}
