export type Habit = {
  id: string;
  name: string;
  target: number;
  dates: string[];
};
export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: { name: string; amount: number; unit: string }[];
};
export type Meal = {
  date: string;
  slot: string;
  recipe: string;
  servings: number;
};
export type MealData = { recipes: Recipe[]; meals: Meal[] };
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function short(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 200
  );
}
export function validateHabits(value: unknown): value is Habit[] {
  return (
    Array.isArray(value) &&
    new TextEncoder().encode(JSON.stringify(value)).length <= 1500000 &&
    value.length <= 100 &&
    value.every(
      (h) =>
        object(h) &&
        short(h.id) &&
        short(h.name) &&
        Number.isInteger(h.target) &&
        Number(h.target) >= 1 &&
        Number(h.target) <= 7 &&
        Array.isArray(h.dates) &&
        h.dates.length <= 10000 &&
        h.dates.every(validDate) &&
        new Set(h.dates).size === h.dates.length,
    ) &&
    new Set(value.map((h) => h.id)).size === value.length
  );
}
export function validateMeals(value: unknown): value is MealData {
  if (
    !object(value) ||
    new TextEncoder().encode(JSON.stringify(value)).length > 1500000 ||
    !Array.isArray(value.recipes) ||
    !Array.isArray(value.meals) ||
    value.recipes.length > 200 ||
    value.meals.length > 5000
  )
    return false;
  return (
    value.recipes.every(
      (r) =>
        object(r) &&
        short(r.id) &&
        short(r.name) &&
        typeof r.servings === 'number' &&
        r.servings > 0 &&
        r.servings <= 100 &&
        Array.isArray(r.ingredients) &&
        r.ingredients.length <= 100 &&
        r.ingredients.every(
          (i) =>
            object(i) &&
            short(i.name) &&
            typeof i.amount === 'number' &&
            Number.isFinite(i.amount) &&
            i.amount > 0 &&
            i.amount <= 1e6 &&
            short(i.unit),
        ),
    ) &&
    new Set(value.recipes.map((r) => r.id)).size === value.recipes.length &&
    value.meals.every(
      (m) =>
        object(m) &&
        validDate(m.date) &&
        ['breakfast', 'lunch', 'dinner'].includes(String(m.slot)) &&
        typeof m.servings === 'number' &&
        m.servings > 0 &&
        m.servings <= 100 &&
        (value.recipes as Recipe[]).some((r) => r.id === m.recipe),
    ) &&
    new Set(value.meals.map((m) => `${m.date}:${m.slot}`)).size ===
      value.meals.length
  );
}
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDay(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return localDay(parsed);
}
export function weekDays(date: string): string[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  return Array.from({ length: 7 }, (_, i) =>
    shiftDay(date, i - ((day + 6) % 7)),
  );
}
export function habitStreak(dates: string[], today: string): number {
  const done = new Set(dates);
  let day = done.has(today) ? today : shiftDay(today, -1),
    count = 0;
  while (done.has(day)) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}
export function shoppingList(data: MealData, days: string[]) {
  const list = new Map<
    string,
    { name: string; unit: string; amount: number }
  >();
  for (const meal of data.meals.filter((m) => days.includes(m.date))) {
    const recipe = data.recipes.find((r) => r.id === meal.recipe);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      const key = JSON.stringify([
          ingredient.name.trim().toLocaleLowerCase(),
          ingredient.unit.trim().toLocaleLowerCase(),
        ]),
        old = list.get(key);
      list.set(key, {
        ...ingredient,
        amount:
          (old?.amount ?? 0) +
          (ingredient.amount * meal.servings) / recipe.servings,
      });
    }
  }
  return [...list.values()];
}
