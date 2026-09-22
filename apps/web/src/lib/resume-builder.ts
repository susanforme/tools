import { printLines, sheetImages, studySheet } from './study-print';
export type ResumeSection = { id: string; title: string; body: string };
export type ResumeData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  sections: ResumeSection[];
};
export function defaultResume(language = 'zh'): ResumeData {
  const titles =
    language === 'en'
      ? ['Summary', 'Experience', 'Education', 'Skills']
      : ['个人简介', '工作经历', '教育背景', '技能'];
  return {
    name: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    sections: titles.map((title, i) => ({ id: String(i), title, body: '' })),
  };
}
export function validateResume(value: unknown): ResumeData {
  if (typeof value !== 'object' || value === null)
    throw new Error('backupError');
  const data = value as Record<string, unknown>;
  for (const key of ['name', 'headline', 'email', 'phone', 'location'])
    if (typeof data[key] !== 'string' || data[key].length > 300)
      throw new Error('backupError');
  if (!Array.isArray(data.sections) || data.sections.length > 20)
    throw new Error('backupError');
  const ids = new Set<string>();
  const sections = data.sections.map((section: unknown) => {
    if (typeof section !== 'object' || section === null)
      throw new Error('backupError');
    const row = section as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      ids.has(row.id) ||
      typeof row.title !== 'string' ||
      row.title.length > 100 ||
      typeof row.body !== 'string' ||
      row.body.length > 15000
    )
      throw new Error('backupError');
    ids.add(row.id);
    return { id: row.id, title: row.title, body: row.body };
  });
  return {
    name: data.name as string,
    headline: data.headline as string,
    email: data.email as string,
    phone: data.phone as string,
    location: data.location as string,
    sections,
  };
}
export function resumePages(data: ResumeData, accent: boolean): string[] {
  validateResume(data);
  if (!data.name.trim()) throw new Error('resumeName');
  const images: string[] = [];
  let sheet = studySheet();
  let y = 18;
  const nextPage = () => {
    images.push(...sheetImages([sheet]));
    if (images.length >= 30) throw new Error('pages');
    sheet = studySheet();
    y = 18;
  };
  const text = (value: string, size: number, color = '#111827') => {
    const lines = printLines(sheet.context, value, 174, size);
    for (const line of lines) {
      if (y + size * 1.55 > 280) nextPage();
      sheet.context.font = `${size}px sans-serif`;
      sheet.context.fillStyle = color;
      sheet.context.fillText(line, 18, y);
      y += size * 1.55;
    }
  };
  text(data.name, 9, accent ? '#1d4ed8' : '#111827');
  if (data.headline) text(data.headline, 4.5);
  text(
    [data.email, data.phone, data.location].filter(Boolean).join('  ·  '),
    3.3,
    '#4b5563',
  );
  y += 5;
  for (const section of data.sections) {
    if (!section.body.trim()) continue;
    if (y > 252) nextPage();
    text(section.title, 5, accent ? '#1d4ed8' : '#111827');
    sheet.context.strokeStyle = accent ? '#93c5fd' : '#d1d5db';
    sheet.context.beginPath();
    sheet.context.moveTo(18, y);
    sheet.context.lineTo(192, y);
    sheet.context.stroke();
    y += 3;
    text(section.body, 3.8);
    y += 5;
  }
  images.push(...sheetImages([sheet]));
  return images;
}
