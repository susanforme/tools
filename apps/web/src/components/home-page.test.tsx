// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Route } from '../routes/index';

const favorites = vi.hoisted(() => ({ paths: [] as string[] }));

vi.mock('@/hooks/useFavorites', () => ({
  useFavorites: () => ({
    ready: true,
    favoritePaths: favorites.paths,
    isFavorite: (path: string) => favorites.paths.includes(path),
    toggleFavorite: vi.fn(),
    reorderFavorites: vi.fn(),
  }),
}));
vi.mock('@/hooks/useQueryParams', async () => {
  const { useState } = await import('react');
  return {
    StringParam: {},
    useQueryParam: (_key: string, _param: unknown, initial: string) =>
      useState(initial),
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ to, ...props }: ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props} />
  ),
}));

afterEach(cleanup);

it('replaces recommendations with every favorite and restores them when cleared', () => {
  const HomePage = Route.options.component!;
  const { rerender } = render(<HomePage />);
  expect(
    screen.getByRole('heading', { name: 'home.recommended' }),
  ).toBeTruthy();

  favorites.paths = [
    '/json',
    '/html',
    '/css',
    '/js',
    '/xml',
    '/markdown',
    '/sql',
    '/sql-playground',
    '/yaml',
    '/base64',
  ];
  rerender(<HomePage />);
  expect(screen.queryByText('home.recommended')).toBeNull();
  expect(
    screen.getByRole('heading', { name: 'home.groupFavorites' }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole('link').map((link) => link.getAttribute('href')),
  ).toEqual(favorites.paths);
  expect(
    screen.getAllByRole('button', { name: 'home.unfavorite' }),
  ).toHaveLength(10);

  favorites.paths = [];
  rerender(<HomePage />);
  expect(screen.queryByText('home.groupFavorites')).toBeNull();
  expect(
    screen.getByRole('heading', { name: 'home.recommended' }),
  ).toBeTruthy();
});
