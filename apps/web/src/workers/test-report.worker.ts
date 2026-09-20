import type { JunitResult } from '../lib/junit-report';
import type { LcovResult } from '../lib/lcov-report';
export type TestReportRequest = {
  tab: 'junit' | 'lcov';
  current: string;
  baseline: string;
};
export type TestReportResult =
  | { tab: 'junit'; report: JunitResult }
  | { tab: 'lcov'; report: LcovResult };
self.onmessage = async (
  event: MessageEvent<TestReportRequest>,
): Promise<void> => {
  try {
    const { tab, current, baseline } = event.data;
    const result: TestReportResult =
      tab === 'junit'
        ? {
            tab,
            report: await (
              await import('../lib/junit-report')
            ).compareJunit(current, baseline),
          }
        : {
            tab,
            report: (await import('../lib/lcov-report')).compareLcov(
              current,
              baseline,
            ),
          };
    self.postMessage({ result });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
