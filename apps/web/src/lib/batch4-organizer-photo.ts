export type PhotoEditOptions = {
  minutes: number;
  author: string;
  copyright: string;
  description: string;
  keywords: string;
  remove: string[];
};
export function shiftExifDate(value: string, minutes: number): string {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match || !Number.isInteger(minutes) || Math.abs(minutes) > 5256000)
    throw Error('photoDate');
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const ms = Date.parse(iso);
  if (
    !Number.isFinite(ms) ||
    new Date(ms).toISOString().slice(0, 19) !== iso.slice(0, 19)
  )
    throw Error('photoDate');
  const date = new Date(ms + minutes * 60000).toISOString();
  if (date.length !== 24) throw Error('photoDate');
  return date.slice(0, 10).replaceAll('-', ':') + ' ' + date.slice(11, 19);
}
function utf16(value: string): number[] {
  return [...Array(value.length + 1).keys()].flatMap((i) => {
    const code = i === value.length ? 0 : value.charCodeAt(i);
    return [code & 255, code >> 8];
  });
}
export async function editPhoto(
  bytes: Uint8Array,
  options: PhotoEditOptions,
): Promise<Uint8Array> {
  if (bytes.length > 20 * 1024 * 1024 || bytes[0] !== 255 || bytes[1] !== 216)
    throw Error('photoFormat');
  if (
    !Number.isInteger(options.minutes) ||
    Math.abs(options.minutes) > 5256000 ||
    [
      options.author,
      options.copyright,
      options.description,
      options.keywords,
    ].some((s) => s.length > 2000) ||
    !/^[\x20-\x7e]*$/.test(options.copyright) ||
    options.remove.some(
      (k) =>
        ![
          'gps',
          'date',
          'author',
          'copyright',
          'description',
          'keywords',
          'device',
        ].includes(k),
    )
  )
    throw Error('photoOptions');
  if (
    !options.minutes &&
    !options.author &&
    !options.copyright &&
    !options.description &&
    !options.keywords &&
    !options.remove.length
  )
    return bytes.slice();
  const { default: piexif } = await import('piexifjs');
  let source = '';
  for (let i = 0; i < bytes.length; i += 8192)
    source += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const exif = piexif.load(source);
  const removals: Record<
    string,
    [keyof Pick<typeof exif, '0th' | 'Exif' | 'GPS'>, number[]][]
  > = {
    gps: [['GPS', Object.keys(exif.GPS).map(Number)]],
    date: [
      ['0th', [306]],
      ['Exif', [36867, 36868, 36880, 36881, 36882, 37520, 37521, 37522]],
    ],
    author: [['0th', [315, 40093]]],
    copyright: [['0th', [33432]]],
    description: [
      ['0th', [270, 40091, 40092]],
      ['Exif', [37510]],
    ],
    keywords: [['0th', [40094]]],
    device: [
      ['0th', [271, 272]],
      ['Exif', [42032, 42033, 42034, 42035, 42036, 42037, 37500]],
    ],
  };
  for (const key of options.remove)
    for (const [directory, tags] of removals[key])
      for (const tag of tags) delete exif[directory][tag];
  if (options.minutes && !options.remove.includes('date'))
    for (const [directory, tags] of removals.date.slice(0, 2)) {
      for (const tag of tags.filter((n) => [306, 36867, 36868].includes(n))) {
        const value = exif[directory][tag];
        if (value !== undefined) {
          if (typeof value !== 'string') throw Error('photoDate');
          exif[directory][tag] = shiftExifDate(
            value.replace(/\0+$/, ''),
            options.minutes,
          );
        }
      }
    }
  if (options.author && !options.remove.includes('author')) {
    exif['0th'][40093] = utf16(options.author);
    if (/^[\x20-\x7e]*$/.test(options.author))
      exif['0th'][315] = options.author;
    else delete exif['0th'][315];
  }
  if (options.copyright && !options.remove.includes('copyright'))
    exif['0th'][33432] = options.copyright;
  if (options.description && !options.remove.includes('description')) {
    exif['0th'][40092] = utf16(options.description);
    if (/^[\x20-\x7e]*$/.test(options.description))
      exif['0th'][270] = options.description;
    else delete exif['0th'][270];
  }
  if (options.keywords && !options.remove.includes('keywords'))
    exif['0th'][40094] = utf16(options.keywords);
  const output = piexif.insert(piexif.dump(exif), source);
  return Uint8Array.from(output, (c) => c.charCodeAt(0));
}
export type PhotoBatchRequest = {
  files: { name: string; data: Uint8Array }[];
  options: PhotoEditOptions;
};
export async function editPhotoBatch(
  request: PhotoBatchRequest,
): Promise<{ zip: Uint8Array; names: string[] }> {
  if (
    !request.files.length ||
    request.files.length > 50 ||
    request.files.reduce((s, f) => s + f.data.length, 0) > 100 * 1024 * 1024
  )
    throw Error('photoSize');
  const files: Record<string, Uint8Array> = Object.create(null) as Record<
    string,
    Uint8Array
  >;
  const names: string[] = [];
  for (let i = 0; i < request.files.length; i++) {
    const f = request.files[i];
    const name = `${String(i + 1).padStart(3, '0')}-${f.name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 150)}`;
    files[name] = await editPhoto(f.data, request.options);
    names.push(name);
  }
  const { zipSync } = await import('fflate');
  return { zip: zipSync(files, { level: 0 }), names };
}
