import { create, type Font, type FontCollection } from 'fontkit';
import {
  FONT_PAGE_SIZE,
  parseGlyphSearch,
  type FontWorkerRequest,
  type FontWorkerResponse,
  type GlyphPreview,
} from '../lib/font-inspector';

let font: Font | null = null;
let activeLoadId = 0;
let codePointsByGlyph: number[][] = [];

const workerScope = self as unknown as {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<FontWorkerRequest>) => void,
  ): void;
  postMessage(message: FontWorkerResponse): void;
};

function isCollection(value: Font | FontCollection): value is FontCollection {
  return value.type === 'TTC' || value.type === 'DFont';
}

function parseFont(buffer: ArrayBuffer): Font {
  const parsed = create(new Uint8Array(buffer) as unknown as Buffer);
  if (isCollection(parsed)) {
    const firstFont = parsed.fonts[0];
    if (!firstFont) throw new Error('The font collection is empty');
    return firstFont;
  }
  return parsed;
}

function indexCodePoints(nextFont: Font): number[][] {
  const index = Array.from(
    { length: nextFont.numGlyphs },
    () => [] as number[],
  );
  for (const codePoint of nextFont.characterSet) {
    const glyphId = nextFont.glyphForCodePoint(codePoint).id;
    index[glyphId]?.push(codePoint);
  }
  return index;
}

function createGlyphPreview(glyphId: number): GlyphPreview {
  if (!font) throw new Error('No font loaded');
  const codePoints = codePointsByGlyph[glyphId] ?? [];
  const glyph = font.getGlyph(glyphId, codePoints);
  const box = glyph.bbox;
  const minimumSize = font.unitsPerEm / 4;
  const width = Math.max(box.width, minimumSize);
  const height = Math.max(box.height, minimumSize);
  const padding = Math.max(width, height) * 0.12;

  return {
    id: glyphId,
    name: glyph.name || `gid${glyphId}`,
    codePoints,
    path: glyph.path.toSVG(),
    viewBox: `${box.minX - padding} ${-box.maxY - padding} ${width + padding * 2} ${height + padding * 2}`,
  };
}

function loadFont(request: Extract<FontWorkerRequest, { type: 'load' }>) {
  font = parseFont(request.buffer);
  activeLoadId = request.loadId;
  codePointsByGlyph = indexCodePoints(font);
  workerScope.postMessage({
    type: 'loaded',
    loadId: request.loadId,
    metadata: {
      type: font.type,
      postscriptName: font.postscriptName,
      fullName: font.fullName,
      familyName: font.familyName,
      subfamilyName: font.subfamilyName,
      unitsPerEm: font.unitsPerEm,
      numGlyphs: font.numGlyphs,
      characterCount: font.characterSet.length,
    },
  });
}

function loadPage(request: Extract<FontWorkerRequest, { type: 'page' }>) {
  if (!font || request.loadId !== activeLoadId) return;
  const start = (request.page - 1) * FONT_PAGE_SIZE;
  const end = Math.min(start + FONT_PAGE_SIZE, font.numGlyphs);
  const glyphs = Array.from({ length: Math.max(0, end - start) }, (_, index) =>
    createGlyphPreview(start + index),
  );
  workerScope.postMessage({
    type: 'page',
    loadId: request.loadId,
    page: request.page,
    glyphs,
  });
}

function searchGlyphs(request: Extract<FontWorkerRequest, { type: 'search' }>) {
  if (!font || request.loadId !== activeLoadId) return;
  const glyphIds = new Set<number>();
  for (const codePoint of parseGlyphSearch(request.query)) {
    if (font.hasGlyphForCodePoint(codePoint)) {
      glyphIds.add(font.glyphForCodePoint(codePoint).id);
    }
  }
  const results = [...glyphIds];
  const start = (request.page - 1) * FONT_PAGE_SIZE;
  workerScope.postMessage({
    type: 'search',
    loadId: request.loadId,
    query: request.query,
    page: request.page,
    total: results.length,
    glyphs: results
      .slice(start, start + FONT_PAGE_SIZE)
      .map(createGlyphPreview),
  });
}

workerScope.addEventListener('message', (event) => {
  const request = event.data;
  try {
    if (request.type === 'load') loadFont(request);
    else if (request.type === 'search') searchGlyphs(request);
    else loadPage(request);
  } catch (cause) {
    workerScope.postMessage({
      type: 'error',
      loadId: request.loadId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
});
