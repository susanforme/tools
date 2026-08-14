import { db } from './db';

export const VIDEO_EDITOR_PANEL_IDS = [
  'assets',
  'preview',
  'properties',
] as const;

export type VideoEditorPanelId = (typeof VIDEO_EDITOR_PANEL_IDS)[number];

export type VideoEditorPreferences = {
  layoutVersion: 2;
  panelOrder: VideoEditorPanelId[];
  panelSizes: Record<VideoEditorPanelId, number>;
  timelineSize: number;
  snapping: boolean;
};

export const DEFAULT_VIDEO_EDITOR_PREFERENCES: VideoEditorPreferences = {
  layoutVersion: 2,
  panelOrder: [...VIDEO_EDITOR_PANEL_IDS],
  panelSizes: {
    assets: 22,
    preview: 56,
    properties: 22,
  },
  timelineSize: 30,
  snapping: true,
};

const PREFERENCE_KEY = 'video-editor-layout';
const PANEL_SIZE_RANGE = [10, 80] as const;
const TIMELINE_SIZE_RANGE = [18, 55] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clampNumber(
  value: unknown,
  fallback: number,
  [minimum, maximum]: readonly [number, number],
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function normalizeVideoEditorPreferences(
  value: unknown,
): VideoEditorPreferences {
  const stored = isRecord(value) ? value : {};
  const order = Array.isArray(stored.panelOrder)
    ? stored.panelOrder.filter(
        (panel, index, panels): panel is VideoEditorPanelId =>
          VIDEO_EDITOR_PANEL_IDS.includes(panel as VideoEditorPanelId) &&
          panels.indexOf(panel) === index,
      )
    : [];
  const sizes = isRecord(stored.panelSizes) ? stored.panelSizes : {};
  const hasPercentageLayout = stored.layoutVersion === 2;
  const panelSizes = Object.fromEntries(
    VIDEO_EDITOR_PANEL_IDS.map((panel) => [
      panel,
      clampNumber(
        hasPercentageLayout ? sizes[panel] : null,
        DEFAULT_VIDEO_EDITOR_PREFERENCES.panelSizes[panel],
        PANEL_SIZE_RANGE,
      ),
    ]),
  ) as Record<VideoEditorPanelId, number>;
  const sizeTotal = Object.values(panelSizes).reduce(
    (total, size) => total + size,
    0,
  );
  const normalizedPanelSizes =
    Math.abs(sizeTotal - 100) <= 0.5
      ? panelSizes
      : DEFAULT_VIDEO_EDITOR_PREFERENCES.panelSizes;

  return {
    layoutVersion: 2,
    panelOrder: [
      ...order,
      ...VIDEO_EDITOR_PANEL_IDS.filter((panel) => !order.includes(panel)),
    ],
    panelSizes: normalizedPanelSizes,
    timelineSize: clampNumber(
      hasPercentageLayout ? stored.timelineSize : null,
      DEFAULT_VIDEO_EDITOR_PREFERENCES.timelineSize,
      TIMELINE_SIZE_RANGE,
    ),
    snapping:
      typeof stored.snapping === 'boolean'
        ? stored.snapping
        : DEFAULT_VIDEO_EDITOR_PREFERENCES.snapping,
  };
}

export async function loadVideoEditorPreferences(): Promise<VideoEditorPreferences> {
  const stored = await db.preferences.get(PREFERENCE_KEY);
  if (!stored) return normalizeVideoEditorPreferences(null);
  try {
    return normalizeVideoEditorPreferences(JSON.parse(stored.data));
  } catch {
    return normalizeVideoEditorPreferences(null);
  }
}

export async function saveVideoEditorPreferences(
  preferences: VideoEditorPreferences,
): Promise<VideoEditorPreferences> {
  const normalized = normalizeVideoEditorPreferences(preferences);
  await db.preferences.put({
    tool: PREFERENCE_KEY,
    data: JSON.stringify(normalized),
    updatedAt: Date.now(),
  });
  return normalized;
}
