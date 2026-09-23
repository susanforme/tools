declare module 'piexifjs' {
  type ExifValue = string | number | number[] | number[][];
  type ExifDirectory = Record<number, ExifValue>;
  type ExifData = {
    '0th': ExifDirectory;
    Exif: ExifDirectory;
    GPS: ExifDirectory;
    Interop: ExifDirectory;
    '1st': ExifDirectory;
    thumbnail: string | null;
  };
  const piexif: {
    load(data: string): ExifData;
    dump(data: ExifData): string;
    insert(exif: string, jpeg: string): string;
  };
  export default piexif;
}
