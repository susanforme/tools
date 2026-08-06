export const FONT_PAGE_SIZE = 100;
export const MAX_FONT_FILE_SIZE = 64 * 1024 * 1024;

export type FontMetadata = {
  type: string;
  postscriptName: string;
  fullName: string;
  familyName: string;
  subfamilyName: string;
  unitsPerEm: number;
  numGlyphs: number;
  characterCount: number;
};

export type GlyphPreview = {
  id: number;
  name: string;
  codePoints: number[];
  path: string;
  viewBox: string;
};

export type FontWorkerRequest =
  | { type: 'load'; loadId: number; buffer: ArrayBuffer }
  | { type: 'page'; loadId: number; page: number }
  | { type: 'search'; loadId: number; query: string; page: number };

export type FontWorkerResponse =
  | { type: 'loaded'; loadId: number; metadata: FontMetadata }
  | { type: 'page'; loadId: number; page: number; glyphs: GlyphPreview[] }
  | {
      type: 'search';
      loadId: number;
      query: string;
      page: number;
      total: number;
      glyphs: GlyphPreview[];
    }
  | { type: 'error'; loadId: number; error: string };

const SUPPORTED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];

export function isSupportedFontFile(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_FONT_EXTENSIONS.includes(extension);
}

export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function parseGlyphSearch(query: string): number[] {
  const value = query.trim();
  const unicode = /^U\+([0-9A-F]{1,6})$/i.exec(value);
  if (unicode) {
    const codePoint = Number.parseInt(unicode[1], 16);
    return codePoint <= 0x10ffff ? [codePoint] : [];
  }
  return [
    ...new Set(
      Array.from(value, (character) => character.codePointAt(0) as number),
    ),
  ];
}

export function getPageCount(glyphCount: number): number {
  return Math.max(1, Math.ceil(glyphCount / FONT_PAGE_SIZE));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
