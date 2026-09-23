import {
  mergeCalendars,
  type CalendarMergeRequest,
} from '../lib/calendar-merge';
self.onmessage = async (event: MessageEvent<CalendarMergeRequest>) => {
  try {
    self.postMessage({ result: await mergeCalendars(event.data) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
