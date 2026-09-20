import {
  readReportJson,
  reportArray,
  reportNumber,
  reportObject,
  reportPreview,
  reportText,
} from './observability-report';
export type LighthouseAudit = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  mode: string;
  value: number | null;
  unit: string;
  display: string;
  details: string;
  error: string;
};
export type LighthouseReport = {
  version: string;
  url: string;
  time: string;
  environment: string;
  warnings: string[];
  categories: Array<{
    id: string;
    title: string;
    score: number | null;
    audits: string[];
  }>;
  audits: LighthouseAudit[];
};
function score(value: unknown): number | null {
  const number = reportNumber(value);
  if (number !== null && (number < 0 || number > 1))
    throw new Error('invalidFormat');
  return number;
}
export function parseLighthouse(source: string): LighthouseReport {
  const parsed = reportObject(readReportJson(source));
  const root =
    parsed.lighthouseResult === undefined
      ? parsed
      : reportObject(parsed.lighthouseResult);
  if (!reportText(root.lighthouseVersion)) throw new Error('invalidFormat');
  const audits = Object.entries(reportObject(root.audits));
  if (
    audits.length > 5000 ||
    Object.keys(
      root.categories === undefined ? {} : reportObject(root.categories),
    ).length > 100 ||
    reportArray(root.runWarnings).length > 100
  )
    throw new Error('limit');
  const config =
    root.configSettings === undefined ? {} : reportObject(root.configSettings);
  return {
    version: reportText(root.lighthouseVersion),
    url: reportText(
      root.finalDisplayedUrl ?? root.finalUrl ?? root.requestedUrl,
    ),
    time: reportText(root.fetchTime),
    environment: JSON.stringify({
      formFactor: config.formFactor,
      throttlingMethod: config.throttlingMethod,
      throttling: config.throttling,
      screenEmulation: config.screenEmulation,
    }),
    warnings: reportArray(root.runWarnings).map((value) =>
      typeof value === 'string'
        ? reportText(value)
        : reportPreview(value, 2000),
    ),
    categories: Object.entries(
      root.categories === undefined ? {} : reportObject(root.categories),
    ).map(([id, raw]) => {
      const value = reportObject(raw);
      return {
        id,
        title: reportText(value.title, id),
        score: score(value.score),
        audits: reportArray(value.auditRefs).map((ref) =>
          reportText(reportObject(ref).id),
        ),
      };
    }),
    audits: audits.map(([id, raw]) => {
      const value = reportObject(raw);
      return {
        id,
        title: reportText(value.title, id),
        description: reportText(value.description),
        score: score(value.score),
        mode: reportText(value.scoreDisplayMode),
        value: reportNumber(value.numericValue),
        unit: reportText(value.numericUnit),
        display: reportText(value.displayValue),
        details:
          value.details === undefined ? '' : reportPreview(value.details),
        error: reportText(value.errorMessage),
      };
    }),
  };
}
export function compareLighthouse(
  before: LighthouseReport | null,
  after: LighthouseReport | null,
) {
  const a = new Map(before?.audits.map((audit) => [audit.id, audit]) ?? []);
  const b = new Map(after?.audits.map((audit) => [audit.id, audit]) ?? []);
  return [...new Set([...a.keys(), ...b.keys()])].map((id) => {
    const left = a.get(id) ?? null;
    const right = b.get(id) ?? null;
    return {
      id,
      left,
      right,
      numericDelta:
        left?.value !== null &&
        left?.value !== undefined &&
        right?.value !== null &&
        right?.value !== undefined &&
        left.unit === right.unit &&
        !!left.unit
          ? right.value - left.value
          : null,
      scoreDelta:
        left?.score !== null &&
        left?.score !== undefined &&
        right?.score !== null &&
        right?.score !== undefined
          ? (right.score - left.score) * 100
          : null,
    };
  });
}
