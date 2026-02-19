import { createRootRoute } from '@tanstack/react-router';
import React from 'react';

export const Route = createRootRoute({
  component: React.lazy(() => import('./-client')),
});
