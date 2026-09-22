import {
  isHex,
  isNumberIn,
  isRecord,
  validateCreativeImage,
  type CreativeImage,
} from './creative-tools';
export type FramedPhoto = {
  id: string;
  image: CreativeImage;
  camera: string;
  lens: string;
  parameters: string;
  date: string;
  caption: string;
};
export type FrameSettings = {
  margin: number;
  background: string;
  foreground: string;
  author: string;
  camera: boolean;
  parameters: boolean;
  date: boolean;
};
export type PhotoFrameProject = {
  version: 1;
  photos: FramedPhoto[];
  settings: FrameSettings;
};
export function formatPhotoExif(
  value: unknown,
): Pick<FramedPhoto, 'camera' | 'lens' | 'parameters' | 'date'> {
  const data = isRecord(value) ? value : {};
  const string = (key: string) =>
    typeof data[key] === 'string' ? data[key].slice(0, 150) : '';
  const number = (key: string) =>
    typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] > 0
      ? data[key]
      : null;
  const aperture = number('FNumber'),
    exposure = number('ExposureTime'),
    iso = number('ISO'),
    focal = number('FocalLength');
  const model = string('Model'),
    make = string('Make');
  const date = data.DateTimeOriginal;
  return {
    camera: model.toLowerCase().includes(make.toLowerCase())
      ? model
      : [make, model].filter(Boolean).join(' '),
    lens: string('LensModel'),
    parameters: [
      focal && `${Number(focal.toFixed(1))} mm`,
      aperture && `f/${Number(aperture.toFixed(1))}`,
      exposure &&
        (exposure < 1 &&
        Math.abs(1 / exposure - Math.round(1 / exposure)) < 0.000001
          ? `1/${Math.round(1 / exposure)} s`
          : `${Number(exposure.toFixed(4))} s`),
      iso && `ISO ${iso}`,
    ]
      .filter(Boolean)
      .join(' · '),
    date:
      date instanceof Date && Number.isFinite(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : '',
  };
}
export function validatePhotoFrameProject(
  value: unknown,
): value is PhotoFrameProject {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.photos) ||
    value.photos.length > 10 ||
    !isRecord(value.settings)
  )
    return false;
  const settings = value.settings;
  return (
    new Set(
      value.photos.map((photo: unknown) => (isRecord(photo) ? photo.id : null)),
    ).size === value.photos.length &&
    isNumberIn(settings.margin, 1, 20) &&
    isHex(settings.background) &&
    isHex(settings.foreground) &&
    typeof settings.author === 'string' &&
    settings.author.length <= 120 &&
    ['camera', 'parameters', 'date'].every(
      (key) => typeof settings[key] === 'boolean',
    ) &&
    value.photos.every(
      (photo: unknown) =>
        isRecord(photo) &&
        typeof photo.id === 'string' &&
        photo.id.length <= 100 &&
        validateCreativeImage(photo.image) &&
        ['camera', 'lens', 'parameters', 'date', 'caption'].every(
          (key) =>
            typeof photo[key] === 'string' &&
            (photo[key] as string).length <= 200,
        ),
    ) &&
    value.photos.reduce(
      (total, photo) =>
        total +
        (photo as FramedPhoto).image.width *
          (photo as FramedPhoto).image.height,
      0,
    ) <= 20_000_000
  );
}
export function drawPhotoFrame(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  photo: FramedPhoto,
  settings: FrameSettings,
): void {
  const margin = Math.round((image.naturalWidth * settings.margin) / 100),
    fontSize = Math.max(14, Math.round(image.naturalWidth / 42));
  const lines = [
    photo.caption,
    settings.camera
      ? [photo.camera, photo.lens].filter(Boolean).join(' · ')
      : '',
    settings.parameters ? photo.parameters : '',
    [settings.author, settings.date ? photo.date : '']
      .filter(Boolean)
      .join(' · '),
  ].filter(Boolean);
  const footer = lines.length ? (fontSize + 12) * lines.length + margin : 0;
  canvas.width = image.naturalWidth + margin * 2;
  canvas.height = image.naturalHeight + margin * 2 + footer;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('creativeCommon.canvasError');
  context.fillStyle = settings.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, margin, margin);
  context.fillStyle = settings.foreground;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  lines.forEach((line, index) => {
    let size = fontSize;
    context.font = `${size}px sans-serif`;
    while (context.measureText(line).width > image.naturalWidth && size > 8) {
      size--;
      context.font = `${size}px sans-serif`;
    }
    context.fillText(
      line,
      canvas.width / 2,
      image.naturalHeight + margin * 2 + index * (fontSize + 12),
      image.naturalWidth,
    );
  });
}
