import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/video-trimmer')({
  beforeLoad: () => {
    throw redirect({ to: '/video-editor', search: { panel: 'media' } });
  },
});
