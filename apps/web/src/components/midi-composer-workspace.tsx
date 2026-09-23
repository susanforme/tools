import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import { NumberParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  checkMidi,
  emptyMidi,
  emptyMidiTrack,
  transformMidi,
  type MidiProject,
} from '@/lib/midi-composer';
import type { MidiRequest, MidiResponse } from '@/lib/midi-composer.worker';
import { downloadBytes } from '@/lib/download';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
const createWorker = () =>
  new Worker(new URL('../lib/midi-composer.worker.ts', import.meta.url), {
    type: 'module',
  });
const PITCH_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
];
const noteName = (n: number) =>
  PITCH_NAMES[n % 12] + String(Math.floor(n / 12) - 1);
export default function MidiWorkbench() {
  const { t } = useTranslation();
  const [project, setProject] = useState(emptyMidi),
    [track, setTrack] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [error, setError] = useState<string | null>(null),
    [playing, setPlaying] = useState(false),
    [playhead, setPlayhead] = useState(0);
  const [q, setQ] = useQueryParams<{
    grid: number;
    page: number;
    base: number;
    shift: number;
  }>({
    grid: NumberParam,
    page: NumberParam,
    base: NumberParam,
    shift: NumberParam,
  });
  const [pitch, setPitch] = useState(60),
    [start, setStart] = useState(0),
    [length, setLength] = useState(1),
    [velocity, setVelocity] = useState(100);
  const job = useBoundedWorker<MidiRequest, MidiResponse>(createWorker, 15000);
  const action = useRef('parse'),
    session = useRef<{
      ctx: AudioContext;
      timer: ReturnType<typeof setInterval>;
    } | null>(null),
    ticket = useRef(0);
  const pendingContext = useRef<AudioContext | null>(null);
  const grid =
      Number.isFinite(q.grid) && q.grid! > 0 && q.grid! <= 4 ? q.grid! : 0.25,
    from = Math.max(0, Math.min(59984, Math.floor((q.page ?? 0) / 16) * 16)),
    base = Math.max(0, Math.min(92, Math.round(q.base ?? 48)));
  const current = project.tracks[track],
    ppq = project.header.ppq;
  function stop() {
    ticket.current++;
    if (pendingContext.current) {
      void pendingContext.current.close();
      pendingContext.current = null;
    }
    if (session.current) {
      clearInterval(session.current.timer);
      void session.current.ctx.close();
      session.current = null;
    }
    setPlaying(false);
  }
  useEffect(
    () => () => {
      ticket.current++;
      void pendingContext.current?.close();
      if (session.current) {
        clearInterval(session.current.timer);
        void session.current.ctx.close();
      }
    },
    [],
  );
  async function play(data: MidiProject) {
    stop();
    const id = ++ticket.current;
    const ctx = new AudioContext();
    pendingContext.current = ctx;
    try {
      await ctx.resume();
    } catch (error) {
      if (id !== ticket.current) return;
      throw error;
    }
    if (pendingContext.current === ctx) pendingContext.current = null;
    if (id !== ticket.current) {
      if (ctx.state !== 'closed') await ctx.close();
      return;
    }
    const notes = data.tracks
      .flatMap((tr) => tr.notes)
      .sort((a, b) => a.time - b.time);
    if (!notes.length) {
      await ctx.close();
      return;
    }
    let at = 0,
      active = 0;
    const origin = ctx.currentTime + 0.1,
      end = Math.max(...notes.map((n) => n.time + n.duration));
    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);
    const timer = setInterval(() => {
      const now = ctx.currentTime - origin;
      setPlayhead(Math.max(0, now));
      while (at < notes.length && notes[at]!.time < now + 0.2) {
        const note = notes[at++]!;
        if (active >= 128) {
          setError('polyphony');
          stop();
          return;
        }
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
        oscillator.connect(gain);
        gain.connect(master);
        const startAt = Math.max(ctx.currentTime, origin + note.time),
          endAt = Math.max(startAt + 0.02, origin + note.time + note.duration);
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(note.velocity, startAt + 0.005);
        gain.gain.setValueAtTime(
          note.velocity,
          Math.max(startAt + 0.005, endAt - 0.01),
        );
        gain.gain.linearRampToValueAtTime(0, endAt);
        active++;
        oscillator.onended = () => {
          active--;
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(startAt);
        oscillator.stop(endAt);
      }
      if (now > end + 0.1) stop();
    }, 40);
    session.current = { ctx, timer };
    setPlaying(true);
  }
  useEffect(() => {
    if (!job.result) return;
    const result = job.result;
    if (action.current === 'encode' && result.bytes)
      downloadBytes(result.bytes, 'composition.mid', 'audio/midi');
    else if (action.current === 'prepare')
      void play(result.project).catch((e) => setError((e as Error).message));
    else {
      stop();
      setProject(result.project);
      setTrack(0);
      setSelected(null);
    }
  }, [job.result]);
  function commit(next: MidiProject) {
    try {
      checkMidi(next);
      stop();
      job.clear();
      setProject(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function load(file: File) {
    stop();
    job.clear();
    setError(null);
    const id = ++ticket.current;
    try {
      if (file.size > 2_000_000) throw new Error('limit');
      const bytes = await file.arrayBuffer();
      if (id !== ticket.current) return;
      action.current = 'parse';
      job.run({ type: 'parse', bytes });
    } catch (e) {
      if (id === ticket.current) setError((e as Error).message);
    }
  }
  function pick(index: number) {
    const note = current?.notes[index];
    if (!note) return;
    setSelected(index);
    setPitch(note.midi);
    setStart(note.ticks / ppq);
    setLength(note.durationTicks / ppq);
    setVelocity(Math.round(note.velocity * 127));
  }
  function saveNote() {
    if (!current) return;
    const note = {
      midi: pitch,
      ticks: Math.round(start * ppq),
      durationTicks: Math.round(length * ppq),
      velocity: velocity / 127,
      name: noteName(pitch),
      time: 0,
      duration: 0,
    };
    const notes =
      selected === null
        ? [...current.notes, note]
        : current.notes.map((n, i) => (i === selected ? note : n));
    commit({
      ...project,
      tracks: project.tracks.map((tr, i) =>
        i === track ? { ...tr, notes } : tr,
      ),
    });
    setSelected(null);
  }
  const disabled = job.busy || playing;
  return (
    <div className="space-y-4">
      <Label htmlFor="midi-file">{t('mediaEditingTools.midiFile')}</Label>
      <Input
        id="midi-file"
        type="file"
        accept=".mid,.midi,audio/midi"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t('mediaEditingTools.midiLimit')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={job.busy || playing}
          onClick={() => {
            action.current = 'prepare';
            job.run({ type: 'prepare', project });
          }}
        >
          {t('mediaEditingTools.play')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            job.clear();
            stop();
          }}
        >
          {t('mediaEditingTools.stop')}
        </Button>
        <Button
          disabled={disabled}
          onClick={() => {
            action.current = 'encode';
            job.run({ type: 'encode', project });
          }}
        >
          {t('mediaEditingTools.exportMidi')}
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            commit(emptyMidi());
            setTrack(0);
            setSelected(null);
          }}
        >
          {t('mediaEditingTools.newProject')}
        </Button>
        <span className="self-center font-mono text-sm">
          {playhead.toFixed(2)} s
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('mediaEditingTools.synthNote')}
      </p>
      {(error || job.error) && (
        <p role="alert" className="text-destructive">
          {t('mediaEditingTools.failed', {
            msg: t(`mediaEditingTools.errors.${error || job.error}`, {
              defaultValue: error || job.error || '',
            }),
          })}
        </p>
      )}
      {job.busy && <p role="status">{t('mediaEditingTools.loading')}</p>}
      <fieldset disabled={disabled} className="min-w-0 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <ChoiceField
            label={t('mediaEditingTools.track')}
            value={String(track)}
            options={project.tracks.map((tr, i) => ({
              value: String(i),
              label: tr.name || `Track ${i + 1}`,
            }))}
            onChange={(v) => {
              setTrack(Number(v));
              setSelected(null);
            }}
          />
          <NumberField
            label={t('mediaEditingTools.grid')}
            value={grid}
            min={0.0625}
            max={4}
            step={0.0625}
            onChange={(grid) => setQ({ grid })}
          />
          <NumberField
            label={t('mediaEditingTools.pageBeat')}
            value={from}
            min={0}
            max={59984}
            step={16}
            onChange={(page) => setQ({ page })}
          />
          <NumberField
            label={t('mediaEditingTools.basePitch')}
            value={base}
            min={0}
            max={92}
            step={1}
            onChange={(base) => setQ({ base })}
          />
          <NumberField
            label={t('mediaEditingTools.transpose')}
            value={q.shift ?? 0}
            min={-48}
            max={48}
            step={1}
            onChange={(shift) => setQ({ shift })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={project.tracks.length >= 32}
            onClick={() => {
              commit({
                ...project,
                tracks: [
                  ...project.tracks,
                  emptyMidiTrack(project.tracks.length),
                ],
              });
              setTrack(project.tracks.length);
              setSelected(null);
            }}
          >
            {t('mediaEditingTools.addTrack')}
          </Button>
          <Button
            variant="outline"
            disabled={project.tracks.length < 2}
            onClick={() => {
              commit({
                ...project,
                tracks: project.tracks.filter((_, i) => i !== track),
              });
              setTrack(0);
              setSelected(null);
            }}
          >
            {t('mediaEditingTools.removeTrack')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                commit(transformMidi(project, track, grid, 0));
                setSelected(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t('mediaEditingTools.quantize')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                commit(transformMidi(project, track, 0, q.shift ?? 0));
                setSelected(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t('mediaEditingTools.applyTranspose')}
          </Button>
        </div>
        {current && (
          <>
            <Label htmlFor="midi-track-name">
              {t('mediaEditingTools.trackName')}
            </Label>
            <Input
              id="midi-track-name"
              value={current.name}
              maxLength={100}
              onChange={(e) =>
                commit({
                  ...project,
                  tracks: project.tracks.map((tr, i) =>
                    i === track ? { ...tr, name: e.target.value } : tr,
                  ),
                })
              }
            />
            <div className="overflow-x-auto rounded border">
              <svg
                viewBox="0 0 1040 720"
                className="min-w-[700px] w-full"
                role="img"
                aria-label={t('mediaEditingTools.pianoRoll')}
                onClick={(e) => {
                  if (disabled) return;
                  const rect = e.currentTarget.getBoundingClientRect(),
                    x = ((e.clientX - rect.left) / rect.width) * 1040,
                    y = ((e.clientY - rect.top) / rect.height) * 720;
                  if (x < 80) return;
                  setSelected(null);
                  setPitch(base + 35 - Math.min(35, Math.floor(y / 20)));
                  setStart(from + Math.floor((x - 80) / 60 / grid) * grid);
                }}
              >
                {Array.from({ length: 36 }, (_, row) => {
                  const pitch = base + 35 - row;
                  return (
                    <g key={pitch}>
                      <rect
                        x="0"
                        y={row * 20}
                        width="1040"
                        height="20"
                        fill={
                          [1, 3, 6, 8, 10].includes(pitch % 12)
                            ? '#e2e8f0'
                            : '#f8fafc'
                        }
                        stroke="#cbd5e1"
                        strokeWidth="0.5"
                      />
                      <text
                        x="5"
                        y={row * 20 + 14}
                        fontSize="12"
                        fill="#111827"
                      >
                        {noteName(pitch)}
                      </text>
                    </g>
                  );
                })}
                {Array.from({ length: 17 }, (_, i) => (
                  <line
                    key={i}
                    x1={80 + i * 60}
                    x2={80 + i * 60}
                    y1="0"
                    y2="720"
                    stroke={i % 4 === 0 ? '#64748b' : '#cbd5e1'}
                  />
                ))}
                {current.notes.map((n, i) =>
                  n.midi >= base &&
                  n.midi < base + 36 &&
                  n.ticks / ppq + n.durationTicks / ppq > from &&
                  n.ticks / ppq < from + 16 ? (
                    <rect
                      key={i}
                      x={80 + Math.max(0, n.ticks / ppq - from) * 60}
                      y={(base + 35 - n.midi) * 20 + 2}
                      width={Math.max(
                        2,
                        (Math.min(
                          from + 16,
                          (n.ticks + n.durationTicks) / ppq,
                        ) -
                          Math.max(from, n.ticks / ppq)) *
                          60,
                      )}
                      height="16"
                      rx="2"
                      fill={selected === i ? '#f97316' : '#8b5cf6'}
                      fillOpacity={0.3 + n.velocity * 0.7}
                      tabIndex={0}
                      role="button"
                      aria-label={`${noteName(n.midi)} ${n.ticks / ppq}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!disabled) pick(i);
                      }}
                      onKeyDown={(e) => {
                        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          pick(i);
                        }
                      }}
                    />
                  ) : null,
                )}
              </svg>
            </div>
            <p className="text-sm">{t('mediaEditingTools.rollHint')}</p>
            <div className="grid gap-3 md:grid-cols-4">
              <NumberField
                label={t('mediaEditingTools.pitch')}
                value={pitch}
                min={0}
                max={127}
                step={1}
                onChange={setPitch}
              />
              <NumberField
                label={t('mediaEditingTools.startBeat')}
                value={start}
                min={0}
                max={60000}
                step={grid}
                onChange={setStart}
              />
              <NumberField
                label={t('mediaEditingTools.lengthBeat')}
                value={length}
                min={0.0625}
                max={60000}
                step={grid}
                onChange={setLength}
              />
              <NumberField
                label={t('mediaEditingTools.velocity')}
                value={velocity}
                min={1}
                max={127}
                step={1}
                onChange={setVelocity}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveNote}>
                {t(
                  selected === null
                    ? 'mediaEditingTools.addNote'
                    : 'mediaEditingTools.updateNote',
                )}
              </Button>
              {selected !== null && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      commit({
                        ...project,
                        tracks: project.tracks.map((tr, i) =>
                          i === track
                            ? {
                                ...tr,
                                notes: tr.notes.filter(
                                  (_, i) => i !== selected,
                                ),
                              }
                            : tr,
                        ),
                      });
                      setSelected(null);
                    }}
                  >
                    {t('mediaEditingTools.deleteNote')}
                  </Button>
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    {t('mediaEditingTools.deselect')}
                  </Button>
                </>
              )}
            </div>
            <details>
              <summary>
                {t('mediaEditingTools.tempoMap')} ({project.header.tempos.length})
              </summary>
              {project.header.tempos.map((tempo, i) => (
                <div className="grid gap-3 py-2 md:grid-cols-2" key={i}>
                  <NumberField
                    label={t('mediaEditingTools.startBeat')}
                    value={tempo.ticks / ppq}
                    min={0}
                    max={60000}
                    onChange={(value) => {
                      if (!Number.isFinite(value) || value < 0 || value > 60000)
                        return;
                      commit({
                        ...project,
                        header: {
                          ...project.header,
                          tempos: project.header.tempos
                            .map((x, j) =>
                              i === j
                                ? { ...x, ticks: Math.round(value * ppq) }
                                : x,
                            )
                            .sort((a, b) => a.ticks - b.ticks),
                        },
                      });
                    }}
                  />
                  <NumberField
                    label="BPM"
                    value={tempo.bpm}
                    min={10}
                    max={600}
                    onChange={(bpm) => {
                      if (!Number.isFinite(bpm) || bpm < 10 || bpm > 600)
                        return;
                      commit({
                        ...project,
                        header: {
                          ...project.header,
                          tempos: project.header.tempos.map((x, j) =>
                            i === j ? { ...x, bpm } : x,
                          ),
                        },
                      });
                    }}
                  />
                </div>
              ))}
            </details>
          </>
        )}
      </fieldset>
    </div>
  );
}
