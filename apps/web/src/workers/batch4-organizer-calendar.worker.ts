import {
  mergeCalendars,
  type CalendarMergeRequest,
} from '../lib/batch4-organizer-calendar';
self.onmessage = async (event: MessageEvent<CalendarMergeRequest>) => {
  try {
    self.postMessage({ result: await mergeCalendars(event.data) });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
