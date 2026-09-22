import {
  isHex,
  isNumberIn,
  isRecord,
  validateCreativeImage,
  type CreativeImage,
} from './creative-tools';
export type Annotation = {
  kind: 'arrow' | 'number' | 'text' | 'block';
  x: number;
  y: number;
  endX: number;
  endY: number;
  color: string;
  size: number;
  text: string;
};
export type ScreenshotProject = {
  version: 1;
  image: CreativeImage | null;
  marks: Annotation[];
  padding: number;
  radius: number;
  background: string;
};
export function validateScreenshotProject(
  value: unknown,
): value is ScreenshotProject {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.image === null || validateCreativeImage(value.image)) &&
    isNumberIn(value.padding, 0, 200) &&
    isNumberIn(value.radius, 0, 160) &&
    isHex(value.background) &&
    Array.isArray(value.marks) &&
    value.marks.length <= 500 &&
    value.marks.every(
      (mark: unknown) =>
        isRecord(mark) &&
        ['arrow', 'number', 'text', 'block'].includes(String(mark.kind)) &&
        ['x', 'y', 'endX', 'endY'].every((key) =>
          isNumberIn(mark[key], 0, 2000),
        ) &&
        isHex(mark.color) &&
        isNumberIn(mark.size, 4, 160) &&
        typeof mark.text === 'string' &&
        mark.text.length <= 200,
    )
  );
}
export function drawScreenshot(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  project: ScreenshotProject,
): void {
  if (!project.image) return;
  const { padding, radius } = project;
  canvas.width = image.naturalWidth + padding * 2;
  canvas.height = image.naturalHeight + padding * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('creativeCommon.canvasError');
  context.fillStyle = project.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.roundRect(
    padding,
    padding,
    image.naturalWidth,
    image.naturalHeight,
    radius,
  );
  context.clip();
  context.drawImage(image, padding, padding);
  context.translate(padding, padding);
  for (const mark of project.marks) {
    context.fillStyle = context.strokeStyle = mark.color;
    context.lineWidth = Math.max(2, mark.size / 6);
    context.lineCap = 'round';
    context.font = `bold ${mark.size}px sans-serif`;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    if (mark.kind === 'block')
      context.fillRect(
        Math.min(mark.x, mark.endX),
        Math.min(mark.y, mark.endY),
        Math.max(1, Math.abs(mark.endX - mark.x)),
        Math.max(1, Math.abs(mark.endY - mark.y)),
      );
    if (mark.kind === 'text') context.fillText(mark.text, mark.x, mark.y);
    if (mark.kind === 'number') {
      context.beginPath();
      context.arc(mark.x, mark.y, mark.size * 0.7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(mark.text, mark.x, mark.y);
    }
    if (mark.kind === 'arrow') {
      const angle = Math.atan2(mark.endY - mark.y, mark.endX - mark.x),
        head = mark.size;
      context.beginPath();
      context.moveTo(mark.x, mark.y);
      context.lineTo(mark.endX, mark.endY);
      context.stroke();
      context.beginPath();
      context.moveTo(mark.endX, mark.endY);
      context.lineTo(
        mark.endX - head * Math.cos(angle - Math.PI / 6),
        mark.endY - head * Math.sin(angle - Math.PI / 6),
      );
      context.lineTo(
        mark.endX - head * Math.cos(angle + Math.PI / 6),
        mark.endY - head * Math.sin(angle + Math.PI / 6),
      );
      context.closePath();
      context.fill();
    }
  }
  context.restore();
}
