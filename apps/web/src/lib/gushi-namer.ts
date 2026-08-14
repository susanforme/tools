import { loadCachedCdnAsset } from './cdn-asset-cache';

// 行为与诗文数据参考 holynova/gushi_namer@2b478c5485e2f6995c86fc6c2e976feedeef5147。
const POETRY_CDN_BASE =
  'https://cdn.jsdelivr.net/gh/holynova/gushi_namer@2b478c5485e2f6995c86fc6c2e976feedeef5147/public/json';
export const POETRY_BOOKS = [
  { id: 'shijing', name: '诗经' },
  { id: 'chuci', name: '楚辞' },
  { id: 'tangshi', name: '唐诗' },
  { id: 'songci', name: '宋词' },
  { id: 'yuefu', name: '乐府诗集' },
  { id: 'gushi', name: '古诗三百首' },
  { id: 'cifu', name: '著名辞赋' },
] as const;

export type PoetryBookId = (typeof POETRY_BOOKS)[number]['id'];

export interface PoetryPassage {
  content: string;
  title: string;
  author: string | null;
  book: string;
  dynasty: string;
}

export interface PoetryName extends PoetryPassage {
  name: string;
  sentence: string;
}

const BAD_CHARACTERS = new Set(
  '胸鬼懒禽鸟鸡我邪罪凶丑仇鼠蟋蟀淫秽妹狐鸡鸭蝇悔鱼肉苦犬吠窥血丧饥女搔父母昏狗蟊疾病痛死潦哀痒害蛇牲妇狸鹅穴畜烂兽靡爪氓劫鬣螽毛婚姻匪婆羞辱'.split(
    '',
  ),
);

const between = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min));

const choose = <T>(items: T[]): T | undefined =>
  items[between(0, items.length)];

export function formatPoetryContent(content: string): string {
  return content
    .replace(/(\s|　|”|“){1,}|<br>|<p>|<\/p>/g, '')
    .replace(/\(.+\)/g, '');
}

export function splitPoetrySentences(content: string): string[] {
  if (!content) return [];
  return formatPoetryContent(content)
    .replace(/！|。|？|；/g, (value) => `${value}|`)
    .replace(/\|$/g, '')
    .split('|')
    .filter((item) => item.length >= 2);
}

function cleanSentence(sentence: string): string {
  return sentence
    .replace(/[<>《》！*\(\^\)\$%~!@#…&%￥—\+=、。，？；‘’“”：·`]/g, '')
    .split('')
    .filter((character) => !BAD_CHARACTERS.has(character))
    .join('');
}

function getTwoCharacters(characters: string[]): string {
  const first = between(0, characters.length);
  let second = between(0, characters.length);
  let retries = 0;
  while (second === first) {
    second = between(0, characters.length);
    retries += 1;
    if (retries > 1000) break;
  }
  return first <= second
    ? `${characters[first]}${characters[second]}`
    : `${characters[second]}${characters[first]}`;
}

export function generatePoetryName(
  passages: PoetryPassage[],
): PoetryName | null {
  const passage = choose(passages);
  if (!passage?.content) return null;
  const sentence = choose(splitPoetrySentences(passage.content));
  if (!sentence) return null;
  const cleanCharacters = cleanSentence(sentence).split('');
  if (cleanCharacters.length < 2) return null;
  return {
    ...passage,
    name: getTwoCharacters(cleanCharacters),
    sentence,
  };
}

export function generatePoetryNames(passages: PoetryPassage[]): PoetryName[] {
  const names: PoetryName[] = [];
  let attempts = 0;
  while (names.length < 6 && attempts < 100) {
    const name = generatePoetryName(passages);
    if (name) names.push(name);
    attempts += 1;
  }
  return names;
}

export async function loadPoetryBook(
  bookId: PoetryBookId,
): Promise<PoetryPassage[]> {
  const source = await loadCachedCdnAsset(
    `${POETRY_CDN_BASE}/${bookId}.json`,
    'application/json',
  );
  return JSON.parse(await source.text()) as PoetryPassage[];
}
