export function cleanMusicXml(source: string): string {
  if (
    !source.trim() ||
    source.length > 5_000_000 ||
    /<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source)
  )
    throw new Error('scoreLimit');
  return source.replace(/<!DOCTYPE[^>]*>/gi, '');
}
