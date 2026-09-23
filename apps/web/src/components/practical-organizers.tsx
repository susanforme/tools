import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  habitStreak,
  localDay,
  shiftDay,
  validDate,
  validateHabits,
  validateMeals,
  weekDays,
  shoppingList,
  type Habit,
  type MealData,
} from '@/lib/practical-organizers';
import { OrganizerFrame, useOrganizerStore } from './organizer-store';
import { PracticalText, ExportText } from './practical-ui';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
const INITIAL_HABITS: Habit[] = [];
const INITIAL_MEALS: MealData = { recipes: [], meals: [] };
export function HabitTracker() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'practical-habits',
    INITIAL_HABITS,
    validateHabits,
  );
  const [name, setName] = useState(''),
    [target, setTarget] = useState(7);
  const [dateQuery, setDate] = useQueryParam('date', StringParam, localDay());
  const date = validDate(dateQuery) ? dateQuery : localDay(),
    days = weekDays(date);
  return (
    <OrganizerFrame
      title={t('studio20.tools.habit-tracker.title')}
      store={store}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <PracticalText
          label={t('studio20.name')}
          value={name}
          onChange={setName}
          maxLength={200}
        />
        <NumberField
          label={t('studio20.target')}
          value={target}
          min={1}
          max={7}
          step={1}
          onChange={setTarget}
        />
        <PracticalText
          label={t('studio20.date')}
          value={date}
          type="date"
          onChange={setDate}
        />
      </div>
      <Button
        disabled={
          !name.trim() || !Number.isInteger(target) || target < 1 || target > 7
        }
        onClick={() => {
          if (
            store.setData([
              ...store.data,
              { id: crypto.randomUUID(), name: name.trim(), target, dates: [] },
            ])
          )
            setName('');
        }}
      >
        {t('studio20.add')}
      </Button>
      <div className="space-y-4">
        {store.data.map((habit) => (
          <section className="space-y-3 rounded-xl border p-4" key={habit.id}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-semibold">{habit.name}</h2>
              <span className="text-sm">
                {t('studio20.weekDone')}:{' '}
                {habit.dates.filter((d) => days.includes(d)).length}/
                {habit.target} · {t('studio20.streak')}:{' '}
                {habitStreak(habit.dates, localDay())}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  store.setData(store.data.filter((h) => h.id !== habit.id))
                }
              >
                {t('studio20.remove')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <Button
                  key={day}
                  variant={habit.dates.includes(day) ? 'default' : 'outline'}
                  aria-pressed={habit.dates.includes(day)}
                  disabled={day > localDay()}
                  onClick={() =>
                    store.setData(
                      store.data.map((h) =>
                        h.id === habit.id
                          ? {
                              ...h,
                              dates: h.dates.includes(day)
                                ? h.dates.filter((d) => d !== day)
                                : [...h.dates, day],
                            }
                          : h,
                      ),
                    )
                  }
                >
                  {day.slice(5)}
                </Button>
              ))}
            </div>
            <div
              aria-label={t('studio20.heatmap')}
              className="flex flex-wrap gap-1"
            >
              {Array.from({ length: 91 }, (_, i) => shiftDay(date, i - 90)).map(
                (day) => (
                  <span
                    key={day}
                    title={`${day}: ${habit.dates.includes(day) ? '✓' : '—'}`}
                    className={`h-3 w-3 rounded-sm ${habit.dates.includes(day) ? 'bg-emerald-500' : 'bg-muted'}`}
                  />
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </OrganizerFrame>
  );
}
export function MealPlanner() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'practical-meals',
    INITIAL_MEALS,
    validateMeals,
  );
  const [dateQuery, setDate] = useQueryParam('date', StringParam, localDay());
  const date = validDate(dateQuery) ? dateQuery : localDay(),
    days = weekDays(date);
  const [name, setName] = useState(''),
    [servings, setServings] = useState(2),
    [ingredients, setIngredients] = useState(''),
    [error, setError] = useState<string | null>(null);
  const shopping = shoppingList(store.data, days);
  const addRecipe = () => {
    try {
      const items = ingredients
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [name, amount, unit, ...extra] = line
            .split(',')
            .map((s) => s.trim());
          if (extra.length) throw new Error('invalid');
          return { name, amount: Number(amount), unit };
        });
      const next = {
        ...store.data,
        recipes: [
          ...store.data.recipes,
          { id: crypto.randomUUID(), name, servings, ingredients: items },
        ],
      };
      if (!items.length || !validateMeals(next)) throw new Error('invalid');
      if (store.setData(next)) {
        setName('');
        setIngredients('');
        setError(null);
      }
    } catch (cause) {
      setError(
        t('studio20.error', {
          message: t(`studio20.${(cause as Error).message}`),
        }),
      );
    }
  };
  return (
    <OrganizerFrame
      title={t('studio20.tools.meal-planner.title')}
      store={store}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <PracticalText
          label={t('studio20.recipe')}
          value={name}
          onChange={setName}
          maxLength={200}
        />
        <NumberField
          label={t('studio20.servings')}
          value={servings}
          min={0.1}
          max={100}
          onChange={setServings}
        />
        <PracticalText
          label={t('studio20.week')}
          type="date"
          value={date}
          onChange={setDate}
        />
      </div>
      <PracticalText
        label={t('studio20.ingredientFormat')}
        value={ingredients}
        onChange={setIngredients}
        multiline
      />
      <Button onClick={addRecipe}>{t('studio20.add')}</Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {store.data.recipes.map((recipe) => (
          <Button
            key={recipe.id}
            variant="outline"
            onClick={() =>
              store.setData({
                recipes: store.data.recipes.filter((r) => r.id !== recipe.id),
                meals: store.data.meals.filter((m) => m.recipe !== recipe.id),
              })
            }
          >
            {recipe.name} · {t('studio20.remove')}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {days.map((day) => (
          <section key={day} className="space-y-3 rounded-xl border p-4">
            <h2 className="font-semibold">{day}</h2>
            {['breakfast', 'lunch', 'dinner'].map((slot) => {
              const meal = store.data.meals.find(
                (m) => m.date === day && m.slot === slot,
              );
              return (
                <div className="grid grid-cols-2 gap-2" key={slot}>
                  <ChoiceField
                    label={t(`studio20.${slot}`)}
                    value={meal?.recipe ?? 'none'}
                    options={[
                      { value: 'none', label: t('studio20.none') },
                      ...store.data.recipes.map((r) => ({
                        value: r.id,
                        label: r.name,
                      })),
                    ]}
                    onChange={(recipe) =>
                      store.setData({
                        ...store.data,
                        meals: [
                          ...store.data.meals.filter(
                            (m) => m.date !== day || m.slot !== slot,
                          ),
                          ...(recipe === 'none'
                            ? []
                            : [
                                {
                                  date: day,
                                  slot,
                                  recipe,
                                  servings: meal?.servings ?? 2,
                                },
                              ]),
                        ],
                      })
                    }
                  />
                  <NumberField
                    label={t('studio20.servings')}
                    value={meal?.servings ?? 2}
                    min={0.1}
                    max={100}
                    onChange={(servings) => {
                      if (meal)
                        store.setData({
                          ...store.data,
                          meals: store.data.meals.map((m) =>
                            m === meal ? { ...m, servings } : m,
                          ),
                        });
                    }}
                  />
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">{t('studio20.shopping')}</h2>
        <ul className="space-y-1">
          {shopping.map((item) => (
            <li key={JSON.stringify([item.name, item.unit])}>
              {item.name}: {Number(item.amount.toFixed(4))} {item.unit}
            </li>
          ))}
        </ul>
        <ExportText
          value={shopping
            .map((i) => `${i.name}: ${Number(i.amount.toFixed(4))} ${i.unit}`)
            .join('\n')}
          name="shopping.txt"
        />
      </section>
    </OrganizerFrame>
  );
}
