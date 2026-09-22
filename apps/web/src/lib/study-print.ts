import { downloadBytes } from './download';
export type StudySheet = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};
export function studySheet(): StudySheet {
  const canvas = document.createElement('canvas');
  canvas.width = 1680;
  canvas.height = 2376;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.scale(8, 8);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 210, 297);
  context.fillStyle = '#111827';
  context.strokeStyle = '#9ca3af';
  context.lineWidth = 0.2;
  context.textBaseline = 'top';
  return { canvas, context };
}
export function printLines(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  size: number,
): string[] {
  context.font = `${size}px sans-serif`;
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const char of paragraph) {
      if (line && context.measureText(line + char).width > width) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    lines.push(line);
  }
  return lines;
}
export function sheetImages(sheets: StudySheet[]): string[] {
  return sheets.map(({ canvas }) => {
    const data = canvas.toDataURL('image/png');
    canvas.width = canvas.height = 0;
    return data;
  });
}
export async function exportStudyPdf(
  images: string[],
  filename: string,
): Promise<void> {
  if (!images.length || images.length > 100) throw new Error('pages');
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const data of images) {
    const image = await pdf.embedPng(data);
    const page = pdf.addPage([(210 * 72) / 25.4, (297 * 72) / 25.4]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }
  downloadBytes(await pdf.save(), filename, 'application/pdf');
}
export async function studyRows(source: string): Promise<string[][]> {
  if (!source.trim() || source.length > 500000) throw new Error('import');
  const { default: Papa } = await import('papaparse');
  const result = Papa.parse<string[]>(source, {
    delimiter: '',
    delimitersToGuess: [',', '\t'],
    skipEmptyLines: 'greedy',
  });
  if (
    result.errors.some((error) => error.code !== 'UndetectableDelimiter') ||
    result.data.length > 2000 ||
    result.data.some(
      (row) => row.length > 30 || row.some((value) => value.length > 10000),
    )
  )
    throw new Error('import');
  return result.data.map((row) => row.map((value) => value.trim()));
}
export function validNumber(
  value: number,
  min: number,
  max: number,
  integer = false,
): void {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error('options');
}
