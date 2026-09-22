import { studyRows } from './study-print';
export type Flashcard = {
  id: string;
  front: string;
  back: string;
  due: number;
  interval: number;
  streak: number;
  reviews: number;
};
export type FlashDeck = { id: string; name: string; cards: Flashcard[] };
export type FlashData = { version: 1; decks: FlashDeck[] };
export function clozeQuestion(text: string): string {
  return text.replace(/\{\{([^{}]+)\}\}/g, '____');
}
export function clozeAnswer(text: string): string {
  return [...text.matchAll(/\{\{([^{}]+)\}\}/g)]
    .map((match) => match[1])
    .join(' / ');
}
export async function importFlashcards(
  source: string,
  header: boolean,
): Promise<Flashcard[]> {
  const rows = await studyRows(source);
  const data = header ? rows.slice(1) : rows;
  if (!data.length) throw new Error('flashImport');
  return data.map((row) => {
    const front = row[0] ?? '';
    const back = row[1] || clozeAnswer(front);
    if (
      !front ||
      !back ||
      front.length > 2000 ||
      back.length > 2000 ||
      row.length > 2
    )
      throw new Error('flashImport');
    return {
      id: crypto.randomUUID(),
      front,
      back,
      due: 0,
      interval: 0,
      streak: 0,
      reviews: 0,
    };
  });
}
export function rateFlashcard(
  card: Flashcard,
  grade: 'again' | 'hard' | 'good' | 'easy',
  now: number,
): Flashcard {
  const interval =
    grade === 'again'
      ? 0
      : grade === 'hard'
        ? Math.max(1, Math.round(card.interval * 1.2))
        : grade === 'easy'
          ? Math.max(4, Math.round(card.interval * 3))
          : card.streak === 0
            ? 1
            : card.streak === 1
              ? 3
              : Math.max(1, Math.round(card.interval * 2.5));
  const bounded = Math.min(3650, interval);
  return {
    ...card,
    interval: bounded,
    due: now + (grade === 'again' ? 10 * 60000 : bounded * 86400000),
    streak: grade === 'again' ? 0 : card.streak + 1,
    reviews: card.reviews + 1,
  };
}
export function validateFlashData(value: unknown): FlashData {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== 1 ||
    !('decks' in value) ||
    !Array.isArray(value.decks) ||
    value.decks.length > 100
  )
    throw new Error('backupError');
  let count = 0;
  let characters = 0;
  const deckIds = new Set<string>();
  const decks = value.decks.map((deck: unknown): FlashDeck => {
    if (typeof deck !== 'object' || deck === null)
      throw new Error('backupError');
    const d = deck as Record<string, unknown>;
    if (
      typeof d.id !== 'string' ||
      deckIds.has(d.id) ||
      typeof d.name !== 'string' ||
      !d.name.trim() ||
      d.name.length > 100 ||
      !Array.isArray(d.cards)
    )
      throw new Error('backupError');
    deckIds.add(d.id);
    count += d.cards.length;
    if (count > 5000) throw new Error('backupError');
    const ids = new Set<string>();
    const cards = d.cards.map((value: unknown): Flashcard => {
      if (typeof value !== 'object' || value === null)
        throw new Error('backupError');
      const card = value as Record<string, unknown>;
      if (
        typeof card.id !== 'string' ||
        ids.has(card.id) ||
        typeof card.front !== 'string' ||
        !card.front.trim() ||
        card.front.length > 2000 ||
        typeof card.back !== 'string' ||
        !card.back.trim() ||
        card.back.length > 2000
      )
        throw new Error('backupError');
      for (const key of ['due', 'interval', 'streak', 'reviews'])
        if (
          typeof card[key] !== 'number' ||
          !Number.isFinite(card[key]) ||
          card[key] < 0 ||
          card[key] > (key === 'due' ? 8640000000000000 : 1000000)
        )
          throw new Error('backupError');
      characters += card.front.length + card.back.length;
      if (characters > 2_000_000) throw new Error('backupError');
      ids.add(card.id);
      return {
        id: card.id,
        front: card.front,
        back: card.back,
        due: card.due as number,
        interval: card.interval as number,
        streak: card.streak as number,
        reviews: card.reviews as number,
      };
    });
    return { id: d.id, name: d.name, cards };
  });
  return { version: 1, decks };
}
