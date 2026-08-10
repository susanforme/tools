import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/cidr')({
  beforeLoad: () => {
    throw redirect({ to: '/ip-lookup', search: { tab: 'cidr' } });
  },
});
