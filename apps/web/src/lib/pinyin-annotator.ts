import { sheetImages, studySheet, validNumber } from './study-print';
export type AnnotatedCharacter = {
  character: string;
  chinese: boolean;
  reading: string;
  alternatives: string[];
};
export async function annotatePinyin(
  text: string,
  surname = false,
): Promise<AnnotatedCharacter[]> {
  if (!text.trim() || Array.from(text).length > 3000)
    throw new Error('pinyinText');
  const { pinyin } = await import('pinyin-pro');
  return pinyin(text.replace(/\r\n?/g, '\n'), {
    type: 'all',
    mode: surname ? 'surname' : 'normal',
    traditional: true,
  }).map((item) => ({
    character: item.origin,
    chinese: /\p{Script=Han}/u.test(item.origin),
    reading: item.isZh ? item.pinyin : '',
    alternatives: item.polyphonic,
  }));
}
export function pinyinSheets(
  characters: AnnotatedCharacter[],
  size: number,
  spacing: number,
  title: string,
): string[] {
  validNumber(size, 4, 10);
  validNumber(spacing, 3, 15);
  if (!characters.length || characters.length > 6000)
    throw new Error('pinyinText');
  const images: string[] = [];
  let sheet = studySheet();
  let x = 15;
  let y = 30;
  const rowHeight = size * 1.7 + spacing;
  const heading = () => {
    sheet.context.textAlign = 'left';
    sheet.context.font = '5px sans-serif';
    sheet.context.fillText(title.slice(0, 50), 15, 12);
  };
  heading();
  const newline = () => {
    x = 15;
    y += rowHeight;
    if (y + size * 1.8 > 282) {
      images.push(...sheetImages([sheet]));
      if (images.length >= 40) throw new Error('pages');
      sheet = studySheet();
      heading();
      y = 30;
    }
  };
  for (const item of characters) {
    if (item.character === '\n') {
      newline();
      continue;
    }
    const ctx = sheet.context;
    ctx.font = `${size * 0.43}px sans-serif`;
    const width = Math.max(size + 1.5, ctx.measureText(item.reading).width + 2);
    if (x + width > 195) newline();
    sheet.context.textAlign = 'center';
    sheet.context.font = `${size * 0.43}px sans-serif`;
    sheet.context.fillText(item.reading, x + width / 2, y);
    sheet.context.font = `${size}px serif`;
    sheet.context.fillText(item.character, x + width / 2, y + size * 0.65);
    x += width;
  }
  images.push(...sheetImages([sheet]));
  return images;
}
