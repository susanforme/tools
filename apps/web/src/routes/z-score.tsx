import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/z-score')({ component: ZScorePage });

function ZScorePage() {
  return <MathToolPage tool="z-score" />;
}
