import type { Body } from 'astronomy-engine';
import { createIcsEvent } from './life-calculators';
export type AstronomyRequest = {
  date: string;
  time: string;
  offset: number;
  latitude: number;
  longitude: number;
  height: number;
};
export type AstronomyResult = {
  instant: string;
  phase: number;
  illumination: number;
  bodies: Array<{
    body: string;
    azimuth: number;
    altitude: number;
    rise: string | null;
    set: string | null;
    windows: Array<{ start: string; end: string }>;
  }>;
  phases: Array<{ angle: number; time: string }>;
};
export function astronomyDate(
  date: string,
  time: string,
  offset: number,
): Date {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !Number.isFinite(offset) ||
    offset < -12 ||
    offset > 14 ||
    date < '1900-01-01' ||
    date > '2100-12-31'
  )
    throw new Error('astroInvalid');
  const parsed = Date.parse(`${date}T${time}:00Z`);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== date
  )
    throw new Error('astroInvalid');
  return new Date(parsed - offset * 3600000);
}
export async function astronomy(
  request: AstronomyRequest,
): Promise<AstronomyResult> {
  const { date, time, offset, latitude, longitude, height } = request;
  if (
    ![latitude, longitude, height].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    height < -400 ||
    height > 10000
  )
    throw new Error('astroInvalid');
  const instant = astronomyDate(date, time, offset),
    start = astronomyDate(date, '00:00', offset),
    night = astronomyDate(date, '12:00', offset);
  const A = await import('astronomy-engine'),
    observer = new A.Observer(latitude, longitude, height);
  const horizon = (body: Body, at: Date) => {
    const eq = A.Equator(body, at, observer, true, true);
    return A.Horizon(at, observer, eq.ra, eq.dec, 'normal');
  };
  const dark = Array.from(
    { length: 145 },
    (_, i) => horizon(A.Body.Sun, new Date(+night + i * 600000)).altitude < -12,
  );
  const bodies = [
    A.Body.Moon,
    A.Body.Mercury,
    A.Body.Venus,
    A.Body.Mars,
    A.Body.Jupiter,
    A.Body.Saturn,
    A.Body.Uranus,
    A.Body.Neptune,
  ].map((body) => {
    const position = horizon(body, instant),
      windows: Array<{ start: string; end: string }> = [];
    let opened: number | null = null;
    for (let i = 0; i <= 144; i++) {
      const at = +night + i * 600000,
        visible =
          i < 144 && dark[i] && horizon(body, new Date(at)).altitude >= 10;
      if (visible && opened === null) opened = at;
      if (!visible && opened !== null) {
        windows.push({
          start: new Date(opened).toISOString(),
          end: new Date(at).toISOString(),
        });
        opened = null;
      }
    }
    return {
      body,
      azimuth: position.azimuth,
      altitude: position.altitude,
      rise:
        A.SearchRiseSet(body, observer, 1, start, 1)?.date.toISOString() ??
        null,
      set:
        A.SearchRiseSet(body, observer, -1, start, 1)?.date.toISOString() ??
        null,
      windows,
    };
  });
  return {
    instant: instant.toISOString(),
    phase: A.MoonPhase(instant),
    illumination: A.Illumination(A.Body.Moon, instant).phase_fraction,
    bodies,
    phases: [0, 90, 180, 270]
      .map((angle) => ({
        angle,
        time: A.SearchMoonPhase(angle, start, 35)!.date.toISOString(),
      }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  };
}
export function astronomyIcs(
  events: Array<{ title: string; start: string; end: string }>,
  location: string,
): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Breeze Tools//Astronomy//EN',
    ...events.map((e) =>
      createIcsEvent({
        title: e.title,
        description: '',
        location,
        start: new Date(e.start),
        end: new Date(e.end),
      })
        .split('\r\n')
        .slice(4, -1)
        .join('\r\n'),
    ),
    'END:VCALENDAR',
  ].join('\r\n');
}
