import { MathToolPage } from '@/components/math-tool-page';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/confidence-interval')({
  component: ConfidenceIntervalPage,
});

function ConfidenceIntervalPage() {
  return <MathToolPage tool="confidence-interval" />;
}
