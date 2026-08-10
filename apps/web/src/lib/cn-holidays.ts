/** 中国法定节假日与调休（日期为本地 YYYY-MM-DD） */
const HOLIDAYS: Record<string, 'holiday' | 'workday'> = {
  // 2025
  '2025-01-01': 'holiday',
  '2025-01-26': 'workday',
  '2025-01-28': 'holiday',
  '2025-01-29': 'holiday',
  '2025-01-30': 'holiday',
  '2025-01-31': 'holiday',
  '2025-02-01': 'holiday',
  '2025-02-02': 'holiday',
  '2025-02-03': 'holiday',
  '2025-02-04': 'holiday',
  '2025-02-08': 'workday',
  '2025-04-04': 'holiday',
  '2025-04-05': 'holiday',
  '2025-04-06': 'holiday',
  '2025-04-27': 'workday',
  '2025-05-01': 'holiday',
  '2025-05-02': 'holiday',
  '2025-05-03': 'holiday',
  '2025-05-04': 'holiday',
  '2025-05-05': 'holiday',
  '2025-05-31': 'holiday',
  '2025-06-01': 'holiday',
  '2025-06-02': 'holiday',
  '2025-09-28': 'workday',
  '2025-10-01': 'holiday',
  '2025-10-02': 'holiday',
  '2025-10-03': 'holiday',
  '2025-10-04': 'holiday',
  '2025-10-05': 'holiday',
  '2025-10-06': 'holiday',
  '2025-10-07': 'holiday',
  '2025-10-08': 'holiday',
  '2025-10-11': 'workday',
  // 2026
  '2026-01-01': 'holiday',
  '2026-01-02': 'holiday',
  '2026-01-03': 'holiday',
  '2026-01-04': 'workday',
  '2026-02-14': 'workday',
  '2026-02-15': 'holiday',
  '2026-02-16': 'holiday',
  '2026-02-17': 'holiday',
  '2026-02-18': 'holiday',
  '2026-02-19': 'holiday',
  '2026-02-20': 'holiday',
  '2026-02-21': 'holiday',
  '2026-02-22': 'holiday',
  '2026-02-28': 'workday',
  '2026-04-04': 'holiday',
  '2026-04-05': 'holiday',
  '2026-04-06': 'holiday',
  '2026-05-01': 'holiday',
  '2026-05-02': 'holiday',
  '2026-05-03': 'holiday',
  '2026-05-04': 'holiday',
  '2026-05-05': 'holiday',
  '2026-05-09': 'workday',
  '2026-06-19': 'holiday',
  '2026-06-20': 'holiday',
  '2026-06-21': 'holiday',
  '2026-09-25': 'holiday',
  '2026-09-26': 'holiday',
  '2026-09-27': 'holiday',
  '2026-10-01': 'holiday',
  '2026-10-02': 'holiday',
  '2026-10-03': 'holiday',
  '2026-10-04': 'holiday',
  '2026-10-05': 'holiday',
  '2026-10-06': 'holiday',
  '2026-10-07': 'holiday',
  '2026-10-10': 'workday',
  // 2027
  '2027-01-01': 'holiday',
  '2027-01-02': 'holiday',
  '2027-01-03': 'holiday',
  '2027-02-06': 'workday',
  '2027-02-14': 'holiday',
  '2027-02-15': 'holiday',
  '2027-02-16': 'holiday',
  '2027-02-17': 'holiday',
  '2027-02-18': 'holiday',
  '2027-02-19': 'holiday',
  '2027-02-20': 'holiday',
  '2027-02-21': 'holiday',
  '2027-02-28': 'workday',
  '2027-04-03': 'holiday',
  '2027-04-04': 'holiday',
  '2027-04-05': 'holiday',
  '2027-05-01': 'holiday',
  '2027-05-02': 'holiday',
  '2027-05-03': 'holiday',
  '2027-05-04': 'holiday',
  '2027-05-05': 'holiday',
  '2027-05-08': 'workday',
  '2027-06-09': 'holiday',
  '2027-06-10': 'holiday',
  '2027-06-11': 'holiday',
  '2027-09-15': 'holiday',
  '2027-09-16': 'holiday',
  '2027-09-17': 'holiday',
  '2027-10-01': 'holiday',
  '2027-10-02': 'holiday',
  '2027-10-03': 'holiday',
  '2027-10-04': 'holiday',
  '2027-10-05': 'holiday',
  '2027-10-06': 'holiday',
  '2027-10-07': 'holiday',
  '2027-10-09': 'workday',
};

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isCnWorkday(date: Date): boolean {
  const key = toKey(date);
  const override = HOLIDAYS[key];
  if (override === 'holiday') return false;
  if (override === 'workday') return true;
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function countCnWorkdays(start: Date, end: Date): number {
  const from = new Date(Math.min(start.getTime(), end.getTime()));
  const to = new Date(Math.max(start.getTime(), end.getTime()));
  from.setHours(12, 0, 0, 0);
  to.setHours(12, 0, 0, 0);
  let count = 0;
  for (
    const cursor = new Date(from);
    cursor <= to;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (isCnWorkday(cursor)) count += 1;
  }
  return count;
}

export function countCnHolidays(start: Date, end: Date): number {
  const from = new Date(Math.min(start.getTime(), end.getTime()));
  const to = new Date(Math.max(start.getTime(), end.getTime()));
  from.setHours(12, 0, 0, 0);
  to.setHours(12, 0, 0, 0);
  let count = 0;
  for (
    const cursor = new Date(from);
    cursor <= to;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (!isCnWorkday(cursor)) count += 1;
  }
  return count;
}
