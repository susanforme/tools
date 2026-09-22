import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  csvFile,
  integer,
  setTournamentScore,
  tournamentMatches,
  validTournaments,
  type Match,
  type Score,
  type Tournament,
} from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/tournament-bracket')({
  component: TournamentBracketPage,
});
const INITIAL: Tournament[] = [];
function MatchScore({
  match,
  mode,
  onSave,
}: {
  match: Match;
  mode: Tournament['mode'];
  onSave: (score: Score | null) => void;
}) {
  const { t } = useTranslation();
  const [a, setA] = useState(match.score ? String(match.score.a) : '');
  const [b, setB] = useState(match.score ? String(match.score.b) : '');
  const [error, setError] = useState(false);
  useEffect(() => {
    setA(match.score ? String(match.score.a) : '');
    setB(match.score ? String(match.score.b) : '');
    setError(false);
  }, [match.a, match.b, match.score?.a, match.score?.b]);
  const playable = match.ready && match.a !== null && match.b !== null;
  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const score = { a: Number(a), b: Number(b) };
        if (
          !a.trim() ||
          !b.trim() ||
          !integer(score.a, 0, 9999) ||
          !integer(score.b, 0, 9999) ||
          (mode === 'knockout' && score.a === score.b)
        ) {
          setError(true);
          return;
        }
        onSave(score);
        setError(false);
      }}
    >
      <p className="font-medium break-words">
        {match.a ??
          t(
            match.ready ? 'tournamentBracket.bye' : 'tournamentBracket.pending',
          )}{' '}
        <span className="text-muted-foreground">vs</span>{' '}
        {match.b ??
          t(
            match.ready ? 'tournamentBracket.bye' : 'tournamentBracket.pending',
          )}
      </p>
      {playable && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-20"
            aria-label={`${match.a} ${t('tournamentBracket.score')}`}
            type="number"
            min={0}
            max={9999}
            value={a}
            onChange={(event) => setA(event.target.value)}
          />
          <span>:</span>
          <Input
            className="w-20"
            aria-label={`${match.b} ${t('tournamentBracket.score')}`}
            type="number"
            min={0}
            max={9999}
            value={b}
            onChange={(event) => setB(event.target.value)}
          />
          <Button size="sm">{t('organizer.save')}</Button>
          {match.score && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSave(null)}
            >
              {t('tournamentBracket.clearScore')}
            </Button>
          )}
        </div>
      )}
      {match.winner && (
        <p className="text-sm text-primary">
          {t('tournamentBracket.winner')}: {match.winner}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(
            mode === 'knockout'
              ? 'tournamentBracket.noDraw'
              : 'organizer.invalid',
          )}
        </p>
      )}
    </form>
  );
}
function TournamentBracketPage() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'tools.tournament-bracket.v1',
    INITIAL,
    validTournaments,
  );
  const [mode, setMode] = useQueryParam<string>(
    'mode',
    StringParam,
    'knockout',
  );
  const [name, setName] = useState('');
  const [players, setPlayers] = useState('');
  const [selected, setSelected] = useState('');
  const [formError, setFormError] = useState(false);
  const tournament =
    store.data.find((item) => item.id === selected) ?? store.data[0];
  const matches = tournament ? tournamentMatches(tournament) : [];
  const standings =
    tournament?.players
      .map((player) => {
        let points = 0,
          played = 0,
          forGoals = 0,
          against = 0;
        for (const match of matches) {
          if (!match.score || ![match.a, match.b].includes(player)) continue;
          played++;
          const own = match.a === player ? match.score.a : match.score.b,
            other = match.a === player ? match.score.b : match.score.a;
          forGoals += own;
          against += other;
          points += own > other ? 3 : own === other ? 1 : 0;
        }
        return { player, points, played, forGoals, against };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.forGoals - b.against - (a.forGoals - a.against) ||
          b.forGoals - a.forGoals,
      ) ?? [];
  const saveScore = (id: string, score: Score | null) => {
    if (!tournament) return;
    try {
      store.setData((previous) =>
        previous.map((item) =>
          item.id === tournament.id
            ? setTournamentScore(item, id, score)
            : item,
        ),
      );
    } catch {
      setFormError(true);
    }
  };
  const exportSchedule = () => {
    downloadBlob(
      new Blob(
        [
          csvFile([
            [
              t('tournamentBracket.round'),
              t('tournamentBracket.playerA'),
              t('tournamentBracket.playerB'),
              t('tournamentBracket.score'),
              t('tournamentBracket.winner'),
            ],
            ...matches.map((match) => [
              match.round + 1,
              match.a ??
                t(
                  match.ready
                    ? 'tournamentBracket.bye'
                    : 'tournamentBracket.pending',
                ),
              match.b ??
                t(
                  match.ready
                    ? 'tournamentBracket.bye'
                    : 'tournamentBracket.pending',
                ),
              match.score ? `${match.score.a}:${match.score.b}` : '',
              match.winner ?? '',
            ]),
          ]),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      'tournament-schedule.csv',
    );
  };
  return (
    <OrganizerFrame title={t('tournamentBracket.title')} store={store}>
      <form
        className="space-y-4 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const item: Tournament = {
            id: crypto.randomUUID(),
            name: name.trim() || t('tournamentBracket.newTournament'),
            mode: mode === 'league' ? 'league' : 'knockout',
            players: players
              .split(/\r?\n/)
              .map((value) => value.trim())
              .filter(Boolean),
            scores: {},
          };
          if (!validTournaments([item])) {
            setFormError(true);
            return;
          }
          if (store.setData([...store.data, item])) {
            setSelected(item.id);
            setName('');
            setPlayers('');
            setFormError(false);
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <OrganizerInput
            label={t('organizer.name')}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="space-y-2">
            <Label>{t('tournamentBracket.mode')}</Label>
            <Select
              value={mode === 'league' ? 'league' : 'knockout'}
              onValueChange={setMode}
            >
              <SelectTrigger
                className="w-full"
                aria-label={t('tournamentBracket.mode')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="knockout">
                  {t('tournamentBracket.knockout')}
                </SelectItem>
                <SelectItem value="league">
                  {t('tournamentBracket.league')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Label htmlFor="tournament-players">
          {t('tournamentBracket.players')}
        </Label>
        <Textarea
          id="tournament-players"
          value={players}
          rows={5}
          maxLength={4000}
          onChange={(event) => setPlayers(event.target.value)}
        />
        <Button disabled={!players.trim() || store.data.length >= 30}>
          {t('organizer.create')}
        </Button>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {t('tournamentBracket.invalidPlayers')}
          </p>
        )}
      </form>
      {tournament && (
        <>
          <div className="flex flex-wrap gap-3">
            <Select value={tournament.id} onValueChange={setSelected}>
              <SelectTrigger aria-label={t('organizer.name')} className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {store.data.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportSchedule}>
              {t('tournamentBracket.export')}
            </Button>
            <Button
              variant="outline"
              disabled={store.data.length >= 30}
              onClick={() => {
                const id = crypto.randomUUID();
                if (
                  store.setData([
                    ...store.data,
                    {
                      ...tournament,
                      id,
                      name: `${tournament.name.slice(0, 100)} ${t('organizer.copy')}`,
                      scores: {},
                    },
                  ])
                )
                  setSelected(id);
              }}
            >
              {t('tournamentBracket.rematch')}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                store.setData(
                  store.data.filter((item) => item.id !== tournament.id),
                )
              }
            >
              {t('organizer.delete')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              tournament.mode === 'knockout'
                ? 'tournamentBracket.downstream'
                : 'tournamentBracket.pointsRule',
            )}
          </p>
          {tournament.mode === 'knockout' && matches.at(-1)?.winner && (
            <p className="rounded-lg border p-4 text-lg font-semibold">
              {t('tournamentBracket.champion')}: {matches.at(-1)!.winner}
            </p>
          )}
          {tournament.mode === 'league' && (
            <div className="grid gap-2 md:grid-cols-3">
              {standings.map((row, index) => (
                <div key={row.player} className="rounded-lg border p-3">
                  <strong>
                    {index + 1}. {row.player}
                  </strong>
                  <p className="text-sm">
                    {t('tournamentBracket.points')}: {row.points} ·{' '}
                    {t('tournamentBracket.played')}: {row.played} ·{' '}
                    {t('tournamentBracket.difference')}:{' '}
                    {row.forGoals - row.against}
                  </p>
                </div>
              ))}
            </div>
          )}
          {[...new Set(matches.map((match) => match.round))].map((round) => {
            const roundMatches = matches.filter(
              (match) => match.round === round,
            );
            const bye =
              tournament.mode === 'league'
                ? tournament.players.filter(
                    (player) =>
                      !roundMatches.some(
                        (match) => match.a === player || match.b === player,
                      ),
                  )
                : [];
            return (
              <section key={round} className="space-y-3">
                <h2 className="font-semibold">
                  {t('tournamentBracket.round')} {round + 1}
                </h2>
                {bye.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('tournamentBracket.bye')}: {bye.join(', ')}
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {roundMatches.map((match) => (
                    <MatchScore
                      key={`${tournament.id}-${match.id}`}
                      match={match}
                      mode={tournament.mode}
                      onSave={(score) => saveScore(match.id, score)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </OrganizerFrame>
  );
}
