import { WorkRecords } from '@/components/work-time-workspace';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  addDays,
  calendarFile,
  localDay,
  monthShifts,
  shiftHours,
  validShiftPlan,
  type ShiftPlan,
} from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/shift-calendar')({
  component: ShiftCalendarPage,
});
const INITIAL: ShiftPlan = {
  startDate: '2026-01-01',
  shifts: [
    {
      id: 'day',
      name: '早班',
      start: '08:00',
      end: '16:00',
      rest: false,
      breakMinutes: 0,
    },
    {
      id: 'night',
      name: '夜班',
      start: '20:00',
      end: '08:00',
      rest: false,
      breakMinutes: 60,
    },
    {
      id: 'off',
      name: '休息',
      start: '00:00',
      end: '00:00',
      rest: true,
      breakMinutes: 0,
    },
  ],
  cycle: ['day', 'day', 'night', 'off'],
};
function ShiftCalendarPage() {
  const { t, i18n } = useTranslation();
  const store = useOrganizerStore(
    'tools.shift-calendar.v1',
    INITIAL,
    validShiftPlan,
  );
  const plan = store.data;
  const [month, setMonth] = useQueryParam<string>(
    'month',
    StringParam,
    localDay().slice(0, 7),
  );
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const days = monthShifts(plan, month);
  const hours = days.reduce((sum, day) => sum + shiftHours(day.shift), 0);
  const offset = days.length ? new Date(`${month}-01T12:00:00`).getDay() : 0;
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(
      new Date(2026, 0, 4 + index),
    ),
  );
  const patch = (id: string, changes: Partial<ShiftPlan['shifts'][number]>) =>
    store.setData((previous) => ({
      ...previous,
      shifts: previous.shifts.map((shift) =>
        shift.id === id ? { ...shift, ...changes } : shift,
      ),
    }));
  const exportIcs = () => {
    try {
      const events = days
        .filter((day) => !day.shift.rest)
        .map(({ date, shift }) => ({
          title: shift.name,
          start: new Date(`${date}T${shift.start}`),
          end: new Date(
            `${shift.end <= shift.start ? addDays(date, 1) : date}T${shift.end}`,
          ),
          description: `${t('shiftCalendar.hours')}: ${shiftHours(shift)}`,
        }));
      downloadBlob(
        new Blob([calendarFile(events)], {
          type: 'text/calendar;charset=utf-8',
        }),
        'shifts.ics',
      );
      setError(null);
    } catch {
      setError(t('organizer.exportFailed'));
    }
  };
  const exportImage = async () => {
    setExporting(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 180 + Math.ceil((offset + days.length) / 7) * 170;
      const context = canvas.getContext('2d');
      if (!context) throw Error();
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111827';
      context.font = 'bold 36px sans-serif';
      context.fillText(
        `${month} · ${hours.toFixed(1)} ${t('shiftCalendar.hours')}`,
        25,
        55,
      );
      context.font = '24px sans-serif';
      weekdays.forEach((name, index) =>
        context.fillText(name, index * 200 + 25, 110),
      );
      days.forEach(({ date, shift }, index) => {
        const col = (index + offset) % 7,
          row = Math.floor((index + offset) / 7),
          x = col * 200,
          y = 135 + row * 170;
        context.strokeStyle = '#cbd5e1';
        context.strokeRect(x, y, 200, 170);
        context.fillStyle = '#111827';
        context.font = '24px sans-serif';
        context.fillText(date.slice(-2), x + 16, y + 32);
        context.font = '22px sans-serif';
        context.fillText(shift.name, x + 16, y + 77, 170);
        context.fillStyle = '#475569';
        context.font = '18px sans-serif';
        context.fillText(
          shift.rest ? t('shiftCalendar.rest') : `${shift.start}–${shift.end}`,
          x + 16,
          y + 120,
        );
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve),
      );
      if (!blob) throw Error();
      downloadBlob(blob, 'shift-calendar.png');
      setError(null);
    } catch {
      setError(t('organizer.exportFailed'));
    } finally {
      setExporting(false);
    }
  };
  return (
    <OrganizerFrame title={t('shiftCalendar.title')} store={store}>
      <div className="grid gap-4 md:grid-cols-3">
        <OrganizerInput
          label={t('shiftCalendar.start')}
          type="date"
          value={plan.startDate}
          onChange={(event) =>
            store.setData({ ...plan, startDate: event.target.value })
          }
        />
        <OrganizerInput
          label={t('shiftCalendar.month')}
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
        <p className="self-end rounded-lg border p-3">
          {t('shiftCalendar.hours')}: <strong>{hours.toFixed(1)}</strong> ·{' '}
          {t('shiftCalendar.workDays')}:{' '}
          {days.filter((day) => !day.shift.rest).length}
        </p>
      </div>
      <WorkRecords month={month} planned={hours} />
      <details className="rounded-lg border p-4" open>
        <summary className="cursor-pointer font-medium">
          {t('shiftCalendar.shifts')}
        </summary>
        <div className="mt-4 space-y-3">
          {plan.shifts.map((shift) => (
            <div
              key={shift.id}
              className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-6"
            >
              <OrganizerInput
                label={t('organizer.name')}
                value={shift.name}
                maxLength={120}
                onChange={(event) =>
                  patch(shift.id, { name: event.target.value })
                }
              />
              <OrganizerInput
                label={t('shiftCalendar.from')}
                type="time"
                disabled={shift.rest}
                value={shift.start}
                onChange={(event) =>
                  patch(shift.id, { start: event.target.value })
                }
              />
              <OrganizerInput
                label={t('shiftCalendar.to')}
                type="time"
                disabled={shift.rest}
                value={shift.end}
                onChange={(event) =>
                  patch(shift.id, { end: event.target.value })
                }
              />
              <OrganizerInput
                label={t('shiftCalendar.break')}
                type="number"
                min={0}
                max={1440}
                value={shift.breakMinutes}
                disabled={shift.rest}
                onChange={(event) =>
                  patch(shift.id, { breakMinutes: Number(event.target.value) })
                }
              />
              <Label className="flex h-9 gap-2">
                <Checkbox
                  checked={shift.rest}
                  onCheckedChange={(checked) =>
                    patch(shift.id, { rest: checked === true })
                  }
                />
                {t('shiftCalendar.rest')}
              </Label>
              <Button
                variant="outline"
                disabled={plan.cycle.includes(shift.id)}
                onClick={() =>
                  store.setData({
                    ...plan,
                    shifts: plan.shifts.filter((item) => item.id !== shift.id),
                  })
                }
              >
                {t('organizer.delete')}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={plan.shifts.length >= 20}
            onClick={() =>
              store.setData({
                ...plan,
                shifts: [
                  ...plan.shifts,
                  {
                    id: crypto.randomUUID(),
                    name: t('shiftCalendar.newShift'),
                    start: '09:00',
                    end: '17:00',
                    rest: false,
                    breakMinutes: 0,
                  },
                ],
              })
            }
          >
            {t('shiftCalendar.addShift')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('shiftCalendar.overnight')}
          </p>
        </div>
      </details>
      <section className="space-y-3">
        <h2 className="font-semibold">{t('shiftCalendar.cycle')}</h2>
        <div className="flex flex-wrap gap-3">
          {plan.cycle.map((id, index) => (
            <div key={index} className="flex items-center gap-1">
              <span className="text-sm">{index + 1}</span>
              <Select
                value={id}
                onValueChange={(value) =>
                  store.setData({
                    ...plan,
                    cycle: plan.cycle.map((item, i) =>
                      i === index ? value : item,
                    ),
                  })
                }
              >
                <SelectTrigger
                  aria-label={`${t('shiftCalendar.cycle')} ${index + 1}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plan.shifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${t('organizer.delete')} ${index + 1}`}
                disabled={plan.cycle.length <= 1}
                onClick={() =>
                  store.setData({
                    ...plan,
                    cycle: plan.cycle.filter((_, i) => i !== index),
                  })
                }
              >
                ×
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          disabled={plan.cycle.length >= 60}
          onClick={() =>
            store.setData({
              ...plan,
              cycle: [...plan.cycle, plan.shifts[0].id],
            })
          }
        >
          {t('shiftCalendar.addDay')}
        </Button>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!days.length} onClick={exportIcs}>
          {t('organizer.ics')}
        </Button>
        <Button
          variant="outline"
          disabled={!days.length || exporting}
          onClick={() => void exportImage()}
        >
          {t('shiftCalendar.image')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[560px] grid grid-cols-7 gap-1">
          {weekdays.map((name) => (
            <div key={name} className="p-2 text-center font-medium">
              {name}
            </div>
          ))}
          {Array.from({ length: offset }, (_, index) => (
            <div key={`blank-${index}`} />
          ))}
          {days.map(({ date, shift }) => (
            <div key={date} className="space-y-1 rounded-md border p-2">
              <div className="text-sm text-muted-foreground">
                {date.slice(-2)}
              </div>
              <p className="break-words font-medium">{shift.name}</p>
              <p className="text-xs">
                {shift.rest
                  ? t('shiftCalendar.rest')
                  : `${shift.start}–${shift.end}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {shiftHours(shift).toFixed(1)} h
              </p>
            </div>
          ))}
        </div>
      </div>
    </OrganizerFrame>
  );
}
