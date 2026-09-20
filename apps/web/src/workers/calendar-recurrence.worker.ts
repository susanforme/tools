import {
  expandCalendar,
  type RecurrenceRequest,
} from '../lib/calendar-recurrence';
self.onmessage = async (
  event: MessageEvent<RecurrenceRequest>,
): Promise<void> => {
  try {
    self.postMessage({ result: await expandCalendar(event.data) });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
